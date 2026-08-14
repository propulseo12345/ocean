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
