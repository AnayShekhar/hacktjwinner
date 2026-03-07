from __future__ import annotations

from ..schemas import BillJSON


def generate_letter(bill: BillJSON) -> str:
    """
    Letter Generation Agent

    In production, this would call Gemini 2.0 Flash with the final BillJSON
    and ask it to draft a formal dispute letter that cites CMS rates and
    itemized discrepancies.

    For now, we generate a simple deterministic template so the mobile app
    can render and share a realistic-looking letter.
    """
    lines = []
    lines.append("To Whom It May Concern,")
    lines.append("")
    lines.append(
        f"I am writing to formally dispute charges on my hospital bill from {bill.provider} "
        f"for services rendered on {bill.date_of_service}."
    )
    lines.append(f"Patient: {bill.patient}")
    lines.append("")
    lines.append("After reviewing the itemized charges, I identified the following concerns:")
    lines.append("")

    for item in bill.line_items:
        if not item.flagged:
            continue
        lines.append(
            f"- CPT {item.cpt_code} ({item.description}): billed ${item.billed_price:,.2f}, "
            f"CMS rate ${item.cms_price:,.2f}, potential overcharge ${item.savings:,.2f}."
        )

    if bill.total_recoverable > 0:
        lines.append("")
        lines.append(
            f"Based on the above, I respectfully request an adjustment of at least "
            f"${bill.total_recoverable:,.2f} to align these charges with CMS guidelines."
        )

    lines.append("")
    lines.append("Please provide a written response explaining how these discrepancies will be resolved.")
    lines.append("")
    lines.append("Sincerely,")
    lines.append(bill.patient)

    return "\n".join(lines)

