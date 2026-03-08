from __future__ import annotations

import base64
import io
import json
import os
import re
from typing import Tuple

from PIL import Image

from ..parsers.image_parser import decode_base64_content
from ..schemas import AnalyzeRequest, BillJSON, LineItem

GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
# Groq base64 image limit 4MB; keep JPEG quality moderate
JPEG_QUALITY = 85


def _pdf_first_page_to_image(pdf_bytes: bytes) -> Image.Image:
    """Render the first page of a PDF to a PIL Image."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[0]
        pix = page.get_pixmap(dpi=150, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        return img
    finally:
        doc.close()


def _image_from_base64(content_base64: str, file_type: str) -> Image.Image:
    """Decode request payload to a single PIL Image (first page for PDF). Resized for speed."""
    raw = decode_base64_content(content_base64)
    if file_type.lower() == "pdf":
        img = _pdf_first_page_to_image(raw)
    else:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    return _resize_for_speed(img)


def _resize_for_speed(image: Image.Image, max_size: int = 1200) -> Image.Image:
    """Resize so longest side is max_size to keep analysis under 10s."""
    w, h = image.size
    if w <= max_size and h <= max_size:
        return image
    if w >= h:
        new_w, new_h = max_size, int(h * max_size / w)
    else:
        new_w, new_h = int(w * max_size / h), max_size
    return image.resize((new_w, new_h), Image.Resampling.LANCZOS)


def _pil_to_base64_data_url(image: Image.Image) -> str:
    """Encode PIL Image as JPEG base64 data URL for Groq."""
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def _call_groq_vision(image: Image.Image) -> str:
    """Send image to Groq vision API and return raw text response (expected JSON)."""
    from groq import Groq

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY environment variable is required for bill parsing. "
            "Get a key at https://console.groq.com"
        )
    client = Groq(api_key=api_key)
    image_url = _pil_to_base64_data_url(image)

    prompt = """You are a medical bill data extractor. From this image of a hospital or medical bill, extract structured data. Return ONLY a single valid JSON object, no markdown and no explanation, with this exact structure:

{
  "patient": "full patient name as on bill",
  "date_of_service": "date in YYYY-MM-DD form if possible, else as written",
  "provider": "hospital or provider name",
  "discharge_date": "discharge date in YYYY-MM-DD if visible, else null",
  "diagnosis_codes": ["ICD-10 code if visible", "another if present"] or [],
  "line_items": [
    {
      "cpt_code": "CPT or procedure code if visible, else empty string",
      "description": "short description of the line item",
      "billed_price": number,
      "service_date": "date of this line in YYYY-MM-DD if visible, else null"
    }
  ],
  "total_billed": number
}

Rules:
- Include every charge line you can see. If there are no itemized lines, use a single line with description "Total charge" and the total as billed_price.
- For cpt_code use the actual code if printed (e.g. 99213, 80053); if not visible use "".
- billed_price and total_billed must be numbers. total_billed should match the bill total.
- discharge_date and service_date only if clearly on the bill; use null if not present.
- diagnosis_codes: list any ICD-10 codes (e.g. Z23, S42.001) if printed; omit or [] if none.
- Output nothing but the JSON object."""

    completion = client.chat.completions.create(
        model=GROQ_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url},
                    },
                ],
            }
        ],
        max_completion_tokens=4096,
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    msg = completion.choices[0].message if completion.choices else None
    if not msg or not getattr(msg, "content", None):
        raise ValueError("Groq returned no content.")
    return (msg.content or "").strip()


def _parse_bill_json(raw: str) -> BillJSON:
    """Parse vision model output into BillJSON. Tolerates markdown code blocks."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    data = json.loads(text)

    patient = str(data.get("patient") or "Unknown").strip() or "Unknown"
    date_of_service = str(data.get("date_of_service") or "").strip() or "Unknown"
    provider = str(data.get("provider") or "Unknown").strip() or "Unknown"
    total_billed = float(data.get("total_billed") or 0.0)
    discharge_date = data.get("discharge_date")
    if discharge_date is not None:
        discharge_date = str(discharge_date).strip() or None
    diagnosis_codes = data.get("diagnosis_codes")
    if diagnosis_codes is not None and not isinstance(diagnosis_codes, list):
        diagnosis_codes = None
    if diagnosis_codes is not None:
        diagnosis_codes = [str(c).strip() for c in diagnosis_codes if c]
    raw_items = data.get("line_items") or []
    if not raw_items and total_billed > 0:
        raw_items = [{"cpt_code": "", "description": "Total charge", "billed_price": total_billed}]

    line_items: list[LineItem] = []
    for row in raw_items:
        code = str(row.get("cpt_code") or "").strip()
        desc = str(row.get("description") or "").strip() or "Unspecified"
        try:
            price = float(row.get("billed_price", 0))
        except (TypeError, ValueError):
            price = 0.0
        svc_date = row.get("service_date")
        if svc_date is not None:
            svc_date = str(svc_date).strip() or None
        line_items.append(
            LineItem(
                cpt_code=code or "N/A",
                description=desc,
                billed_price=price,
                flagged=False,
                flag_reason=None,
                cms_price=None,
                savings=0.0,
                service_date=svc_date,
            )
        )

    if not line_items:
        line_items.append(
            LineItem(
                cpt_code="N/A",
                description="No line items extracted",
                billed_price=total_billed,
                flagged=False,
                flag_reason=None,
                cms_price=None,
                savings=0.0,
            )
        )

    return BillJSON(
        patient=patient,
        date_of_service=date_of_service,
        provider=provider,
        line_items=line_items,
        total_billed=total_billed,
        total_recoverable=0.0,
        discharge_date=discharge_date,
        diagnosis_codes=diagnosis_codes,
    )


def run_parser(request: AnalyzeRequest) -> Tuple[BillJSON, str]:
    """
    Decode image/PDF, send to Groq vision API, and parse response into BillJSON.
    """
    image = _image_from_base64(request.image_base64, request.file_type)
    raw = _call_groq_vision(image)
    bill = _parse_bill_json(raw)
    return bill, f"Extracted {len(bill.line_items)} line item(s) from bill."
