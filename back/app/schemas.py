"""Schémas Pydantic : validation stricte de tout ce qui entre dans l'API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


class AIModelOut(ORM):
    slug: str
    name: str
    task: str
    architecture: str
    dataset: str
    test_set: str
    auc: float
    auc_ci_low: float
    auc_ci_high: float
    threshold: float
    sensitivity: float
    specificity: float
    file: str
    size_mb: float
    input_shape: str


class CaseOut(ORM):
    id: int
    type: str
    incidence: str
    cote: str
    acr_birads: int | None
    densite: int | None
    forme: str | None
    contours: str | None
    pathologie: str
    etiquette: int
    probabilite_maligne: float
    seuil: float
    correct: bool
    mammographie: str
    zoom: str


class SourceOut(ORM):
    id: int
    kind: str
    title: str
    publisher: str
    license: str | None
    url: str


class AnalysisIn(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())

    model: Literal["mammo", "pcam"]
    kind: Literal["mammographie", "quiz", "lame"]
    case_id: int | None = Field(default=None, ge=0, le=10_000)
    score: float | None = Field(default=None, ge=0, le=1)
    duration_ms: float | None = Field(default=None, ge=0, le=600_000)
    backend: Literal["webgpu", "wasm"] | None = None
    lang: Literal["fr", "en", "es", "ar", "hi", "zh"] = "fr"


class AnalysisOut(ORM):
    id: int
    created_at: datetime
    model: str
    kind: str


class StatsOut(BaseModel):
    total: int
    by_model: dict[str, int]
    by_kind: dict[str, int]
    by_lang: dict[str, int]
    webgpu_share: float | None
    avg_duration_ms: float | None
