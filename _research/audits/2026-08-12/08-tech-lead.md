# Audit — Tech lead : séquençage, dette structurante et tenue à 5 ans (DATE-MANQUANTE)

## Verdict

Ocean est **une plateforme bien fondée dont le moteur n'est pas fermé** : les deux couches les plus chères à rattraper plus tard sont faites et bien faites — le schéma (001→021 appliquées, RLS sur 100 % des tables, FK composites, helpers `private.*`, 19 fichiers pgTAP rejoués en CI sur une base recréée de zéro) et le front (entièrement câblé sur Supabase, plus aucun mock). Ce qui manque est la couche qui *exécute* : publishers en stub, aucune surface d'upload, aucun refresh de token, aucun producteur de notification, aucun watchdog, aucun Sentry. Pour un **usage réel immédiat**, la réponse est nette : Ocean ne peut pas encore publier, et le danger principal n'est pas ce qui manque mais **ce qui existe à moitié**. Le point le plus coûteux est un défaut de modèle, pas un bug : l'ancre d'idempotence de la règle 15 (`publish_started_at`) vit sur la **ligne de job**, alors que la chose qu'elle protège — « ce contenu est parti chez le client » — appartient à la **cible** ; or trois chemins normaux (dead-letter par fenêtre de grâce, échec définitif après 5 tentatives, reprogrammation depuis le studio) fabriquent une ligne neuve à `publish_started_at = null`, donc republiable. Deuxième danger immédiat, purement opérationnel : `STUB_MODE` est une constante de compilation, si bien que créer l'app Coolify « worker » — l'étape suivante du runbook — écrira des `status='published'` et des permalinks `https://stub.local/...` dans la base de production. **Risque à 5 ans** : le cœur safety-critical n'a **aucun garde-fou automatisé** (les 7 tests qui prouvent la règle 15 ne tournent dans aucune CI, Biome et le typecheck sont `continue-on-error`, `packages/shared` est orphelin, et le schéma en ligne est alimenté par une seconde source de vérité recopiée à la main dans `deploy/`). Ce n'est pas la charge qui abîmera Ocean, c'est **la dérive silencieuse entre ce que l'app affiche et ce que le moteur fait**.

---

## Fonctionnement réel observé

### 1. Carte des sous-systèmes — ce qui existe vraiment

| Sous-système | État réel | Conséquence pour un usage réel |
|---|---|---|
| Schéma + RLS + pgTAP | 001→021, job CI `db` **bloquant** (reset + pgTAP + advisors + assertion deny-all `*_secrets` + grep d'anti-patterns) | **Le meilleur actif du dépôt.** À préserver tel quel |
| Front web | 100 % Supabase, Server Components, Server Actions Zod | Utilisable, mais affiche des zones **structurellement vides** (feed importé, agenda, quota) |
| File Postgres | claim CTE `FOR UPDATE SKIP LOCKED`, lease 2 min, reaper, backoff + jitter, 7 tests unitaires | Mécanique correcte **jamais exécutée par une CI**, et aucune écriture clôturée par le lease |
| Publishers IG/FB/TikTok | 3 stubs déterministes, `STUB_MODE = true` en constante ([publishers/index.ts:21](../../../apps/worker/src/publishers/index.ts#L21)) | Zéro publication réelle possible + écriture de faux `published` dès le déploiement |
| Tokens OAuth | connexion + Vault + `*_secrets` deny-all : OK. [`tokens/refresh.ts`](../../../apps/worker/src/tokens/refresh.ts) = un helper de verrou et un commentaire | Bombe à retardement : Meta meurt à J+60, TikTok ~24 h |
| Médias | pas de TUS, `next.config` n'autorise que `images.pexels.com` | Aucun média ne peut entrer — et le jour où il entrera, il ne s'affichera pas |
| Notifications / emails | table + cloche UI câblées ; `emit_notification` **sans aucun appelant** depuis le worker | Un échec de publication est **totalement silencieux** |
| Supervision | ni `cron.schedule`, ni `supabase/functions`, ni `@sentry/*` | Temps de détection d'une panne = temps qu'un client met à se plaindre |
| CI | job `db` bloquant ; job `web` avec Biome + typecheck `continue-on-error` ; **aucun job worker** | Le code qui poste chez les clients n'a aucun filet |
| Schéma en ligne | alimenté par `deploy/*.sql`, recopiés à la main | Deux sources de vérité ; 3 divergences déjà présentes |

### 2. La chaîne de publication, telle qu'elle tourne réellement

```
 UI (composer / calendrier / kanban)
   |  Server Action Zod, org_id injecté
   v
 lib/actions/content-status.ts:96   applyStatusIntent   -> rpc('enqueue_publish_jobs')
 lib/actions/content.ts:311         scheduleContentItem -> rpc('enqueue_publish_jobs')
   v
 public.enqueue_publish_jobs()                      [020_publish_jobs.sql:184]
   |  where ct.status not in ('published','canceled','skipped')   <-- 'failed' REPASSE
   |  on conflict (content_target_id) where status in (statuts ACTIFS) do update set run_at
   v
 public.publish_jobs   (RLS select org-only, AUCUNE policy d'écriture ; worker = service_role)
   ^
   |  tick 5 s [index.ts:52] -> reapExpired() puis 10 x claim(), SÉQUENTIELLEMENT
   v
 engine.processJob                                   [engine.ts:27]
     l.34  fenêtre de grâce (2 h)  -> deadLetter        <-- AVANT tout test d'idempotence
     l.42  prepare()  : token Vault brut, TODO refresh, aucune URL signée
     l.50  checkQuota(): `return true` EN DUR, y compris hors stub
     l.61  if (job.publishStartedAt) -> recoverStartedJob   (règle 15, correctement écrite)
     l.65  sinon publishFresh : createContainer -> markPublishStarted -> publish
   v
 publishers/index.ts:21  STUB_MODE = true (constante) -> stub.ts (permalink https://stub.local/…)
   v
 pg-store.succeed() -> content_targets(status, external_post_id, permalink)
                    -> recomputeParent() -> content_items.status
```

Les points d'entrée et la mécanique de file sont justes. Ce sont **l'ordre des gardes** et **la portée de l'ancre d'idempotence** qui ne le sont pas.

### 3. Le défaut de modèle, en une phrase

`publish_started_at` est une colonne de `publish_jobs` ([020:74](../../../supabase/migrations/020_publish_jobs.sql#L74)) ; l'index unique partiel qui interdit deux jobs pour une cible ne couvre que les statuts **actifs** ([020:115](../../../supabase/migrations/020_publish_jobs.sql#L115)). Donc dès qu'un job atteint un état terminal, la protection disparaît avec lui — alors que le fait qu'elle protège (« un POST est peut-être parti chez Meta ») est, lui, définitif. **La durée de vie de la garde est plus courte que la durée de vie du risque.** Tout le reste du finding P0 n°1 découle de là.

### 4. Le motif récurrent : trois demi-systèmes

Le dépôt répète trois fois le même schéma — *la table existe, l'UI existe, le producteur n'existe pas* :

- `retry_requested_at` est écrit par la RPC et par le bouton « Réessayer », **lu par personne** ([016:223](../../../supabase/migrations/016_transitions.sql#L223)) ;
- `imported_posts` / `post_metrics` / `calendar_events` sont lus par la grille, le module Performance, le rapport partageable et l'agenda — **aucun écrivain** ;
- `social_account_quota_usage` est la table de la règle 19 — **aucun écrivain**, et `checkQuota` renvoie `true` en dur ([context.ts:31](../../../apps/worker/src/context.ts#L31)).

Ce n'est pas un oubli isolé : c'est le symptôme d'un dépôt où la couche de persistance a été livrée en avance sur la couche d'exécution. La conséquence produit est uniforme : **des surfaces qui affichent du vide sans dire qu'elles sont vides**, ce qui est le pire mode de panne pour un outil dont la valeur est de savoir ce qui doit partir aujourd'hui.

### 5. Les trois arbitrages d'architecture à trancher **maintenant**, avant le premier publisher réel

1. **Déplacer l'ancre d'idempotence sur `content_targets`.** Une tentative de publication est une propriété de la cible, pas de la ligne technique qui l'a portée. Concrètement : `content_targets.publish_attempted_at` + report de `external_container_id` sur la cible, `enqueue_publish_jobs` refusant toute cible qui porte cette marque, et un statut terminal distinct (`needs_review`) pour « issue inconnue » — que `deadLetter`/`failPermanent` écriront à la place de `failed` quand la marque est posée. Coût aujourd'hui : une migration et trois requêtes. Coût dans six mois : une migration de données sur des lignes déjà référencées en `on delete restrict`.
2. **Un seul ordonnanceur : le worker.** Le worker est déjà un process long-running. Les tâches périodiques (refresh des tokens, import du feed, sync agenda, fenêtre de quota) doivent y vivre, pilotées par une petite table de planification, plutôt que d'ajouter `pg_cron → pg_net → Edge Function` par besoin. **Exception unique et non négociable** : la surveillance du worker lui-même, qui doit être `pg_cron` — un composant ne peut pas être son propre témoin de vie. Ce partage de responsabilité tranche définitivement une ambiguïté du dépôt.
3. **Un seul client HTTP, dans `packages/shared`.** Aucun `fetch` du dépôt n'a de timeout ; les publishers réels seront écrits sur le même modèle. Un helper unique (timeout obligatoire, classification permanent/transitoire, redaction des tokens dans les logs) donne à `packages/shared` sa première raison d'exister et supprime par construction le gel de file décrit plus bas.

### 6. Ce que la CI protège, et ce qu'elle ne protège pas

Le job `db` est exemplaire et bloquant. Le job `web` a `continue-on-error: true` sur Biome **et** sur le typecheck ([ci.yml:130](../../../.github/workflows/ci.yml#L130), [:134](../../../.github/workflows/ci.yml#L134)) ; seule l'étape `pnpm build` bloque, et `pnpm build` vaut `pnpm --filter web build` ([package.json:10](../../../package.json#L10)). **`apps/worker` n'est ni compilé, ni typé, ni testé nulle part.** La seule barrière automatisée du dépôt porte donc sur le SQL ; tout le TypeScript, y compris le code qui poste chez les clients, repose sur la relecture humaine.

---

## Findings (triés par sévérité P0 → P3)

### [P0] L'ancre d'idempotence est posée sur la ligne de job, pas sur la cible : trois chemins normaux fabriquent un job neuf à `publish_started_at` null — go-live : bloquant

- **Où** : [supabase/migrations/020_publish_jobs.sql:195](../../../supabase/migrations/020_publish_jobs.sql#L195) (+ index [:115](../../../supabase/migrations/020_publish_jobs.sql#L115)) ; [apps/worker/src/engine.ts:34](../../../apps/worker/src/engine.ts#L34) ; [apps/worker/src/db/pg-store.ts:218](../../../apps/worker/src/db/pg-store.ts#L218)
- **Constat** : arbitrage de six observations convergentes en **un seul défaut de modèle**, vérifié ligne à ligne. `publish_started_at` vit sur `publish_jobs` ; l'index unique partiel ne couvre que les statuts actifs ; `enqueue_publish_jobs` ré-enfile toute cible dont le statut n'est pas dans `('published','canceled','skipped')` — donc `failed` repasse. Or `deadLetter()` **et** `failPermanent()` écrivent `content_targets.status = 'failed'` ([:218](../../../apps/worker/src/db/pg-store.ts#L218), [:193](../../../apps/worker/src/db/pg-store.ts#L193)) **après** que `markPublishStarted` a commité la marque ([:116](../../../apps/worker/src/db/pg-store.ts#L116)) et lancé le POST. Enfin la fenêtre de grâce est évaluée **avant** le test `job.publishStartedAt` ([engine.ts:34](../../../apps/worker/src/engine.ts#L34) vs [:61](../../../apps/worker/src/engine.ts#L61)) : un job déjà démarré peut mourir sans qu'on ait jamais demandé au conteneur s'il avait publié. Le retour `failed → scheduled` est un chemin UI légal ([016_transitions.sql:78](../../../supabase/migrations/016_transitions.sql#L78), miroité dans [content-status.ts:97](../../../apps/web/lib/actions/content-status.ts#L97)) et rappelle `enqueue_publish_jobs` ([:96](../../../apps/web/lib/actions/content-status.ts#L96)) → job neuf, `external_container_id` nul, `recoverStartedJob` jamais atteint. La règle 15 est correctement écrite dans le moteur, mais elle s'applique à un objet dont la durée de vie est plus courte que celle de la publication qu'elle protège.
- **Scénario d'échec / coût à l'échelle** : chemin le plus court — les 5 tentatives sont consommées (Meta indisponible entre le POST et le `verify`), `failPermanent` écrit `failed` alors que le POST est passé. Étienne voit « échec » dans l'app, reprogramme depuis le studio : deuxième conteneur, deuxième POST, **le client a deux fois le même Reel**. Variante crash : redéploiement Coolify entre `publish` et `succeed()`, puis dead-letter par fenêtre de grâce. Aucun garde-fou ne s'interpose : `succeed()` est le seul writer de `external_post_id`, donc une publication partie mais non commitée ne laisse **aucune trace** exploitable.
- **Pourquoi ça bloque le scaling** : la probabilité d'au moins un doublon par mois tend vers 1 dès quelques dizaines de publications hebdomadaires, et croît avec le nombre de redéploiements. C'est aussi le seul type d'incident dont un client se souvient un an après.
- **Reco** : (1) porter l'ancre sur la cible — `content_targets.publish_attempted_at` (+ `external_container_id`), posé dans la même écriture que `markPublishStarted`, et ajouté au `not in` de [020:195](../../../supabase/migrations/020_publish_jobs.sql#L195) ; (2) inverser l'ordre dans `processJob` : tester `job.publishStartedAt` **avant** la fenêtre de grâce — un job démarré se réconcilie, il ne se dead-letter pas ; (3) `deadLetter()`/`failPermanent()` doivent écrire un statut distinct **non ré-enfilable** (`needs_review`) quand la marque est posée, et non `failed`. À faire **avant** de brancher le moindre POST réel.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 15, 16

### [P0] `STUB_MODE` est une constante de compilation : créer l'app Coolify « worker » écrit de faux `published` et des permalinks `stub.local` dans la base de PROD — go-live : bloquant

- **Où** : [apps/worker/src/publishers/index.ts:21](../../../apps/worker/src/publishers/index.ts#L21) ; [apps/worker/src/publishers/stub.ts:22](../../../apps/worker/src/publishers/stub.ts#L22) ; [apps/worker/src/db/pg-store.ts:146](../../../apps/worker/src/db/pg-store.ts#L146)
- **Constat** : `export const STUB_MODE = true` n'est piloté par aucune variable d'environnement (grep : zéro occurrence de `PUBLISHERS_MODE`). Le stub renvoie `externalPostId: stub-<platform>-post-<uuid>`, `permalink: https://stub.local/...` et `targetStatus: 'published'`, que `succeed()` écrit dans `content_targets` puis propage à `content_items.status` via `recomputeParent` ([:162](../../../apps/worker/src/db/pg-store.ts#L162), [:253](../../../apps/worker/src/db/pg-store.ts#L253)). Rien ne protège : [`env.ts:31`](../../../apps/worker/src/env.ts#L31) ne contrôle que le refus du port 6543 — **aucune barrière d'environnement ne distingue une base locale d'une base de production** ; `prepare()` rend l'absence de token non bloquante en stub ([context.ts:15](../../../apps/worker/src/context.ts#L15)) ; l'absence de credentials Meta ne protège donc de rien. Les jobs sont bien réels, enfilés par l'app ([content.ts:311](../../../apps/web/lib/actions/content.ts#L311)). Ce n'est pas le gotcha « publishers en stub » (décision actée) : c'est **l'absence de garde-fou autour de cette décision**, et le runbook prescrit exactement l'action qui la déclenche ([deploy/GO-LIVE-points-1-2.md:50](../../../deploy/GO-LIVE-points-1-2.md#L50)).
- **Scénario d'échec / coût à l'échelle** : l'app worker est créée sur la `DATABASE_URL` de `hgdeopkmkwyoumsfggrm` ; en quelques ticks, tout contenu programmé passe `published` avec un permalink mort. Le portail montre au client des contenus « publiés » qui n'existent sur aucun réseau. Ce n'est pas un rollback : il faut réécrire à la main l'état métier de chaque cible (les lignes sont heureusement identifiables par `permalink like 'https://stub.local/%'`).
- **Pourquoi ça bloque le scaling** : sans distinction environnement/mode dans le binaire, le même piège se reproduira à chaque nouveau publisher (TikTok, futurs LinkedIn/X) et à chaque worker de staging.
- **Reco** : deux garde-fous d'une heure — (1) `STUB_MODE = process.env.PUBLISHERS_MODE !== 'live'`, et **refus de démarrer** si `PUBLISHERS_MODE` est absent ; (2) dans `env.ts`, refuser explicitement le couple *(stub + base non locale)*. Tant que les credentials Meta ne sont pas approuvés, ne pas déployer le worker sur la base de prod (ou le déployer avec un batch nul — noter que `BATCH_PER_TICK` est aujourd'hui une constante, [index.ts:14](../../../apps/worker/src/index.ts#L14), à passer en env si on veut cette soupape).
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

### [P0] Aucun cycle de vie des tokens OAuth : rien ne rafraîchit, et le plan documenté met l'appel HTTP **dans** la transaction du verrou — go-live : bloquant

- **Où** : [apps/worker/src/tokens/refresh.ts:15](../../../apps/worker/src/tokens/refresh.ts#L15) et [:35](../../../apps/worker/src/tokens/refresh.ts#L35) ; [apps/worker/src/context.ts:18](../../../apps/worker/src/context.ts#L18) ; [apps/web/lib/oauth/tokens.ts:114](../../../apps/web/lib/oauth/tokens.ts#L114)
- **Constat** : `refresh.ts` ne contient que `withAccountLock` (correct : `pg_advisory_xact_lock`, transactionnel) — **zéro appelant** dans tout le dépôt — et un commentaire de plan. `prepare()` lit le token Vault brut avec un `TODO (mode réel) : rafraîchir le token si proche de l'expiration`. `persistConnection` écrit bien `token_expires_at` ([:114](../../../apps/web/lib/oauth/tokens.ts#L114), [:170](../../../apps/web/lib/oauth/tokens.ts#L170)) mais **aucun lecteur n'existe** (grep repo-wide : uniquement des écritures, du DDL et des types). `refreshTokens()` existe côté web ([lib/oauth/index.ts:93](../../../apps/web/lib/oauth/index.ts#L93)) — également sans appelant. Aucun `cron.schedule` en migration. Détail non relevé ailleurs : **le commentaire de plan place le `POST token endpoint` à l'intérieur de `withAccountLock`**, donc dans une transaction Postgres ouverte — violation de la règle 18 inscrite dans la spécification de la correction elle-même.
- **Scénario d'échec / coût à l'échelle** : Meta long-lived = 60 jours, non renouvelé = **perdu définitivement**. Le compteur court **depuis la connexion, y compris en mode stub**, puisque les tokens sont déjà stockés en Vault. À J+60, toutes les publications échouent le même jour ; TikTok (rotation ~24 h) meurt en un jour. La panne n'est pas totalement muette — `failPermanent(needsReauth)` pose `status='needs_reauth'` que la bannière de santé affiche ([pg-store.ts:196](../../../apps/worker/src/db/pg-store.ts#L196)) — mais il n'y a **ni détection proactive, ni email**, donc l'alerte arrive à l'heure H, sur un contenu déjà manqué.
- **Pourquoi ça bloque le scaling** : le coût croît linéairement avec le nombre de comptes **et il est synchronisé** (tous les tokens d'une même session de connexion expirent ensemble) : c'est une panne de masse, pas un bruit de fond. À 20 comptes clients, la reconnexion manuelle devient un travail récurrent non facturable.
- **Reco** : implémenter `refresh.ts` avant tout passage en réel, dans cet ordre : (1) lecture de l'expiry et décision **hors transaction** ; (2) `withAccountLock` uniquement autour de *relecture de l'expiry + `update_integration_secret` + maj des colonnes*, l'appel HTTP restant à l'extérieur (check-then-act sous verrou) ; (3) tâche quotidienne Meta (< 10 j) et à la volée TikTok, portée par la table de planification du worker (arbitrage §5.2) ; (4) échec → `needs_reauth` + Brevo `needs-reauth`. **Corriger d'abord le commentaire de plan** : en l'état il induit la prochaine session en erreur.
- **Effort** : L   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 14, 18

### [P0] L'OAuth Meta rattache TOUTES les Pages/comptes IG du token au seul client courant — aucune étape de sélection — go-live : bloquant

- **Où** : [apps/web/lib/oauth/tokens.ts:178](../../../apps/web/lib/oauth/tokens.ts#L178) ; [apps/web/lib/oauth/identity.ts:74](../../../apps/web/lib/oauth/identity.ts#L74)
- **Constat** : `persistPlatformConnection` boucle sur `resolved.subAccounts` et crée un `social_accounts` par sous-compte avec `client_id = ctx.clientId` — sans filtre. Or `resolveMeta` renvoie **toutes** les Pages de `/me/accounts` + leurs comptes IG business. Le callback persiste puis redirige directement ([callback/route.ts:53](../../../apps/web/app/api/oauth/[provider]/callback/route.ts#L53)) : aucun écran intermédiaire n'existe, et le menu de connexion passe toujours un `clientId` unique ([connect-account-menu.tsx:38](../../../apps/web/components/app/settings/connect-account-menu.tsx#L38)) — **le cas nominal est le cas cassé**. ANALYSE-LANCEMENT §4 exigeait explicitement une « sélection de la Page/compte parmi les accessibles, rattachement au Client » ([ANALYSE-LANCEMENT.md:142](../../../docs/ANALYSE-LANCEMENT.md#L142), repris [PRD.md:482](../../../docs/PRD.md#L482)). Aggravant : aucune action de détachement n'existe (`AccountRow` n'offre que « reconnecter »), donc **le mauvais rattachement est irréversible depuis l'app**.
- **Scénario d'échec / coût à l'échelle** : Étienne, admin des Pages de ses 3 clients, lance la connexion Meta depuis l'espace du client A → 6 lignes `social_accounts` sur le client A. Le composer du client A propose le compte Instagram du client B comme cible légitime ([content/new/page.tsx:68](../../../apps/web/app/(app)/clients/[clientId]/content/new/page.tsx#L68)) : un post peut partir chez le mauvais client. La grille prend en plus `.find(a => a.platform === 'instagram')` sur la liste triée ([grid/page.tsx:191](../../../apps/web/app/(app)/clients/[clientId]/grid/page.tsx#L191)) — la grille et le quota du client A peuvent afficher **silencieusement** le compte d'un autre. Et le Reviewer du client A peut lire ces lignes (policy `is_client_member`, [005:119](../../../supabase/migrations/005_accounts_shell.sql#L119)).
- **Pourquoi ça bloque le scaling** : plus le freelance a de clients dépendant du même admin Meta (cas normal), plus la probabilité de mauvaise cible croît ; à l'ouverture SaaS, un seul compte agence mal rattaché contamine tous ses clients. Ce n'est pas une fuite inter-**org** (RLS et FK composites intacts), c'est un mauvais rattachement intra-org — mais l'effet vu par le client final est identique.
- **Reco** : écran intermédiaire post-callback — persister la connexion **org-level**, lister les sous-comptes découverts, faire choisir explicitement quel sous-compte va sur quel client, puis persister. Garde-fou serveur en attendant : refuser de créer plus d'un `social_accounts` par (client, plateforme) sans confirmation explicite, et livrer une action de **détachement** (aujourd'hui inexistante).
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 13

---

### [P1] Un seul appel HTTP suspendu gèle toute la file, sans fin et sans alerte : heartbeat non borné, tick séquentiel, zéro timeout — go-live : bloquant

- **Où** : [apps/worker/src/index.ts:22](../../../apps/worker/src/index.ts#L22) et [:56](../../../apps/worker/src/index.ts#L56) ; [apps/worker/src/db/pg-store.ts:94](../../../apps/worker/src/db/pg-store.ts#L94) ; [apps/web/lib/oauth/index.ts:80](../../../apps/web/lib/oauth/index.ts#L80)
- **Constat** : trois faits composés. (1) `startLeaseHeartbeat` prolonge le lease toutes les ~40 s **tant que le processus vit**, y compris bloqué dans un `await` réseau : le reaper (condition `lease_expires_at < now()`, [pg-store.ts:78](../../../apps/worker/src/db/pg-store.ts#L78)) ne se déclenchera jamais sur un worker vivant-mais-bloqué. (2) `tick()` traite les jobs **en série** et `main()` attend `tick()` avant le sleep : un job bloqué arrête le reaper **et** tous les autres jobs. (3) Grep sur tout le dépôt : **aucun `AbortSignal`/`AbortController`/timeout**, ni sur les fetch OAuth, ni sur Brevo — et [`pool.ts`](../../../apps/worker/src/db/pool.ts) ne pose ni `statement_timeout` ni `query_timeout`, donc le gel est atteignable **dès aujourd'hui** via une requête Postgres suspendue. Corollaire du non-fencing : `extendLease`, `markPublishStarted`, `succeed`, `retryOrFail`, `failPermanent` sont tous en `where id = $1` sans `worker_id` — si le processus est simplement lent (> 2 min), le reaper libère le job, un second worker le claim, et le premier continue d'écrire dessus.
- **Scénario d'échec / coût à l'échelle** : Graph API ouvre la connexion et ne répond pas. Le worker reste bloqué, le heartbeat prolonge le lease indéfiniment (undici coupe à 300 s, soit un gel de 5 min par appel — bien au-delà du lease de 2 min). Aucune publication ne part, aucun job n'est reapé, **aucun log d'erreur n'est émis** : le worker paraît sain dans Coolify. On l'apprend quand le client demande pourquoi rien n'est sorti de la semaine.
- **Pourquoi ça bloque le scaling** : une file mono-thread sans timeout a un débit borné par le pire appel — à N clients, une seule plateforme lente décale tout le carnet. Et le heartbeat rend le seul mécanisme d'auto-guérison (le reaper) structurellement inopérant.
- **Reco** : trois corrections petites et indépendantes — (1) `AbortSignal.timeout(30_000)` obligatoire sur **tout** fetch, via le helper partagé de l'arbitrage §5.3, plus une règle grep en CI interdisant `fetch(` nu ; (2) borner le heartbeat (N prolongations max, puis on laisse expirer et on log) et poser un timeout global par job dans `runOne` ; (3) fencing : ajouter `and worker_id = $2` aux cinq écritures — 0 ligne affectée signifie « je ne possède plus ce job », il faut abandonner sans écrire.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 17, 18

### [P1] Le premier média réel casse toutes les pages qui l'affichent (`next/image` n'autorise que `images.pexels.com`) — go-live : bloquant

- **Où** : [apps/web/next.config.ts:14](../../../apps/web/next.config.ts#L14)
- **Constat** : `remotePatterns` ne contient que `images.pexels.com` (reliquat de la maquette, plus aucune référence Pexels dans le code). Or `makeMediaUrlResolver` renvoie des URL `<projet>.supabase.co` via `getPublicUrl` sur `media-thumbs` ([content-media.ts:50](../../../apps/web/lib/data/content-media.ts#L50)) et `MediaThumb` les passe à `next/image` ([media-thumb.tsx:36](../../../apps/web/components/shared/media-thumb.tsx#L36)), comme 17 autres composants (grille, médiathèque, composer, portail reviewer, rapport). Aucun loader custom ni `unoptimized` ailleurs.
- **Scénario d'échec / coût à l'échelle** : à la première photo cliente, en **dev** (PORT=3010) Next lève `Invalid src prop … hostname not configured` → page en erreur ; en **prod** Coolify, pas de 500 mais `/_next/image` renvoie `400 "url" parameter is not allowed` et `MediaThumb` retombe sur son placeholder : **aucune vignette réelle ne s'affiche jamais**, sur la grille, la médiathèque, le composer, le portail client et le rapport. Aucun test ne le voit aujourd'hui puisqu'aucun média réel n'existe.
- **Pourquoi ça bloque le scaling** : chaque nouveau host (custom domain Supabase exigé par TikTok photos, CDN) devra être ajouté ici ; sans règle dérivée d'une variable d'env, le piège se reproduira à chaque migration d'infra.
- **Reco** : dériver le pattern de `NEXT_PUBLIC_SUPABASE_URL` (hostname + pathname `/storage/v1/object/public/**`) et retirer Pexels. **À faire avant la passe TUS**, sinon l'upload sera livré avec un affichage cassé.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 20

### [P1] `checkQuota` renvoie `true` en dur même hors stub, et le « report automatique » est une boucle de 60 s qui meurt en dead-letter au bout de 2 h — go-live : dégradé

- **Où** : [apps/worker/src/context.ts:26](../../../apps/worker/src/context.ts#L26) ; [apps/worker/src/db/pg-store.ts:225](../../../apps/worker/src/db/pg-store.ts#L225) ; [apps/worker/src/index.ts:15](../../../apps/worker/src/index.ts#L15)
- **Constat** : `createQuotaChecker` retourne `true` dans les **deux** branches — le `if (opts.stub)` est décoratif, le mode réel tombe sur le même `return true`. La règle 19 n'existe donc pas, et la table prévue (`social_account_quota_usage`, [014:101](../../../supabase/migrations/014_feed_performance.sql#L101)) n'a aucun écrivain. Second défaut, composé : si `checkQuota` renvoyait `false`, `deferForQuota` repousse de `AWAIT_MEDIA_DELAY_MS = 60_000` **sans incrémenter `attempts` ni bouger `run_at`** ; le job reboucle donc toutes les 60 s jusqu'à ce que `now - run_at > 2 h` ([engine.ts:34](../../../apps/worker/src/engine.ts#L34)) et meurt en dead-letter. Le « report automatique au prochain créneau disponible » de la spécification n'existe nulle part.
- **Scénario d'échec / coût à l'échelle** : en mode réel, quota IG atteint → Ocean POST quand même, Meta répond *application request limit reached*, l'erreur est classée transitoire, backoff, 5 tentatives, `failed`. Variante avec le check branché : ~120 réveils inutiles puis dead-letter — le contenu meurt au lieu d'être reporté. Préjudice **présent** (avant les publishers réels) : le widget de quota affiche une valeur inventée à partir d'une table vide.
- **Pourquoi ça bloque le scaling** : c'est LE mécanisme qui empêche Ocean de se faire throttler par Meta. Sans lui, plus il y a de clients derrière une même connexion Meta, plus le **compte applicatif entier** est exposé — donc une panne partagée entre tous les clients d'Étienne.
- **Reco** : (1) implémenter `GET /content_publishing_limit` (IG), le header `X-Business-Use-Case-Usage` (FB) et un compteur local TikTok, en écrivant dans `social_account_quota_usage` (source de vérité DB) ; (2) `deferForQuota` doit reporter `run_at` au prochain créneau réel (`window_resets_at`) et non de 60 s, et émettre `publish-delayed` ; (3) la fenêtre de grâce ne doit pas s'appliquer à un job reporté pour quota — sinon le filet tue ce qu'il devait sauver.
- **Effort** : L   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 19

### [P1] State OAuth : le vérifieur PKCE voyage en clair dans un payload seulement signé, sans expiration ni liaison de session — go-live : dégradé

- **Où** : [apps/web/lib/oauth/state.ts:33](../../../apps/web/lib/oauth/state.ts#L33) ; [apps/web/app/api/oauth/[provider]/callback/route.ts:34](../../../apps/web/app/api/oauth/[provider]/callback/route.ts#L34) ; [apps/web/lib/oauth/tokens.ts:54](../../../apps/web/lib/oauth/tokens.ts#L54)
- **Constat** : `signState` sérialise l'objet complet — **y compris `codeVerifier`** — en base64url puis signe en HMAC : le payload est **lisible**, donc le vérifieur PKCE transite en clair dans l'URL d'autorisation (`usePkce: true` pour tiktok/google/microsoft), dans les logs du provider et dans le `Referer`. Un PKCE dont le vérifieur est public ne protège plus rien. Le state ne porte ni `iat` ni `exp` (le `nonce` n'est stocké nulle part, donc jamais comparé : aucun anti-rejeu), et le callback ne fait **aucun** `supabase.auth.getUser()` : il prend `orgId`/`userId`/`clientId` du state et écrit via `createAdminClient()` (RLS bypassée), sur une route publique au proxy ([proxy.ts:20](../../../apps/web/proxy.ts#L20)). Le state est donc la **seule** autorité.
- **Scénario d'échec / coût à l'échelle** : un state capturé (historique, log de proxy, lien partagé par erreur) reste valide indéfiniment. Un attaquant qui rejoue l'URL d'autorisation avec ce state, en se connectant avec **son** compte Meta, greffe sa connexion sociale dans l'org de la victime — écrite en service_role, hors RLS. Rien ne détecte le rejeu.
- **Pourquoi ça bloque le scaling** : une surface d'authz stateless et sans expiration ne devient jamais plus sûre ; elle sera copiée telle quelle pour chaque nouveau provider ajouté en 5 ans.
- **Reco** : quatre points, moins d'une heure chacun — (1) sortir le `codeVerifier` du state et le mettre dans un cookie httpOnly `SameSite=Lax` court (pattern standard) ; (2) ajouter `exp` (10 min) vérifié dans `verifyState` ; (3) inclure le `sub` de l'utilisateur et le comparer à `getUser()` dans le callback ; (4) rendre le nonce à usage unique.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 13

### [P1] La CI ne protège pas le cœur safety-critical : le worker n'est ni buildé, ni typechecké, ni testé, et Biome/typecheck du web sont non bloquants — go-live : dégradé

- **Où** : [.github/workflows/ci.yml:130](../../../.github/workflows/ci.yml#L130) et [:134](../../../.github/workflows/ci.yml#L134) ; [package.json:10](../../../package.json#L10) ; [apps/worker/package.json:7](../../../apps/worker/package.json#L7)
- **Constat** : le job `db` est excellent et bloquant. Le job `web` a `continue-on-error: true` sur Biome **et** sur `tsc --noEmit` ; seule l'étape `pnpm build` bloque, et elle vaut `pnpm --filter web build`. Il n'existe **aucun job worker** (un seul fichier de workflow, qui s'arrête après le job `web`) : les 7 tests de [`engine.test.ts`](../../../apps/worker/src/engine.test.ts) — dont celui intitulé « RÈGLE 15 : reprise d'un job DÉJÀ publié ⇒ JAMAIS republier » — ne tournent nulle part. Enfin `start` invoque `tsx`, une **devDependency**, et le Dockerfile racine est web-only ([Dockerfile:38](../../../Dockerfile#L38)) : il n'existe aucune image worker.
- **Scénario d'échec / coût à l'échelle** : quelqu'un modifie `recoverStartedJob` et inverse une branche → le job dont `publish_started_at` est posé republie sans interroger le conteneur. **La CI est verte** (elle ne compile même pas le worker), le test qui aurait attrapé la régression n'a pas tourné, et le bug se manifeste par une double publication chez un vrai client. Deuxième conséquence : au premier déploiement Coolify avec un `pnpm install --prod`, le conteneur crash-loop sur `tsx: not found` — sans Sentry ni healthcheck worker, la panne est muette.
- **Pourquoi ça bloque le scaling** : une CI dont les checks sont `continue-on-error` cesse d'être lue en quelques semaines — le commentaire du fichier le dit lui-même. C'est le mécanisme exact par lequel un dépôt bien architecturé dérive : le schéma restera propre (job bloquant), le moteur dérivera (aucun filet).
- **Reco** : dans l'ordre, une demi-journée — (1) job `worker` bloquant : `pnpm --filter worker exec tsc --noEmit` + `pnpm --filter worker test`, **dès maintenant** ; (2) corriger les 2 violations Biome hors périmètre puis retirer les `continue-on-error` ; (3) `pnpm build` doit builder les deux apps, et le worker doit avoir son Dockerfile + un artefact compilé (`tsc`) plutôt que `tsx` au runtime.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 8, 15, 28

### [P1] Aucun canal de retour : le worker n'émet ni notification, ni email, ni trace — échec, dead-letter et report de quota sont silencieux — go-live : dégradé

- **Où** : [apps/worker/src/db/pg-store.ts:209](../../../apps/worker/src/db/pg-store.ts#L209) (+ [:184](../../../apps/worker/src/db/pg-store.ts#L184), [:225](../../../apps/worker/src/db/pg-store.ts#L225)) ; [apps/worker/package.json:12](../../../apps/worker/package.json#L12)
- **Constat** : `deadLetter`, `failPermanent` et `deferForQuota` n'écrivent que dans `publish_jobs` et `content_targets`. Le worker ne dépend que de `pg` : ni supabase-js, ni Brevo, ni insertion dans `notifications`. Vérifié par grep sur tout le dépôt : **aucun `@sentry/*`** dans les 4 `package.json`, **aucun `.channel()` Realtime** dans `apps/web`, et `emit_notification` ([013:764](../../../supabase/migrations/013_collaboration.sql#L764)) n'apparaît sous `apps/` que dans les types générés. Côté Brevo, 4 templates sur 9 sont câblés — **aucun côté publication** (`publish-failed`, `publish-delayed`, `needs-reauth`, `tiktok-draft-ready`, `watchdog-alert` sont déclarés et jamais appelés, [transactional.ts:25](../../../apps/web/lib/brevo/transactional.ts#L25)). CLAUDE.md §10 classe pourtant `publish-failed` comme « canal GARANTI du triple canal ».
- **Scénario d'échec / coût à l'échelle** : le post du mardi 9 h du client A échoue (token révoqué). Le job passe `failed`, la cible passe `failed`, **rien d'autre ne se produit** : pas de ligne dans la cloche, pas d'email, pas de push. Étienne l'apprend le jeudi par son client. Le contrat « 0 publication manquée silencieusement » du PRD est faux.
- **Pourquoi ça bloque le scaling** : le temps de détection d'une panne égale le temps qu'un client met à se plaindre — la seule métrique que ce produit ne peut pas se permettre de dégrader. À N clients, la surveillance manuelle devient impossible alors que le produit promet l'inverse.
- **Reco** : par ordre de rendement — (1) un module `apps/worker/src/notify.ts` : INSERT dans `notifications` via la connexion pg (le worker est déjà `postgres`) + appel Brevo réutilisant les noms de templates de `apps/web/lib/brevo/transactional.ts`, appelé depuis `failPermanent`, `deadLetter` et `deferForQuota`, **hors transaction, best-effort** ; (2) Sentry sur web **et** worker. Le point (1) coûte quelques heures et supprime la classe d'incident la plus coûteuse.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 14

### [P1] Aucun filet indépendant : pas de watchdog, et le reaper abandonne définitivement les jobs à bout de tentatives — go-live : dégradé

- **Où** : [apps/worker/src/db/pg-store.ts:89](../../../apps/worker/src/db/pg-store.ts#L89)
- **Constat** : le répertoire `supabase/functions/` **n'existe pas** et `grep pg_cron|cron.schedule|pg_net` ne renvoie rien dans `supabase/` ni `deploy/`. Or le reaper filtre `attempts < max_attempts` et le commentaire ligne 81 délègue explicitement le reste « au watchdog pg_cron (indépendant, §5) qui notifie » — watchdog inexistant. Le reaper **incrémente lui-même `attempts`** ([:84](../../../apps/worker/src/db/pg-store.ts#L84)), donc un job finit mécaniquement par atteindre `max_attempts` ; au crash suivant il n'est plus reapé, et `claim()` ne sélectionne que `scheduled|retrying|awaiting_media` — il reste **bloqué à vie** en `claimed`/`publishing`, jamais terminal, jamais signalé. Les décisions actées §3.2 (watchdog 1×/5 min) et §3.3 (purge J+7 via `media-cleanup`) sont entièrement absentes.
- **Scénario d'échec / coût à l'échelle** : un job atteint `attempts = 5` puis le conteneur worker est redéployé pendant son traitement. Le contenu n'est jamais publié **et n'apparaît en échec nulle part** — ni dans la file, ni dans l'UI. Deuxième conséquence : les originaux (jusqu'à 300 Mo par Reel) ne sont jamais purgés, le plan de stockage se remplit, et la promesse de rétention J+7 (argument RGPD vis-à-vis des clients finaux) n'est pas tenue.
- **Pourquoi ça bloque le scaling** : sans témoin externe, la file n'a aucun mécanisme capable de dire qu'elle est arrêtée — cf. le gel silencieux décrit plus haut. À N clients, chaque incident devient une enquête manuelle en SQL.
- **Reco** : (1) corriger le reaper — un job à bout de tentatives passe `dead_letter` + notification, il ne reste jamais `claimed` ; (2) créer les deux Edge Functions décidées (`watchdog-notify`, `media-cleanup`) et leurs `cron.schedule` dans une migration dédiée. Conformément à l'arbitrage §5.2, `pg_cron` ne sert **que** de témoin de vie du worker ; tout le reste du périodique va dans le worker.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 18

### [P1] Le bouton « Réessayer » d'une publication en échec ne relance jamais rien — go-live : dégradé

- **Où** : [supabase/migrations/016_transitions.sql:223](../../../supabase/migrations/016_transitions.sql#L223)
- **Constat** : `request_target_retry` pose `retry_requested_at` sur `content_targets` sans changer le statut — c'est le **bon** choix au regard de la règle 15. Mais aucun lecteur n'existe : grep exhaustif, on ne trouve que la RPC, l'action [content-status.ts:161](../../../apps/web/lib/actions/content-status.ts#L161), le composant [content-targets.tsx:51](../../../apps/web/components/app/studio/content-targets.tsx#L51) et les types. Le worker ne connaît pas ce champ, et le claim ne réclame que `scheduled|retrying|awaiting_media` — jamais un job `failed`. L'override visuel `'queued'` du composant est purement cosmétique.
- **Scénario d'échec / coût à l'échelle** : la publication Instagram du client A échoue à 9 h (erreur transitoire Meta). À 9 h 05 Étienne clique « Réessayer » : l'UI confirme, `retry_requested_at` est posé… et rien ne part, jamais. Le seul recours réel est de publier à la main sur Instagram — ce que le produit est censé éviter.
- **Pourquoi ça bloque le scaling** : chaque échec devient une reprise manuelle, et l'intention posée en base s'accumule sans consommateur (dette silencieuse, invisible en lecture de code côté UI).
- **Reco** : ajouter au worker une passe « retry demandés » : sélectionner les cibles avec `retry_requested_at > publish_jobs.failed_at`, créer un **nouveau** job (l'index unique partiel le permet, l'ancien étant terminal) **en recopiant `external_container_id`** pour que la règle 15 s'applique à la reprise, puis effacer `retry_requested_at`. À implémenter **après** le déplacement de l'ancre d'idempotence (P0 n°1), dont il dépend.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 15

### [P1] Le flux OAuth Meta implémente la variante que l'analyse avait explicitement écartée (FB Login v21.0 au lieu d'IG Login) — go-live : dégradé

- **Où** : [apps/web/lib/oauth/config.ts:45](../../../apps/web/lib/oauth/config.ts#L45) ; [apps/web/lib/oauth/identity.ts:14](../../../apps/web/lib/oauth/identity.ts#L14)
- **Constat** : scopes `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management` sur `facebook.com/v21.0/dialog/oauth`, et `graph.facebook.com/v21.0` épinglé. Grep repo-wide sur `graph.instagram.com` : **aucun hit**. ANALYSE-LANCEMENT §2.1 infirme précisément ce choix (« la variante Instagram API with Instagram Login publie photos/carrousels/Reels/Stories **sans Page Facebook** », [ANALYSE-LANCEMENT.md:26](../../../docs/ANALYSE-LANCEMENT.md#L26)), le PRD le reprend mot pour mot, et l'analyse situe l'état de l'art à v25.0 (fév. 2026).
- **Scénario d'échec / coût à l'échelle** : un client dont le compte Instagram business n'est pas relié à une Page Facebook (cas courant) est impossible à connecter — `/me/accounts` ne renvoie rien, `subAccounts` est vide, **aucun `social_accounts` n'est créé**, mais `persistPlatformConnection` réussit et le callback redirige quand même avec `?connected=meta` : succès silencieux, aucun compte publiable, aucune explication. En prime, v21.0 (oct. 2024) sort de la fenêtre de support 2 ans à l'automne 2026 : les appels commenceront à échouer sans changement de code.
- **Pourquoi ça bloque le scaling** : le prérequis implicite « une Page FB par client » devient un frein commercial à l'ouverture SaaS, et chaque montée de version Graph oblige à toucher deux fichiers portant une chaîne en dur.
- **Reco** : trancher explicitement. Soit assumer FB Login et **le documenter comme prérequis d'onboarding client** (+ message d'erreur quand `subAccounts` est vide, au lieu d'un succès silencieux), soit implémenter la variante décidée : un provider `instagram` distinct sur `graph.instagram.com` avec scopes `instagram_business_*`. Dans les deux cas : extraire la version Graph dans une constante partagée et passer à v25.0.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 13

### [P1] L'agenda unifié ne se synchronise jamais : `calendar_events` n'a aucun écrivain — go-live : dégradé

- **Où** : [apps/web/lib/data/pro.ts:794](../../../apps/web/lib/data/pro.ts#L794)
- **Constat** : `calendar_events` n'apparaît qu'une fois dans tout le code applicatif — **en lecture**. Aucune route de sync (`apps/web/app/api` = health, invitations, oauth), aucun module calendrier dans `apps/worker/src`, aucun cron. La vue `unified_agenda` ([015:256](../../../supabase/migrations/015_agenda.sql#L256), correctement en `security_invoker`) n'agrégera donc jamais que des `content_items`. Aggravant : `calendar_calendars` n'a pas non plus d'INSERT (le seul écrivain est un `update is_enabled`), donc le `if (!cal) return []` en aval viderait le résultat même si des events existaient.
- **Scénario d'échec / coût à l'échelle** : Étienne connecte son agenda Google — le flux OAuth fonctionne et écrit bien `calendar_accounts` — ouvre `/agenda` et ne voit **aucun rendez-vous, jamais**. L'agenda unifié est l'une des quatre promesses produit annoncées en tête de CLAUDE.md §0.
- **Pourquoi ça bloque le scaling** : quand la sync arrivera, la fenêtre glissante `[-30 j, +180 j]` et le sweep par `last_sync_run_id` (suppressions sans tombstones) devront être conçus dès le départ, sinon les événements supprimés côté Google resteront affichés indéfiniment.
- **Reco** : une passe périodique dans le worker (arbitrage §5.2) faisant le refetch fenêtré + sweep, plus un sync-on-open débouncé. Le faire après le point 3 TUS, mais **sortir du flou** : aujourd'hui la feature est annoncée et structurellement vide.
- **Effort** : L   **Impact** : moyen
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

### [P1] Aucune ingestion de données plateforme : grille du feed importé et module Performance structurellement vides — go-live : dégradé

- **Où** : [supabase/migrations/014_feed_performance.sql:188](../../../supabase/migrations/014_feed_performance.sql#L188) ; [apps/web/lib/data/pro.ts:549](../../../apps/web/lib/data/pro.ts#L549)
- **Constat** : `imported_posts` et `post_metrics` sont en écriture `service_role` uniquement — décision saine — mais **aucun écrivain n'existe** (ni worker, ni route, ni Edge Function ; `supabase/functions` n'existe pas). Les seuls consommateurs sont la grille ([grid/page.tsx:179](../../../apps/web/app/(app)/clients/[clientId]/grid/page.tsx#L179)) et Performance/rapport ([perf-data.ts:205](../../../apps/web/lib/data/perf-data.ts#L205)). Or la décision actée §6 n°3 place l'import du feed IG **au MVP**, précisément parce que « la promesse de la grille est vide si elle ne montre que les posts créés dans l'app ».
- **Scénario d'échec / coût à l'échelle** : Étienne connecte le compte Instagram d'un client qui a déjà 300 posts. La grille d'aperçu n'affiche que les contenus créés dans Ocean — une grille quasi vide qui ne ressemble en rien au vrai feed, donc inutilisable pour juger l'harmonie. Le rapport mensuel (`/clients/[id]/report`, partageable publiquement via `/r/[token]`) affiche des zéros réels : livrable inexploitable. À porter au crédit du code : il **n'invente pas** de chiffres (le vide est assumé, avec un « — » neutre au lieu d'un faux delta).
- **Pourquoi ça bloque le scaling** : conçu tard, l'import devient un batch qui sature le rate limit **partagé avec la publication** (règle 19) et devra gérer la pagination Graph.
- **Reco** : deux passes périodiques `service_role` dans le worker : import `GET /media` à la connexion puis 1×/jour (upsert sur `(social_account_id, external_post_id)`), et collecte d'insights. **Tant que ce n'est pas fait, masquer explicitement les modules Performance/Rapport** plutôt que d'envoyer un rapport à zéro à un client.
- **Effort** : L   **Impact** : moyen
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

### [P1] CLAUDE.md et AGENTS.md décrivent une phase révolue et contredisent le code sur trois décisions structurantes — go-live : dégradé

- **Où** : [CLAUDE.md:16](../../../CLAUDE.md#L16) (+ [:6](../../../CLAUDE.md#L6), [:34](../../../CLAUDE.md#L34), [:42](../../../CLAUDE.md#L42)) ; [AGENTS.md:16](../../../AGENTS.md#L16)
- **Constat** : l'en-tête et §0 imposent « **PREVIEW FRONT — UI seule, données mockées** […] ne PAS câbler Supabase (auth/DB/RLS/storage), ni remote GitHub, ni Meta/TikTok/Brevo » et « la couche données = mocks typés dans `packages/shared` » — alors que Supabase est câblé de bout en bout, `lib/mocks` supprimé, 21 migrations en ligne, le repo poussé sur GitHub et déployé sur Coolify. §1 impose « magic link desktop, OTP 6 chiffres mobile » alors que [`(auth)/actions.ts:31`](../../../apps/web/app/(auth)/actions.ts#L31) acte littéralement l'inverse en commentaire (« décision : password only, pas d'OTP »). §1 dit « i18n : FR only au MVP » alors qu'un système FR/EN complet est livré. AGENTS.md porte exactement les mêmes phrases périmées. Dérive supplémentaire sur la même page : « pnpm 9+ » alors que le dépôt est en pnpm 11.
- **Scénario d'échec / coût à l'échelle** : toute nouvelle session d'agent (ou tout futur dev) lit un fichier qui se déclare prioritaire sur tout — « These instructions OVERRIDE any default behavior » — en conclut qu'il doit re-mocker les données ou « corriger » l'auth vers l'OTP, et **défait du travail correct**. Le risque n'est pas théorique : c'est exactement ce que ce document ordonne.
- **Pourquoi ça bloque le scaling** : un document de règles qui ment une fois n'est plus consulté du tout — et ce sont les règles 1 à 23, celles qui protègent le multi-tenant, qui perdent leur autorité avec lui.
- **Reco** : passe de mise à jour immédiate, dans un seul commit couvrant CLAUDE.md **et** AGENTS.md : §0 = phase réelle (« phase solo, backend câblé ; restes : TUS, publishers réels, notifications »), §1 auth = mot de passe + reset (avec la justification PWA iOS), §1 i18n = FR/EN livré, §1 `packages/shared` = état réel, pnpm 11. Ajouter une date de dernière relecture, et en faire une étape de la checklist « avant deploy ».
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

---

### [P2] Reprogrammer un contenu dont le job est en `retrying` ne réarme ni le backoff ni le compteur de tentatives — go-live : dégradé

- **Où** : [supabase/migrations/020_publish_jobs.sql:196](../../../supabase/migrations/020_publish_jobs.sql#L196) ; [apps/worker/src/db/pg-store.ts:62](../../../apps/worker/src/db/pg-store.ts#L62)
- **Constat** : le `on conflict (content_target_id) … do update set run_at = excluded.run_at, updated_at = now()` ne touche ni `next_attempt_at`, ni `attempts`, ni `status`. Or le claim exige `run_at <= now() AND (next_attempt_at is null or next_attempt_at <= now())`. Un job en `retrying` porte un `next_attempt_at` issu du backoff et un `attempts` déjà consommé : reprogrammer ne fait que déplacer `run_at`, la barrière de backoff reste en place et le budget de tentatives reste entamé. Le chemin est bien atteint (`scheduleContentItem` écrit `scheduled_at` puis appelle la RPC sans annuler).
- **Scénario d'échec / coût à l'échelle** : un post échoue quatre fois ; `attempts = 4`, barrière de quelques minutes. Étienne le reprogramme pour dans 5 minutes ; l'UI confirme. Le job part en retard et **meurt au premier échec transitoire** alors qu'il vient d'être reprogrammé comme neuf. Symptôme utilisateur : « je l'ai reprogrammé et il est parti à la mauvaise heure, puis il est mort ».
- **Pourquoi ça bloque le scaling** : l'écart entre ce que l'UI promet et ce que la file fait est exactement la dérive qui rend une plateforme non diagnosticable à 3 ans — chaque incident coûte une session de lecture de SQL.
- **Reco** : dans le `do update`, remettre le job à neuf (`status='scheduled'`, `attempts=0`, `next_attempt_at=null`, `step=null`, `last_error=null`) **mais uniquement `where publish_jobs.publish_started_at is null`** (règle 15). Le cas contraire doit remonter une erreur explicite à l'app, pas être silencieusement ignoré.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 15, 18

### [P2] Rien n'empêche la même Page Meta d'être rattachée à plusieurs clients, et le quota serait alors compté deux fois pour un seul objet réel — go-live : après

- **Où** : [supabase/migrations/005_accounts_shell.sql:52](../../../supabase/migrations/005_accounts_shell.sql#L52) ; [supabase/migrations/014_feed_performance.sql:117](../../../supabase/migrations/014_feed_performance.sql#L117) ; [apps/web/lib/oauth/tokens.ts:208](../../../apps/web/lib/oauth/tokens.ts#L208)
- **Constat** : prolongement schéma du P0 n°4. L'unicité de `social_accounts` est `unique (client_id, platform, provider_account_id)` et l'upsert utilise exactement cette clé : une même Page connectée depuis deux clients crée **deux lignes légitimes**. Or `social_account_quota_usage` a pour clé primaire `(social_account_id, quota_kind)` : Ocean tiendrait deux compteurs pour un seul objet Meta, alors que Meta compte par IG user / par Page. **L'unité d'enforcement de la règle 19 n'est pas alignée sur l'unité de limitation de la plateforme.**
- **Scénario d'échec / coût à l'échelle** : le défaut est réel pour les compteurs **locaux** (FB Reels 30/24 h, TikTok 5/24 h) : Ocean autoriserait 2 × le plafond, la seconde moitié échouerait en bloc sur une erreur de rate limit classée « transitoire » et retentée, aggravant le throttling du compte applicatif entier. (Pour IG, un appel direct à `content_publishing_limit` renverrait le même compteur pour les deux lignes — le trou est donc partiel.)
- **Pourquoi ça bloque le scaling** : défaut typique invisible à 1 client et structurel à 10 ; il faudra alors migrer les compteurs et dédupliquer des lignes déjà référencées par `content_targets` et `publish_jobs` en `on delete restrict` — migration douloureuse.
- **Reco** : ajouter `unique (org_id, platform, provider_account_id)` sur `social_accounts` (une Page appartient à **un** client dans une org) et faire porter le quota par le couple `(platform, provider_account_id)` plutôt que par `social_account_id`. Si le multi-client d'une Page devait rester un besoin, la clé du quota **doit** au minimum être l'identifiant plateforme. À trancher maintenant : ces deux tables sont déjà référencées en RESTRICT.
- **Effort** : M   **Impact** : moyen
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 19

### [P2] Les trois zones les plus sensibles du schéma n'ont aucun test pgTAP : isolation des médias, seule surface `anon`, correctif de la faille Vault — go-live : après

- **Où** : [supabase/tests/](../../../supabase/tests) (19 fichiers, aucun pour 012_media_storage / 017 / 018 / 021) ; [scripts/run-pgtap.sh:23](../../../scripts/run-pgtap.sh#L23) ; [supabase/migrations/012_media_storage.sql:3](../../../supabase/migrations/012_media_storage.sql#L3)
- **Constat** : le socle pgTAP est le meilleur actif du dépôt, mais sa couverture s'arrête exactement là où le risque est maximal. (a) `012_media_storage.sql` porte les policies `storage.objects`, **unique mécanisme d'isolation des médias** (règle 21) — le runner local saute délibérément tout `*_storage.sql` et aucun test ne les couvre (la CI, elle, les **applique** via `supabase db reset` : le trou est l'absence de test, pas le skip). (b) `018_report_shares.sql` expose `get_report_share` à `anon` ([:81](../../../supabase/migrations/018_report_shares.sql#L81)) — seule surface non authentifiée de la plateforme, sans un seul test. (c) `021_secdef_grants_hardening.sql` est le correctif de la faille réelle « anon pouvait écrire dans Vault » et n'a pas de test de non-régression dédié — à noter que [019_integration_secrets.test.sql:39](../../../supabase/tests/019_integration_secrets.test.sql#L39) couvre déjà **2 des 4** fonctions par `has_function_privilege`, ce qui prouve que le pattern de test existe et qu'il suffit de l'étendre.
- **Scénario d'échec / coût à l'échelle** : un futur `create or replace function public.store_integration_secret(...)` **avec un paramètre en plus** crée une nouvelle signature, qui hérite des default privileges Supabase et redonne EXECUTE à `anon`. La CI passe au vert : le garde-fou n'inspecte que `role_table_grants`. La faille corrigée hier revient sans un seul signal.
- **Pourquoi ça bloque le scaling** : sur 5 ans, une règle non testée finit par être violée. Ces trois zones sont précisément celles où la violation est **silencieuse et coûteuse** (fuite de média inter-client, lien public, écriture Vault).
- **Reco** : trois fichiers de test, quelques heures — `012_media_storage.test.sql` (org A ne lit pas un objet de org B, client A ne lit pas client B ; à jouer dans la CI GitHub qui a le vrai schéma storage) ; `018_report_shares.test.sql` (token révoqué/expiré → null, token inconnu → null, `anon` n'atteint aucune table) ; `021_*.test.sql` assertant `has_function_privilege('anon', …) = false` sur les 4 fonctions. Et étendre le garde-fou CI de `role_table_grants` à `information_schema.role_routine_grants`.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 8, 11, 21

### [P2] `deploy/*.sql` diverge de `supabase/migrations/` et rien ne vérifie que le schéma en ligne correspond au dépôt — la dérive a déjà commencé — go-live : après

- **Où** : [deploy/15_migration_020.sql](../../../deploy/15_migration_020.sql) vs [supabase/migrations/020_publish_jobs.sql:217](../../../supabase/migrations/020_publish_jobs.sql#L217) ; [deploy/14_migration_019.sql:19](../../../deploy/14_migration_019.sql#L19)
- **Constat** : diff normalisé des 12 couples 010→021 : **trois divergences réelles**. `deploy/15` révoque `enqueue_publish_jobs`/`cancel_publish_jobs` `from public` seul là où la migration de référence révoque `from public, anon, authenticated` — la base en ligne a donc, un temps, exposé ces fonctions à `anon` (rattrapé par chance par 021). Plus grave et non repéré jusqu'ici : `deploy/14` fait la même omission sur `store_integration_secret`/`update_integration_secret`, c'est-à-dire **le chemin d'écriture Vault**, exactement la faille que l'en-tête de 021 décrit. `deploy/15` perd aussi les `comment on` de 020, et `deploy/03` ajoute des wrappers d'idempotence absents de 010. Le problème n'est pas ces écarts précis (refermés) : c'est qu'ils **aient pu exister sans être détectés** — la CI valide `supabase/migrations/`, la production exécute `deploy/`, et rien ne compare les deux ni ne compare la production au dépôt.
- **Scénario d'échec / coût à l'échelle** : une prochaine transcription manuelle omet un `revoke`, une policy ou une contrainte. La CI reste verte — elle teste l'autre fichier. L'écart ne se manifeste qu'à l'incident, potentiellement des mois plus tard, sur la seule base qui contient de vraies données clients.
- **Pourquoi ça bloque le scaling** : deux sources de vérité pour un schéma, l'une jouée par une machine et l'autre par un humain. Sur 5 ans et 60 migrations, la divergence est **certaine**. C'est la dette la moins visible et la plus chère à résorber du dépôt.
- **Reco** : supprimer la seconde source de vérité dès que possible — `supabase db push` / `supabase migration up --linked` depuis un runner CI avec un token de service, plutôt qu'un copier-coller manuel. En attendant, deux filets peu coûteux : (1) **générer** `deploy/*.sql` par script depuis `supabase/migrations/` (concaténation + begin/commit) et faire échouer la CI si le fichier généré diffère du fichier commité ; (2) un script de drift comparant le catalogue en ligne (policies, grants, index) à celui de la base CI recréée de zéro.
- **Effort** : M   **Impact** : moyen
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

### [P2] Le worker désactive la vérification du certificat TLS sur la connexion qui lit le Vault — go-live : dégradé

- **Où** : [apps/worker/src/db/pool.ts:17](../../../apps/worker/src/db/pool.ts#L17) ; [apps/worker/src/db/secrets.ts:9](../../../apps/worker/src/db/secrets.ts#L9)
- **Constat** : `ssl: isLocal ? false : { rejectUnauthorized: false }`. C'est la connexion qui, sur le même socket, exécute `select decrypted_secret from vault.decrypted_secrets` : **tous les tokens OAuth en clair de tous les clients transitent par là** (`loadAccessToken` est appelé inconditionnellement, avant même le fallback stub). Le trafic est chiffré mais l'identité du serveur n'est pas vérifiée, et la connexion sort du VPS Coolify vers Supabase par l'internet public (le runbook documente une `DATABASE_URL` sans `sslmode`).
- **Scénario d'échec / coût à l'échelle** : un attaquant en position d'interception (DNS empoisonné sur le VPS, compromission d'un relais) présente n'importe quel certificat : la connexion est acceptée, et il obtient à la fois les tokens OAuth déchiffrés de tous les clients et un accès `postgres` à la base. Exploitation difficile — d'où P2 — mais impact total, et c'est précisément le scénario contre lequel la règle 12 protège.
- **Pourquoi ça bloque le scaling** : ce réglage se propage par copier-coller à tout nouveau service qui se connecte à la base ; le corriger tôt coûte une ligne, le corriger tard suppose d'auditer N services.
- **Reco** : fournir la CA Supabase au pool (`ssl: { ca: fs.readFileSync(process.env.PGSSLROOTCERT) }` avec `rejectUnauthorized: true`), ou `sslmode=verify-full` dans la chaîne de connexion. Une ligne + une variable Coolify, à faire **avant** que de vrais tokens n'existent.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 12

---

### [P3] `packages/shared` est une coquille vide : enums et types dupliqués en trois exemplaires sans lien de compilation — go-live : après

- **Où** : [packages/shared/src/types/domain.ts:1](../../../packages/shared/src/types/domain.ts#L1)
- **Constat** : le package contient 6 alias de types (7 lignes ; `schemas/index.ts` = `export {}`) et **n'est importé nulle part** (grep `@ocean/shared` dans `apps/` → 0 résultat). Les mêmes valeurs vivent en trois copies indépendantes : [`apps/web/lib/domain/core.ts`](../../../apps/web/lib/domain/core.ts), [`apps/worker/src/domain.ts:4`](../../../apps/worker/src/domain.ts#L4) et `apps/web/lib/supabase/types.ts` (1 892 lignes maintenues **à la main**). CLAUDE.md §1/§4 lui attribuent pourtant « types DB, schémas Zod, constantes plateformes » partagés web+worker, et §10 prévoit d'y mettre le module Brevo.
- **Scénario d'échec / coût à l'échelle** : chaque constante plateforme (quotas, formats médias, mapping de statuts) devra être écrite deux fois — une fois pour l'UI qui l'affiche, une fois pour le worker qui l'applique — sans aucun lien de compilation entre les deux, et sans CI qui type le worker. La divergence ne produira pas une erreur, elle produira un affichage faux. *(Le scénario « le worker republie sur un statut inconnu » ne tient pas : la branche `else` de `recoverStartedJob` porte sur le `ContainerStatus` Graph, pas sur les enums DB.)*
- **Pourquoi ça bloque le scaling** : chaque nouvelle plateforme ou statut se paie en trois éditions manuelles synchronisées de mémoire ; à 5 ans, la divergence est certaine.
- **Reco** : faire de `packages/shared` la source unique des enums (recopiés depuis les migrations avec un test de cohérence), l'importer depuis le worker **et** le web, y déplacer le client Brevo et le helper `fetch` de l'arbitrage §5.3. Étape suivante : réparer la génération de `lib/supabase/types.ts` et la vérifier en CI contre la base locale du job `db`.
- **Effort** : M   **Impact** : moyen
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

---

## Séquencement recommandé (plan d'implémentation)

Quatre portes. Aucune ne s'ouvre avant que la précédente ne soit fermée — c'est le seul moyen d'éviter qu'un correctif soit invalidé par le suivant.

**Porte 0 — avant de créer l'app Coolify « worker » (≈ 1 jour).** Elle protège la base de production contre son propre outillage.
1. `STUB_MODE` piloté par `PUBLISHERS_MODE` + refus de démarrer sans, et refus du couple *(stub + base distante)* — P0 n°2.
2. Job CI `worker` bloquant (`tsc --noEmit` + `node --test`) — P1 CI. Sans lui, rien de ce qui suit n'est protégé contre une régression.
3. TLS `verify-full` sur le pool — P2, une ligne, à faire avant qu'un vrai token n'existe.

**Porte 1 — avant le premier POST réel chez un client (≈ 1 semaine).** C'est le bloc « on ne publie jamais deux fois, et on sait quand ça rate ».
4. Ancre d'idempotence sur `content_targets` + inversion de l'ordre dans `processJob` + statut `needs_review` — P0 n°1. **Premier**, car les points 6, 8 et 9 se greffent dessus.
5. Fencing par `worker_id`, timeouts obligatoires (helper partagé), heartbeat borné — P1 gel de file.
6. `notify.ts` : notification in-app + Brevo sur `failPermanent`/`deadLetter`/`deferForQuota` — P1 canal de retour.
7. Cycle de vie des tokens : refresh quotidien Meta / à la volée TikTok, HTTP **hors** verrou — P0 n°3.
8. Quota réel (règle 19) + report au prochain créneau, exempté de fenêtre de grâce — P1 quota.
9. Reaper corrigé (jobs à bout de tentatives → `dead_letter` + notif) + watchdog `pg_cron` — P1 filet indépendant.

**Porte 2 — avant d'ouvrir Ocean à un vrai client (≈ 1 semaine).** C'est le bloc « ce que l'utilisateur voit est vrai ».
10. `next.config` dérivé de `NEXT_PUBLIC_SUPABASE_URL` — **avant** la passe TUS, sinon l'upload est livré cassé.
11. Upload TUS + conversion JPEG/HEIC + vignette WebP (point 3 du handoff) + URL signées 48 h à la publication.
12. Écran de sélection des sous-comptes Meta + action de détachement — P0 n°4, et unicité `(org_id, platform, provider_account_id)` — P2.
13. Passe « retry demandés » (dépend du point 4) — P1 bouton Réessayer.
14. Arbitrage explicite FB Login vs IG Login + version Graph en constante — P1.
15. Mise à jour de CLAUDE.md/AGENTS.md — P1 doc périmée. Peu coûteux, mais à faire **avant** la prochaine session d'agent, pas après.

**Porte 3 — dette de fond, avant l'ouverture SaaS.**
16. Suppression de la seconde source de vérité `deploy/` (génération + drift check) — P2.
17. Tests pgTAP storage / report_shares / grants de fonction — P2.
18. `packages/shared` comme source unique (enums, Brevo, helper fetch) + génération vérifiée de `supabase/types.ts` — P3.
19. Ingestion du feed IG et sync agenda — P1 ×2. **En attendant, masquer les modules Performance/Rapport/Agenda** plutôt que d'afficher du vide à un client : c'est un correctif d'une heure qui supprime la seule catégorie de mensonge que l'app produit aujourd'hui.

---

## Annexe — pistes non vérifiées

Aucune. Tous les findings listés ci-dessus ont survécu à la passe de réfutation adversariale, avec un fichier:ligne relu. Les corrections apportées par cette passe sont intégrées dans les constats (notamment : `next/image` renvoie 400 en prod et non 500 ; la fenêtre de grâce n'est pas le chemin le plus court vers la double publication, `failPermanent` l'est ; l'échec de token n'est pas totalement muet grâce à la bannière `needs_reauth` ; les compteurs de quota dupliqués ne concernent que les compteurs locaux ; la branche `else` de `recoverStartedJob` porte sur le `ContainerStatus` Graph et non sur les enums DB).

---

## Ce qui va bien (à préserver)

- **Le schéma et sa suite de tests.** RLS sur 100 % des tables, helpers `private.*` SECURITY DEFINER, policies `TO authenticated` wrappées `(select fn())`, FK composites qui rendent la fuite inter-tenant **physiquement** impossible, 19 fichiers pgTAP rejoués en CI sur une base recréée de zéro, plus un garde-fou grep d'anti-patterns et une assertion deny-all sur les `*_secrets`. C'est l'actif principal du dépôt et le job CI le plus exigeant : **ne pas l'assouplir**, l'étendre.
- **La file Postgres.** Claim atomique CTE `FOR UPDATE SKIP LOCKED`, lease + reaper, backoff exponentiel avec jitter, horloge = `now()` Postgres remontée au moteur, refus explicite du port 6543 dans `env.ts`. La décision « pas de Redis/BullMQ » est tenue et bien tenue.
- **La séparation état technique / état métier.** `publish_jobs` porte l'exécution, `content_targets` l'état par plateforme, `recomputeParent` agrège au niveau `content_items` avec un `partially_published` correct. C'est la bonne modélisation ; le P0 n°1 consiste à y **ajouter** l'ancre d'idempotence, pas à la refondre.
- **La discipline des secrets.** Tokens en Vault, tables `*_secrets` en deny-all, `createAdminClient` cantonné au serveur, `revoke all … from anon, authenticated` avant les grants (motif TRUNCATE), et deux migrations de durcissement (017, 021) qui montrent que le sujet est pris au sérieux.
- **L'honnêteté du code sur ses propres trous.** `cancel_publish_jobs` respecte la règle 15 (`publish_started_at is null`), `request_target_retry` refuse de changer le statut pour la même raison, `perf-data.ts` affiche un « — » neutre plutôt qu'un faux delta, et les TODO du worker désignent précisément ce qui manque. Un dépôt qui documente ses angles morts est un dépôt réparable — c'est ce qui rend ce plan exécutable en trois semaines plutôt qu'en trois mois.
