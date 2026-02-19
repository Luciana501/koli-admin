import re
from typing import List

ALLOWED_CHAR_PATTERN = re.compile(r"^[A-Za-z0-9\-\s]+$")
MULTI_REPEAT_PATTERN = re.compile(r"(.)\1{4,}")

SUPPORTED_ID_TYPES = {
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
}


def normalize_id(id_number: str) -> str:
    return re.sub(r"[\s\-]", "", id_number or "").upper()


def _normalize_id_type(id_type: str | None) -> str:
    if not id_type:
        return "Others"

    normalized = id_type.strip()
    if normalized in SUPPORTED_ID_TYPES:
        return normalized

    aliases = {
        "UMID (Unified Multi-Purpose ID)": "UMID",
        "PRC ID (Professional License)": "PRC ID",
        "National ID (PhilSys)": "National ID",
    }
    return aliases.get(normalized, "Others")


def _validate_by_id_type(normalized_id: str, id_type: str) -> List[str]:
    reasons: List[str] = []

    rules = {
        "Philippine Passport": (r"^[A-Z0-9]{8,9}$", "Passport number must be 8-9 alphanumeric characters."),
        "Driver's License": (r"^[A-Z0-9]{9,20}$", "Driver's License number must be 9-20 alphanumeric characters."),
        "SSS ID": (r"^\d{10}$", "SSS ID number must be exactly 10 digits."),
        "GSIS ID": (r"^\d{8,13}$", "GSIS ID number must be 8-13 digits."),
        "UMID": (r"^\d{10,13}$", "UMID number must be 10-13 digits."),
        "PhilHealth ID": (r"^\d{12}$", "PhilHealth ID number must be exactly 12 digits."),
        "TIN ID": (r"^(\d{9}|\d{12})$", "TIN ID number must be 9 or 12 digits."),
        "Postal ID": (r"^[A-Z0-9]{6,20}$", "Postal ID number must be 6-20 alphanumeric characters."),
        "Voter's ID": (r"^[A-Z0-9]{6,20}$", "Voter's ID number must be 6-20 alphanumeric characters."),
        "PRC ID": (r"^[A-Z0-9]{6,20}$", "PRC ID number must be 6-20 alphanumeric characters."),
        "Senior Citizen ID": (r"^[A-Z0-9]{6,20}$", "Senior Citizen ID number must be 6-20 alphanumeric characters."),
        "PWD ID": (r"^[A-Z0-9]{6,20}$", "PWD ID number must be 6-20 alphanumeric characters."),
        "National ID": (r"^\d{16}$", "National ID number must be exactly 16 digits."),
        "Others": (r"^[A-Z0-9]{6,20}$", "ID number must be 6-20 alphanumeric characters."),
    }

    pattern, rule_message = rules[id_type]
    if not re.fullmatch(pattern, normalized_id):
        reasons.append(rule_message)

    return reasons


def validate_id_rules(id_number: str, id_type: str | None = None) -> List[str]:
    reasons: List[str] = []

    raw_value = id_number or ""
    normalized = normalize_id(raw_value)
    normalized_id_type = _normalize_id_type(id_type)

    if not raw_value.strip():
        reasons.append("ID number is required.")
        return reasons

    if not ALLOWED_CHAR_PATTERN.match(raw_value):
        reasons.append("ID contains unsupported characters.")

    if normalized_id_type == "Others":
        if not (6 <= len(normalized) <= 20):
            reasons.append("ID length must be between 6 and 20 characters.")

    if normalized and not normalized.isalnum():
        reasons.append("ID must be alphanumeric after normalization.")

    if normalized and sum(ch.isdigit() for ch in normalized) < 2:
        reasons.append("ID must contain at least one digit.")

    if normalized and MULTI_REPEAT_PATTERN.search(normalized):
        reasons.append("ID contains excessive repeated characters.")

    if normalized:
        reasons.extend(_validate_by_id_type(normalized, normalized_id_type))

    return reasons
