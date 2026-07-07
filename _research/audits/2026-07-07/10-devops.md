# Audit — DevOps & mise en production (2026-07-07)

> Périmètre : prod-readiness pour Coolify (VPS, 2 apps web+worker), CI/CD, observabilité, fiabilité, PWA. Rédigé à partir de la lecture directe de `Dockerfile`, `next.config.ts`, `package.json` (racine + web), `manifest.ts`, `.dockerignore`, `.gitignore`, et de l'absence de `.github`/`proxy.ts`/`/api/health`. Référence : CLAUDE.md §1/§7, PRD §8/§11.

## Verdict

L'infrastructure est à l'état **« squelette de preview »** : un Dockerfile multi-stage propre mais **web-only**, un `next.config` correct pour la sortie standalone, et **rien d'autre** — pas de CI (`.github` absent), pas de monitoring (aucune dépendance Sentry/PostHog dans `package.json`), pas de health check, pas de second Dockerfile pour le worker (qui n'existe pas encore). C'est cohérent avec la phase (on ne déploie pas une preview mockée), mais la mise en prod est l'étape **déclarée** par Étienne — or **aucune** des briques de fiabilité que le PRD §8 et CLAUDE.md §7 exigent n'est en place. Le risque principal n'est pas un incident présent (rien n'est déployé) mais un **démarrage de prod à l'aveugle** : sans health check Coolify ne sait pas si l'app est vivante, sans Sentry le premier échec de publication chez un client passe inaperçu (alors que la matrice de notification §10 en fait un canal garanti), sans CI une migration cassée part en prod sans que pgTAP/`get_advisors` l'aient arrêtée. À cela s'ajoutent trois incohérences déjà présentes et corrigibles maintenant : **runtime Node non pinné** (CLAUDE.md dit 20 LTS, l'image tourne en 22, `engines` accepte `>=20` — trois valeurs, aucune vérité), **PWA iOS non fonctionnelle** (manifest à icône SVG seule que Safari iOS ignore, pas d'`apple-touch-icon`, `lang:"fr"` figé alors que l'app est FR/EN), et **`.dockerignore` incomplet** (ne couvre pas `_research/`, `.playwright-mcp/`, le jpeg racine → chaque rapport d'audit invalide le cache de build). **Rien de bloquant pour la maquette ; tout est un pré-requis du Lot 0** (« Monorepo + CI + Biome + Sentry/PostHog » est littéralement la première ligne du Lot 0, PRD §11).

## Fonctionnement réel observé

**Dockerfile** (racine, `Dockerfile:1-45`) : multi-stage `base(node:22-alpine) → deps → build → runner`, sortie standalone, utilisateur non-root `nextjs`. Propre, mais **une seule image, câblée web** (`pnpm --filter web build`, `CMD node apps/web/server.js`). Pas de `HEALTHCHECK`.

**next.config** (`apps/web/next.config.ts`) : `output:"standalone"` + `outputFileTracingRoot` remontant à la racine du monorepo (correct pour pnpm) ; `images.remotePatterns` = `images.pexels.com` (dépendance CDN tiers pour la démo).

**package.json racine** : scripts `dev/build/start/check(:fix)/format` (Biome). **Pas de `typecheck`.** `engines.node:">=20"`, `packageManager:"pnpm@11.1.2"`. Seule devDep : Biome.

**package.json web** : deps UI (Next 16.2.9, React 19.2.4, dnd-kit, cmdk, date-fns, lucide, shadcn, sonner, tailwind v4). **Absents** : `@sentry/*`, `posthog-js`, `zod`, `@tanstack/react-query`, `react-hook-form`, `@supabase/*`, `@serwist/*` — toute la stack backend/observabilité/PWA reste à ajouter.

**CI/CD** : `.github` **absent**. Aucun workflow. Pas de remote GitHub (décision preview). Branche courante `feat/i18n-fr-en`.

**Observabilité** : aucune. Pas de Sentry (web ni worker), pas de PostHog, pas de `/api/health` (route absente), pas d'`instrumentation.ts`.

**PWA** : `manifest.ts` avec **une seule icône SVG** (`/icon.svg`, ignorée par iOS Safari), `lang:"fr"` figé, `start_url:"/dashboard"`. Pas d'`apple-touch-icon` PNG. Pas de service worker Serwist. `theme_color`/`background_color` en hex (dupliqués ailleurs).

**.dockerignore** : couvre `node_modules`/`.next`/`.git`/`.github`/`.planning`/`docs`/`.env*`. **Ne couvre pas** `_research/`, `.playwright-mcp/`, `.claude/`, `ocean-demo-dashboard.jpeg`.

## Findings (triés par sévérité P0 → P3)

Aucun P0 (rien n'est déployé). Les P1 sont les pré-requis de mise en prod du Lot 0.

### [P1] Aucun monitoring : Sentry + PostHog absents, alors que « publish-failed » est un canal de notification garanti (§10)
- **Où** : `apps/web/package.json` (pas de `@sentry/*` ni `posthog-js`) ; pas d'`instrumentation.ts` ; futur `apps/worker`
- **Constat** : la matrice de notification (§10) fait de l'échec de publication un canal garanti (push + Realtime + email), et §7 impose Sentry web+worker+Cron Monitors avec sourcemaps. Rien n'est câblé.
- **Scénario d'échec / coût à l'échelle** : au Lot 2, une publication qui échoue silencieusement chez un client = perte de confiance (risque §12 explicite). Sans Sentry, on ne le sait pas ; sans PostHog, aucune donnée produit (§11 events).
- **Pourquoi ça bloque le scaling** : plus il y a de clients/publications, plus un échec non monitoré coûte cher. L'observabilité doit précéder la première publication réelle.
- **Reco** : Sentry web (`instrumentation.ts` + sourcemaps au build) ET worker (+ Cron Monitors sur le tick) ; scrubbing des tokens dans Sentry (§7.4) ; PostHog EU host, events serveur pour les critiques (publication, approbation, connexions) et client pour l'UI. Câbler dès le Lot 0.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §7, §10, §11 ; PRD §8

### [P1] Aucun health check : Coolify ne peut pas savoir si l'app/worker est vivante
- **Où** : `Dockerfile` (pas de `HEALTHCHECK`) ; pas de `app/api/health/route.ts`
- **Constat** : CLAUDE.md §4 prévoit `/api/health` pour Coolify ; ni la route ni la directive Docker n'existent.
- **Scénario d'échec / coût à l'échelle** : sans sonde, Coolify route du trafic vers une instance non prête ou morte ; un worker figé n'est pas détecté (le watchdog pg_cron surveille les jobs, pas le process).
- **Reco** : route `/api/health` (web) + endpoint santé worker (dernier tick < N s) + `HEALTHCHECK` Docker + labels Coolify. Le SW PWA ne doit jamais cacher `/api/health`.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §4, §7

### [P1] Aucune CI : migrations, typecheck, pgTAP et get_advisors ne sont vérifiés nulle part
- **Où** : `.github` absent ; package.json racine (pas de `typecheck`)
- **Constat** : le Lot 0 impose CI GitHub Actions ; le seul filet de typage actuel est le `next build` dans Docker. Les leak tests pgTAP et `get_advisors` (§2 règle 8, §7) n'ont aucun harnais d'exécution.
- **Scénario d'échec / coût à l'échelle** : au câblage, une migration qui casse la RLS ou introduit une fuite passe en prod sans être arrêtée. Une régression de type n'est vue qu'au build Docker (tard, lent).
- **Pourquoi ça bloque le scaling** : chaque migration future est un risque multi-tenant ; la CI est le garde-fou qui rend le rythme de dev sûr.
- **Reco** : ajouter `typecheck` (`tsc --noEmit`) au root ; workflow GitHub Actions : `biome check` + `typecheck` + `next build` + (au Lot 0) `supabase db push` sur branche + pgTAP + `get_advisors` bloquant. Créer le remote GitHub (pré-requis Lot 0).
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §7 ; PRD §11 (Lot 0)

### [P1] Dockerfile web-only : le worker (2ᵉ app Coolife) n'a ni image ni pipeline
- **Où** : `Dockerfile` (câblé `--filter web`) ; `apps/worker` inexistant
- **Constat** : la cible est 2 apps Coolify (web + worker, §8.2). L'image actuelle ne construit et ne lance que le web.
- **Scénario d'échec / coût à l'échelle** : au Lot 2, le worker de publication (composant critique, idempotence, SKIP LOCKED) a besoin de sa propre image, ses propres env vars, sa connexion Supavisor **SESSION port 5432** (jamais 6543 — casse les advisory locks).
- **Reco** : `Dockerfile.worker` dédié (`pnpm --filter worker build`, `CMD node apps/worker/...`) ; app Coolify séparée ; env vars worker distinctes ; connexion port 5432 documentée ; horloge = `now()` Postgres.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §1, §5 ; PRD §8.2

### [P2] Runtime Node non pinné : trois valeurs contradictoires (CLAUDE.md 20 / image 22 / engines >=20)
- **Où** : `CLAUDE.md §1` (node 20 LTS) ; `Dockerfile:4` (`node:22-alpine`) ; `package.json:engines` (`">=20"`)
- **Constat** : l'image prod tourne en 22 (contournement pnpm 11 documenté), la doc dit 20, `engines` accepte tout ≥20. La machine dev peut être en 24.
- **Scénario d'échec / coût à l'échelle** : un comportement runtime qui diffère entre dev (24), CI et prod (22) produit des bugs « ça marche chez moi ». Pas bloquant mais source de dérive.
- **Reco** : choisir UNE version (22 LTS, cohérente avec l'image), la pinner partout : `engines.node:"22.x"`, `.nvmrc`, image, doc. Aligner CLAUDE.md.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §1

### [P2] PWA iOS non fonctionnelle : manifest icône SVG seule, pas d'apple-touch-icon, lang figé
- **Où** : `app/manifest.ts:11` (icône SVG unique) ; `lang:"fr"` ; pas d'`apple-touch-icon` ; pas de SW Serwist
- **Constat** : iOS Safari **ignore** les icônes SVG de manifest et exige un `<link rel="apple-touch-icon">` PNG. La priorité produit est pourtant iOS (§8.5, utilisateur solo sur iPhone). Le SW Serwist (Lot 0) n'existe pas.
- **Scénario d'échec / coût à l'échelle** : au Lot 0, l'icône d'écran d'accueil iOS = capture de page (moche), et l'onboarding d'installation iOS soigné (requis pour le Web Push iOS) ne peut pas fonctionner sans PWA valide.
- **Reco** : icônes PNG maskable (192/512) + `apple-touch-icon` 180×180 PNG dans le `<head>` ; `lang` dynamique FR/EN ; Serwist via `@serwist/turbopack` (Lot 0) ; SW n'allowliste jamais `/auth/v1/*` ni les POST (§7).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §7, §8.5 ; PRD §8.5

### [P2] .dockerignore incomplet : cache de build invalidé à chaque rapport d'audit
- **Où** : `.dockerignore` (ne couvre pas `_research/`, `.playwright-mcp/`, `.claude/`, `ocean-demo-dashboard.jpeg`)
- **Constat** : `COPY . .` dans le stage build copie ces dossiers ; chaque nouveau fichier dans `_research/` (comme ce rapport) casse la couche de cache Docker et gonfle le contexte.
- **Scénario d'échec / coût à l'échelle** : builds plus lents et non déterministes ; risque d'embarquer des artefacts internes dans l'image.
- **Reco** : ajouter `_research/`, `.playwright-mcp/`, `.claude/`, `*.jpeg` racine, `.env.example` mis à part au `.dockerignore`.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou** : aucun

### [P2] Dépendance CDN tiers pour la démo : images hot-linkées depuis images.pexels.com
- **Où** : `next.config.ts` (`remotePatterns: images.pexels.com`) ; mocks (`thumbUrl`/`fullUrl` Pexels)
- **Constat** : le preview prod dépendrait de la disponibilité de Pexels. Anodin en démo, mais à retirer au câblage média (les URLs deviendront des URL signées Supabase).
- **Reco** : au Lot 1/2, remplacer par le domaine Supabase Storage (thumbs public, originaux signés) ; retirer Pexels de `remotePatterns`.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §2.20

### [P3] Pas de stratégie de backup/rollback documentée ni de gestion d'env par environnement
- **Où** : absence de `DEPLOY.md`, pas de séparation staging/prod des env vars
- **Constat** : le PRD prévoit staging + prod (`staging.app.[domain]` / `app.[domain]`) mais rien n'est documenté sur les env vars par environnement, les backups Supabase, ni le rollback.
- **Reco** : `DEPLOY.md` (procédure Coolify web+worker) ; env vars par environnement (jamais de service role en `NEXT_PUBLIC_*`) ; backups Supabase (PITR sur Pro) ; procédure de rollback (image précédente Coolify + migration réversible ou forward-fix).
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §7 ; PRD §0

## Checklist de mise en production (à cocher avant le premier déploiement)

- [ ] Remote GitHub créé + CI GitHub Actions (`biome check` + `typecheck` + `build` + pgTAP + `get_advisors`)
- [ ] 2 apps Coolify configurées : `web` + `worker` (Dockerfile.worker)
- [ ] `/api/health` (web) + santé worker + `HEALTHCHECK` Docker + labels Coolify
- [ ] Sentry web + worker + Cron Monitors, sourcemaps uploadées, scrubbing tokens
- [ ] PostHog EU, events serveur pour les critiques
- [ ] Env vars par environnement (web ET worker) ; service role JAMAIS en `NEXT_PUBLIC_*`
- [ ] Worker : connexion Supavisor SESSION port 5432 (jamais 6543)
- [ ] PWA : manifest PNG maskable + apple-touch-icon ; SW n'a jamais en cache `/auth/v1/*` ni les POST
- [ ] Runtime Node pinné (une seule version, alignée doc/CI/image)
- [ ] `.dockerignore` complété ; Pexels retiré de `remotePatterns`
- [ ] Supabase Pro AVANT le premier test de Reel (garde-fou §13.14) ; backups PITR
- [ ] Migrations : RLS + FK composites + leak test pgTAP + `get_advisors` clean

## Ce qui va bien (à préserver)

- **Dockerfile multi-stage propre** : couches deps/build/runner bien séparées, cache efficace sur les manifestes, sortie standalone, **utilisateur non-root** (uid 1001).
- **next.config correct** pour le monorepo pnpm (`outputFileTracingRoot` remonte à la racine).
- **Biome déjà câblé** (`check`/`check:fix`/`format`) — le lint/format est en place, il ne manque que `typecheck` et la CI qui l'exécute.
- **Secrets bien ignorés** (`.env*` dans `.gitignore` + `.dockerignore`).
