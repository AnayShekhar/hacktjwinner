#!/usr/bin/env python3
"""
Run the Fern AI backend. Use from repo root or from fernai/:

  cd fernai && python3 run_backend.py
  # or from repo root:
  python3 fernai/run_backend.py
"""
import sys
from pathlib import Path

# Add repo root so "fernai" package is found
_repo_root = Path(__file__).resolve().parent.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "fernai.backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
