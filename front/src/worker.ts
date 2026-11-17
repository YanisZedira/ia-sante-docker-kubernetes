/// <reference lib="webworker" />
// Inférence dans un Web Worker : l'interface ne gèle jamais pendant le calcul.
// Rien ne sort de l'appareil : le modèle et les images sont lus localement.
// Avec WebGPU (carte graphique), on charge la version GPU du moteur ; sinon WebAssembly.
import type * as OrtNS from "onnxruntime-web";

const BASE = import.meta.env.BASE_URL; // "/ia-sante/"
type ModelName = "pcam" | "mammo";
const hasGPU = "gpu" in navigator;

let ortP: Promise<{ ort: typeof OrtNS; backend: "webgpu" | "wasm" }> | null = null;
function engine() {
  return (ortP ??= (async () => {
    if (hasGPU) {
      try {
        const adapter = await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
        if (adapter) {
          const ort = (await import("onnxruntime-web/webgpu")) as unknown as typeof OrtNS;
          ort.env.wasm.numThreads = 1; // le moteur GPU embarque son propre fichier .wasm (assets/)
          return { ort, backend: "webgpu" as const };
        }
      } catch { /* repli WebAssembly */ }
    }
    const ort = (await import("onnxruntime-web/wasm")) as unknown as typeof OrtNS;
    ort.env.wasm.wasmPaths = `${BASE}ort/`;
    ort.env.wasm.numThreads = 1;
    return { ort, backend: "wasm" as const };
  })());
}

const sessions: Partial<Record<ModelName, Promise<OrtNS.InferenceSession>>> = {};
async function session(name: ModelName) {
  const { ort, backend } = await engine();
  return (sessions[name] ??= (async () => {
    const url = `${BASE}model/${name}.onnx`;
    if (backend === "webgpu") {
      try { return await ort.InferenceSession.create(url, { executionProviders: ["webgpu"], graphOptimizationLevel: "all" }); }
      catch { /* certains appareils refusent : WebAssembly */ }
    }
    return ort.InferenceSession.create(url, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  })());
}

// une seule inférence à la fois : le moteur refuse deux calculs simultanés sur la même session
let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (e: MessageEvent) => { queue = queue.then(() => handle(e.data)); };

async function handle(msg: any) {
  const post = (m: unknown, t: Transferable[] = []) => (self as unknown as Worker).postMessage(m, t);
  try {
    const s = await session(msg.model);
    const { ort, backend } = await engine();
    if (msg.type === "load") { post({ id: msg.id, ok: true, backend }); return; }
    const t0 = performance.now();
    const [n, ...rest] = msg.shape as number[];
    // WebGPU (ONNX Runtime Web 1.20) renvoie des résultats faux sur des lots de plus d'une image
    // (vérifié : la même imagette répétée donne des scores différents). On envoie donc une image à la fois.
    const chunk = backend === "webgpu" ? 1 : n;
    const per = (msg.data as Float32Array).length / n;
    const logits: number[] = [], cams: number[] = [];
    let camDims: readonly number[] = [];
    for (let i = 0; i < n; i += chunk) {
      const m = Math.min(chunk, n - i);
      const data = (msg.data as Float32Array).subarray(i * per, (i + m) * per);
      const out = await s.run({ image: new ort.Tensor("float32", data, [m, ...rest]) });
      logits.push(...((await out.logit.getData()) as Float32Array));
      cams.push(...((await out.cam.getData()) as Float32Array));
      camDims = out.cam.dims;
    }
    const logit = Float32Array.from(logits), cam = Float32Array.from(cams);
    post({ id: msg.id, ok: true, logit, cam, camShape: [n, ...camDims.slice(1)], ms: performance.now() - t0, backend }, [logit.buffer, cam.buffer]);
  } catch (err) {
    post({ id: msg.id, ok: false, error: String(err) });
  }
}
