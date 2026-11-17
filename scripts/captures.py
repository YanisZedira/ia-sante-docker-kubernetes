"""Captures d'écran du README, prises dans un vrai Chromium (Playwright) sur la stack déployée.

Usage (depuis la racine du dépôt) :
  docker run --rm --network host -v "$PWD:/w" -w /w mcr.microsoft.com/playwright/python:v1.55.0-noble \
    sh -c "pip install -q playwright==1.55.0 && python scripts/captures.py http://127.0.0.1:8830 docs/captures"
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8830"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/captures")
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page.on("console", lambda m: print("[console]", m.type, m.text[:200]) if m.type in ("error", "warning") else None)

    # 1. Page d'accueil de la plateforme
    page.goto(f"{BASE}/ia-sante/cancer-du-sein/", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=OUT / "01-accueil.png")

    # 2. L'IA de mammographie tourne dans le navigateur (moteur WebAssembly)
    page.add_style_tag(content="#nav{display:none!important}")  # la barre fixe masquerait la démo
    page.locator("#negatoscope").scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    page.locator("#mammo-picker .case").first.click()
    page.wait_for_timeout(800)
    page.locator("#mammo-run").click()
    page.wait_for_function(
        "/millisecondes|pas pu/.test(document.getElementById('mammo-status').textContent)", timeout=180_000
    )
    page.wait_for_timeout(1200)
    page.locator("#essayer").screenshot(path=OUT / "02-ia-mammographie.png")
    print("Mammographie :", page.locator("#mammo-status").inner_text())

    # 3. Compteur servi par le microservice back (pied de page)
    page.wait_for_function("!document.getElementById('api-stats').hidden", timeout=20_000)
    page.locator("footer").screenshot(path=OUT / "03-compteur-api.png")
    print("Compteur :", page.locator("#api-stats").inner_text())

    # 4. Documentation Swagger de l'API (FastAPI)
    page.goto(f"{BASE}/api/docs", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=OUT / "04-api-swagger.png")

    # 5. La même page en anglais (i18n conservée)
    page.goto(f"{BASE}/ia-sante/cancer-du-sein/?lang=en", wait_until="networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path=OUT / "05-version-anglaise.png")

    browser.close()
print("Captures écrites dans", OUT)
