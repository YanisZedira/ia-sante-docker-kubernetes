#!/usr/bin/env bash
# Vérifie le déploiement Kubernetes de bout en bout et imprime une preuve lisible.
# Usage : ./scripts/verifier-k8s.sh [URL du front]   (défaut : http://127.0.0.1:8830, NodePort via kind)
set -euo pipefail

NS=ia-sante
URL=${1:-http://127.0.0.1:8830}
ok() { printf '  \033[32mOK\033[0m  %s\n' "$*"; }
ko() { printf '  \033[31mKO\033[0m  %s\n' "$*"; exit 1; }
titre() { printf '\n=== %s\n' "$*"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }

titre "1. Objets du namespace $NS"
kubectl -n $NS get deploy,statefulset,pods,svc,pvc,hpa,networkpolicy -o wide
kubectl get pv ia-sante-postgres-pv

titre "2. L'application répond"
for p in /healthz /ia-sante/ /ia-sante/cancer-du-sein/ /ia-sante/model/mammo.onnx /ia-sante/model/pcam.onnx /api/health /api/ready /api/models /api/cases /api/sources /api/stats; do
  c=$(code "$URL$p"); [ "$c" = 200 ] && ok "$p -> $c" || ko "$p -> $c"
done

# le moteur WebAssembly d'onnxruntime est un module ES : il doit arriver en text/javascript
t=$(curl -s -o /dev/null -w '%{content_type}' "$URL/ia-sante/ort/ort-wasm-simd-threaded.mjs")
[ "$t" = "text/javascript" ] && ok "ort-wasm-simd-threaded.mjs -> $t" || ko "ort-wasm-simd-threaded.mjs -> $t"

titre "3. Répartition de charge entre les réplicas du back"
for _ in $(seq 1 12); do curl -s "$URL/api/" | sed -E 's/.*"pod":"([^"]+)".*/\1/'; echo; done | sort | uniq -c

titre "4. Cloisonnement réseau (NetworkPolicy)"
F=$(kubectl -n $NS get pod -l component=front -o name | head -1)
if kubectl -n $NS exec "$F" -- nc -z -w 3 postgres-service 5432 2>/dev/null; then ko "le front joint PostgreSQL"; else ok "le front ne peut pas joindre PostgreSQL"; fi
B=$(kubectl -n $NS get pod -l component=back -o name | head -1)
kubectl -n $NS exec "$B" -c api -- python -c "import socket; socket.create_connection(('postgres-service', 5432), 3)" && ok "le back joint PostgreSQL"

titre "5. Persistance : les données survivent à la suppression du pod PostgreSQL"
curl -s -X POST "$URL/api/analyses" -H 'Content-Type: application/json' -d '{"model":"mammo","kind":"mammographie","case_id":0,"score":0.97,"duration_ms":40,"backend":"wasm"}' >/dev/null
AVANT=$(curl -s "$URL/api/stats" | sed -E 's/.*"total":([0-9]+).*/\1/')
kubectl -n $NS delete pod postgres-statefulset-0 --wait=true
kubectl -n $NS wait --for=condition=Ready pod/postgres-statefulset-0 --timeout=120s
kubectl -n $NS wait --for=condition=Ready pod -l component=back --timeout=120s
sleep 5
APRES=$(curl -s "$URL/api/stats" | sed -E 's/.*"total":([0-9]+).*/\1/')
[ "$AVANT" = "$APRES" ] && ok "total des analyses avant = $AVANT, après = $APRES" || ko "avant $AVANT, après $APRES"

titre "6. Auto-réparation : un pod back supprimé est recréé"
VICTIME=$(kubectl -n $NS get pod -l component=back -o jsonpath='{.items[0].metadata.name}')
kubectl -n $NS delete pod "$VICTIME" --wait=false
c=$(code "$URL/api/health"); [ "$c" = 200 ] && ok "le service répond pendant la suppression ($c)"
kubectl -n $NS rollout status deploy/back-deployment --timeout=120s
kubectl -n $NS get pods -l component=back

titre "7. Mise à jour sans interruption (rolling update)"
ERR=0; N=0
kubectl -n $NS rollout restart deploy/back-deployment
( kubectl -n $NS rollout status deploy/back-deployment --timeout=180s >/dev/null; touch /tmp/ia-sante-rollout-fini ) &
rm -f /tmp/ia-sante-rollout-fini
while [ ! -f /tmp/ia-sante-rollout-fini ]; do
  N=$((N+1)); [ "$(code "$URL/api/stats")" = 200 ] || ERR=$((ERR+1)); sleep 0.2
done
rm -f /tmp/ia-sante-rollout-fini
[ "$ERR" = 0 ] && ok "$N requêtes pendant la mise à jour, 0 erreur" || ko "$ERR erreurs sur $N requêtes"
kubectl -n $NS rollout history deploy/back-deployment | tail -3

titre "8. Mise à l'échelle automatique (HPA)"
kubectl -n $NS get hpa back-hpa
kubectl top pods -n $NS 2>/dev/null || echo "  (metrics-server pas encore prêt)"

printf '\nToutes les vérifications sont passées.\n'
