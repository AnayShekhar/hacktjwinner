from __future__ import annotations

from typing import List, Tuple

import chromadb


def get_cpt_collection(persist_directory: str = "chroma_db"):
    client = chromadb.PersistentClient(path=persist_directory)
    return client.get_or_create_collection(name="cpt_codes")


def retrieve_cpt_matches(
    query: str,
    top_k: int = 5,
    persist_directory: str = "chroma_db",
) -> List[Tuple[str, str, float]]:
    """
    Semantic search interface used by validator and price auditor agents.
    Returns a list of (cpt_code, description, score).
    """
    collection = get_cpt_collection(persist_directory=persist_directory)
    results = collection.query(query_texts=[query], n_results=top_k)

    matches: List[Tuple[str, str, float]] = []
    ids = results.get("ids", [[]])[0]
    docs = results.get("documents", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for cpt_id, doc, distance in zip(ids, docs, distances):
        matches.append((cpt_id, doc, float(distance)))

    return matches


__all__ = ["get_cpt_collection", "retrieve_cpt_matches"]

