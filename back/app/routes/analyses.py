"""Journal anonyme des analyses lancées dans le navigateur, et statistiques agrégées."""

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Analysis
from app.schemas import AnalysisIn, AnalysisOut, StatsOut

router = APIRouter(tags=["analyses"])


@router.post(
    "/analyses",
    response_model=AnalysisOut,
    status_code=status.HTTP_201_CREATED,
    summary="Enregistre une analyse (sans image ni donnée personnelle)",
)
def create_analysis(payload: AnalysisIn, db: Session = Depends(get_db)):
    a = Analysis(**payload.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _count_by(db: Session, col) -> dict[str, int]:
    return {k: n for k, n in db.execute(select(col, func.count()).group_by(col)).all() if k is not None}


@router.get("/stats", response_model=StatsOut, summary="Statistiques agrégées des analyses")
def stats(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Analysis)) or 0
    with_backend = db.scalar(select(func.count()).where(Analysis.backend.is_not(None))) or 0
    webgpu = db.scalar(select(func.count()).where(Analysis.backend == "webgpu")) or 0
    avg = db.scalar(select(func.avg(Analysis.duration_ms)))
    return StatsOut(
        total=total,
        by_model=_count_by(db, Analysis.model),
        by_kind=_count_by(db, Analysis.kind),
        by_lang=_count_by(db, Analysis.lang),
        webgpu_share=round(webgpu / with_backend, 3) if with_backend else None,
        avg_duration_ms=round(float(avg), 1) if avg is not None else None,
    )
