# Audit — Clean Architecture : separation des responsabilites, modularite, couplage (DATE-MANQUANTE)

## Verdict

Ocean a une architecture **correctement pensee et nulle part fermee**. Les intentions sont reelles et lisibles : une facade de lecture unique, `server-only`, qui re-exporte nom par nom pour empecher tout shadowing silencieux ([lib/data/index.ts:1](../../../apps/web/lib/data/index.ts#L1)) ; un domaine pur sans I/O ([lib/domain/](../../../apps/web/lib/domain/core.ts#L9)) ; un socle d'ecriture qui impose `getActiveOrg()` puis `requireClientInOrg()` avant toute mutation ([_helpers.ts:24](../../../apps/web/lib/actions/_helpers.ts#L24)) ; et, meilleur morceau du depot, un worker en ports/adaptateurs ou la machine a etats ne connait qu'une interface `JobStore` ([store.ts:16](../../../apps/worker/src/store.ts#L16)), ce qui rend testables sans base les 7 invariants anti-double-publication. Le probleme est que **ces frontieres sont tenues par des commentaires, pas par le compilateur ni par la CI** : `packages/shared`, designe par le CLAUDE.md §4 comme le contrat commun, pese 7 lignes et n'est importe par personne ; `components/` heberge une Server Action et deux modules d'acces aux donnees ; et surtout, **le meme geste metier existe en deux exemplaires divergents selon l'ecran d'ou il part** — dupliquer un contenu persiste depuis le studio et n'est qu'un `toast.success` depuis le calendrier ([calendar-actions.ts:241](../../../apps/web/components/app/calendar/calendar-actions.ts#L241)), relancer un post echoue repeint la tuile en memoire depuis la grille ([use-grid-tiles.ts:212](../../../apps/web/components/app/grid/use-grid-tiles.ts#L212)), capturer une idee depuis le FAB mobile n'ecrit rien ([quick-capture.tsx:42](../../../apps/web/components/app/shell/quick-capture.tsx#L42)). Pour un **usage reel immediat**, cette dimension livre trois blocages durs : la DAL redirige vers `/onboarding`, une route qui n'existe pas, ce qui met en 404 definitif tout compte sans organisation et tout Reviewer qui se reconnecte ([org-context.ts:79](../../../apps/web/lib/auth/org-context.ts#L79)) ; la connexion Meta rattache **toutes** les pages Facebook administrees au client depuis lequel on a clique, sans ecran de selection et sans aucun moyen in-app de defaire ([tokens.ts:179](../../../apps/web/lib/oauth/tokens.ts#L179)) ; et aucun media reel ne peut s'afficher, le seul hote autorise par `next/image` etant `images.pexels.com` ([next.config.ts:14](../../../apps/web/next.config.ts#L14)). **Risque a 5 ans** : le couplage effectif du systeme passe par la base de donnees, sans aucune verification a la compilation entre `apps/web`, `apps/worker` et les migrations — il existe deja trois definitions concurrentes du meme vocabulaire (types.ts manuel, `apps/worker/src/domain.ts`, les enums SQL) et deux sources de verite SQL (`supabase/migrations` teste en CI, `deploy/*.sql` execute en prod) **qui ont deja diverge sur un grant de securite**. Ce n'est pas une dette qui ralentit, c'est une dette qui rend le systeme non auditable, donc a terme non reproductible.

---

## Fonctionnement reel observe

### 1. Chemin de lecture (web)

```
app/(app)/**/page.tsx        ROUTE : resout params + cookies, appelle lib/data, assemble le view-model
   |                                (et fait aussi le mapping DTO -> props des composants : fuite)
   v
lib/data/index.ts            FACADE server-only, contrat : async + cache() + org_id en 1er argument
   |-- clients.ts (140)  content.ts (305)  content-media.ts (145)  dashboard.ts (172)
   |-- notifications.ts (63)  pro.ts (878 lignes, 3,5x la limite r24)
   v
lib/supabase/server.ts       client Supabase RLS-scope (cookies)
lib/supabase/admin.ts        client service_role (RLS bypass) — reserve OAuth/worker
```

La verification de session est faite **au plus pres de la donnee** et non dans un layout, conformement a la doc Next 16 : `verifySession()` appelle `auth.getUser()` (JWT revalide) et est memoise par requete ([dal.ts:17](../../../apps/web/lib/auth/dal.ts#L17)). `getActiveOrg()` lit l'org active depuis le cookie httpOnly `active_org_id`, la valide contre `organization_members`, et **ne renvoie jamais `null`** : il redirige. C'est un bon choix de design (les 25 pages lisent `ctx.org.id` sans garde) — mais la cible d'une de ces redirections n'existe pas, ce qui transforme la garantie en cul-de-sac (finding P0-1).

### 2. Chemin d'ecriture (web)

```
composant client -> Server Action (lib/actions/*.ts, 15 modules, 2 357 lignes)
     1. requireClientInOrg(clientId)  -> getActiveOrg() + verification org_id du client
     2. Zod safeParse (schemas cales sur les enums SQL)
     3. mutation avec org_id injecte cote serveur
     4. revalidatePath()
```

Ce socle est solide et **applique de facon homogene dans `lib/actions/`**. Le probleme n'est pas la : c'est que `components/` contient un deuxieme circuit d'ecriture, parallele, qui n'emprunte pas ce socle — les `*-actions.ts` de zone (`calendar-actions.ts`, `use-grid-tiles.ts`, `use-library-assets.ts`, `quick-capture.tsx`) melangent orchestration optimiste, toast et **decision de persister ou non**. C'est la cause racine commune de cinq findings ci-dessous.

### 3. Le worker : le meilleur decoupage du depot

```
index.ts (tick 5 s, 114 l.)
  -> engine.ts (137 l.)        machine a etats : idempotence r15, fenetre de grace, sous-etapes
       -> store.ts             INTERFACE JobStore (claim/lease/markPublishStarted/succeed/...)
            <- db/pg-store.ts  adaptateur Postgres (FOR UPDATE SKIP LOCKED, Supavisor SESSION)
            <- InMemoryJobStore (engine.test.ts) : 7 tests sans base ni reseau
       -> context.ts           tokens (Vault) + quota
       -> publishers/index.ts  instagram | facebook | tiktok (STUB_MODE = true, ligne 21)
```

`engine.ts` ne connait que des interfaces : c'est ce qui rend possible le test « REGLE 15 : reprise d'un job DEJA publie => JAMAIS republier ». **Cette qualite est integralement neutralisee par l'exterieur** : les tests ne tournent dans aucun job de CI, le worker n'est ni compile ni type-checke par la CI, il n'a aucun artefact de build, et il n'a aucun canal de sortie (ni Brevo, ni watchdog) pour les jobs qu'il abandonne.

### 4. Le couplage reel : Postgres, sans contrat compile

```
apps/web  --RPC enqueue_publish_jobs-->  publish_jobs  <--SELECT FOR UPDATE SKIP LOCKED--  apps/worker
    |                                         |                                                |
lib/supabase/types.ts (manuel)      supabase/migrations/020_publish_jobs.sql        src/domain.ts (miroir manuel)
                                    + deploy/15_migration_020.sql (transcrit main)
```

`packages/shared` contient **6 unions de types et un `export {}`** ([domain.ts](../../../packages/shared/src/types/domain.ts#L1), [schemas/index.ts](../../../packages/shared/src/schemas/index.ts#L1)) et **n'est declare en dependance d'aucune app**. Le triplet `instagram|facebook|tiktok` est recopie a quatre endroits ; les 9 statuts de job a deux endroits ; les schemas SQL a deux endroits (`supabase/migrations` vs `deploy/`). Aucun de ces miroirs n'est verifie automatiquement, et l'un d'eux **a deja diverge sur un `revoke execute`** (finding P1-11).

### 5. Arborescence cible (proposition, sans changement de comportement)

Le principe directeur : **rendre les frontieres physiques plutot que conventionnelles**. Un module ne doit pas pouvoir importer vers le haut, et un geste metier ne doit avoir qu'une seule implementation, quel que soit l'ecran qui le declenche.

```
packages/
  shared/                       ← CONTRAT UNIQUE web <-> worker (aujourd'hui vide)
    src/
      platforms.ts              Platform, ContentFormat, MediaType  (source des 4 copies actuelles)
      jobs.ts                   JobStatus, JobStep, PublishJob      (source du miroir worker)
      quotas.ts                 limites IG/FB/TikTok (r19) — une seule table de verite
      media-specs.ts            specs JPEG/ratio/poids (r22), partagees preflight <-> worker
      brevo.ts                  ids de templates transactionnels (§10)
      schemas/                  schemas Zod partages (report share, payloads RPC)
  db-types/                     ← types generes depuis les migrations (remplace types.ts manuel)

apps/web/
  app/
    (app)/                      shell freelance
      onboarding/page.tsx       ★ AJOUT : la cible de redirect() de la DAL existe enfin
    (portal)/                   Reviewer
    (public)/                   ★ landing + /r/[token] : la seule surface anonyme, isolee,
      r/[token]/{page,error,not-found}.tsx     avec sa propre frontiere d'erreur
    api/
    not-found.tsx               ★ AJOUT : filet racine hors route group
  lib/
    auth/
      dal.ts                    verifySession (inchange)
      org-context.ts            getActiveOrg / getReviewerContext
      landing.ts                ★ AJOUT : resolution de role UNIQUE (org -> /dashboard,
                                   client_members -> /portal, sinon -> /onboarding).
                                   Consommee par login, proxy, (app)/layout, (portal)/layout
      redirect-target.ts        ★ AJOUT : validateur unique du parametre `next` (open redirect)
    data/                       LECTURE server-only — pro.ts eclate par domaine :
      clients.ts  content.ts  content-media.ts  notifications.ts
      library.ts  metrics.ts  calendar.ts  collaboration.ts  settings.ts   ★ (ex-pro.ts, 878 l.)
      shell.ts                  ★ lectures MAIGRES du shell (id/nom/couleur/compteur)
      _paging.ts                ★ signature commune (orgId, {limit, before}) imposee
    actions/                    ECRITURE — inchange dans son principe, + :
      accounts.ts               ★ AJOUT : disconnectSocialAccount + revocation Vault
      report-share.ts           ★ DEPLACE depuis components/app/performance/
    domain/                     domaine pur (re-exporte packages/shared, ne le duplique plus)
    media/                      ★ AJOUT (CLAUDE.md §4, absent aujourd'hui)
      upload-client.ts            TUS 6 Mo via createBrowserClient (debloque lib/supabase/client.ts)
      convert.ts                  JPEG/HEIC (r22) — la conversion REELLE que applyCrop simule
      thumbnail.ts                vignette WebP ~400px (r20)
    realtime/                   ★ AJOUT : abonnements content_items/content_targets
    oauth/
      selection.ts              ★ AJOUT : ecran de choix des pages avant persistance (P0-3)
      state.ts                  + iat/exp + cookie httpOnly (verifier PKCE hors URL)
  components/                   PRESENTATION UNIQUEMENT — aucune lecture DB, aucune Server Action
    app/{calendar,grid,studio,library,performance,...}
      → chaque zone n'appelle QUE lib/actions/* ; plus de *-actions.ts qui decident de persister
    portal/
    shared/media/               ★ point unique de rendu media (fallback + hote autorise)
    ui/

apps/worker/
  src/
    engine.ts  store.ts  publishers/  tokens/            (inchange — bon decoupage)
    notify.ts                 ★ AJOUT : sortie Brevo pour failed / dead_letter
    health.ts                 ★ AJOUT : sonde de vie (heartbeat en base ou port HTTP)
  Dockerfile                  ★ AJOUT : build deterministe (aujourd'hui aucun artefact)

supabase/
  migrations/                 SOURCE UNIQUE editable a la main (012_media_storage → 013)
  functions/                  ★ AJOUT : watchdog-notify, media-cleanup (§5)
  tests/                      + tests 017/018/021 manquants
deploy/                       ★ DEVIENT UNE SORTIE GENEREE (script + check CI de non-divergence)
scripts/build-deploy-sql.*    ★ AJOUT
```

### 6. Ce que cette cible corrige, principe par principe

| Principe | Violation actuelle | Correction structurelle |
|---|---|---|
| **Une seule implementation par geste metier** | dupliquer/relancer/capturer/supprimer existent en version reelle (lib/actions) ET en version toast (components) | `components/` n'a plus le droit de decider de persister : il appelle `lib/actions/*` ou l'entree est desactivee |
| **Dependances dirigees vers l'interieur** | `components/` importe `lib/data` et porte une Server Action | modules de donnees remontes dans `lib/data`, action remontee dans `lib/actions` |
| **Un contrat, pas des miroirs** | 4 copies de `Platform`, 2 copies de `JobStatus`, 2 dossiers SQL | `packages/shared` devient reellement la source ; `deploy/` devient genere + verifie en CI |
| **Une seule decision de routage** | le role est deduit implicitement par « quelle fonction de contexte la page appelle » | `lib/auth/landing.ts` : un point unique consomme par login, proxy et les deux layouts |
| **Cout de lecture borne** | `getShellSnapshot` charge tout l'historique de l'org a chaque page ; aucune lecture paginee | `data/shell.ts` maigre + `_paging.ts` impose `{limit, before}` a toutes les listes |
| **Le composant critique est verifiable** | le worker n'est ni builde, ni type-checke, ni teste en CI | Dockerfile worker + job CI `worker` (typecheck + test) |

---

## Findings (tries par severite P0 -> P3)

### [P0] La DAL redirige vers `/onboarding`, une route qui n'existe pas — go-live : bloquant

- **Ou** : [apps/web/lib/auth/org-context.ts:79](../../../apps/web/lib/auth/org-context.ts#L79) et :88 ; consommateur : [apps/web/app/(app)/layout.tsx:20](../../../apps/web/app/(app)/layout.tsx#L20)
- **Constat** : `getActiveOrg()` fait `redirect("/onboarding")` a deux endroits — quand l'utilisateur n'a aucune ligne `organization_members` (l.79) et quand la jointure `organizations` est vide (l.88). Or l'inventaire des routes (`find app -name page.tsx`) ne contient **aucun segment `onboarding`** : `(app)/` = agenda, clients, dashboard, notifications, settings. Le seul « onboarding » du depot est `components/app/onboarding`, le wizard de creation de **client**. Il n'y a pas non plus de `app/not-found.tsx` racine : la requete tombe sur le 404 nu de Next. Aucun chemin d'amorcage d'org n'existe par ailleurs : la RPC `create_organization` n'est appelee qu'a [app/(auth)/actions.ts:85](../../../apps/web/app/(auth)/actions.ts#L85), dans la branche `if (data.session)` et sans que son erreur soit lue, `signInWithPassword` ne l'appelle jamais, et le trigger `handle_new_user` ([003_identity_orgs.sql:53-74](../../../supabase/migrations/003_identity_orgs.sql#L53)) n'insere que dans `profiles` — conformement a la regle 9.
- **Scenario d'echec / cout a l'echelle** : (a) confirmation d'e-mail activee (defaut d'un projet neuf) : inscription -> pas de session immediate -> `/login?pending=1` -> confirmation -> connexion -> `/dashboard` -> `layout.tsx:20` -> `/onboarding` -> 404 definitif, sans aucune issue dans l'UI ; (b) chemin actif **des aujourd'hui** en phase solo : `proxy.ts:45-50` renvoie tout utilisateur authentifie present sur `/login` vers `/dashboard` — un Reviewer, qui n'a par construction aucune ligne `organization_members` (regle 6), y tombe systematiquement ; (c) `updatePassword` fait `redirect("/dashboard")` en dur ([actions.ts:146](../../../apps/web/app/(auth)/actions.ts#L146)) : meme mur pour un Reviewer qui vient de poser son mot de passe. Collision de slug possible aussi : `organizations.slug` est unique et le retour de la RPC n'est pas verifie.
- **Pourquoi ca bloque le scaling** : l'amorcage d'organisation est aujourd'hui un **effet de bord d'un `if`** au lieu d'etre un etat de routage explicite. A l'ouverture SaaS, 100 % des inscriptions traversent ce chemin.
- **Reco** : creer `app/(app)/onboarding/page.tsx` (ou un groupe `(onboarding)` hors du shell, puisque le shell exige une org) appelant `create_organization` via une Server Action Zod-validee, puis `redirect(routes.dashboard)`. Ajouter `app/not-found.tsx` racine. Et **distinguer le cas Reviewer** : s'il a des lignes `client_members` sans org, la cible est `/portal`, pas `/onboarding` (voir finding suivant).
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r10 (org active depuis le cookie), r6

### [P0] Aucun point de resolution de role : un Reviewer connecte est envoye dans `(app)` — go-live : bloquant

- **Ou** : [apps/web/app/(app)/layout.tsx:20](../../../apps/web/app/(app)/layout.tsx#L20) ; [apps/web/app/(auth)/actions.ts:47](../../../apps/web/app/(auth)/actions.ts#L47) ; [apps/web/proxy.ts:45](../../../apps/web/proxy.ts#L45) ; [apps/web/app/(portal)/layout.tsx:11](../../../apps/web/app/(portal)/layout.tsx#L11)
- **Constat** : le seul aiguillage apres login est `redirect(target)` avec `target = "/dashboard"` par defaut, et le proxy renvoie tout utilisateur connecte de `/login` vers `/dashboard`. Le groupe `(app)` n'a **aucune garde de role** : `layout.tsx:20` appelle directement `getActiveOrg()`. Symetriquement, `(portal)/layout.tsx` n'empeche pas un membre d'org d'entrer dans le portail. Le role n'est donc jamais decide : il est **deduit implicitement par la fonction de contexte que la page appelle**. `api/invitations/accept/route.ts:70-78` n'insere que dans `client_members`, et cree l'utilisateur **sans mot de passe** (l.55), donc sa seule re-entree passe par `forgot-password` -> `updatePassword` -> `/dashboard` -> 404.
- **Scenario d'echec / cout a l'echelle** : un client d'Etienne accepte son invitation (il atterrit bien sur `/portal` via la l.95 de la route d'acceptation), revient deux jours plus tard, se connecte -> `/dashboard` -> `/onboarding` -> 404. Il ne retrouve jamais son espace de validation sauf a taper `/portal` a la main. Le portail de validation client — l'argument produit central — est inatteignable par le parcours nominal des la 2e session.
- **Pourquoi ca bloque le scaling** : chaque nouveau groupe de routes rejouera le bug, et l'arrivee d'un 2e role client (`editor` existe deja dans `client_members`) ou d'un 2e admin d'org rend le raisonnement ingerable.
- **Reco** : introduire `lib/auth/landing.ts` — resolution unique cote serveur (membre d'org -> `/dashboard` ; sinon `client_members` non vide -> `/portal` ; sinon `/onboarding`) — consommee par (1) le retour de `signInWithPassword`, (2) le rebond `/login` du proxy, (3) une garde dans `(app)/layout.tsx`, (4) une garde symetrique dans `(portal)/layout.tsx`. C'est le meme correctif structurel que le finding precedent : une seule decision, un seul endroit.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r6

### [P0] Connexion Meta : toutes les pages du compte Facebook sont rattachees au client courant — go-live : bloquant

- **Ou** : [apps/web/lib/oauth/tokens.ts:179](../../../apps/web/lib/oauth/tokens.ts#L179) ; [apps/web/lib/oauth/identity.ts:65](../../../apps/web/lib/oauth/identity.ts#L65)
- **Constat** : `resolveMeta` appelle `/me/accounts` et pousse dans `subAccounts` **chaque** page Facebook administree + son compte IG business associe, sans filtre et **sans lire `paging.next`** (troncature silencieuse au-dela de 25 pages). `persistPlatformConnection` boucle ensuite `for (const sub of resolved.subAccounts)` et ecrit un `social_accounts` avec `client_id: ctx.clientId` pour chacun, via `createAdminClient` (l.54, service_role, **RLS bypassee**). Le `clientId` vient du query param du lien UI ([connect-account-menu.tsx:38](../../../apps/web/components/app/settings/connect-account-menu.tsx#L38) -> `route.ts:32`), signe dans le state. Aucun ecran de selection n'existe (`grep subAccounts` = 2 fichiers). La seule contrainte DB est `unique(client_id, platform, provider_account_id)` ([005_accounts_shell.sql:52](../../../supabase/migrations/005_accounts_shell.sql#L52)) : rien ne bloque.
- **Scenario d'echec / cout a l'echelle** : Etienne administre les pages FB/IG de ses 4 clients depuis son compte Facebook pro — cas nominal d'un freelance. Il clique « Connecter Instagram » dans le groupe du client A : les comptes IG des clients B, C et D deviennent immediatement des comptes du client A. En aval, `reconcileTargets` ne verifie que `client_id` ([content.ts:175-181](../../../apps/web/lib/actions/content.ts#L175)) — les lignes polluees passent, puisque leur `client_id` est justement le mauvais — et le composer les propose comme cibles de publication. Corollaire immediat : `getSocialAccounts` fait `.maybeSingle()` sur le compte IG du client ([clients.ts:98-104](../../../apps/web/lib/data/clients.ts#L98)) et **casse des que deux lignes IG partagent un client_id**.
- **Pourquoi ca bloque le scaling** : degradation lineaire avec le portefeuille — plus il y a de clients, plus la liste de cibles polluees est longue et plus l'erreur de selection est probable. Note : `org_id` reste correct, ce **n'est pas une fuite inter-tenant** ; c'est une erreur d'affectation intra-org, que la RLS ne peut structurellement pas attraper.
- **Reco** : ne rien persister automatiquement. Apres `resolveIdentity`, stocker les `subAccounts` en attente et rediriger vers un ecran de selection (`lib/oauth/selection.ts` + route dediee) : « quelle page appartient a ce client ? ». N'ecrire que les comptes choisis. A minima, filtrer sur un `providerAccountId` transmis dans le state signe. Traiter `paging.next`.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : aucune (mais r11-r14 s'appliquent aux tokens de page ainsi captes)

---

### [P1] Aucune voie de retour : impossible de detacher ou supprimer un compte social — go-live : degrade

- **Ou** : [apps/web/lib/oauth/tokens.ts:184](../../../apps/web/lib/oauth/tokens.ts#L184)
- **Constat** : `persistSocialAccount` est le **seul** code du depot qui ecrit dans `social_accounts`. Aucun `.delete()` sur `social_accounts`, `platform_connections`, `calendar_accounts` ni `*_secrets` dans tout `apps/web` ; il n'existe pas de `lib/actions/accounts.ts` ; la page des reglages n'offre que « connecter / reconnecter » ([account-row.tsx:25](../../../apps/web/components/app/settings/account-row.tsx#L25)). Aucune revocation Vault nulle part (`grep delete_secret|revoke_secret` sur `supabase/` = 0). Le bouton « disconnect » du wizard d'onboarding n'est que de l'etat local avec un toast « (apercu) ».
- **Scenario d'echec / cout a l'echelle** : consequence directe du finding precedent — une fois 4 comptes clients rattaches au mauvais client, **aucun moyen dans l'app de reparer**. La seule issue est un `DELETE` SQL manuel en production sur des lignes portant des FK composites et des secrets Vault. Aggravant : `content_targets -> social_accounts` est en `ON DELETE RESTRICT` ([006_content_core.sql:44](../../../supabase/migrations/006_content_core.sql#L44)), donc meme le contournement par suppression de client peut echouer.
- **Pourquoi ca bloque le scaling** : chaque erreur de rattachement, chaque fin de contrat et chaque rotation de page Facebook devient une intervention SQL manuelle. Non tenable des 5-10 clients, et **probleme de conformite** : un client qui part laisse ses tokens chiffres dans Vault indefiniment.
- **Reco** : `lib/actions/accounts.ts` avec `disconnectSocialAccount(clientId, accountId)` (`requireClientInOrg` -> passage en `expired` si des `content_target` le referencent, delete sinon) et une RPC service_role de revocation supprimant les secrets Vault. Cabler le bouton dans `account-row.tsx`.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r11

### [P1] State OAuth sans expiration ni lien avec la session ; le verifieur PKCE voyage dans l'URL du provider — go-live : degrade

- **Ou** : [apps/web/lib/oauth/state.ts:33](../../../apps/web/lib/oauth/state.ts#L33) ; [apps/web/app/api/oauth/[provider]/callback/route.ts:34](../../../apps/web/app/api/oauth/[provider]/callback/route.ts#L34)
- **Constat** : `signState` serialise `{provider, orgId, userId, clientId, codeVerifier, nonce}` en base64url signe HMAC — **sans champ `exp`**, sans cookie associe, et le `nonce` genere n'est jamais stocke ni compare (donc rejouable). Le callback verifie la signature et `state.provider`, puis persiste avec `{orgId: state.orgId, userId: state.userId}` : il n'appelle **jamais** `verifySession()` ni `getActiveOrg()`. La cible d'ecriture vient integralement du state, jamais de la session du navigateur — et l'ecriture passe par `createAdminClient` (RLS bypassee). `proxy.ts:20` met `/api/oauth` dans les prefixes publics : la victime n'a meme pas besoin d'un compte Ocean. Le `codeVerifier` PKCE est en clair dans le payload, donc transmis au provider dans le parametre `state`, **a cote du `code_challenge`** ([index.ts:32](../../../apps/web/lib/oauth/index.ts#L32)).
- **Scenario d'echec / cout a l'echelle** : un utilisateur Ocean malveillant demarre `/api/oauth/meta?clientId=<son client>`, recupere l'URL d'autorisation complete (state signe, valide pour toujours) et l'envoie a une cible connectee a Facebook. La cible approuve : le callback echange le code et persiste les tokens de la victime **dans l'org de l'attaquant**, qui peut alors publier sur les comptes de la victime. Inexploitable tant qu'Etienne est seul utilisateur (produire un state exige une session Ocean) — d'ou P1 et non P0.
- **Pourquoi ca bloque le scaling** : c'est une faille de capture de compte inter-tenant qui s'ouvre **mecaniquement le jour du premier utilisateur tiers**, sans qu'aucun code ne change.
- **Reco** : ajouter `iat`/`exp` (10 min) au state et les verifier ; poser un cookie httpOnly `oauth_nonce` a l'initiation et exiger l'egalite au callback ; appeler `verifySession()` au callback et refuser si `user.id !== state.userId` ; **sortir le `codeVerifier` du state** (le mettre dans le meme cookie httpOnly).
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Regle CLAUDE.md** : r13

### [P1] 17 composants rendent les medias via `next/image` alors que seul `images.pexels.com` est autorise — go-live : bloquant

- **Ou** : [apps/web/next.config.ts:14](../../../apps/web/next.config.ts#L14) ; [apps/web/components/shared/media-thumb.tsx:36](../../../apps/web/components/shared/media-thumb.tsx#L36)
- **Constat** : `remotePatterns` ne declare qu'un hote, `images.pexels.com` — **residu de la periode mocks** (le mot « pexels » n'existe nulle part ailleurs en source ni en seed). Or 17 fichiers de `components/` rendent des `<Image>` dont les URLs viennent de `getPublicUrl` sur `media-thumbs` et de `createSignedUrls` sur `media-originals` ([content-media.ts:43](../../../apps/web/lib/data/content-media.ts#L43) et :50), donc toujours l'hote `<ref>.supabase.co`. Aucun composant n'utilise `unoptimized`, aucun loader custom.
- **Scenario d'echec / cout a l'echelle** : au premier media reel (chantier TUS), l'optimiseur repond HTTP 400 « url parameter is not allowed ». Precision importante : **ce n'est pas une page d'erreur en production** — le `throw` « hostname is not configured » est enferme dans `if (process.env.NODE_ENV !== 'production')` cote Next, et `MediaThumb` gere l'`onError` (l.43) vers une icone de repli. Le resultat reel est donc : grille feed IG, studio, mediatheque, portail de validation et rapport public `/r/[token]` **entierement vides de tout media**, pour un produit dont la promesse est visuelle. Le crash brut n'existe qu'en `next dev`.
- **Pourquoi ca bloque le scaling** : chaque nouvel hote (CDN, domaine custom Supabase, avatars Meta) devra etre ajoute a la main ; sans point unique de resolution d'URL cote composants, le probleme se repose a chaque integration.
- **Reco** : ajouter le hostname du projet Supabase aux `remotePatterns` (derive de `NEXT_PUBLIC_SUPABASE_URL`, `pathname: /storage/v1/object/**`). Centraliser le rendu media derriere `components/shared/media/` pour n'avoir qu'un seul point a durcir. A verifier avec un media reel sur le portail et sur `/r/[token]`.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Regle CLAUDE.md** : aucune

### [P1] `lib/supabase/client.ts` est du code mort : zero client navigateur, donc zero Realtime et aucun chemin d'upload — go-live : degrade

- **Ou** : [apps/web/lib/supabase/client.ts:9](../../../apps/web/lib/supabase/client.ts#L9)
- **Constat** : `createClient()` (`createBrowserClient`) n'est importe **nulle part** (grep repo-wide : le fichier lui-meme et des `.md` d'audit). `grep -i "\.channel\(|postgres_changes|realtime|removeChannel"` sur tout `apps/web` : **aucun resultat**. La couche navigateur -> Supabase n'existe pas, alors que la stack l'annonce (§1 et §10 : Realtime pour les notifications in-app et le statut de publication). `lib/media/`, prevu par le CLAUDE.md §4, n'existe pas non plus. `recordUploadedAsset` ([media.ts:37](../../../apps/web/lib/actions/media.ts#L37)) n'a **aucun appelant**, et son en-tete affirme que le binaire « transite par le client Supabase du navigateur (TUS 6 Mo) » — un chemin qui n'existe pas.
- **Scenario d'echec / cout a l'echelle** : (1) le worker fait passer un contenu en `publishing` puis `published`/`failed` : l'ecran du freelance ne bouge pas, il faut recharger a la main — le triple canal (push + Realtime + email) n'a **aucune** de ses trois jambes cablee ; (2) plus grave pour le go-live, l'upload TUS 6 Mo vers `media-originals`, la conversion JPEG/HEIC et la vignette WebP doivent s'executer dans le navigateur (regles 20 et 22) et n'ont aucun client pour le faire — donc aucun media reel dans l'app, donc le preflight bloque toute programmation IG/FB par manque de media.
- **Pourquoi ca bloque le scaling** : toute la moitie « temps reel + media » du produit est inatteignable ; plus le front grossit autour de lectures serveur uniquement, plus le rattrapage coute cher.
- **Reco** : ne **pas** supprimer ce module — c'est la brique manquante, pas un residu. Creer `lib/media/{upload-client,convert,thumbnail}.ts` (composant client : `createClient()` + TUS 6 Mo + conversion + vignette -> `recordUploadedAsset`), puis `lib/realtime/` avec un abonnement `content_items`/`content_targets` scope `client_id`.
- **Effort** : L   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r20, r22

### [P1] `applyCrop` falsifie mimeType et dimensions : le prevol passe au vert sur un media non conforme — go-live : degrade

- **Ou** : [apps/web/components/app/studio/composer/composer-types.ts:91](../../../apps/web/components/app/studio/composer/composer-types.ts#L91)
- **Constat** : `applyCrop()` reecrit `width`/`height` aux dimensions du preset, force `mimeType` a `"image/jpeg"` pour toute image, et remplace `fileSizeMb` par la constante `RECOMPRESSED_MB = 7.6` au-dela de 8 Mo. **Aucun traitement d'image n'a lieu** — le commentaire l.90 le dit (« preset de recadrage mock »). Or `preflight.ts:6` consomme `draft.media` et le passe a `validateMedia`/`validateCarousel`, qui valident exactement ces trois champs ([specs.ts:75-92](../../../apps/web/lib/specs.ts#L75)) : le prevol valide donc des **valeurs fabriquees**. Le deblocage est reel : `confirmDisabled = blocked` dans `schedule-dialog.tsx:88`. Cote persistance, seul `crop_preset` est ecrit ([content.ts:229](../../../apps/web/lib/actions/content.ts#L229)) et aucun pipeline ne l'applique jamais aux pixels — `draftFromContent` ne le restaure meme pas.
- **Scenario d'echec / cout a l'echelle** : un fichier de 12 Mo affiche 7,6 Mo, le prevol est vert, le contenu part en validation client puis en `scheduled`. Le jour de la publication le worker signe l'original — toujours 12 Mo — et l'API Instagram refuse : erreur permanente, `failed` direct (regle 18). Le post ne sort pas et **personne ne l'a vu venir puisque le prevol disait « conforme »**. Aggravant : le hint du dialogue promet explicitement une « conversion et compression automatiques avant publication » qui n'existe pas.
- **Pourquoi ca bloque le scaling** : le prevol est le contrat de confiance du produit. Chaque plateforme ajoutee heritera d'un validateur qui note un **etat local non representatif du fichier** ; l'ecart entre « ce que le prevol valide » et « ce que le worker envoie » grandit a chaque regle.
- **Reco** : tant que la conversion reelle n'existe pas (`lib/media/convert.ts`, regle 22), **ne pas mentir** : laisser les valeurs reelles et faire echouer le prevol en `error` avec « recadrage/conversion requis, non disponible ». Quand la conversion arrive, `applyCrop` doit produire un vrai Blob re-uploade, et `crop_preset` ne doit etre persiste que si le fichier stocke correspond.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r22

### [P1] Calendrier : dupliquer et relancer affichent un succes alors que les Server Actions reelles ne sont jamais appelees — go-live : degrade

- **Ou** : [apps/web/components/app/calendar/calendar-actions.ts:241](../../../apps/web/components/app/calendar/calendar-actions.ts#L241) (+ :224 `performRetry`, :230 `performRemind`)
- **Constat** : dans **le meme fichier**, `performDrop`/`performReschedule`/`performShift`/`performUnschedule`/`performSendToReview` persistent vraiment (`scheduleContentItem`, `applyStatusIntent`, avec rollback). Mais `performDuplicate`, `performRetry` et `performRemind` ne font **que** `toast.success(...)`. Or `duplicateContent` existe ([content.ts:419](../../../apps/web/lib/actions/content.ts#L419)), verifie que le client cible appartient a la meme org (l.430-437) et est **deja utilisee** par `studio/detail-duplicate-dialog.tsx:57`. Pire : `DuplicateDialog` propose explicitement de dupliquer **vers un autre client**, et `editorial-calendar.tsx:226-231` resout bien le client cible avant de n'envoyer que son nom au toast.
- **Scenario d'echec / cout a l'echelle** : Etienne prepare le mois, duplique un post vers 3 dates et vers un 2e client, voit « Duplique · vers Cafe Riviera le 20 aout », ferme l'onglet. Rien n'a ete cree. Il decouvre le trou quand le client s'etonne de ne rien recevoir. Attenuation : les libelles portent le marqueur « (apercu) », convention du projet (151 occurrences) — donc l'UI ne ment pas totalement, mais elle affirme un travail non effectue.
- **Pourquoi ca bloque le scaling** : **deux implementations divergentes du meme geste metier** (studio = reelle, calendrier = factice). Toute evolution de la duplication (adaptation des hashtags, gestion des medias) devra etre refaite deux fois, et le risque qu'une des deux reste menteuse se reproduira a chaque zone ajoutee. C'est le symptome le plus net du probleme d'architecture de cette dimension.
- **Reco** : cabler `performDuplicate` sur `duplicateContent({sourceClientId, contentId, targetClientId})` + `router.refresh()`, meme pattern optimiste/rollback que `persistOne`/`persistBatch` deja present dans ce fichier. **Attention** : le retry n'est pas symetrique — `requestTargetRetry` exige un `targetId` que `performRetry` n'a pas, et pose une **intention** `retry_requested_at` plutot que de rearmer un job (choix conforme r15, [content-status.ts:143-157](../../../apps/web/lib/actions/content-status.ts#L143)). Si une operation reste non branchee, elle ne doit pas rendre un `toast.success` : desactiver l'entree de menu.
- **Effort** : S (duplication) / M (retry)   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : aucune

### [P1] Grille : « relancer » un post en echec ne fait que repeindre la tuile en local — go-live : degrade

- **Ou** : [apps/web/components/app/grid/use-grid-tiles.ts:212](../../../apps/web/components/app/grid/use-grid-tiles.ts#L212)
- **Constat** : `retryTile()` remplace localement le statut par `scheduled`, pose une nouvelle date, efface `lastError`, `commit()` puis toast — **aucune Server Action**. Le meme hook importe pourtant `applyStatusIntent` et `scheduleContentItem` et s'en sert pour `dropFromShelf`, `applyPending`, `batchShiftWeek`, `batchSendReview`, `batchCancel`, avec rollback et `router.refresh()`. Le bouton n'apparait que si `tile.status === 'failed'` — un statut DB reel — et son libelle est « Reprogrammer », **sans mention « apercu »** ([quick-view-body.tsx:160](../../../apps/web/components/app/grid/quick-view-body.tsx#L160)). Trois toasts de ce fichier sont en francais en dur, hors dictionnaire i18n (l.196, 206, 222), plus `use-grid-view.ts:76` et :92, dans une base par ailleurs integralement traduite via `useT()`.
- **Scenario d'echec / cout a l'echelle** : une publication IG echoue a 09:00. Etienne voit la tuile rouge, clique « Reprogrammer », la tuile passe au bleu et le message d'erreur disparait. Rien n'est reprogramme : au rechargement la tuile est de nouveau en echec, et entre-temps il a considere le probleme comme traite. En anglais, le toast s'affiche en francais.
- **Pourquoi ca bloque le scaling** : la grille est l'ecran de pilotage quotidien ; tant qu'elle melange des mutations reelles et des mutations d'apercu **indistinguables a l'oeil**, chaque nouvelle action heritera de l'ambiguite.
- **Reco** : brancher `retryTile` sur `requestTargetRetry` (deja utilise par `studio/content-targets.tsx:57`) ; a defaut retirer l'action de la quick-view et laisser la reprise sur la fiche contenu, seul endroit ou elle est reelle. Passer les 5 toasts par `useT()` et ajouter une regle Biome interdisant un litteral dans `toast.*`.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : aucune (i18n : convention projet)

### [P1] Le bouton de capture rapide mobile (FAB, parcours PWA iOS prioritaire) n'enregistre aucune idee — go-live : degrade

- **Ou** : [apps/web/components/app/shell/quick-capture.tsx:42](../../../apps/web/components/app/shell/quick-capture.tsx#L42)
- **Constat** : `saveIdea()` verifie que la note n'est pas vide, affiche `nav.capture.ideaSaved` avec le nom du client, vide le champ et ferme la feuille. Aucune Server Action — le fichier n'importe **aucun** module d'ecriture. `saveContentItem` existe pourtant ([content.ts:82](../../../apps/web/lib/actions/content.ts#L82), Zod + `requireClientInOrg`) et est deja utilisee **pour ce cas exact** avec `state: "idea"` par `studio/board-idea-bank.tsx:106`. Le FAB est rendu en `md:hidden` (l.62) — c'est le chemin de saisie **mobile**, celui que le CLAUDE.md §12 designe comme prioritaire — mais la meme feuille est aussi ouvrable depuis la palette de commandes (`command-palette.tsx:115`), donc l'impact est aussi desktop.
- **Scenario d'echec / cout a l'echelle** : Etienne est chez un client, note « idee : serie coulisses torrefaction, 3 posts », choisit le client, valide. Le toast confirme. L'idee n'existe nulle part. **Perte silencieuse avec accuse de reception positif** — le pire profil d'erreur possible.
- **Pourquoi ca bloque le scaling** : le FAB est la porte d'entree du produit en mobilite ; toute future capture (photo, vocal, partage iOS) se greffera dessus. Sans chemin de persistance des maintenant, chaque ajout repartira d'un toast.
- **Reco** : appeler `saveContentItem({clientId, title: note, state: 'idea', format, caption})` dans un `useTransition`, avec toast d'erreur en cas d'echec, exactement comme `board-idea-bank.tsx`.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : aucune

### [P1] Le rapport partage au client ne contient ni la note redigee ni les sections choisies — go-live : degrade

- **Ou** : [apps/web/components/app/performance/report-workspace.tsx:27](../../../apps/web/components/app/performance/report-workspace.tsx#L27)
- **Constat** : `ReportWorkspace` tient `sections` (`useState(DEFAULT_SECTIONS)`) et `note` (`useState(() => t('report.note.default'))`) en **etat client local, jamais persiste**. Le partage public fige un snapshot cote serveur : `report-share-actions.ts:17` declare `shareSchema = z.object({ clientId })` — l'action ne peut **structurellement pas** recevoir note ni sections — et le payload fige est `{...data, client: clientSafe}` ou `ReportData` ne contient ni l'un ni l'autre. `report-actions.tsx:36` appelle `createReportShare({clientId})` alors qu'il **detient `sections` en props**. La page publique rend `<ReportWorkspace data={report} readOnly />` : les deux `useState` repartent des valeurs par defaut.
- **Scenario d'echec / cout a l'echelle** : Etienne decoche « Mix de contenus », remplace la note auto par un commentaire personnalise, partage le lien. Le client voit le mix de contenus retire et la note generique. **Etienne n'a aucun moyen de s'en apercevoir** : son ecran affiche toujours sa version locale.
- **Pourquoi ca bloque le scaling** : le modele snapshot est le **bon** choix (anti-fuite, viewer anonyme, notes internes retirees a la l.34) mais il n'a **aucun contrat avec l'etat d'edition du composant**. Chaque nouvel element personnalisable (logo, periode, commentaire par section) divergera de la meme facon.
- **Reco** : remonter `note` + `sections` dans la signature Zod de `createReportShare` et les inclure dans le payload fige ; `ReportWorkspace` doit initialiser son etat depuis `data` (`data.note ?? defaut`) pour que `readOnly` rende exactement le snapshot.
- **Effort** : M   **Impact** : moyen
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r27

### [P1] Open redirect sur le parametre `next` du login — go-live : degrade

- **Ou** : [apps/web/app/(auth)/actions.ts:47](../../../apps/web/app/(auth)/actions.ts#L47)
- **Constat** : `const target = typeof next === "string" && next.startsWith("/") ? next : "/dashboard"` puis `redirect(target)`. La valeur vient telle quelle de l'URL (`login-form.tsx:18` puis champ cache l.35), sans validation. Un chemin protocol-relative `//evil.com` satisfait `startsWith("/")`. Verifie dans le framework installe : `redirect()` ne valide rien, `assign-location.js` resout `//evil.com` en `https://evil.com/`, et `isExternalURL` declenche une navigation complete (seules les URLs `javascript:` sont bloquees). A comparer avec [app/auth/callback/route.ts:18](../../../apps/web/app/auth/callback/route.ts#L18) qui, lui, reconstruit `${origin}${next}` et n'est pas exploitable.
- **Scenario d'echec / cout a l'echelle** : `https://app.ocean/login?next=//faux-ocean.tld/login` envoye a Etienne ou a un Reviewer. La page de login est **authentique** (bon domaine, bon certificat), la connexion reussit, puis le navigateur atterrit sur une copie hebergee par l'attaquant qui redemande le mot de passe.
- **Pourquoi ca bloque le scaling** : `next` est produit par le proxy (`redirectToLogin`) **et** par les liens d'invitation (`?next=/portal`) : la surface ne fera que croitre avec les deep links et la PWA.
- **Reco** : un validateur unique `lib/auth/redirect-target.ts` — `new URL(next, origin)` puis verification `url.origin === origin` — consomme par `actions.ts` **et** `auth/callback/route.ts`.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Regle CLAUDE.md** : r27

### [P1] Deux sources de verite du schema (`deploy/*.sql` en prod vs `supabase/migrations/*.sql` en CI) — deja divergentes sur une ligne de securite — go-live : degrade

- **Ou** : [deploy/14_migration_019.sql:45](../../../deploy/14_migration_019.sql#L45) et :68 (`revoke execute ... from public;`) vs [supabase/migrations/019_integration_secrets.sql:54](../../../supabase/migrations/019_integration_secrets.sql#L54) et :80 (`... from public, anon, authenticated;`) ; meme ecart entre `deploy/15_migration_020.sql:155/187` et `020_publish_jobs.sql:217/256`
- **Constat** : diff integral des deux dossiers avec normalisation des commentaires et blancs : 001->009, 011, 013-016 identiques, 010 differe seulement par des enveloppes idempotentes, 012 est la concatenation exacte de `012_media.sql` + `012_media_storage.sql`. **019 et 020 divergent sur les `revoke`** : la version reellement executee en prod ne revoquait que `public`, pas `anon`/`authenticated`. C'est exactement la faille Vault documentee dans [021_secdef_grants_hardening.sql:1-15](../../../supabase/migrations/021_secdef_grants_hardening.sql#L1), refermee apres coup. `grep -rn "deploy/" .github/ scripts/ package.json` ne retourne **rien** : aucun mecanisme ne compare les deux dossiers. (Sur `enqueue/cancel_publish_jobs` l'ecart est net-neutre — le `grant to authenticated` suivant l'annule ; l'ecart de securite reel ne porte que sur les deux helpers Vault de 019.)
- **Scenario d'echec / cout a l'echelle** : un lecteur du repo lit `supabase/migrations/019` et conclut que `store_integration_secret` n'a jamais ete exposee a `anon` — **c'est faux pour la prod**, qui a tourne avec la faille jusqu'a l'application de 021. Prochain episode : une migration 022 ecrite et testee contre le schema CI s'applique sur une prod construite depuis `deploy/` et echoue — ou, pire, reussit avec un resultat different.
- **Pourquoi ca bloque le scaling** : le delta grandit a chaque migration recopiee a la main. A 40 migrations, plus personne ne saura ce que la prod contient reellement, et **le pgTAP en CI validera une base fictive** — c'est-a-dire que toute la garantie RLS (regles 1-8) reposera sur une preuve hors-sol.
- **Reco** : faire de `deploy/` une **sortie generee** : `scripts/build-deploy-sql` concatene `supabase/migrations/NNN` + `begin/commit`, plus un step CI qui echoue si `deploy/` differe du regenere. Un seul dossier reste editable a la main.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Regle CLAUDE.md** : r1-r8 (fondation de la preuve)

### [P1] Les 7 tests d'idempotence du worker ne tournent nulle part en CI — go-live : degrade

- **Ou** : [.github/workflows/ci.yml:107](../../../.github/workflows/ci.yml#L107) (job `web` : install, Biome, typecheck web, build web) ; [apps/worker/package.json:9](../../../apps/worker/package.json#L9)
- **Constat** : `apps/worker/src/engine.test.ts` (226 lignes) couvre precisement les invariants qui evitent une double publication chez un client. **Je les ai executes** : `pnpm --filter worker test` = 7/7 verts, dont « REGLE 15 : reprise d'un job DEJA publie => JAMAIS republier » (l.138) et « erreur permanente (media invalide) au publish => failed, pas de retry » (l.215). La CI n'a que deux jobs (`db`, `web`) : ni `pnpm --filter worker test` ni `pnpm --filter worker typecheck` n'y figurent, et `pnpm build` (racine, l.10) ne construit que web. **Le worker n'est jamais compile ni teste par la CI.**
- **Scenario d'echec / cout a l'echelle** : une refacto de `engine.ts` — deplacer la pose de `publish_started_at` apres l'appel HTTP, ou changer la logique de reprise sur `status_code` — merge sur main avec une CI verte. Au premier crash entre le `POST /media_publish` et le commit, le job est reclaim et republie : **deux posts identiques sur le compte Instagram d'un vrai client**.
- **Pourquoi ca bloque le scaling** : c'est la seule preuve automatisee de la promesse la plus chere du produit. Non branchee, elle se degrade en documentation.
- **Reco** : ajouter un job `worker` a `ci.yml` (`pnpm install --frozen-lockfile`, `pnpm --filter worker typecheck`, `pnpm --filter worker test`), sans `continue-on-error`, et l'exiger dans la protection de branche.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Regle CLAUDE.md** : r15, r16, r18

### [P1] Aucun watchdog ni Edge Function : `supabase/functions` n'existe pas, aucun `cron.schedule` — go-live : degrade

- **Ou** : `supabase/` (contenu reel : `config.toml`, `migrations/`, `tests/`) ; [supabase/migrations/002_enums.sql:106](../../../supabase/migrations/002_enums.sql#L106) declare pourtant `'watchdog_alert'` ; [apps/web/lib/brevo/transactional.ts:33](../../../apps/web/lib/brevo/transactional.ts#L33)
- **Constat** : le CLAUDE.md §4/§5 exige deux Edge Functions (`media-cleanup`, `watchdog-notify`) et un watchdog pg_cron 1x/5 min. Le dossier n'existe pas, `grep cron.schedule|pg_cron` sur `supabase/` et `deploy/` ne remonte rien, et `001_extensions_schema_utils.sql:1` n'active que `pgcrypto` — **pg_cron n'est meme pas installe**. Les seules traces du watchdog sont une valeur d'enum et une constante de template Brevo, **sans aucun producteur**. Preuve interne : [pg-store.ts:81](../../../apps/worker/src/db/pg-store.ts#L81) delegue explicitement les jobs a bout de tentatives « au watchdog pg_cron (independant, §5) » — qui n'existe pas ; et `grep notifications|brevo` dans `apps/worker/src` ne remonte **rien** : `dead_letter` n'a aucun canal de sortie.
- **Scenario d'echec / cout a l'echelle** : le worker meurt a 2h du matin (OOM, rotation du mot de passe DB, redeploiement rate). Les jobs restent `scheduled` avec `run_at` depasse. Personne n'est notifie ; le client decouvre a J+1 que son post n'est jamais sorti, et **rien ne distingue « pas de job » de « worker mort »**.
- **Pourquoi ca bloque le scaling** : avec 1 utilisateur c'est un incident ; avec 20 clients c'est un incident par semaine, non detecte, sur un produit dont la promesse est « ca part tout seul ».
- **Reco** : creer `supabase/functions/watchdog-notify` (jobs `run_at < now()-2min` et `status='scheduled'` -> Brevo `watchdog-alert`) et `media-cleanup`, plus une migration `cron.schedule` 1x/5 min. Le filet **doit** etre independant du worker — c'est tout son interet.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : §5 (filets) + §10 (`publish-failed` = canal garanti)

### [P1] Le worker n'a aucun artefact de build : Dockerfile web-only et demarrage par `tsx` (devDependency) — go-live : degrade

- **Ou** : [Dockerfile:10](../../../Dockerfile#L10) (le stage `deps` ne copie que `apps/web/package.json`), `CMD node apps/web/server.js` (l.38) ; [apps/worker/package.json:7](../../../apps/worker/package.json#L7) (`"start": "tsx src/index.ts"`) et :18 (`tsx` en `devDependencies`)
- **Constat** : le **seul** Dockerfile du depot construit exclusivement `apps/web`. Le runbook [deploy/GO-LIVE-points-1-2.md:50-53](../../../deploy/GO-LIVE-points-1-2.md#L50) prevoit de creer la 2e app Coolify avec `pnpm install` + `pnpm --filter worker start`, c'est-a-dire **executer du TypeScript a l'execution via une devDependency**, sans `--frozen-lockfile`. Il n'existe ni build, ni image, ni `dist/` pour le worker. Nuance honnete : `pnpm-lock.yaml:100-117` contient bien un importer `apps/worker` (tsx epingle 4.23.1, pg 8.22.0), donc les versions sont deterministes, et le chemin Nixpacks du runbook est probablement fonctionnel — ce n'est pas un blocage demontre.
- **Scenario d'echec / cout a l'echelle** : tout environnement qui installe avec `NODE_ENV=production` omet les devDependencies -> `tsx: not found` -> conteneur en boucle de restart. Le job reste `scheduled`, rien ne part, **et aucune alerte n'existe** (ni watchdog, ni Sentry) : le seul indice est un log Coolify que personne ne regarde.
- **Pourquoi ca bloque le scaling** : tant qu'il n'y a pas d'image reproductible, chaque redeploy du worker depend de l'etat du VPS (version de node, cache pnpm). **Le composant le plus critique du produit — celui qui poste chez les clients — est le seul sans build deterministe ni couverture CI.**
- **Reco** : `Dockerfile.worker` (ou un stage `worker`) : deps avec `apps/worker/package.json` + `packages/shared/package.json`, `pnpm install --frozen-lockfile`, puis compilation `tsc` vers `dist/` et `node dist/index.js` (ou `tsx` promu en `dependencies`). Pointer l'app Coolify worker dessus.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Regle CLAUDE.md** : aucune directement (r17/r18 dependent de ce deploiement)

### [P1] Le garde-fou CI « `*_secrets` deny-all » ne couvre que les grants de TABLE, pas les grants de FONCTION — go-live : degrade

- **Ou** : [.github/workflows/ci.yml:74](../../../.github/workflows/ci.yml#L74) (requete sur `information_schema.role_table_grants`) ; `supabase/tests/` n'a aucun fichier 017, 018 ni 021
- **Constat** : la CI verifie qu'aucune table `%_secrets` n'est grantee a `authenticated`. Or **la faille reellement survenue** portait sur les DEFAULT PRIVILEGES de FONCTION : toute fonction creee dans `public` herite d'`EXECUTE` pour `anon`/`authenticated`, ce qui rendait `store_integration_secret` / `update_integration_secret` (**ecriture Vault**) appelables par un anonyme via PostgREST — c'est ce que documente `021_secdef_grants_hardening.sql:1-15`, en precisant lui-meme que le conteneur pgTAP local ne reproduit pas ces default privileges. `grep -rn role_routine_grants` sur tout le depot : **0 hit**. Couverture partielle existante : `019_integration_secrets.test.sql:39-46` contient bien des assertions `not has_function_privilege` — mais **codees en dur sur ces deux fonctions nommees**.
- **Scenario d'echec / cout a l'echelle** : la migration 022 ajoute une fonction SECURITY DEFINER dans `public` (helper de quota, d'enqueue...). Elle herite d'`EXECUTE anon`. La CI est verte, `get_advisors` n'est lance qu'a la main, **et un anonyme peut appeler la fonction jusqu'a ce que quelqu'un pense a relancer l'audit** — le scenario de juillet, rejoue.
- **Pourquoi ca bloque le scaling** : chaque nouvelle RPC SECURITY DEFINER rouvre la meme porte ; sans guard generique, la securite depend d'une checklist humaine.
- **Reco** : step symetrique dans le job `db` — `select ... from information_schema.role_routine_grants where routine_schema='public' and grantee in ('anon','authenticated')` compare a une **allowlist explicite** — plus un test pgTAP 021.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Regle CLAUDE.md** : r11, r12

### [P1] Couche de lecture sans aucune pagination : notifications et evenements d'agenda remontent tout l'historique — go-live : apres

- **Ou** : [apps/web/lib/data/notifications.ts:21](../../../apps/web/lib/data/notifications.ts#L21)
- **Constat** : `getNotifications` selectionne **toutes** les notifications du destinataire, ordonnees `created_at desc`, sans `.limit()` ni fenetre. Meme motif pour `getCalendarEvents` ([pro.ts:793](../../../apps/web/lib/data/pro.ts#L793), aucune borne de dates), `getImportedPosts` (:548), `getActivityEntries` (:449), `getLibraryAssets` (:239), `getTrashedContent` ([content.ts:251](../../../apps/web/lib/data/content.ts#L251)). `grep .limit(|.range(` sur `lib/data` ne remonte que deux `.limit(1) + maybeSingle` et `getTopPosts` (qui prend un `count`, pas un curseur). **Aucune fonction de `lib/data` n'accepte de curseur ni de plage.**
- **Scenario d'echec / cout a l'echelle** : la cloche du shell appelle `getNotifications` a chaque rendu (via `getShellSnapshot`, awaite par `(app)/layout.tsx:21`) : au bout d'un an d'usage reel — echecs de publication, demandes de validation, reports de quota — c'est plusieurs milliers de lignes serialisees dans le payload RSC pour afficher les 10 dernieres. L'agenda charge la totalite des evenements Google/Outlook synchronises pour dessiner **une semaine**.
- **Pourquoi ca bloque le scaling** : croissance monotone. Le produit ralentit avec le temps sans qu'aucune action utilisateur ne l'explique, et **la taille des payloads RSC se degrade en premier sur la PWA mobile** — la cible prioritaire.
- **Reco** : signature commune `(orgId, {limit, before})` imposee a toutes les lectures de liste (`lib/data/_paging.ts`), defaut 50 pour les notifications, plage `[debut, fin]` **obligatoire** pour l'agenda et le calendrier editorial. Aligner les index DB sur ces acces.
- **Effort** : M   **Impact** : moyen
- **⚠ Comportement** : non   **Regle CLAUDE.md** : aucune

---

### [P2] `getShellSnapshot` recharge l'integralite du contenu de l'org a chaque rendu de page — go-live : apres

- **Ou** : [apps/web/lib/data/dashboard.ts:168](../../../apps/web/lib/data/dashboard.ts#L168)
- **Constat** : `getShellSnapshot` appelle `getContentItems(orgId)` **sans `clientId` ni filtre**. `getContentItems` ([content.ts:213](../../../apps/web/lib/data/content.ts#L213)) selectionne tous les `content_items` non supprimes de l'org, sans `.limit()` ni fenetre, puis `hydrate()` : `loadTargets` + `loadLabels` + `loadContentMedia` sur l'ensemble, ce dernier generant **une URL signee par media**. Ce snapshot alimente le shell (sidebar, cloche, palette) et est donc evalue **sur chaque page de `(app)`** ([layout.tsx:21](../../../apps/web/app/(app)/layout.tsx#L21)). La palette, elle, n'utilise que `title`/`clientId`/`id`/`caption`.
- **Scenario d'echec / cout a l'echelle** : le shell n'a besoin que des noms de clients, du compteur de notifications et d'une liste de titres. Il rapatrie a la place la legende complete, les hashtags, les cibles, les etiquettes et une URL signee par media de **chaque** contenu de l'org. A 3 clients x 200 contenus x 3 medias, c'est ~1800 URL signees a chaque navigation (en un batch, donc le risque de rate-limit est modere, mais la latence ne l'est pas).
- **Pourquoi ca bloque le scaling** : cout **lineaire dans le volume total d'historique**, jamais borne. La page la plus lourde du produit devient de plus en plus lente avec l'anciennete du compte, sans qu'aucun ecran n'ait besoin de ces donnees. C'est le principal frein de scalabilite de la couche data.
- **Reco** : lectures maigres dediees (`data/shell.ts`) : `getClientsForShell` (id/nom/couleur), `getContentIndex` (id, titre, clientId, statut) pour la palette. Reserver `getContentItems(orgId, clientId)` aux ecrans qui affichent vraiment des contenus. Ne generer les URL signees que pour les medias effectivement rendus.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Regle CLAUDE.md** : aucune

### [P2] `packages/shared` est une coquille vide, importee par personne : il n'existe aucun contrat partage web <-> worker — go-live : apres

- **Ou** : [packages/shared/src/types/domain.ts:1](../../../packages/shared/src/types/domain.ts#L1) (6 unions, rien d'autre) ; `src/schemas/index.ts` = `export {}` ; aucun `@ocean/shared` dans les `package.json` des apps
- **Constat** : le CLAUDE.md §4 fait de ce package le lieu des types DB, des schemas Zod et des constantes de quotas, partage avec le worker (§10 le dit explicitement pour Brevo). Dans les faits : `apps/web/lib/supabase/types.ts` (1890 lignes, **maintenu a la main**) et `lib/domain/*` portent le contrat cote web ; `apps/worker/src/domain.ts:4-15` redeclare a la main les 9 `JobStatus` et les 5 `JobStep` qui doivent correspondre aux enums de `020_publish_jobs.sql`. **Trois copies du meme vocabulaire, aucune reliee.**
- **Scenario d'echec / cout a l'echelle** : ajout d'une plateforme ou d'un statut cote DB + web. Le worker, avec sa propre union, **compile toujours** : `PUBLISHERS[platform]` renvoie `undefined` ([publishers/index.ts:16](../../../apps/worker/src/publishers/index.ts#L16), aucune garde), `engine.ts:65` leve un TypeError generique route vers `retryOrFail`, et le job boucle jusqu'a `max_attempts`. Aucun typecheck ne signale l'ecart.
- **Pourquoi ca bloque le scaling** : c'est le point exact ou un monorepo cesse d'en etre un. Plus il y aura de logique metier (quotas r19, specs medias r22, templates Brevo), plus la duplication derivera silencieusement.
- **Reco** : remplir `packages/shared` (plateformes, statuts de job, quotas, specs medias, ids Brevo, schemas Zod), l'ajouter en dependance de web **et** worker, et faire de `lib/domain` un re-export plutot qu'un doublon. **Attention** : le stage `deps` du Dockerfile ne copie pas `packages/shared/package.json` — le build web cassera au premier import ; corriger le Dockerfile dans le meme lot.
- **Effort** : M   **Impact** : moyen
- **⚠ Comportement** : non   **Regle CLAUDE.md** : §4 + r19

### [P2] Mediatheque : supprimer un media et enregistrer un texte alternatif ne persistent rien — go-live : degrade

- **Ou** : [apps/web/components/app/library/library-workspace.tsx:95](../../../apps/web/components/app/library/library-workspace.tsx#L95)
- **Constat** : `doDelete()` appelle `lib.removeAssets([id])` puis un toast ; `batchDelete` (l.107) idem pour un lot. Or `removeAssets` ([use-library-assets.ts:31](../../../apps/web/components/app/library/use-library-assets.ts#L31)) n'est qu'un `setState`, et `updateAltText` (:23) affiche `library.toast.altSaved` apres un simple `setState`. `lib/actions/media.ts` expose pourtant `updateAssetAlt` (l.84) et `deleteAsset` (l.116) : **aucune des deux n'est appelee nulle part**. La perte au rechargement est reelle (`pro.ts:239` lit vraiment `media_assets`). Nuances : les libelles sont suffixes « (apercu) » en FR et EN, et `deleteAsset` est un **soft-delete** (`deleted_at`) — il ne purgerait donc pas `media-originals` meme cable. Enfin `recordUploadedAsset` n'a pas non plus d'appelant : aucune ligne `media_assets` ne peut naitre depuis l'app aujourd'hui.
- **Scenario d'echec / cout a l'echelle** : selection de 30 visuels, « supprimer », « 30 medias supprimes » — rien n'a bouge, tout revient au rechargement. Symetriquement, les textes alternatifs d'un carrousel (accessibilite Instagram) sont perdus a chaque changement de page.
- **Pourquoi ca bloque le scaling** : le stockage n'est **jamais** purge alors que la corbeille annonce une purge a J+30 ; la regle 23 (suppression par l'API Storage via une Edge Function `media-cleanup`) n'a aucun declencheur cote produit, et la facture Storage croit sans plafond.
- **Reco** : brancher `onSaveAlt` sur `updateAssetAlt` et `doDelete`/`batchDelete` sur `deleteAsset` (`useTransition` + `router.refresh()`, comme `notification-center.tsx` le fait deja proprement). Prevoir separement la purge physique via l'Edge Function.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r23

### [P2] Les deux garde-fous statiques de la CI web sont neutralises a cause d'UN fichier hors produit — go-live : apres

- **Ou** : [.github/workflows/ci.yml:130](../../../.github/workflows/ci.yml#L130) et :134 (`continue-on-error: true` sur Biome et Typecheck) ; cause reelle : `.planning/i18n/lot3-workflow.js:308` (`Illegal return statement outside of a function`)
- **Constat** : `pnpm exec biome lint .` sur le depot : **437 fichiers, 1 seule erreur** — le parse error d'un script jetable de chantier i18n — plus 15 warnings et 1 info (dont le `document.cookie` cite dans le commentaire de la CI, qui n'est qu'un warning). `biome.json:6` ne l'exclut pas. Detail qui renforce le finding : les 5 erreurs `tsc` proviennent de `apps/web/scratch-verify-types.ts`, **untracked** — le gate Typecheck passerait vert aujourd'hui.
- **Scenario d'echec / cout a l'echelle** : un `any` (interdit r25), un import mort ou une erreur TS passent sur main sans resistance. `next build` rattrape une partie du code web, mais **pas le worker** (jamais compile en CI) ni les fichiers hors graphe d'import. Concretement : une Server Action dont le type de retour ne correspond plus a `lib/supabase/types.ts` (maintenu a la main) peut merger.
- **Pourquoi ca bloque le scaling** : une CI dont deux steps sur trois sont decoratifs entraine les suivants a l'etre aussi ; le cout de reactivation croit avec la dette accumulee.
- **Reco** : ajouter `!.planning` (et `!_research`) a `biome.json`, passer un `biome check --write` (la passe assist remonte 2 erreurs d'organize-imports reelles hors CRLF), puis retirer les deux `continue-on-error`. ~5 minutes pour recuperer deux gates.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Regle CLAUDE.md** : r24-r28 (aucune n'est verifiee automatiquement aujourd'hui)

### [P2] Deux migrations partagent le prefixe de version 012, dont une « en ligne uniquement », et la CI rejoue tout le dossier — go-live : degrade

- **Ou** : `supabase/migrations/012_media.sql` et [012_media_storage.sql:3](../../../supabase/migrations/012_media_storage.sql#L3) ; [.github/workflows/ci.yml:35](../../../.github/workflows/ci.yml#L35) (`supabase db reset --no-seed`) ; [scripts/run-pgtap.sh:28](../../../scripts/run-pgtap.sh#L28) (saute les `*_storage.sql`)
- **Constat** : le CLI Supabase indexe les migrations par **version** (prefixe numerique) dans `supabase_migrations.schema_migrations`. Deux fichiers portent ici la version 012. `012_media_storage.sql` annonce en tete etre « appliquee en ligne uniquement » et le runner local le saute (sa l.29 `cut -c1-3` confirme que le prefixe fait office de version) — mais le job `db` de la CI, lui, rejoue **tout** le dossier, sans exclusion et sans `continue-on-error`. Cote prod, les deux contenus sont passes en un seul fichier (`deploy/05_migration_012.sql`, concatenation exacte verifiee).
- **Scenario d'echec / cout a l'echelle** : au mieux `supabase db reset` enregistre une seule ligne de version `012` et l'historique est faux ; au pire le second insert viole la cle primaire et **le seul job CI qui teste la RLS est rouge en permanence**. Dans les deux cas, un futur `supabase db push` considerera 012 comme deja appliquee et **sautera la partie storage**.
- **Pourquoi ca bloque le scaling** : le jour ou il faudra un environnement de staging ou une restauration apres incident, le schema storage — **c'est-a-dire l'isolation par chemin `{org_id}/{client_id}/...`, regle 21** — sera absent du replay.
- **Reco** : renumeroter `012_media_storage.sql` en 013 (ou passer aux timestamps du CLI), verifier que le job `db` est effectivement vert, et documenter dans le fichier ce qui est rejouable localement.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Regle CLAUDE.md** : r20, r21

### [P2] La page publique et l'ecran de login affichent « donnees de demonstration » alors que l'app tourne sur de vraies donnees clients — go-live : degrade

- **Ou** : [apps/web/app/page.tsx:52](../../../apps/web/app/page.tsx#L52) et [app/(auth)/layout.tsx:46](../../../apps/web/app/(auth)/layout.tsx#L46)
- **Constat** : les deux rendent `t("auth.landing.previewBadge")`, dont la valeur est « Apercu produit — donnees de demonstration » / « Product preview — sample data » (`auth.fr.ts:8`, `auth.en.ts:11`). Or `lib/mocks` a ete supprime et toutes les pages lisent Supabase. Nuances : le badge du layout auth est dans un conteneur `hidden … lg:flex` (invisible sur mobile), et la cle `enterDemo` a pour valeur « Se connecter » — seul le **nom de cle** est date, pas le texte affiche.
- **Scenario d'echec / cout a l'echelle** : le reviewer d'un vrai client, sur desktop, voit sur l'ecran de connexion — **juste avant de valider des publications qui partiront reellement sur le compte Instagram de sa marque** — un badge annoncant des donnees de demonstration.
- **Pourquoi ca bloque le scaling** : ces libelles sont le seul contenu public indexable du produit ; ils resteront la premiere impression de chaque prospect a l'ouverture SaaS.
- **Reco** : remplacer `previewBadge` dans les deux dictionnaires par un positionnement produit reel, ou retirer le badge des deux emplacements. Zero impact technique.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Regle CLAUDE.md** : aucune

### [P2] Le CTA « Voir le portail client » de la landing fait planter le portail pour un membre d'org — go-live : degrade

- **Ou** : [apps/web/app/(portal)/portal/page.tsx:21](../../../apps/web/app/(portal)/portal/page.tsx#L21)
- **Constat** : `const client = ctx.clients[0] as Client` puis `const tz = client.timezone` (l.23). `getReviewerContext()` construit `clients` a partir des lignes `client_members` ([org-context.ts:122-133](../../../apps/web/lib/auth/org-context.ts#L122)) : pour un owner/admin, ce tableau est **vide** et `clients[0]` vaut `undefined`. **Le cast `as Client` fait taire TypeScript exactement la ou il aurait protege.** Le layout du meme groupe, lui, gere bien le cas (`ctx.clients[0] ?? null`) — l'asymetrie est dans le meme dossier. Le chemin est atteignable en deux clics : `app/page.tsx:69` place un `<Link href={routes.portal}>` sur la page d'accueil publique, et le proxy n'impose qu'une session sur `/portal`.
- **Scenario d'echec / cout a l'echelle** : Etienne connecte clique « Voir le portail client » -> `TypeError: Cannot read properties of undefined (reading 'timezone')` -> ecran `(portal)/error.tsx`. Meme chose si un owner est un jour aussi reviewer puis retire de `client_members`.
- **Pourquoi ca bloque le scaling** : le portail est la surface montree aux clients ; un cast non garde sur le premier element d'une collection **dont la cardinalite depend des droits** est un motif qui se dupliquera a chaque nouvelle page portail.
- **Reco** : `const client = ctx.clients[0]; if (!client) redirect(routes.dashboard)` (ou un etat vide « aucun espace de validation »). Interdire `as Client` sur un acces indexe.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r25

### [P2] Rapport partage public : payload RPC caste sans validation et aucune frontiere d'erreur sur `/r` — go-live : degrade

- **Ou** : [apps/web/app/r/[token]/page.tsx:30](../../../apps/web/app/r/[token]/page.tsx#L30)
- **Constat** : `const report = data as unknown as ReportData` — le JSON renvoye par la RPC SECURITY DEFINER `get_report_share` (exposee a `anon`) est injecte tel quel dans `<ReportWorkspace data={report} readOnly />`, un composant **client**, qui deref `data.perf.kpis.current` sans garde. Aucun parse Zod. De plus `/r/[token]` vit sous le layout racine : il n'existe ni `app/error.tsx` ni `app/r/error.tsx` — les seules frontieres sont `(app)/`, `(auth)/`, `(portal)/` et `global-error.tsx`, ce dernier hardcode en FR sans lien de retour. Vecteur de derive structurel : `report-share-actions.ts:33-34` fige un **snapshot** au moment de l'ecriture, pendant que les composants lecteurs evoluent.
- **Scenario d'echec / cout a l'echelle** : la forme du payload diverge entre le jour du partage et le jour de la lecture (champ renomme, section ajoutee) -> le composant deref un champ absent -> aucune frontiere locale ne l'attrape -> **le client d'Etienne, qui a ouvert un lien recu par e-mail, recoit la page plein ecran « Ocean a rencontre une erreur »**, sur un livrable envoye a un client payant.
- **Pourquoi ca bloque le scaling** : c'est la **seule surface anonyme** du produit, donc la seule ou un contrat de donnees non valide n'a aucun filet (pas de session, pas de log utilisateur, pas de Sentry sur ce chemin).
- **Reco** : `reportShareSchema` dans `packages/shared`, `safeParse` + `notFound()` a la place du cast, et `app/r/error.tsx` + `app/r/[token]/not-found.tsx` avec un message neutre destine a un lecteur externe. Isoler `/r` dans un groupe `(public)` avec sa propre frontiere.
- **Effort** : M   **Impact** : moyen
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : r25

### [P2] Un Reviewer ne peut pas se reconnecter : compte cree sans mot de passe, lien d'invitation a usage unique, login password-only — go-live : degrade

- **Ou** : [apps/web/app/api/invitations/accept/route.ts:55](../../../apps/web/app/api/invitations/accept/route.ts#L55)
- **Constat** : la route cree le reviewer via `admin.auth.admin.createUser({ email, email_confirm: true })` — **sans mot de passe** — puis ouvre la session avec un `generateLink({type: "magiclink"})` consomme immediatement (l.92-98). L'invitation est marquee `accepted_at` et toute reutilisation du token est rejetee (l.44-51). Or le seul formulaire de connexion est strictement e-mail + mot de passe (`login-form.tsx:41-79`, `signInWithPassword`) : **aucun `signInWithOtp` dans tout le repo**, aucun magic link. Le CLAUDE.md prevoyait pourtant explicitement l'OTP 6 chiffres pour ce parcours mobile.
- **Scenario d'echec / cout a l'echelle** : le client valide ses contenus, puis revient plus tard (session expiree, autre appareil). Il n'a jamais eu de mot de passe : il doit deviner qu'il faut passer par « Mot de passe oublie », dont l'envoi depend du SMTP Supabase (Brevo non configure). Attenuation reelle : les cookies `@supabase/ssr` ont un `maxAge` de 400 jours, donc fermer le navigateur ne deconnecte pas, et le lien « Mot de passe oublie » est visible sur le formulaire.
- **Pourquoi ca bloque le scaling** : le cycle de validation est cense etre hebdomadaire par client ; le cout de support croit lineairement avec le nombre de clients.
- **Reco** : (a) ajouter au login un mode « recevoir un lien de connexion » (`signInWithOtp`) pour les e-mails sans mot de passe, et/ou (b) faire atterrir le reviewer sur un ecran « choisissez votre mot de passe » juste apres acceptation (`?next=/reset-password`, avec le validateur de `next` du finding open redirect).
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Regle CLAUDE.md** : aucune (§1 : OTP mobile prevu)

---

## Annexe — pistes non verifiees

Ces pistes ont ete relevees pendant la passe mais **n'ont pas franchi la refutation adversariale** : elles sont plausibles, non confirmees, et ne doivent pas etre traitees comme des faits.

- **P2 — `/api/health` ne prouve rien et le worker n'expose aucune sonde de vie** — `apps/web/app/api/health/route.ts:3` renverrait un `{ok:true}` statique ; le seul signal de vie du worker serait un log stdout (`index.ts:96`). *Non verifie.*
- **P2 — Zero observabilite dans tout le monorepo** : aucun paquet Sentry ni PostHog dans les 4 manifestes ; logger maison vers stdout (`apps/worker/src/log.ts`). *Non verifie.*
- **P2 — Le Dockerfile ne declare aucun `ARG` pour les `NEXT_PUBLIC_*`** : le bundle navigateur partirait avec `undefined` des que le client Supabase sera utilise. *Non verifie.*
- **P2 — Les `try/catch` des Server Actions avalent le `redirect()` de Next** et masquent les vraies erreurs (`lib/actions/media.ts:72`). *Non verifie.*
- **P2 — La couche data depend de la presentation** : traduction et URLs construites dans `lib/data` (`dashboard.ts:27`). *Non verifie.*
- **P2 — `lib/data/pro.ts` : module fourre-tout de 878 lignes (3,5x la limite r24) melangeant 6 domaines.** *Non verifie.*
- **P2 — Chemins de `revalidatePath` ecrits en dur** alors que `lib/routes.ts` est la source unique (`lib/actions/media.ts:70`). *Non verifie.*
- **P2 — Aucune validation des variables d'environnement** : echecs silencieux au deploiement Coolify (`lib/supabase/admin.ts:19`). *Non verifie.*
- **P2 — Une couche de donnees vit dans `components/`** : `perf-data.ts` et `report-data.ts` hors de `lib/data`. *Non verifie.*
- **P2 — Une Server Action vit dans `components/`** (`report-share-actions.ts`), inversion de couche dont le piege de build est documente en commentaire. *Non verifie.*
- **P2 — `getReviewerContext` ne retient que la premiere appartenance** : `orgId` faux pour un reviewer multi-org (`org-context.ts:144`) ; meme motif sur `portal/[contentId]/page.tsx:39`. *Non verifie.*
- **P2 — Le portail rend tous les commentaires sans filtrer `visibility='client'`** : la confidentialite des notes internes ne reposerait que sur la RLS (`components/portal/annotation-viewer.tsx:107`). *Non verifie.*
- **P2 — Deux editeurs de brand kit dupliques et divergents** entre onboarding et reglages client (`client-settings/constants.ts:15`). *Non verifie.*
- **P2 — Chaque page repose sur un composant client « god-props »** : la frontiere client est au sommet, forcant une cascade de requetes sequentielles (`settings-shell.tsx:1`, `clients/[clientId]/content/[contentId]/page.tsx:66`). *Non verifie.*
- **P2 — Les objets de hooks (`view`, `tiles`, `board`) sont drilles tels quels dans 5 composants** : couplage fort, re-rendu global a chaque frappe (`grid/feed-grid.tsx:164`). *Non verifie.*
- **P2 — Les dictionnaires FR et EN complets (20 zones) partent dans le bundle client de toutes les pages**, portail et rapport public compris (`lib/i18n/provider.tsx:55`). *Non verifie.*
- **P2 — La zone `app` depend de la zone `portal` et reciproquement** : les frontieres de zones ne sont pas etanches (`studio/content-detail-media.tsx:6`). *Non verifie.*
- **P2 — `listUsers()` non pagine dans l'acceptation d'invitation** : la resolution d'un reviewer existant casserait au-dela de la 1re page (`accept/route.ts:63`). *Non verifie.*
- **P2 — Des modules d'acces aux donnees dans `components/` n'ont pas le garde `server-only`** (`clients/[clientId]/report/page.tsx:3`). *Non verifie.*
- **P2 — « Reglages » est une route unique portant 3 onglets clients** : `/settings` serait un 404, pas de deep link, N+1 sur les comptes sociaux (`settings/accounts/page.tsx:22`). *Non verifie.*
- **P2 — Aucun `loading.tsx` ni `error.tsx` sous `clients/[clientId]`** : l'en-tete client et les onglets disparaitraient a chaque changement d'onglet (`clients/[clientId]/layout.tsx:15`). *Non verifie.*
- **P3 — Trois versions de Node coexistent** (image 22, CI 20, `engines >=20`) sans `.nvmrc`. *Non verifie.*
- **P3 — `AGENTS.md` est un duplicata ligne a ligne de `CLAUDE.md`** (8 lignes d'ecart sur ~700) et la documentation est eclatee sur quatre arborescences (`docs/`, `_research/`, `.planning/`, `docs/superpowers/`). *Non verifie.*

---

## Ce qui va bien (a preserver)

Ces decisions sont bonnes et **ne doivent pas etre cassees par la refonte de l'arborescence** :

1. **La facade de lecture unique et son contrat explicite.** `lib/data/index.ts` re-exporte **nom par nom** plutot qu'en `export *`, avec la raison ecrite : tant que mock et reel coexistaient, un ordre d'export malencontreux aurait servi des donnees mockees sans que le typecheck bronche. Contrat homogene : `async` + `cache()` + `org_id` en premier argument. C'est de l'ingenierie deliberee, a conserver telle quelle en eclatant `pro.ts`.
2. **La verification de session au plus pres de la donnee.** `verifySession()` appelle `auth.getUser()` (JWT revalide cote Supabase, pas `getSession()` qui lit un cookie non verifie) et est memoise par requete. Le commentaire explique meme pourquoi ce n'est pas dans un layout (Partial Rendering en Next 16). Correct et documente.
3. **Le socle des Server Actions.** `requireClientInOrg` impose `getActiveOrg()` -> verification que le `clientId` appartient a l'org -> Zod -> injection de l'`org_id` **cote serveur** -> `revalidatePath`. C'est de la defense en profondeur au-dessus de la RLS et des FK composites, applique de facon homogene sur les 15 modules de `lib/actions`.
4. **Le decoupage ports/adaptateurs du worker.** `engine.ts` ne connait que l'interface `JobStore` ; `PgJobStore` et `InMemoryJobStore` sont interchangeables ; l'interface documente ses invariants a l'endroit ou ils comptent (« pose `publish_started_at` AVANT `media_publish`, et commit »). C'est ce qui rend testable, sans base ni reseau, la promesse la plus chere du produit. **Le seul travail a faire est de brancher ces tests a la CI, pas de toucher au design.**
5. **Le modele snapshot du rapport partage.** Figer le rapport calcule cote serveur et retirer explicitement les notes internes avant partage (`const { notes: _notes, ...clientSafe }`) est le bon reflexe anti-fuite pour une surface anonyme. Il manque le contrat avec l'etat d'edition, pas le principe.
6. **Le domaine pur.** `lib/domain/*` n'importe ni Supabase ni Next : machine a etats de contenu, quotas, labels, types coeur. C'est la base sur laquelle `packages/shared` doit etre construit — par **remontee**, pas par reecriture.
7. **La convention « (apercu) »** dans les libelles des gestes non cables : imparfaite (invisible sur certains boutons, notamment « Reprogrammer » de la grille) mais c'est une trace honnete et systematique (151 occurrences) qui a permis de cartographier les ecarts en une passe. A conserver **jusqu'a** ce que chaque geste soit cable, puis a supprimer entierement.
