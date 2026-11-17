# syntax=docker/dockerfile:1
# Microservice « back » : API FastAPI + SQLAlchemy (PostgreSQL), dépendances gérées par uv.

# --- Étape 1 : environnement virtuel construit avec uv ---
FROM python:3.13-slim AS builder
# uv copié depuis son image officielle (version figée pour des builds reproductibles)
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
# Les dépendances d'abord : cette couche reste en cache tant que pyproject.toml ne change pas
COPY pyproject.toml ./
RUN uv venv /opt/venv && \
    uv pip install --no-cache --python /opt/venv -r pyproject.toml

# --- Étape 2 (option) : développement, avec les outils de test et le rechargement à chaud ---
FROM builder AS dev
RUN uv pip install --no-cache --python /opt/venv pytest httpx ruff
ENV PATH="/opt/venv/bin:$PATH"
COPY . .
EXPOSE 4000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000", "--reload"]

# --- Étape 3 : image finale, sans uv, sans compilateur, sans root ---
FROM python:3.13-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
# Correctifs de sécurité Debian publiés depuis la construction de l'image de base (scan Trivy),
# puis retrait de pip : aucun gestionnaire de paquets Python dans l'image finale.
# hadolint ignore=DL3005
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/* && \
    python -m pip uninstall -y pip && \
    groupadd --system --gid 10001 app && \
    useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app app/ ./app/
USER 10001
EXPOSE 4000
# Pas de curl dans l'image slim : la sonde utilise Python, déjà présent
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:4000/health', timeout=2).status == 200 else 1)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000", "--proxy-headers", "--forwarded-allow-ips", "*"]
