"""Tables PostgreSQL. Aucune donnée personnelle n'est stockée : ni image, ni adresse IP."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AIModel(Base):
    __tablename__ = "ai_models"

    slug: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    task: Mapped[str] = mapped_column(Text)
    architecture: Mapped[str] = mapped_column(Text)
    dataset: Mapped[str] = mapped_column(Text)
    test_set: Mapped[str] = mapped_column(Text)
    auc: Mapped[float] = mapped_column(Float)
    auc_ci_low: Mapped[float] = mapped_column(Float)
    auc_ci_high: Mapped[float] = mapped_column(Float)
    threshold: Mapped[float] = mapped_column(Float)
    sensitivity: Mapped[float] = mapped_column(Float)
    specificity: Mapped[float] = mapped_column(Float)
    file: Mapped[str] = mapped_column(String(120))
    size_mb: Mapped[float] = mapped_column(Float)
    input_shape: Mapped[str] = mapped_column(String(40))


class Case(Base):
    """Cas de mammographie (CBIS-DDSM) utilisés par la démonstration."""

    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(20))
    incidence: Mapped[str] = mapped_column(String(10))
    cote: Mapped[str] = mapped_column(String(10))
    acr_birads: Mapped[int | None] = mapped_column(Integer, nullable=True)
    densite: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forme: Mapped[str | None] = mapped_column(String(40), nullable=True)
    contours: Mapped[str | None] = mapped_column(String(40), nullable=True)
    pathologie: Mapped[str] = mapped_column(String(30))
    etiquette: Mapped[int] = mapped_column(Integer)
    probabilite_maligne: Mapped[float] = mapped_column(Float)
    seuil: Mapped[float] = mapped_column(Float)
    correct: Mapped[bool] = mapped_column(Boolean)
    mammographie: Mapped[str] = mapped_column(String(60))
    zoom: Mapped[str] = mapped_column(String(60))


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(Text)
    publisher: Mapped[str] = mapped_column(Text)
    license: Mapped[str | None] = mapped_column(String(40), nullable=True)
    url: Mapped[str] = mapped_column(Text)


class Analysis(Base):
    """Une analyse lancée par un visiteur. Le calcul a eu lieu dans son navigateur."""

    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    model: Mapped[str] = mapped_column(String(32), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    case_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    backend: Mapped[str | None] = mapped_column(String(10), nullable=True)
    lang: Mapped[str] = mapped_column(String(5))
