"""Point d'entrée FastAPI du microservice back."""

import logging
import socket
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.routes import analyses, catalog, health
from app.seed import init_db

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # tables + données de référence, une seule fois même avec plusieurs réplicas
    yield


app = FastAPI(
    title="Cancer du sein et IA : API",
    description=(
        "Microservice back de la plateforme pédagogique. Il ne pose aucun diagnostic : "
        "les deux IA tournent dans le navigateur, l'API ne garde que des statistiques anonymes."
    ),
    version=settings.app_version,
    root_path=settings.root_path,
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(catalog.router)
app.include_router(analyses.router)


@app.get("/", tags=["santé"], summary="Informations sur le service")
def root() -> dict[str, str]:
    # le nom d'hôte est celui du pod : utile pour voir la répartition de charge entre réplicas
    return {"service": "ia-sante-back", "version": settings.app_version, "pod": socket.gethostname()}
