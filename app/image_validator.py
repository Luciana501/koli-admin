from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, TypedDict
from urllib.request import Request, urlopen
import re

import numpy as np

try:
    import cv2
except Exception:
    cv2 = None

try:
    import pytesseract
except Exception:
    pytesseract = None

try:
    import Levenshtein
except Exception:
    Levenshtein = None


@dataclass
class ImageAnalysisResult:
    status: Literal["Valid", "Invalid"]
    category: Literal["identification_card", "selfie", "unknown"]
    message: str
    reasons: List[str]
    checks: List["ImageCheck"]
    confidence: float


class ImageCheck(TypedDict):
    name: str
    status: Literal["pass", "warn", "fail"]
    detail: str


# ─── ID Type Config ────────────────────────────────────────────────────────────
# Maps normalized ID type → expected digit count (digits only, no dashes)
ID_DIGIT_REQUIREMENTS: dict[str, int] = {
    "National ID": 16,        # PhilSys: XXXX-XXXX-XXXX-XXXX = 16 digits
    "SSS":         10,        # SS-XXXXXXXX-X = 10 digits
    "UMID":        12,        # CRN: XXXX-XXXXXXX-X = 12 digits
    "GSIS":        11,        # BPN: 11 digits
    "PRC ID":      7,
    "Driver's License": 11,   # A01-00-123456 = 11 digits
    "Passport":    9,         # alphanumeric, skip digit check
    "PhilHealth":  12,        # PIN: XX-XXXXXXXXX-X = 12 digits
    "Voter's ID":  9,
    "TIN ID":      9,         # XXX-XXX-XXX = 9 digits
}


def _normalize_id_type(id_type: str | None) -> str:
    if not id_type:
        return "Others"
    normalized = id_type.strip()
    aliases = {
        "UMID (Unified Multi-Purpose ID)": "UMID",
        "PRC ID (Professional License)": "PRC ID",
        "National ID (PhilSys)": "National ID",
        "Driver's License": "Driver's License",
        "Drivers License": "Driver's License",
    }
    return aliases.get(normalized, normalized)


def _validate_id_number_format(id_number: str | None, id_type: str) -> tuple[bool, str]:
    """
    Validate the format/digit count of an ID number based on ID type.
    Returns (is_valid, detail_message).
    """
    if not id_number:
        return (True, "No ID number provided for format check.")

    # Strip all non-digit characters for counting
    digits_only = re.sub(r'\D', '', id_number)
    expected = ID_DIGIT_REQUIREMENTS.get(id_type)

    if expected is None:
        return (True, f"No digit requirement defined for {id_type}.")

    if len(digits_only) == expected:
        return (True, f"{id_type} number has correct {expected}-digit format.")
    else:
        return (
            False,
            f"{id_type} number must have exactly {expected} digits "
            f"(found {len(digits_only)} digits in '{id_number}')."
        )


def _download_image(image_url: str) -> np.ndarray:
    if cv2 is None:
        raise RuntimeError("OpenCV is not available.")
    request = Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=10) as response:
        raw_bytes = response.read()
    byte_array = np.asarray(bytearray(raw_bytes), dtype=np.uint8)
    image = cv2.imdecode(byte_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image from URL.")
    return image


def _detect_document_like_shape(gray_image: np.ndarray) -> bool:
    if cv2 is None:
        return False
    height, width = gray_image.shape[:2]
    image_area = float(height * width)
    blurred = cv2.GaussianBlur(gray_image, (5, 5), 0)

    for thresh1, thresh2, eps_factor in [(40, 130, 0.02), (30, 100, 0.03)]:
        edges = cv2.Canny(blurred, threshold1=thresh1, threshold2=thresh2)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            perimeter = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, eps_factor * perimeter, True)
            if len(approx) == 4:
                area = cv2.contourArea(contour)
                if area > 0 and 0.15 <= area / image_area <= 0.95:
                    return True
    return False


def _estimate_text_density(gray_image: np.ndarray) -> float:
    if cv2 is None:
        return 0.0
    blackhat = cv2.morphologyEx(
        gray_image,
        cv2.MORPH_BLACKHAT,
        cv2.getStructuringElement(cv2.MORPH_RECT, (17, 5)),
    )
    _, threshold = cv2.threshold(blackhat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    total_pixels = float(gray_image.shape[0] * gray_image.shape[1])
    return float(np.count_nonzero(threshold)) / total_pixels if total_pixels > 0 else 0.0


def _compute_quality_metrics(gray_image: np.ndarray) -> dict[str, float]:
    if cv2 is None:
        return {"brightness": 0.0, "contrast": 0.0, "sharpness": 0.0, "edge_density": 0.0}
    brightness = float(np.mean(gray_image))
    contrast = float(np.std(gray_image))
    sharpness = float(cv2.Laplacian(gray_image, cv2.CV_64F).var())
    edges = cv2.Canny(gray_image, 40, 130)
    edge_density = float(np.count_nonzero(edges)) / float(gray_image.size)
    return {"brightness": brightness, "contrast": contrast, "sharpness": sharpness, "edge_density": edge_density}


def _extract_text_from_image(image: np.ndarray) -> str:
    """
    Improved OCR pipeline optimised for Philippine government IDs.
    Handles both horizontal and vertical ID orientations.

    Philippine IDs (especially National ID / PhilSys) have:
    - Holographic / colourful gradient backgrounds  → adaptive threshold destroys text
    - High-contrast dark text on light areas        → OTSU works better
    - Sometimes small text near edges               → upscaling helps a lot

    Strategy: run multiple preprocessing passes and concatenate unique results.
    """
    if pytesseract is None or cv2 is None:
        return ""

    def _ocr_attempt(img: np.ndarray) -> str:
        """Single OCR attempt with multiple preprocessing passes."""
        if cv2 is None or pytesseract is None:
            return ""
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()

            # ── Pass 1: upscale + OTSU threshold (best for printed dark text on light bg) ──
            scale = max(1, 2000 // gray.shape[1])
            upscaled = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            denoised = cv2.fastNlMeansDenoising(upscaled, h=10)
            _, otsu = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            text1 = pytesseract.image_to_string(otsu, config='--psm 6 --oem 3')

            # ── Pass 2: upscale + sharpening (catches slightly blurry text) ──
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            sharpened = cv2.filter2D(denoised, -1, kernel)
            _, otsu2 = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            text2 = pytesseract.image_to_string(otsu2, config='--psm 11 --oem 3')

            # ── Pass 3: CLAHE contrast enhancement (helps on holographic backgrounds) ──
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(upscaled)
            _, otsu3 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            text3 = pytesseract.image_to_string(otsu3, config='--psm 6 --oem 3')

            combined = "\n".join(filter(None, [text1, text2, text3]))
            return combined.strip()
        except Exception:
            return ""

    def _text_quality_score(text: str) -> float:
        """Score OCR quality: higher is better. Detects garbage output."""
        if not text or len(text) < 10:
            return 0.0
        # Count alphabetic characters vs total length
        alpha_count = sum(c.isalpha() for c in text)
        if len(text) == 0:
            return 0.0
        alpha_ratio = alpha_count / len(text)
        # Count words (tokens)
        words = [w for w in text.split() if len(w) >= 3]
        word_count = len(words)
        # Penalize short words and low alpha ratio (indicates garbage)
        return alpha_ratio * word_count

    try:
        # Try original orientation first
        text_original = _ocr_attempt(image)
        score_original = _text_quality_score(text_original)
        
        print(f"🔄 OCR attempt (0°): score={score_original:.1f}, text_len={len(text_original)}", flush=True)

        # If original OCR produced poor results, try rotating (handles vertical IDs)
        if score_original < 5.0:  # Low quality threshold
            best_text = text_original
            best_score = score_original

            for angle in [90, 270, 180]:
                if angle == 90:
                    rotated = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
                elif angle == 270:
                    rotated = cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
                else:  # 180
                    rotated = cv2.rotate(image, cv2.ROTATE_180)

                text_rotated = _ocr_attempt(rotated)
                score_rotated = _text_quality_score(text_rotated)
                print(f"🔄 OCR attempt ({angle}°): score={score_rotated:.1f}, text_len={len(text_rotated)}", flush=True)

                if score_rotated > best_score:
                    best_score = score_rotated
                    best_text = text_rotated
                    print(f"✅ Better OCR found at {angle}° rotation!", flush=True)

            return best_text

        return text_original

    except Exception:
        return ""


def _normalize_name(name: str) -> str:
    normalized = re.sub(r'[^a-zA-Z\s]', '', name)
    return normalized.lower().strip()


def _match_name(ocr_text: str, user_name: str) -> tuple[bool, float, str]:
    """
    Order-independent name matching using token matching + Levenshtein fuzzy match.
    Handles Filipino names where OCR order may differ from user input.
    """
    import logging
    logger = logging.getLogger("kyc-id-validator")

    if not user_name:
        return (True, 0.5, "Name verification skipped (no name provided).")

    if not ocr_text or len(ocr_text.strip()) < 5:
        return (True, 0.2, "Name verification unavailable (OCR extraction failed — manual review required).")

    if Levenshtein is None:
        return (True, 0.5, "Name matching library not available (manual verification required).")

    user_normalized = _normalize_name(user_name)
    user_tokens = user_normalized.split()

    if not user_tokens:
        return (True, 0.5, "User name format issue (manual verification required).")

    ocr_normalized = _normalize_name(ocr_text)
    ocr_tokens = set(ocr_normalized.split())

    import sys
    debug_msg = f"\n{'='*60}\n"
    debug_msg += f"🔍 NAME MATCHING DEBUG\n"
    debug_msg += f"{'='*60}\n"
    debug_msg += f"User name: '{user_name}'\n"
    debug_msg += f"User tokens: {user_tokens}\n"
    debug_msg += f"OCR extracted text:\n{ocr_text[:500]}\n"
    debug_msg += f"OCR tokens (first 30): {list(ocr_tokens)[:30]}\n"
    debug_msg += f"{'='*60}\n\n"
    
    print(debug_msg, flush=True)
    sys.stdout.flush()
    
    try:
        with open("C:/temp/name_match_debug.txt", "w", encoding="utf-8") as f:
            f.write(debug_msg)
            f.write(f"Full OCR text:\n{ocr_text}\n\n")
            f.write(f"All OCR tokens: {sorted(list(ocr_tokens))}\n")
    except Exception:
        pass
    
    logger.info(f"Name matching: user='{user_name}', user_tokens={user_tokens}")
    logger.info(f"OCR tokens (sample): {list(ocr_tokens)[:30]}")

    matched_tokens = []
    unmatched_tokens = []

    for token in user_tokens:
        token_matched = False
        if token in ocr_tokens:
            matched_tokens.append((token, "exact"))
            token_matched = True
        elif len(token) == 1:
            if any(t.startswith(token) for t in ocr_tokens):
                matched_tokens.append((token, "initial"))
                token_matched = True
        elif len(token) >= 3:
            # Exact prefix match
            if any(t.startswith(token) for t in ocr_tokens):
                matched_tokens.append((token, "prefix"))
                token_matched = True
            else:
                # Fuzzy per-token: allow 1 char difference for OCR misread
                best = max((Levenshtein.ratio(token, t) for t in ocr_tokens), default=0.0)
                if best >= 0.82:
                    matched_tokens.append((token, f"fuzzy({best:.0%})"))
                    token_matched = True

        if not token_matched:
            unmatched_tokens.append(token)

    match_ratio = len(matched_tokens) / len(user_tokens) if user_tokens else 0.0

    # Full-name fuzzy across every OCR line
    max_similarity = 0.0
    for line in ocr_text.split('\n'):
        line_norm = _normalize_name(line)
        if len(line_norm) >= len(user_normalized) * 0.4:
            sim = Levenshtein.ratio(user_normalized, line_norm)
            max_similarity = max(max_similarity, sim)

    logger.info(f"match_ratio={match_ratio:.0%}, max_similarity={max_similarity:.0%}, unmatched={unmatched_tokens}")

    result_msg = f"📊 MATCHING RESULTS:\n"
    result_msg += f"   Matched tokens: {matched_tokens}\n"
    result_msg += f"   Unmatched tokens: {unmatched_tokens}\n"
    result_msg += f"   Match ratio: {match_ratio:.0%}\n"
    result_msg += f"   Max similarity: {max_similarity:.0%}\n"
    print(result_msg, flush=True)
    
    try:
        with open("C:/temp/name_match_debug.txt", "a", encoding="utf-8") as f:
            f.write(f"\n{result_msg}\n")
    except Exception:
        pass

    # ── Decision: 60% token match OR 65% full-name similarity ──
    # (Lowered from 70%/65% to accommodate OCR noise on Philippine IDs)
    if match_ratio >= 0.60 or max_similarity >= 0.65:
        confidence = max(match_ratio, max_similarity)
        decision_msg = f"✅ DECISION: VALID (confidence: {confidence:.0%})\n"
        print(decision_msg, flush=True)
        try:
            with open("C:/temp/name_match_debug.txt", "a", encoding="utf-8") as f:
                f.write(decision_msg)
        except Exception:
            pass
        return (True, confidence, f"Name match found (confidence: {confidence:.0%}).")
    else:
        confidence = max(match_ratio, max_similarity)
        decision_msg = f"❌ DECISION: INVALID (confidence: {confidence:.0%})\n"
        print(decision_msg, flush=True)
        try:
            with open("C:/temp/name_match_debug.txt", "a", encoding="utf-8") as f:
                f.write(decision_msg)
        except Exception:
            pass
        return (False, confidence, "Name mismatch detected (ID may not belong to applicant).")


def analyze_id_image(
    image_url: str,
    id_type: str | None = None,
    user_name: str | None = None,
    id_number: str | None = None,       # ← NEW optional param
) -> ImageAnalysisResult:
    import logging
    logger = logging.getLogger("kyc-id-validator")
    logger.info(f"analyze_id_image: user_name='{user_name}', id_type='{id_type}', id_number='{id_number}'")

    normalized_id_type = _normalize_id_type(id_type)

    if cv2 is None:
        msg = "Image analysis dependency is not available on the server."
        return ImageAnalysisResult(status="Invalid", category="unknown", message=msg, reasons=[msg], checks=[], confidence=0.0)

    image = _download_image(image_url)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    quality = _compute_quality_metrics(gray)
    text_density = _estimate_text_density(gray)

    ocr_text = _extract_text_from_image(image) if user_name else ""
    name_match_result = _match_name(ocr_text, user_name) if user_name else None

    # ── ID Number format validation ──
    id_format_valid, id_format_detail = _validate_id_number_format(id_number, normalized_id_type)

    haar_data = getattr(cv2, "data", None)
    haar_base_path = getattr(haar_data, "haarcascades", "")
    face_cascade = cv2.CascadeClassifier(haar_base_path + "haarcascade_frontalface_default.xml")
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(64, 64))

    image_area = float(gray.shape[0] * gray.shape[1])
    largest_face_ratio = max((w * h / image_area for (_, _, w, h) in faces), default=0.0)
    has_card_portrait = 0.03 <= largest_face_ratio <= 0.45
    has_document_shape = _detect_document_like_shape(gray)

    severe_blur = quality["sharpness"] < 35
    soft_blur = quality["sharpness"] < 55
    poor_lighting = quality["brightness"] < 45 or quality["brightness"] > 230
    low_text_presence = text_density < 0.008

    selfie_signal = (
        largest_face_ratio >= 0.08
        and not has_document_shape
        and text_density < 0.015
    )
    screenshot_like_signal = (
        not has_document_shape
        and not has_card_portrait
        and text_density >= 0.025
        and quality["edge_density"] < 0.035
        and quality["sharpness"] >= 45
    )

    document_score = 0.0
    if has_document_shape:       document_score += 0.25
    if text_density >= 0.012:    document_score += 0.30
    elif text_density >= 0.008:  document_score += 0.15
    if quality["sharpness"] >= 60:  document_score += 0.20
    elif quality["sharpness"] >= 40: document_score += 0.10
    if quality["contrast"] >= 25:   document_score += 0.10
    if quality["edge_density"] >= 0.03: document_score += 0.10
    if has_card_portrait:        document_score += 0.15
    if selfie_signal:            document_score -= 0.10
    if screenshot_like_signal:   document_score -= 0.25
    if severe_blur:              document_score -= 0.20
    elif soft_blur:              document_score -= 0.08
    if poor_lighting:            document_score -= 0.08
    document_score = max(0.0, min(1.0, document_score))

    reasons: List[str] = []
    checks: List[ImageCheck] = []
    id_type_phrase = normalized_id_type or "ID"

    # ── Build checks list ──
    checks.append({"name": "Card Boundary", "status": "pass" if has_document_shape else "warn",
                   "detail": "Clear ID card edges detected." if has_document_shape else "No clear full-card boundary detected."})
    checks.append({"name": "Printed Details",
                   "status": "pass" if text_density >= 0.012 else ("warn" if text_density >= 0.008 else "fail"),
                   "detail": "Readable printed details detected." if text_density >= 0.012 else
                              ("Some printed details detected, clarity limited." if text_density >= 0.008 else "Very low readable text detected.")})
    checks.append({"name": "Sharpness",
                   "status": "fail" if severe_blur else ("warn" if soft_blur else "pass"),
                   "detail": "Image is too blurry." if severe_blur else ("Image is slightly blurry." if soft_blur else "Image sharpness is acceptable.")})
    checks.append({"name": "Lighting",
                   "status": "warn" if poor_lighting else "pass",
                   "detail": "Lighting may affect verification accuracy." if poor_lighting else "Lighting is acceptable."})
    checks.append({"name": "Selfie Signal",
                   "status": "fail" if selfie_signal else "pass",
                   "detail": "Dominant face without card features (selfie-like)." if selfie_signal else "No selfie-only signal detected."})
    checks.append({"name": "Card Portrait",
                   "status": "pass" if has_card_portrait else "warn",
                   "detail": "Portrait area consistent with ID layout." if has_card_portrait else "No clear card-portrait region detected."})
    checks.append({"name": "Screenshot Signal",
                   "status": "fail" if screenshot_like_signal else "pass",
                   "detail": "Image appears to be a screenshot or non-ID content." if screenshot_like_signal else "No screenshot/non-ID signal detected."})

    # ── ID Number format check ──
    if id_number:
        checks.append({
            "name": "ID Number Format",
            "status": "pass" if id_format_valid else "fail",
            "detail": id_format_detail,
        })

    # ── Name match check ──
    if name_match_result is not None:
        is_match, similarity, detail = name_match_result
        checks.append({"name": "Name Match", "status": "pass" if is_match else "fail", "detail": detail})

    # ── Early exits (priority order) ──

    if selfie_signal:
        reasons = [f"The image attached is a selfie and not a valid {id_type_phrase} image.",
                   "Detected a dominant face region without a clear card boundary."]
        return ImageAnalysisResult(status="Invalid", category="selfie", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=min(0.99, 0.65 + largest_face_ratio))

    # ID number format failure — flag immediately
    if id_number and not id_format_valid:
        reasons = [id_format_detail,
                   f"Please verify the {id_type_phrase} number is entered correctly."]
        return ImageAnalysisResult(status="Invalid", category="unknown", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=0.95)

    # Name mismatch — only if OCR succeeded (similarity > 0.2 means we got usable text)
    if name_match_result is not None:
        is_match, similarity, detail = name_match_result
        if not is_match and similarity > 0.2:
            reasons = [f"The name on the {id_type_phrase} does not match the applicant's name.",
                       "The submitted ID may belong to a different person."]
            return ImageAnalysisResult(status="Invalid", category="unknown", message=reasons[0], reasons=reasons,
                                       checks=checks, confidence=min(0.96, max(0.75, 0.85 + similarity * 0.1)))

    if severe_blur:
        reasons = [f"Image is too blurry to reliably verify the submitted {id_type_phrase}.",
                   "Retake the photo with better focus and avoid motion blur."]
        return ImageAnalysisResult(status="Invalid", category="unknown", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=min(0.95, max(0.45, 1 - quality["sharpness"] / 110)))

    if screenshot_like_signal:
        reasons = [f"The uploaded image appears to be a screenshot or non-{id_type_phrase} content.",
                   "Please upload a clear photo of the physical ID card, not a screen capture or chat image."]
        return ImageAnalysisResult(status="Invalid", category="unknown", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=min(0.96, max(0.60, 0.78 + text_density)))

    if low_text_presence and not has_document_shape:
        reasons = [f"The image lacks readable printed details expected on a {id_type_phrase}.",
                   "Capture a full card image with clearer text and visible card features."]
        return ImageAnalysisResult(status="Invalid", category="unknown", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=min(0.92, max(0.48, 0.75 - document_score)))

    # ── Valid path ──
    if has_document_shape and document_score >= 0.45:
        reasons = [f"Image features are consistent with a valid {id_type_phrase} card capture.",
                   "Card boundary and printed details were detected successfully."]
        return ImageAnalysisResult(status="Valid", category="identification_card", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=min(0.98, max(0.55, document_score)))

    if has_card_portrait and text_density >= 0.020 and document_score >= 0.55:
        reasons = [f"Image features are consistent with a valid {id_type_phrase} card capture.",
                   "Card boundary is partially visible; text and security details are sufficient."]
        return ImageAnalysisResult(status="Valid", category="identification_card", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=min(0.95, max(0.55, document_score)))

    if text_density >= 0.012 and quality["edge_density"] >= 0.035 and not selfie_signal and document_score >= 0.40:
        reasons = [f"Image features are consistent with a valid {id_type_phrase} card capture.",
                   "Printed details and card features detected (landscape orientation)."]
        return ImageAnalysisResult(status="Valid", category="identification_card", message=reasons[0], reasons=reasons,
                                   checks=checks, confidence=min(0.92, max(0.55, document_score)))

    reasons = [f"The submitted {id_type_phrase} image failed document-quality checks.",
               "Please submit a clearer full-card photo with readable details."]
    return ImageAnalysisResult(status="Invalid", category="unknown", message=reasons[0], reasons=reasons,
                               checks=checks, confidence=min(0.92, max(0.45, 0.70 - document_score)))