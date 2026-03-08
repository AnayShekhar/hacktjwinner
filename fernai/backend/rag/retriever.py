from __future__ import annotations

from typing import List, Optional, Tuple

import chromadb


def get_cpt_collection(persist_directory: str = "chroma_db"):
    client = chromadb.PersistentClient(path=persist_directory)
    return client.get_or_create_collection(name="cpt_codes")


def retrieve_cpt_matches(
    query: str,
    top_k: int = 5,
    persist_directory: str = "chroma_db",
) -> List[Tuple[str, str, Optional[float], float]]:
    """
    Semantic search over CPT codes. Returns list of
    (cpt_code, description, cms_price, distance).
    Lower distance = better match. Returns empty list if collection is empty or on error.
    """
    try:
        collection = get_cpt_collection(persist_directory=persist_directory)
        n = collection.count()
        if n == 0:
            return []
        results = collection.query(
            query_texts=[query],
            n_results=min(top_k, n),
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []

    matches: List[Tuple[str, str, Optional[float], float]] = []
    ids = results.get("ids", [[]])[0]
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for i, (cpt_id, doc, dist) in enumerate(zip(ids, docs, distances)):
        meta = metas[i] if i < len(metas) else {}
        cms_price = meta.get("cms_price")
        if cms_price is not None and not isinstance(cms_price, (int, float)):
            try:
                cms_price = float(cms_price)
            except (TypeError, ValueError):
                cms_price = None
        elif cms_price is not None and isinstance(cms_price, (int, float)):
            cms_price = float(cms_price)
        doc_str = doc if isinstance(doc, str) else (doc[0] if doc else "")
        matches.append((str(cpt_id), doc_str, cms_price, float(dist)))
    return matches


__all__ = ["get_cpt_collection", "retrieve_cpt_matches"]
