import { loadModel, run, sigmoid, rgbaToNCHW } from "./infer";
import { DATA, json, loadImage, el } from "./util";
import { MODELS } from "./content";
import { track } from "./api";

// Carrés nets (192 px) extraits de la vraie lame CAMELYON16 ; vérité = contour tracé par les pathologistes.
interface Tile { fichier: string; groupe: string; etiquette: number; probabilite: number }
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const IMG = `${DATA}tuiles/`;
let tiles: Tile[] | null = null;
let pcamReady: Promise<{ backend: "webgpu" | "wasm" }> | null = null;
export const ensurePcam = () => (pcamReady ??= loadModel("pcam"));
const getTiles = async () => (tiles ??= await json<Tile[]>("tuiles/tuiles.json"));

function seeded(n: number) { let s = n; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function pick<T>(arr: T[], k: number, rnd: () => number) { return [...arr].sort(() => rnd() - 0.5).slice(0, k); }
const verdictImg = (ok: boolean) => `<img class="vimg" src="${DATA}img/${ok ? "verdict-ok" : "verdict-erreur"}.webp" alt="" width="40" height="40" />`;

/** Probabilités de l'IA pour des carrés de tissu (ramenés à 96 px, la résolution d'entraînement), avec les 8 rotations et symétries. */
export async function predictTiles(imgs: (HTMLImageElement | HTMLCanvasElement)[]) {
  await ensurePcam();
  const n = imgs.length;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 96;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  const batch = new Float32Array(n * 8 * 3 * 96 * 96);
  let k = 0;
  for (const im of imgs) {
    for (let r = 0; r < 4; r++) for (const flip of [false, true]) {
      ctx.save(); ctx.clearRect(0, 0, 96, 96);
      ctx.translate(48, 48); ctx.rotate((r * Math.PI) / 2); if (flip) ctx.scale(-1, 1); ctx.translate(-48, -48);
      ctx.drawImage(im, 0, 0, 96, 96); ctx.restore();
      rgbaToNCHW(ctx.getImageData(0, 0, 96, 96).data, 96, 96, 3, batch, k++ * 3 * 96 * 96);
    }
  }
  const res = await run("pcam", batch, [n * 8, 3, 96, 96]);
  return Array.from({ length: n }, (_, i) => {
    let s = 0; for (let j = 0; j < 8; j++) s += sigmoid(res.logit[i * 8 + j]); return s / 8;
  });
}

/* ---------------------------------------------------------------- quiz */
export async function initQuiz() {
  let all: Tile[];
  try { all = await getTiles(); } catch { return; }
  const rnd = seeded(11);
  const g = (name: string) => all.filter((s) => s.groupe === name);
  const set = pick([...pick(g("vrai_positif"), 3, rnd), ...pick(g("vrai_negatif"), 3, rnd), ...pick(g("faux_positif"), 1, rnd), ...pick(g("faux_negatif"), 1, rnd)], 8, rnd);
  const quiz = $("#quiz");
  const answers = new Map<number, number>();
  const progress = $("#quiz-progress");
  const upd = () => { progress.textContent = `${answers.size} sur ${set.length} répondus`; (progress.style as CSSStyleDeclaration).setProperty("--p", String(answers.size / set.length)); };
  upd();
  set.forEach((s, i) => {
    const card = el("div", { class: "qcard" });
    card.innerHTML = `<div class="qcard__img"><img src="${IMG}${s.fichier}" alt="Carré ${i + 1} : tissu de ganglion coloré, vu au microscope." width="192" height="192" loading="lazy" /><span class="qcard__n">${i + 1}</span></div>
      <div class="qcard__btns" role="group" aria-label="Carré ${i + 1}">
        <button type="button" class="qbtn qbtn--c" aria-pressed="false" data-v="1">Cancer</button>
        <button type="button" class="qbtn qbtn--s" aria-pressed="false" data-v="0">Sain</button>
      </div><div class="qcard__res" aria-live="polite"></div>`;
    card.querySelectorAll<HTMLButtonElement>(".qbtn").forEach((b) => b.addEventListener("click", () => {
      if (card.classList.contains("is-done")) return;
      card.querySelectorAll(".qbtn").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      answers.set(i, Number(b.dataset.v));
      card.classList.add("is-answered");
      upd();
      if (answers.size === set.length) finish();
    }));
    quiz.append(card);
  });
  const finish = async () => {
    const out = $("#quiz-result");
    out.hidden = false;
    out.innerHTML = `<span class="live-dot"></span> L'IA regarde les mêmes carrés, en direct…`;
    let probs: number[];
    try { probs = await predictTiles(await Promise.all(set.map((s) => loadImage(`${IMG}${s.fichier}`)))); }
    catch { probs = set.map((s) => s.probabilite); }
    let you = 0, model = 0;
    set.forEach((s, i) => {
      const me = answers.get(i)!, m = probs[i] >= MODELS.pcam.seuil ? 1 : 0;
      you += Number(me === s.etiquette); model += Number(m === s.etiquette);
      const card = quiz.children[i] as HTMLElement;
      card.classList.add("is-done", s.etiquette ? "is-cancer" : "is-sain");
      card.querySelector(".qcard__res")!.innerHTML =
        `<div>${verdictImg(me === s.etiquette)}<span>Vous</span></div><div>${verdictImg(m === s.etiquette)}<span>L'IA</span></div><b>${s.etiquette ? "C'était un cancer" : "C'était sain"}</b>`;
    });
    out.innerHTML = `<div class="score"><div><b>${you}/${set.length}</b><span>Vous</span></div><div class="score__vs">contre</div><div><b>${model}/${set.length}</b><span>L'IA</span></div></div>` +
      `<p>${you < model ? "Rassurez-vous : les pathologistes s'entraînent pendant des années, et regardent la lame entière, pas de petits carrés." : "Bravo ! L'IA, elle, ne se fatigue pas : elle refait ce travail sur des milliers de carrés. C'est là qu'elle aide."}</p>`;
    (window as unknown as { gtag?: (...x: unknown[]) => void }).gtag?.("event", "ia_sante_quiz", { score: you });
    track({ model: "pcam", kind: "quiz", score: model / set.length });
  };
}

/* ---------------------------------------------------------------- erreurs */
export async function initErrors() {
  let all: Tile[];
  try { all = await getTiles(); } catch { return; }
  const fill = (id: string, group: string, n: number) => {
    const box = $(id);
    all.filter((s) => s.groupe === group).slice(0, n).forEach((s) => {
      const t = el("figure", { class: "tile" }, `<img src="${IMG}${s.fichier}" alt="${group === "faux_positif" ? "Tissu sain" : "Tissu cancéreux"} ; l'IA lui a donné ${Math.round(s.probabilite * 100)} sur 100." loading="lazy" width="192" height="192" /><b>${Math.round(s.probabilite * 100)}/100</b>`);
      box.append(t);
    });
  };
  fill("#err-fp", "faux_positif", 4);
  fill("#err-fn", "faux_negatif", 4);
}

/* ---------------------------------------------------------------- labo de coloration */
export async function initStainLab() {
  let all: Tile[];
  try { all = await getTiles(); } catch { return; }
  // carré choisi hors ligne : une vraie zone cancéreuse, la plus sensible à la coloration
  const s = all.find((x) => x.fichier === "t_49_49.jpg") ?? all.find((x) => x.groupe === "vrai_positif") ?? all[0];
  const src = await loadImage(`${IMG}${s.fichier}`);
  const canvas = $("#stain-canvas") as HTMLCanvasElement;
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const base = ctx.getImageData(0, 0, 192, 192);
  const hue = $("#stain-hue") as HTMLInputElement, sat = $("#stain-sat") as HTMLInputElement;
  const out = $("#stain-out");
  const gauge = $("#stain-gauge");
  out.textContent = "Faites glisser un curseur.";
  let t: number | undefined, busy = false, again = false;
  const apply = () => {
    const d = new ImageData(new Uint8ClampedArray(base.data), 192, 192);
    const a = (Number(hue.value) * Math.PI) / 180, k = Number(sat.value) / 100;
    const cos = Math.cos(a), sin = Math.sin(a);
    const m = [
      0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
      0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
      0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
    ];
    for (let i = 0; i < d.data.length; i += 4) {
      const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
      const R = m[0] * r + m[1] * g + m[2] * b, G = m[3] * r + m[4] * g + m[5] * b, B = m[6] * r + m[7] * g + m[8] * b;
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      d.data[i] = L + (R - L) * k; d.data[i + 1] = L + (G - L) * k; d.data[i + 2] = L + (B - L) * k;
    }
    ctx.putImageData(d, 0, 0);
  };
  const infer = async () => {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const [p] = await predictTiles([canvas]);
      const sees = p >= MODELS.pcam.seuil;
      gauge.style.setProperty("--p", String(p));
      gauge.classList.toggle("is-off", !sees);
      out.innerHTML = sees ? `L'IA voit des cellules cancéreuses <b>(${Math.round(p * 100)} sur 100)</b>.` : `L'IA ne voit plus rien <b>(${Math.round(p * 100)} sur 100)</b>. Pourtant, ce sont les mêmes cellules.`;
    } catch { out.textContent = "L'IA n'a pas pu tourner sur cet appareil."; }
    busy = false;
    if (again) { again = false; infer(); }
  };
  const onInput = () => { apply(); clearTimeout(t); t = window.setTimeout(infer, 90); };
  hue.addEventListener("input", onInput);
  sat.addEventListener("input", onInput);
  new IntersectionObserver((en, o) => { if (en[0].isIntersecting) { infer(); o.disconnect(); } }, { rootMargin: "300px" }).observe(canvas);
}
