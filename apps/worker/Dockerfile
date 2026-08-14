# Ocean — image de production du worker de publication (2e app Coolify).
# Build multi-stage : deps → build TypeScript → runner minimal non-root.
#
# Contexte de build attendu : la RACINE du monorepo.
#   docker build -f apps/worker/Dockerfile -t ocean-worker .
#
# Pourquoi cette image existe : le runbook prévoyait un buildpack faisant
# `pnpm install` puis `pnpm --filter worker start`, c'est-à-dire `tsx src/index.ts`
# — or `tsx` est une devDependency. Un buildpack qui pose NODE_ENV=production
# élague les devDependencies : le conteneur part en crash-loop, indistinguable
# d'un worker sans job pour qui ne regarde pas les logs. Ici le TypeScript est
# compilé au build et le runtime n'exécute que du JavaScript.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

# --- Dépendances -----------------------------------------------------------
# Tous les manifestes du workspace sont copiés : le lockfile déclare 3 importers,
# `--frozen-lockfile` exige de les retrouver. Seul le worker est installé.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter worker...

# --- Compilation -----------------------------------------------------------
FROM deps AS build
COPY apps/worker apps/worker
RUN pnpm --filter worker build

# --- Dépendances de production uniquement ----------------------------------
# Rejoué sans les devDependencies : tsx, typescript et les @types ne doivent pas
# se retrouver dans l'image finale.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --prod --filter worker...

# --- Runner ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S worker -G nodejs

# pnpm relie apps/worker/node_modules au magasin virtuel de /app/node_modules :
# les deux répertoires sont donc nécessaires pour que les liens résolvent.
COPY --from=prod-deps --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=worker:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=worker:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=worker:nodejs /app/apps/worker/package.json ./apps/worker/package.json

USER worker
WORKDIR /app/apps/worker

# Pas de HEALTHCHECK : le worker n'expose aucun port et sa boucle avale ses
# erreurs — un `pgrep` mentirait. Le heartbeat et le healthcheck HTTP sont un
# chantier de la phase 2 (observabilité).
#
# Rappels d'exploitation, sinon le conteneur refuse de démarrer (à dessein) :
#   DATABASE_URL     Supavisor SESSION, port 5432 — jamais 6543 (règle 17)
#   PUBLISHERS_MODE  live | stub | dry-run — sans valeur par défaut
#   DATABASE_CA_CERT racine Supabase, hors base locale
# Coolify : replicas = 1 tant que le rate limiting par social_account n'est pas
# partagé entre process (règle 19), et grace period >= 150 s (lease de 2 min).
CMD ["node", "dist/index.js"]
