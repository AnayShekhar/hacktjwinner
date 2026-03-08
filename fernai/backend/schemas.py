from __future__ import annotations

import base64
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB


class AdditionalPage(BaseModel):
    """One additional page (image or PDF) for multi-page bill."""
    base64: str
    file_type: Literal["image", "pdf"]


class LineItem(BaseModel):
    cpt_code: str = Field(..., description="CPT or billing code for this line item")
    description: str
    billed_price: float
    flagged: bool = False
    flag_reason: Optional[str] = None
    cms_price: Optional[float] = None
    savings: float = 0.0
    service_date: Optional[str] = None  # YYYY-MM-DD for temporal checks


class BillJSON(BaseModel):
    patient: str
    date_of_service: str
    provider: str
    line_items: List[LineItem]
    total_billed: float
    total_recoverable: float = 0.0
    discharge_date: Optional[str] = None  # for temporal fraud check
    diagnosis_codes: Optional[List[str]] = None  # ICD-10 for coherence check


class AnalyzeRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="Base64-encoded image or PDF contents of the hospital bill.",
    )
    file_type: Literal["image", "pdf"] = Field(
        ...,
        description="Either 'image' or 'pdf' to indicate the uploaded file type.",
    )
    additional_images_base64: Optional[List[str]] = Field(
        default=None,
        description="Optional list of base64-encoded images (additional pages). Deprecated: prefer additional_pages.",
    )
    additional_pages: Optional[List[AdditionalPage]] = Field(
        default=None,
        description="Optional list of additional pages (image or PDF) for the same bill.",
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
    letter: Optional[str] = None  # Only set when total_recoverable > 0 (dispute letter)
    agents: List[AgentRunStatus]
    analysis_time_seconds: Optional[float] = None
    suspicion_score: Optional[int] = None  # 0-100
    similar_bills_count: Optional[int] = None  # bill similarity search
    clean_bill_explanation: Optional[str] = None  # when total_recoverable is 0, why we found no issues
    diagnosis_coherence_message: Optional[str] = None
    temporal_check_message: Optional[str] = None
    insight_bill_similarity: Optional[str] = None  # LLM-generated
    insight_diagnosis_coherence: Optional[str] = None  # LLM-generated
    insight_suspicion_score: Optional[str] = None  # LLM-generated
    insight_temporal: Optional[str] = None  # LLM-generated

