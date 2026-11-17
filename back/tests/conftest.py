"""Les tests tournent sur SQLite : aucune base PostgreSQL n'est nécessaire en CI."""

import os
import tempfile
from pathlib import Path

import pytest

_db = Path(tempfile.gettempdir()) / "ia-sante-test.db"
_db.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # le « with » déclenche le lifespan (création + chargement de la base)
        yield c
