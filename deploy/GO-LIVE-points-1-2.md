# Go-live points 1-2 — Vault OAuth + publish_jobs + worker

> Ordre validé par Étienne (2026-07-22). `apply_migration` MCP est **bloqué par le
> classifieur** (setup standard) → les migrations passent par **ton SQL Editor**.
> Claude fait toutes les vérifications lecture (get_advisors, /api/health) et le
> push/redeploy web dès tokens frais.

## Étape 1 — Migrations (TOI, SQL Editor de `hgdeopkmkwyoumsfggrm`)
Dans l'ordre, valider puis exécuter :
1. [`deploy/14_migration_019.sql`](14_migration_019.sql) — helpers Vault (service_role only).
   Rejouable (`create or replace`).
2. [`deploy/15_migration_020.sql`](15_migration_020.sql) — table `publish_jobs` + RPC
   `enqueue/cancel`. **NON rejouable** (enums) ; le `begin/commit` annule tout si rejeu.

Pré-vérifié en ligne le 22/07 : 019 et 020 absents, `vault.create_secret/update_secret`
présents. pgTAP : 001→020 s'applique proprement sur un Postgres réel (16 tests verts).

## Étape 2 — get_advisors (CLAUDE, lecture)
Après application, delta ATTENDU vs baseline :
- **+2 warnings** `SECURITY DEFINER` (lint 0029) : `enqueue_publish_jobs`,
  `cancel_publish_jobs` — **VOULUS** (l'app les appelle en `authenticated`, elles
  vérifient `is_org_member` en interne). Ne PAS « corriger ».
- 019 (`store/update_integration_secret`) : **aucun warning** (service_role only,
  révoquées de public → invisibles au lint anon/authenticated).
- `publish_jobs` : **aucun** `rls_enabled_no_policy` (elle a une policy SELECT).
- Inchangés : les 3 INFO `*_secrets` (deny-all voulu) + les warnings SECURITY DEFINER
  préexistants (get_report_share, create_organization, mark_*, submit_review_decision…)
  + `auth_leaked_password_protection` (à activer dans Auth › Password, séparé).

## Étape 3 — Push + redeploy web (CLAUDE, dès tokens FRAIS)
Le code des points 1-2 est déjà sur `main` (5 commits). Il me faut :
- **PAT GitHub frais** (repo `propulseo12345/ocean`).
- **Token Coolify frais**.
Je fais alors : `git push` via URL tokenisée → `GET /api/v1/deploy?uuid=eiennb096iitmlnyn6smbc9x`
→ vérif `https://socean.54-36-180-115.sslip.io/api/health` = 200 + une route neuve.

### Env OAuth à poser (Coolify web) pour rendre le flux vivant
```
OAUTH_STATE_SECRET=<aléatoire 32+ octets>
OAUTH_META_CLIENT_ID=...          OAUTH_META_CLIENT_SECRET=...
OAUTH_TIKTOK_CLIENT_KEY=...       OAUTH_TIKTOK_CLIENT_SECRET=...
OAUTH_GOOGLE_CLIENT_ID=...        OAUTH_GOOGLE_CLIENT_SECRET=...
OAUTH_MICROSOFT_CLIENT_ID=...     OAUTH_MICROSOFT_CLIENT_SECRET=...
```
Redirect URIs à déclarer chez chaque provider :
`https://socean.54-36-180-115.sslip.io/api/oauth/<provider>/callback`
(providers : meta, tiktok, google, microsoft). Sans ces env, les boutons de
connexion redirigent proprement avec `?error=oauth_unconfigured` (pas de crash).

## Étape 4 — App worker Coolify (TOI, UI Coolify)
Nouvelle application (uuid distinct de web), même repo `propulseo12345/ocean` :
- **Install** : `pnpm install`
- **Start** : `pnpm --filter worker start`  (lance `tsx src/index.ts`)
- **Env** (le worker n'utilise QUE pg — pas de supabase-js) :
  ```
  DATABASE_URL=<Supavisor SESSION>      # OBLIGATOIRE, port 5432 — voir ci-dessous
  WORKER_ID=ocean-worker-1              # optionnel
  # optionnels : WORKER_POLL_MS=5000 WORKER_LEASE_MS=120000
  #              WORKER_GRACE_MS=7200000 WORKER_MAX_ATTEMPTS=5
  ```

### ⚠️ DATABASE_URL — mode SESSION, port 5432, JAMAIS 6543
Supabase › Project Settings › Database › Connection string › **Session mode** :
```
postgresql://postgres.hgdeopkmkwyoumsfggrm:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```
Le port **6543** (Transaction mode) CASSE `FOR UPDATE SKIP LOCKED` entre commandes
et les advisory locks (règle 17) — `env.ts` REFUSE explicitement `:6543` au démarrage.
Le worker démarre en **STUB** (aucun POST réel Meta/TikTok) : il claim/lease/reaper
de vrais jobs et fait tourner la machine à états, sans publier chez un client.

## Étape 5 — Smoke test réel claim/reaper (SQL Editor)
Après étape 1 + un contenu programmé dans l'app (=> un `publish_job` réel) :
jouer [`deploy/smoke_publish_jobs.sql`](smoke_publish_jobs.sql) — **non destructif**
(`BEGIN … ROLLBACK`). Attendu : A_claimed (1 ligne, status='claimed', lease posé) ;
C_reaped (status='retrying', attempts+1). Prouve la file sur la vraie base.

## Ensuite seulement
Passe dédiée **Point 3 — Upload TUS** (aucune couche média avant que ce socle soit
appliqué et vérifié en réel).
