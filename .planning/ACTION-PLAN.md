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

### Phase 5 — Faire entrer les médias · 2 sessions

**Pourquoi ici** : Instagram et Facebook refusent tout post sans média. **Il n'existe aujourd'hui
aucun chemin d'upload** — zéro `<input type="file">` dans les 425 fichiers de `apps/web`, la
drop-zone est un bouton décoratif, et `recordUploadedAsset` (complète, validée) n'a aucun appelant.
Sans cette phase, la phase 6 ne peut pas atteindre son critère de sortie.

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

#### Tickets — suivi d'exécution (partiel : upload TUS non attaqué, comme demandé)

| # | Ticket | Statut | Commit | Preuve |
|---|---|---|---|---|
| P5-1 | `next.config.ts` : dériver l'hôte de l'URL Supabase | ✅ | `c28f77d` | **Le piège était bien là.** Dériver naïvement de `NEXT_PUBLIC_SUPABASE_URL` aurait donné le bon hôte EN LOCAL (Next charge `.env.local` avant d'évaluer `next.config.ts`) et `undefined` EN CONTENEUR — le Dockerfile ne passait aucun build arg. Deux niveaux : `SUPABASE_URL` au build (nouvel `ARG`) → motif exact ; sinon `*.supabase.co`. `search` volontairement non spécifié (les URL signées portent leur jeton en query string ; `search: ''` les rejetterait toutes). **Preuve mesurée sur `.next/required-server-files.json`**, la config réellement embarquée, pour les 3 chemins — sans `.env.local` ni ARG : `*.supabase.co` ; avec l'ARG : `exemple-projet.supabase.co` ; build local : `hgdeopkmkwyoumsfggrm.supabase.co`. |
| P5-2 | Rouvrir un brouillon détache tous ses médias | ✅ | `a69808d` | Chaîne vérifiée de bout en bout, l'hypothèse de l'audit est **confirmée** : `draftFromContent` ne pose aucun `libraryAssetId` → `handleSave` filtre tout → `reconcileMedia` fait son `delete()` puis sort sur un tableau vide. **Ce que l'audit ne disait pas** : `content_comments.annotation_content_media_id` porte `ON DELETE CASCADE` (013:138), donc la suppression efface la **ligne de commentaire entière**, pas seulement l'ancre — un « rouvrir + enregistrer » détruisait le retour de validation annoté du client. Correctif : une ligne, `libraryAssetId: m.id` (l'id de l'ASSET, cf. content-media.ts:118). ⚠ Vu, non corrigé : `crop_preset` n'est pas remonté non plus (absent d'`ASSET_COLUMNS`). |
| P5-3 | Les 3 `reconcile*` ignorent leurs 8 erreurs ; passer au diff | ✅ | `826cd84` | Les 8 écritures sont lues, le premier échec interrompt et remonte. Diff par clé d'identité : compte social / plateforme pour les cibles, **(asset, n-ième occurrence)** pour les médias (`content_media` n'a volontairement pas de `unique(content_item_id, media_asset_id)`, 012:111), id pour les étiquettes. **L'ordre des opérations sur les médias n'est pas décoratif** : supprimer d'abord (sinon le trigger de cardinalité refuse le remplaçant), insérer au-delà de la position max (le `unique(position)` est deferrable mais chaque requête PostgREST est sa propre transaction), puis `reorder_content_media` — la RPC de 012 qui écrit toutes les positions en UNE transaction et **n'avait aucun appelant**. Bénéfice principal : les cibles conservées gardent statut, `external_post_id`, permalien et ancre ; les liaisons médias gardent leur id, donc les annotations. `content.ts` passe de 557 à 457 lignes, 2 modules de 197 et 127. ⚠ Toujours **pas d'atomicité** : la vraie réponse reste une RPC `save_content_item(payload jsonb)`. |
| P5-4 | `applyCrop` réécrit les dimensions sans traiter l'image | ✅ | `ddf1f8d` | Il réécrivait `width`, `height`, `mimeType` et `fileSizeMb` — **exactement les 4 champs que valide le preflight**. Un clic sur « 4:5 » faisait passer au vert un PNG de 12 Mo en 3:4 : le preflight ne validait plus le fichier, il validait le clic. Le mensonge se payait au pire endroit — Meta rejette le fichier réel, erreur permanente, `failed` direct sans retry, sur le compte d'un vrai client. Désormais il pose `crop`, rien d'autre. Conséquence assumée : recadrer ne fait plus disparaître l'avertissement de ratio — c'est honnête, rien n'est recadré. `CROP_PRESETS` → `CROP_TARGET_SIZES` (le nom disait « voici les dimensions », il dit « voici les dimensions à PRODUIRE » : c'est la confusion qui a créé le bug). |
| — | Upload TUS, conversion JPEG/HEIC, vignette WebP | ⛔ **non fait** | — | Hors périmètre demandé : exige du Storage réel et une session dédiée. |

#### État final des commandes de vérification (fin de session, 15/08/2026)

| Commande | Résultat |
|---|---|
| `pnpm -w build` | ✅ `Compiled successfully` |
| `pnpm --filter web exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker exec tsc --noEmit` | ✅ 0 erreur |
| `pnpm --filter worker test` | ✅ **40/40** (22 au début de session) |
| `pnpm check` (arbre LF via `git -c core.autocrlf=false archive`) | ✅ **exit 0** — 437 fichiers, 0 erreur, 17 warnings |
| Rejeu migrations + pgTAP complet (`ocean_rev2`) | ✅ 30 migrations (1 sautée, `*_storage.sql`), 29 fichiers de test, **315 ok / 0 not ok / 0 erreur** (248 au début) |

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

### Phase 8 — OAuth propre · 1 à 2 sessions

**Pourquoi** : connecter Meta pour un client rattache aujourd'hui **toutes** les Pages et comptes
Instagram du compte connecté à ce client-là, avec leurs tokens. Et rien ne permet de détacher.

- Écran de sélection des sous-comptes.
- Action de détachement + révocation du secret dans le Vault (aucun `.delete()` nulle part
  aujourd'hui — passif RGPD).
- Échange long-lived Meta (absent : les tokens meurent en une heure).
- `refresh.ts` réel, appel HTTP **hors** du verrou.
- Ajouter le scope `pages_manage_posts` — sans lui la publication sur Page est refusée, et Meta ne
  rétro-accorde pas un scope.

**Critère de sortie** : deux clients avec deux Pages différentes sont connectés sans mélange, et on
peut en détacher un.

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

## Ce qui attend Étienne après la nuit du 14-15/08/2026

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
   42501. Le défaut de la colonne est `'optional'`, donc rien ne bloque tant qu'un client n'est pas
   explicitement passé en `required`. Le kanban ne grise pas encore le geste.
2. **Recadrer ne fait plus disparaître l'avertissement de ratio** dans le composer. C'est voulu :
   rien n'est recadré tant que le traitement d'image réel n'existe pas.
3. **Une date de programmation dans le passé est refusée** (tolérance 2 min).
4. `saveContentItem`, `scheduleContentItem` et `applyStatusIntent` peuvent désormais renvoyer
   `ok: false` là où elles renvoyaient toujours `ok: true` — un toast d'erreur peut apparaître sur
   des cas qui passaient en silence. C'est le but.

### Décisions qui te reviennent

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
- Commit `a4d031d` : le travail « annotations portail + notifications agence » trouvé **non
  commité** dans l'arbre au démarrage a été commité tel quel, sans relecture, pour que les commits
  de tickets restent atomiques (plusieurs de ses fichiers devaient être touchés par P3-3). Seule
  vérification faite : `tsc --noEmit` passe.
