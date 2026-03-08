"""
Diagnosis coherence: ICD-10 (why) vs CPT (what). Flag when procedures don't match diagnosis.
Simplified: maternity vs non-maternity, ortho vs non-ortho.
"""
from __future__ import annotations

from typing import Tuple

from ..schemas import BillJSON

# Maternity ICD-10 prefixes
MATERNITY_ICD = ("O80", "O81", "O82", "Z33", "Z34", "Z37")
# Maternity CPT ranges
MATERNITY_CPT_PREFIX = ("59", "0196", "598", "594", "595")
# Ortho / fracture CPT
ORTHO_CPT_PREFIX = ("2", "27", "22", "28", "S42", "S52")


def _icd_category(icd: str) -> str | None:
    if not icd:
        return None
    u = (icd or "").upper().strip()
    if any(u.startswith(p) for p in MATERNITY_ICD):
        return "maternity"
    if u.startswith("S42") or u.startswith("S52") or u.startswith("M80"):
        return "ortho"
    return None


def _cpt_category(cpt: str) -> str | None:
    if not cpt:
        return None
    c = (cpt or "").strip()
    if any(c.startswith(p) for p in MATERNITY_CPT_PREFIX):
        return "maternity"
    if any(c.startswith(p) for p in ORTHO_CPT_PREFIX):
        return "ortho"
    return None


def run_diagnosis_coherence(bill: BillJSON) -> Tuple[BillJSON, str]:
    """
    If we have diagnosis codes, check that procedures make sense. Flag mismatches.
    """
    codes = bill.diagnosis_codes or []
    if not codes:
        return bill, "No diagnosis codes to check."

    diag_cats = {_icd_category(c) for c in codes if c}
    diag_cats.discard(None)
    if not diag_cats:
        return bill, "Diagnosis coherence skipped (no known category)."

    flagged_any = False
    for item in bill.line_items:
        proc_cat = _cpt_category(item.cpt_code or "")
        if not proc_cat:
            continue
        if "maternity" in diag_cats and proc_cat == "ortho":
            item.flagged = True
            item.flag_reason = (item.flag_reason or "") + " Procedure may not match diagnosis (maternity vs ortho). "
            if (item.savings or 0) <= 0:
                item.savings = round(item.billed_price * 0.15, 2)
            flagged_any = True
        if "ortho" in diag_cats and proc_cat == "maternity":
            item.flagged = True
            item.flag_reason = (item.flag_reason or "") + " Procedure may not match diagnosis (ortho vs maternity). "
            if (item.savings or 0) <= 0:
                item.savings = round(item.billed_price * 0.15, 2)
            flagged_any = True

    return bill, "Diagnosis coherence done; flagged mismatches." if flagged_any else "Procedures consistent with diagnosis."
