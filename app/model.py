from __future__ import annotations

import math
import random
import string
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from .validator import normalize_id, validate_id_rules

MODEL_PATH = Path("app/id_validator_model.joblib")


@dataclass
class ModelArtifacts:
    model: XGBClassifier
    feature_columns: List[str]


def _shannon_entropy(value: str) -> float:
    if not value:
        return 0.0
    counts = {ch: value.count(ch) for ch in set(value)}
    length = len(value)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def _max_consecutive_run(value: str) -> int:
    if not value:
        return 0
    max_run = 1
    current = 1
    for idx in range(1, len(value)):
        if value[idx] == value[idx - 1]:
            current += 1
            max_run = max(max_run, current)
        else:
            current = 1
    return max_run


def extract_features(id_number: str) -> Dict[str, float]:
    normalized = normalize_id(id_number)

    if not normalized:
        return {
            "length": 0.0,
            "digit_count": 0.0,
            "alpha_count": 0.0,
            "digit_ratio": 0.0,
            "alpha_ratio": 0.0,
            "unique_ratio": 0.0,
            "entropy": 0.0,
            "max_consecutive_run": 0.0,
            "prefix_is_alpha": 0.0,
            "suffix_is_digit": 0.0,
            "has_repeat_penalty": 0.0,
            "ascii_sum_mod_10": 0.0,
            "ascii_sum_mod_36": 0.0,
        }

    length = len(normalized)
    digit_count = sum(char.isdigit() for char in normalized)
    alpha_count = sum(char.isalpha() for char in normalized)
    unique_count = len(set(normalized))
    ascii_sum = sum(ord(char) for char in normalized)
    max_run = _max_consecutive_run(normalized)

    return {
        "length": float(length),
        "digit_count": float(digit_count),
        "alpha_count": float(alpha_count),
        "digit_ratio": float(digit_count / length),
        "alpha_ratio": float(alpha_count / length),
        "unique_ratio": float(unique_count / length),
        "entropy": float(_shannon_entropy(normalized)),
        "max_consecutive_run": float(max_run),
        "prefix_is_alpha": float(normalized[0].isalpha()),
        "suffix_is_digit": float(normalized[-1].isdigit()),
        "has_repeat_penalty": float(max_run >= 5),
        "ascii_sum_mod_10": float(ascii_sum % 10),
        "ascii_sum_mod_36": float(ascii_sum % 36),
    }


def build_feature_frame(id_numbers: Iterable[str]) -> pd.DataFrame:
    rows = [extract_features(id_number) for id_number in id_numbers]
    return pd.DataFrame(rows)


def train_model(training_df: pd.DataFrame, model_path: Path = MODEL_PATH) -> Dict[str, float]:
    required_columns = {"id_number", "label"}
    if not required_columns.issubset(set(training_df.columns)):
        raise ValueError("Training DataFrame must contain 'id_number' and 'label' columns.")

    dataset = training_df.copy()
    dataset["label"] = dataset["label"].astype(int)

    feature_frame = build_feature_frame(dataset["id_number"].tolist())
    labels = dataset["label"].to_numpy(dtype=np.int32)

    x_train, x_test, y_train, y_test = train_test_split(
        feature_frame,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    classifier = XGBClassifier(
        n_estimators=250,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=1,
    )
    classifier.fit(x_train, y_train)

    test_accuracy = float((classifier.predict(x_test) == y_test).mean())

    artifacts: Dict[str, object] = {
        "model": classifier,
        "feature_columns": list(feature_frame.columns),
    }
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifacts, model_path)

    return {"test_accuracy": test_accuracy, "samples": float(len(dataset))}


def load_model(model_path: Path = MODEL_PATH) -> ModelArtifacts:
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at {model_path}")

    artifacts = joblib.load(model_path)
    model = artifacts.get("model")
    feature_columns = artifacts.get("feature_columns")

    if model is None or feature_columns is None:
        raise ValueError("Saved model artifact is invalid.")

    return ModelArtifacts(model=model, feature_columns=list(feature_columns))


def predict_invalid_probability(id_number: str, artifacts: ModelArtifacts) -> float:
    feature_frame = build_feature_frame([id_number])
    aligned_frame = feature_frame.reindex(columns=artifacts.feature_columns, fill_value=0.0)
    probability = float(artifacts.model.predict_proba(aligned_frame)[0][0])
    return probability


def _random_valid_id() -> str:
    size = random.randint(8, 12)
    body = [random.choice(string.ascii_uppercase + string.digits) for _ in range(size)]
    if not any(ch.isdigit() for ch in body):
        body[random.randrange(size)] = random.choice(string.digits)
    return "".join(body)


def _random_invalid_id() -> str:
    generators = [
        lambda: "",
        lambda: "123",
        lambda: "@@@@@@@",
        lambda: "AAAAAA111111111111",
        lambda: "NO_DIGITS_ID",
        lambda: "111111111111",
    ]
    return random.choice(generators)()


def generate_synthetic_training_data(samples: int = 4000) -> pd.DataFrame:
    records: List[Tuple[str, int]] = []

    for _ in range(samples // 2):
        candidate = _random_valid_id()
        label = 1 if len(validate_id_rules(candidate)) == 0 else 0
        records.append((candidate, label))

    for _ in range(samples // 2):
        candidate = _random_invalid_id()
        label = 1 if len(validate_id_rules(candidate)) == 0 else 0
        records.append((candidate, label))

    random.shuffle(records)
    return pd.DataFrame(records, columns=["id_number", "label"])


def bootstrap_model_if_missing(model_path: Path = MODEL_PATH) -> ModelArtifacts:
    if model_path.exists():
        return load_model(model_path)

    training_df = generate_synthetic_training_data(samples=5000)
    train_model(training_df, model_path=model_path)
    return load_model(model_path)
