// Façade côté page : file d'attente vers le worker d'inférence.
type ModelName = "pcam" | "mammo";
export interface Result { logit: Float32Array; cam: Float32Array; camShape: number[]; ms: number; backend: "webgpu" | "wasm" }

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();

function w(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.ok ? p.res(e.data) : p.rej(new Error(e.data.error));
    };
  }
  return worker;
}

function call<T>(msg: any, transfer: Transferable[] = []): Promise<T> {
  const id = ++seq;
  return new Promise<T>((res, rej) => {
    pending.set(id, { res, rej });
    w().postMessage({ ...msg, id }, transfer);
  });
}

export const loadModel = (model: ModelName) => call<{ backend: "webgpu" | "wasm" }>({ type: "load", model });

export function run(model: ModelName, data: Float32Array, shape: number[]): Promise<Result> {
  return call<Result>({ type: "run", model, data, shape }, [data.buffer]);
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Pixels RGBA -> tenseur NCHW float32 0..255 (le modèle normalise lui-même). */
export function rgbaToNCHW(px: Uint8ClampedArray, w: number, h: number, channels: 1 | 3, out?: Float32Array, offset = 0) {
  const n = w * h;
  const t = out ?? new Float32Array(n * channels);
  for (let i = 0; i < n; i++) {
    if (channels === 1) t[offset + i] = px[i * 4];
    else {
      t[offset + i] = px[i * 4];
      t[offset + n + i] = px[i * 4 + 1];
      t[offset + 2 * n + i] = px[i * 4 + 2];
    }
  }
  return t;
}
