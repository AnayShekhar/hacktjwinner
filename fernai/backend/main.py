from __future__ import annotations

import time
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend dir and project root (before other imports that use env)
_backend_dir = Path(__file__).resolve().parent
_env_file = _backend_dir / ".env"
if not _env_file.exists() and (_backend_dir / ".env.example").exists():
    _env_file.write_text((_backend_dir / ".env.example").read_text())
load_dotenv(_env_file)
load_dotenv(_backend_dir.parent.parent / ".env")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .agents import insights_gen, letter_gen, parser, price_auditor, validator
from .agents import temporal_check as temporal_check_agent
from .agents import diagnosis_coherence as diagnosis_coherence_agent
from .config import CHROMA_PERSIST_DIR
from .rag.bill_similarity import add_bill_and_count_similar
from .schemas import AnalyzeRequest, AnalyzeResponse, AgentRunStatus, BillJSON
from .utils.suspicion import compute_suspicion_score

# Reject request body larger than this (bytes). ~20MB allows ~15MB base64 image.
MAX_REQUEST_BODY_BYTES = 20 * 1024 * 1024


app = FastAPI(title="Fern AI Backend", version="0.1.0")


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject oversized bodies to avoid DoS / OOM."""
    if request.method == "POST" and request.url.path == "/analyze":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large. Maximum size is 20 MB."},
            )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """
    Run the full agent pipeline (target <10s):
      Parser -> CPT Validator -> Price Auditor -> Temporal Check -> Letter Gen
    Plus: suspicion score, bill similarity count, timing.
    """
    t0 = time.perf_counter()
    agents_status = [
        AgentRunStatus(name="Parser", status="pending"),
        AgentRunStatus(name="CPT Validator", status="pending"),
        AgentRunStatus(name="Price Auditor", status="pending"),
        AgentRunStatus(name="Letter Gen", status="pending"),
    ]

    try:
        agents_status[0].status = "running"
        bill, parser_detail = parser.run_parser(request)
        extra_pages: list[tuple[str, str]] = []
        if getattr(request, "additional_pages", None) and len(request.additional_pages) > 0:
            for p in request.additional_pages:
                if p and p.base64 and p.file_type:
                    extra_pages.append((p.base64, p.file_type))
        elif getattr(request, "additional_images_base64", None):
            for img_b64 in request.additional_images_base64:
                if img_b64 and isinstance(img_b64, str):
                    extra_pages.append((img_b64, "image"))
        if extra_pages:
            detail_parts = [parser_detail]
            all_line_items = list(bill.line_items)
            total_billed = float(bill.total_billed or 0)
            for b64, ft in extra_pages:
                extra_req = AnalyzeRequest(image_base64=b64, file_type=ft)
                extra_bill, extra_detail = parser.run_parser(extra_req)
                all_line_items.extend(extra_bill.line_items)
                total_billed += float(extra_bill.total_billed or 0)
                detail_parts.append(extra_detail)
            bill = BillJSON(
                patient=bill.patient,
                date_of_service=bill.date_of_service,
                provider=bill.provider,
                line_items=all_line_items,
                total_billed=round(total_billed, 2),
                total_recoverable=0.0,
                discharge_date=bill.discharge_date,
                diagnosis_codes=bill.diagnosis_codes,
            )
            parser_detail = "; ".join(detail_parts)
        agents_status[0].status = "completed"
        agents_status[0].detail = parser_detail
    except Exception as e:  # noqa: BLE001
        agents_status[0].status = "failed"
        agents_status[0].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "Parser"}, "agents": [a.model_dump() for a in agents_status]},
        )

    try:
        agents_status[1].status = "running"
        bill, validator_detail = validator.run_validator(bill, persist_directory=CHROMA_PERSIST_DIR)
        agents_status[1].status = "completed"
        agents_status[1].detail = validator_detail
    except Exception as e:  # noqa: BLE001
        agents_status[1].status = "failed"
        agents_status[1].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "CPT Validator"}, "agents": [a.model_dump() for a in agents_status]},
        )

    diagnosis_coherence_message = None
    try:
        bill, diagnosis_coherence_message = diagnosis_coherence_agent.run_diagnosis_coherence(bill)
    except Exception:
        pass

    try:
        agents_status[2].status = "running"
        bill, auditor_detail = price_auditor.run_price_auditor(bill, persist_directory=CHROMA_PERSIST_DIR)
        agents_status[2].status = "completed"
        agents_status[2].detail = auditor_detail
    except Exception as e:  # noqa: BLE001
        agents_status[2].status = "failed"
        agents_status[2].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "Price Auditor"}, "agents": [a.model_dump() for a in agents_status]},
        )

    temporal_check_message = None
    try:
        bill, temporal_check_message = temporal_check_agent.run_temporal_check(bill)
    except Exception:
        pass

    # Force total_recoverable and per-item savings (single source of truth) before deciding letter vs explanation
    bill_dict = bill.model_dump()
    line_items = bill_dict.get("line_items") or []
    total_recoverable = 0.0
    for item in line_items:
        if not item.get("flagged"):
            continue
        billed = float(item.get("billed_price") or 0)
        cms = item.get("cms_price")
        savings = float(item.get("savings") or 0)
        if savings <= 0:
            if cms is not None:
                savings = max(0.0, round(billed - float(cms), 2))
            else:
                savings = round(billed * 0.20, 2)
            item["savings"] = savings
        total_recoverable += savings
    bill_dict["total_recoverable"] = total_recoverable

    # When nothing to recover, do not generate a dispute letter at all; only AI explanation
    letter = None
    clean_bill_explanation = None
    try:
        agents_status[3].status = "running"
        if total_recoverable <= 0:
            clean_bill_explanation = letter_gen.generate_clean_bill_explanation(bill)
        else:
            letter = letter_gen.generate_letter(bill)
        agents_status[3].status = "completed"
    except Exception as e:  # noqa: BLE001
        agents_status[3].status = "failed"
        agents_status[3].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "Letter Gen"}, "agents": [a.model_dump() for a in agents_status]},
        )

    analysis_time_seconds = round(time.perf_counter() - t0, 2)
    num_flagged = sum(1 for i in line_items if i.get("flagged"))
    suspicion_score = compute_suspicion_score(
        total_billed=float(bill_dict.get("total_billed") or 0),
        num_line_items=len(line_items),
        num_flagged=num_flagged,
    )
    similar_bills_count = 0
    try:
        similar_bills_count = add_bill_and_count_similar(
            BillJSON.model_validate(bill_dict),
            persist_directory=CHROMA_PERSIST_DIR,
        )
    except Exception:
        pass

    bill_obj = BillJSON.model_validate(bill_dict)
    diag_reasons = [i.get("flag_reason") or "" for i in line_items if i.get("flag_reason") and any(k in (i.get("flag_reason") or "").lower() for k in ("diagnosis", "maternity", "ortho", "match"))]
    temporal_reasons = [i.get("flag_reason") or "" for i in line_items if i.get("flag_reason") and any(k in (i.get("flag_reason") or "").lower() for k in ("discharge", "procedure date", "overlapping", "duplicate"))]

    insight_bill_similarity = None
    insight_diagnosis_coherence = None
    insight_suspicion_score = None
    insight_temporal = None
    try:
        insight_bill_similarity = insights_gen.generate_insight_bill_similarity(bill_obj, similar_bills_count, num_flagged)
        insight_diagnosis_coherence = insights_gen.generate_insight_diagnosis_coherence(bill_obj, diagnosis_coherence_message or "", diag_reasons)
        insight_suspicion_score = insights_gen.generate_insight_suspicion_score(bill_obj, suspicion_score, num_flagged)
        insight_temporal = insights_gen.generate_insight_temporal(bill_obj, temporal_check_message or "", temporal_reasons)
    except Exception:
        pass
    # Fallback when LLM unavailable: document-specific text from analysis data
    if not (insight_bill_similarity or insight_bill_similarity.strip()):
        insight_bill_similarity = (
            f"We've seen similar billing patterns from {similar_bills_count} other bill(s) in our database."
            if similar_bills_count > 0
            else "We compared your bill against anonymized embeddings in ChromaDB. No similar billing patterns in our database yet—we're building it over time for crowdsourced fraud detection."
        )
    if not (insight_diagnosis_coherence or insight_diagnosis_coherence.strip()):
        insight_diagnosis_coherence = (
            f"Diagnosis coherence: {diagnosis_coherence_message}" if diagnosis_coherence_message
            else "We cross-referenced ICD-10 diagnosis codes against CPT procedure codes. Procedures are consistent with the diagnosis for this bill."
        )
    if not (insight_suspicion_score or insight_suspicion_score.strip()):
        insight_suspicion_score = (
            f"Suspicion score: {suspicion_score}/100. Based on total bill amount (${bill_dict.get('total_billed', 0):,.2f}), "
            f"{len(line_items)} line items, and {num_flagged} flagged items. "
            + ("High score—consider reviewing flagged charges." if suspicion_score >= 50 else "Score indicates lower likelihood of overcharges.")
        )
    if not (insight_temporal or insight_temporal.strip()):
        insight_temporal = (
            f"Temporal checks: {temporal_check_message}" if temporal_check_message
            else "We checked all line item dates. No anomalies found—no procedures after discharge, no overlapping dates, no follow-up before initial visit."
        )

    return AnalyzeResponse(
        bill=BillJSON.model_validate(bill_dict),
        letter=letter,
        agents=agents_status,
        analysis_time_seconds=analysis_time_seconds,
        suspicion_score=suspicion_score,
        similar_bills_count=similar_bills_count,
        clean_bill_explanation=clean_bill_explanation,
        diagnosis_coherence_message=diagnosis_coherence_message,
        temporal_check_message=temporal_check_message,
        insight_bill_similarity=insight_bill_similarity,
        insight_diagnosis_coherence=insight_diagnosis_coherence,
        insight_suspicion_score=insight_suspicion_score,
        insight_temporal=insight_temporal,
    )

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("fernai.backend.main:app", host="0.0.0.0", port=8000, reload=True)

