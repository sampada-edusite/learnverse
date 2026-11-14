"""Load the trained learner model and predict P(correct).

The artifact (`artifacts/learner_model.json`) is produced by `ml/train.py`. It holds the
standardisation parameters, logistic-regression weights and the per-concept population
priors learned from the training data. Inference is a dot product, so it runs in pure
Python inside the existing FastAPI process.
"""
from __future__ import annotations

import json
import math
import os

from .features import FEATURE_NAMES, LearnerState, question_features

ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
MODEL_PATH = os.environ.get("LEARNVERSE_ML_MODEL", os.path.join(ARTIFACT_DIR, "learner_model.json"))


class LearnerModel:
    def __init__(self, artifact: dict):
        if artifact.get("feature_names") != FEATURE_NAMES:
            raise ValueError("Model artifact was trained with a different feature set; retrain it.")
        self.version = artifact["version"]
        self.data_source = artifact.get("data_source", "unknown")
        self.mean = artifact["scaler_mean"]
        self.scale = [s if s else 1.0 for s in artifact["scaler_scale"]]
        self.coef = artifact["coef"]
        self.intercept = artifact["intercept"]
        self.concept_priors = artifact.get("concept_priors", {})
        self.global_prior = artifact.get("global_prior", 0.65)

    def predict_vector(self, x):
        z = self.intercept
        for xi, m, s, w in zip(x, self.mean, self.scale, self.coef):
            z += w * (xi - m) / s
        if z >= 0:
            return 1.0 / (1.0 + math.exp(-z))
        e = math.exp(z)
        return e / (1.0 + e)

    def predict(self, state: LearnerState, question_meta: dict, now=None):
        x = question_features(state, question_meta, now=now, concept_priors=self.concept_priors,
                              global_prior=self.global_prior)
        return self.predict_vector(x)


_loaded = {"path": None, "mtime": None, "model": None, "error": None}


def get_model():
    """The current model, or None if no valid artifact exists (reloads when the file changes)."""
    path = MODEL_PATH
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        _loaded.update(path=path, mtime=None, model=None, error="model artifact not found")
        return None
    if _loaded["path"] == path and _loaded["mtime"] == mtime:
        return _loaded["model"]
    try:
        with open(path, encoding="utf-8") as fh:
            model = LearnerModel(json.load(fh))
        _loaded.update(path=path, mtime=mtime, model=model, error=None)
    except (OSError, ValueError, KeyError) as exc:
        _loaded.update(path=path, mtime=mtime, model=None, error=str(exc))
    return _loaded["model"]


def model_status():
    model = get_model()
    return {"loaded": model is not None, "version": model.version if model else None,
            "data_source": model.data_source if model else None, "error": _loaded["error"]}
