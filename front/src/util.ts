export const BASE = import.meta.env.BASE_URL; // "/ia-sante/"
export const DATA = `${BASE}data/`;

export const fr = (x: number, d = 2) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (x: number, d = 0) => `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: d })} %`;

export async function json<T>(path: string): Promise<T> {
  const r = await fetch(DATA + path);
  if (!r.ok) throw new Error(`${path} : ${r.status}`);
  return r.json();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(`image introuvable : ${src}`));
    im.src = src;
  });
}

/** Palette de chaleur : transparent -> pêche -> éosine -> violet profond. Retourne [r,g,b,a]. */
const STOPS: [number, number, number, number, number][] = [
  [0, 255, 214, 120, 0],
  [0.4, 255, 214, 120, 0],
  [0.6, 255, 176, 72, 0.45],
  [0.8, 255, 110, 64, 0.72],
  [1, 255, 236, 170, 0.9],
];
export function heat(t: number): [number, number, number, number] {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, r1, g1, b1, a1] = STOPS[i];
    if (t <= p1) {
      const [p0, r0, g0, b0, a0] = STOPS[i - 1];
      const k = (t - p0) / (p1 - p0);
      return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k, a0 + (a1 - a0) * k];
    }
  }
  return [255, 236, 170, 0.9];
}

/** Dessine une carte CAM (h x w valeurs brutes) dans un canvas, lissée, normalisée sur [min, max]. */
export function drawCam(canvas: HTMLCanvasElement, cam: ArrayLike<number>, h: number, w: number) {
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d")!;
  const im = sctx.createImageData(w, h);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < h * w; i++) { mn = Math.min(mn, cam[i]); mx = Math.max(mx, cam[i]); }
  for (let i = 0; i < h * w; i++) {
    const t = (cam[i] - mn) / (mx - mn + 1e-6);
    const k = Math.pow(t, 1.4);
    // du violet (faible) à l'éosine vive (fort), opacité croissante
    im.data[i * 4] = 140 + 103 * k; im.data[i * 4 + 1] = 70 + 20 * k; im.data[i * 4 + 2] = 230 - 90 * k;
    im.data[i * 4 + 3] = Math.round(200 * k);
  }
  sctx.putImageData(im, 0, 0);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = "") {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}
