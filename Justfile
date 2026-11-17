# Raccourcis du projet (https://github.com/casey/just). Chaque recette affiche la commande qu'elle lance.
# Toutes les commandes restent utilisables à la main : voir le README.

set shell := ["bash", "-c"]

ns := "ia-sante"
version := "1.0.0"
registry := "ghcr.io/yaniszedira"

# Liste des recettes
default:
    @just --list

# --- Docker Compose ----------------------------------------------------------

# Lance toute la stack (front, back, PostgreSQL) en arrière-plan
up:
    test -f .env || cp .env.example .env
    docker compose up -d --build --wait
    @echo "http://localhost:8080/ia-sante/cancer-du-sein/"

# Mode développement : rechargement à chaud du front (Vite) et du back (uvicorn --reload)
dev:
    test -f .env || cp .env.example .env
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Arrête la stack (garde le volume de la base)
down:
    docker compose down --remove-orphans

# Arrête la stack et supprime le volume de la base
clean:
    docker compose down -v --remove-orphans

# Tests de l'API dans un conteneur (ruff + pytest)
test:
    docker build -q --target dev -t ia-sante-back:dev back
    docker run --rm ia-sante-back:dev sh -c "ruff check app tests && ruff format --check app tests && pytest -q"

# --- Kubernetes (kind) --------------------------------------------------------

# Crée le cluster kind local à un nœud
cluster:
    kind get clusters | grep -q '^ia-sante$' || kind create cluster --config kind-config.yaml --wait 120s

# Construit les images et les charge dans le nœud kind
images:
    docker build -t {{registry}}/ia-sante-back:{{version}} --target runtime back
    docker build -t {{registry}}/ia-sante-front:{{version}} --target runtime front
    kind load docker-image {{registry}}/ia-sante-back:{{version}} {{registry}}/ia-sante-front:{{version}} --name ia-sante

# Crée le Secret PostgreSQL (mot de passe aléatoire, jamais écrit sur le disque)
secret:
    kubectl apply -f deploy/00-namespace.yaml
    kubectl -n {{ns}} get secret postgres-secret >/dev/null 2>&1 || kubectl -n {{ns}} create secret generic postgres-secret --from-literal=PGPASSWORD="$(openssl rand -hex 16)"

# Déploie toute l'application
deploy: secret
    kubectl apply -f deploy/
    kubectl -n {{ns}} rollout status statefulset/postgres-statefulset --timeout=180s
    kubectl -n {{ns}} rollout status deploy/back-deployment --timeout=180s
    kubectl -n {{ns}} rollout status deploy/front-deployment --timeout=180s
    @echo "http://localhost:8830/ia-sante/cancer-du-sein/"

# Tout en une fois : cluster, images, metrics-server, déploiement
all: cluster images metrics deploy

# État du namespace
status:
    kubectl -n {{ns}} get deploy,statefulset,pods,svc,pvc,hpa -o wide

# Vérifications complètes (santé, NetworkPolicy, persistance, auto-réparation, rolling update)
verify:
    ./scripts/verifier-k8s.sh

# Supprime l'application (le PV garde les données : persistentVolumeReclaimPolicy Retain)
undeploy:
    kubectl delete -f deploy/ --ignore-not-found

# Supprime le cluster kind
destroy:
    kind delete cluster --name ia-sante

# --- Mise à l'échelle et passerelle ------------------------------------------

# Installe metrics-server (nécessaire au HPA)
metrics:
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.9.1/components.yaml
    kubectl -n kube-system patch deployment metrics-server --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Test de charge k6 dans le cluster (suivre avec : just watch-hpa)
load-test:
    -kubectl -n {{ns}} delete job k6-load-test --ignore-not-found
    kubectl -n {{ns}} create configmap k6-script --from-file=deploy/tests/k6-script.js --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -f deploy/tests/k6-job.yaml
    kubectl -n {{ns}} logs -f job/k6-load-test

# Suit le HPA en direct
watch-hpa:
    kubectl -n {{ns}} get hpa back-hpa --watch

# Installe Envoy Gateway puis les routes de la Gateway API
gateway:
    kubectl apply --server-side -f https://github.com/envoyproxy/gateway/releases/download/v1.10.0/install.yaml
    kubectl -n envoy-gateway-system wait --for=condition=Available deploy/envoy-gateway --timeout=300s
    kubectl apply -f deploy/gateway/

# Ouvre la Gateway sur http://localhost:8831
gateway-forward:
    kubectl -n envoy-gateway-system port-forward $(kubectl -n envoy-gateway-system get svc -l gateway.envoyproxy.io/owning-gateway-name=ia-sante-gateway -o name) 8831:80

# --- Démonstration -----------------------------------------------------------

# Simule une panne : supprime un pod back et montre sa recréation
chaos:
    kubectl -n {{ns}} delete pod $(kubectl -n {{ns}} get pod -l component=back -o jsonpath='{.items[0].metadata.name}')
    kubectl -n {{ns}} get pods -l component=back -w

# Journaux du back
logs-back:
    kubectl -n {{ns}} logs -l component=back -f --tail=100 --all-containers
