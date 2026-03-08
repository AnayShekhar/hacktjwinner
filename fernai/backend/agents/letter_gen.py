from __future__ import annotations

from ..schemas import BillJSON


def generate_letter(bill: BillJSON) -> str:
    """
    Letter Generation Agent

    In production this could call an LLM with the final BillJSON
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

    flagged_items = [i for i in bill.line_items if i.flagged]
    for item in flagged_items:
        cms_part = f"CMS rate ${item.cms_price:,.2f}, " if item.cms_price is not None else ""
        lines.append(
            f"- CPT {item.cpt_code} ({item.description}): billed ${item.billed_price:,.2f}. "
            f"{cms_part}Potential overcharge ${item.savings:,.2f}. "
            f"{item.flag_reason or ''}"
        )
    if not flagged_items:
        lines.append("After careful review, I am requesting a full itemized breakdown and verification of all charges.")
        lines.append("")

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

