// Contrôle de fin de build : aucun fichier au-delà de 25 Mio, et un résumé de la taille servie par nginx.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const OUT = "dist";
let n = 0, total = 0, big = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p); if (s.isDirectory()) walk(p); else { n++; total += s.size; if (s.size > 25 * 1024 * 1024) big.push(p); } } })(OUT);
console.log(`ia-sante : ${n} fichiers, ${(total / 1048576).toFixed(1)} Mo`);
if (big.length) { console.error("Fichiers trop gros :", big); process.exit(1); }
