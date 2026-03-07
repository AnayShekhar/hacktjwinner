from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Tuple

import chromadb
from sentence_transformers import SentenceTransformer


def _load_cpt_rows(cpt_csv_path: Path) -> List[Tuple[str, str]]:
    """
    Load CPT codes and descriptions from a CSV file.

    Expected columns (at minimum):
      - cpt_code
      - description
    """
    import csv

    rows: List[Tuple[str, str]] = []
    with cpt_csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("cpt_code") or row.get("code")
            desc = row.get("description") or ""
            if not code:
                continue
            rows.append((code, desc))
    return rows


def ingest_cpt_data(
    cpt_csv_path: Path,
    chargemaster_dir: Path | None = None,
    persist_directory: str = "chroma_db",
) -> None:
    """
    Parse cpt_codes.csv (and optionally chargemaster files), embed with
    all-MiniLM-L6-v2, and store in ChromaDB.
    """
    cpt_rows = _load_cpt_rows(cpt_csv_path)

    model = SentenceTransformer("all-MiniLM-L6-v2")
    texts: List[str] = [
        f"{code} - {description}" for code, description in cpt_rows
    ]
    ids: List[str] = [code for code, _ in cpt_rows]

    embeddings = model.encode(texts, batch_size=64, show_progress_bar=True)

    client = chromadb.PersistentClient(path=persist_directory)
    collection = client.get_or_create_collection(name="cpt_codes")

    collection.add(
        ids=ids,
        documents=texts,
        embeddings=list(embeddings),
        metadatas=[{"cpt_code": code} for code in ids],
    )


__all__ = ["ingest_cpt_data"]

