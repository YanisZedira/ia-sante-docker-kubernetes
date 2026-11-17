# Microservice front (plateforme pédagogique)

Vite + TypeScript, deux modèles ONNX exécutés dans le navigateur par onnxruntime-web (WebGPU, sinon WebAssembly), 6 langues.
L'image finale est un nginx sans root qui sert `dist/` sous `/ia-sante/` et relaie `/api` vers le back (`BACK_URL`).

```bash
npm ci && npm run dev        # http://localhost:5181/ia-sante/cancer-du-sein/ (API attendue sur localhost:4000)
npm run build                # dist/
```

Le lien avec l'API est dans `src/api.ts` : la page reste utilisable si le back ne répond pas.
