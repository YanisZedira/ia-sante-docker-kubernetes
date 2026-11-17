import { defineConfig } from "vite";
import { resolve, join } from "path";
import { existsSync, statSync, createReadStream } from "fs";

// En développement, sert aussi les fichiers racine (logo, polices du dossier site/) comme nginx en production.
const siteRoot = {
  name: "site-root",
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = (req.url || "").split("?")[0];
      if (url.startsWith("/ia-sante/ort/")) {
        // fichiers du moteur ONNX : servis tels quels (Vite refuse d'importer public/)
        const f = join(__dirname, "public", url.slice("/ia-sante/".length));
        if (existsSync(f)) {
          res.setHeader("Content-Type", f.endsWith(".wasm") ? "application/wasm" : "text/javascript");
          return createReadStream(f).pipe(res);
        }
      }
      if (url.startsWith("/ia-sante") || url.startsWith("/@") || url.startsWith("/src") || url.startsWith("/node_modules")) return next();
      const f = join(__dirname, "site", decodeURIComponent(url));
      if (existsSync(f) && statSync(f).isFile()) {
        if (f.endsWith(".svg")) res.setHeader("Content-Type", "image/svg+xml");
        return createReadStream(f).pipe(res);
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [siteRoot],
  server: {
    host: true,
    // en développement (compose.dev.yaml), /api est relayé vers le conteneur back
    proxy: { "/api": { target: process.env.API_PROXY_TARGET || "http://localhost:4000", rewrite: (p) => p.replace(/^\/api/, "") } },
  },
  base: "/ia-sante/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        hub: resolve(__dirname, "index.html"),
        cancer: resolve(__dirname, "cancer-du-sein/index.html"),
      },
    },
  },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
});
