from __future__ import annotations

from typing import Tuple

from ..schemas import BillJSON


def run_validator(bill: BillJSON) -> Tuple[BillJSON, str]:
    """
    CPT Validator Agent

    In production, this would:
      - Load CMS CPT code data via the RAG layer
      - For each line item, verify the CPT code exists and matches the description
      - Set flagged/flag_reason on invalid or mismatched codes

    The current implementation simply echoes the bill so that downstream
    components can be built and tested.
    """
    # Placeholder: return bill unchanged
    return bill, "Validator completed (no changes applied)"

