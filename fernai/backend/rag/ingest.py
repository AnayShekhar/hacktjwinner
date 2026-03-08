from __future__ import annotations

import csv
from pathlib import Path
from typing import List, Optional, Tuple

import chromadb
from sentence_transformers import SentenceTransformer


def _load_cpt_rows(cpt_csv_path: Path) -> List[Tuple[str, str, Optional[float]]]:
    """
    Load CPT codes, descriptions, and optional CMS price from CSV.
    Expected columns: cpt_code (or code), description, cms_price (optional).
    """
    rows: List[Tuple[str, str, Optional[float]]] = []
    with cpt_csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (row.get("cpt_code") or row.get("code") or "").strip()
            desc = (row.get("description") or "").strip()
            if not code:
                continue
            raw_price = (row.get("cms_price") or "").strip()
            try:
                cms_price: Optional[float] = float(raw_price) if raw_price else None
            except ValueError:
                cms_price = None
            rows.append((code, desc, cms_price))
    return rows


def ingest_cpt_data(
    cpt_csv_path: Path,
    persist_directory: str = "chroma_db",
) -> None:
    """
    Load CPT CSV, embed with all-MiniLM-L6-v2, and store in ChromaDB.
    Metadata includes cpt_code and cms_price (when available).
    """
    cpt_rows = _load_cpt_rows(cpt_csv_path)
    if not cpt_rows:
        return

    model = SentenceTransformer("all-MiniLM-L6-v2")
    texts = [f"{code} - {description}" for code, description, _ in cpt_rows]
    ids = [code for code, _, _ in cpt_rows]
    emb_raw = model.encode(texts, batch_size=64, show_progress_bar=False)
    # ChromaDB requires native Python floats; sentence_transformers returns numpy float32
    embeddings: List[List[float]] = []
    for i in range(len(emb_raw)):
        embeddings.append([float(emb_raw[i, j]) for j in range(emb_raw.shape[1])])

    client = chromadb.PersistentClient(path=persist_directory)
    try:
        client.delete_collection(name="cpt_codes")
    except Exception:
        pass
    collection = client.get_or_create_collection(name="cpt_codes")

    metadatas: List[dict] = []
    for code, _, cms_price in cpt_rows:
        meta: dict = {"cpt_code": code}
        if cms_price is not None:
            meta["cms_price"] = float(cms_price)
        metadatas.append(meta)

    collection.add(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )


def get_cpt_collection_count(persist_directory: str = "chroma_db") -> int:
    """Return the number of documents in the CPT collection, or 0 if empty/missing."""
    try:
        client = chromadb.PersistentClient(path=persist_directory)
        coll = client.get_or_create_collection(name="cpt_codes")
        return coll.count()
    except Exception:
        return 0


__all__ = ["ingest_cpt_data", "get_cpt_collection_count", "_load_cpt_rows"]
