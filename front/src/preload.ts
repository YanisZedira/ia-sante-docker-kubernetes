// Préchargement des deux IA dès que la page est prête : quand le visiteur clique, la réponse est immédiate.
import { run } from "./infer";
import { ensurePcam } from "./tissue";
import { ensureMammo } from "./mammo";

const pills = () => document.querySelectorAll<HTMLElement>("[data-ai-status]");
function set(state: "loading" | "ready" | "error", text: string) {
  pills().forEach((p) => { p.dataset.state = state; const t = p.querySelector(".ai-status__t"); if (t) t.textContent = text; });
}

export function preloadModels() {
  const start = async () => {
    set("loading", "Les 2 IA se chargent…");
    try {
      await Promise.all([ensurePcam(), ensureMammo()]);
      // un premier calcul « à vide » prépare le moteur (compilation), pour que le premier vrai clic soit instantané
      await run("pcam", new Float32Array(3 * 96 * 96).fill(200), [1, 3, 96, 96]);
      await run("mammo", new Float32Array(224 * 224).fill(80), [1, 1, 224, 224]);
      set("ready", "2 IA prêtes, en direct");
    } catch {
      set("error", "IA indisponible sur cet appareil");
    }
  };
  const go = () => ("requestIdleCallback" in window ? (window as any).requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 800));
  document.readyState === "complete" ? go() : addEventListener("load", go, { once: true });
}
