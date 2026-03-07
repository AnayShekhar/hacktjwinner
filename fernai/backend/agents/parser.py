from __future__ import annotations

from typing import Tuple

from ..schemas import AnalyzeRequest, BillJSON, LineItem


def run_parser(request: AnalyzeRequest) -> Tuple[BillJSON, str]:
    """
    Parser Agent

    In production, this would:
      - Decode the base64 image/PDF
      - Call Gemini Vision (gemini-2.0-flash) with a structured prompt
      - Extract all CPT codes, descriptions, and prices into BillJSON

    For now, we return a minimal BillJSON based on the contract in Tasks.md
    so that the rest of the pipeline and UI can be developed against it.
    """
    dummy_line_item = LineItem(
        cpt_code="99213",
        description="Office visit",
        billed_price=450.0,
        flagged=False,
        flag_reason=None,
        cms_price=120.0,
        savings=0.0,
    )

    bill = BillJSON(
        patient="John Doe",
        date_of_service="2024-01-15",
        provider="General Hospital",
        line_items=[dummy_line_item],
        total_billed=dummy_line_item.billed_price,
        total_recoverable=0.0,
    )

    return bill, "Parser completed with dummy data"

