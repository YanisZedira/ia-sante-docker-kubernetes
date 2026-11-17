// Charge réaliste : des visiteurs lisent les statistiques et enregistrent des analyses.
import http from "k6/http";
import { check, sleep } from "k6";

const T = __ENV.TARGET || "http://back-service:4000";

export const options = {
  stages: [
    { duration: "30s", target: 30 },
    { duration: "2m", target: 60 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // moins de 1 % d'erreurs
    // seuil adapté à un petit cluster partagé (pods limités à 0,3 CPU) : mesuré p95 = 2,1 s à 60 utilisateurs
    http_req_duration: ["p(95)<3000"],
  },
};

export default function () {
  const s = http.get(`${T}/stats`);
  check(s, { "stats 200": (r) => r.status === 200 });
  const a = http.post(
    `${T}/analyses`,
    JSON.stringify({ model: "pcam", kind: "quiz", score: Math.random(), lang: "fr" }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(a, { "analyse 201": (r) => r.status === 201 });
  http.get(`${T}/models`);
  sleep(0.2);
}
