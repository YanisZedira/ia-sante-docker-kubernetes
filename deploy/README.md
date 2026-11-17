# Manifestes Kubernetes

`kubectl apply -f deploy/` applique les fichiers numérotés dans l'ordre alphabétique, donc dans le bon ordre. Le Secret
`postgres-secret` doit exister avant (voir `examples/secret.example.yaml` ou `just secret`).

| Fichier | Contenu |
| --- | --- |
| `00-namespace.yaml` | Namespace `ia-sante`, Pod Security Admission (`baseline` imposé, `restricted` signalé) |
| `10-configmaps.yaml` | `back-configmap` (PGHOST, PGPORT, PGUSER, PGDATABASE, ROOT_PATH...) et `front-configmap` (BACK_URL) |
| `20-postgres.yaml` | PersistentVolume 1 Gio (hostPath, `Retain`), PersistentVolumeClaim lié, Service headless, StatefulSet PostgreSQL 17 |
| `30-back.yaml` | Deployment de l'API (3 réplicas, initContainer, sondes startup/liveness/readiness, rolling update, `preStop`) et Service ClusterIP |
| `40-front.yaml` | Deployment nginx (2 réplicas) et Service NodePort 30080 |
| `50-hpa-pdb.yaml` | HorizontalPodAutoscaler du back (2 à 6 pods, CPU 60 %) et PodDisruptionBudgets |
| `60-networkpolicies.yaml` | Refus par défaut puis : tout → front:8080, front/gateway/k6 → back:4000, back → postgres:5432 |
| `gateway/gateway.yaml` | GatewayClass Envoy, Gateway HTTP:80, HTTPRoutes `/api` → back (préfixe retiré) et `/` → front |
| `tests/k6-job.yaml`, `tests/k6-script.js` | Test de charge k6 lancé dans le cluster pour déclencher le HPA |
| `examples/secret.example.yaml` | Modèle de Secret, jamais appliqué (sous-dossier) |

## Sondes

- **startupProbe** (back) : `GET /health` toutes les 2 s, jusqu'à 60 s, le temps de créer les tables au premier démarrage.
- **livenessProbe** : le processus répond ; sinon Kubernetes redémarre le conteneur (auto-réparation).
- **readinessProbe** (back) : `GET /ready` exécute `SELECT 1` ; si la base ne répond plus, le pod sort du Service sans être tué.

## Mise à jour sans interruption

`maxUnavailable: 0` et `maxSurge: 1` : un nouveau pod doit être prêt avant qu'un ancien parte. Le `preStop: sleep 5` laisse le temps au
Service de retirer le pod de ses endpoints avant l'arrêt du serveur. Mesuré : 0 erreur sur 179 requêtes pendant un rolling update.

## Persistance

Le PV `ia-sante-postgres-pv` (classe `manual`) est réservé au PVC `postgres-pvc` par `volumeName`. `persistentVolumeReclaimPolicy: Retain`
garde les données même si le PVC est supprimé. Les données sont dans le sous-dossier `pgdata` (variable `PGDATA`).
