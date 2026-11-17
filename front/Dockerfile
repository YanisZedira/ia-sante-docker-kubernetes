# syntax=docker/dockerfile:1
# Microservice « front » : plateforme pédagogique (Vite, TypeScript, onnxruntime-web).
# Les deux IA tournent dans le navigateur : le conteneur ne sert que des fichiers statiques.

# --- Étape 1 : dépendances (mise en cache tant que package*.json ne change pas) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- Étape 2 (option) : développement avec rechargement à chaud (compose.dev.yaml) ---
FROM deps AS dev
COPY . .
# Vite écrit son cache dans node_modules/.vite : l'utilisateur node doit pouvoir y écrire
RUN chown node:node /app /app/node_modules
# uid 1000 = utilisateur « node » de l'image officielle
USER 1000
EXPOSE 5181
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Étape 3 : build de production (TypeScript -> dist/) ---
FROM deps AS build
COPY . .
RUN npm run build

# --- Étape 4 : image finale, nginx sans droits root (uid 101, port 8080) ---
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
# Correctifs de sécurité des paquets Alpine publiés depuis la construction de l'image de base (scan Trivy)
USER root
RUN apk upgrade --no-cache
# Variables lues par le modèle nginx (remplacées au démarrage du conteneur)
ENV BACK_URL=http://back:4000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY --chown=101:101 nginx/default.conf.template /etc/nginx/templates/default.conf.template
# Logo et police partagés avec le site principal, servis à la racine (/logo.svg, /fonts/)
COPY --chown=101:101 site/ /usr/share/nginx/html/
# la page précharge aussi la police sous /ia-sante/fonts/ (chemin réécrit par Vite)
COPY --chown=101:101 site/fonts/ /usr/share/nginx/html/ia-sante/fonts/
COPY --chown=101:101 --from=build /app/dist/ /usr/share/nginx/html/ia-sante/
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
