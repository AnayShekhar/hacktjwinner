from __future__ import annotations

from typing import List

import numpy as np
from sklearn.ensemble import IsolationForest

from ..schemas import BillJSON


def score_bill_anomalies(bill: BillJSON) -> List[float]:
    """
    Run Isolation Forest over billed prices to surface statistically
    unusual patterns. Returns anomaly scores (lower = more anomalous).
    """
    prices = np.array([[item.billed_price] for item in bill.line_items], dtype=float)

    if len(prices) < 3:
        # Not enough data to train a meaningful model; treat everything as normal.
        return [0.0 for _ in bill.line_items]

    model = IsolationForest(contamination="auto", random_state=42)
    model.fit(prices)
    scores = model.decision_function(prices)
    return scores.tolist()


__all__ = ["score_bill_anomalies"]

