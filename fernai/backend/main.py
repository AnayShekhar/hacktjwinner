from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend dir and project root (before other imports that use env)
_backend_dir = Path(__file__).resolve().parent
_env_file = _backend_dir / ".env"
if not _env_file.exists() and (_backend_dir / ".env.example").exists():
    _env_file.write_text((_backend_dir / ".env.example").read_text())
load_dotenv(_env_file)
load_dotenv(_backend_dir.parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .agents import letter_gen, parser, price_auditor, validator
from .config import CHROMA_PERSIST_DIR
from .schemas import AnalyzeRequest, AnalyzeResponse, AgentRunStatus, BillJSON


app = FastAPI(title="Fern AI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """
    Run the full agent pipeline:
      Parser -> CPT Validator -> Price Auditor -> Letter Gen
    On any agent failure, returns 500 with detail and agents status so the client can show which step failed.
    """
    agents_status = [
        AgentRunStatus(name="Parser", status="pending"),
        AgentRunStatus(name="CPT Validator", status="pending"),
        AgentRunStatus(name="Price Auditor", status="pending"),
        AgentRunStatus(name="Letter Gen", status="pending"),
    ]

    try:
        agents_status[0].status = "running"
        bill, parser_detail = parser.run_parser(request)
        agents_status[0].status = "completed"
        agents_status[0].detail = parser_detail
    except Exception as e:  # noqa: BLE001
        agents_status[0].status = "failed"
        agents_status[0].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "Parser"}, "agents": [a.model_dump() for a in agents_status]},
        )

    try:
        agents_status[1].status = "running"
        bill, validator_detail = validator.run_validator(bill, persist_directory=CHROMA_PERSIST_DIR)
        agents_status[1].status = "completed"
        agents_status[1].detail = validator_detail
    except Exception as e:  # noqa: BLE001
        agents_status[1].status = "failed"
        agents_status[1].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "CPT Validator"}, "agents": [a.model_dump() for a in agents_status]},
        )

    try:
        agents_status[2].status = "running"
        bill, auditor_detail = price_auditor.run_price_auditor(bill, persist_directory=CHROMA_PERSIST_DIR)
        agents_status[2].status = "completed"
        agents_status[2].detail = auditor_detail
    except Exception as e:  # noqa: BLE001
        agents_status[2].status = "failed"
        agents_status[2].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "Price Auditor"}, "agents": [a.model_dump() for a in agents_status]},
        )

    try:
        agents_status[3].status = "running"
        letter = letter_gen.generate_letter(bill)
        agents_status[3].status = "completed"
    except Exception as e:  # noqa: BLE001
        agents_status[3].status = "failed"
        agents_status[3].detail = str(e)
        return JSONResponse(
            status_code=500,
            content={"detail": {"message": str(e), "agent": "Letter Gen"}, "agents": [a.model_dump() for a in agents_status]},
        )

    return AnalyzeResponse(
        bill=BillJSON.model_validate(bill.model_dump()),
        letter=letter,
        agents=agents_status,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("fernai.backend.main:app", host="0.0.0.0", port=8000, reload=True)

