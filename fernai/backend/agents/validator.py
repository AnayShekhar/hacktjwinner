from __future__ import annotations

from pathlib import Path
from typing import Tuple

from ..rag.ingest import get_cpt_collection_count, ingest_cpt_data
from ..rag.retriever import retrieve_cpt_matches
from ..schemas import BillJSON

# ChromaDB cosine distance: 0 = identical, higher = less similar. Flag if no match or best > this.
# Tighter threshold = stricter match (fewer false "reasonable" on mismatched codes).
CPT_MATCH_DISTANCE_THRESHOLD = 0.5

# Default path to CPT CSV relative to backend package.
_DEFAULT_CPT_CSV = Path(__file__).resolve().parent.parent / "data" / "cpt_codes.csv"


def _ensure_cpt_ingested(persist_directory: str = "chroma_db") -> bool:
    """If CPT collection is empty, run ingest from default CSV. Returns True if RAG is available."""
    try:
        if get_cpt_collection_count(persist_directory) == 0 and _DEFAULT_CPT_CSV.exists():
            ingest_cpt_data(_DEFAULT_CPT_CSV, persist_directory=persist_directory)
        return get_cpt_collection_count(persist_directory) > 0
    except Exception:
        return False


def run_validator(bill: BillJSON, persist_directory: str = "chroma_db") -> Tuple[BillJSON, str]:
    """
    Validate each line item against CMS/CPT data via RAG. Flag invalid or unknown codes.
    Optionally set cms_price from RAG when available. If RAG fails, passes bill through unchanged.
    """
    try:
        if not _ensure_cpt_ingested(persist_directory):
            return bill, "Validator skipped (no CPT data available)."
    except Exception:
        return bill, "Validator skipped (ingest failed)."

    flagged_count = 0
    for item in bill.line_items:
        try:
            query = f"{item.cpt_code} {item.description}".strip() or item.description or item.cpt_code
            if not query:
                item.flagged = True
                item.flag_reason = "No code or description to validate."
                flagged_count += 1
                continue

            matches = retrieve_cpt_matches(query, top_k=3, persist_directory=persist_directory)
            if not matches:
                item.flagged = True
                item.flag_reason = "CPT code or description not found in reference database."
                flagged_count += 1
                continue

            best_code, best_doc, best_cms_price, best_dist = matches[0]
            if best_dist > CPT_MATCH_DISTANCE_THRESHOLD:
                item.flagged = True
                item.flag_reason = f"Possible code mismatch; closest match: {best_code} ({best_doc})."
                flagged_count += 1
            if best_cms_price is not None and item.cms_price is None:
                item.cms_price = float(best_cms_price)
        except Exception:
            pass

    detail = f"Validated {len(bill.line_items)} line(s); {flagged_count} flagged."
    return bill, detail
