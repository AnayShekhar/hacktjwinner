from __future__ import annotations

from typing import Tuple

from ..schemas import BillJSON


CMS_OVERCHARGE_THRESHOLD = 1.2  # >20% above CMS price


def run_price_auditor(bill: BillJSON) -> Tuple[BillJSON, str]:
    """
    Price Auditor Agent

    In production, this would:
      - Look up CMS/Medicare fee schedule via RAG
      - Compare billed_price vs cms_price for each line item
      - Flag items that exceed CMS rate by >20%
      - Run Isolation Forest to detect unusual charge patterns
      - Compute savings per line item and total_recoverable

    The current implementation applies a simple rule-based check using any
    existing cms_price values on the bill.
    """
    total_recoverable = 0.0

    for item in bill.line_items:
        if item.cms_price is None:
            continue

        if item.billed_price > item.cms_price * CMS_OVERCHARGE_THRESHOLD:
            item.flagged = True
            item.savings = max(0.0, item.billed_price - item.cms_price)
            total_recoverable += item.savings

    bill.total_recoverable = total_recoverable
    return bill, "Price auditor completed with simple rule-based checks"

