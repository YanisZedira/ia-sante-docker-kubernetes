"""Configuration lue dans l'environnement (ConfigMap + Secret sous Kubernetes, .env sous Compose)."""

from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Paramètres PostgreSQL au format libpq (mêmes noms que l'exemple du cours)
    pghost: str = "localhost"
    pgport: int = 5432
    pguser: str = "iasante"
    pgdatabase: str = "iasante"
    pgpassword: str = ""  # vient toujours d'un Secret ou du fichier .env, jamais du code

    # Prioritaire si défini (tests : sqlite:///...)
    database_url: str | None = None

    root_path: str = ""  # "/api" quand l'API est publiée derrière un préfixe
    app_version: str = "1.0.0"
    log_level: str = "info"

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        pwd = quote_plus(self.pgpassword)
        return f"postgresql+psycopg://{self.pguser}:{pwd}@{self.pghost}:{self.pgport}/{self.pgdatabase}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
