"""Sondes de santé utilisées par Docker (HEALTHCHECK) et Kubernetes (liveness / readiness)."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(tags=["santé"])


@router.get("/health", summary="Liveness : le processus répond")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", summary="Readiness : la base PostgreSQL répond")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - toute erreur de connexion rend le pod « non prêt »
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "down"})
    return {"status": "ready", "database": "up"}
