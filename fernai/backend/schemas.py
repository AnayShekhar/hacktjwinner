from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class LineItem(BaseModel):
    cpt_code: str = Field(..., description="CPT or billing code for this line item")
    description: str
    billed_price: float
    flagged: bool = False
    flag_reason: Optional[str] = None
    cms_price: Optional[float] = None
    savings: float = 0.0


class BillJSON(BaseModel):
    patient: str
    date_of_service: str
    provider: str
    line_items: List[LineItem]
    total_billed: float
    total_recoverable: float = 0.0


class AnalyzeRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="Base64-encoded image or PDF contents of the hospital bill.",
    )
    file_type: str = Field(
        ...,
        description="Either 'image' or 'pdf' to indicate the uploaded file type.",
    )


class AgentRunStatus(BaseModel):
    name: str
    status: str = Field(
        ...,
        description="One of: pending, running, completed, failed.",
    )
    detail: Optional[str] = None


class AnalyzeResponse(BaseModel):
    bill: BillJSON
    letter: str
    agents: List[AgentRunStatus]

