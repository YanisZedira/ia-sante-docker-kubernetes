"""Catalogue en lecture seule : modèles d'IA, cas de mammographie et sources."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AIModel, Case, Source
from app.schemas import AIModelOut, CaseOut, SourceOut

router = APIRouter(tags=["catalogue"])


@router.get("/models", response_model=list[AIModelOut], summary="Les deux modèles et leurs métriques de test")
def list_models(db: Session = Depends(get_db)):
    return db.scalars(select(AIModel).order_by(AIModel.slug)).all()


@router.get("/models/{slug}", response_model=AIModelOut)
def get_model(slug: str, db: Session = Depends(get_db)):
    m = db.get(AIModel, slug)
    if m is None:
        raise HTTPException(status_code=404, detail="Modèle inconnu")
    return m


@router.get("/cases", response_model=list[CaseOut], summary="Cas de mammographie de la démonstration")
def list_cases(
    type: Literal["mass", "calcification"] | None = None,
    db: Session = Depends(get_db),
):
    q = select(Case).order_by(Case.id)
    if type:
        q = q.where(Case.type == type)
    return db.scalars(q).all()


@router.get("/cases/{case_id}", response_model=CaseOut)
def get_case(case_id: int, db: Session = Depends(get_db)):
    c = db.get(Case, case_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Cas inconnu")
    return c


@router.get("/sources", response_model=list[SourceOut], summary="Jeux de données, études et licences")
def list_sources(db: Session = Depends(get_db)):
    return db.scalars(select(Source).order_by(Source.id)).all()
