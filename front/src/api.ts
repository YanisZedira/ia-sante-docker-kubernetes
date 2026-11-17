// Lien avec le microservice « back » (FastAPI), joint par le même domaine sous /api.
// La page reste entièrement utilisable sans lui : chaque appel échoue en silence.
// Rien d'identifiant n'est envoyé : ni image, ni adresse, seulement le modèle utilisé,
// le score calculé dans le navigateur, la durée du calcul et la langue de la page.

import { lang } from "./i18n";

const API = "/api";

export interface Analysis {
  model: "mammo" | "pcam";
  kind: "mammographie" | "quiz" | "lame";
  case_id?: number | null;
  score?: number | null;
  duration_ms?: number | null;
  backend?: "webgpu" | "wasm" | null;
}

interface Stats { total: number; by_model: Record<string, number>; webgpu_share: number | null; avg_duration_ms: number | null }

export function track(a: Analysis): void {
  const body = JSON.stringify({ ...a, lang });
  fetch(`${API}/analyses`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
    .then(() => showStats())
    .catch(() => { /* API absente : la page continue de fonctionner */ });
}

const nf = new Intl.NumberFormat("fr-FR");

export async function showStats(): Promise<void> {
  const box = document.getElementById("api-stats");
  if (!box) return;
  try {
    const r = await fetch(`${API}/stats`, { headers: { Accept: "application/json" } });
    if (!r.ok) return;
    const s = (await r.json()) as Stats;
    box.textContent = `Sur cette installation, ${nf.format(s.total)} analyses ont été lancées par les visiteurs, toutes calculées sur leur appareil.`;
    box.hidden = false;
  } catch { /* API absente */ }
}
