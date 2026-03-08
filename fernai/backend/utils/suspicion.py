"""
Predictive overcharge score 0-100 before/with analysis.
Based on: total bill amount, number of line items, and (when available) flag rate.
"""
from __future__ import annotations


def compute_suspicion_score(
    total_billed: float,
    num_line_items: int,
    num_flagged: int = 0,
) -> int:
    """
    Return 0-100 score. High = more suspicious, run full analysis.
    """
    score = 0
    if total_billed >= 50_000:
        score += 35
    elif total_billed >= 20_000:
        score += 28
    elif total_billed >= 10_000:
        score += 22
    elif total_billed >= 5_000:
        score += 15
    elif total_billed >= 1_000:
        score += 8

    if num_line_items >= 30:
        score += 25
    elif num_line_items >= 15:
        score += 15
    elif num_line_items >= 8:
        score += 8

    if num_flagged > 0:
        score += min(35, 10 + num_flagged * 5)

    return min(100, score)


__all__ = ["compute_suspicion_score"]
