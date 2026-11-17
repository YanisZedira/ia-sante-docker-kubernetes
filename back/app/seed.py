"""Création des tables et chargement des données de référence (idempotent).

Plusieurs réplicas du back démarrent en même temps sous Kubernetes : un verrou consultatif
PostgreSQL (pg_advisory_lock) garantit qu'un seul pod crée les tables et charge les données.
"""

import json
import logging
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.models import AIModel, Case, Source

log = logging.getLogger("ia-sante")
SEED = Path(__file__).parent / "seed"
LOCK_ID = 7_340_001  # identifiant arbitraire du verrou d'initialisation


def _load(name: str) -> list[dict]:
    return json.loads((SEED / name).read_text(encoding="utf-8"))


def init_db() -> None:
    with engine.connect() as conn:
        pg = conn.dialect.name == "postgresql"
        if pg:
            conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": LOCK_ID})
        try:
            Base.metadata.create_all(conn)
            conn.commit()
            with Session(bind=conn) as db:
                if db.scalar(select(AIModel).limit(1)) is None:
                    db.add_all(AIModel(**m) for m in _load("models.json"))
                    db.add_all(Case(**c) for c in _load("cases.json"))
                    db.add_all(Source(**s) for s in _load("sources.json"))
                    db.commit()
                    log.info("Base initialisée : modèles, cas et sources chargés")
        finally:
            if pg:
                conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
                conn.commit()
