import { loadModel, run, sigmoid, rgbaToNCHW } from "./infer";
import { DATA, json, loadImage, drawCam, el } from "./util";
import { MODELS } from "./content";
import { track } from "./api";

interface Case {
  id: number; mammographie: string; zoom: string; entree: string; zoom_demi_cote: number;
  cadre: [number, number, number, number]; taille_image: [number, number];
  type: "mass" | "calcification"; incidence: string; cote: string;
  acr_birads: number | null; forme: string; contours: string;
  pathologie: string; etiquette: number; probabilite_maligne: number; seuil: number; correct: boolean;
}

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const TYPE: Record<string, string> = { mass: "Une masse", calcification: "Des microcalcifications" };
const SIDE: Record<string, string> = { LEFT: "gauche", RIGHT: "droit" };
const ACR: Record<number, string> = { 0: "À compléter", 1: "Normal", 2: "Bénin", 3: "Probablement bénin", 4: "Suspect", 5: "Très suspect" };

let cases: Case[] = [];
let current: Case | null = null;
let modelReady: Promise<unknown> | null = null;
export const ensureMammo = () => (modelReady ??= loadModel("mammo"));
let lastP: number | null = null;
const ORDER = [0, 4, 2, 6, 9, 1, 3, 5, 7, 8, 10]; // alterne cancers, lésions bénignes et erreurs de l'IA

export async function initMammo() {
  try { cases = await json<Case[]>("mammo/cas.json"); } catch {
    $("#mammo-status").textContent = "Les images n'ont pas pu être chargées. Rechargez la page.";
    return;
  }
  const picker = $("#mammo-picker");
  const list = ORDER.map((i) => cases.find((c) => c.id === i)).filter(Boolean) as Case[];
  list.forEach((c, i) => {
    const b = el("button", { class: "case", type: "button", role: "radio", "aria-checked": "false", tabindex: i ? "-1" : "0",
      "aria-label": `Cas ${i + 1} : ${TYPE[c.type].toLowerCase()}` },
      `<img src="${DATA}mammo/${c.zoom}" alt="" width="64" height="64" loading="lazy" /><span><b>Cas ${i + 1}</b><small>${c.type === "mass" ? "Masse" : "Calcifications"}</small></span>`);
    b.addEventListener("click", () => select(c, b));
    b.addEventListener("keydown", (e) => {
      const k = (e as KeyboardEvent).key;
      const next = k === "ArrowRight" || k === "ArrowDown" ? i + 1 : k === "ArrowLeft" || k === "ArrowUp" ? i - 1 : -1;
      if (next >= 0 && next < list.length) { e.preventDefault(); const n = picker.children[next] as HTMLElement; n.click(); n.focus(); }
    });
    picker.append(b);
  });
  new IntersectionObserver((en, o) => {
    if (en[0].isIntersecting) { (picker.children[0] as HTMLElement).click(); o.disconnect(); }
  }, { rootMargin: "400px" }).observe($("#negatoscope"));
  $("#mammo-run").addEventListener("click", analyse);
  $("#mammo-truth").addEventListener("click", reveal);
}

function select(c: Case, btn: HTMLElement) {
  current = c; lastP = null;
  document.querySelectorAll("#mammo-picker .case").forEach((p) => {
    p.setAttribute("aria-checked", String(p === btn)); (p as HTMLElement).tabIndex = p === btn ? 0 : -1;
  });
  const film = $("#negatoscope");
  film.classList.remove("is-on");
  const img = $("#mammo-img") as HTMLImageElement;
  const [w, h] = c.taille_image;
  img.onload = () => requestAnimationFrame(() => film.classList.add("is-on"));
  img.src = `${DATA}mammo/${c.mammographie}`;
  img.width = w; img.height = h;
  img.alt = `Mammographie du sein ${SIDE[c.cote] ?? ""}. La zone repérée par le radiologue est entourée en rose.`;
  const svg = $("#mammo-mark") as unknown as SVGSVGElement;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const [x0, y0, x1, y1] = c.cadre;
  const m = Math.max(14, (x1 - x0) * .3);
  svg.innerHTML = `<rect x="${x0 - m}" y="${y0 - m}" width="${x1 - x0 + 2 * m}" height="${y1 - y0 + 2 * m}" rx="${m}" />`;
  $("#mammo-cap").textContent = `Sein ${SIDE[c.cote] ?? ""}`;
  const zoom = $("#mammo-zoom");
  zoom.classList.remove("has-cam");
  zoom.classList.remove("is-scanning");
  const zimg = zoom.querySelector("img") as HTMLImageElement;
  zimg.src = `${DATA}mammo/${c.zoom}`;
  zimg.alt = "Gros plan sur la zone entourée.";
  (zoom.querySelector(".zoom__label") as HTMLElement).textContent = "La zone entourée, en gros plan";
  $("#mammo-specs").innerHTML = `
    <div><dt>Ce qu'on voit</dt><dd>${TYPE[c.type]}</dd></div>
    <div><dt>Avis du radiologue</dt><dd>${c.acr_birads === null ? "Non renseigné" : ACR[c.acr_birads] ?? c.acr_birads}</dd></div>`;
  $("#mammo-gauge").hidden = true;
  $("#mammo-truth").hidden = true;
  $("#mammo-truth-text").hidden = true;
  const b = $("#mammo-run") as HTMLButtonElement;
  b.hidden = false; b.disabled = false;
  $("#mammo-status").textContent = "";
}

async function analyse() {
  if (!current) return;
  const c = current;
  const btn = $("#mammo-run") as HTMLButtonElement;
  const status = $("#mammo-status");
  btn.disabled = true;
  try {
    if (!modelReady) status.textContent = `L'IA se charge (${MODELS.mammo.poids}, une seule fois)…`;
    await ensureMammo();
    status.textContent = "L'IA regarde la zone, en direct…";
    $("#mammo-zoom").classList.add("is-scanning");
    const im = await loadImage(`${DATA}mammo/${c.entree}`);
    const cv = document.createElement("canvas"); cv.width = cv.height = 224;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    const batch = new Float32Array(2 * 224 * 224);
    ctx.drawImage(im, 0, 0);
    rgbaToNCHW(ctx.getImageData(0, 0, 224, 224).data, 224, 224, 1, batch, 0);
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(im, -224, 0); ctx.restore();
    rgbaToNCHW(ctx.getImageData(0, 0, 224, 224).data, 224, 224, 1, batch, 224 * 224);
    const r = await run("mammo", batch, [2, 1, 224, 224]);
    if (current !== c) return;
    const p = (sigmoid(r.logit[0]) + sigmoid(r.logit[1])) / 2;
    lastP = p;
    const [, h, w] = r.camShape;
    const zoom = $("#mammo-zoom");
    (zoom.querySelector(".zoom__label") as HTMLElement).textContent = "En couleur : ce que l'IA a regardé";
    const cam = zoom.querySelector("canvas")!;
    const [x0, y0, x1, y1] = c.cadre;
    const f = Math.min(1, Math.max(x1 - x0, y1 - y0) / (2 * c.zoom_demi_cote)) * 1.15;
    cam.style.width = cam.style.height = `${f * 100}%`;
    cam.style.left = cam.style.top = `${(1 - f) * 50}%`;
    drawCam(cam, r.cam.subarray(0, h * w), h, w);
    zoom.classList.remove("is-scanning");
    zoom.classList.add("has-cam");
    const g = $("#mammo-gauge");
    g.hidden = false;
    (g.querySelector(".meter__thr") as HTMLElement).style.left = `${c.seuil * 100}%`;
    requestAnimationFrame(() => ((g.querySelector(".meter__fill") as HTMLElement).style.width = `${Math.max(2, p * 100)}%`));
    const score = Math.round(p * 100);
    (g.querySelector(".answer__big") as HTMLElement).textContent = p >= c.seuil
      ? `L'IA trouve cette zone plutôt inquiétante (${score} sur 100).`
      : `L'IA trouve cette zone plutôt rassurante (${score} sur 100).`;
    btn.hidden = true;
    if ($("#mammo-truth-text").hidden) $("#mammo-truth").hidden = false;
    status.textContent = `Réponse calculée en direct en ${Math.round(r.ms)} millisecondes, sur votre appareil.`;
    (window as unknown as { gtag?: (...x: unknown[]) => void }).gtag?.("event", "ia_sante_analyse", { modele: "mammo", cas: c.id });
    track({ model: "mammo", kind: "mammographie", case_id: c.id, score: p, duration_ms: r.ms, backend: r.backend });
  } catch (e) {
    status.textContent = "L'IA n'a pas pu tourner sur cet appareil. Essayez avec un navigateur récent.";
    btn.disabled = false;
    console.error(e);
  }
}

function reveal() {
  if (!current) return;
  const c = current;
  const mal = c.etiquette === 1;
  const said = (lastP ?? c.probabilite_maligne) >= c.seuil;
  const right = said === mal;
  const t = $("#mammo-truth-text");
  t.hidden = false;
  t.className = `truth ${right ? "is-ok" : "is-bad"}`;
  t.innerHTML = `<img class="truth__art" src="${DATA}img/${mal ? "verdict-cancer" : "verdict-benin"}.webp" alt="" width="96" height="96" />
    <span><span class="truth__tag"><img src="${DATA}img/${right ? "verdict-ok" : "verdict-erreur"}.webp" alt="" width="28" height="28" />${right ? "L'IA a vu juste" : "L'IA s'est trompée"}</span>
    <b>Résultat de la biopsie : ${mal ? "c'était un cancer" : "ce n'était pas un cancer"}.</b> ${right
    ? "Sur ce cas, l'IA avait raison."
    : mal ? "Elle a sous-estimé un cancer. C'est l'erreur la plus grave, et la raison pour laquelle elle ne décide jamais seule."
      : "Fausse alerte. En vrai, cela aurait conduit à un examen de plus."}</span>`;
  $("#mammo-truth").hidden = true;
}
