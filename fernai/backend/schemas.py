from __future__ import annotations

import base64
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB


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
    file_type: Literal["image", "pdf"] = Field(
        ...,
        description="Either 'image' or 'pdf' to indicate the uploaded file type.",
    )

    @model_validator(mode="after")
    def check_image_size(self) -> "AnalyzeRequest":
        try:
            raw = base64.b64decode(self.image_base64, validate=True)
            if len(raw) > MAX_IMAGE_SIZE_BYTES:
                raise ValueError(
                    f"File size ({len(raw) / (1024*1024):.1f} MB) exceeds maximum {MAX_IMAGE_SIZE_BYTES / (1024*1024):.0f} MB."
                )
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            raise ValueError("Invalid base64 image data.") from e
        return self


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

