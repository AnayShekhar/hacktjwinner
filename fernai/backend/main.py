from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .agents import letter_gen, parser, price_auditor, validator
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
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Run the full agent pipeline:
      Parser -> CPT Validator -> Price Auditor -> Letter Gen
    """
    agents_status = [
        AgentRunStatus(name="Parser", status="running"),
        AgentRunStatus(name="CPT Validator", status="pending"),
        AgentRunStatus(name="Price Auditor", status="pending"),
        AgentRunStatus(name="Letter Gen", status="pending"),
    ]

    # Parser
    bill, parser_detail = parser.run_parser(request)
    agents_status[0].status = "completed"
    agents_status[0].detail = parser_detail

    # Validator
    agents_status[1].status = "running"
    bill, validator_detail = validator.run_validator(bill)
    agents_status[1].status = "completed"
    agents_status[1].detail = validator_detail

    # Price auditor
    agents_status[2].status = "running"
    bill, auditor_detail = price_auditor.run_price_auditor(bill)
    agents_status[2].status = "completed"
    agents_status[2].detail = auditor_detail

    # Letter generation
    agents_status[3].status = "running"
    letter = letter_gen.generate_letter(bill)
    agents_status[3].status = "completed"

    response = AnalyzeResponse(
        bill=BillJSON.model_validate(bill.model_dump()),
        letter=letter,
        agents=agents_status,
    )
    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("fernai.backend.main:app", host="0.0.0.0", port=8000, reload=True)

