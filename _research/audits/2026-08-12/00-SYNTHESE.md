# Audit Senior Ocean — Synthese (2026-08-12)

> Synthese de 11 dimensions (~520 agents, verification adversariale par dimension).
> Sources : `01-architecture` `02-refacto-propre` `03-debug-production` `04-performance` `05-clean-architecture`
> `06-backend-systems` `07-frontend` `08-tech-lead` `09-securite` `10-devops` `11-go-live`.
> Baseline : main 8a1d8b5, migrations 001->021 appliquees en ligne (hgdeopkmkwyoumsfggrm), web live sur sslip.io,
> `pnpm -w build` vert en local. **Rien n'a ete modifie : ce document est un rapport, pas un patch.**

---

## Verdict go-live

**Non. Ocean ne peut pas encore gerer un vrai client de bout en bout.** Apres deduplication des 11 passes,
il reste **9 chantiers bloquants** — et trois d'entre eux ne sont pas des bugs mais des trous fonctionnels :
il n'existe **aucun chemin d'upload de media** (zero `<input type="file">` dans les 425 fichiers de `apps/web`,
`recordUploadedAsset` orpheline), le **portail client n'ouvre jamais de session** (l'invitation redirige vers un
`action_link` GoTrue dont les jetons arrivent dans un fragment que personne ne lit), et **l'app Coolify worker
n'existe pas**. Instagram et Facebook refusant tout post sans media, la chaine creation -> publication est
physiquement impossible aujourd'hui, independamment de l'etat des publishers.

Pire que « rien ne part » : **si tu crees l'app worker en suivant le runbook actuel, tu casses la prod**.
`STUB_MODE = true` est une constante de compilation sans garde d'environnement ; le worker ecrira
`content_targets.status='published'` avec un permalink `https://stub.local/...` sur de vrais contenus, etat que
`enqueue_publish_jobs` exclut definitivement du re-enfilement (reparation = SQL service_role).

Effort global estime : **25 a 30 jours-homme**, soit **5 a 7 semaines** en solo a temps plein.
Deux chantiers demandent une decision de ta part avant d'etre executables (domaine definitif, creds Meta/TikTok).

**Verdict : pas encore utilisable en reel.** Le socle (schema multi-tenant, RLS, file Postgres, Vault) est solide
et conforme — ce qui manque est du cablage terminal, pas de l'architecture.

---

## Ce qui marche deja pour de vrai

Parcours reellement fonctionnels aujourd'hui, verifies ligne a ligne :

- **Connexion mot de passe** (`login-form.tsx` -> `signInWithPassword`), proxy fail-closed avec allowlist explicite
  (`proxy.ts:52-60`), session rafraichie a chaque requete.
- **Creation d'un client via le wizard** (`clients/new`) : ecrit reellement `clients`, `content_pillars`,
  `recurring_slots`, `brand_kits` — sauf l'etape 2 « comptes sociaux » qui est decorative.
- **Studio / composer / kanban / calendrier / grille** : entierement cables sur Supabase, zero mock. Creation,
  edition, transitions de statut, drag kanban et programmation par lot ecrivent vraiment.
- **Machine a etats du contenu** : gouvernee en base (`008`, `013`, `016`), pas dans l'UI. Le drag vers « Programme »
  cree reellement les `publish_jobs`.
- **Portail de validation, une fois la session posee a la main** : lecture des contenus, annotations epinglees,
  `submitReviewDecision`, `postComment` — tout ecrit et notifie correctement.
- **OAuth jusqu'a l'ecriture du token** : Route Handlers custom, state signe, echange de code, token chiffre dans
  Vault derriere `*_secrets` deny-all. Aucun token n'atteint le navigateur (verifie, pas suppose).
- **Le moteur de publication en local** : claim atomique, lease, reaper, backoff, et 7 tests unitaires verts
  (`pnpm --filter worker test` : 7/7 en 136 ms).

### Les bonnes decisions a ne pas casser

1. **Le schema multi-tenant.** `org_id` denormalise partout, RLS sur 100 % des tables, FK composites
   `UNIQUE(id, org_id)` / `UNIQUE(id, client_id)` qui rendent la fuite inter-tenant **physiquement** impossible,
   helpers `private.*` SECURITY DEFINER a `search_path` fige, policies `TO authenticated` wrappees `(select fn())`.
   19 fichiers pgTAP (231 tests). Toute tentative de « simplifier » (claims JWT, policies avec jointure) doit etre refusee.
2. **La file Postgres, pas Redis.** Claim CTE `FOR UPDATE SKIP LOCKED`, lease + reaper, horloge = `now()` Postgres,
   refus explicite du port 6543 dans `env.ts:36`. La decision est tenue et bien tenue.
3. **La separation etat technique / etat metier.** `publish_jobs` = execution, `content_targets` = etat par plateforme,
   `recomputeParent` = agregat. Bonne modelisation — les correctifs s'y **ajoutent**, ne la refondent pas.
4. **Le decoupage ports/adaptateurs du worker.** `engine.ts` ne connait que l'interface `JobStore` : c'est ce qui rend
   la regle 15 testable sans base ni reseau.
5. **La facade de lecture `lib/data`** : `server-only`, re-export nominatif (jamais `export *`, avec la raison ecrite),
   `org_id` en premier argument, `cache()` par lecture. Il manque les bornes et la remontee d'erreur, pas la structure.
6. **La DAL Next 16** : `verifySession` sur `auth.getUser()` (JWT revalide, pas `getSession()`), `getActiveOrg` qui
   redirige au lieu de renvoyer `null`, org active depuis un cookie httpOnly **revalide** contre `organization_members`.
7. **`cancel_publish_jobs`** applique la regle 15 a la lettre (`and publish_started_at is null`, `020:249`) — c'est la
   reference a laquelle aligner `engine.ts`.
8. **L'honnetete du code sur ses propres trous** : les commentaires designent les invariants par leur numero de regle,
   les libelles « (apercu) » (151 occurrences) tracent les gestes non cables. Beaucoup de findings ont ete trouves
   **grace** a cette discipline. A conserver.

---

## Les chantiers BLOQUANTS

Ordonnes par sequence d'execution. Chaque porte doit etre fermee avant la suivante, sinon un correctif est invalide
par le suivant.

---

### CHANTIER 0 — Debloquer la CI et poser les gardes de deploiement
**Effort : 1 jour. Prerequis absolu : rien d'autre n'est protege tant que ce n'est pas fait.**

**Pourquoi c'est bloquant** : la CI **n'a jamais tourne une seule fois** (7 runs depuis le 21/07, 7 echecs). Ni les
leak tests pgTAP (regle 8), ni Biome, ni le typecheck, ni le build n'ont jamais ete executes. La faille Vault corrigee
par la migration 021 **etait couverte par un test commite avant le fix** — le test n'a jamais tourne, la faille est
partie en prod. Le meme scenario se rejouera sur n'importe quelle regression RLS.

| Finding source | Ou | Effort |
|---|---|---|
| Collision de version `012` : le job `db` meurt sur `schema_migrations_pkey` | `supabase/migrations/012_media_storage.sql:1` | S |
| Node 20 + pnpm 11.1.2 incompatibles : le job `web` meurt sur `setup-node` | `.github/workflows/ci.yml:113` | S |
| `apps/worker` dans aucun job de CI : les 7 tests de la regle 15 ne tournent nulle part | `.github/workflows/ci.yml:107` | S |
| Biome + typecheck en `continue-on-error` : seul `pnpm build` bloque, et il ne construit que `web` | `ci.yml:130`, `:134` | S |
| `scratch-verify-types.ts` untracked : 5 erreurs TS volontaires ; un `git add -A` casse le seul gate bloquant **et tout redeploy Coolify** | `apps/web/scratch-verify-types.ts:20` | S |
| `STUB_MODE` constante de compilation, sans garde d'env | `apps/worker/src/publishers/index.ts:21` | S |
| TLS `rejectUnauthorized:false` sur la connexion qui lit le Vault en clair | `apps/worker/src/db/pool.ts:17` | S |

**Ce que ca debloque** : tout. A partir d'ici, chaque correctif suivant est protege contre une regression.

---

### CHANTIER 1 — Rendre le worker sur avant le premier POST reel
**Effort : ~1 semaine. Dependance : chantier 0.**

**Pourquoi c'est bloquant** : quatre chemins normaux produisent aujourd'hui une **double publication chez un vrai
client**. Le defaut est de modele, pas de code : l'ancre d'idempotence `publish_started_at` vit sur la **ligne de job**,
alors que le fait qu'elle protege (« un POST est peut-etre parti chez Meta ») appartient a la **cible** et est definitif.
La duree de vie de la garde est plus courte que la duree de vie du risque.

| Finding source | Ou | Effort |
|---|---|---|
| **La fenetre de grace est evaluee AVANT le test d'idempotence** : un job demarre part en `dead_letter` sans qu'aucun `getContainerStatus` ne soit emis | `apps/worker/src/engine.ts:34` vs `:61` | S |
| `enqueue_publish_jobs` re-enfile les cibles `failed` **et** `pushed_to_platform` : second brouillon TikTok, quota 5/24h brule | `020_publish_jobs.sql:195` | S |
| `deadLetter`/`failPermanent` ecrivent `failed` meme quand `publish_started_at` est pose : « echec » affiche sur un post en ligne, l'admin reprogramme, doublon | `pg-store.ts:193`, `:218` | M |
| **Aucun fencing** : les 8 ecritures d'etat sont en `where id = $1`, `worker_id` jamais relu, `rowCount` jamais teste ; le heartbeat avale ses echecs | `pg-store.ts:94-235`, `index.ts:22-32` | M |
| **Aucun timeout HTTP** + tick strictement sequentiel : un appel pendu gele toute la file, et le heartbeat empeche le reaper de la recuperer | `engine.ts:95`, `index.ts:56` | M |
| Le reaper abandonne les jobs a `attempts >= max` : zombie `claimed` a vie, cible impubliable, `content_items` fige en `publishing` (aucune transition autorisee) | `pg-store.ts:89` | S |
| FK `content_target_id ... on delete cascade` : un DELETE de cible efface l'ancre regle 15, hors RLS et hors GRANT | `020_publish_jobs.sql:91` | M |
| `cancel_publish_jobs` ne couvre pas `claimed` : une deprogrammation pendant le lease est ignoree, le post part quand meme | `020:246`, `pg-store.ts:122` | M |
| `checkQuota` renvoie `true` **dans les deux branches**, y compris hors stub ; `deferForQuota` reboucle 60 s puis meurt en dead_letter au lieu de reporter | `apps/worker/src/context.ts:31`, `pg-store.ts:225` | L |

**Ce que ca debloque** : l'autorisation morale de brancher un publisher reel. C'est la porte a ne pas franchir avant.

---

### CHANTIER 2 — Resynchroniser la file avec l'etat metier
**Effort : 2-3 jours. Dependance : chantier 1 (l'ancre change de place).**

**Pourquoi c'est bloquant** : le lien entre « ce que l'app affiche » et « ce que le worker executera » n'existe qu'a
**deux appels manuels**. Toute autre ecriture desynchronise silencieusement. Consequence directe : un contenu mis a la
corbeille est publie quand meme, un contenu redate part a l'ancienne heure.

| Finding source | Ou | Effort |
|---|---|---|
| `trashContent` ne pose que `deleted_at` : ni statut, ni `cancel_publish_jobs`, et le claim ne joint jamais `content_items` (`deleted_at` = 0 occurrence dans `apps/worker`) | `lib/actions/content.ts:363` | S |
| `saveContentItem` reecrit `scheduled_at` pour **tous** les statuts sans jamais reenfiler : `run_at` reste fige | `lib/actions/content.ts:105`, `:142` | S |
| « Retirer la date » ecrit `scheduled_at = null` sans annuler : `enqueue` sort en no-op, le job survit avec son ancien `run_at` | `content.ts:311`, `schedule-dialog.tsx:113` | S |
| `markTargetPublishedManually` n'annule pas le job de la cible (frontiere de Server Action non gardee, latente) | `content-status.ts:130` | S |
| L'enfilement est en fire-and-forget : ni `error` ni le compte retourne ne sont lus, au nom d'un watchdog inexistant | `content-status.ts:96`, `content.ts:311` | S |
| Aucune borne serveur sur `scheduled_at` : une date passee sous 2 h publie immediatement ; le lot du board n'a aucun garde-fou (le composer, si) | `content.ts:284`, `board-schedule-dialog.tsx:69` | S |
| **`clients.approval_mode` n'est enforce nulle part** : aucune policy, aucun trigger, aucune RPC ne le lit — un drag kanban suffit a publier un contenu jamais valide, chez un client cree en `required` par defaut | `016_transitions.sql:70`, `004:8` | M |

**Ce que ca debloque** : la promesse produit n°1 (« pas de publication sans approbation ») devient un invariant de base
au lieu d'une discipline d'operateur.

---

### CHANTIER 3 — Arreter les pertes de donnees silencieuses
**Effort : 3-4 jours. Independant des chantiers 1-2, peut etre parallelise.**

**Pourquoi c'est bloquant** : le geste le plus banal du produit — rouvrir un brouillon et corriger une virgule —
**detruit tous ses medias**, plus l'ordre, les alt-text, les crops et, par cascade FK, **les annotations du client**.
Avec deux toasts rassurants par-dessus, dont un message factuellement faux.

| Finding source | Ou | Effort |
|---|---|---|
| `draftFromContent` ne remonte pas `libraryAssetId` -> `handleSave` filtre tout -> `reconcileMedia` fait `delete()` puis `return` sur tableau vide. **2 lignes a ajouter.** | `composer-types.ts:151-164`, `content.ts:219` | S |
| Les annotations client disparaissent en cascade (`annotation_content_media_id ... on delete cascade`) a chaque save depuis `changes_requested` | `013_collaboration.sql:138` | S |
| Les 3 `reconcile*` ne destructurent **aucune** erreur sur 8 ecritures, l'action renvoie `ok:true` : contenu sans cible affiche « Programme », ne partira jamais | `content.ts:203`, `:219`, `:242` | M |
| `captionOverrides` accepte, edite, valide en preflight, relu — **jamais ecrit**, et efface a chaque save | `content.ts:42` vs `:165-209` | S |
| Le `format` est modifiable sur un contenu `scheduled` alors que les medias sont geles : invariant format/cardinalite casse apres coup | `content.ts:100`, `012_media.sql:263` | S |
| **Les ~51 lectures de `lib/data` ignorent `error`** : une panne RLS/timeout/414 rend exactement le meme ecran qu'une org vide, sur l'app **et** sur le portail | `lib/data/content.ts:223` (+ 6 modules) | M |

**Ce que ca debloque** : la distinction « vide » vs « casse ». Sans elle, aucun Sentry ne verra jamais rien, et la regle 8
devient invérifiable (une fuite corrigee par RLS est indistinguable d'un bug).

---

### CHANTIER 4 — Faire entrer les medias, et les afficher
**Effort : ~1 semaine. Dependance : le fix `next.config` DOIT preceder le cablage TUS.**

**Pourquoi c'est bloquant** : aucun octet ne peut entrer dans le produit, et le jour ou il entrera il ne s'affichera pas.
IG/FB refusent tout post sans media : cette porte fermee suffit a elle seule a bloquer le go-live.

| Finding source | Ou | Effort |
|---|---|---|
| **`next/image` n'autorise que `images.pexels.com`** (residu de la maquette). 17 composants, zero `unoptimized`. En prod : HTTP 400 de l'optimiseur, grille/studio/mediatheque/**portail** gris. En dev : error boundary. **A faire AVANT TUS.** | `next.config.ts:14` | S |
| La drop-zone est un `<button>` : `e.dataTransfer` jete, toast « arrive bientot ». Zero `type="file"`, zero `.upload(`, zero `tus-js-client`, pas de `lib/media/`. `recordUploadedAsset` (complete, Zod) : **zero appelant** | `upload-dialog.tsx:32`, `lib/actions/media.ts:37` | L |
| `applyCrop` reecrit `width/height/mimeType/fileSizeMb` **sans traiter l'image** : le preflight valide des valeurs fabriquees et passe au vert sur un fichier non conforme | `composer-types.ts:91` | S |
| Le Reviewer ne peut PAS obtenir d'URL signee (`can_write_client_media` exige `is_org_member`) : il valide sur une vignette 400 px, erreur avalee en silence | `012_media_storage.sql:54`, `content-media.ts:41` | M |
| Le portail rend un `<Image>` pour une video : le Reel est approuve a l'aveugle. Zero `<video>` dans tout `apps/web` | `portal/media-carousel.tsx:44` | M |
| Mediatheque : alt-text et suppression ne persistent rien (`useState` + toast), les 6 Server Actions de `media.ts` sont mortes | `use-library-assets.ts:23` | S |

**Ce que ca debloque** : la chaine creation -> validation -> publication devient physiquement possible.

---

### CHANTIER 5 — Portes d'entree : auth, onboarding, portail client
**Effort : ~1 semaine. Contient la faille de securite la plus grave du depot.**

**Pourquoi c'est bloquant** : le portail de validation — argument commercial central — n'ouvre jamais de session.
Et la meme route est une **prise de controle de compte** : elle fabrique une session Supabase pour n'importe quelle
adresse email a partir d'un token que l'inviteur detient en clair dans sa propre modale.

| Finding source | Ou | Effort |
|---|---|---|
| **ATO** : `/api/invitations/accept` resout le compte existant par email puis redirige sur un `generateLink` magiclink. Aucune preuve de possession. `create_organization` etant `grant to authenticated`, tout compte peut inviter `owner@victime` et ouvrir sa session | `accept/route.ts:55-98`, `collaboration.ts:379` | M |
| L'invitation ne cree **jamais** de session : jetons dans le fragment, `lib/supabase/client.ts` sans importeur, `/portal` fail-closed -> `/login` password-only. Token deja brule (non rejouable) | `accept/route.ts:92-98` | S |
| **`/onboarding` n'existe pas** : 404 nu de Next pour tout compte sans org — c'est-a-dire tout Reviewer, a chaque retour via `/login` (le proxy redirige inconditionnellement vers `/dashboard` en effacant `next`) | `org-context.ts:79`, `proxy.ts:45` | M |
| Aucune route `/signup` : `signUpWithPassword` (complete) a zero importeur ; le retour de `create_organization` n'est pas teste (collision de slug avalee) | `(auth)/actions.ts:57`, `:85` | S |
| Aucun point de resolution de role : `/dashboard` en dur dans le proxy, `signInWithPassword` et `updatePassword` | `proxy.ts:47`, `actions.ts:47`, `:146` | M |
| Le Reviewer est cree **sans mot de passe** alors que le login est password-only ; `signInWithOtp` n'existe nulle part | `accept/route.ts:55`, `login-form.tsx:56` | M |
| Une invitation ratee est definitive : l'index unique partiel ignore `expires_at`, `revoked_at` jamais ecrit, aucune liste, aucune ré-invitation, **aucun retrait de `client_members`** (regle 4 sans bouton) | `013:301-303`, `collaboration.ts:358` | M |
| Le wizard jette le token d'invitation (seule copie en clair) puis affiche un succes -> `already_invited` bloquant ensuite | `lib/actions/clients.ts:167` | S |
| Open redirect sur `next` (`//evil.tld` passe `startsWith("/")`), sur un domaine authentique apres connexion reussie | `(auth)/actions.ts:47` | S |
| Le portail plante (`TypeError`) si `clients[]` est vide — atteignable en 2 clics depuis la landing | `portal/page.tsx:21` | S |

**Ce que ca debloque** : inviter un vrai client. Aujourd'hui c'est impossible ET dangereux.

---

### CHANTIER 6 — OAuth : selection des comptes et cycle de vie des tokens
**Effort : 1 a 1,5 semaine. Demande une decision Etienne (domaine + creds Meta).**

**Pourquoi c'est bloquant** : connecter Meta pour un client rattache **toutes** les Pages et comptes IG de tous les
autres clients a ce client-la, avec leurs tokens, sans ecran de selection ni chemin de detachement. Et aucun token ne
survit plus de ~1-2 h.

| Finding source | Ou | Effort |
|---|---|---|
| `resolveMeta` pousse **chaque** Page + IG associe ; `persistPlatformConnection` les ecrit **tous** avec le meme `client_id`. Defense de `reconcileTargets` vaincue par construction : l'IG du client B devient cible legitime du contenu de A | `identity.ts:74`, `tokens.ts:179` | M |
| **Aucune deconnexion nulle part** : zero `.delete()` sur `social_accounts`/`platform_connections`/`*_secrets`, et aucun `delete_integration_secret` en SQL — le mauvais rattachement est irreversible depuis l'app, les tokens Vault restent orphelins (passif RGPD) | `tokens.ts:184`, `019:60` | M |
| Pas d'echange long-lived Meta : `fb_exchange_token` = **0 occurrence**. Le token de Page herite d'un token utilisateur court -> toute publication a plus d'1 h echoue | `lib/oauth/index.ts:62` | S |
| `refreshTokens()` : zero appelant. `apps/worker/src/tokens/refresh.ts` = un verrou + un plan en commentaires (qui place le POST HTTP **dans** la transaction du verrou — violation r18 inscrite dans la spec). `token_expires_at` ecrit, relu par personne | `oauth/index.ts:93`, `tokens/refresh.ts:35` | L |
| State OAuth sans `exp`, sans nonce a usage unique, sans lien de session, `codeVerifier` PKCE **lisible** dedans ; le callback ecrit en `service_role` sans jamais revalider `organization_members` | `state.ts:33`, `callback/route.ts:34`, `tokens.ts:54` | M |
| `redirect_uri` derive de `new URL(request.url)` : en conteneur standalone, `HOSTNAME=0.0.0.0` + `PORT=3000` -> `redirect_uri=http://0.0.0.0:3000/...` -> **aucune connexion sociale possible en prod** | `api/oauth/[provider]/route.ts:22` | S |
| Scope `pages_manage_posts` absent : publier sur une Page FB sera refuse. Meta ne retro-accorde pas un scope (re-consentement de tous les comptes) | `lib/oauth/config.ts:44` | S |
| Les scopes **accordes** sont jetes, on stocke ceux demandes : un `instagram_content_publish` decoche est invisible jusqu'a l'heure H | `oauth/index.ts:56`, `tokens.ts:83` | S |
| `needs_reauth` est ecrit sur `platform_connections`, table que le web **ne lit jamais** ; les 11 surfaces qui testent `social_accounts.status !== 'connected'` sont mortes, dont la garde de programmation du preflight | `pg-store.ts:196` vs `tokens.ts:203` | S |
| Domaine de prod = `socean.54-36-180-115.sslip.io` : IP du VPS dans le hostname, gele dans 4x2 redirect URIs OAuth et dans les emails clients (indistinguable d'un phishing) | `deploy/GO-LIVE-points-1-2.md:46` | M |
| Arbitrage FB Login v21.0 vs IG Login : l'analyse avait explicitement ecarte la variante implementee ; un client sans Page FB est impossible a connecter, avec un **succes silencieux** | `lib/oauth/config.ts:45` | M |

**Ce que ca debloque** : publier reellement, et pouvoir reparer une erreur de rattachement.

---

### CHANTIER 7 — Observabilite, notifications et filets
**Effort : ~1 semaine. Dependance : chantier 1 (les points d'accroche sont les sorties terminales).**

**Pourquoi c'est bloquant** : en production, **la premiere personne informee d'un incident sera le client du freelance**.
Aucun email ne part du produit, le worker n'emet ni notification ni log metier, le watchdog auquel le code delegue par
ecrit n'existe pas, et Sentry n'est installe nulle part.

| Finding source | Ou | Effort |
|---|---|---|
| **Aucun watchdog** : 0 `cron.schedule` dans les 22 migrations, pas de repertoire `supabase/functions`, `pg_cron` meme pas installe — alors que `pg-store.ts:81` delegue explicitement les jobs a bout de tentatives « au watchdog pg_cron » | `supabase/`, `002_enums.sql:106` | M |
| Les 4 sorties terminales du worker n'ecrivent que des lignes SQL : zero log, zero notification, zero Brevo. `apps/worker` n'a que `pg` en dependance | `pg-store.ts:146-235` | M |
| **`BREVO_API_KEY` est vide**, aucun `BREVO_TEMPLATE_*`, `sendTransactional` leve, et tous les appelants avalent (`catch {}` nus, sans Sentry) : un echec d'envoi est indetectable pour toujours | `transactional.ts:59`, `collaboration.ts:374` | S |
| `sendReviewRequest` insere 3 tables puis `return` : **le client n'est jamais prevenu** qu'il a quelque chose a valider. Le toast affirme l'envoi sans le hedge « (apercu) » de ses voisins | `collaboration.ts:247-284` | M |
| Aucun Sentry (web ni worker), aucun `instrumentation.ts`, `grep 'console\.'` sur `apps/web` = **0** : le conteneur web ne produit aucun log applicatif. Les 4 error boundaries jettent `error.digest` | `package.json`, `global-error.tsx:5` | M |
| Le worker n'expose ni port HTTP ni heartbeat, et sa boucle avale toutes les erreurs de tick : un worker qui echoue a 100 % reste « healthy » pour Coolify | `apps/worker/src/index.ts:98` | M |
| `/api/health` est une constante `{ok:true}` — c'est le critere de reussite de deploiement du runbook | `api/health/route.ts:3` | S |
| Realtime declare dans la stack, `.channel(` = **0 occurrence** : le statut de publication ne bouge jamais a l'ecran | `apps/web/**` | M |

**Ce que ca debloque** : le temps de detection d'une panne cesse d'etre « le temps qu'un client mette a se plaindre ».

---

### CHANTIER 8 — Deployer le worker pour de vrai
**Effort : 3-4 jours. Dependance : chantiers 0, 1, 7 (sinon on deploie un simulateur muet).**

**Pourquoi c'est bloquant** : l'app Coolify worker n'existe pas, et il n'existe aucun artefact pour la construire.

| Finding source | Ou | Effort |
|---|---|---|
| Le seul `Dockerfile` construit exclusivement `apps/web` ; `apps/worker` n'a **aucun script `build`**, `tsconfig` en `noEmit`, et `start` = `tsx` (une **devDependency**). Un `NODE_ENV=production` -> `tsx: not found` -> crash-loop muet | `Dockerfile:11`, `apps/worker/package.json:7` | L |
| Deux sources de verite SQL : la CI teste `supabase/migrations/`, la prod tourne sur `deploy/*.sql` recopies a la main — **elles ont deja diverge sur le `revoke` des helpers Vault** (la faille de 021) | `deploy/14_migration_019.sql:45` | M |
| Aucun ledger de ce qui est reellement applique en ligne, aucun staging, aucun rollback, CI totalement decouplee du webhook Coolify, push directs sur `main` | `GO-LIVE-points-1-2.md:8`, `ci.yml:4` | L |
| Le Dockerfile ne declare aucun `ARG` pour les `NEXT_PUBLIC_*` : latent aujourd'hui, casse le bundle navigateur des le premier composant Realtime/upload | `Dockerfile:15` | S |
| Noms de variables d'env OAuth divergents entre `.env.local.example`, le runbook et le code (**zero recouvrement**) ; `OAUTH_STATE_SECRET` absent de l'exemple, lui-meme git-ignore | `config.ts:55` vs `.env.local.example:47` | S |

---

## Les points DEGRADES (utilisable mais a corriger vite)

Regroupes par nature. Aucun n'empeche l'usage reel, tous produisent une donnee fausse, une UX cassee ou un risque.

**L'UI affirme des ecritures qui n'ont pas lieu** — la classe de defaut la plus repandue du depot.
Les 6 CTA primaires de la fiche contenu sont un `toast.success` (`content-actions.tsx:37`) : Programmer, Envoyer en
validation, Renvoyer, Retirer, Modifier la date, Reprogrammer. Idem au calendrier pour Dupliquer / Relancer / Reessayer
(`calendar-actions.ts:224-241`) alors que `duplicateContent` existe et est **deja cablee cote studio**. Idem pour
« Reprogrammer » dans la grille (etat local pur, `use-grid-tiles.ts:212`), le FAB de capture rapide mobile qui n'ecrit
rien (`quick-capture.tsx:42`, chemin PWA iOS **prioritaire**), le bouton « Reconnecter » du composant partage
(`account-alert.tsx:36`), l'etape 2 du wizard dont les comptes « connectes » sont supprimes par Zod
(`wizard-shell.tsx:103`), et les 4 interrupteurs d'automatisation dont « publier des approbation »
(`automation-dialog.tsx:45`). Un utilisateur qui apprend que « le bouton vert ne veut rien dire » cesse de faire
confiance aux confirmations **partout ailleurs**.

**Des chiffres fabriques montres au client.** La heatmap « meilleurs creneaux » est une constante identique pour tous les
clients (`perf-utils.ts:50`, `bestSlot()` sans argument renvoie toujours « Ven 19 h ») avec un libelle qui annonce une
derivation « a partir de l'historique de publication ». Le rapport partage ignore la note redigee et les sections
decochees : le client lit un commentaire elogieux qu'Etienne n'a jamais ecrit (`report-workspace.tsx:27`).
`lastActiveAt` du reviewer est invente a chaque rendu (`org-context.ts:152`) pendant que la vraie colonne reste `null`
(`touch_client_member_seen` jamais appelee). `reach` NULL coerce en 0 **double** le taux d'engagement du rapport
(`pro.ts:530`, alors que `014:66` documente explicitement pourquoi la colonne est nullable).

**Des tables lues sans aucun ecrivain.** `imported_posts`, `post_metrics`, `calendar_events`,
`social_account_quota_usage`, `content_versions` : la grille de feed IG ne ressemblera jamais au vrai profil, la page
Performance et le rapport public affichent des zeros reels, l'agenda unifie ne montrera jamais un rendez-vous, la jauge
de quota affiche 0/100, et **la preuve d'approbation est vide par construction** (`content_versions` lu, jamais insere —
donc `approvals.version_label` toujours vide : en cas de litige client, Ocean ne peut rien produire).

**Fuites de colonnes vers le Reviewer.** La RLS filtre les **lignes, jamais les colonnes**, et les grants sont
table-wide. Un Reviewer — vrai utilisateur Supabase, cle anon publique — lit `content_items.internal_notes` et
`clients.notes` (« forfait, delais, preferences ») par un simple `fetch` PostgREST depuis sa console, alors que
`013_collaboration.sql:3` ecrit noir sur blanc l'invariant inverse. Aggrave par la facade qui sert `ITEM_COLUMNS`
(admin) au portail. Non exploitable par l'UI, invisible a une revue d'ecran.

**Grants et default privileges.** La cause racine du P0 Vault corrige en 021 est **toujours la** : les
`ALTER DEFAULT PRIVILEGES` Supabase accordent `EXECUTE` a `anon` sur toute fonction creee dans `public`, 017 et 021 sont
deux rattrapages **nominatifs**, et la CI ne regarde que `role_table_grants` filtre sur `authenticated`. La prochaine
RPC rejoue la faille. Symetriquement, les 13 tables coeur de 003->007 n'ont jamais recu le `revoke all ... from anon,
authenticated` que toutes les migrations >= 011 appliquent (motif : TRUNCATE echappe a la RLS).

**Liens publics.** `report_shares` n'ecrit jamais `expires_at`, `revoked_at` n'est ecrit par aucun code, aucun ecran ne
liste les partages, et chaque clic sur « Copier le lien » cree une **nouvelle** URL immortelle. Le `token_hash` stocke
**est** le credential accepte par la RPC anon, et il est granté `select` table-wide a `authenticated`. Zero test pgTAP
sur la seule surface anonyme du produit.

**UX et accessibilite.** Le token `--warning` est a **2.18:1** en theme clair (defaut) alors qu'il porte les alertes
`needs_reauth` sur 53 sites. Aucune primitive Form/Field : `aria-describedby` = **0 occurrence** dans toute l'app,
18 labels sans `htmlFor`. Toutes les cibles tactiles sont sous les 44 pt de l'Apple HIG (24-36 px) sur un produit
iOS-first, dont le `SidebarTrigger` a 28 px, seul acces a la navigation mobile. L'export PDF du rapport client est
illisible si l'app est en theme sombre. L'agenda masque silencieusement les evenements hors 7h-21h. Le portail formate
toutes les dates dans le fuseau du **premier** client du reviewer. Aucun `app/not-found.tsx` racine : un lien de rapport
expire renvoie le 404 brut anglais de Next au client final.

**Etat client de la grille.** `commit()` reecrit la baseline : toute action non liee (reserver un emplacement, relancer,
lot) **absorbe les permutations de dates en attente** sans les persister, et fait disparaitre la `PendingBar`. Et les six
`router.refresh()` du module sont sans effet (`useState(initialPlanned)` sans `key` de remontage) : apres un echec
partiel, l'ecran ment jusqu'a une navigation manuelle.

---

## Carte d'architecture (systeme reel observe)

```
                        NAVIGATEUR
   ┌──────────────────────────────────────────────────────────────┐
   │  RSC payload (plusieurs Mo : shell = TOUT l'historique org)   │
   │  203 composants clients / 278.  3 moteurs d'etat optimiste    │
   │  concurrents (board / grille / calendrier).                   │
   │  ✗ createBrowserClient : ZERO importeur  → pas de Realtime,   │
   │    pas d'upload, pas de consommation de fragment OAuth        │
   └───────────────┬──────────────────────────────────────────────┘
                   │
   ┌───────────────▼──────────────────────────────────────────────┐
   │ apps/web — Next 16 (proxy.ts = middleware)                    │
   │                                                               │
   │  proxy.ts  fail-closed + allowlist  ──✗ redirige tout vers    │
   │            /dashboard sans regarder le role                   │
   │     │                                                         │
   │  lib/auth/{dal,org-context}  getActiveOrg (cookie httpOnly    │
   │     │      revalide) ──✗ redirect('/onboarding') = 404        │
   │     │      ──✗ cookie active_org_id JAMAIS ecrit              │
   │     │                                                         │
   │  lib/data/*  (server-only, cache(), org_id 1er arg)           │
   │     │  ✗ 51 lectures ignorent `error`                         │
   │     │  ✗ 0 .limit() / 0 .range()  → max_rows 1000 silencieux  │
   │     │  ✗ .in(uuid[]) non borne    → 414 vers ~200 contenus    │
   │     │                                                         │
   │  lib/actions/*  requireClientInOrg → Zod → org_id injecte     │
   │     │  ✗ 2 protocoles d'erreur incompatibles                  │
   │     │  ✗ 26 `catch {}` avalent le NEXT_REDIRECT               │
   │     │  ✗ reconcile* : delete+insert non transactionnel,       │
   │     │    erreurs jetees, ok:true                              │
   │     │                                                         │
   │  api/oauth/[provider]  ──✗ state sans exp/nonce/session,      │
   │     │                     redirect_uri = 0.0.0.0:3000,        │
   │     │                     ecrit en service_role sans check    │
   │  api/invitations/accept ──✗ ATO + jamais de session           │
   └───────┬───────────────────────────────┬──────────────────────┘
           │ enqueue/cancel_publish_jobs   │ Vault (service_role)
           │ (2 call sites SEULEMENT)      │
   ┌───────▼───────────────────────────────▼──────────────────────┐
   │ SUPABASE POSTGRES  ★ le composant le plus solide              │
   │  RLS 100 % · FK composites · helpers private.* SECURITY DEF   │
   │  *_secrets deny-all · Vault · gardes 008/013/016              │
   │  publish_jobs (index unique partiel, claim idx)               │
   │  ✗ approval_mode lu par PERSONNE                              │
   │  ✗ 13 tables coeur sans revoke all (TRUNCATE hors RLS)        │
   │  ✗ default privileges EXECUTE anon : cause racine ouverte     │
   │  ✗ AUCUN pg_cron, AUCUNE Edge Function → zero watchdog        │
   │  ✗ tables sans ecrivain : imported_posts, post_metrics,       │
   │     calendar_events, quota_usage, content_versions            │
   └───────▲───────────────────────────────────────────────────────┘
           │ claim FOR UPDATE SKIP LOCKED (5432 SESSION ✓)
           │ ✗ ne joint JAMAIS content_items (deleted_at, status)
   ┌───────┴───────────────────────────────────────────────────────┐
   │ apps/worker — ★ APP COOLIFY INEXISTANTE, pas d'image, tsx     │
   │  index.ts  tick 5 s → reap → claim x10 SEQUENTIEL             │
   │  engine.ts  [1] grace ✗AVANT [2] token [3] quota=true en dur  │
   │             [4] regle 15 (correcte mais atteinte en 4e)       │
   │  pg-store   ✗ 8 ecritures sans fencing worker_id              │
   │  publishers ✗ STUB_MODE=true en CONSTANTE → ecrit 'published' │
   │             + permalink stub.local dans la vraie base         │
   │  ✗ 0 timeout HTTP · 0 log metier · 0 notification · 0 Sentry  │
   │  ✗ tokens/refresh.ts = un verrou + un commentaire             │
   └───────────────────────────────────────────────────────────────┘

   packages/shared : 7 lignes, ZERO importeur  → Platform x6, JobStatus x2,
   quotas x3, specs medias inaccessibles au worker, Brevo derriere server-only
```

**Trois coutures lachent** : (a) web -> file = 2 appels manuels sans trigger de rattrapage ; (b) web <-> worker = pas de
contrat compile, tout passe par Postgres ; (c) worker -> monde = aucun canal sortant.

---

## Backlog priorise unique

Deduplique agressivement : un meme defaut vu par N dimensions = **une** ligne.
Tri : bloquant P0, bloquant P1, degrade, apres.

| Prio | Go-live | Chantier | Finding | Ou | Effort | ⚠ Comport. | Regle | Dimensions sources |
|---|---|---|---|---|---|---|---|---|
| P0 | bloquant | 0 | Collision de version `012` : le job `db` de la CI n'a **jamais** tourne (7/7 echecs) | `supabase/migrations/012_media_storage.sql:1` | S | non | r8 | 10 |
| P0 | bloquant | 0 | `STUB_MODE` constante en dur : le worker deploie ecrit `published` + `stub.local` dans la vraie base, cible **brulee** | `worker/publishers/index.ts:21` | S | oui | — | 08,10,11 |
| P0 | bloquant | 1 | Fenetre de grace evaluee **avant** le test d'idempotence : dead_letter sans interroger le conteneur -> republication | `worker/engine.ts:34` vs `:61` | S | oui | r15 | 03,06,08,09,11 |
| P0 | bloquant | 1 | `enqueue_publish_jobs` re-enfile `failed` **et** `pushed_to_platform` : 2e post / 2e brouillon TikTok | `020_publish_jobs.sql:195` | S | oui | r15,r16 | 03,06,08,09 |
| P0 | bloquant | 2 | `trashContent` ne desarme pas la file : un contenu supprime est publie quand meme | `lib/actions/content.ts:363` | S | oui | r15,r16 | 03,06 |
| P0 | bloquant | 2 | `saveContentItem` redate sans reenfiler : publication a l'ancienne heure | `lib/actions/content.ts:105` | S | oui | r15,r16 | 01,02,06,07 |
| P0 | bloquant | 2 | « Retirer la date » laisse le job vivant (calendrier + composer) | `content.ts:311`, `schedule-dialog.tsx:113` | S | oui | r15,r16 | 02,06,09 |
| P0 | bloquant | 3 | **Rouvrir un brouillon et l'enregistrer detruit tous ses medias** (+ annotations en cascade) | `composer-types.ts:151`, `content.ts:219` | S | oui | r27 | 03,04,07,11 |
| P0 | bloquant | 4 | **Aucun chemin d'upload** : drop-zone factice, 0 `type="file"`, `recordUploadedAsset` orpheline | `upload-dialog.tsx:32`, `media.ts:37` | L | oui | r20,r21,r22 | 11 |
| P0 | bloquant | 4 | `next/image` n'autorise que `images.pexels.com` : aucun visuel reel, **portail compris** | `next.config.ts:14` | S | non | r20 | 02,04,05,06,07,08,09,10,11 |
| P0 | bloquant | 5 | **ATO** : le lien d'invitation ouvre une session sur n'importe quel email, token affiche a l'inviteur | `accept/route.ts:55-98` | M | oui | r6,r7,r10 | 03,06,09 |
| P0 | bloquant | 5 | L'invitation ne cree jamais de session (fragment jamais consomme) et brule le token | `accept/route.ts:92` | S | oui | r6 | 03,11 |
| P0 | bloquant | 5 | `/onboarding` n'existe pas : 404 nu pour tout compte sans org, donc tout Reviewer | `org-context.ts:79`, `proxy.ts:45` | M | oui | r6,r10 | 01,03,05,07,09,11 |
| P0 | bloquant | 6 | Meta rattache **toutes** les Pages/IG au client courant, sans selection ni detachement | `identity.ts:74`, `tokens.ts:179` | M | oui | r13 | 03,05,08,09,11 |
| P0 | bloquant | 6 | Aucun cycle de vie des tokens : pas de long-lived Meta, `refresh.ts` = un commentaire | `oauth/index.ts:62`, `tokens/refresh.ts:35` | L | oui | r14 | 03,08,09,11 |
| P0 | bloquant | 7 | Aucun watchdog (`pg_cron` absent), aucune Edge Function : un worker mort est indetectable | `supabase/`, `pg-store.ts:81` | M | oui | §5 | 03,05,08,10,11 |
| P0 | bloquant | 8 | App Coolify worker inexistante ; aucun artefact, `start` = `tsx` (devDependency) | `Dockerfile:11`, `worker/package.json:7` | L | oui | r17,r18 | 05,08,10,11 |
| P1 | bloquant | 0 | `apps/worker` dans aucun job de CI : les 7 tests de la regle 15 ne tournent jamais | `.github/workflows/ci.yml:107` | S | non | r15,r16,r18 | 05,08,10,11 |
| P1 | bloquant | 0 | CI web : Node 20 + pnpm 11.1.2 incompatibles -> lint/typecheck/build jamais executes | `ci.yml:113` | S | non | r25,r28 | 10 |
| P1 | bloquant | 0 | `scratch-verify-types.ts` untracked : un `git add -A` casse le seul gate **et tout redeploy** | `apps/web/scratch-verify-types.ts:20` | S | non | r24-28 | 10 |
| P1 | bloquant | 0 | TLS `rejectUnauthorized:false` sur la connexion qui lit le Vault en clair | `worker/db/pool.ts:17` | S | non | r12 | 08 |
| P1 | bloquant | 1 | Aucun fencing `worker_id` sur les 8 ecritures d'etat ; heartbeat qui avale ses echecs | `worker/db/pg-store.ts:94-235` | M | oui | r15,r17 | 01,03,04,06,08 |
| P1 | bloquant | 1 | Zero timeout HTTP + tick sequentiel : un appel pendu gele toute la file, sans alerte | `engine.ts:95`, `index.ts:56` | M | oui | r18,r19 | 03,08 |
| P1 | bloquant | 1 | Reaper : job a `attempts >= max` fige en `claimed` a vie, cible impubliable, `publishing` sans issue | `pg-store.ts:89` | S | oui | r15,r18 | 03,04,06,08,10 |
| P1 | bloquant | 1 | FK `on delete cascade` sur `content_target_id` : l'ancre regle 15 est supprimable hors RLS | `020_publish_jobs.sql:91` | M | oui | r15,r16 | 03 |
| P1 | bloquant | 1 | `cancel_publish_jobs` ne couvre pas `claimed` : annulation pendant le lease ignoree | `020:246`, `pg-store.ts:122` | M | oui | r15 | 03 |
| P1 | bloquant | 1 | `checkQuota` = `return true` **hors stub** ; `deferForQuota` reboucle 60 s puis dead_letter | `worker/context.ts:31`, `pg-store.ts:225` | L | oui | r19 | 06,08 |
| P1 | bloquant | 2 | `clients.approval_mode` enforce **nulle part** : publication d'un contenu jamais valide | `016_transitions.sql:70` | M | oui | §12 | 01,09 |
| P1 | bloquant | 2 | Enfilement fire-and-forget : « Programme » sans aucun job, aucun signal | `content-status.ts:96`, `content.ts:311` | S | oui | r16,r27 | 06,11 |
| P1 | bloquant | 3 | Les 3 `reconcile*` ignorent 8 erreurs et l'action renvoie `ok:true` | `content.ts:203/219/242` | M | oui | r27 | 01,02,03,06,09 |
| P1 | bloquant | 3 | Les ~51 lectures de `lib/data` ignorent `error` : panne = « aucune donnee » credible | `lib/data/content.ts:223` | M | oui | — | 01,03,04,06,07 |
| P1 | bloquant | 4 | `applyCrop` falsifie mimeType/dimensions/poids : le preflight passe au vert sur un media non conforme | `composer-types.ts:91` | S | oui | r22 | 05,07 |
| P1 | bloquant | 5 | Aucune route `/signup` ; retour de `create_organization` non teste (collision de slug avalee) | `(auth)/actions.ts:57`, `:85` | S | oui | — | 03,11 |
| P1 | bloquant | 5 | Aucun point de resolution de role post-auth (`/dashboard` en dur x3) | `proxy.ts:47`, `actions.ts:47`, `:146` | M | oui | r6 | 01,05,07,11 |
| P1 | bloquant | 5 | Invitation ratee definitive : index ignore `expires_at`, pas de ré-invite/revocation, **aucun retrait de `client_members`** | `013:301`, `collaboration.ts:358` | M | oui | r4,r6 | 11 |
| P1 | bloquant | 6 | `redirect_uri` derive de `request.url` -> `0.0.0.0:3000` en conteneur : aucune connexion sociale en prod | `api/oauth/[provider]/route.ts:22` | S | oui | r13 | 03,09,10 |
| P1 | bloquant | 6 | Scope `pages_manage_posts` absent : publication FB Page refusee, re-consentement de tous les comptes | `lib/oauth/config.ts:44` | S | oui | — | 03 |
| P1 | bloquant | 6 | Aucune deconnexion / revocation Vault : mauvais rattachement irreversible, tokens orphelins (RGPD) | `tokens.ts:184`, `019:60` | M | oui | r11,r12 | 05,06 |
| P1 | bloquant | 6 | State OAuth sans `exp`/nonce/session + `codeVerifier` lisible ; callback en service_role sans revalidation | `state.ts:33`, `callback/route.ts:34` | M | oui | r13,r4 | 01,02,03,04,05,06,08,09 |
| P1 | bloquant | 6 | Domaine `sslip.io` (IP dans le hostname) fige dans les redirect URIs OAuth et les emails clients | `GO-LIVE-points-1-2.md:46` | M | oui | r13 | 10 |
| P1 | bloquant | 7 | Brevo non configure + `catch {}` nus : **aucun email ne part**, echec indetectable a vie | `transactional.ts:59`, `collaboration.ts:374` | S | oui | §10 | 02,11 |
| P1 | bloquant | 7 | Le worker n'emet ni notification, ni email, ni log metier (4 sorties terminales muettes) | `pg-store.ts:146-235` | M | oui | r14,§10 | 02,03,08,10,11 |
| P1 | bloquant | 8 | `deploy/*.sql` = 2e source de verite, **deja divergente sur le `revoke` Vault** | `deploy/14_migration_019.sql:45` | M | non | r11,r12 | 05,08,10 |
| P1 | degrade | 3 | `captionOverrides` accepte, valide, relu — jamais ecrit, efface a chaque save | `content.ts:42` | S | oui | r27 | 01,03 |
| P1 | degrade | 3 | `format` modifiable sur `scheduled` alors que les medias sont geles | `content.ts:100` | S | oui | r22,r27 | 01,06 |
| P1 | degrade | 4 | Le Reviewer ne peut pas obtenir d'URL signee : il valide sur une vignette 400 px, erreur avalee | `012_media_storage.sql:54` | M | oui | r6,r20 | 06,09 |
| P1 | degrade | 4 | Le portail ne sait pas afficher une video : le Reel est approuve a l'aveugle (0 `<video>`) | `portal/media-carousel.tsx:44` | M | oui | — | 02 |
| P1 | degrade | 5 | Le Reviewer est cree sans mot de passe, login password-only, `signInWithOtp` absent | `accept/route.ts:55` | M | oui | r6 | 05,09 |
| P1 | degrade | 5 | Open redirect sur `next` apres connexion **reussie** (`//evil.tld`) | `(auth)/actions.ts:47` | S | non | — | 01,05 |
| P1 | degrade | 5 | Le portail plante (`TypeError`) si `clients[]` vide — atteignable en 2 clics depuis la landing | `portal/page.tsx:21` | S | oui | r25 | 01,04,05,07 |
| P1 | degrade | 5 | Le wizard jette le token d'invitation puis affiche un succes -> `already_invited` bloquant | `lib/actions/clients.ts:167` | S | oui | r27 | 11 |
| P1 | degrade | 6 | `needs_reauth` ecrit sur `platform_connections`, lu nulle part : 11 surfaces mortes dont le preflight | `pg-store.ts:196` vs `tokens.ts:203` | S | oui | r14 | 11 |
| P1 | degrade | 6 | Les scopes **accordes** sont jetes (on stocke ceux demandes) : revocation partielle invisible | `oauth/index.ts:56` | S | oui | r13,r19 | 09 |
| P1 | degrade | 6 | Arbitrage FB Login v21.0 vs IG Login : client sans Page FB impossible, **succes silencieux** | `lib/oauth/config.ts:45` | M | oui | r13 | 08 |
| P1 | degrade | 7 | `sendReviewRequest` ne notifie personne : le client ignore qu'il a a valider | `collaboration.ts:247` | M | oui | §10,§11 | 11 |
| P1 | degrade | 7 | Aucun Sentry (web+worker), aucun `instrumentation.ts`, `console.` = 0 dans `apps/web` | `package.json`, `global-error.tsx:5` | M | non | §1 | 10 |
| P1 | degrade | 7 | Le worker n'expose ni healthcheck ni heartbeat : echec a 100 % = « healthy » pour Coolify | `worker/index.ts:98` | M | oui | — | 10 |
| P1 | degrade | 7 | Realtime declare dans la stack, `.channel(` = 0 : le statut ne bouge jamais a l'ecran | `apps/web/**` | M | non | §1 | 01,05 |
| P1 | degrade | 9 | `internal_notes` / `clients.notes` lisibles par le Reviewer (RLS ligne, grants table-wide) | `006:244`, `004:105` | M | oui | r7,r8 | 01,06,09 |
| P1 | degrade | 9 | Cause racine des default privileges `EXECUTE anon` non corrigee, aucun garde CI | `021:20`, `ci.yml:74` | S | non | r11,r12 | 05,06,09,10 |
| P1 | degrade | 9 | `report_shares` : jamais d'expiration, jamais de revocation, un lien par clic, **zero test pgTAP** | `report-share-actions.ts:39`, `018:66` | M | oui | r8,r20 | 06,09,10 |
| P1 | degrade | 10 | `getShellSnapshot` charge + hydrate + signe TOUT l'historique de l'org a **chaque page** | `lib/data/dashboard.ts:161` | M | oui | r26 | 01,02,04,05,06,07,11 |
| P1 | degrade | 10 | Zero pagination : troncature silencieuse a `max_rows=1000`, sur l'ordre **ascendant** (les plus recents disparaissent) | `lib/data/content.ts:223` | M | oui | — | 01,04,05 |
| P1 | degrade | 11 | Les 6 CTA primaires de la fiche contenu sont des `toast.success` | `content-actions.tsx:37` | M | oui | — | 02,05,07 |
| P1 | degrade | 11 | Calendrier : Dupliquer / Relancer / Reessayer = toasts, alors que `duplicateContent` est deja cablee ailleurs | `calendar-actions.ts:224-241` | S | oui | r27 | 02,05,07 |
| P1 | degrade | 11 | Grille : `commit()` absorbe les permutations en attente ; les 6 `router.refresh()` sont sans effet | `use-grid-tiles.ts:64`, `:50` | M | oui | r26 | 07 |
| P1 | degrade | 11 | FAB de capture rapide mobile (chemin PWA iOS prioritaire) : toast, zero ecriture | `quick-capture.tsx:42` | S | oui | — | 05 |
| P1 | degrade | 11 | `request_target_retry` : cul-de-sac, `retry_requested_at` lu par personne, UI qui confirme | `016_transitions.sql:260` | M | oui | r15 | 06,07,08 |
| P1 | degrade | 11 | Rapport partage : note redigee et sections decochees jamais transmises au snapshot | `report-workspace.tsx:27` | S | oui | r27 | 05,07 |
| P1 | degrade | 11 | `content_versions` lu, jamais ecrit : la **preuve d'approbation** est vide par construction | `lib/data/pro.ts:422` | M | oui | — | 02 |
| P1 | degrade | 11 | Tables sans ecrivain : `imported_posts`, `post_metrics`, `calendar_events`, `quota_usage` | `pro.ts:544`, `014:188` | L | oui | r19 | 06,08 |
| P2 | degrade | 9 | 13 tables coeur (003->007) sans `revoke all from anon` : TRUNCATE echappe a la RLS | `006_content_core.sql:244` | S | non | r2,r11 | 06,09 |
| P2 | degrade | 12 | 2 protocoles d'erreur incompatibles + 26 `catch {}` qui avalent le `NEXT_REDIRECT` | `_helpers.ts:30`, `clients.ts:208` | M | oui | r27 | 01,02,06,11 |
| P2 | degrade | 12 | Contexte Reviewer aplati sur `memberships[0]` : portail multi-client casse / scope org faux | `org-context.ts:144`, `portal/[contentId]/page.tsx:39` | M | oui | r6 | 01,02,04,07 |
| P2 | degrade | 12 | `--warning` a 2.18:1 en theme clair (defaut) sur 53 sites, dont l'alerte `needs_reauth` | `globals.css:115` | S | oui | r25 | 07 |
| P2 | degrade | 12 | Aucune primitive Form/Field : `aria-describedby` = 0, 18 labels sans `htmlFor` | `components/ui/label.tsx:7` | M | non | r27 | 07 |
| P2 | degrade | 12 | Toutes les cibles tactiles < 44 pt sur un produit iOS-first (`SidebarTrigger` a 28 px) | `components/ui/button.tsx:28` | M | oui | — | 07 |
| P2 | degrade | 12 | Export PDF du rapport client illisible en theme sombre | `report-print.css:23` | S | non | r25 | 07 |
| P2 | degrade | 12 | Heatmap « meilleurs creneaux » fabriquee, identique pour tous les clients | `perf-utils.ts:50` | S | oui | — | 07 |
| P2 | degrade | 12 | Agenda : evenements hors 7h-21h silencieusement invisibles (desktop ≠ mobile) | `agenda-utils.ts:68` | M | oui | — | 07 |
| P2 | degrade | 12 | `reach` NULL coerce en 0 : taux d'engagement **double** dans le rapport client | `lib/data/pro.ts:530` | M | oui | — | 06 |
| P2 | degrade | 12 | `lastActiveAt` du reviewer invente ; `touch_client_member_seen` jamais appelee | `org-context.ts:152` | S | oui | — | 01 |
| P2 | degrade | 12 | Badge « donnees de demonstration » sur la landing et le login, en production | `app/page.tsx:52` | S | non | — | 05 |
| P2 | degrade | 12 | Ton de marque stocke en base sous forme de **cle i18n brute** | `step-brand.tsx:37` | S | oui | — | 11 |
| P2 | degrade | 12 | Wizard etape 2 : les comptes « connectes » sont supprimes par Zod a la soumission | `wizard-shell.tsx:103` | M | oui | — | 11 |
| P2 | degrade | 12 | 4 interrupteurs d'automatisation morts, dont « publier des approbation » | `automation-dialog.tsx:45` | S | oui | — | 07 |
| P2 | degrade | 12 | Mediatheque : alt-text et suppression ne persistent rien (6 Server Actions mortes) | `use-library-assets.ts:23` | S | oui | r23 | 02,05 |
| P2 | degrade | 12 | Aucun etat vide : picker media, cibles de diffusion, page Performance | `media-picker-dialog.tsx:82` | S | non | — | 07 |
| P2 | degrade | 12 | `/api/health` = constante `{ok:true}` : critere de reussite de deploiement qui ne prouve rien | `api/health/route.ts:3` | S | oui | §7 | 10 |
| P2 | degrade | 12 | Noms de variables d'env OAuth divergents (exemple / runbook / code : **zero recouvrement**) | `config.ts:55` vs `.env.local.example:47` | S | non | §7 | 01,04,09,10,11 |
| P2 | apres | 13 | `.in(uuid[])` non borne : GET PostgREST > 8 Ko -> 414 vers ~200 contenus, degradation **silencieuse** | `lib/data/content.ts:104` | L | non | — | 04 |
| P2 | apres | 13 | `/clients` : N+1 d'hydratation complete (medias + URL signees) pour 3 compteurs | `clients/page.tsx:19` | S | non | r7 | 01,04 |
| P2 | apres | 13 | `getLibraryAssets` non borne sur le chemin d'edition le plus frequent | `lib/data/pro.ts:239` | M | oui | — | 04 |
| P2 | apres | 13 | Actions de lot : N Server Actions x (auth + update + RPC + 2 revalidate) | `use-grid-tiles.ts:248` | M | oui | r7,r27 | 04 |
| P2 | apres | 13 | Grille et board : zero `useMemo`/`memo`, aucune virtualisation, un droppable par tuile verrouillee | `feed-grid.tsx:74`, `locked-grid-tile.tsx:30` | M | non | r26 | 04 |
| P2 | apres | 13 | Les 2 dictionnaires i18n complets (189 Ko) dans le bundle de **26 routes sur 26** | `app/layout.tsx:49` | M | non | r26 | 04 |
| P2 | apres | 13 | Index de claim ne couvre pas `awaiting_media` ; `publish_jobs` jamais purgee | `020_publish_jobs.sql:104` | S | non | r18 | 06 |
| P2 | apres | 14 | Aucun test pgTAP sur `storage.objects` (unique mecanisme d'isolation des medias, r21) | `012_media_storage.sql:54` | M | non | r8,r20,r21 | 08,10 |
| P2 | apres | 14 | Le cookie `active_org_id` n'est jamais ecrit ; requete d'appartenance sans `ORDER BY` | `org-context.ts:71` | M | non | r10 | 01,02,11 |
| P2 | apres | 14 | `types.ts` maintenu a la main, 41 blocs `Relationships` vides, `publish_jobs` absente | `lib/supabase/types.ts:44` | M | non | r25 | 01,06 |
| P2 | apres | 14 | `packages/shared` = 7 lignes, **zero importeur** : `Platform` x6, `JobStatus` x2, quotas x3 | `packages/shared/src/types/domain.ts:1` | M | non | §1,§4 | 02,05,08 |
| P2 | apres | 14 | CLAUDE.md / AGENTS.md decrivent la phase « preview mockee » : une session d'agent peut **defaire** le travail correct | `CLAUDE.md:16` | S | non | — | 08 |
| P2 | apres | 14 | Regle 24 : `pro.ts` 878 l., `content.ts` 535 l., 9 composants > 250 l. | `lib/data/pro.ts:1` | M | non | r24 | 01,02,05 |
| P3 | apres | 14 | Aucun `app/not-found.tsx` racine : 404 anglais brut sur un lien de rapport client expire | `app/r/[token]/page.tsx:28` | S | non | — | 07 |
| P3 | apres | 14 | Portail : toutes les dates dans le fuseau du **premier** client du reviewer | `portal/page.tsx:23` | S | oui | — | 07 |
| P3 | apres | 14 | Preflight uniquement dans le composer : kanban, lot et calendrier ne valident rien | `preflight.ts:276` | L | oui | r27 | 02 |
| P3 | apres | 14 | Aucun PostHog : les 16 events de §11 n'existent nulle part ; PWA = un manifeste sans SW ni PNG | `app/manifest.ts:15` | M | non | §11 | 04,07,10,11 |

---

## Sequence de refonte recommandee

Quatre portes. **Aucune ne s'ouvre avant que la precedente ne soit fermee** — sinon un correctif est invalide par le
suivant (par exemple : deplacer l'ancre d'idempotence change la signature de la passe « retry demandes »).

### PORTE 0 — Avant de creer l'app Coolify worker (~1 jour)
*Protege la base de production contre son propre outillage.*

1. **Chantier 0** en entier : renommer `012_media_storage` -> `022`, Node 22 en CI, job `worker` bloquant,
   supprimer `scratch-verify-types.ts`, retirer les `continue-on-error`, `STUB_MODE` pilote par
   `PUBLISHERS_MODE` avec **refus de demarrer** si stub + base non locale, TLS `verify-full`.

⚠ **Comportement change** : le worker refusera de demarrer sans variable explicite. C'est voulu.
**Rien de tout ceci n'est applique sans ta validation.**

### PORTE 1 — Avant le premier POST reel chez un client (~2 semaines)
*Bloc « on ne publie jamais deux fois, et on sait quand ca rate ».*

2. **Chantier 1** — ancre d'idempotence portee sur `content_targets`, inversion de l'ordre dans `processJob`,
   statut terminal `needs_verification` distinct de `failed`, fencing `worker_id`, timeouts, reaper qui terminalise,
   FK en `restrict`, quota reel. **A faire en premier : les chantiers 2 et 7 s'y greffent.**
3. **Chantier 2** — helper unique `syncPublishQueue(contentId)` appele par **toute** action qui touche
   `scheduled_at` ou le statut, + trigger `AFTER UPDATE` en filet, + `approval_mode` porte dans
   `content_items_guard_status_transition` avec test pgTAP.
4. **Chantier 3** — `libraryAssetId` (2 lignes), reconciliation par diff au lieu de delete-all, RPC transactionnelle
   `save_content_item`, helper `unwrap()` sur les 51 lectures.
5. **Chantier 7** (partie worker) — `notify.ts` (insert `notifications` + Brevo hors transaction), Sentry, watchdog
   `pg_cron` + Edge Function, heartbeat.

⚠ **Comportement change** : un job dont l'issue est inconnue ne sera plus affiche « echec » mais « a verifier », et ne
sera plus reprogrammable en un clic. C'est exactement le point.

### PORTE 2 — Avant d'ouvrir Ocean a un vrai client (~2 semaines)
*Bloc « ce que l'utilisateur voit est vrai ».*

6. **Chantier 4** — `next.config` derive de `NEXT_PUBLIC_SUPABASE_URL` **d'abord**, puis `lib/media/` + TUS +
   conversion JPEG/HEIC + vignette WebP, `applyCrop` honnete, URL signee reviewer, lecteur video portail.
7. **Chantier 5** — `/onboarding` hors du groupe `(app)`, `/signup`, `landingFor(user)` **unique** consomme par le proxy
   / `/auth/callback` / `signInWithPassword` / `updatePassword`, `not-found.tsx` racine, invitation via `token_hash` ->
   `/auth/callback`, correctif ATO, ré-invitation + revocation + retrait de `client_members`, OTP passwordless,
   `safeNext()`.
8. **Chantier 6** — ecran de selection des sous-comptes Meta, action de detachement + revocation Vault, echange
   long-lived, `refresh.ts` reel (HTTP **hors** verrou), state durci, `siteOrigin()` pour le `redirect_uri`,
   `pages_manage_posts`, scopes accordes, propagation `needs_reauth`.
9. **Chantier 7** (partie web) — Brevo configure + SMTP custom Supabase, `sendReviewRequest` qui notifie,
   Realtime sur `notifications` / `content_targets`.
10. **Chantier 8** — `apps/worker/Dockerfile`, `deploy/` genere + check de non-divergence en CI, staging.

⚠ **Comportement change** : le flux de connexion Meta gagne une etape ; les invitations partent par email au lieu d'un
lien copie ; les toasts simules disparaissent (bouton cable ou bouton retire — **jamais** un toast vert).

### PORTE 3 — Dette de fond, avant l'ouverture SaaS
11. Perf : shell maigre + pagination `_paging.ts` + hydratation par jointure/RPC (supprime le mur du 414).
12. Securite : `revoke all` sur les 13 tables coeur, garde CI generique sur `role_routine_grants`, tests pgTAP
    storage / report_shares / 021, `expires_at` par defaut sur les partages.
13. `packages/shared` rempli (plateformes, statuts, quotas, specs medias, Brevo, helper `fetch` avec timeout) et importe
    par les deux apps ; generation reelle de `types.ts`.
14. Ingestion feed IG + insights + sync agenda. **En attendant, masquer explicitement les modules Performance / Rapport /
    Agenda** plutot que d'afficher des zeros a un client : c'est un correctif d'une heure qui supprime la seule categorie
    de mensonge que l'app produit aujourd'hui.
15. Mise a jour de CLAUDE.md / AGENTS.md — **avant la prochaine session d'agent, pas apres** : en l'etat, ils ordonnent
    de re-mocker les donnees et de « corriger » l'auth vers l'OTP.

### Ce qui demande une decision d'Etienne (a trancher avant la porte 2)
- **Le domaine definitif.** `sslip.io` porte l'IP du VPS et sera gele dans 8 redirect URIs OAuth + tous les emails
  clients. Changer de domaine apres coup = re-declarer les 4 providers, casser les connexions en vol, refaire une App
  Review Meta engagee. **Prerequis dur de deploiement, pas une decision marketing.**
- **Creds Meta / TikTok + App Review** : `pages_manage_posts` doit figurer dans la demande. Sans lui, tout est a refaire.
- **Arbitrage FB Login vs IG Login** : assumer le prerequis « une Page FB par client » (et le documenter dans
  l'onboarding + un message d'erreur quand `subAccounts` est vide), ou implementer la variante `graph.instagram.com`
  decidee dans ANALYSE-LANCEMENT §2.1.
- **Arbitrage produit sur les modules vides** : masquer Performance / Rapport / Agenda jusqu'a l'ingestion, ou les
  laisser a zero avec un etat vide explicite.
- **Ordonnanceur** : tout le periodique (refresh tokens, import feed, sync agenda, fenetre de quota) dans le worker,
  `pg_cron` reserve **uniquement** au temoin de vie du worker (un composant ne peut pas etre son propre temoin).

---

## Ce que l'audit n'a PAS couvert

Honnetete sur les angles morts — ces zones sont **non instruites**, pas « saines ».

- **Aucune execution runtime sur la base en ligne.** Le projet `hgdeopkmkwyoumsfggrm` n'a pas ete interroge : pas de
  `get_advisors`, pas d'`EXPLAIN`, pas de verification que le schema deploye correspond a `deploy/*.sql`. La divergence
  `deploy/` vs `supabase/migrations/` a ete etablie **par diff de fichiers**, pas par introspection du catalogue reel.
- **Aucun test de charge, aucune mesure.** Tous les chiffres de performance (TTFB, seuil du 414 vers ~200 contenus,
  poids des payloads RSC, cout des `Intl.DateTimeFormat`) sont des **extrapolations calculees**, pas des mesures. Les
  seuils exacts dependront du volume reel.
- **Aucun parcours navigateur execute.** Pas de Playwright, pas de clic reel : les parcours ont ete reconstruits par
  lecture du code. Un comportement de runtime Next 16 non documente pourrait invalider un scenario.
- **Aucun appel aux API plateformes.** Le comportement reel de Graph v21.0, de l'API TikTok et des quotas n'a pas ete
  verifie contre la documentation vivante de aout 2026 — seulement contre le code et `docs/ANALYSE-LANCEMENT.md`.
  Les scopes, les endpoints et les durees de vie de token sont a re-verifier avant l'App Review.
- **Aucun audit de la config Coolify ni du VPS.** L'infrastructure n'existe que dans une UI non versionnee : replicas,
  grace period, variables, certificats, ouverture de ports (Coolify est joignable en **HTTP clair** sur
  `54.36.180.115:8000`, note dans `.planning/SESSION.md` mais non instruit).
- **Aucune revue de la qualite des donnees en prod.** `deploy/09_seed_demo.sql` contient des donnees de demonstration
  (dont un permalink Instagram fabrique) potentiellement presentes dans la base reelle — signale en annexe non verifiee,
  jamais confirme.
- **RGPD, mentions legales, CGU, DPA Meta/TikTok** : hors perimetre technique, mais prerequis d'un usage commercial avec
  des donnees de clients tiers.
- **Les annexes « pistes non verifiees »** de chaque rapport (environ 200 items cumules) n'ont **pas** passe la
  refutation adversariale. Elles ne sont pas reprises dans le backlog ci-dessus et ne doivent pas etre traitees comme
  des faits.
- **Trois findings ont ete corriges a la baisse par la refutation** et sont integres tels quels : `next/image` renvoie un
  HTTP 400 en prod (pas un crash React) ; le chemin le plus court vers la double publication est `failPermanent`, pas la
  fenetre de grace ; l'echec de token n'est pas totalement muet grace a la banniere `needs_reauth` — qui elle-meme lit
  la mauvaise table.

---

*Fin de synthese. Aucune modification n'a ete appliquee au code, au schema ou a la configuration.*
