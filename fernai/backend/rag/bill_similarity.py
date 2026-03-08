"""
Bill similarity search: store anonymized bill embeddings, return count of similar bills.
Used to show "We've seen similar billing patterns from N other hospitals in your region."
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Optional

import chromadb
from sentence_transformers import SentenceTransformer

if TYPE_CHECKING:
    from ..schemas import BillJSON

BILL_COLLECTION = "bill_patterns"
# Same model as CPT ingest for consistency
EMBED_MODEL = "all-MiniLM-L6-v2"
# Cosine distance threshold to count as "similar"
SIMILARITY_THRESHOLD = 0.5
# Max similar to count (for performance)
TOP_K = 50

_model: Optional[SentenceTransformer] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBED_MODEL)
    return _model


def _bill_to_text(bill: "BillJSON") -> str:
    """Anonymized bill summary for embedding (no patient name)."""
    parts = [
        bill.provider or "",
        str(len(bill.line_items or [])),
        str(round((bill.total_billed or 0), 0)),
        "|".join(
            (f"{i.cpt_code}:{round(i.billed_price, 0)}" for i in (bill.line_items or []))
        ),
    ]
    return " ".join(parts)


def add_bill_and_count_similar(
    bill: "BillJSON",
    persist_directory: str = "chroma_db",
) -> int:
    """
    Embed this bill, add to ChromaDB, and return how many other bills are similar (within threshold).
    """
    try:
        client = chromadb.PersistentClient(path=persist_directory)
        coll = client.get_or_create_collection(
            name=BILL_COLLECTION,
            metadata={"description": "Anonymized bill embeddings for similarity"},
        )
    except Exception:
        return 0

    text = _bill_to_text(bill)
    model = _get_model()
    emb = model.encode([text], batch_size=1)
    embedding = [float(x) for x in emb[0].tolist()]

    import time
    doc_id = f"bill_{int(time.time() * 1000)}_{id(bill) % 100000}"
    try:
        coll.add(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[{"provider": (bill.provider or "")[:64], "n_items": len(bill.line_items or [])}],
        )
    except Exception:
        pass

    n = coll.count()
    if n <= 1:
        return 0

    try:
        results = coll.query(
            query_embeddings=[embedding],
            n_results=min(TOP_K, n),
            include=["distances"],
        )
        distances = (results.get("distances") or [[]])[0]
        similar = sum(1 for d in distances if d is not None and float(d) <= SIMILARITY_THRESHOLD)
        return max(0, similar - 1)
    except Exception:
        return 0


__all__ = ["add_bill_and_count_similar"]
