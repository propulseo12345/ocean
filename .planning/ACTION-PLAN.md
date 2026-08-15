# Plan d'action Ocean — de « socle solide » à « premier client réel »

> Statut : **à valider par Étienne**. Version du 14/08/2026.
> Fusion du [brief de reprise](BRIEF-REPRISE-2026-08.md) (vision, séquence, chemin critique Meta)
> et de l'[audit senior du 12/08](../_research/audits/2026-08-12/00-SYNTHESE.md) (défauts vérifiés).
> Une phase = une ou deux sessions de travail. Chaque phase a un critère de sortie **vérifiable**.

---

## La règle qui organise tout

Trois portes, dans cet ordre. On ne franchit pas une porte avant d'avoir fermé la précédente.

1. **Porte A — ne rien casser** : avant de déployer le worker en production.
2. **Porte B — ne jamais publier deux fois** : avant le premier POST réel.
3. **Porte C — ne pas mentir au client** : avant d'ouvrir Ocean à un vrai client.

Tout le reste (IA, image, community management, nouvelles plateformes) vient après, et n'est pas
une condition de lancement.

---

## PORTE A — Ne rien casser

### Phase 0 — Débloquer l'outillage · 1 session (~4 h)

**Pourquoi d'abord** : la CI n'a jamais tourné une seule fois (7 runs, 7 échecs). Rien de ce qui suit
n'est protégé tant qu'elle est rouge. La faille Vault de la migration 021 avait un test commité
*avant* le correctif — il n'a jamais été exécuté, la faille est partie en production.

- Corriger `CLAUDE.md` §0 (il annonce encore « preview mockée, ne pas câbler Supabase ») + `Repo`,
  `URL prod`, `URL staging`, et y référencer le brief de reprise.
- Réparer la CI : collision de version `012` (deux fichiers `012_*`), Node 22 au lieu de Node 20
  (incompatible pnpm 11.1.2), ajouter `apps/worker` aux jobs, retirer les `continue-on-error`.
- Supprimer `apps/web/scratch-verify-types.ts` (fichier non suivi, 5 erreurs TS volontaires : un
  `git add -A` casse le seul gate bloquant **et** tout redéploiement Coolify).
- `STUB_MODE` piloté par une variable d'environnement, avec **refus de démarrer** si le mode stub
  est actif sur une base non locale.
- Connexion worker en TLS `verify-full` (aujourd'hui `rejectUnauthorized: false` sur la connexion
  qui lit le Vault).

**Critère de sortie** : la CI passe au vert sur une PR de test, et le worker refuse de démarrer
sans `PUBLISHERS_MODE` explicite.

#### Tickets — suivi d'exécution

> La session d'exécution met à jour ce tableau après **chaque** ticket : statut, commit, et la
> preuve (la commande lancée et sa sortie réelle). La session de pilotage vérifie ensuite.

> Exécution : branche `chore/phase-0-outillage`. **Non poussée** — le compte GitHub de la
> session (`Propulseo`) n'a que la lecture sur `propulseo12345/ocean` ; à débloquer plus tard
> (décision d'Étienne du 14/08).
>
> Écritures en ligne sur `hgdeopkmkwyoumsfggrm` : **une seule**, le rattrapage du ledger
> (`deploy/17_ledger_catchup.sql`), sur autorisation explicite d'Étienne donnée en séance.
> Résultat vérifié : 22 lignes `001`→`022`, aucune version intruse, `get_advisors` sans
> nouveau lint. Aucune table, policy, fonction ou donnée métier n'a été touchée.

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| P0-1 | `CLAUDE.md` §0 : remplacer la phase « preview mockée » par l'état réel ; renseigner `Repo`, `URL prod app`, `URL staging` ; référencer `BRIEF-REPRISE-2026-08.md` et `ACTION-PLAN.md` en ouverture | ✅ | `4395e92` | `grep -nE "PREVIEW FRONT\|app\.\[domain\]\|à créer — voir docs/kickoff" CLAUDE.md` → aucune occurrence. Les 4 champs sont renseignés (URL staging = « aucune », dit explicitement). Bandeau d'ouverture + 3 lignes ajoutées au tableau §13. |
| P0-2 | CI job `db` : résoudre la collision de version `012` (deux fichiers `012_*` → `supabase db reset` meurt sur `schema_migrations_pkey`). ⚠ La migration est **déjà appliquée en ligne** : proposer la manœuvre et le rattrapage du ledger distant, **ne rien exécuter en ligne** | ✅ | `8cc4191` | `012_media_storage.sql` → `022_media_storage.sql`. Garde CI ajoutée, jouée en local : « OK : 22 migrations, versions toutes uniques » (`001 002 … 021 022`). Rejeu complet dans le conteneur `ocean_rev2` : 21 migrations appliquées + 1 sautée (`*_storage.sql`), 0 erreur psql. ⚠ Renuméroté en 022, le fichier passait APRÈS 017 qui supprime `media_thumbs_select_public` : la création de cette policy a été retirée, sinon chaque `db reset` faisait resurgir la fuite de listing (advisor 0025). `deploy/17_ledger_catchup.sql` **appliqué le 14/08** (autorisation d'Étienne) : le ledger distant était totalement absent (pas même le schéma `supabase_migrations`), il porte désormais 22 lignes `001`→`022`. Confirmation en lecture que le correctif est exact : la base en ligne a **5 policies storage** et **zéro** `media_thumbs_select_public` — exactement ce que produit le fichier `022` corrigé. |
| P0-2b | *(hors ticket — découvert en exécutant la suite pgTAP pour la première fois)* `013_collaboration.test.sql` §7 : assertion morte depuis la migration 017 (`permission denied for function emit_notification`) | ✅ | `e9e9a6a` | Avant : 246 ok / **1 not ok**. Après : **248 ok / 0 not ok / 0 erreur psql** sur 19 fichiers de test. Le `throws_ok '42501'` voisin passait sur le mauvais 42501 (permission au lieu de FORBIDDEN) : il ne prouvait plus la garde de tenant. |
| P0-3 | CI job `web` : Node 22 (pnpm 11.1.2 est incompatible avec Node 20, `setup-node` échoue) | ✅ | `1eac28c` | Les 3 sources concordent : Dockerfile `node:22-alpine`, `engines.node` `>=22.13`, ci.yml `node-version: 22` (+ CLAUDE.md §1). `pnpm install --frozen-lockfile` passe, lockfile inchangé (`git status pnpm-lock.yaml` vide). |
| P0-4 | CI : ajouter un job `worker` (typecheck + `node --test`) — les 7 tests qui prouvent la règle 15 ne tournent nulle part aujourd'hui | ✅ | `e8570cf` | YAML relu : `jobs = ['db', 'web', 'worker']` (9 / 7 / 6 steps). Job bloquant. `pnpm --filter worker exec tsc --noEmit` → 0 erreur ; `pnpm --filter worker test` → **7/7** au moment du ticket. |
| P0-5 | Corriger les 2 points qui font échouer `pnpm check`, puis retirer les `continue-on-error` de Biome et du typecheck | ✅ | `e1b8954` | ⚠ **36 erreurs**, pas 2 (mesuré sur un arbre LF ; sous Windows 347 fausses erreurs CRLF masquent tout) : 1 parse `.planning/i18n/lot3-workflow.js`, 11 JSON `docs/superpowers/audits/`, 24 formats dans `apps/web`. `document.cookie` est un *warning*, jamais bloquant. Corrigé par 3 exclusions biome.json + `biome format --write` sur exactement les 24 fichiers (+83/−78). Preuve : `git archive` en LF puis `biome check .` → « Checked 422 files. Found 17 warnings. » **exit 0**. |
| P0-6 | Supprimer `apps/web/scratch-verify-types.ts` et `apps/web/tsconfig.scratch.json` (non suivis, 5 erreurs TS volontaires : un `git add -A` casse le gate **et** tout redéploiement) | ✅ | `8d53f90` | `pnpm --filter web exec tsc --noEmit` : **5 erreurs → 0**. Fichiers supprimés (donc rien à committer : le commit porte la règle `.gitignore` qui empêche de réarmer la mine). `git check-ignore -v` confirme les deux chemins. |
| P0-7 | `STUB_MODE` → `PUBLISHERS_MODE` (`live` \| `stub` \| `dry-run`), sans valeur par défaut. Refus de démarrer si absent, ou si `stub` sur une base non locale. `dry-run` = claim/lease/reaper sans jamais écrire d'état terminal ni toucher `content_targets` (c'est le mode de la phase 1) | ✅ | `c9ad88a` | `grep -rn STUB_MODE` → 0 dans le code. Démarrages réels : sans mode / `stub` sur base distante / `live` / valeur inconnue → **exit 1** avec le message correspondant ; `dry-run` → `{"message":"worker started","publishersMode":"dry-run"}`. `live` est refusé tant que `SIMULATED_PLATFORMS` n'est pas vide. 8 tests ajoutés. Runbook étape 4 corrigé (il prescrivait `stub` sur la base de production). |
| P0-8 | `apps/worker/src/db/pool.ts` : TLS `verify-full` au lieu de `rejectUnauthorized: false` sur la connexion qui lit le Vault | ✅ | `c221077` | ⚠ Handshake TLS réel avant correctif sur les 3 endpoints (`aws-0-eu-west-1.pooler`, `aws-1-…`, `db.<ref>.supabase.co`) : tous « self-signed certificate in certificate chain » — chaîne remontant à *Supabase Root 2021 CA*, absente du magasin Node. Basculer le drapeau seul aurait cassé toute connexion. `DATABASE_CA_CERT` est donc requis, sinon refus de démarrer (vérifié : exit 1). Avec une CA bidon la connexion est **refusée** (« self-signed certificate… ») là où l'ancien code l'acceptait. 3 tests ajoutés. |

#### État final des commandes de vérification

| Commande | Résultat |
|---|---|
| `pnpm -w build` | ✅ build Next.js complet, 0 erreur |
| `pnpm --filter web exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker test` | ✅ **18/18** (7 d'origine + 8 gardes de mode + 3 TLS) |
| `pnpm check` (arbre LF = checkout CI) | ✅ exit 0 — 422 fichiers, 0 erreur, 17 warnings |
| Rejeu migrations + pgTAP (conteneur `ocean_rev2`) | ✅ 21 migrations, 19 fichiers de test, **248 assertions ok / 0 not ok** |

⚠ **Le critère de sortie de la phase 0 n'est pas encore atteint** : il exige un run de CI vert
*sur GitHub*. Ni le CLI Supabase ni un stack local ne sont installables ici (ports 54321/54322
déjà pris par d'autres projets), donc `022_media_storage.sql` — les buckets et les 5 policies
`storage.objects` — n'a jamais été appliqué nulle part sauf en ligne. C'est le seul point que
la vérification locale ne couvre pas. À faire par Étienne : pousser la branche, ouvrir une PR,
lire le run.

### Phase 1 — Identifiants Meta et worker déployé · 1 session + administratif

Reprend la session 1 du brief, protégée par la phase 0.

> **Prérequis CODE de cette phase : faits le 14/08** (branche `chore/phase-0-outillage`).
> Ne restent que les actions à identifiants — app Meta, variables Coolify, app worker.
>
> | Prérequis | Commit | Preuve |
> |---|---|---|
> | `redirect_uri` + origine publique au runtime | `2956318` | Le `redirect_uri` venait de `new URL(request.url).origin` : en conteneur ce n'est pas l'URL publique, donc **aucune** connexion sociale ne pouvait aboutir. Pire, `NEXT_PUBLIC_SITE_URL` est **inlinée au build** par Next : le bundle contenait `return "http://localhost:3000".replace(...)` et plus aucune lecture de `process.env` — ce que Coolify posait au runtime était ignoré. Nouveau `lib/site-url.ts` sur `SITE_URL` (non préfixée). Après : 15 fichiers lisent `process.env.SITE_URL`, **zéro** valeur gelée. |
> | Noms de variables réconciliés | `2956318` | `.env.local.example` annonçait `META_APP_ID`, `TIKTOK_CLIENT_KEY`… que le code ne lit **nulle part** (il lit `OAUTH_META_CLIENT_ID`, etc.). Le gabarit était en plus **ignoré par .gitignore**, donc invisible : il est désormais versionné, aligné sur le code, avec `SITE_URL` et `OAUTH_STATE_SECRET`. |
> | Chaîne de build du worker + image | `573bf59` | `start` lançait `tsx`, une devDependency → crash-loop garanti sous `NODE_ENV=production`. Désormais `tsc` → `dist/`, `node dist/index.js`, et `apps/worker/Dockerfile`. Image construite pour de vrai : 257 Mo, non-root, `tsx` et `typescript` **absents**. Les 4 chemins de refus rejoués **dans le conteneur**. |
> | Les images sont construites en CI | `c3b7258` | Nouveau job `docker` en matrice (web + worker), cache GHA. `jobs = ['db','web','worker','docker']`. Les deux `docker build` passent en local. |
>
> **Reste à faire, phase 1** : app Meta en mode dev + testeurs ; poser `SITE_URL`,
> `OAUTH_STATE_SECRET` et les identifiants Meta dans Coolify ; créer l'app Coolify
> `ocean-worker` (build pack **Dockerfile** `apps/worker/Dockerfile`, contexte racine,
> `PUBLISHERS_MODE=dry-run`, `DATABASE_CA_CERT`, replicas 1, grace period ≥ 150 s) ;
> smoke test `deploy/smoke_publish_jobs.sql`. Tout est détaillé dans
> `deploy/GO-LIVE-points-1-2.md`, corrigé en conséquence.

- Créer l'app Meta en mode développement, compte de test + compte Instagram perso en testeurs.
- Poser `OAUTH_STATE_SECRET` et les identifiants Meta dans Coolify (⚠ vérifier les **noms exacts**
  des variables : le code, le runbook et `.env.local.example` ne concordent pas).
- Corriger la dérivation du `redirect_uri` : elle vient de `request.url`, ce qui donne
  `http://0.0.0.0:3000/...` en conteneur — aucune connexion sociale ne peut aboutir en production.
- Créer l'app Coolify `ocean-worker` (`DATABASE_URL` Supavisor **session, port 5432**).
  ⚠ Le worker n'a aujourd'hui aucun script `build` et son `start` appelle `tsx`, une *devDependency*.
- Smoke test `deploy/smoke_publish_jobs.sql`.

**En parallèle, hors code, à lancer le premier jour** : entité + Meta Business Manager +
**Business Verification**. C'est le seul délai vraiment incompressible du projet.

**Critère de sortie** : un job de test est claim par le worker déployé, et **aucun `content_target`
n'a changé de statut**.

### Phase 2 — Observabilité · 1 session

- Sentry sur `apps/web` et `apps/worker`, sourcemaps au build, Cron Monitors sur le heartbeat.
- Le worker doit exposer un signe de vie : aujourd'hui sa boucle avale toutes ses erreurs, un worker
  qui échoue à 100 % reste « healthy » pour Coolify.
- Alerte sur job `failed` ou `dead_letter`.
- PostHog en host EU.

**Critère de sortie** : une erreur provoquée volontairement dans le worker apparaît dans Sentry, et
l'arrêt du worker déclenche une alerte.

> **Ce qui ne demandait aucun compte externe est fait le 14/08.**
>
> | Chantier | Commit | Preuve |
> |---|---|---|
> | Le worker expose un signe de vie | `abbe73e` | Sa boucle attrapait **toutes** les erreurs de tick sans compteur : un worker dont le pooler bascule échouait à 100 % en restant « running / healthy », sans publier une seule fois. La santé répond maintenant « un tick a réussi récemment », pas « le process vit ». Vérifié **en conteneur** : base injoignable → `HTTP 503`, puis `docker inspect` → **`unhealthy`**. Au-delà de 60 échecs consécutifs (~5 min) : **exit 1**, donc redémarrage visible — vérifié. `pool.on('error')` ajouté. |
> | Le moteur d'états n'est plus muet | `abbe73e` | `succeed`, `retryOrFail`, `failPermanent`, `deadLetter`, `deferForQuota` et la pose de `publish_started_at` émettent un log structuré (identifiants et statuts uniquement, aucun secret). Sans ça, impossible de savoir si 2 % ou 30 % des publications échouent. |
> | Les erreurs serveur web laissent une trace | `0ad690f` | `grep 'console\.'` sur `apps/web` renvoyait **0** : le conteneur ne produisait aucun log. `instrumentation.ts` + `onRequestError`, même format JSON que le worker. Le `digest` est journalisé **et** affiché à l'utilisateur : prouvé de bout en bout, le même `4135737880` apparaît dans le log serveur et dans la charge envoyée au client. |
>
> **Reste, et ça demande des comptes** : Sentry (web + worker, sourcemaps, Cron Monitors),
> PostHog EU, alerte sur job `failed`/`dead_letter`, et le **watchdog `pg_cron`** — le seul
> filet indépendant du worker, qui n'existe toujours pas.

---

## PORTE B — Ne jamais publier deux fois

### Phase 3 — Sûreté du moteur · 2 à 3 sessions

**Pourquoi avant les publishers** : quatre chemins normaux produisent aujourd'hui une double
publication. La cause est unique — l'ancre d'idempotence `publish_started_at` vit sur la **ligne de
job**, alors que le risque qu'elle protège (« un POST est peut-être parti chez Meta ») appartient à
la **cible** et est définitif.

- Porter l'ancre d'idempotence sur `content_targets`.
- Inverser l'ordre dans `processJob` : la fenêtre de grâce est évaluée **avant** le test
  d'idempotence, donc un job déjà publié part en `dead_letter` sans qu'on interroge jamais le
  conteneur distant.
- Statut terminal `needs_verification`, distinct de `failed` : aujourd'hui un post en ligne peut
  être affiché « échec », l'admin reprogramme, et le doublon part.
- `enqueue_publish_jobs` ne doit plus ré-enfiler les cibles `failed` ni `pushed_to_platform`
  (second brouillon TikTok, quota 5/24 h brûlé).
- Fencing `worker_id` sur les 8 écritures d'état (aucune ne le relit aujourd'hui).
- Timeouts HTTP + reaper qui termine les jobs à bout de tentatives.
- Quota réel : `checkQuota` renvoie `true` en dur, y compris hors mode stub.

**Critère de sortie** : les tests du moteur couvrent les quatre chemins de double publication, et
ils tournent en CI.

#### Tickets — suivi d'exécution

> Exécution : branche `chore/phase-0-outillage`, nuit du 14 au 15/08/2026.
> **Non poussée** (le compte GitHub de la session n'a que la lecture).
> Aucune écriture sur `hgdeopkmkwyoumsfggrm` : les migrations 023→031 attendent
> dans `deploy/` (fichiers 18 à 27), à appliquer à la main dans l'ordre.

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| P3-1 | Inverser l'ordre dans `processJob` : idempotence AVANT fenêtre de grâce | ✅ | `c15cb2a` | La fenêtre n'est plus évaluée qu'`if (!started)` ; elle est **réévaluée** dans `recoverStartedJob`, sur la seule branche sûre (conteneur `error`/`expired`, donc « rien n'est parti » établi). Le quota passe après la reprise (interroger un conteneur ne consomme pas de quota). `pnpm --filter worker test` → **25/25** (22 avant), dont « grâce dépassée MAIS job démarré => on interroge le conteneur d'abord » et « … + conteneur en erreur => dead_letter APRÈS vérification ». |
| P3-2 | Porter l'ancre d'idempotence sur `content_targets` | ✅ | `e96b031` | **Modélisation : ancre DÉDOUBLÉE, pas déplacée.** `publish_jobs.publish_started_at` reste la trace d'exécution (jetable) ; `content_targets.publish_started_at` + `external_container_id` deviennent l'ancre de DÉCISION (durable). Le moteur lit `effectiveAnchor = coalesce(cible, job)` — `coalesce` et pas `&&`, c'est un job NEUF sur cible ANCRÉE qu'il faut arrêter. Migration 023 : 2 colonnes + backfill + 2 triggers (`authenticated` ne pose, ne déplace, n'efface jamais l'ancre, et ne supprime pas une cible ancrée — `reconcileTargets` fait un delete-all dès qu'un contenu repasse en draft, et `failed → draft` est légal). `markPublishStarted` écrit les deux ancres dans UNE transaction. tsc 0 ; worker **27/27** ; pgTAP 023 **10 ok / 0 not ok**. |
| P3-3 | Statut terminal `needs_verification`, distinct de `failed` | ✅ | `9aa45ed` | **Modélisation : ajouté aux TROIS enums** (`publish_job_status`, `target_status`, `content_status`) — le mensonge existait aux trois niveaux. Sur l'agrégat l'issue inconnue **domine** : sans ça `recomputeParent` laissait le contenu figé en `publishing`, statut sans sortie (016). Posé par une règle unique, `isOutcomeUnknown(job)` : l'ancre effective est-elle posée ? `deadLetter` reste sur `failed`, délibérément — depuis P3-1 il n'est appelé que quand l'issue est CONNUE. Sortie humaine : `mark_target_published_manually` accepte `needs_verification` ; `request_target_retry` non (c'est toute la différence). **Piège maison** : 4 ruptures trouvées par tsc (`contentStatusMeta`, `targetStatusMeta`, `STATUS_TRANSITIONS`, `kanbanColumnOf` + `priorityRank`) **et 7 listes `ContentStatus[]` que le typage ne protège pas**, cherchées à la main. worker **29/29** ; pgTAP 024 **9 ok / 0 not ok**. |
| P3-4 | `enqueue_publish_jobs` ne ré-enfile plus `failed` ni `pushed_to_platform` | ✅ | `e2e8a73` | **Le critère retenu n'est pas le statut, c'est l'ANCRE.** Exclure `failed` en bloc aurait été une régression : la majorité des échecs réels n'ont rien envoyé et leur relance est le geste normal (le seul, `request_target_retry` restant un cul-de-sac). Donc : `failed` **sans** ancre → ré-enfilable ; `failed` **avec** ancre, `pushed_to_platform`, `needs_verification` → jamais. Filtre symétrique sur le passage en `queued`. pgTAP 025 **7 ok / 0 not ok** (dont « cible failed ANCREE : aucun job cree » et « cible failed SANS ancre : ENFILEE »), 020b non-régression 4/4. |
| P3-5 | Fencing `worker_id` sur les écritures d'état | ✅ | `4798080` | Les **9** écritures portent `and worker_id = $n and status in ('claimed','publishing')` et testent `rowCount` → `LeaseLostError`. Traitée à part de toutes les autres erreurs : `handleError` la **remonte sans écrire** (poser `failed` sur le job d'un autre worker serait le dommage même qu'on évite). `extendLease` prolongeait le lease de n'importe quel propriétaire — c'était ce qui laissait un zombie survivre à sa propre expiration ; il renvoie `false` et le heartbeat s'arrête net. `succeed` est fencé aussi : le post est en ligne mais le propriétaire courant reclaimera, trouvera la cible ancrée et conclura. `grep -c assertOwned` → **9** ; worker **30/30**, dont « lease perdu avant publish => AUCUNE publication, et aucun statut écrasé ». |
| P3-6 | Timeouts HTTP + heartbeat qui ne masque plus le reaper | ✅ | `a848ffc` | Deux bornes distinctes : `WORKER_HTTP_TIMEOUT_MS` (60 s) sur les 5 appels plateforme, `WORKER_MAX_PROCESSING_MS` (10 min) au-delà duquel le heartbeat **cesse de prolonger** — il prolongeait sans borne, donc `lease_expires_at` ne passait jamais dans le passé et le reaper ne voyait rien. `PublishContext.signal` posé pour la phase 6 (une course de promesses rend la main, elle n'annule pas la requête). Timeout classé **transitoire** délibérément : il ne dit pas que rien n'est parti. worker **32/32**. Les 2 variables sont documentées dans le runbook. |
| P3-7 | Le reaper terminalise les jobs à bout de tentatives | ✅ | `378f63e` | La clause `attempts < max_attempts` les laissait `claimed` **à vie** ; le commentaire renvoyait « au watchdog pg_cron », qui n'existe pas. Double conséquence : l'index unique partiel gelait la cible (impubliable définitivement) et le contenu restait en `publishing`, statut d'où 016 n'autorise rien. Seconde passe → `dead_letter` (ancre nulle) ou `needs_verification` (ancre posée). `reapExpired()` renvoie `{requeued, terminalized}` — confondre les deux rendrait le second invisible. pgTAP **092** (renommé depuis 026) **5 ok / 0 not ok**. ⚠ **Limite** : ce test prouve le mécanisme de schéma, pas le TypeScript du reaper — aucune base n'est joignable depuis l'hôte (conteneur sans mapping de port), donc `PgJobStore` n'est exécuté par aucun test. |
| P3-8 | FK `content_target_id` en `restrict` | ⚠️ **fait autrement** | `549a66d` | **La bascule demandée n'est PAS appliquée, et c'est délibéré.** Son motif (« supprimer une cible efface l'ancre ») a été traité à la source par 023 : l'ancre vit sur `content_targets` et un `before delete` la protège déjà. `restrict` ne fermerait donc plus rien mais **casserait** `reconcileTargets` : `cancel_publish_jobs` passe les jobs `canceled` sans les supprimer, donc le DELETE lèverait 23503, l'INSERT suivant serait rejeté par `content_targets_item_account_idx`, et les modifications de ciblage seraient **perdues en silence**. Mesuré dans `ocean_rev2` sur le schéma réel : org member + cible non ancrée + job `canceled` → `DELETE 1`, jobs restants 0. À la place, la garde de 023 est étendue au cas résiduel (ancre portée par un JOB seul). La bascule est fournie **en commentaire** dans `deploy/22_migration_026.sql`, avec sa condition (P5-3 d'abord). pgTAP 026 **3 ok / 0 not ok**. |
| P3-9 | `cancel_publish_jobs` couvre le statut `claimed` | ✅ | `9e970bf` | + `claimed` et `awaiting_media`, lease explicitement relâché. **C'est le fencing de P3-5 qui rend l'annulation effective** : `markPublishStarted` exige `status in ('claimed','publishing')`, donc un job passé `canceled` fait échouer la dernière écriture AVANT publication → `LeaseLostError` → arrêt sans publier. P3-5 est le prérequis dur, l'ordre de déploiement aussi. Règle 15 tenue : les DEUX ancres sont testées. En prime : la cible repasse `queued → pending` (elle restait `queued` à vie). pgTAP 027 **6 ok / 0 not ok**. |
| P3-10 | Quota : compteur local + `deferForQuota` corrigé | ✅ | `76c4508` | `checkQuota` renvoyait `true` **en dur dans les deux branches**. Moitié locale implémentée : `ig_publish` 100/24 h, `tt_draft` 5/24 h. **`facebook` est `null`, pas un chiffre** : le BUC dépend de l'engagement de la Page, un plafond inventé serait soit trop bas soit inutile — le worker le journalise au lieu de faire semblant. L'appel distant est un emplacement nommé dans `createQuotaChecker`, pas un TODO flottant. **Le report** : `deferForQuota` repoussait de 60 s sans toucher `run_at`, or la fenêtre de grâce se mesure dessus → dead_letter en 2 h. Le verdict dit désormais QUAND réessayer (calculé sur `window_resets_at`) et `run_at` est décalé — reporter, c'est redater. Piège fermé : fenêtre absente ou échue = réouverture (une ligne `used=100` sans reset aurait bloqué le compte à vie). Compteur incrémenté dans la transaction de `succeed`. worker **40/40**, dont 7 sur `decideQuota`. ⚠ Le SQL (`bumpQuotaUsage`, lecture du compteur) n'est exécuté par aucun test. ⚠ La notification du décalage (§5) n'existe toujours pas. |

**Critère de sortie — atteint.** Les quatre chemins de double publication ont chacun leur test dans
`apps/worker/src/engine.test.ts` : ① grâce dépassée sur job démarré, ② job neuf sur cible ancrée,
③ ré-enfilement d'une cible finie (pgTAP 025), ④ lease perdu avant publish.
`pnpm --filter worker test` → **40/40**.

### Phase 4 — Synchroniser l'app et la file · 1 session

**Pourquoi** : le lien entre ce que l'app affiche et ce que le worker exécutera ne tient qu'à deux
appels manuels. Mettre un contenu à la corbeille ne le déprogramme pas — il partira quand même.
Le re-dater depuis le composer ne réaligne pas `run_at` — il partira à l'ancienne heure.

- Un helper unique `syncPublishQueue(contentId)` appelé par **toute** action qui touche
  `scheduled_at` ou le statut, plus un trigger `AFTER UPDATE` en filet.
- Porter `clients.approval_mode` dans le trigger de transition de statut : il n'est lu **nulle part**
  aujourd'hui — aucune policy, aucun trigger. La promesse « pas de publication sans approbation »
  n'est appliquée par rien.
- Arrêter le fire-and-forget sur l'enfilement (ni l'erreur ni le compte retourné ne sont lus).

**Critère de sortie** : un test pgTAP prouve qu'un contenu corbeillé, dé-programmé ou re-daté n'a
plus aucun job vivant incohérent.

#### Tickets — suivi d'exécution

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| P4-1 | Helper unique `syncPublishQueue(contentId)` sur tous les call sites | ✅ | `4996d4d` | Les 4 chemins vérifiés et corrigés : `trashContent` (le claim ne joint jamais `content_items`, `deleted_at` n'existe nulle part dans `apps/worker` → le contenu supprimé partait, et le bouton s'intitule « annuler la programmation »), `saveContentItem` (`scheduled_at` est dans `baseFields`, appliqué à TOUS les statuts), le retrait de date, et `markTargetPublishedManually`. **Le fond n'était pas les 4 oublis mais la forme** : chaque appelant devait CHOISIR entre enfiler et annuler. Ici personne ne choisit — on relit l'état réel et on en déduit. Invariant : jobs vivants ⟺ `scheduled` + daté + non supprimé. **La publication manuelle est traitée en SQL (028)** : `cancel_publish_jobs` est scopée au CONTENU, l'appeler après une publication manuelle TikTok annulerait aussi Instagram et Facebook — on remplacerait un doublon par des publications manquantes. pgTAP 028 **5 ok / 0 not ok** ; 016 non-régression **19/19**. |
| P4-2 | Trigger `AFTER UPDATE` en filet | ✅ | `1aec7f0` | Ferme la direction **dangereuse** (job de trop, ou à la mauvaise heure) ; **n'enfile jamais** — l'absence de job est visible et traitée par P4-4, un job de trop part chez un vrai client sans que personne le voie. **Piège évité** : « annuler dès que le statut n'est plus `scheduled` » aurait été destructeur — `markPublishStarted` passe le contenu en `publishing`, donc les jobs des AUTRES cibles d'un contenu multi-plateformes auraient été annulés au moment même où la première publie. Le trigger n'annule que sur les statuts posables par l'app. pgTAP 029 **8 ok / 0 not ok**. |
| P4-3 | Porter `clients.approval_mode` dans le trigger de transition | ✅ | `68ecb03` | Deux subtilités font toute la valeur : le **RÔLE** (`decided_by_role = 'reviewer'` — sans lui, l'auto-approbation de l'agence satisferait une garde censée protéger le client d'elle) et la **PÉREMPTION** (`approval_stale`, posé par 013 et lu par personne : une approbation portant sur un texte réécrit n'en est pas une). `optional` n'impose rien (aucun drapeau par contenu dans le schéma), `auto` non plus (c'est le sens du mode). ⚠ **Correction au ticket** : le défaut de la colonne est `'optional'` (004:8), **pas** `'required'` — les clients existants ne sont pas bloqués. ⚠ Changement visible : chez un client `required` le drag « Brouillon → Programmé » lève 42501 ; l'action rend `CLIENT_APPROVAL_REQUIRED` / `_STALE` au lieu d'un message Postgres brut, **mais griser le geste dans le kanban reste à faire**. pgTAP 030 **8 ok / 0 not ok**. |
| P4-4 | Arrêter le fire-and-forget sur l'enfilement | ✅ | `47b814b` | Le commentaire justifiait l'omission par « le watchdog rattrapera » : il n'existe pas. **La question à poser n'est pas « zéro job ? »** — un contenu 100 % manuel n'en a légitimement aucun ; on demande s'il existe une cible qui AURAIT DÛ être enfilée. Si oui → `SCHEDULED_WITHOUT_JOB`, journalisé et remonté. On ne défait ni la transition ni la date (légales, déjà persistées) : on refuse seulement de les annoncer comme un succès. `pnpm -w build` ✅. |
| P4-5 | Borne serveur sur `scheduled_at` | ✅ | `00d4f5e` | Dangereux **des deux côtés** : passé de moins de 2 h → dans la fenêtre de grâce, publication immédiate ; au-delà → `dead_letter` à la naissance. `check (scheduled_at >= now())` est impossible (`now()` non immutable) **et serait faux** : réévalué à chaque UPDATE, il rendrait immodifiable un contenu légitimement en retard. La règle exacte est donc « on refuse de POSER une date passée, pas d'en AVOIR une ». Tolérance 2 min. pgTAP 031 **6 ok / 0 not ok**. |

**Critère de sortie — atteint.** `supabase/tests/029_publish_queue_safety_net.test.sql` exerce les trois
cas par des **UPDATE nus** sur `content_items`, sans passer par le code applicatif — exactement ce que
ferait une surface d'édition qui aurait oublié le helper. Corbeillé, dé-programmé, re-daté : **8 ok / 0 not ok**.

### Phase 5 — Faire entrer les médias · 2 sessions — ✅ **CLOSE le 17/08/2026**

**Pourquoi ici** : Instagram et Facebook refusent tout post sans média. Au 16/08 il n'existait
**aucun chemin d'upload** — zéro `<input type="file">` dans les 425 fichiers de `apps/web`, la
drop-zone était un bouton décoratif, et `recordUploadedAsset` (complète, validée) n'avait aucun
appelant. Sans cette phase, la phase 6 ne pouvait pas atteindre son critère de sortie.

> **État au 17/08** : les trois sont levés. Le transfert existe (TUS, tranches de 6 Mio), la
> conversion HEIC/PNG → JPEG et la vignette WebP existent, la zone de dépôt est réelle aux deux
> surfaces, et le recadrage traite désormais l'image. **La phase 6 (publishers réels) n'est plus
> bloquée en amont.**

- **D'abord** : `next.config.ts` n'autorise que `images.pexels.com` — à dériver de l'URL Supabase.
  Une ligne, mais elle doit précéder le reste, sinon on débugge deux choses à la fois.
- Upload TUS (chunks 6 Mo) → `media-originals` privé, chemin `{org}/{client}/…`.
- Conversion JPEG/HEIC + vignette WebP ~400 px → `media-thumbs`.
- `applyCrop` réécrit aujourd'hui les dimensions et le poids **sans traiter l'image** : le preflight
  valide des valeurs fabriquées.
- Corriger la destruction des médias : rouvrir un brouillon et l'enregistrer détache **tous** ses
  médias et supprime en cascade **les annotations du client**. Deux lignes à ajouter.

**Critère de sortie** : une photo envoyée depuis l'iPhone s'affiche dans la grille, le studio **et**
le portail client.

#### Tickets — suivi d'exécution

> **Phase 5 close le 17/08/2026.** Le critère de sortie est atteint et vérifié par exécution : une
> photo HEIC d'iPhone déposée depuis le navigateur arrive en JPEG conforme aux specs Instagram dans
> `media-originals`, avec sa vignette WebP dans `media-thumbs`, et s'affiche dans la médiathèque, le
> studio et le portail client. Voir la ligne « Critère de sortie » ci-dessous.
>
> Branche `chore/phase-0-outillage`, **non poussée**. **Aucune écriture sur le projet Supabase en
> ligne** — et ce lot n'a demandé **aucune** migration : le ledger reste à 34 lignes.

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| P5-1 | `next.config.ts` : dériver l'hôte de l'URL Supabase | ✅ | `c28f77d` | **Le piège était bien là.** Dériver naïvement de `NEXT_PUBLIC_SUPABASE_URL` aurait donné le bon hôte EN LOCAL (Next charge `.env.local` avant d'évaluer `next.config.ts`) et `undefined` EN CONTENEUR — le Dockerfile ne passait aucun build arg. Deux niveaux : `SUPABASE_URL` au build (nouvel `ARG`) → motif exact ; sinon `*.supabase.co`. `search` volontairement non spécifié (les URL signées portent leur jeton en query string ; `search: ''` les rejetterait toutes). **Preuve mesurée sur `.next/required-server-files.json`**, la config réellement embarquée, pour les 3 chemins — sans `.env.local` ni ARG : `*.supabase.co` ; avec l'ARG : `exemple-projet.supabase.co` ; build local : `hgdeopkmkwyoumsfggrm.supabase.co`. |
| P5-2 | Rouvrir un brouillon détache tous ses médias | ✅ | `a69808d` | Chaîne vérifiée de bout en bout, l'hypothèse de l'audit est **confirmée** : `draftFromContent` ne pose aucun `libraryAssetId` → `handleSave` filtre tout → `reconcileMedia` fait son `delete()` puis sort sur un tableau vide. **Ce que l'audit ne disait pas** : `content_comments.annotation_content_media_id` porte `ON DELETE CASCADE` (013:138), donc la suppression efface la **ligne de commentaire entière**, pas seulement l'ancre — un « rouvrir + enregistrer » détruisait le retour de validation annoté du client. Correctif : une ligne, `libraryAssetId: m.id` (l'id de l'ASSET, cf. content-media.ts:118). ⚠ Vu, non corrigé : `crop_preset` n'est pas remonté non plus (absent d'`ASSET_COLUMNS`). |
| P5-3 | Les 3 `reconcile*` ignorent leurs 8 erreurs ; passer au diff | ✅ | `826cd84` | Les 8 écritures sont lues, le premier échec interrompt et remonte. Diff par clé d'identité : compte social / plateforme pour les cibles, **(asset, n-ième occurrence)** pour les médias (`content_media` n'a volontairement pas de `unique(content_item_id, media_asset_id)`, 012:111), id pour les étiquettes. **L'ordre des opérations sur les médias n'est pas décoratif** : supprimer d'abord (sinon le trigger de cardinalité refuse le remplaçant), insérer au-delà de la position max (le `unique(position)` est deferrable mais chaque requête PostgREST est sa propre transaction), puis `reorder_content_media` — la RPC de 012 qui écrit toutes les positions en UNE transaction et **n'avait aucun appelant**. Bénéfice principal : les cibles conservées gardent statut, `external_post_id`, permalien et ancre ; les liaisons médias gardent leur id, donc les annotations. `content.ts` passe de 557 à 457 lignes, 2 modules de 197 et 127. ⚠ Toujours **pas d'atomicité** : la vraie réponse reste une RPC `save_content_item(payload jsonb)`. |
| P5-4 | `applyCrop` réécrit les dimensions sans traiter l'image | ✅ | `ddf1f8d` | Il réécrivait `width`, `height`, `mimeType` et `fileSizeMb` — **exactement les 4 champs que valide le preflight**. Un clic sur « 4:5 » faisait passer au vert un PNG de 12 Mo en 3:4 : le preflight ne validait plus le fichier, il validait le clic. Le mensonge se payait au pire endroit — Meta rejette le fichier réel, erreur permanente, `failed` direct sans retry, sur le compte d'un vrai client. Désormais il pose `crop`, rien d'autre. Conséquence assumée : recadrer ne fait plus disparaître l'avertissement de ratio — c'est honnête, rien n'est recadré. `CROP_PRESETS` → `CROP_TARGET_SIZES` (le nom disait « voici les dimensions », il dit « voici les dimensions à PRODUIRE » : c'est la confusion qui a créé le bug). |
| P5-8 | Brancher les Server Actions médias sans appelant | ✅ | `5df08c0` | `useLibraryAssets` ne touchait qu'un `useState`, et `updateAltText` affichait quand même « Texte alternatif enregistré ». Rien ne partait en base. **Deux mensonges superposés** — `library-workspace` affichait en plus son propre toast de succès AVANT d'appeler le hook ; retirés, le hook est seul à rendre compte. `useOptimistic` : si l'écriture échoue, l'affichage revient tout seul à la vérité du serveur. Suppressions envoyées asset par asset, refus comptés. Les libellés disaient « (aperçu) » — vestige de l'ère mockée, devenu faux. ⚠ `recordUploadedAsset` et `attachMedia` restent sans appelant (dépendent de l'upload). |
| P5-10 | Le Reviewer ne peut pas obtenir d'URL signée | ✅ | `d9f6035` + `36cf8db` | Les policies de `media-originals` sont gardées par `can_write_client_media` → `is_org_member`, et un Reviewer n'est **pas** membre de l'org (règle 6) : `createSignedUrls` ne lui rendait rien, `fullUrl` retombait en silence sur la vignette — **le client approuvait sur 400 px**. Un seul prédicat servait à la LECTURE et à l'ÉCRITURE. La voie reviewer est le miroir exact de `media_assets_select` (012:312) ; `is_client_member` **seul** aurait ouvert tous les médias du client, brouillons compris (test 7). ⚠ **`36cf8db` corrige `d9f6035`** : la 1re version lisait le média au segment [4] du chemin, or `media_asset_id` est généré par l'INSERT — sans cette correction la branche n'aurait jamais matché, et P5-10 aurait été « corrigé » sans rien corriger, 9 tests au vert à l'appui. Résolution par `media_assets.storage_path` (index UNIQUE, 012:65). pgTAP 033 **9/9**. |
| P5-11 | Le portail rend un `<Image>` pour une vidéo | ✅ | `52531d1` | **Zéro `<video>` dans `apps/web`.** Les 5 surfaces plein cadre rendaient un `<Image src={fullUrl}>` même pour une vidéo : `next/image` ne décode pas un MP4, le cadre restait vide sous un badge « Vidéo ». **Le client approuvait un Reel qu'il n'avait jamais vu.** Composant `MediaFrame` ; `playsInline` (sans lui iOS force le plein écran, l'iPhone est la cible prioritaire) et `preload="metadata"` (un Reel monte à 300 Mo). La vignette reste une image, délibérément. |
| P5-5 | `lib/media/` + upload TUS | ⚠️ **partiel** | `36cf8db` | **Fait** : `lib/media/paths.ts` fixe la convention en un seul endroit, 9 tests. La divergence avec CLAUDE.md §21 y est écrite : `{org}/{client}/{content_item}/{media_asset}/` **n'est pas applicable** (ni l'asset ni le contenu ne sont connus au téléversement) ; convention retenue `{org}/{client}/{upload_key}/{fichier}`. Test clé : un nom contenant `../` ne peut pas injecter de segment — un segment de plus décalerait `foldername()[1]`/`[2]`, donc l'isolation de tenant. **Ajouté le 16/08** (`828c24b`) : le recoupement chemin/tenant est enfin **branché**. `recordUploadedAsset` insérait `storage_path` tel quel — or ce chemin vient du navigateur, `requireClientInOrg` valide le CLIENT et jamais le CHEMIN, et **aucune contrainte ni aucun trigger ne relie `storage_path` à `org_id`/`client_id` en base**. Une ligne `media_assets` pouvait donc désigner le préfixe d'un AUTRE tenant, ce que la voie reviewer de la 033 résout justement PAR `storage_path` ; la seule barrière restante était l'index unique global, qui protège en effet de bord de la déduplication et n'a jamais été conçu comme frontière de tenant. La fonction faite pour ce recoupement existait, était testée, et n'était importée par **aucun** fichier de production. La décision est isolée dans `pathBelongsTo` plutôt qu'écrite dans l'action, parce qu'une Server Action n'est pas atteignable par la suite de tests : dans l'action, la garde aurait été vraie *par lecture* et non *par exécution*. La vignette est vérifiée aussi (bucket **public** : un chemin mal rangé y est lisible sans URL signée). **Mutation** : remplacer la comparaison exacte par un `startsWith` fait tomber la propriété. **NON fait** : le transfert lui-même. |
| P5-0 | **Débloquer l'environnement** (prérequis des trois suivants) | ✅ | `c4bce51` | **C'est ce qui bloquait la session du 15/08.** `supabase/config.toml` déclarait les ports par défaut, tenus par le stack de `preventionelectrique` qu'il est interdit de tuer. Décalage vers le bloc **544xx**, vérifié libre (aucun conteneur ne le mappe, rien en écoute). ⚠ Le point qui casse si on l'oublie : `.github/workflows/ci.yml` portait le port **en dur** — les deux sont modifiés ensemble, et aucune autre référence ne subsiste (les `54322` des tests du worker sont des chaînes d'exemple, `isLocalDatabaseUrl` ne regarde que le nom d'hôte). CLI en `npx supabase@latest` (2.114.0), pas d'installation globale. **Vérifié par exécution** : `supabase start` monte sans collision, **34 migrations appliquées** (001→034), le stack de l'autre projet reste *healthy*, les buckets `media-originals` (privé) et `media-thumbs` (public) sont là, et `supabase test db` — **chemin exact du job `db` de la CI** — rend `Files=32, Tests=348, Result: PASS`. Ce chemin de CI n'avait **jamais** été exercé. |
| P5-6a | Client d'upload TUS (tranches de 6 Mio, reprise, progression, annulation) | ✅ | `7fdb632` | **L'ORDRE INSERT/TRANSFERT EST TRANCHÉ : transfert d'abord, INSERT ensuite**, chemin porté par une clé d'upload tirée côté client. Motif : les deux modes de défaillance ne se valent pas. INSERT d'abord ⇒ toute coupure laisse une ligne `media_assets` désignant un objet inexistant — visible dans la médiathèque, cadre vide dans le studio et le portail, et il faut inventer un état « en attente » plus un balayeur. Transfert d'abord ⇒ au pire un objet Storage sans ligne : invisible pour l'app, et c'est exactement ce que `media-cleanup` (règle 23) balaie. **Un déchet invisible contre un mensonge visible.** C'est aussi le sens que `paths.ts` fixe depuis P5-5 et que la 033 suppose (résolution par `storage_path`, pas par un segment). `tus-js-client` écarté **délibérément** : il n'est pas exécutable sous `node --test`, seul harnais de `apps/web` ; un client à `fetch` injectable l'est. La règle qui porte tout : **l'offset vient toujours du SERVEUR** — repartir de `offset + 6 Mio` après une coupure écrirait un trou de 4 Mio, donc un JPEG corrompu, donc un rejet Meta permanent (`failed` direct, règle 18) chez un vrai client. Le serveur TUS factice du test STOCKE les octets : les assertions portent sur `Buffer.compare` à zéro, pas sur un compte d'appels. web 47 → **56/56**. **Mutation** : `offset = resync` → `offset + TUS_CHUNK_SIZE` sur les 2 sites fait tomber **2 tests**. |
| P5-6b / P5-6c | Conversion HEIC/PNG → JPEG, vignette WebP ~400 px | ✅ | `2709054` | **Découpage décide/exécute** : `image-plan.ts` (pur, testé) vs `image.ts`/`video.ts` (canvas, non atteignables par les tests). Une règle écrite dans le composant qui l'applique est vraie « par lecture » — le motif des trois faux positifs de la semaine. **Ce que les propriétés ont trouvé** : sur un balayage de 12 formes réelles, un `Math.round` symétrique des dimensions de recadrage peut rendre un ratio **inférieur** à la cible ; sur 4:5, qui est exactement `IG_IMAGE_RATIO.min`, ça veut dire produire — **en recadrant pour se conformer** — une image que Meta refuse. Corrigé **par construction** (arrondi directionnel `ceil`/`floor`), pas en relâchant l'assertion : l'invariant dit « jamais sous la cible », pas « proche de la cible ». Quatre décisions : (1) `isHeic` regarde aussi l'**extension** — iOS livre régulièrement `File.type` **vide** ; (2) `imageOrientation: "from-image"`, sans quoi toutes les photos verticales arrivent couchées ; (3) descente en poids **bornée** à 7 essais (qualité d'abord, dimensions ensuite) — une boucle « tant que trop gros » sur mobile est un gel d'interface ; (4) le plafond de la **source** (100 Mo) n'est pas celui d'Instagram (8 Mo, appliqué à la **sortie**) — les confondre refuserait des HEIC parfaitement valides. La vidéo est **mesurée, jamais transcodée** : sans `width`/`height`/`duration_ms`, tout Reel passerait le preflight jusqu'au refus de Meta. web 56 → **72/72**. **Mutation** : `Math.round` des deux côtés fait tomber la propriété du rectangle. |
| P5-7 / P5-8b / P5-9 | Zone de dépôt réelle, câblage des Server Actions, recadrage appliqué | ✅ | `1e4bd1b` | **P5-7** : `MediaDropzone` est un `<label>` lié à un `<input type="file">` — un `<button>` n'aurait été la cible d'accessibilité de rien. Détail qui se paie sinon : `e.target.value = ""` après chaque sélection, sans quoi **redéposer le même fichier après un échec** n'émet aucun `change` et l'écran paraît figé. Posée aux DEUX endroits : médiathèque et composer (état vide **et** sous la bande de slides). **P5-8b** : `recordUploadedAsset` a enfin un appelant ; file **séquentielle** (un bitmap 12 Mpx ≈ 48 Mo, trois en vol font tomber un onglet mobile ; et 3 transferts concurrents sur réseau mobile ne vont pas plus vite, ils rendent les barres menteuses). `orgId` descend du serveur : falsifié, il est refusé **deux fois** (policy `can_write_client_media` + `pathBelongsTo`). 10 messages d'échec distincts FR/EN — `MediaDecodeError` porte un **code**, pas une chaîne libre. **P5-9** : le recadrage relit l'original signé, le décode, le rogne, le réencode et le **retéléverse comme un nouvel asset** ; l'original reste intact. `mediaFromUpload` renseigne dimensions/poids/mime avec des valeurs **mesurées** sur le fichier produit — c'est ce qui distingue ce ticket de la version que P5-4 avait retirée. |
| **Critère de sortie** | **Un fichier réellement transféré** | ✅ | `ce8362e` | **3 fichiers déposés depuis le navigateur, 6 objets créés dans le Storage local.** ① HEIC iPhone (2 994 394 o) → `IMG_iphone.jpg`, **image/jpeg, 3 992×2 992, ratio 1,334 ∈ [0,8 ; 1,91], 3,37 Mo ≤ 8 Mo**, octets de tête `ffd8ffe0`, relu et décodé par ffprobe (`mjpeg`, `yuvj420p`). ② PNG → JPEG 1 600×1 200. ③ MP4 de 15,21 Mio → **md5 identique à la source** (`b5b758385b69a79df6a5a04b41863584`), transféré en **3 PATCH TUS** (6 + 6 + 3,21 Mio) contre le vrai serveur Supabase. Chemins conformes : `{org}/{client}/{upload_key}/{fichier}`. 3 vignettes WebP dans `media-thumbs` (400×300 pour la photo, 5–38 Ko). Affiché dans la **médiathèque**, le **studio** et le **portail** — et dans le portail c'est bien l'**original signé** qui est rendu, pas la vignette 400 px (P5-10 tient sur un vrai fichier). Recadrage vérifié en base : `recadre-4x5.jpg`, **960×1200, ratio 0,800 exact**. Captures : `.planning/preuves/2026-08-17/`. ⚠ La **grille feed** n'a pas pu être exercée : `inFeed()` (grid/page.tsx:47) exige une cible **Instagram**, or aucun compte Meta n'est connecté en local — c'est la phase 8, hors périmètre. Aucun défaut média en cause. |
| ~~P5-6 / P5-7 / P5-9~~ *(ligne du 16/08, close par les 4 lignes ci-dessus)* | Conversion JPEG/HEIC, vignette WebP, vraie zone de dépôt, recadrage | ✅ **fait le 17/08** | — | **Le blocage a changé de nature : il n'est plus environnemental.** Le Storage local existe désormais et un octet PEUT être transféré. Ce qui reste est un chantier entier — client navigateur Supabase (`lib/supabase/client.ts` n'a toujours **aucun** importeur), TUS par tranches de 6 Mo, décodage HEIC, canvas de conversion JPEG, vignette WebP, zone de dépôt et sélecteur, câblage médiathèque **et** composer — que la session du 16/08 n'a pas eu la marge de livrer **et** de vérifier de bout en bout. Arrêté plutôt que livré à moitié : la règle « pas de code écrit mais jamais exécuté » vaut aussi quand l'excuse environnementale a disparu. **Reste vrai** : zéro `<input type="file">` dans le dépôt, la drop-zone est un `<button>` qui jette `e.dataTransfer`, et `recordUploadedAsset` n'a toujours aucun appelant — mais il est désormais **sûr** quand il en aura un (voir P5-5). |

#### État final des commandes de vérification (fin de session, 16/08/2026)

| Commande | Résultat |
|---|---|
| `pnpm -w build` | ✅ `Compiled successfully`, `/invitations` présente au manifeste |
| `pnpm --filter web exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter web test` | ✅ **47/47** (34 au début de session) |
| `pnpm --filter worker test` | ✅ **40/40** (inchangé — le worker n'a pas été touché) |
| `supabase test db` (chemin exact du job `db` de la CI) | ✅ **Files=32, Tests=348, Result: PASS** |
| Rejeu migrations + pgTAP (`ocean_rev2`, runner Docker) | ✅ **348 ok / 0 not ok** (338 au début, +10 pour la 034) |
| `pnpm check` — arbre **LF reconstruit depuis les blobs** | ⚠ **14 erreurs, 20 warnings, toutes préexistantes** — aucune dans un fichier de cette session |

> **Sur la mesure de `pnpm check`, qui est plus subtile qu'il n'y paraît.** Sur la copie de travail
> Windows, biome rend **286 erreurs** ; ce sont des artefacts CRLF (`core.autocrlf=true`, et le dépôt
> n'a **pas** de `.gitattributes`). Le protocole des sessions précédentes — `git archive` — **ne
> mesure pas ce qu'il prétend** : `git archive` applique lui aussi la conversion de fin de ligne, et
> l'arbre qu'il produit contient des CRLF (vérifié octet à octet), ce qui donne ici **476** erreurs.
> La seule mesure fidèle passe par les **blobs** (`git cat-file -p`), qui sont la vérité du dépôt et
> sont en LF pur : **14 erreurs**. Elles vivent dans `docs/superpowers/audits/*.json`,
> `.planning/i18n/lot3-workflow.js` et 7 composants `library`/`calendar`/`agenda`/`dashboard` —
> aucun fichier touché depuis. Le « exit 0 / 0 erreur » annoncé le 15/08 est donc à relire avec
> précaution : il a été mesuré avec la méthode `git archive`.

#### État final des commandes de vérification (fin de session, 17/08/2026 — LOT 1)

| Commande | Résultat |
|---|---|
| `pnpm -w build` | ✅ `Compiled successfully` |
| `pnpm --filter web exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter web test` | ✅ **72/72** (47 au début de session) |
| `pnpm --filter worker test` | ✅ **40/40** (inchangé — le worker n'a pas été touché) |
| `supabase test db` (chemin exact du job `db` de la CI) | ✅ **Files=32, Tests=348, Result: PASS** (inchangé — ce lot n'a demandé **aucune** migration) |
| `pnpm check` — arbre **LF reconstruit depuis les blobs** | ✅ **exit 0** — 472 fichiers, **0 erreur**, 20 warnings |

> ⚠ **Troisième désaccord de mesure sur `pnpm check`, et il faut le dire plutôt que le corriger en
> silence.** La ligne du 16/08 annonce **14 erreurs préexistantes**. Avec la **même méthode** (arbre
> reconstruit depuis les blobs, LF pur, `biome.json` copié à la racine) et la **même version**
> (`@biomejs/biome@2.4.16`), la mesure rend `exit 0`, **0 erreur, 20 warnings** — et elle rend
> *exactement la même chose* sur l'arbre du commit **`585e543`**, c'est-à-dire **avant** cette
> session. Les 14 erreurs ne sont donc reproductibles ni avant ni après : ce n'est pas un correctif
> apporté ici, c'est la mesure du 16/08 qui n'est pas rejouable. Détail probable : `biome.json`
> exclut `.planning` et `docs/superpowers`, où le 16/08 situait 12 des 14 erreurs.
> **Ne pas inscrire « 14 → 0 » comme un gain de cette session.**

#### Ce que le LOT 1 a vu et volontairement PAS touché

- **La grille feed reste invérifiable en local.** `inFeed()` (`grid/page.tsx:47`) exige une cible
  `instagram` ; sans compte Meta connecté, aucun contenu n'y apparaît, quel que soit son média. Rien
  à corriger côté médias — c'est la phase 8.
- **`lib/actions/notifications.ts`** : `biome check --write` y a corrigé un `import { type X }` en
  `import type { X }`. **Reverté** — hors périmètre.
- **Les libellés « (aperçu) » résiduels** de l'ère mockée (`library.sheet.crop`, `cropToastTitle`,
  `save`, `delete`, les toasts de programmation du composer). Seuls ceux que ce lot rendait faux ont
  été corrigés (`composer.media.emptyHint`, le toast de succès du dialogue de recadrage).
  ⚠ **`library.sheet.cropToastTitle` « Recadrage simulé (aperçu) » reste vrai** : le recadrage de la
  *médiathèque* n'est toujours pas branché, seul celui du *composer* l'est (P5-9).
- **L'orphelin de Storage est assumé** : si l'enregistrement échoue après le transfert, l'objet reste
  sans ligne. `media-originals` n'a volontairement aucune policy DELETE (règle 23), le navigateur ne
  peut donc pas nettoyer. C'est le prix — choisi — de l'ordre « transfert d'abord ».
- **`crop_preset` n'est toujours pas remonté** dans `draftFromContent` (réserve ouverte en P5-2).

> ⚠ **Ce qu'aucune vérification ne couvre** : `apps/worker/src/db/pg-store.ts` n'est exécuté par
> aucun test. Le conteneur `ocean_rev2` tourne sans mapping de port (WinNAT), donc aucune base n'est
> joignable depuis l'hôte. Les tests du moteur prouvent les **décisions** (règle 15, fencing, quota,
> issue inconnue) via un store factice ; le SQL qui les applique est relu, pas exécuté. Cela
> concerne P3-5, P3-7 et P3-10.

### Phase 6 — Publishers réels · 2 à 3 sessions

Reprend la session 3 du brief, désormais exécutable.

- Instagram d'abord (container puis `media_publish`, Reels, carrousels, alt text).
- Puis Facebook Pages. Puis TikTok en brouillon.
- Les quatre TODO du worker : refresh de token réel, URL signée 48 h du média, quota réel, rotation
  sous verrou.

**Critère de sortie** : un post réel, programmé la veille, apparaît sur le compte de test sans
aucune intervention — et le job correspondant est en `succeeded` avec son permalink.

#### Tickets — suivi d'exécution

> Exécution : branche `chore/phase-0-outillage`, session du 18/08/2026. **Non poussée.**
> **Aucune écriture sur `hgdeopkmkwyoumsfggrm`** — la migration 037 attend dans
> `deploy/33_migration_037.sql`, non appliquée.
>
> ⚠ **LE CRITÈRE DE SORTIE N'EST PAS ATTEINT, et il ne pouvait pas l'être.** Il n'existe ni app
> Meta ni identifiants. **Aucun octet n'a transité vers Meta ou TikTok, aucun post n'existe.** Ce
> lot livre le DIALOGUE, pas la preuve du dialogue : les trois publishers sont écrits et rejoués
> contre un transport HTTP injecté qui répond les formes documentées, erreurs comprises. Ce qui
> reste à prouver — que Meta accepte réellement ces requêtes — demande l'app Meta, et rien d'autre.

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| T1-1 | `media/signed-urls.ts` — l'URL signée 48 h | ✅ | `f93f484` | Le répertoire `apps/worker/src/media/` **n'existait pas**, alors que CLAUDE.md §4 le liste et que `PublishContext.mediaUrl` l'attendait : aucun publisher ne pouvait recevoir de média. Trois décisions écrites dans le code : **TTL 48 h long exprès** (5 tentatives avec backoff + 2 h de fenêtre de grâce + le temps que Meta télécharge un Reel — une URL de 15 min produirait un « média invalide », donc un `failed` sans retry, sur un fichier sain) ; **un carrousel signe chaque média**, et le signataire résout ses réponses **par chemin** et non par position (une inversion silencieuse publierait les slides dans le désordre) ; **les deux échecs sont séparés** — Storage 5xx/réseau = TRANSITOIRE (`StorageSignError` n'hérite PAS de `PermanentPublishError`), objet absent / `storage_path` nul / original purgé J+7 = PERMANENT. **Mutation** : faire hériter `StorageSignError` de `PermanentPublishError` → **2 tests tombent** ; résoudre par position → **le test du carrousel tombe**. 10 tests. |
| T1-2 | `context.ts` — token frais, compte cible, légende | ✅ | `f25dc95` | `prepare()` rendait `{ accessToken }` et rien d'autre ; `tokens/refresh.ts` (P8-4) existait **sans aucune de ses 4 dépendances**, donc **sans appelant** — le token n'était jamais rafraîchi. Quatre points : ① **le piège du lease** — le verrou n'est pas tenu pendant l'appel (refresh.ts est en 3 phases), le risque est qu'un fournisseur pendu fasse expirer le lease de 2 min, que le reaper rende le job et qu'un SECOND worker rafraîchisse le même compte : `WORKER_TOKEN_REFRESH_TIMEOUT_MS` = 15 s ; ② `needs_reauth` est fatal, `skip`/`abandonne` ne le sont pas (refuser de publier parce qu'un renouvellement PRÉVENTIF a échoué transforme une précaution en panne) ; ③ **les hashtags vivent à part en base** — publier `caption` seul amputait chaque post de ses hashtags, sans erreur ni trace ; ④ un compte `disconnected` (036) est permanent mais **PAS** `needs_reauth`. `redactSecrets` efface les valeurs envoyées avant qu'un corps d'erreur fournisseur n'entre dans une exception (Meta recopie l'URL appelée dans `error.message`, qui part dans `publish_jobs.last_error` affiché par l'app). **Mutations** : neutraliser `redactSecrets` → **2 tests** ; `composeCaption` sans hashtags → **3 tests** ; `disconnected` → `NeedsReauthError` → **1 test** ; refresh APRÈS la lecture du token → **1 test** ; retirer la borne de temps → le test du lease tombe (timeout à 4 s). worker 61 → 82. |
| LOT 2 | Instagram réel | ✅ | `1138b9e` | Stub de 4 lignes → publisher complet, **transport injecté** (`createInstagramPublisher({ fetch })`), `ctx.signal` transmis à **chaque** appel. **La classification des erreurs est le cœur du lot** (règle 18) : 190/102 → reconnexion, 4/17/32/613/1/2/341 → retry, 10/100/200/368 + sous-codes 2207xxx → permanent, **sauf 2207003** (Meta n'a pas su télécharger : souvent son réseau, et l'URL vit 48 h). Un code **inconnu est transitoire** — condamner le contenu d'un client sur une supposition n'est pas une décision qu'on a les moyens de prendre. **`FINISHED` n'est pas `PUBLISHED`** : `ContainerStatus` gagne `ready`, et toute la règle 15 tient sur cette distinction. Conséquence sur le moteur : porte de préparation dans `publishFresh`, **avant l'ancre** — IN_PROGRESS → `awaiting_media` (jamais un `sleep` : la file est séquentielle), PUBLISHED → on résout, ERROR/EXPIRED → nouveau `store.clearContainer` (le conteneur mort est persisté sur la CIBLE depuis 023 : sans cet oubli le job échouerait jusqu'à épuisement sur la même cause ; le SQL porte `publish_started_at is null` sur les deux lignes). Carrousel 2–10, enfants puis parent, légende sur le parent, `alt_text` jamais sur un reel. **Mutations** : code 4 en permanent → **3 tests** ; FINISHED → published → **1** ; `signal` non transmis → **2** ; retirer `clearContainer` → **1** ; retirer la porte → **1**. worker 82 → 118. |
| LOT 3 | Facebook Pages + TikTok brouillon | ✅ | `34199c9` | **Facebook** : photo téléversée `published=false` puis `/feed` — ce découpage **donne** au flux photo un conteneur au sens de la règle 15 (une étape réversible avant l'irréversible) ; reel en 3 temps avec upload `file_url` ; texte sans conteneur possible. **La question du moteur n'est pas la même selon l'état du job** — frais : « puis-je publier ? », reprise : « a-t-il déjà publié ? ». Instagram répond aux deux avec `status_code`, Facebook non : `page_story_id` est la preuve pour une photo, et un post **texte en reprise est INDÉCIDABLE** — on le dit, l'erreur permanente sur un job ancré produit `needs_verification` (024), ni doublon ni faux échec. **TikTok** : `createContainer` = INIT SEUL, `publish` = LE TRANSFERT. Mettre le transfert dans createContainer aurait rendu le brouillon visible **avant** l'ancre : un crash produirait un second brouillon et brûlerait 1 des 5 quotas/24 h. L'`upload_url` **n'est jamais persistée** (elle porte un jeton, et `external_container_id` est lisible par les membres de l'org — règle 11). Tranches : `floor`, la dernière absorbe le reliquat (un `ceil` produirait une tranche sous le minimum de 5 Mio) ; le `Range` est vérifié octet par octet — un Storage qui l'ignorerait ferait téléverser N fois le fichier entier et TikTok recevrait un fichier corrompu **sans qu'aucune erreur ne le signale**. **Mutations** : `ceil` → **2 tests** ; retirer le contrôle de tranche → **1** ; TikTok interroge `status/fetch` sur un job frais → **1** ; FB texte répond « ready » en reprise → **1** ; FB photo `published=true` → **1**. worker 118 → 147. |
| LOT 4 | Quota distant + `source = 'api'` | ✅ | `13b6e2d` | **Le fait contre-intuitif** : les deux plateformes ne répondent pas au même moment. IG a une sonde AVANT le post (`GET /content_publishing_limit`) ; FB **n'en a aucune** — son BUC arrive dans l'en-tête `X-Business-Use-Case-Usage` de chaque réponse, donc **en sortie**. Le publisher rend l'en-tête brut (`ctx.reportUsage`), le contexte l'interprète. ⚠ `call_count` est un **POURCENTAGE**, pas un nombre d'appels : le lire comme un compte afficherait « 28/4800 » là où Meta dit « 28 % » — faux d'un facteur ~170, et faux dans le sens qui ne protège de rien. Facebook a enfin un plafond enforçable (`FB_BUC_QUOTA` à 100) là où `LOCAL_QUOTAS.facebook` étant `null` le worker se contentait de journaliser. **Une sonde en panne ne bloque JAMAIS la publication** ; une réponse vide rend `null` et non `used = 0` (écrire zéro effacerait le compteur local). La fenêtre de la plateforme n'est pas repoussée à chaque relevé — la repousser gèlerait un compte au plafond pour toujours. **AUCUNE MIGRATION 037 N'ÉTAIT NÉCESSAIRE** pour `source` : `check (source in ('api','local'))` existe depuis 014:123 — et ce n'est pas une affirmation de lecture, le **test pgTAP 093** l'écrit réellement, plus `quota_kind = 'fb_buc'` qui n'avait jamais eu d'écrivain, plus une 4ᵉ assertion qui vérifie qu'une **troisième valeur est refusée** (sans elle, les précédentes ne prouveraient que l'existence de la colonne). **Mutations** : `call_count` avec limite 4800 → **1** ; ne plus rattraper l'échec de sonde → **1** ; retirer `FB_BUC_QUOTA` → **1** ; repousser la fenêtre → **1** ; pgTAP : source invalide → `'local'` → **« Failed test 4 », Result: FAIL**. worker 147 → 158 ; pgTAP 364 → 369. |
| LOT 5 | Lever le refus `live` sans ouvrir un trou | ✅ | `34199c9` | **Même commit que le LOT 3, à dessein** : vider `SIMULATED_PLATFORMS` sans poser au même instant le nouveau motif de refus aurait laissé, entre deux commits, un worker `live` qui démarre sans le moindre identifiant. Le motif « les publishers sont des stubs » est **éteint** ; à la place, refus si l'une des **six** variables manque, avec les noms **et la raison de chacune** (4 OAuth Meta/TikTok pour le refresh, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` pour signer les URL de média). Motif : un worker `live` sans identifiants démarre parfaitement et n'échoue qu'au **premier job, à 7 h du matin** sur le contenu d'un vrai client — le moment où l'erreur coûte le plus et se diagnostique le plus mal. `env.test.ts:69` est **réécrit**, pas supprimé : il vérifie la nouvelle raison. ⚠ **Ce que la garde ne prouve pas** : que les identifiants sont valides, qu'une app Meta existe, qu'un compte est connecté. Elle vérifie la présence, pas la vérité. **Mutation** : la garde cesse de vérifier les identifiants → **3 tests tombent**. |
| LOT 6 | Watchdog `pg_cron` + Edge Function | ✅ | `572a43a` | Tous les filets existants vivent **dans** le worker (reaper, heartbeat, compteur de ticks) et supposent qu'il tourne. Trois commentaires du dépôt renvoyaient déjà « au watchdog pg_cron », qui n'existait pas (P3-7, P4-4). Découpage décide/exécute : `private.late_publish_jobs()` en SQL pur (**9 tests pgTAP**), `public.watchdog_publish_jobs()` pour l'effet, Edge Function `watchdog-notify` pour l'envoi. **Les tests portent autant sur ce qu'il NE signale PAS** : 30 s de retard (un worker sain vide son lot), job `claimed` (c'est le cas du reaper — l'inclure ferait alerter sur chaque Reel un peu long), `next_attempt_at` futur (backoff normal), déjà alerté il y a 5 min (sans `watchdog_alerted_at`, 288 e-mails par jour sur le même job). Dégradation propre : sans les deux secrets Vault, la fonction marque, émet un `NOTICE` et rend le compte — un watchdog non configuré doit rester **silencieux et vert**. ⚠ **Migration NON appliquée** ; `deploy/33_migration_037.sql` vérifié **identique à sa source hors commentaires**. ⚠ **Aucun e-mail n'a jamais été envoyé** (`BREVO_API_KEY` absente). **Mutation** : retirer la clause de backoff → **2 tests tombent**. ⚠ **Mutation qui N'A PAS falsifié** : remplacer `revoke ... from public, anon, authenticated` par `revoke ... from public` seul laisse le test de baseline **au vert**. Le revoke explicite est conservé (021), mais cette assertion prouve l'invariant, pas que la clause explicite le fasse tenir. Écrit dans le commentaire du test. pgTAP 369 → 378. |
| — | Documentation d'exploitation | ✅ | `f38815b` | Les six variables du mode `live` ne figuraient dans **aucun** des trois documents d'exploitation : un opérateur suivant le runbook à la lettre aurait obtenu un conteneur qui refuse de partir. Runbook, `.env.local.example` et `Dockerfile` alignés. La section `live` du runbook disait « refusé jusqu'à la phase 6 » — périmé, remplacé par le nouveau motif **et sa limite**. |
| — | Lint | ✅ | `4b16429` | `biome check --write` sur `apps/worker/src`. Mesuré sur un arbre LF reconstruit **depuis les blobs** (pas `git archive`, qui mesure le mauvais référentiel — impasse notée au handoff). Restent 2 avertissements **préexistants** dans `db/pool.test.ts`, hors périmètre. |

#### État final des commandes de vérification (18/08/2026)

| Commande | Résultat |
|---|---|
| `pnpm -w build` | ✅ `Compiled successfully` |
| `pnpm --filter web exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter web test` | ✅ **124/124** (inchangé — `apps/web` n'a pas été touché) |
| `pnpm --filter worker test` | ✅ **158/158** (51 au début de session) |
| `npx supabase@latest db reset --no-seed` puis `test db` | ✅ **Files=36, Tests=378, Result: PASS** (34/364 au début) |
| `biome check` sur l'arbre LF reconstruit depuis les blobs | ✅ `apps/worker/src` : **0 erreur**, 2 avertissements préexistants |

#### Ce que la phase 6 n'a PAS couvert — la limite est énorme et connue d'avance

- **Aucun octet n'a transité vers Meta ou TikTok. Aucun post n'existe.** Tous les publishers sont
  vérifiés contre un **faux** Graph API. Ce que les tests prouvent : les décisions, les requêtes
  composées, la classification des erreurs. Ce qu'ils ne prouvent pas : que Meta accepte ces
  requêtes. Seule l'app Meta lèvera ce doute.
- **`PUBLISHERS_MODE=live` n'a jamais été exécuté** — ni en local, ni en conteneur, ni en
  production. Seule la garde de refus a été exercée.
- **`apps/worker/src/db/pg-store.ts` reste exécuté par aucun test** (limite héritée de P3-5/7/10,
  cf. la note de la phase 5). `clearContainer`, ajouté ici, est dans le même cas : son SQL est relu,
  pas exécuté. Le pgTAP prouve le schéma, jamais le TypeScript du store.
- **`connection-store.ts` (Vault, rotation) n'est exécuté par aucun test** : il demande une vraie
  base avec l'extension Vault et un secret réel. Ses appelants et sa logique de décision, eux, sont
  testés (`refresh.test.ts`, `exchange.test.ts`, `context.test.ts`).
- **Le premier commentaire Instagram n'est pas posté.** `ctx.firstComment` est résolu et transporté,
  aucun publisher ne l'utilise. Il faudrait un `POST /{media-id}/comments` après publication, donc
  une étape supplémentaire **après** l'irréversible — à traiter comme une opération distincte, pas
  comme une rallonge de `publish`.
- **Le report pour quota n'envoie aucune notification** (`publish-delayed`, §10) : la décision est
  prise et journalisée, le canal n'existe pas. Même chose pour `tiktok-draft-ready`.
- **Facebook : les Reels ne sont pas plafonnés à 30/24 h/Page.** Le sous-quota `fb_reels` existe dans
  l'enum et n'a toujours pas d'écrivain — il faudrait compter par FORMAT, et le BUC ne le distingue
  pas. Le plafond global (BUC à 100 %) est en place, celui-là non.
- **Le premier appel Facebook d'une fenêtre part sans connaître le BUC.** C'est structurel : l'en-tête
  n'arrive qu'en réponse. Ocean lit donc toujours le BUC de l'appel précédent.
- **La fenêtre PUBLISHED/FINISHED de Meta reste ouverte** : entre l'acceptation d'un `media_publish`
  et le passage du conteneur à PUBLISHED, un statut lu vaut encore FINISHED. C'est la raison d'être
  de `needs_verification` — on ne prétend pas trancher.
- **La migration 037 n'est pas appliquée** et `pg_cron` n'est **pas** activé sur le projet en ligne.
  Le pré-vol du fichier `deploy/` le dit : si `create extension pg_cron` échoue, tout le fichier
  échoue avec lui.

---

## PORTE C — Ne pas mentir au client


### Phase 7 — Portes d'entrée · 2 sessions

**Pourquoi** : le portail de validation, argument commercial central, n'ouvre **jamais** de session.
Et la même route est une prise de contrôle de compte : elle fabrique une session Supabase pour
n'importe quelle adresse email, sans preuve de possession.

- Corriger la faille de `/api/invitations/accept`.
- Faire que l'invitation ouvre réellement une session (les jetons arrivent dans un fragment
  d'URL que personne ne lit).
- Créer `/onboarding` (404 nu aujourd'hui pour tout compte sans organisation, donc tout Reviewer)
  et `/signup` (la fonction existe, sans aucune route qui l'appelle).
- Un point unique de résolution de rôle après connexion (`/dashboard` est en dur à trois endroits).
- Ré-invitation, révocation, retrait d'un `client_members`.

**Critère de sortie** : un vrai client reçoit un email, clique, arrive dans le portail, approuve un
contenu — sans intervention manuelle en base.

#### Tickets — suivi d'exécution

> Exécution : branche `chore/phase-0-outillage`, nuit du 15/08/2026. **Non poussée.**
> Aucune écriture en ligne après le BLOC 0.
>
> **`apps/web` n'avait AUCUN test** — ni vitest, ni jest, ni un seul fichier. Les correctifs de
> sécurité de cette phase n'auraient donc été prouvés par rien. Infrastructure ajoutée au ticket
> P7-1, sur le même idiome que le worker (`node --test` natif + `tsx`, zéro framework), avec un
> **job CI bloquant**. C'est ce qui rend les colonnes « Preuve » ci-dessous vérifiables.

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| P7-1 | ATO sur `/api/invitations/accept` | ✅ | `56422bd` | **Décision de conception : un jeton dit QUEL client rejoindre, jamais QUI le présente.** L'ancienne route résolvait le compte **par email** puis redirigeait le navigateur appelant vers `admin.generateLink({type:'magiclink'})` — elle fabriquait une session pour l'adresse invitée au profit de quiconque détenait le jeton. Or le jeton n'est pas détenu par l'invité : `inviteReviewer` le **retourne en clair** à son appelant, et `create_organization` est ouverte à tout `authenticated` (confirmé par les advisors). Trois gestes suffisaient. **Invariant retenu** : une adhésion n'est créée QUE si la requête porte déjà une session dont l'email est exactement celui de l'invitation ; aucun chemin ne fabrique de session. La primitive est **retirée, pas contournée** — `AcceptOutcome` n'a aucun membre capable de transporter un lien, `AcceptDeps` aucune capacité de ce type. La preuve de possession vient désormais d'un secret livré à la **boîte aux lettres**. **Test avant/après, mesuré** : comportement vulnérable temporairement restauré dans le module → **5 échecs / 6** (dont « jeton valide SANS session » qui rendait `accepted` et créait l'adhésion) ; après correctif → **6/6**. |
| P7-2 | L'invitation n'ouvre jamais de session, et le jeton est brûlé | ✅ | `56422bd` + `5b3c5ee` | Traité pour l'essentiel avec P7-1 : le jeton n'est **consommé qu'une fois l'adhésion réellement créée** (test « un jeton non consommé reste rejouable »). L'ancienne route le brûlait puis redirigeait vers un lien déposant ses jetons dans le **fragment** d'URL, illisible côté serveur : invitation consommée, session jamais ouverte, lien non rejouable. `5b3c5ee` ferme la moitié visible — la page de connexion n'affichait **aucun** des 5 paramètres d'état que le flux lui envoie. ⚠ **Dépendance hors code** : voir « Ce qui attend Étienne ». |
| P7-3 | `/onboarding` n'existe pas (404 nu) | ✅ | `052f1cb` | `getActiveOrg` (org-context.ts:79) y renvoie tout compte sans organisation — c'est le cas de **tout Reviewer par construction**. La page re-résout d'abord la destination (un Reviewer arrivé là file au portail au lieu de se voir proposer de créer une agence) et porte une sortie « ce n'est pas mon compte » : sans elle, quelqu'un invité sur la mauvaise adresse est piégé, sa seule issue étant de vider ses cookies. `pnpm -w build` : `/onboarding` présent au manifeste. |
| P7-4 | Aucune route `/signup` ; retour de `create_organization` non testé | ✅ | `052f1cb` + `6db7894` | **Fait** : la collision de slug n'est plus avalée. `signUpWithPassword` appelait la RPC sans lire son retour — deux « Marie Dupont » produisent le même slug, la seconde recevait un 23505 silencieux puis un 404. Candidats successifs, retry **uniquement** sur 23505. 6 tests sur `slugify`/`slugCandidates` (dont un cas corrigé **par** le test : « ç » se décompose en « c » sous NFD, le slug est donc `"c"` et non le repli — la première version du test attendait l'inverse). `6db7894` ferme la seconde moitié : la route `/signup` existe, plus trois points sans lesquels elle resterait inerte — ajoutée à `PUBLIC_EXACT` du proxy (sinon elle exigerait une session pour permettre d'en créer une), redirection vers le point de résolution de rôle si déjà connecté, et un lien depuis le formulaire de connexion. |
| P7-5 | Point unique de résolution de rôle | ✅ | `052f1cb` | `/dashboard` était en dur à **quatre** endroits (le proxy — qui **effaçait `next`** —, `signInWithPassword`, `signUpWithPassword`, `updatePassword`). Tous délèguent à `/auth/landing`. La règle vit dans `landing-rule.ts`, **séparé** de `landing.ts` parce que ce dernier importe `server-only`, qui rend le module inexécutable hors runtime Next donc intestable. Le proxy n'interroge pas la base (la doc Next l'exclut comme lieu d'autorisation). Ordre org > client > onboarding : en phase solo Étienne est owner **et** reviewer sur ses propres clients, l'agence prime. 5 tests. |
| P7-6 | Reviewer créé sans mot de passe ; `signInWithOtp` absent | ⛔ **non fait** | — | **Arbitrage produit — le brief interdit de trancher seul.** Voir « Décisions qui te reviennent ». Le correctif P7-1 est volontairement **neutre** sur ce point : il exige une preuve de possession sans imposer par quel canal, donc il ne présume pas de l'issue. |
| P7-7 | Invitation ratée = définitive (pas de révocation, pas de retrait) | ✅ | `bdde2c5` | **Quatre défauts qui se renforçaient** : l'index unique partiel ignore `expires_at` (une invitation périmée bloque la suivante à vie), `revoked_at` n'était écrit **nulle part** (la seule sortie de l'index était l'acceptation, c'est-à-dire le cas où tout va bien), aucune ré-invitation, aucun retrait de `client_members`. **Ce que je n'ai pas fait, délibérément** : « corriger » l'index en y ajoutant `expires_at > now()` — un prédicat d'index doit être IMMUTABLE et `now()` ne l'est pas ; surtout, « une seule invitation vivante par (client, adresse) » est un invariant à garder **dur**. Il reste intact, et la RPC retire explicitement l'ancienne ligne avant d'insérer. `invite_client_reviewer` supersède (l'ancien jeton meurt à l'instant) et refuse une adresse **déjà membre** ; `revoke_client_invitation` refuse une invitation **déjà acceptée** (ce n'est plus une invitation mais une adhésion — la révoquer ne retirerait rien tout en donnant l'illusion inverse) ; `remove_client_member` révoque **aussi** l'invitation vivante de la même adresse, sinon on retire d'un côté ce qu'un jeton non consommé permet de reprendre de l'autre. pgTAP 032 **14/14**, dont le test 1 qui prouve le défaut lui-même. Deux surprises trouvées **par** les tests : le `case` rend du `text` et pas l'enum, et le test ne peut pas filtrer sur `token_hash` — le grant colonne de 013 le cache à `authenticated`, c'est le grant qui fonctionne. |
| P7-8 | Open redirect sur `next` | ✅ | `0769db1` | `startsWith("/")` laissait passer `//evil.tld` — protocol-relative, résolu en `https://evil.tld`, **depuis une origine authentique et après une connexion réussie**. Mesuré sur l'ancienne validation : **6/6 entrées hostiles acceptées**. La règle n'énumère pas les formes dangereuses : résolution contre une origine sentinelle (`.invalid`, TLD réservé) et exigence d'origine identique ; le chemin est **reconstruit** depuis l'URL analysée. 8 tests, dont un invariant de sortie. |
| P7-9 | Le portail plante si la liste de clients est vide | ✅ | `8f8e338` | `ctx.clients[0] as Client` puis `client.timezone` → `TypeError`. **C'est le cast qui rendait le trou invisible au typage.** Atteignable en deux clics : la landing publique porte un lien « Voir le portail client », et tout compte sans ligne `client_members` tombe dessus — à commencer par le patron d'agence. Le layout gérait déjà le cas (`?? null`) ; seule la page supposait la liste non vide. État vide explicite qui dit quoi faire. |
| P7-10 | Le wizard jette le token puis affiche un succès | ✅ | `71eef5c` | Le retour d'`inviteReviewer` était jeté — il porte la **seule copie en clair** du jeton. Le wizard annonçait « Invitation enregistrée » sans jamais vérifier. **La situation devenait définitive** : l'index unique partiel sur `(client_id, lower(email))` tient tant que ni `accepted_at` ni `revoked_at` ne sont posés, donc toute ré-invitation échouait en `already_invited`, sans recours autre qu'un SQL à la main. `createClientAction` renvoie désormais un `CreateClientInvite` explicite (`none`/`created`/`failed`) et le wizard rend les trois cas, lien copiable inclus. Rétrocompatible (`data.id` inchangé). |

#### LOT 0 — Ce que la vérification adversariale a démoli (session du 16/08/2026)

> Rapport source : `_research/audits/2026-08-12/13-VERIF-phase7.md`. La passe a confirmé que
> **la prise de contrôle de compte P7-1 est réellement fermée** — primitive retirée du *type*,
> une quinzaine de variantes bloquées, test validé par mutation. `accept.ts` n'a **pas** été
> modifié dans ce lot ; la mutation a été rejouée en fin de session pour le vérifier :
> neutraliser la garde `sameAddress` fait tomber **2 tests sur 6**, dont le test ATO principal.
>
> Mais quatre choses ne tenaient pas. Branche `chore/phase-0-outillage`, **non poussée**.
> **Aucune écriture en ligne** : la migration 034 est écrite, testée et livrée dans `deploy/`,
> elle n'est **pas appliquée**.

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| V-1 | L'open redirect P7-8 n'était **pas** corrigé | ✅ | `b1950da` | **Le filtre était du mauvais côté du parser, et c'est le parser qui fabriquait la chaîne interdite.** `/..//evil.tld` n'a qu'une barre en tête : il passait la garde d'entrée. Le parser WHATWG repliait le `..` contre un chemin vide (sans effet) puis empilait le segment **vide** entre les deux barres, donc `url.pathname` valait `//evil.tld`. Le juge d'origine ne voyait rien : l'hôte est fixé par la base **avant** l'analyse du chemin. **Sortie réelle du module, avant** : `/..//evil.tld`, `/.//evil.tld`, `/%2e%2e//evil.tld`, `/dashboard/../..//evil.tld` rendaient tous `"//evil.tld"`. **Après** : tous `"/dashboard"`. Le correctif valide la **sortie** par le même principe que l'entrée (re-résolution contre la sentinelle), pas par une énumération de plus — interdire `..` aurait été un second correctif inopérant, `/.//evil.tld` n'en contient pas. **Le test est refait de fond en comble** : l'octet NUL est retiré (le fichier était classé **binaire** par git, `git show` n'affichait rien, et la ligne lue `"/ //evil.tld"` testait en réalité un NUL — le piège s'est d'ailleurs reproduit en cours de session, le cas est désormais écrit en échappe **visible**) ; l'ancien « invariant » était une énumération de 7 cas déjà tués en amont, **aucun avec dot-segment**, donc une assertion qui ne pouvait pas se déclencher. Remplacé par une **propriété** sur un corpus généré (~800 entrées) vérifiée sous les **deux** motifs de consommation, plus une garde anti-corpus-mou. **Mutation** : sans la garde de sortie, **5 des 9 tests tombent**. Un test fige au passage la protection *accidentelle* de `/auth/callback` et `/auth/landing` (concaténation par origine), qu'aucun test n'exprimait. |
| V-2 | Le flux d'invitation était un cul-de-sac dans ses **deux** branches | ✅ | `c9ae75b` | **Aucun invité ne pouvait aboutir, par aucun chemin.** *Compte neuf* : `redirectTo` n'est pas l'URL du lien cliqué mais la destination **finale**, exposée au gabarit par `{{ .RedirectTo }}`. Avec le gabarit par défaut, GoTrue redirige lui-même en déposant les jetons dans le **fragment** ; or ce Route Handler ne lit ni fragment ni `?code`, et **aucun client navigateur n'est monté** (`lib/supabase/client.ts` n'a aucun importeur, vérifié par grep) : `detectSessionInUrl` ne tourne jamais. La route reconcluait `proof_required` et renvoyait un e-mail — **boucle infinie**. *Compte existant* : `reset-password/page.tsx` ne lisait aucun `searchParams` et le formulaire n'émettait aucun champ `next`, donc `updatePassword` recevait `null` et renvoyait sur `/onboarding` sans org ni client : **jeton perdu**. Correctifs : `/auth/callback` accepte le `next` **absolu** du gabarit via `safeNextFromRedirectTo` (une absolue n'est admise que si son origine est **octet pour octet** la nôtre — pas un `startsWith`, le test couvre `…sslip.io.evil.tld`), `/reset-password` transporte `next`, et `next` n'est plus encodé qu'**une seule fois**. ⚠ **Dépendance hors code** : le gabarit Supabase doit pointer sur `/auth/callback?token_hash=…&type=…&next={{ .RedirectTo }}` — procédure et vérification dans `deploy/GABARITS-EMAIL-supabase.md`. Ordre respecté : V-1 fait **avant**, puisque faire suivre `next` arme `updatePassword` comme second puits. |
| V-3 | CSRF : forcer l'adhésion avec la session de la victime | ✅ | `0acb1db` + `f12405a` | **Le correctif P7-1 prouve la POSSESSION de l'adresse, jamais l'INTENTION de rejoindre** — son invariant est *littéralement* satisfait par la session de la victime. L'acceptation était un **GET à effet de bord** écrivant en service_role, sans contrôle d'origine, sur des cookies `SameSite=Lax`. Gain vérifié, pas supposé : `shares_scope_with` devient vraie, donc `profiles_select_shared` ouvre à l'attaquant la ligne `profiles` de la victime. L'intention est désormais établie par trois choses : `/invitations` est une **page** qui n'écrit rien et **nomme le client**, rejoindre est une **Server Action** (POST) déclenchée par un bouton, et l'origine est vérifiée **explicitement** (`lib/auth/same-origin.ts`, fail-closed, 5 tests dont une propriété sur toutes les combinaisons cross-site). Le contrôle est écrit et testé plutôt que délégué à la protection intégrée des Server Actions : une propriété de sécurité qui n'est écrite nulle part est une propriété qu'on « simplifie » sans le savoir. **Effets de bord voulus** : l'émetteur d'e-mails non authentifié disparaît (sans session, plus aucun envoi ne part d'un GET) ; la consommation du jeton vérifie enfin son erreur et exige `revoked_at` et `accepted_at` nuls, ce qui ferme la fenêtre TOCTOU. **Migration 034** (`f12405a`) : `leave_client` — il n'existait **aucune sortie**, `client_members_delete` exigeant `is_org_member`, ce qu'un Reviewer n'est jamais (règle 6) ; une adhésion créée à l'insu de la victime n'était donc révocable que par l'**attaquant**. Périmètre borné par `auth.uid()`, jamais par un paramètre. Adresse résolue sur `auth.users` et **pas** `profiles` (réinscriptible par son sujet). **pgTAP 10/10, garantie neuve validée par mutation** : retirer le bloc de révocation fait tomber le test 6 — précisément ce que le test de la 032 ne faisait pas. Suite complète : **348 ok / 0 not ok**. |
| V-4 | Appels morts et messages génériques masquant de vrais échecs | ✅ | `23d5ad9` | Les 5 RPC des 032/033 **existent bien** en ligne (vérifié en lecture seule, signatures conformes aux appels). Quatre défauts en remontant ces chemins : (1) **branche morte** — `inviteReviewer` ne renvoie plus jamais `already_invited` depuis la RPC 032 (elle supersède et ne lève un 23505 que pour « déjà **membre** »), or deux écrans testaient encore l'ancien code : l'utilisateur lisait « l'invitation n'a pas pu être créée ». Clés i18n renommées plutôt que laissées à mentir sous un nom juste ; (2) **erreur avalée** — le 22023 « adresse invalide » retombait sur `db_error`, une faute de frappe et une panne se ressemblaient trait pour trait ; (3) **500 sur le portail** — `portal/[contentId]` castait le retour de `getClient` en `Client`, avec un `orgId` valant `memberships[0]` sur une requête **sans `.order()`** : pour un Reviewer travaillant avec **deux** agences, c'est l'org de l'autre client, et le cast masquait le `null`. C'est le défaut P7-9 corrigé dans `portal/page.tsx` et laissé intact dans le fichier voisin ; `getReviewerContext` expose désormais `orgFor(clientId)` et `orgId` est marqué **déprécié** ; (4) UI morte après V-3. **Non fait, volontairement** : « laisser passer `error` dans `proxy.ts` ». Vérifié — ce correctif d'une ligne ne rend **rien** affichable, la cible du hop étant `/auth/landing`, qui redirige sans reporter aucun paramètre. La raison est écrite dans `proxy.ts` pour que personne ne « corrige » ce non-correctif. |

**Critère de sortie du LOT 0** — (a) `safeNext` ne rend plus jamais de chaîne commençant par
`//`, prouvé par une **propriété** et non par une liste : ✅ ; (b) le code d'une invitation
aboutissant à une session reviewer est en place, **mais reste suspendu au gabarit Supabase** —
c'est la seule pièce non vérifiable depuis le dépôt : ⚠ ; (c) la route d'acceptation refuse une
requête cross-site : ✅ ; (d) un membre peut se retirer lui-même : ✅ **côté code et pgTAP**, la
RPC n'existant pas encore en ligne (034 non appliquée).

**Critère de sortie — atteint côté code, sauf une configuration hors dépôt.** Les 10 tickets sont
faits sauf **P7-6**, arbitrage produit délibérément laissé à Étienne. Le parcours complet existe :
`/signup` → `/onboarding` → créer un client → inviter → révoquer / ré-inviter / retirer, et le
portail ne plante plus sur une liste vide. Deux réserves, toutes deux nommées :

1. **Le lien reçu par e-mail n'ouvrira une session dans un AUTRE navigateur que celui qui a
   déclenché l'envoi qu'une fois le gabarit Supabase changé** (« Ce qui attend Étienne », point 1).
   C'est une case à cocher dans le dashboard, pas du code.
2. Aucun de ces parcours n'a été exercé contre une vraie base : les tests prouvent les **décisions**,
   pas le câblage Supabase (note de couverture ci-dessous).

#### État final des commandes de vérification (fin de session, 15/08/2026)

| Commande | Résultat |
|---|---|
| `pnpm -w build` | ✅ `Compiled successfully` — `/signup`, `/onboarding` et `/auth/landing` au manifeste |
| `pnpm --filter web exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker test` | ✅ **40/40** (inchangé — aucun code worker touché) |
| `pnpm --filter web test` | ✅ **34/34** — *la suite n'existait pas au début de la session* |
| `pnpm check` (arbre LF via `git -c core.autocrlf=false archive`) | ✅ **exit 0** — 0 erreur, 20 warnings, 2 infos |
| Rejeu migrations + pgTAP complet (`ocean_rev2`) | ✅ 32 migrations (1 sautée, `*_storage.sql`), 31 fichiers, **338 ok / 0 not ok / 0 erreur psql** ; `plan` == assertions émises sur **les 31 fichiers** |

> Les 2 infos de `pnpm check` portent sur `biome.json` lui-même (version de schéma, clé dépréciée),
> pas sur du code — préexistantes, hors périmètre de cette session.
>
> ⚠ **Ce qu'aucune vérification ne couvre.** Les 34 tests web sont des tests de **décision** : ils
> exercent la logique extraite (acceptation d'invitation, `next`, aiguillage de rôle, slug, chemins
> de stockage) avec des dépendances injectées. Le câblage Supabase — requêtes PostgREST,
> `inviteUserByEmail`, `resetPasswordForEmail`, les 3 RPC de 032, `createSignedUrls` — n'est exécuté
> par **aucun** test, faute de stack Supabase local sur cette machine (CLI `supabase` absent, ports
> 54321/54322 tenus par le stack d'un autre projet). Il est relu, pas exécuté. Même limite que
> `pg-store.ts` côté worker.
>
> ⚠ **La policy `storage.objects` de la 033 n'est exercée par rien** : le conteneur pgTAP porte un
> schéma storage ancien (le runner saute les `*_storage.sql`). Le test 033 prouve la **décision**
> (`can_read_client_media`), pas son câblage dans la policy.

### Phase 8 — OAuth propre · 1 à 2 sessions — ✅ **7 tickets faits le 17/08/2026**

**Pourquoi** : connecter Meta pour un client rattachait **toutes** les Pages et comptes Instagram du
compte connecté à ce client-là, avec leurs tokens. Et rien ne permettait de détacher.

- Écran de sélection des sous-comptes.
- Action de détachement + révocation du secret dans le Vault (aucun `.delete()` nulle part
  aujourd'hui — passif RGPD).
- Échange long-lived Meta (absent : les tokens meurent en une heure).
- `refresh.ts` réel, appel HTTP **hors** du verrou.
- Ajouter le scope `pages_manage_posts` — sans lui la publication sur Page est refusée, et Meta ne
  rétro-accorde pas un scope.

**Critère de sortie** : deux clients avec deux Pages différentes sont connectés sans mélange, et on
peut en détacher un.
 ⚠ **Non atteint — et il ne peut pas l'être depuis le dépôt** : il exige une app
Meta et deux Pages réelles (phase 1, actions à identifiants). Le code des sept tickets est écrit,
typé, testé et vérifié par mutation ; le parcours n'a été exercé contre **aucun fournisseur réel**.
C'est la même limite que celle notée pour le câblage Supabase de la phase 7.

#### Tickets — suivi d'exécution

> Exécution : branche `chore/phase-0-outillage`, session du 17/08/2026, à la suite du LOT 1.
> **Non poussée.** Les migrations **035** et **036** sont écrites, appliquées en LOCAL, testées, et
> livrées dans `deploy/31_` et `deploy/32_`.
>
> **Mise à jour du 15/08/2026 (pilotage)** : les deux sont désormais **APPLIQUÉES EN LIGNE** sur
> `hgdeopkmkwyoumsfggrm`, ledger à **36 lignes**. Détail et contrôles : section « Migrations 035 et
> 036 » plus bas. ⚠ `deploy/31_migration_035.sql` était **corrompu** et n'aurait pas pu s'exécuter —
> 035 a été appliquée depuis la source canonique `supabase/migrations/`.

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| P8-5 | State OAuth durci | ✅ | `03e3fe0` | **Le défaut principal n'était pas l'absence d'`exp`, c'était PKCE rendu inopérant.** `OAuthState` portait `codeVerifier` ; le state est en base64url (pas du chiffrement) et voyage dans l'URL de redirection **à côté du code d'autorisation** — historique, Referer, journaux du fournisseur. Quiconque voyait l'URL voyait les deux moitiés que PKCE existe pour séparer. Le vérifieur vit désormais dans un cookie **httpOnly** ; la primitive est **retirée du type** (idiome P7-1), et un test décode le state pour vérifier la liste EXACTE de ses clés. Trois autres trous fermés par le même couplage : pas d'expiration (TTL 10 min), nonce généré puis **jamais vérifié** (un state capté se rejouait depuis n'importe quel navigateur), et **aucun lien de session** — le callback croyait le `userId` du state sur parole, donc la connexion et ses tokens atterrissaient dans l'org désignée par le state. `getUser()` (revalidé) et pas `getSession()`. ⚠ `sameSite: "lax"` est **obligatoire**, pas un relâchement : le retour du fournisseur est une navigation cross-site de premier niveau, en `strict` aucune connexion n'aboutirait. Gardes extraites dans `callback-rule.ts` (un Route Handler n'est atteignable par aucun test). **Propriété à 54 combinaisons : une seule aboutit.** Mutations : nonce non vérifié → **2 tests** ; userId cru → **3** ; expiration retirée → **3** ; vérifieur remis en state → **1**. |
| P8-6 | `pages_manage_posts` + scopes ACCORDÉS | ✅ | `274ed75` | Deux défauts, le second expliquant l'urgence du premier. ① `pages_manage_posts` — permission d'ÉCRITURE sur une Page — n'était pas demandé. ② `persistConnection` écrivait `scopes: config.scopes`, la liste **demandée**, alors que l'écran Meta laisse décocher permission par permission : la base affirmait une capacité que la connexion n'avait pas, et on s'en apercevait au POST, en erreur permanente (`failed` direct, règle 18) chez un vrai client. **Ce qui rend ② urgent : Meta ne rétro-accorde JAMAIS un scope** — sans les scopes réels en base, impossible de savoir quelles connexions refaire. Meta ne renvoyant pas de champ `scope`, les permissions se lisent par `GET /me/permissions` (`granted` / `declined`). **Le repli est l'ignorance, pas l'optimisme** : réponse malformée → liste vide. `PUBLISH_SCOPES` est plus étroit que les scopes demandés (`pages_read_engagement` sert aux métriques, son absence n'empêche pas un post) — une alerte qui se déclenche pour rien finit ignorée. Les 2 tests de scope **échouaient AVANT** le correctif. Mutations : ne plus filtrer `granted` → **1** ; retirer le scope → **2**. |
| P8-3 | Échange long-lived Meta | ✅ | `6224ccc` | `fb_exchange_token` : **0 occurrence** dans le dépôt — aucune connexion Meta ne survivait à l'après-midi de sa création. **Le piège est l'ORDRE** : les tokens de PAGE héritent de la durée de vie du token utilisateur qui les demande, donc appeler `/me/accounts` avec le token court donne des tokens de page courts — et ce sont eux qui publient. On aurait eu une connexion « valide 60 jours » dont les tokens de publication meurent dans l'heure, l'échec n'apparaissant qu'à la première publication programmée. **Verrouillé par le TYPAGE** : `exchangeForLongLivedToken` rend `ReadyTokens`, `resolveIdentity` n'accepte que ce type — inverser l'ordre est une **erreur de compilation**, vérifiée par mutation (`TS2345 … '[marqueLongLived]' is missing`). Un commentaire ne survit pas à un refactor, une signature si. Garde-fou `looksLongLived` sur la réponse. En prime `token-life.ts` : un token Meta non rafraîchi à temps est **définitivement perdu** (aucun refresh token), d'où une marge de 10 j large exprès ; `inconnu` n'est jamais traité comme `ok` ; propriété de **monotonie** (un token ne redevient pas sain en vieillissant). |
| P8-1 | Sélection des sous-comptes | ✅ | `a05a4b9` (+ migration **035**) | **La fuite la plus directe du produit.** La boucle rattachait TOUS les `subAccounts` au `clientId` du flux : connecter Meta depuis l'espace du client A y rattachait toutes les Pages et tous les comptes IG du compte connecté — ceux de B compris, **avec leurs tokens de publication**. Aucune policy ne s'y opposait, et c'est le point : même org, RLS satisfaite, c'est le code applicatif qui choisissait. Désormais le callback persiste la connexion + un **catalogue sans aucun token ni uuid de secret** (`metadata` est lisible par les membres de l'org), puis redirige vers un écran de sélection. Rien n'est pré-coché — pré-cocher reproduirait le comportement corrigé en laissant croire à un choix. Le token de page est **redemandé** au rattachement : un token qui attend entre deux écrans est un token qui traîne. **Le recoupement porte sur le COUPLE (plateforme, identifiant)** — chez Meta un même id numérique existe des deux côtés, ne comparer que l'id laisserait publier via la mauvaise API. Les clés venant du navigateur sont recoupées au catalogue : propriété testée sur les **16 parties** du catalogue, chacune polluée de bruit. Migration 035 (`read_`/`revoke_integration_secret`, service_role only) : ⚠ **extension réelle du rayon d'explosion, assumée et écrite** — seul le worker pouvait lire un token jusqu'ici. |
| P8-2 | Détachement + révocation Vault | ✅ | `429e3c1` (+ migration **036**) | `.delete()` n'apparaissait **nulle part** dans le code OAuth : un jeton restait chiffré dans Vault indéfiniment pour un compte que le client croit déconnecté — passif RGPD et risque concret. **Pas une suppression de ligne** : `content_targets.social_account_id` porte `on delete restrict` (006:43) et c'est voulu — la ligne porte le lien vers les posts réellement publiés, le détachement ne doit pas réécrire le passé. **Pas `needs_reauth` non plus** : cet état veut dire « reconnecte-moi » et inviterait à défaire le geste qu'on vient de faire. D'où `disconnected` (036). **L'ordre des deux écritures compte** : la ligne de secret est supprimée AVANT la révocation Vault — l'inverse laisserait une ligne désignant un secret inexistant, donc un compte qui a l'air publiable et ne l'est pas. **L'échec de révocation est remonté, pas avalé** : c'est le geste qu'on ne peut pas vérifier après coup. pgTAP 036 : la valeur est écrivable sur les deux tables, un post publié garde son `external_post_id`, et la suppression reste refusée (23503). |
| P8-4 | `refresh.ts` réel, HTTP hors du verrou | ✅ | `019db4e` | **Deux règles qui semblent se contredire** : la 14 veut que deux refresh du même compte ne se croisent jamais (chez TikTok/Microsoft l'échange REMPLACE le refresh token) ; la 18 interdit un appel réseau dans une transaction. Le scaffold proposait justement l'appel HTTP **dans** le verrou — l'anti-pattern écrit comme marche à suivre. Résolu en **trois phases** : ① sous verrou lire/décider/mémoriser le refresh token, ② **hors verrou** appeler, ③ sous verrou **compare-and-swap** puis écrire. Le CAS est ce qui rend ② sûr : si un autre worker est passé, chez un fournisseur à rotation le token qu'on s'apprête à écrire est **déjà invalidé par son échange à lui** — l'écrire casserait le compte. Décisions : l'ordre des tests cherche d'abord ce qui rend l'échange IMPOSSIBLE ; une échéance **inconnue** ne déclenche rien (un échange inutile CONSOMME le refresh token) ; Meta traité à part (il ré-échange un token encore valide). Le faux pool **journalise** `begin/lock/commit/http/save` : le test vérifie la SÉQUENCE, pas une intention. Mutations : CAS retiré → **1 test** ; HTTP remis dans le verrou → **2**. |
| P8-7 | `needs_reauth` lisible par le web | ✅ | `037bccb` | `getSocialAccounts` ne lisait que `social_accounts.status` et ne joignait **jamais** la connexion. L'information la plus importante du produit — « ce compte ne peut plus publier » — était écrite dans une table que le web n'ouvrait jamais : écran vert, bandeau muet, et découverte du problème à l'échec d'un contenu programmé. **La connexion est la racine** : un compte n'a pas d'autorisation propre, il en hérite. Ordre des branches : ① le **détachement prime** (acte délibéré — ne pas inviter à le défaire), ② la connexion, ③ le compte. En branchant les scopes de P8-6, un cas sans statut devient visible : connexion vivante, jeton valide, et tout POST refusé faute de `pages_manage_posts` → `missingScopes`, affiché à part. ⚠ **Une liste de scopes vide veut dire « on ne sait pas »**, pas « rien n'est accordé » : les connexions d'avant P8-6 stockaient les scopes demandés — crier au loup sur toutes rendrait l'alerte inaudible dès le premier jour (même prudence que le `facebook: null` du quota, P3-10). Propriété sur **72 combinaisons** : aucune combinaison dégradée ne ressort « connecté sans réserve ». Mutations : ignorer la connexion → **2 tests** ; scopes vides mal interprétés → **1**. |

#### État final des commandes de vérification (fin de session, 17/08/2026 — LOT 2)

| Commande | Résultat |
|---|---|
| `pnpm -w build` | ✅ `Compiled successfully` |
| `pnpm --filter web exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter web test` | ✅ **124/124** (72 en fin de LOT 1) |
| `pnpm --filter worker test` | ✅ **51/51** (40 avant — le worker n'avait pas bougé depuis la phase 3) |
| `supabase test db` (chemin exact du job `db` de la CI) | ✅ **Files=34, Tests=364, Result: PASS** (348 avant : +10 pour la 035, +6 pour la 036) |
| `pnpm check` — arbre **LF reconstruit depuis les blobs** | ✅ **exit 0** — 490 fichiers, **0 erreur**, 20 warnings |

#### Ce que le LOT 2 a vu et volontairement PAS touché

- **Aucun parcours OAuth n'a été exercé contre un fournisseur réel.** Il n'existe ni app Meta ni
  identifiants (phase 1). Les tests prouvent les **décisions** — gardes du callback, ordre des
  opérations, CAS du refresh, santé des comptes — pas le dialogue avec Meta. C'est la limite de
  couverture la plus importante de ce lot, et elle ne se lève qu'avec l'app Meta.
- **`AccountStatus` annonce `expired`** : rien ne produit cette valeur, le code qui la teste est
  mort. Constaté, écrit dans le type et dans la migration 036, **non corrigé** — le retirer touche
  4 écrans. ⚠ **Rectificatif du 15/08/2026 (pilotage)** : la formulation d'origine disait « une
  valeur que l'enum SQL n'a **jamais** eue ». C'est faux — `expired` est dans l'enum depuis la
  **migration 010** (`010_cablage_foundations.sql:51`), et l'enum en ligne le porte bien. Le
  problème n'est pas un type qui invente une valeur absente du schéma, c'est une valeur du schéma
  que **plus rien n'écrit**. Diagnostic différent, correctif différent.
- **La marge de 10 jours est dupliquée** entre `apps/web/lib/oauth/token-life.ts` et
  `apps/worker/src/tokens/refresh-plan.ts`. Les deux paquets ne partagent aucun module
  (`packages/shared` ne porte que des types DB) et importer du web dans le worker créerait une
  dépendance absente de son image Docker. Le commentaire le dit **des deux côtés**.
- **Les signatures des 2 RPC de 035 sont ajoutées à la main** dans `lib/supabase/types.ts` — comme
  tout le reste de ce fichier. ⚠ **Rectificatif du 15/08/2026 (pilotage)** : il n'y a rien à
  « régénérer après application ». `scripts/gen-types.py` n'écrivait aucun fichier et a été
  **retiré** ; les 2 signatures ont été recoupées avec `pg_proc` sur le schéma réel et correspondent.
- **L'e-mail Brevo `needs-reauth`** (règle 14) n'est toujours pas envoyé : `BREVO_API_KEY` est
  vide et le Lot 2 e-mail n'est pas ouvert. Le statut est posé, la notification non.

### Phase 9 — Refermer le cercle · 2 sessions

Reprend la session 8 du brief — le meilleur rapport valeur/effort du backlog.

- Collecteur de métriques dans le worker (insights IG/FB par `social_account`, service_role).
- Import réel du feed pour peupler `imported_posts`.
- Historisation pour comparer N vs N-1.
- La requête qui referme la boucle : croiser `content_pillars.target_share` et
  `post_metrics.engagement_total`.

**À faire dès maintenant, en attendant** (1 h) : masquer les modules Performance, Rapport et Agenda,
ou leur donner un état vide explicite. Aujourd'hui ils affichent des chiffres **fabriqués** — la
heatmap « meilleurs créneaux » renvoie la même valeur pour tous les clients, et le rapport partagé
ignore la note que tu as rédigée. C'est la seule catégorie de mensonge que le produit émet.

**Critère de sortie** : la page Performance affiche des chiffres réels, et le rapport client compare
deux périodes.

### Phase 10 — Monétisation

Stripe, plans, quotas par plan, tunnel d'inscription. Sans revenu, le nombre de piliers couverts est
sans effet. À traiter avant les piliers IA / image / community management.

---

## En parallèle de tout, dès le premier jour

**Le chemin critique Meta** — c'est lui qui décide de la date de lancement commercial, pas le code.

1. Entité + Business Manager + **Business Verification** (file d'attente propre, risque de rejet).
2. Politique de confidentialité et CGU hébergées, endpoint de suppression de données.
3. Passage en Live Mode.
4. App Review, **une soumission par permission**, chacune avec son screencast. Ne pas oublier
   `pages_manage_posts`.
5. Le screencast de publication doit montrer un humain qui déclenche délibérément la publication —
   une démo qui envoie douze contenus d'un coup se fait rejeter.
6. Data Protection Assessment et Data Use Checkup.

---

## Ce que tu dois décider avant la porte C

1. **Le nom et le domaine.** `socean.54-36-180-115.sslip.io` porte l'IP du VPS. Il sera gelé dans
   huit redirect URIs OAuth et dans tous les emails clients. En changer plus tard = redéclarer les
   quatre providers, casser les connexions en vol, refaire une App Review engagée. C'est un
   prérequis technique, pas une décision marketing.
2. **Facebook Login ou Instagram Login.** La variante implémentée impose une Page Facebook par
   client — ce que `docs/ANALYSE-LANCEMENT.md` §2.1 avait justement écarté.
3. **Performance / Rapport / Agenda** : masquer jusqu'à la phase 9, ou laisser à zéro avec un état
   vide explicite ?
4. **Modèle de prix** (phase 10) : par siège, par client géré, ou par compte social connecté ? Le
   choix change le schéma.

---

## Combien de temps

| Jalon | Effort | À 10-20 h/semaine |
|---|---|---|
| Porte A fermée (phases 0-2) | ~3 jours | 1 à 2 semaines |
| Porte B fermée, **premier post réel** (phases 3-6) | ~12 jours | 6 à 9 semaines |
| Porte C fermée, **premier vrai client** (phases 7-9) | ~10 jours | 5 à 7 semaines |

Soit **3 à 4 mois** jusqu'au premier client réel, à ton rythme — pendant lesquels la Business
Verification et l'App Review avancent en parallèle. Le calendrier commercial sera probablement
décidé par Meta, pas par le code.

---

*Rien n'est appliqué sans validation. Ce document est un plan, pas un patch.*

---

## Migration 037 (watchdog) — ✅ APPLIQUÉE le 15/08/2026, avec deux défauts trouvés au pré-vol

Appliquée via le MCP Supabase (`execute_sql`) sur feu vert d'Étienne. **Le pré-vol a arrêté
l'application une première fois** — et c'est la troisième fois de la journée qu'il attrape quelque
chose qu'aucun test ne voyait.

### Défaut 1 — `pg_net` n'était pas installée

L'en-tête du fichier `deploy/` déclarait « extension pg_net deja installee » comme un prérequis
satisfait. **Faux** : elle n'était installée ni en ligne ni en local, alors que
`watchdog_publish_jobs()` appelle `net.http_post`.

Ce qui rend ce défaut vicieux, c'est qu'il n'était **visible nulle part** :

- `create or replace function … language plpgsql` ne résout pas `net.*` à la création → la
  migration se serait appliquée **sans broncher** ;
- la fonction sort **avant** l'appel HTTP tant que les secrets Vault manquent → elle n'aurait pas
  cassé à l'exécution non plus ;
- les 378 tests pgTAP passaient, pour la même raison : ils n'atteignent jamais le réseau.

La panne serait apparue au **geste (b) du runbook** — poser les deux secrets Vault — c'est-à-dire au
moment précis où l'on croit terminer l'installation : `schema "net" does not exist`, toutes les
5 minutes, **sur le seul filet censé prévenir quand plus rien ne fonctionne**. Corrigé avant
application (commit `a83f2bf`), prouvé en local : `net.http_post` resolvable après, pas avant.

### Défaut 2 — trouvé APRÈS application, par `get_advisors`

`create extension pg_net` nu enregistre l'extension dans `public` → nouvel avis
`extension_in_public`. Les 12 fonctions vont dans le schéma `net` dans les deux cas (le script de
l'extension le crée lui-même), donc **rien n'est exposé par PostgREST** : c'est le schéma
d'*enregistrement* qui change. Corrigé dans le fichier ; **la correction en ligne exige un
`drop extension pg_net` — geste destructif, en attente du feu vert d'Étienne.**

### Contrôles après application

| Contrôle | Résultat |
|---|---|
| `pg_cron` / `pg_net` installées | ✅ 1.6.4 / 0.20.3 |
| `net.http_post` résolvable en ligne | ✅ |
| Tâche cron | ✅ `ocean-watchdog-publish-jobs`, `*/5 * * * *`, `active=true` |
| `publish_jobs.watchdog_alerted_at` | ✅ créée |
| `public.watchdog_publish_jobs` | ✅ `SECURITY DEFINER`, `search_path=""`, `anon`=false, `authenticated`=false, `service_role`=true |
| `private.late_publish_jobs` | ✅ `SECURITY DEFINER`, `search_path=""`, **aucun rôle** n'a `EXECUTE` |
| **Surface `anon` (SECURITY DEFINER)** | ✅ **inchangée — 1** (`get_report_share`) |
| Ledger | ✅ **37 lignes** |
| `get_advisors` | ⚠ **1 avis nouveau** : `extension_in_public` sur `pg_net` (cf. défaut 2) |

⚠ **Le watchdog détecte mais ne prévient encore personne** : les deux secrets Vault
(`watchdog_edge_url`, `watchdog_service_role_key`) ne sont pas posés et l'Edge Function
`watchdog-notify` n'est pas déployée. C'est voulu — la fonction émet un `NOTICE` et rend le compte
plutôt que de faire échouer le cron. Mais ne pas confondre « installé » et « opérationnel ».

---

## Migrations 035 et 036 — ✅ APPLIQUÉES le 15/08/2026 (session de pilotage)

Appliquées via le MCP Supabase (`execute_sql`, **jamais** `apply_migration` : le ledger est en
versions courtes) sur feu vert explicite d'Étienne, après lecture intégrale des fichiers et pré-vol.

### ⚠ Défaut trouvé à la lecture : `deploy/31_migration_035.sql` est CORROMPU

Le fichier de déploiement porte, aux lignes 40–61, un **fragment orphelin** : un corps de fonction
(`returns text` … `$$;` puis ses `revoke`/`grant`) **privé de son en-tête
`create or replace function`**. Postgres s'arrête en erreur de syntaxe dès la ligne 40 — le fichier
n'aurait jamais pu s'exécuter. La vraie définition suit, complète, plus bas : la première copie a
perdu sa ligne d'en-tête pendant la génération du fichier `deploy/`.

La source canonique `supabase/migrations/035_read_and_revoke_integration_secret.sql` est **saine**,
et c'est **elle** qui a été appliquée. C'est le faux positif n° 3 du handoff en conditions réelles :
les 10 tests pgTAP de la 035 mesuraient `supabase/migrations/`, jamais `deploy/`. **Le fichier
`deploy/31_` reste à régénérer** — la preuve ne portait pas sur le référentiel livré.

### Pré-vol (avant toute écriture)

| Contrôle | Résultat |
|---|---|
| Ledger | ✅ 34 lignes, max `034` ; ni `035` ni `036` |
| `vault.decrypted_secrets` (vue) et `vault.secrets` (table) | ✅ présentes |
| Prérequis 019 (`store_`/`update_integration_secret`) | ✅ présents |
| `read_`/`revoke_integration_secret` déjà là ? | ✅ non — pas de recouvrement silencieux |
| Baseline `anon` sur les `SECURITY DEFINER` de `public` | ✅ **1 seule** (`get_report_share`) |
| `enum_range(account_status)` avant | `connected, needs_reauth, expired` |

### Contrôles après application

| Contrôle | Résultat |
|---|---|
| 035 — les 2 RPC existent, `prosecdef = true` | ✅ |
| 035 — `proconfig` = `search_path=""` (figé) sur les 2 | ✅ |
| 035 — requête de contrôle du fichier (doit rendre **0**) | ✅ **0** — ni `anon` ni `authenticated` n'ont `EXECUTE` |
| 035 — `PUBLIC` (grantee 0) sur les 2 | ✅ 0 — le `revoke from public` a bien mordu |
| 035 — `service_role` a `EXECUTE` sur les 2 | ✅ |
| **Surface `anon` totale (`SECURITY DEFINER`)** | ✅ **inchangée — 1 seule** (`get_report_share`) |
| Surface `anon` toutes fonctions `public` confondues | ✅ 3, aucune nouvelle : `get_report_share` (definer), `reorder_content_media` et `set_updated_at` (**non**-definer, donc soumises à RLS) |
| 036 — passée **seule** dans sa transaction, après 035 | ✅ `alter type … add value` isolé, aucune autre instruction dans l'appel |
| 036 — `enum_range(account_status)` après | ✅ `connected, needs_reauth, expired, disconnected` |
| Ledger final | ✅ **36 lignes** — `035=read_and_revoke_integration_secret`, `036=account_status_disconnected` |
| `get_advisors` (security) | ✅ **aucun avis nouveau** imputable à 035/036 ; les 3 `rls_enabled_no_policy` sur les tables `*_secrets` sont la règle 11 (deny-all volontaire), les `WARN` sur les RPC `authenticated` préexistent |
| `/api/health` | ✅ HTTP 200 |

### Écart de documentation relevé au passage

La ligne « **`AccountStatus` annonce `expired`**, une valeur que l'enum SQL n'a **jamais** eue »
(fin de la phase 8) est **fausse**. `expired` a été ajouté par la **migration 010**
(`010_cablage_foundations.sql:51`) et il est bien présent dans l'enum en ligne. Le constat utile
tient toujours — *rien ne produit cette valeur, le code qui la teste est mort* — mais le motif
avancé était le mauvais. À corriger dans le texte, pas dans le schéma.

### Suites directes de l'application — traitées le 15/08/2026

**1. `deploy/31_migration_035.sql` régénéré** depuis la source canonique (fichier corrompu, cf.
ci-dessus). ✅

**2. « Régénérer les types » — la tâche n'existait pas, et sa disparition est instructive.**

Le plan annonçait qu'il fallait régénérer `apps/web/lib/supabase/types.ts` une fois 035/036 en
ligne. En allant le faire, trois choses se sont révélées fausses :

- **`scripts/gen-types.py` n'écrit RIEN.** Il lit l'OpenAPI de PostgREST, construit une liste de
  tables, imprime `regenere 42 tables: …` et s'arrête. Sa fonction `emit()` — celle qui fabrique le
  TypeScript — **n'est jamais appelée**, et aucun fichier n'est ouvert en écriture. Vérifié par
  exécution : sortie 0, message rassurant, **`git status` sur `types.ts` vide**. C'est le pire genre
  de faux positif du lot, parce que l'outil *annonce* le travail qu'il ne fait pas. Tout `types.ts`
  est maintenu **à la main**, sous un en-tête qui disait « Ne pas editer a la main ».
- **`disconnected` n'avait rien à faire dans `types.ts`** : le fichier ne génère aucun enum
  (`Enums: { [_ in never]: never }`), une colonne enum y est typée `string`. Les unions vivent dans
  `lib/domain/core.ts`, où `AccountStatus` portait **déjà** `disconnected`. Ma note initiale était
  donc fausse sur ce point ; elle est corrigée ici.
- **Les 2 signatures RPC de 035 étaient déjà exactes.** Recoupées avec `pg_proc` sur le schéma réel :
  `read_integration_secret(_secret_id uuid) → text` et `revoke_integration_secret(_secret_id uuid)
  → boolean` correspondent à `Args {_secret_id: string}` / `Returns string | null` et `boolean`.
  Seul le commentaire « ⚠ ajoutées à la main, 035 pas encore appliquée » était périmé — retiré.

**Dérive mesurée au passage** : **41 tables typées** dans `types.ts` contre **42 exposées** en ligne.
`publish_jobs` manque. **Sans effet aujourd'hui** — le web ne touche la file que par les RPC
`enqueue_publish_jobs` / `cancel_publish_jobs`, jamais la table (c'est la synchronisation app ↔ file
de la phase 4) — mais toute lecture directe échouerait au typage. Écrit dans l'en-tête du fichier.

**Tranché le 15/08/2026 par Étienne : le script est retiré.** `types.ts` assume désormais sa tenue
manuelle, et son en-tête le dit. Vérifié avant suppression qu'aucune CI, aucun `package.json` et
aucun Dockerfile ne l'appelait — seules des notes de planning le mentionnaient, corrigées dans le
même commit. Les rapports d'audit du 12/08 le mentionnent aussi et ne sont **pas** touchés : ce sont
des constats datés, vrais à leur date.

---

## Ce qui attend Étienne après la nuit du 14-15/08/2026

### Migration 034 (`leave_client`) — ✅ APPLIQUÉE le 15/08/2026 (session de pilotage)

Appliquée via le MCP Supabase sur autorisation d'Étienne, après lecture intégrale de
`deploy/30_migration_034.sql` et pré-vol des dépendances (`client_invitations.accepted_user_id`,
colonnes de `client_members`, absence préalable de la fonction, ledger à 33).

Motif : il n'existait **aucune sortie**. `client_members_delete` exige `is_org_member`, or un
Reviewer n'appartient à aucune organisation (règle 6) — il ne pouvait donc physiquement pas se
retirer d'un client. C'était l'aggravant de la CSRF V-3 : une adhésion créée à l'insu de la victime
n'était révocable que par l'attaquant.

| Contrôle | Résultat |
|---|---|
| `leave_client` : `SECURITY DEFINER`, `search_path` figé | ✅ |
| `anon` n'a **pas** `EXECUTE` | ✅ (`authenticated, postgres, service_role`) |
| Surface `anon` totale (SECURITY DEFINER exposées) | ✅ **inchangée** — 1 seule (`get_report_share`) |
| Périmètre borné par `auth.uid()` et non par un paramètre | ✅ l'appelant ne peut retirer que lui-même |
| Ledger | ✅ 34 lignes, dernière = `034` |
| `/api/health` | ✅ HTTP 200 |

⚠ Reste non appliqué côté Étienne : **les gabarits d'e-mail Supabase** (voir
`GABARITS-EMAIL-supabase.md`). Sans eux, aucune invitation n'aboutit, quel que soit l'état du code.

### Migrations 032 et 033 — ✅ APPLIQUÉES le 15/08/2026 (session de pilotage)

Appliquées via le MCP Supabase sur autorisation explicite d'Étienne, après lecture intégrale des
deux fichiers `deploy/` et un pré-vol vérifiant l'existence de toutes les dépendances
(`private.is_reviewer_visible_media`, `is_client_member`, `can_write_client_media`,
`is_org_member`, colonnes de `client_invitations`, enum `invitation_status`,
`media_assets.storage_path`).

Motif : le front qui appelle ces RPC était déjà mergé **sans garde**, donc les boutons « révoquer »
et « retirer » répondaient `PGRST202 → db_error`, et la révocation immédiate exigée par la règle 4
n'existait pas en base.

Vérifications faites après application :

| Contrôle | Résultat |
|---|---|
| Les 3 RPC de 032 existent, `SECURITY DEFINER`, `search_path` figé | ✅ |
| `anon` n'a **pas** `EXECUTE` sur les 3 nouvelles RPC | ✅ (`authenticated, postgres, service_role`) |
| `private.can_read_client_media` : **une seule** signature `(uuid, uuid, text)` | ✅ l'ancienne `(uuid,uuid,uuid)` est bien retirée, pas de surcharge ambiguë |
| Policies `storage.objects` | ✅ 5, inchangé ; `media_originals_select` recréée en SELECT |
| `media_thumbs_select_public` (fuite de listing corrigée en phase 0) | ✅ toujours absente |
| Surface exposée : `anon` | ✅ **inchangée** — 1 seule fonction (`get_report_share`) |
| Surface exposée : `authenticated` | 10 → 13 SECURITY DEFINER (+3 attendus, conformes) |
| Ledger | ✅ 33 lignes, `001` → `033`, zéro doublon |
| `/api/health` | ✅ HTTP 200 |

### Migrations appliquées en production — ✅ FAIT le 15/08/2026 (BLOC 0)

Les 10 envois ont été appliqués sur `hgdeopkmkwyoumsfggrm` via le MCP Supabase, sur autorisation
explicite d'Étienne donnée pour ce bloc **et pour lui seul**. Aucune autre écriture en ligne n'a
suivi. Ordre respecté, vérification après chaque envoi avant de passer au suivant.

**Méthode — pourquoi pas `apply_migration`.** Le ledger porte des versions courtes (`001`…`031`) ;
`apply_migration` inscrit une ligne horodatée, ce qui aurait cassé la correspondance avec
`supabase/migrations/` (c'est le ménage qu'avait dû faire `deploy/17_ledger_catchup.sql`). Donc :
DDL par `execute_sql` — **vérifié : il ne journalise rien** (ledger inchangé à 22 lignes après la
023) — puis ligne de ledger écrite à la main, au format exact des lignes existantes
(`version` + `name`, tout le reste `null`).

**Contrôle préalable des 10 fichiers** : diff logique (hors commentaires et lignes vides) entre
chaque `deploy/*.sql` et son homologue de `supabase/migrations/` → **8 identiques**, et
`concat(19_etape1 + 20_etape2)` == `024_needs_verification.sql` → identique. Aucune divergence.

| Ordre | Fichier | Version | Vérification faite après l'envoi |
|---|---|---|---|
| 1 | `deploy/18_migration_023.sql` | `023 target_publish_anchor` | 2 colonnes + 2 triggers + 2 fonctions `private` présents |
| 2 | `deploy/19_migration_024_etape1_enums.sql` | `024` (1/2) | 3 valeurs `needs_verification` lues **depuis une transaction neuve** → étape 1 bien COMMITÉE avant l'étape 2 |
| 3 | `deploy/20_migration_024_etape2.sql` | `024 needs_verification` | les 3 fonctions portent `needs_verification` |
| 4 | `deploy/21_migration_025.sql` | `025 enqueue_no_terminal_targets` | filtre d'ancre + exclusions `pushed_to_platform` / `needs_verification` présents |
| 5 | `deploy/22_migration_026.sql` | `026 target_delete_guard` | garde étendue au job ; FK toujours `c` (cascade) — la bascule `restrict` de P3-8 reste **non appliquée**, comme décidé |
| 6 | `deploy/23_migration_027.sql` | `027 cancel_claimed_jobs` | `claimed`/`awaiting_media` couverts |
| 7 | `deploy/24_migration_028.sql` | `028 manual_publish_cancels_job` | annulation scopée `content_target_id` |
| 8 | `deploy/25_migration_029.sql` | `029 publish_queue_safety_net` | trigger présent (précédé d'un `drop trigger if exists`) |
| 9 | `deploy/26_migration_030.sql` | `030 approval_mode_gate` | garde porte `approval_mode` + `decided_by_role` + `approval_stale` |
| 10 | `deploy/27_migration_031.sql` | `031 scheduled_at_bounds` | trigger présent |

**État final — critère de sortie du BLOC 0 atteint.**

| Contrôle | Avant | Après |
|---|---|---|
| `list_migrations` | 22 lignes `001`→`022` | **31 lignes `001`→`031`**, 0 version intruse, noms **identiques** aux fichiers (`diff` mécanique) |
| `get_advisors(security)` | 15 lints | **15 lints — delta ZÉRO** |
| `/api/health` | — | **HTTP 200**, `{"ok":true,"service":"web"}` |

**Delta d'advisors expliqué** : aucun nouveau lint, et c'est le résultat attendu. Les 5 fonctions
ajoutées ou réécrites vivent dans le schéma `private`, non exposé par PostgREST ; les 3 fonctions
`public` modifiées (`enqueue_publish_jobs`, `cancel_publish_jobs`,
`mark_target_published_manually`) étaient **déjà** dans les 10 WARN 0029 de la baseline. Les 3 INFO
`rls_enabled_no_policy` restent les `*_secrets` en deny-all (règle 11). Aucun
`rls_disabled_in_public`, aucun `rls_enabled_no_policy` hors `*_secrets`.

### Parcours désormais bloqués côté code ancien (production)

Le code déployé est antérieur à la phase 3 : la production a maintenant un schéma **en avance sur
son code**. État réel des données mesuré après application : **0 cible ancrée, 0 job (aucun,
jamais), 16 contenus, 5 clients**. Conséquence : `023`, `025`, `026`, `027`, `028` et `029` n'ont
**aucun effet observable** aujourd'hui — ce sont des durcissements qui attendent le worker.

Deux migrations, elles, sont **actives tout de suite** :

1. **`030` — bloque réellement, sur un client réel.** Contrairement à ce que laissait entendre la
   note du 14/08 (« le défaut est `optional`, donc rien ne bloque »), **2 clients sur 5 sont déjà
   en `approval_mode = 'required'`** : `Brulerie Lacaze` (5 contenus, dont **2 en amont**) et
   `testat` (0 contenu). Et **aucun contenu du projet n'a d'approbation `reviewer`** (0 partout).
   Donc : les 2 contenus en amont de `Brulerie Lacaze` ne peuvent **plus** passer en « Programmé »
   depuis l'UI déployée. Le geste lève `42501`, et le code en ligne **ne mappe pas**
   `CLIENT_APPROVAL_REQUIRED` (ce mapping est arrivé avec P4-3, dans la branche non poussée) :
   l'utilisateur verra une erreur Postgres brute, pas un message clair.
   *Contournement immédiat sans toucher au code : passer le client en `optional`, ou faire
   approuver le contenu par un Reviewer — ce que la faille du LOT A empêche justement de faire
   proprement.*
2. **`031` — refuse de POSER une date passée** (tolérance 2 min, errcode `22007`). Les **3 contenus
   déjà `scheduled` avec une date dépassée** restent modifiables (031 tolère une date *inchangée*,
   c'est exactement le cas prévu) ; en revanche les re-dater vers un autre instant passé est
   désormais refusé. Le glisser-déposer du calendrier et l'action en lot du board ne validaient
   rien côté serveur : ces deux gestes peuvent maintenant échouer sans message mappé.

⚠ `024` ajoute `needs_verification` aux 3 enums alors que les types TypeScript déployés l'ignorent.
Sans effet aujourd'hui (aucun worker déployé ne peut poser ce statut), mais tout déploiement d'un
worker à jour **doit** s'accompagner du code web à jour, sinon les libellés de statut seront vides.

**Ordre migration → worker.** Appliquer 023 **avant** de déployer le worker à jour : son claim lit
`ct.publish_started_at`. Et déployer le worker à jour **avant ou avec** la 027 : c'est le fencing
`worker_id` (P3-5) qui rend l'annulation d'un job `claimed` réellement effective.

### Changements de comportement visibles, à connaître avant d'appliquer

1. **Client en `approval_mode = 'required'`** : le drag « Brouillon → Programmé » lève désormais
   42501. Le kanban ne grise pas encore le geste.
   ⚠️ **Correction du 15/08** : la phrase « le défaut est `'optional'`, donc rien ne bloque tant
   qu'un client n'est pas explicitement passé en `required` » était rassurante **et fausse en
   pratique**. Comptage fait en base après application : **2 clients sur 5 sont déjà en
   `required`**, et aucun contenu du projet n'a d'approbation `reviewer`. Le blocage est donc
   effectif dès maintenant sur `Brulerie Lacaze`. Voir le bloc « Parcours désormais bloqués ».
2. **Recadrer ne fait plus disparaître l'avertissement de ratio** dans le composer. C'est voulu :
   rien n'est recadré tant que le traitement d'image réel n'existe pas.
3. **Une date de programmation dans le passé est refusée** (tolérance 2 min).
4. `saveContentItem`, `scheduleContentItem` et `applyStatusIntent` peuvent désormais renvoyer
   `ok: false` là où elles renvoyaient toujours `ok: true` — un toast d'erreur peut apparaître sur
   des cas qui passaient en silence. C'est le but.

### Ce qui attend Étienne après la nuit du 15/08/2026 (phase 7)

1. **Gabarit d'e-mail Supabase — c'est le seul point qui empêche le parcours reviewer de marcher
   de bout en bout.** Le flux d'invitation envoie désormais le secret à la boîte aux lettres
   (`inviteUserByEmail`, ou lien de mot de passe si le compte existe). Mais le gabarit **par
   défaut** utilise `{{ .ConfirmationURL }}`, qui passe par le flux implicite et dépose ses jetons
   dans le **fragment** de l'URL — invisible côté serveur. À changer dans *Authentication > Email
   Templates* (gabarits « Invite » et « Reset password »), pour pointer vers :
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/portal`.
   `/auth/callback` sait **déjà** lire `token_hash` : il n'y a rien à coder, seulement à configurer.
   Sans ce changement, le lien ne fonctionne que dans le navigateur qui a déclenché l'envoi.
2. **`get_advisors` : activer la protection contre les mots de passe compromis** (*Authentication >
   Password*). C'est le seul des 15 lints qui se corrige d'un clic, et il est là depuis le début.
3. **Le blocage `approval_mode` sur `Brulerie Lacaze`** (voir plus haut) : soit repasser le client
   en `optional`, soit pousser la branche pour que l'UI mappe enfin `CLIENT_APPROVAL_REQUIRED`.
4. **Deux migrations attendent, NON appliquées** (règle post-BLOC 0) :
   `deploy/28_migration_032.sql` (cycle de vie des invitations — ajoutera **3 WARN 0029** aux
   advisors, attendu et conforme : les trois RPC vérifient `is_org_member` en interne, prouvé par
   les tests 13 et 14) et `deploy/29_migration_033.sql` (lecture média du Reviewer — aucun nouveau
   lint attendu, les 2 fonctions vivent dans `private`). ⚠ La 033 **touche `storage.objects`**.
5. **Pousser la branche.** `chore/phase-0-outillage` porte 15 commits de plus et **la première
   suite de tests de `apps/web`** (34), câblée en job CI bloquant. Aucun run de CI n'a jamais été
   observé au vert : le compte GitHub de la session n'a que la lecture sur le dépôt.
6. **L'upload de médias est le prochain chantier** (P5-6/P5-7). Il exige un Storage réel : soit un
   stack Supabase local sur des ports libres (54321/54322 sont pris par `preventionelectrique`),
   soit ta décision de tester contre le projet en ligne.

### Décisions qui te reviennent

- **P7-6 — mode de connexion du Reviewer (arbitrage produit, non tranché volontairement).**
  `CLAUDE.md` §1 prescrit « magic link desktop / OTP 6 chiffres mobile » ; le code fait
  **password-only**, et `signInWithOtp` n'existe nulle part. Un Reviewer est créé **sans mot de
  passe** : il ne peut donc pas se connecter par le seul chemin qui existe. Le correctif P7-1 est
  délibérément **neutre** là-dessus — il exige une preuve de possession de l'adresse sans imposer
  par quel canal —, donc les trois options restent ouvertes :
  *(a)* garder password-only et faire définir un mot de passe au reviewer à la première visite
  (c'est ce que fait le code aujourd'hui, via le lien de définition de mot de passe : **aucun
  changement pour toi**) ;
  *(b)* ajouter `signInWithOtp` pour les reviewers seulement, en gardant ton propre login par mot
  de passe (conforme à `CLAUDE.md`, ne change rien pour toi, mais double la surface d'auth) ;
  *(c)* basculer tout le monde sur OTP, comme prescrit — **cela change TA connexion**, c'est
  pourquoi je ne l'ai pas fait.
  Ma recommandation : **(a) maintenant, (b) avant le premier vrai client**. Le mot de passe est le
  seul facteur déjà câblé et testé ; l'OTP mobile devient nécessaire quand la PWA iOS arrive
  (le magic link ouvre la session dans Safari, pas dans la PWA installée — anti-pattern §8).
- **FK `publish_jobs.content_target_id` en `restrict`** (ticket P3-8) : non appliquée, avec sa
  justification mesurée. La bascule est prête en commentaire dans `deploy/22_migration_026.sql`.
- **Sortie « rien n'est parti » d'un `needs_verification`** : la direction inverse (« j'ai vérifié,
  republie ») exige d'effacer l'ancre de la règle 15. C'est la fonction la plus dangereuse que ce
  schéma puisse porter ; elle n'est pas écrite. En attendant, l'issue est de republier depuis un
  contenu neuf.
- **Constantes de quota dans `packages/shared`** : elles vivent dans `apps/worker/src/quota.ts`,
  parce que `@ocean/shared` n'est dépendance d'aucune app aujourd'hui. Le câbler touche le workspace
  et l'image Docker du worker — à faire hors d'un ticket de sûreté de publication.

### Vu pendant la nuit, volontairement PAS touché

- `setClientArchived` (`clients.ts:220`) archive un client sans toucher aux jobs de ses contenus :
  ils partiront. Ni changement de statut ni de date, donc hors de portée du helper P4-1 **et** du
  trigger P4-2 — il faut une RPC scopée client.
- `request_target_retry` reste un cul-de-sac (P1 de l'audit) : elle pose `retry_requested_at`, que
  personne ne lit. C'est ce qui a imposé de garder les cibles `failed` **non ancrées** ré-enfilables
  en P3-4.
- `imported_posts.thumb_url` pointe le CDN Instagram, absent de `remotePatterns`. Sans effet
  aujourd'hui (la table n'a aucun écrivain), à ajouter avec l'import de feed (phase 9).
- `draftFromContent` ne remonte pas `crop_preset` : un recadrage enregistré est perdu à la
  réouverture. Sans conséquence tant que rien ne traite l'image.
- Le triple canal du §10 n'existe toujours pas : report de quota, `needs_verification` et
  `SCHEDULED_WITHOUT_JOB` sont **journalisés**, rien de plus.
- **(15/08)** `create_organization` reste accordée à tout `authenticated` : n'importe quel compte
  peut créer une organisation, donc des clients, donc des invitations. C'est ce qui rendait la
  faille P7-1 exploitable par un compte quelconque. Le correctif ferme l'usage (une invitation ne
  donne plus de session), **pas la capacité** : la RPC reste ouverte, ce qui est cohérent avec un
  produit en auto-inscription mais mérite un plafond (nombre d'orgs par compte) avant l'ouverture
  SaaS. Hors périmètre d'un ticket de phase 7.
- **(15/08)** `getReviewerContext` ne lit que `memberships[0]` pour `orgId` et `clientId` : un
  reviewer rattaché à deux clients de deux orgs différentes ne voit correctement que le premier.
  P7-9 empêche désormais le crash sur la liste vide, mais le multi-client reste approximatif.
- **(15/08)** L'invitation est envoyée à l'adresse invitée à **chaque** ouverture du lien sans
  session. C'est volontaire (c'est le seul geste sûr), mais c'est aussi un vecteur d'e-mails
  répétés vers un tiers si quelqu'un rejoue le lien. Les quotas Supabase limitent la casse ;
  un compteur par invitation serait plus propre.
- Commit `a4d031d` : le travail « annotations portail + notifications agence » trouvé **non
  commité** dans l'arbre au démarrage a été commité tel quel, sans relecture, pour que les commits
  de tickets restent atomiques (plusieurs de ses fichiers devaient être touchés par P3-3). Seule
  vérification faite : `tsc --noEmit` passe.
