from __future__ import annotations

from typing import Tuple

from ..ml.anomaly import score_bill_anomalies
from ..rag.retriever import retrieve_cpt_matches
from ..schemas import BillJSON, LineItem

CMS_OVERCHARGE_THRESHOLD = 1.2  # Flag if billed > 20% above CMS rate
# Anomaly score below this = potential outlier (Isolation Forest decision_function)
ANOMALY_SCORE_THRESHOLD = -0.1


def run_price_auditor(bill: BillJSON, persist_directory: str = "chroma_db") -> Tuple[BillJSON, str]:
    """
    For each line item: fill cms_price from RAG if missing, flag if billed > 20% above CMS,
    optionally flag statistical price anomalies. Compute savings and total_recoverable.
    """
    total_recoverable = 0.0
    # Fill missing cms_price from RAG (try full query first, then code-only for better coverage)
    for item in bill.line_items:
        if item.cms_price is not None:
            continue
        for query in [f"{item.cpt_code} {item.description}".strip() or item.cpt_code, item.cpt_code]:
            if not query:
                continue
            matches = retrieve_cpt_matches(query, top_k=1, persist_directory=persist_directory)
            if matches:
                _, _, cms_price, _ = matches[0]
                if cms_price is not None:
                    item.cms_price = cms_price
                    break

    # Flag overcharges and compute savings
    for item in bill.line_items:
        if item.cms_price is None:
            continue
        if item.billed_price > item.cms_price * CMS_OVERCHARGE_THRESHOLD:
            item.flagged = True
            item.savings = max(0.0, item.billed_price - item.cms_price)
            if not item.flag_reason:
                item.flag_reason = (
                    f"Billed ${item.billed_price:.2f} exceeds CMS reference ${item.cms_price:.2f} by more than 20%."
                )
            total_recoverable += item.savings

    # Optional: flag price anomalies (unusual billed amounts)
    try:
        scores = score_bill_anomalies(bill)
        for i, item in enumerate(bill.line_items):
            if i < len(scores) and scores[i] < ANOMALY_SCORE_THRESHOLD and not item.flagged:
                item.flagged = True
                item.flag_reason = (item.flag_reason or "") + " Unusual charge amount vs. other line items."
                if item.savings <= 0 and item.cms_price is not None:
                    item.savings = max(0.0, item.billed_price - item.cms_price)
                    total_recoverable += item.savings
                elif item.savings <= 0:
                    # No CMS reference: use conservative estimate (20% of billed) so total isn't $0
                    item.savings = round(item.billed_price * 0.20, 2)
                    total_recoverable += item.savings
    except Exception:
        pass

    # Any flagged item with no savings yet (e.g. validator-flagged, or <3 items so no anomaly) gets an estimate
    for item in bill.line_items:
        if not item.flagged:
            continue
        if (item.savings or 0) <= 0:
            if item.cms_price is not None:
                item.savings = max(0.0, round(item.billed_price - item.cms_price, 2))
            else:
                item.savings = round(item.billed_price * 0.20, 2)

    # Single source of truth: sum of all flagged item savings
    total_recoverable = sum((i.savings or 0) for i in bill.line_items if i.flagged)

    # Rebuild bill with new LineItem instances so Pydantic serialization includes savings/flagged
    updated_items = [
        LineItem(
            cpt_code=item.cpt_code,
            description=item.description,
            billed_price=item.billed_price,
            flagged=item.flagged,
            flag_reason=item.flag_reason,
            cms_price=item.cms_price,
            savings=item.savings or 0.0,
        )
        for item in bill.line_items
    ]
    bill = BillJSON(
        patient=bill.patient,
        date_of_service=bill.date_of_service,
        provider=bill.provider,
        line_items=updated_items,
        total_billed=bill.total_billed,
        total_recoverable=total_recoverable,
    )
    return bill, f"Price audit complete; ${total_recoverable:.2f} total recoverable."
