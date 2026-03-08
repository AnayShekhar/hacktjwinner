"""
LLM-generated insights for each analysis. No static/templated text.
Each insight is dynamically written by the LLM based on the actual document.
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from ..schemas import BillJSON

GROQ_MODEL = "llama-3.3-70b-versatile"


def _call_llm(system: str, user: str, max_tokens: int = 256) -> Optional[str]:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        r = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        text = (r.choices[0].message.content or "").strip()
        return text if text else None
    except Exception:
        return None


def _bill_summary(bill: "BillJSON") -> str:
    lines = [
        f"Provider: {bill.provider}",
        f"Date: {bill.date_of_service}",
        f"Total billed: ${bill.total_billed:,.2f}",
        f"Line items: {len(bill.line_items)}",
    ]
    if bill.diagnosis_codes:
        lines.append(f"Diagnosis codes (ICD-10): {', '.join(bill.diagnosis_codes)}")
    for i, item in enumerate(bill.line_items[:15]):
        sd = f" (service date: {item.service_date})" if item.service_date else ""
        lines.append(f"  - CPT {item.cpt_code}: {item.description}, ${item.billed_price:,.2f}{sd}")
    return "\n".join(lines)


def generate_insight_bill_similarity(
    bill: "BillJSON",
    similar_bills_count: int,
    num_flagged: int,
) -> Optional[str]:
    """
    When a bill is flagged, generate message like "We've seen similar billing patterns
    from 3 other hospitals in your region" by comparing against ChromaDB embeddings.
    """
    context = _bill_summary(bill)
    return _call_llm(
        system="You write one short sentence for a medical billing app. Tone: professional, clear. No markdown. "
        "Reference the specific count and the concept of similar billing patterns / crowdsourced fraud detection.",
        user=f"We compared this bill against anonymized embeddings in ChromaDB. "
        f"Similar bills found: {similar_bills_count}. Bill flagged items: {num_flagged}. "
        f"Write one sentence in the style: 'We've seen similar billing patterns from X other hospitals in your region.' "
        f"Use the actual number {similar_bills_count}. If 0, say we have no similar patterns yet but we're building the database.\n\nBill:\n{context}",
        max_tokens=120,
    )


def generate_insight_diagnosis_coherence(
    bill: "BillJSON",
    agent_message: str,
    flagged_reasons: List[str],
) -> Optional[str]:
    """
    Cross-reference ICD-10 vs CPT. LLM explains if procedures make clinical sense
    (e.g. maternity care billed under broken arm diagnosis).
    """
    context = _bill_summary(bill)
    reasons = "; ".join(flagged_reasons) if flagged_reasons else "None flagged."
    return _call_llm(
        system="You explain medical billing diagnosis coherence. ICD-10 = why treated, CPT = what was done. "
        "Explain if procedures make clinical sense for the diagnosis. Example: maternity care billed under broken arm gets caught. "
        "Tone: professional, clear. No markdown. 2-3 sentences.",
        user=f"Diagnosis coherence result: {agent_message}. Flagged line reasons: {reasons}. "
        f"Write a short explanation for this specific bill. Reference ICD-10 vs CPT. "
        f"If procedures don't match diagnosis, explain the mismatch. If all clear, say so.\n\nBill:\n{context}",
        max_tokens=200,
    )


def generate_insight_suspicion_score(
    bill: "BillJSON",
    suspicion_score: int,
    num_flagged: int,
) -> Optional[str]:
    """
    Generate LLM-written blurb explaining the 0-100 suspicion score based on
    total amount, line items, provider type, and setting.
    """
    context = _bill_summary(bill)
    return _call_llm(
        system="You explain a predictive overcharge suspicion score (0-100). "
        "High score = run full analysis immediately. Based on total bill amount, line count, provider type. "
        "Tone: professional, direct. No markdown. 2-3 sentences.",
        user=f"Suspicion score: {suspicion_score}/100. Flagged items: {num_flagged}. "
        f"Write a short blurb explaining what this score means for this bill. "
        f"Reference the actual score. High score = more suspicious.\n\nBill:\n{context}",
        max_tokens=180,
    )


def generate_insight_temporal(
    bill: "BillJSON",
    agent_message: str,
    flagged_reasons: List[str],
) -> Optional[str]:
    """
    LLM flags and explains date anomalies: procedures after discharge,
    follow-up before initial visit, overlapping dates.
    """
    context = _bill_summary(bill)
    reasons = "; ".join(flagged_reasons) if flagged_reasons else "None flagged."
    return _call_llm(
        system="You explain temporal fraud detection in medical billing. "
        "We flag: procedures billed after discharge, follow-up before initial visit, same procedure on overlapping dates. "
        "Tone: professional, clear. No markdown. 2-3 sentences.",
        user=f"Temporal check result: {agent_message}. Flagged reasons: {reasons}. "
        f"Write a short explanation for this bill. If anomalies found, explain them. If none, say dates were consistent.\n\nBill:\n{context}",
        max_tokens=200,
    )
