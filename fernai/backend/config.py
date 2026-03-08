from __future__ import annotations

import os
from pathlib import Path

# ChromaDB persist directory: prefer env, else under backend package.
_BACKEND_DIR = Path(__file__).resolve().parent
CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", str(_BACKEND_DIR / "chroma_db"))
