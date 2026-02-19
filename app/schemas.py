from typing import List, Literal

from pydantic import BaseModel, Field


SupportedIDType = Literal[
    "Philippine Passport",
    "Driver's License",
    "SSS ID",
    "GSIS ID",
    "UMID",
    "PhilHealth ID",
    "TIN ID",
    "Postal ID",
    "Voter's ID",
    "PRC ID",
    "Senior Citizen ID",
    "PWD ID",
    "National ID",
    "Others",
]


class IDValidationRequest(BaseModel):
    id_number: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Raw ID number to validate.",
    )
    id_type: SupportedIDType = Field(
        default="Others",
        description="Selected identification type for type-aware validation.",
    )


class IDValidationResponse(BaseModel):
    status: Literal["Valid", "Invalid"]
    reasons: List[str]


class ImageValidationRequest(BaseModel):
    image_url: str = Field(
        ...,
        min_length=3,
        max_length=2048,
        description="Publicly accessible URL of the uploaded KYC image.",
    )
    id_type: SupportedIDType = Field(
        default="Others",
        description="Selected identification type for type-aware image analysis.",
    )
    user_name: str | None = Field(
        default=None,
        max_length=256,
        description="Full name of the user for name matching verification.",
    )


class ImageAnalysisCheck(BaseModel):
    name: str
    status: Literal["pass", "warn", "fail"]
    detail: str


class ImageValidationResponse(BaseModel):
    status: Literal["Valid", "Invalid"]
    category: Literal["identification_card", "selfie", "unknown"]
    message: str
    reasons: List[str]
    checks: List[ImageAnalysisCheck] = Field(default_factory=list)
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model confidence score from 0 to 1 for image-category decision.",
    )
