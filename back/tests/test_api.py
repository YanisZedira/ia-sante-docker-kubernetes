def test_root_et_sondes(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "ia-sante-back"
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").json()["database"] == "up"


def test_modeles(client):
    r = client.get("/models")
    assert r.status_code == 200
    slugs = {m["slug"] for m in r.json()}
    assert slugs == {"mammo", "pcam"}
    pcam = client.get("/models/pcam").json()
    assert 0.9 < pcam["auc"] < 1
    assert client.get("/models/inconnu").status_code == 404


def test_cas_et_filtre(client):
    cases = client.get("/cases").json()
    assert len(cases) == 11
    masses = client.get("/cases", params={"type": "mass"}).json()
    assert masses and all(c["type"] == "mass" for c in masses)
    assert client.get("/cases", params={"type": "autre"}).status_code == 422
    assert client.get("/cases/0").json()["pathologie"] == "MALIGNANT"
    assert client.get("/cases/999").status_code == 404


def test_sources(client):
    sources = client.get("/sources").json()
    assert any("CBIS-DDSM" in s["title"] for s in sources)


def test_analyses_et_stats(client):
    before = client.get("/stats").json()["total"]
    r = client.post(
        "/analyses",
        json={
            "model": "mammo",
            "kind": "mammographie",
            "case_id": 0,
            "score": 0.91,
            "duration_ms": 42.5,
            "backend": "webgpu",
            "lang": "fr",
        },
    )
    assert r.status_code == 201
    client.post("/analyses", json={"model": "pcam", "kind": "quiz", "score": 0.8, "lang": "en"})
    s = client.get("/stats").json()
    assert s["total"] == before + 2
    assert s["by_model"]["mammo"] >= 1 and s["by_model"]["pcam"] >= 1
    assert s["webgpu_share"] == 1.0


def test_validation_stricte(client):
    # modèle inconnu, score hors bornes, champ en trop : tout est refusé
    assert client.post("/analyses", json={"model": "x", "kind": "quiz"}).status_code == 422
    assert client.post("/analyses", json={"model": "pcam", "kind": "quiz", "score": 3}).status_code == 422
    assert client.post("/analyses", json={"model": "pcam", "kind": "quiz", "image": "..."}).status_code == 422
