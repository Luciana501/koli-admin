from __future__ import annotations

import logging
import os
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .image_validator import analyze_id_image
from .model import ModelArtifacts, bootstrap_model_if_missing, predict_invalid_probability
from .schemas import (
    IDValidationRequest,
    IDValidationResponse,
    ImageAnalysisCheck,
    ImageValidationRequest,
    ImageValidationResponse,
)
from .validator import validate_id_rules

logger = logging.getLogger("kyc-id-validator")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="KYC ID Validator Service", version="1.0.0")

raw_origins = os.getenv("CORS_ORIGINS", "*")
cors_origins: List[str] = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

app.state.model_artifacts = None


@app.on_event("startup")
def startup_event() -> None:
    try:
        artifacts = bootstrap_model_if_missing()
        app.state.model_artifacts = artifacts
        logger.info("ID validation model loaded successfully.")
    except Exception as exc:
        logger.exception("Failed to initialize model: %s", exc)
        raise


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/validate-id", response_model=IDValidationResponse)
def validate_id(payload: IDValidationRequest) -> IDValidationResponse:
    try:
        model_artifacts: ModelArtifacts | None = app.state.model_artifacts
        if model_artifacts is None:
            raise HTTPException(status_code=503, detail="Model is not initialized.")

        reasons = validate_id_rules(payload.id_number, payload.id_type)

        invalid_probability = predict_invalid_probability(payload.id_number, model_artifacts)
        ml_invalid_threshold = float(os.getenv("ML_INVALID_THRESHOLD", "0.50"))

        if invalid_probability >= ml_invalid_threshold:
            reasons.append("ML classifier flagged this ID as invalid.")

        status = "Invalid" if reasons else "Valid"
        deduped_reasons = sorted(set(reasons))

        return IDValidationResponse(status=status, reasons=deduped_reasons)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Validation error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/analyze-id-image", response_model=ImageValidationResponse)
def analyze_id_image_endpoint(payload: ImageValidationRequest) -> ImageValidationResponse:
    import sys
    msg = f"\n{'='*60}\n🔥 API ENDPOINT CALLED\n{'='*60}\n"
    msg += f"image_url: {payload.image_url[:80]}...\n"
    msg += f"id_type: {payload.id_type}\n"
    msg += f"user_name: {payload.user_name}\n"
    msg += f"{'='*60}\n"
    print(msg, flush=True)
    sys.stdout.flush()
    
    logger.info(f">>> API ENDPOINT CALLED: image_url={payload.image_url[:50]}..., id_type={payload.id_type}, user_name={payload.user_name}")
    try:
        print("🔍 Calling analyze_id_image()...", flush=True)
        result = analyze_id_image(payload.image_url, payload.id_type, payload.user_name)
        print(f"✅ analyze_id_image() returned: status={result.status}, confidence={result.confidence}", flush=True)
        return ImageValidationResponse(
            status=result.status,
            category=result.category,
            message=result.message,
            reasons=result.reasons,
            checks=[
                ImageAnalysisCheck(name=check["name"], status=check["status"], detail=check["detail"])
                for check in result.checks
            ],
            confidence=result.confidence,
        )
    except Exception as exc:
        logger.exception("Image analysis error: %s", exc)
        fallback_message = "Unable to analyze the attached image. Please verify the image URL and try again."
        return ImageValidationResponse(
            status="Invalid",
            category="unknown",
            message=fallback_message,
            reasons=[fallback_message],
            checks=[
                ImageAnalysisCheck(
                    name="Image Fetch",
                    status="fail",
                    detail="Unable to fetch or decode the uploaded image URL.",
                )
            ],
            confidence=0.0,
        )
