# Microservice back (API FastAPI)

```bash
docker build --target dev -t ia-sante-back:dev .
docker run --rm ia-sante-back:dev pytest -q        # 6 tests, base SQLite
```

Configuration par variables d'environnement : `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` (Secret), `ROOT_PATH`, `LOG_LEVEL`.
Documentation interactive : `/api/docs` une fois la stack lancée. Voir le README à la racine.
