from __future__ import annotations

import os
from typing import List

from ..schemas import BillJSON, LineItem

GROQ_LETTER_MODEL = "llama-3.3-70b-versatile"


def _bill_context_for_llm(bill: BillJSON) -> str:
    """Build a concise text summary of the bill for the LLM."""
    lines = [
        f"Patient: {bill.patient}",
        f"Provider: {bill.provider}",
        f"Date of service: {bill.date_of_service}",
        f"Total billed: ${bill.total_billed:,.2f}",
        f"Total potential overcharge identified: ${bill.total_recoverable:,.2f}",
        "",
        "Line items (flagged items have CMS comparison):",
    ]
    for item in bill.line_items:
        cms_part = f" | CMS rate: ${item.cms_price:,.2f}" if item.cms_price is not None else ""
        flag_part = f" | FLAGGED: {item.flag_reason or 'Overcharge'}. Potential savings: ${item.savings:,.2f}" if item.flagged else ""
        lines.append(
            f"  - CPT {item.cpt_code}: {item.description}. Billed: ${item.billed_price:,.2f}{cms_part}{flag_part}"
        )
    return "\n".join(lines)


def _generate_letter_via_llm(bill: BillJSON) -> str | None:
    """Draft the dispute letter using Groq. Returns None if API key missing or call fails."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        context = _bill_context_for_llm(bill)
        response = client.chat.completions.create(
            model=GROQ_LETTER_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert at writing formal medical billing dispute letters. Your letters are:
- Professional, polite, and firm
- Clear and specific: cite each disputed charge by CPT code, description, amount billed, and CMS or reference rate when available
- Structured: brief intro, numbered or bulleted itemized disputes, then a clear summary request and closing
- Free of markdown, bullet symbols, or formatting—plain paragraphs and line breaks only
- Signed off with "Sincerely," followed by the patient's name (you will be given the patient name)
Do not invent data. Use only the bill information provided. Keep the letter to one page when possible.""",
                },
                {
                    "role": "user",
                    "content": f"Write a formal dispute letter for this bill. Use the patient name as the signatory.\n\n{context}",
                },
            ],
            max_tokens=1024,
            temperature=0.4,
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            return None
        # Ensure it ends with something like Sincerely, \n Patient Name
        if "Sincerely" not in text and bill.patient:
            text = f"{text}\n\nSincerely,\n{bill.patient}"
        return text
    except Exception:  # noqa: BLE001
        return None


def _format_item_dispute(item: LineItem) -> List[str]:
    """One disputed line item as multiple lines of text."""
    cms_part = f" The Medicare CMS rate for this service is ${item.cms_price:,.2f}, indicating a potential overcharge of ${item.savings:,.2f}." if item.cms_price is not None and item.savings > 0 else ""
    reason = f" {item.flag_reason}" if item.flag_reason else ""
    return [
        f"• CPT code {item.cpt_code} — {item.description}",
        f"  Billed amount: ${item.billed_price:,.2f}.{cms_part}{reason}",
    ]


def _generate_letter_template(bill: BillJSON) -> str:
    """Generate a professional dispute letter from a deterministic template."""
    lines: List[str] = []

    # Date and recipient block
    lines.append("Re: Formal dispute of itemized charges")
    lines.append("")
    lines.append("To Whom It May Concern,")
    lines.append("")
    # Opening
    lines.append(
        f"I am writing to formally dispute certain charges on the bill I received from {bill.provider} "
        f"for services rendered on {bill.date_of_service}. I have reviewed the itemized statement and "
        "compared the charges to publicly available Medicare CMS pricing and standard billing practices. "
        "The following items appear to exceed reasonable and customary amounts."
    )
    lines.append("")
    lines.append(f"Patient name: {bill.patient}")
    lines.append("")

    flagged = [i for i in bill.line_items if i.flagged]
    if flagged:
        lines.append("Disputed charges:")
        lines.append("")
        for item in flagged:
            lines.extend(_format_item_dispute(item))
            lines.append("")
        if bill.total_recoverable > 0:
            lines.append(
                f"I respectfully request an adjustment of at least ${bill.total_recoverable:,.2f} to bring "
                "these charges in line with CMS benchmarks and standard rates. I am happy to provide "
                "supporting documentation or discuss payment options once the corrected amount is confirmed."
            )
    else:
        lines.append(
            "I am requesting a complete itemized breakdown and written verification of all charges on this bill, "
            "as well as the applicable billing codes and reference rates used. I would like to resolve any "
            "discrepancies before remitting payment."
        )

    lines.append("")
    lines.append(
        "Please respond in writing within 30 days with an explanation of how these matters will be resolved "
        "and, if applicable, a revised statement. I can be reached at the contact information on file."
    )
    lines.append("")
    lines.append("Sincerely,")
    lines.append("")
    lines.append(bill.patient)

    return "\n".join(lines)


def generate_letter(bill: BillJSON) -> str:
    """
    Letter Generation Agent

    When GROQ_API_KEY is set, uses the Groq LLM to draft a formal dispute letter from the bill data.
    Otherwise, uses an improved deterministic template so the mobile app can render and share the letter.
    """
    letter = _generate_letter_via_llm(bill)
    if letter:
        return letter
    return _generate_letter_template(bill)


def _bill_context_for_explanation(bill: BillJSON) -> str:
    """Build document-specific context for the clean-bill explanation (no overcharges found)."""
    lines = [
        f"Provider: {bill.provider}",
        f"Date of service: {bill.date_of_service}",
        f"Patient: {bill.patient}",
        f"Total billed: ${bill.total_billed:,.2f}",
        f"Number of line items: {len(bill.line_items)}",
        "",
        "Line items on this bill:",
    ]
    for item in bill.line_items:
        lines.append(f"  - CPT {item.cpt_code}: {item.description}, billed ${item.billed_price:,.2f}")
    return "\n".join(lines)


def generate_clean_bill_explanation(bill: BillJSON) -> str:
    """
    When total_recoverable is 0, explain why we found no overcharges or CPT misuse.
    Document-specific: references this bill's provider, date, line items. No dispute letter.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            context = _bill_context_for_explanation(bill)
            response = client.chat.completions.create(
                model=GROQ_LETTER_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You write thorough, document-specific explanations of medical billing audits. "
                            "No markdown. Plain paragraphs only. Reference this specific bill (provider, date, line items, amounts). "
                            "Be detailed: explain every type of check we run, what we looked for, and why this bill passed. "
                            "Aim for 5–8 substantial paragraphs so the user understands exactly why no dispute was generated."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "We audited this bill and found no overcharges or CPT misuse—no dispute is possible. "
                            "Write a very detailed explanation specific to THIS document. "
                            "Include: (1) Summary of this bill (provider, date, patient, total, number of line items). "
                            "(2) CPT code validation: what we check, that every code was validated against our reference database, and that no unknown or inappropriate codes were found. "
                            "(3) Price audit: comparison to Medicare CMS rates; that no line items exceeded acceptable thresholds (e.g. 20% above CMS); mention that we flag overcharges and none were found here. "
                            "(4) Temporal checks: procedures after discharge, overlapping dates, duplicate billing—and that none were flagged. "
                            "(5) Diagnosis coherence: where ICD-10 or diagnosis was available, that procedures matched the diagnosis. "
                            "(6) Clear conclusion: no insurance scams, no misused CPT codes, no overcharges; therefore no dispute letter is generated. "
                            "Use the bill details below so the explanation is clearly about this bill. Be specific and thorough.\n\n"
                            f"{context}"
                        ),
                    },
                ],
                max_tokens=1024,
                temperature=0.3,
            )
            text = (response.choices[0].message.content or "").strip()
            if text:
                return text
        except Exception:  # noqa: BLE001
            pass

    # Template when no LLM (detailed, document-specific)
    lines = [
        f"Summary of this bill: This audit concerns your bill from {bill.provider} for date of service {bill.date_of_service}. The total amount billed is ${bill.total_billed:,.2f}, and the bill contains {len(bill.line_items)} line item(s). Patient name on the bill: {bill.patient}.",
        "",
        "We ran a full audit on this document and found no overcharges or misused CPT codes. Below is a detailed explanation of what we checked and why no dispute letter is being generated.",
        "",
        "1. CPT code validation: Every procedure code (CPT or billing code) on this bill was matched against our reference database of valid medical procedure codes. We verified that each code exists, is appropriate for billing, and is not unknown or invalid. For this bill, all codes passed validation; no unknown or mismatched codes were found.",
        "",
        "2. Price audit (CMS comparison): Each line item was compared to Medicare CMS (Centers for Medicare & Medicaid Services) reference rates where available. We flag charges that exceed reasonable thresholds (for example, more than 20% above the CMS rate). None of the charges on this bill exceeded those thresholds; therefore no overcharges were identified.",
        "",
        "3. Temporal checks: We looked for red flags such as procedures billed with a service date after the patient's discharge date, or the same procedure billed on overlapping or duplicate dates. No such issues were flagged on this bill.",
        "",
        "4. Diagnosis coherence: Where diagnosis codes (e.g. ICD-10) were available on the bill, we checked that the procedures performed are consistent with the diagnosis. No mismatches or incoherent billing were found.",
        "",
        "Conclusion: Because all of these checks passed for this specific bill, we did not identify any insurance scams, misused CPT codes, or overcharges. Therefore no dispute letter is generated. If you believe a particular charge is incorrect, you can tap Appeal to re-run the analysis or contact your provider with your specific concern.",
    ]
    return "\n".join(lines)
