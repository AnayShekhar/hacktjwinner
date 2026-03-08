"""
Temporal fraud detection: procedures after discharge, overlapping dates, etc.
"""
from __future__ import annotations

from typing import Tuple

from ..schemas import BillJSON


def run_temporal_check(bill: BillJSON) -> Tuple[BillJSON, str]:
    """
    Flag: procedures billed after discharge, same procedure on overlapping dates.
    Mutates bill.line_items flag_reason where needed.
    """
    discharge = (bill.discharge_date or "").strip() or None
    if not discharge and not any(getattr(i, "service_date", None) for i in bill.line_items):
        return bill, "Temporal check skipped (no dates)."

    flagged_any = False
    for item in bill.line_items:
        svc_date = getattr(item, "service_date", None) or ""
        svc_date = svc_date.strip() or None
        if not svc_date:
            continue
        if discharge and svc_date > discharge:
            item.flagged = True
            item.flag_reason = (item.flag_reason or "") + " Procedure date after discharge date. "
            if (item.savings or 0) <= 0:
                item.savings = round(item.billed_price * 0.15, 2)
            flagged_any = True

    seen = {}
    for item in bill.line_items:
        key = (item.service_date or "", item.cpt_code or "")
        if not key[0]:
            continue
        if key in seen:
            item.flagged = True
            item.flag_reason = (item.flag_reason or "") + " Same procedure on duplicate/overlapping date. "
            if (item.savings or 0) <= 0:
                item.savings = round(item.billed_price * 0.10, 2)
            flagged_any = True
        seen[key] = True

    return bill, "Temporal check done; flagged post-discharge or overlapping." if flagged_any else "No temporal issues found."
