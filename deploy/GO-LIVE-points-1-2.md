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
SITE_URL=https://socean.54-36-180-115.sslip.io   # OBLIGATOIRE — voir ci-dessous
OAUTH_STATE_SECRET=<aléatoire 32+ octets>
OAUTH_META_CLIENT_ID=...          OAUTH_META_CLIENT_SECRET=...
OAUTH_TIKTOK_CLIENT_KEY=...       OAUTH_TIKTOK_CLIENT_SECRET=...
OAUTH_GOOGLE_CLIENT_ID=...        OAUTH_GOOGLE_CLIENT_SECRET=...
OAUTH_MICROSOFT_CLIENT_ID=...     OAUTH_MICROSOFT_CLIENT_SECRET=...
```
Ces noms sont ceux que le code lit réellement (`lib/oauth/config.ts`,
`clientIdEnv` / `clientSecretEnv`) — `apps/web/.env.local.example` annonçait
`META_APP_ID`, `TIKTOK_CLIENT_KEY`… qui ne sont lus nulle part ; l'exemple a été
aligné sur le code.

Redirect URIs à déclarer chez chaque provider :
`https://socean.54-36-180-115.sslip.io/api/oauth/<provider>/callback`
(providers : meta, tiktok, google, microsoft). Sans ces env, les boutons de
connexion redirigent proprement avec `?error=oauth_unconfigured` (pas de crash).

#### ⚠️ SITE_URL — et surtout PAS `NEXT_PUBLIC_SITE_URL`
Le `redirect_uri` était dérivé de `new URL(request.url).origin`. En conteneur
derrière le proxy Coolify, ce n'est pas l'URL publique : le `redirect_uri` envoyé
au fournisseur ne correspondait à aucune des URIs déclarées, donc **aucune
connexion sociale ne pouvait aboutir en production** — et il était en plus dérivé
d'un en-tête que le client contrôle. Il vient désormais de `SITE_URL`.

`SITE_URL` n'est **pas** préfixée `NEXT_PUBLIC_` à dessein : Next inline les
variables `NEXT_PUBLIC_*` **au build**, y compris côté serveur. Vérifié sur le
bundle de ce dépôt — `.next/server/**/*.js` ne contient plus une seule occurrence
de `process.env.NEXT_PUBLIC_SITE_URL`, seulement la valeur gelée :
`return "http://localhost:3000".replace(...)`. Autrement dit, une image
construite sur une machine de dev embarquait `localhost` dans les redirect URIs
**et** dans les liens des emails, quoi que Coolify pose au runtime.

Sans `SITE_URL`, les routes OAuth redirigent en `?error=site_url_unconfigured`
(échec net et nommé, plutôt qu'un `redirect_uri_mismatch` opaque chez Meta).

## Étape 4 — App worker Coolify (TOI, UI Coolify)
Nouvelle application (uuid distinct de web), même repo `propulseo12345/ocean` :
- **Build pack** : `Dockerfile`
- **Dockerfile** : `apps/worker/Dockerfile` — ⚠️ **contexte de build = racine du dépôt**
  (le lockfile déclare 3 importers). Vérifié localement :
  `docker build -f apps/worker/Dockerfile -t ocean-worker .` → image 257 Mo,
  utilisateur non-root `worker`, `tsx` et `typescript` ABSENTS de l'image.
- **Replicas** : 1 (le rate limiting par `social_account` n'est pas partagé entre
  process — règle 19). **Grace period** ≥ 150 s (le lease est de 2 min).

  ⚠️ **Ne PAS choisir le buildpack `pnpm install` + `pnpm --filter worker start`**,
  comme le prescrivait la version précédente de ce document : `start` lançait
  `tsx src/index.ts` et `tsx` est une **devDependency**. Un buildpack qui pose
  `NODE_ENV=production` élague les devDependencies → crash-loop au boot,
  indistinguable d'un worker sans job pour qui ne lit pas les logs. Le TypeScript
  est désormais compilé au build (`pnpm --filter worker build` → `dist/`) et le
  runtime n'exécute que du JavaScript (`node dist/index.js`).
- **Env** (le worker n'utilise QUE pg — pas de supabase-js) :
  ```
  DATABASE_URL=<Supavisor SESSION>      # OBLIGATOIRE, port 5432 — voir ci-dessous
  PUBLISHERS_MODE=dry-run               # OBLIGATOIRE — voir ci-dessous
  DATABASE_CA_CERT=<prod-ca-2021.crt>   # OBLIGATOIRE hors local — voir ci-dessous
  WORKER_ID=ocean-worker-1              # optionnel
  # optionnels : WORKER_POLL_MS=5000 WORKER_LEASE_MS=120000
  #              WORKER_GRACE_MS=7200000 WORKER_MAX_ATTEMPTS=5
  #              WORKER_DRY_RUN_DEFER_MS=900000
  #              WORKER_HEALTH_PORT=8080 (déjà posé par l'image)
  #              WORKER_HEALTH_STALE_TICKS=6
  #              WORKER_MAX_CONSECUTIVE_TICK_FAILURES=60
  #              WORKER_HTTP_TIMEOUT_MS=60000   (délai max d'UN appel plateforme)
  #              WORKER_MAX_PROCESSING_MS=600000 (au-delà, le lease n'est plus
  #                prolongé et le reaper reprend le job — ne pas monter au-dessus
  #                sans raison : c'est ce qui empêche un job bloqué de l'être à vie)
  #              WORKER_TOKEN_REFRESH_TIMEOUT_MS=15000 (budget du rafraîchissement
  #                de token DANS le chemin de publication — borne le lease de 2 min)

  # === REQUIS UNIQUEMENT EN `live` (phase 6) ============================
  # Le worker refuse de démarrer en live si l'une de ces six manque, et il
  # NOMME celles qui manquent. C'est délibéré : un worker live sans
  # identifiants démarre parfaitement et n'échoue qu'au PREMIER job, à 7 h du
  # matin sur le contenu d'un vrai client.
  OAUTH_META_CLIENT_ID=<idem apps/web>       # re-échange du token long-lived Meta
  OAUTH_META_CLIENT_SECRET=<idem apps/web>
  OAUTH_TIKTOK_CLIENT_KEY=<idem apps/web>    # rotation du refresh token TikTok
  OAUTH_TIKTOK_CLIENT_SECRET=<idem apps/web>
  SUPABASE_URL=https://hgdeopkmkwyoumsfggrm.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service_role>   # signe les URL de média (bucket privé)
  ```

  ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` dans le worker n'est pas la même exposition
  que dans le web.** Le worker n'a pas de bundle navigateur : la clé y est
  strictement serveur. Elle sert à **une seule chose** — signer une URL de
  lecture, TTL 48 h, sur `media-originals` (règle 20). Sans elle, `media` arrive
  vide aux publishers et Instagram refuse tout post.

- **Healthcheck Coolify** : `GET :8080/` — l'image l'expose et déclare déjà un
  `HEALTHCHECK`. Il ne répond pas « le process vit » mais **« un tick a réussi
  récemment »** : 200 tant que le dernier tick réussi date de moins de
  `WORKER_HEALTH_STALE_TICKS × WORKER_POLL_MS` (30 s par défaut), 503 sinon.
  Le corps JSON porte `status`, `consecutiveFailures`, `totalFailures` et
  `publishersMode` — le mode d'exécution devient enfin observable à distance.

  Pourquoi ça compte : la boucle du worker attrape **toutes** les erreurs de tick
  et continue. Un worker dont le pooler a basculé échouait sur 100 % de ses ticks
  en restant « running / healthy », sans publier une seule fois, jusqu'à ce qu'un
  client réclame. Vérifié en conteneur : base injoignable → `HTTP 503` puis
  `docker inspect` → **`unhealthy`**.

  Au-delà de `WORKER_MAX_CONSECUTIVE_TICK_FAILURES` (60, soit ~5 min à 5 s), le
  worker **sort en code 1** : un conteneur qui redémarre en boucle se voit, un
  conteneur vert qui ne fait rien ne se voit pas. Vérifié : exit 1 avec le log
  `worker abandonne apres echecs consecutifs`. Sûr vis-à-vis de la règle 15 —
  un tick ne peut échouer que sur `reapExpired`/`claim`, jamais avec une
  publication en vol.

### ⚠️ PUBLISHERS_MODE — sans valeur par défaut, et `stub` est INTERDIT ici
Trois modes, la variable est obligatoire (le worker refuse de démarrer sans elle) :
- `dry-run` — **le mode de cette étape**. Le worker claim les vrais jobs, pose et
  prolonge le lease, fait tourner le reaper, et **s'arrête là** : le job n'entre pas
  dans la machine à états, donc zéro appel plateforme, zéro état terminal, et pas une
  ligne écrite dans `content_targets` ni `content_items`. Le job est relâché tel quel,
  décalé de 15 min. C'est ce qui permet de prouver la file en production **sans le
  moindre effet de bord**.
- `stub` — simulation qui écrit `content_targets.status = 'published'` avec un
  permalink `https://stub.local/…`. **Refus de démarrer si `DATABASE_URL` n'est pas
  une base locale.** Sur la base de production, Étienne programme un post pour un
  vrai client, cinq secondes plus tard l'app affiche « Publié » avec un lien mort,
  le client le voit sur le portail, et `enqueue_publish_jobs` exclut définitivement
  la cible du ré-enfilement (`ct.status not in ('published',…)`) : seul du SQL en
  service_role débloque. C'est exactement ce que cette étape 4 prescrivait avant
  le ticket P0-7.
- `live` — publishers réels. Deux refus au démarrage, dans cet ordre :
  ① `SIMULATED_PLATFORMS` (apps/worker/src/publishers/index.ts) non vide — la
  liste est **vide depuis le 18/08/2026**, les trois publishers sont réels ;
  ② **identifiants plateforme manquants** — c'est le refus qui compte
  désormais. Le message liste les variables absentes et la raison de chacune.
  ⚠️ Cette garde vérifie la **présence**, pas la validité : elle ne prouve ni
  qu'une app Meta existe, ni qu'un compte est connecté. **Aucun post réel n'a
  jamais été émis par ce code.**

Le mode retenu est écrit dans la ligne `worker started` des logs Coolify.

### ⚠️ DATABASE_CA_CERT — obligatoire, sinon le worker refuse de démarrer
C'est la connexion qui lit `vault.decrypted_secrets`, donc les **tokens OAuth en
clair** des comptes clients. Elle vérifie désormais la chaîne de certification
(équivalent `verify-full`) au lieu de l'ancien `rejectUnauthorized: false`, qui
acceptait n'importe quel certificat.

Or Supabase signe ses endpoints Postgres avec **sa propre autorité**, pas une
autorité publique — vérifié par handshake le 14/08/2026 sur
`aws-0-eu-west-1.pooler.supabase.com` **et** `db.<ref>.supabase.co` : la chaîne
remonte à « Supabase Root 2021 CA », qui n'est pas dans le magasin de confiance de
Node. Sans ce certificat, la vérification ne peut pas aboutir.

À faire : **Supabase > Project Settings > Database > SSL Configuration >
Download certificate** (`prod-ca-2021.crt`), puis coller son contenu PEM dans
`DATABASE_CA_CERT` côté Coolify (les `\n` littéraux sont acceptés), ou monter le
fichier et pointer `DATABASE_CA_CERT_PATH`.

Contrôle du fichier téléchargé — empreinte SHA-256 de la racine réellement
présentée par le serveur :
```
80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
```
```
openssl x509 -in prod-ca-2021.crt -noout -fingerprint -sha256
```

Le worker refuse de démarrer si la variable est absente, avec ce message — il ne
retombe **jamais** sur une connexion non vérifiée.

### ⚠️ DATABASE_URL — mode SESSION, port 5432, JAMAIS 6543
Supabase › Project Settings › Database › Connection string › **Session mode** :
```
postgresql://postgres.hgdeopkmkwyoumsfggrm:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```
Le port **6543** (Transaction mode) CASSE `FOR UPDATE SKIP LOCKED` entre commandes
et les advisory locks (règle 17) — `env.ts` REFUSE explicitement `:6543` au démarrage.

## Étape 5 — Smoke test réel claim/reaper (SQL Editor)
Après étape 1 + un contenu programmé dans l'app (=> un `publish_job` réel) :
jouer [`deploy/smoke_publish_jobs.sql`](smoke_publish_jobs.sql) — **non destructif**
(`BEGIN … ROLLBACK`). Attendu : A_claimed (1 ligne, status='claimed', lease posé) ;
C_reaped (status='retrying', attempts+1). Prouve la file sur la vraie base.

## Ensuite seulement
Passe dédiée **Point 3 — Upload TUS** (aucune couche média avant que ce socle soit
appliqué et vérifié en réel).
