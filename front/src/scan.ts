import OpenSeadragon from "openseadragon";
import { run, sigmoid, rgbaToNCHW } from "./infer";
import { ensurePcam } from "./tissue";
import { DATA, json, loadImage, fr, heat } from "./util";
import { MODELS } from "./content";
import { track } from "./api";

interface Slide {
  lame: string; taille_affichage: number; grille: number; imagette_px: number;
  probabilites: number[][]; contours: number[][][]; auc_imagettes_zone: number | null; tissu: number; verite_imagettes: number[][];
}
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const LIVE_BUDGET_MS = 25000; // au-delà, on complète avec le calcul fait à l'avance par le même modèle
const BATCH = 16;

export async function initScan() {
  const host = $("#osd");
  let slide: Slide;
  try { slide = await json<Slide>("lame/lame.json"); } catch {
    $("#scan-status").textContent = "La lame n'a pas pu être chargée.";
    return;
  }
  const N = slide.grille, W = slide.taille_affichage;
  const live: Float32Array = new Float32Array(N * N).fill(-2); // -2 : pas encore analysé
  const tissue = slide.probabilites.flat().map((v) => v >= 0);
  let shown: "heat" | "truth" | "none" = "heat";

  const viewer = OpenSeadragon({
    element: host,
    tileSources: `${DATA}lame/lame.dzi`,
    showNavigationControl: false,
    showNavigator: false,
    animationTime: 1.1,
    springStiffness: 7,
    blendTime: 0.25,
    minZoomImageRatio: 1,
    maxZoomPixelRatio: 2,
    visibilityRatio: 1,
    constrainDuringPan: true,
    immediateRender: true,
    gestureSettingsMouse: { scrollToZoom: false, clickToZoom: false, dblClickToZoom: true },
    gestureSettingsTouch: { pinchToZoom: true, flickEnabled: true },
    keyboardShortcuts: true,
    crossOriginPolicy: false,
  } as unknown as OpenSeadragon.Options);
  // molette : zoom seulement avec Ctrl/Cmd, pour ne pas piéger le défilement de la page
  host.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const vp = viewer.viewport;
    const pt = vp.pointFromPixel(new OpenSeadragon.Point(e.offsetX, e.offsetY));
    vp.zoomBy(e.deltaY < 0 ? 1.25 : 0.8, pt); vp.applyConstraints();
  }, { passive: false });
  host.tabIndex = 0;
  // empêche le défilement doux de la page de capter les gestes faits sur la lame
  host.setAttribute("data-lenis-prevent", "");
  const zoomBy = (k: number) => { viewer.viewport.zoomBy(k); viewer.viewport.applyConstraints(); };
  document.getElementById("zoom-in")?.addEventListener("click", () => zoomBy(1.6));
  document.getElementById("zoom-out")?.addEventListener("click", () => zoomBy(1 / 1.6));
  document.getElementById("zoom-home")?.addEventListener("click", () => viewer.viewport.goHome());
  host.setAttribute("aria-describedby", "scan-note");
  $("#scan-note").textContent = "Zoomez avec les boutons + et −, en pinçant l'écran ou avec Ctrl + molette. Faites glisser pour vous déplacer.";

  const heatCv = $("#heat") as HTMLCanvasElement, truthCv = $("#truth") as HTMLCanvasElement;
  const scope = $("#scope");
  const fit = () => {
    const r = scope.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    for (const c of [heatCv, truthCv]) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
    draw();
  };
  const rect = () => {
    const a = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(0, 0));
    const b = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(W, W));
    const d = heatCv.width / scope.clientWidth;
    return { x: a.x * d, y: a.y * d, s: (b.x - a.x) * d };
  };
  const small = document.createElement("canvas"); small.width = small.height = N;
  let raf = 0;
  function draw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!viewer.world.getItemCount()) return;
      const { x, y, s } = rect();
      const hx = heatCv.getContext("2d")!;
      hx.clearRect(0, 0, heatCv.width, heatCv.height);
      if (shown === "heat") {
        // carte lissée : une valeur par imagette, agrandie avec interpolation (pas de carrés)
        const im = small.getContext("2d")!.createImageData(N, N);
        for (let i = 0; i < N * N; i++) {
          const v = live[i];
          if (v < 0) continue;
          const [r, g, b, a] = heat(v);
          im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = a * 255;
        }
        small.getContext("2d")!.putImageData(im, 0, 0);
        // plus on zoome, plus la carte s'efface pour laisser voir les cellules
        const z = viewer.viewport.getZoom(true);
        hx.globalAlpha = Math.max(0.22, Math.min(0.95, 1.15 - (z - 1) * 0.14));
        hx.imageSmoothingEnabled = true; hx.imageSmoothingQuality = "high";
        hx.drawImage(small, x, y, s, s);
        hx.globalAlpha = 1;
      }
      const tx = truthCv.getContext("2d")!;
      tx.clearRect(0, 0, truthCv.width, truthCv.height);
      if (shown === "truth") {
        tx.lineWidth = 3 * (heatCv.width / scope.clientWidth);
        tx.strokeStyle = "#ffffff"; tx.fillStyle = "rgba(255,255,255,.22)"; tx.lineJoin = "round"; tx.shadowColor = "rgba(20,10,40,.9)"; tx.shadowBlur = 6;
        for (const poly of slide.contours) {
          tx.beginPath();
          poly.forEach(([px, py], j) => (j ? tx.lineTo(x + px * s, y + py * s) : tx.moveTo(x + px * s, y + py * s)));
          tx.closePath(); tx.fill(); tx.stroke();
        }
      }
    });
  }
  viewer.addHandler("open", fit);
  viewer.addHandler("update-viewport", draw);
  viewer.addHandler("animation", draw);
  viewer.addHandler("animation-finish", draw);
  viewer.addHandler("resize", fit);
  addEventListener("resize", fit);

  // couches
  document.querySelectorAll<HTMLButtonElement>(".seg__b").forEach((b) => b.addEventListener("click", () => {
    shown = b.dataset.layer as typeof shown;
    scope.dataset.layer = shown;
    document.querySelectorAll(".seg__b").forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    draw();
  }));

  // scan
  const btn = $("#scan-run") as HTMLButtonElement;
  const status = $("#scan-status"), hudCount = $("#hud-count"), hudMs = $("#hud-ms"), line = $("#scanline");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    viewer.viewport.goHome();
    shown = "heat"; scope.dataset.layer = "heat";
    let backend: "webgpu" | "wasm" = "wasm";
    try {
      status.textContent = `L'IA se charge (${MODELS.pcam.poids})…`;
      backend = (await ensurePcam()).backend;
    } catch {
      status.textContent = "L'IA n'a pas pu tourner ici : voici le résultat calculé à l'avance.";
      finishWithPrecomputed(0);
      return;
    }
    const budget = backend === "webgpu" ? 45000 : LIVE_BUDGET_MS;
    const maxLevel = Math.ceil(Math.log2(W)), level = maxLevel - 1; // niveau d'analyse : 1 px ≈ 0,97 µm
    const per = 480 / 96;
    // ordre « du grossier au fin » : une imagette sur 16 partout, puis une sur 4, puis le reste
    const order: number[] = [];
    const seen = new Uint8Array(N * N);
    for (const step of [4, 2, 1]) for (let gy = 0; gy < N; gy += step) for (let gx = 0; gx < N; gx += step) {
      const c = gy * N + gx;
      if (!seen[c] && tissue[c]) { seen[c] = 1; order.push(c); }
    }
    const cache = new Map<string, Promise<HTMLCanvasElement>>();
    const tileCanvas = (tx: number, ty: number) => {
      const key = `${tx}_${ty}`;
      if (!cache.has(key)) cache.set(key, loadImage(`${DATA}lame/lame_files/${level}/${key}.jpg`).then((im) => {
        const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        c.getContext("2d", { willReadFrequently: true })!.drawImage(im, 0, 0); return c;
      }));
      return cache.get(key)!;
    };
    const batchSize = backend === "webgpu" ? 64 : BATCH;
    const t0 = performance.now();
    let done = 0, msSum = 0, stopped = false;
    line.style.opacity = "0";
    status.textContent = backend === "webgpu"
      ? "L'IA analyse la lame avec la carte graphique de votre appareil : d'abord une vue d'ensemble, puis le détail…"
      : "L'IA analyse la lame sur votre appareil : d'abord une vue d'ensemble, puis le détail…";
    for (let b = 0; b < order.length; b += batchSize) {
      const part = order.slice(b, b + batchSize);
      const batch = new Float32Array(part.length * 3 * 96 * 96);
      await Promise.all(part.map(async (cell, k) => {
        const gx = cell % N, gy = Math.floor(cell / N);
        const tx = Math.floor(gx / per), ty = Math.floor(gy / per);
        const c = await tileCanvas(tx, ty);
        const ox = (tx > 0 ? 1 : 0) + (gx - tx * per) * 96, oy = (ty > 0 ? 1 : 0) + (gy - ty * per) * 96;
        rgbaToNCHW(c.getContext("2d")!.getImageData(ox, oy, 96, 96).data, 96, 96, 3, batch, k * 3 * 96 * 96);
      }));
      const r = await run("pcam", batch, [part.length, 3, 96, 96]);
      part.forEach((cell, k) => (live[cell] = sigmoid(r.logit[k])));
      // pendant la vue d'ensemble, chaque résultat éclaire provisoirement ses voisines pas encore analysées
      // (on marque d'abord tout le lot comme analysé, pour ne jamais écraser une vraie valeur)
      for (const cell of part) seen2[cell] = 1;
      for (const cell of part) {
        const gx = cell % N, gy = Math.floor(cell / N);
        for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
          const nx = gx + dx, ny = gy + dy; if (nx >= N || ny >= N) continue;
          const nc = ny * N + nx; if (tissue[nc] && !seen2[nc]) live[nc] = live[cell];
        }
      }
      done += part.length; msSum += r.ms;
      hudCount.textContent = done.toLocaleString("fr-FR");
      hudMs.textContent = `${(msSum / done).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ms`;
      draw();
      if (performance.now() - t0 > budget) { stopped = true; break; }
    }
    finishWithPrecomputed(done, stopped);
  });
  const seen2 = new Uint8Array(N * N);

  function finishWithPrecomputed(liveCount: number, stopped = true) {
    let filled = 0;
    slide.probabilites.flat().forEach((v, i) => { if (v >= 0 && !seen2[i]) { live[i] = v; filled++; } });
    hudCount.textContent = slide.tissu.toLocaleString("fr-FR");
    draw();
    // concordance avec le contour des pathologistes, calculée sur les valeurs affichées (AUC par rangs)
    const truth = slide.verite_imagettes.flat();
    const pos: number[] = [], neg: number[] = [];
    live.forEach((v, i) => { if (v >= 0) (truth[i] ? pos : neg).push(v); });
    let auc: number | null = null;
    if (pos.length && neg.length) {
      const all = [...pos.map((v) => [v, 1]), ...neg.map((v) => [v, 0])].sort((a, b) => a[0] - b[0]);
      let rankSum = 0; all.forEach(([, t], i) => { if (t) rankSum += i + 1; });
      auc = (rankSum - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
    }
    const agree = auc === null ? "" : auc >= 0.95 ? "presque parfaitement" : auc >= 0.85 ? "très bien" : "en partie";
    // une phrase par élément : chacune peut être traduite séparément
    status.innerHTML = `<b>Analyse terminée.</b> ` + (liveCount
      ? `<span>${liveCount.toLocaleString("fr-FR")} carrés analysés en direct sur votre appareil.</span> `
      : "") + (stopped && filled
      ? `<span>Pour ne pas faire chauffer votre appareil, les ${filled.toLocaleString("fr-FR")} autres affichent le résultat de la même IA, calculé à l'avance.</span> `
      : "") + (auc ? `<span>Basculez sur « Ce qu'ont tracé les médecins » : l'IA rejoint ${agree} leur contour (score de concordance ${fr(auc, 2)} sur 1).</span>` : "");
    btn.textContent = "Analyse terminée";
    track({ model: "pcam", kind: "lame", score: auc });
  }

  // la lame s'ouvre légèrement zoomée puis recule, comme un objectif qu'on change
  new IntersectionObserver((en, o) => {
    if (!en[0].isIntersecting) return;
    o.disconnect();
    const go = () => { viewer.viewport.zoomTo(2.4, undefined, true); setTimeout(() => viewer.viewport.goHome(), 350); };
    viewer.world.getItemCount() ? go() : viewer.addOnceHandler("open", go);
  }, { threshold: 0.3 }).observe(scope);
}
