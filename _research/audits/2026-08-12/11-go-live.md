# Audit — Go-live readiness (2026-08-12)

> Fil rouge : « qu'est-ce qui reste à faire pour utiliser Ocean POUR DE VRAI ? »
> Phase solo — Étienne, de VRAIS clients, de VRAIES publications Instagram/Facebook/TikTok.
> Baseline : `pnpm -w build` vert, main propre (8a1d8b5), migrations 001→021 appliquées en ligne (hgdeopkmkwyoumsfggrm), web live sur https://socean.54-36-180-115.sslip.io.
> Chaque finding pointe un `fichier:ligne` réellement lu.

---

## Verdict

**Non. Ce soir, Ocean ne peut pas gérer un vrai client de bout en bout, et la chaîne casse à quatre endroits indépendants — n'importe lequel suffit à tout arrêter.** (1) **Aucun média ne peut entrer dans le produit** : la drop-zone de la médiathèque est un `<button>` qui affiche un toast « arrive bientôt », il n'existe aucun `<input type="file">` dans les 425 fichiers de `apps/web`, et la Server Action `recordUploadedAsset` — pourtant complète et Zod-validée — n'a zéro appelant. Or Instagram et Facebook refusent tout post sans média : la chaîne création → publication est physiquement impossible, indépendamment de l'état des publishers. (2) **Le portail de validation client, argument commercial central, n'ouvre jamais de session** : le lien d'invitation redirige vers l'`action_link` GoTrue brut, dont les jetons arrivent dans le *fragment* d'URL que personne ne lit (le client navigateur `lib/supabase/client.ts` n'est importé nulle part), et le proxy fail-closed renvoie le reviewer sur un formulaire mot de passe qu'il n'a jamais eu — avec une invitation déjà consommée, donc non rejouable. (3) **Rien ne publie et rien ne le dit** : l'app Coolify worker n'existe pas, le watchdog `pg_cron` promis par le code lui-même (`pg-store.ts:81`) n'existe nulle part, `publish_jobs` n'est lu par aucun écran, et aucun email/notification/push ne sort du worker. Un post programmé reste `scheduled` pour toujours pendant que le calendrier affiche « Programmé ». (4) **Pire que rien : le worker en STUB écrit un état métier terminal**. `STUB_MODE = true` est une constante en dur, sans garde d'environnement, et le runbook `deploy/GO-LIVE-points-1-2.md:50-70` demande explicitement de brancher ce worker sur la base de PROD en affirmant « sans publier chez un client » — or il marque `content_targets.status='published'` avec un permalien `https://stub.local/...`, état que `enqueue_publish_jobs` exclut définitivement du ré-enfilement.

À cela s'ajoutent deux pertes de données silencieuses déclenchées par des gestes banals : **rouvrir un brouillon et corriger une virgule supprime tous ses médias** (`draftFromContent` ne remonte pas `libraryAssetId`, le serveur `delete()` puis `return` sur tableau vide), et **connecter Meta pour un client rattache les Pages/comptes IG de TOUS les autres clients à ce client-là**, avec leurs tokens, sans aucun écran de sélection ni de déconnexion. Enfin, **aucun token ne survit** : pas d'échange long-lived Meta (`fb_exchange_token` : 0 occurrence dans le dépôt), `tokens/refresh.ts` n'est qu'un commentaire, `token_expires_at` est écrit et relu par personne.

Le socle, lui, est bon : le schéma multi-tenant (RLS, FK composites, helpers `private.*`), la file Postgres `FOR UPDATE SKIP LOCKED` avec lease/reaper, les tokens en Vault derrière des tables `*_secrets` deny-all, et le job CI `db` (pgTAP + advisors + motifs interdits) sont solides et conformes. **Ce qui manque n'est pas de l'architecture, c'est du câblage terminal** — et il y en a pour plusieurs jours, pas pour une soirée.

---

## Le parcours réel, étape par étape

### Parcours 1 — Arriver dans l'app (signup → org → premier client)

**Ce qui marche** : le formulaire de connexion (`apps/web/components/auth/login-form.tsx`), la Server Action `signInWithPassword` ([`app/(auth)/actions.ts:32-50`](apps/web/app/(auth)/actions.ts#L32)), le proxy fail-closed ([`apps/web/proxy.ts:56-60`](apps/web/proxy.ts#L56)), et le wizard de création de client (`app/(app)/clients/new/page.tsx:27` → `WizardShell`) qui écrit réellement `clients`, `content_pillars`, `recurring_slots`, `brand_kits`.

**Où la chaîne s'arrête** :
- Il n'existe **aucune route `/signup`**. `signUpWithPassword` ([`app/(auth)/actions.ts:57`](apps/web/app/(auth)/actions.ts#L57)) est complète (Zod, `auth.signUp`, dérivation de slug, `rpc create_organization` l.85) mais n'a **zéro importeur**. La landing (`app/page.tsx:43`, `:61`) et le login ne proposent aucun lien d'inscription. Le chemin documenté est manuel : `deploy/02_seed_org.sql:4-10` demande de créer l'utilisateur dans le Dashboard puis exécute le seed org/membership.
- Tout utilisateur **sans ligne `organization_members`** est envoyé sur `/onboarding` ([`lib/auth/org-context.ts:79`](apps/web/lib/auth/org-context.ts#L79) et `:88`) — **route qui n'existe pas** (aucun segment `onboarding` dans les 32 routes de `apps/web/app`, aucune entrée dans `lib/routes.ts`, aucun `app/not-found.tsx` racine). Résultat : **404 brut de Next**, sans navigation. Et `app/(app)/layout.tsx:20` appelle `getActiveOrg()` sans garde, donc les 19 pages du groupe `(app)` y mènent.
- Le piège est refermé par le proxy : [`proxy.ts:45-50`](apps/web/proxy.ts#L45) renvoie **inconditionnellement** tout utilisateur authentifié de `/login` vers `/dashboard`, sans regarder son appartenance. Un **Reviewer** (qui par construction n'a que `client_members`, cf. `api/invitations/accept/route.ts:70-78`) qui clique « Se connecter » atterrit donc sur le 404.
- Deux branches d'inscription bricquent définitivement le compte même une fois le signup câblé : la RPC `create_organization` n'est appelée que `if (data.session)` (l.77), donc avec confirmation d'email activée l'org n'est jamais créée ; et son retour n'est **jamais testé** (l.85) alors que `organizations.slug` est `not null unique` (`003_identity_orgs.sql:4`) — une collision de slug est avalée en silence.

**Ce que l'utilisateur voit** : « This page could not be found ». Sortie unique : `INSERT` SQL manuel.

---

### Parcours 2 — Connecter les comptes sociaux

**Ce qui marche** : OAuth custom en Route Handlers (conforme r13), state signé HMAC, échange de code, écriture du token **chiffré dans Vault** derrière `platform_connection_secrets` / `social_account_secrets` en deny-all (r11/r12 respectées), upsert `platform_connections` + `social_accounts`.

**Où la chaîne s'arrête** :
- `resolveMeta` ([`lib/oauth/identity.ts:74-98`](apps/web/lib/oauth/identity.ts#L74)) pousse **chaque** Page de `GET /me/accounts` + **chaque** `instagram_business_account` associé dans `subAccounts`, sans filtre. `persistPlatformConnection` ([`lib/oauth/tokens.ts:179-181`](apps/web/lib/oauth/tokens.ts#L179)) les écrit **tous** avec le **même** `client_id`, celui passé en query string par `connect-account-menu.tsx:38`. Il n'existe **aucun écran de sélection** entre le callback et l'écriture (`app/(app)/settings/accounts/` ne contient que `page.tsx`), et **aucune action de déconnexion** dans tout `apps/web`.
- Le statut affiché ne bouge jamais : le worker écrit `needs_reauth` sur `platform_connections` ([`apps/worker/src/db/pg-store.ts:196-203`](apps/worker/src/db/pg-store.ts#L196)), table que le web **ne lit jamais** ; toute l'UI lit `social_accounts.status`, colonne écrite en dur à `"connected"` par un seul endroit ([`lib/oauth/tokens.ts:203`](apps/web/lib/oauth/tokens.ts#L203)). 11 surfaces testent `status !== "connected"` — toutes mortes, dont la garde de programmation `studio/composer/preflight.ts:74`.
- Aucun token ne survit : `exchangeCode` ([`lib/oauth/index.ts:62-87`](apps/web/lib/oauth/index.ts#L62)) ne fait que `authorization_code` ; `fb_exchange_token` = 0 occurrence ; `refreshTokens()` (l.93-116) existe mais a **zéro appelant** ; `apps/worker/src/tokens/refresh.ts` s'arrête sur un bloc de commentaires (l.35-44) et `withAccountLock` n'est importé nulle part ; `token_expires_at` est écrit deux fois et relu par personne ; aucun cron, aucun health check.

**Ce que l'utilisateur voit** : après « Connecter Instagram » sur la fiche du client A, les 5 Pages et 5 comptes IG de tous ses clients, en vert « Connecté », et un compteur d'abonnés retombé à 0 (`lib/data/clients.ts:98-106`, `maybeSingle()` sur plusieurs lignes → `PGRST116` → null).

---

### Parcours 3 — Créer un contenu avec des médias

**Ce qui marche** : le studio, le composer, les Server Actions `saveContentItem` (Zod strict, `org_id` injecté), le picker médiathèque (`getLibraryAssets` → vraie requête `media_assets`), la machine à états de contenu (`016_transitions.sql`), les buckets et policies Storage (`012_media_storage.sql:30,63`) qui sont **corrects**.

**Où la chaîne s'arrête** :
- **Aucun octet ne peut entrer.** [`components/app/library/upload-dialog.tsx:32`](apps/web/components/app/library/upload-dialog.tsx#L32) : `simulate()` = `setDragging(false); onSimulate(); onOpenChange(false)` — le `dataTransfer` du `onDrop` (l.54-57) est jeté sans être lu. Le seul consommateur (`library-workspace.tsx:224`) passe `toast.info("L'upload de fichiers arrive bientôt (câblage TUS).")` (`library.fr.ts:148`). Zéro `type="file"`, zéro `.upload(`, zéro `tus-js-client`, pas de dossier `lib/media/`, et `recordUploadedAsset` ([`lib/actions/media.ts:37`](apps/web/lib/actions/media.ts#L37)) n'a aucun appelant.
- **Éditer un brouillon détruit ses médias.** `draftFromContent` ([`composer-types.ts:151-164`](apps/web/components/app/studio/composer/composer-types.ts#L151)) ne renseigne ni `libraryAssetId` ni `crop`, alors que `MediaAsset.id` **est** l'id de l'asset (`content-media.ts:118`). `composer-screen.tsx:144-149` ne persiste que les médias porteurs de `libraryAssetId` → tableau **toujours vide** en édition. Côté serveur, `reconcileMedia` ([`lib/actions/content.ts:219-220`](apps/web/lib/actions/content.ts#L219)) fait `delete().eq('content_item_id')` **puis** `if (!media.length) return`.
- **Les vignettes ne s'afficheront pas.** [`next.config.ts:14`](apps/web/next.config.ts#L14) n'autorise que `images.pexels.com` — hôte que plus aucun code n'utilise — alors que 100 % des URLs viennent de `hgdeopkmkwyoumsfggrm.supabase.co` (`content-media.ts:43,50` ; `pro.ts:268,574`) ou du CDN Meta. 17 fichiers utilisent `next/image`, zéro `unoptimized`.

**Ce que l'utilisateur voit** : un toast bleu au lieu d'un upload ; puis, après avoir corrigé une virgule dans une légende, deux toasts rassurants — « 3 médias non encore uploadés ont été ignorés » (message **faux**, `composer.fr.ts:269`) et « Brouillon enregistré » — pendant que les 3 lignes `content_media` disparaissent.

---

### Parcours 4 — Faire valider par le client

**Ce qui marche** : le schéma complet (`013_collaboration.sql`), les pages du portail (`app/(portal)/portal/page.tsx`, `/portal/[contentId]`), les annotations, `submitReviewDecision` et `postComment` qui notifient bien, la transition `send_to_review` qui rend réellement le lot visible côté portail.

**Où la chaîne s'arrête** :
- **Le lien d'invitation ne connecte personne.** [`api/invitations/accept/route.ts:55-58`](apps/web/app/api/invitations/accept/route.ts#L55) crée le compte **sans mot de passe**, l.81-88 marque l'invitation `accepted` **avant** toute tentative de session (donc non rejouable, cf. le rejet l.44-51), puis l.92-98 redirige vers `link.properties.action_link` brut → jetons dans le **fragment** → jamais lus (aucun import de `lib/supabase/client.ts`, zéro `detectSessionInUrl`/`setSession`/`location.hash`) → `/portal` fail-closed (`proxy.ts:56-60`) → `/login` qui exige un mot de passe. L'outil correct existe pourtant : `app/auth/callback/route.ts:25-28` fait déjà `verifyOtp({ type, token_hash })` côté serveur.
- **Le client n'est jamais prévenu.** `sendReviewRequest` ([`lib/actions/collaboration.ts:247-284`](apps/web/lib/actions/collaboration.ts#L247)) insère les 3 tables puis `return` : aucun `sendTransactional`, aucune notification. Le template `"review-requested"` (`lib/brevo/transactional.ts:15`) n'a aucun appelant. Le toast, lui, affirme « Demande de validation envoyée à {nom} » sans le hedge « (aperçu) » que portent ses voisins (`studio.fr.ts:23` vs `:19`).
- **Aucun email ne part du tout** : `BREVO_API_KEY` est vide (`.env.local:51`), `sendTransactional` lève (`transactional.ts:60`), et tous les appelants avalent (`collaboration.ts:374-376` `catch {}`, `notify-org.ts:120-122` idem) — sans Sentry (absent des deps), un échec est indétectable pour toujours.
- **Une invitation ratée est définitive** : l'index partiel `(client_id, lower(email)) where accepted_at is null and revoked_at is null` (`013_collaboration.sql:301-303`) **ignore `expires_at`** ; aucune UI ne liste, ne renvoie ni ne révoque une invitation ; aucune action ne retire jamais un `client_members` (r4 « révocation immédiate » n'a pas de bouton).
- **Le wizard fabrique une invitation fantôme** : [`lib/actions/clients.ts:167`](apps/web/lib/actions/clients.ts#L167) jette la valeur de retour d'`inviteReviewer`, seule copie en clair du token (la base ne garde que le SHA-256).

**Ce que le client voit** : un écran de connexion demandant un mot de passe qu'il n'a jamais eu. Ou, plus souvent, rien du tout — il n'a jamais reçu de lien.

---

### Parcours 5 — Publier pour de vrai

**Ce qui marche** : `enqueue_publish_jobs` app-driven (`020_publish_jobs.sql`), l'index unique partiel par cible active (r16), le claim atomique `FOR UPDATE SKIP LOCKED` + lease 2 min + reaper (r18), `cancel_publish_jobs` qui respecte scrupuleusement la règle 15 (`and publish_started_at is null`, l.249), le backoff exponentiel, la garde `env.ts` interdisant le port 6543 (r17), et 7 tests moteur qui passent.

**Où la chaîne s'arrête** :
- **Personne ne dépile.** L'app Coolify worker n'existe pas (`deploy/GO-LIVE-points-1-2.md:50`, « Étape 4 — TOI »). Les jobs restent `scheduled` indéfiniment.
- **Et si on la crée en suivant le runbook, c'est pire.** `STUB_MODE = true` en dur ([`apps/worker/src/publishers/index.ts:21`](apps/worker/src/publishers/index.ts#L21)), aucune garde d'env ; le stub renvoie `targetStatus:'published'`, `stub-instagram-post-<uuid>`, `https://stub.local/...` (`stub.ts:21-25`) ; `succeed()` ([`pg-store.ts:146-164`](apps/worker/src/db/pg-store.ts#L146)) écrit ces valeurs telles quelles et promeut `content_items.status='published'`. Or `enqueue_publish_jobs` exclut `status in ('published','canceled','skipped')` (`020:195`) et `016_transitions.sql:76` donne à `published` un ensemble de transitions **vide** : la cible est brûlée, réparation = SQL service_role.
- **La fenêtre de grâce précède l'idempotence.** [`engine.ts:34-37`](apps/worker/src/engine.ts#L34) `deadLetter()` est la **première** instruction de `processJob`, avant le branchement `if (job.publishStartedAt)` (l.61-63). `deadLetter` (`pg-store.ts:209-223`) écrit `content_targets.status='failed'` sans jamais interroger `getContainerStatus`. Un job repris après > 2 h (reaper `pg-store.ts:82-89` → `retrying` → claim) est déclaré en échec **alors que le post est peut-être en ligne** — et comme le seul garde-fou anti-double-post côté DB est `status='published'`, la reprogrammation crée légalement un second post.
- **L'enfilement est en fire-and-forget** : [`lib/actions/content-status.ts:95-99`](apps/web/lib/actions/content-status.ts#L95) et `content.ts:311` n'examinent ni `data` ni `error` de la RPC, en s'appuyant sur « le watchdog worker rattrapera » — or `020:9-11` acte « APP-DRIVEN … pas de scan worker ».
- **Aucun filet** : zéro `cron.schedule` dans les 21 migrations, pas de répertoire `supabase/functions`, `publish_jobs` lu par aucun écran malgré sa policy SELECT « observabilité » (`020:134`), et le worker n'a **aucun client HTTP ni code de notification** (seulement des commentaires : `engine.ts:48`, `store.ts:50`, `refresh.ts:43`).

**Ce que l'utilisateur voit** : rien. Le calendrier dit « Programmé » pour toujours, ou « Publié » avec un bouton « Voir » pointant sur `stub.local`.

---

### Parcours 6 — Après publication (feed, performance, agenda, notifications)

**Ce qui marche** : les écrans existent et lisent de vraies données (grille, calendrier, rapport, agenda unifié), la cloche de notifications lit réellement `notifications`, et les tâches en échec remontent bien au dashboard (`lib/data/dashboard.ts:55-68` → `task-list.tsx:40`) — la visibilité existe, en *pull*.

**Où la chaîne s'arrête** : aucune notification n'est jamais produite pour la publication ([`lib/notifications/notify-org.ts:82`](apps/web/lib/notifications/notify-org.ts#L82) est le seul insert, appelé 2 fois, toutes deux côté Reviewer) ; Realtime n'est câblé nulle part (`.channel(` = 0 occurrence) ; pas de service worker ni de push ; toutes les vignettes cassent (cf. `next.config.ts:14`). Et le shell recharge **tout** l'historique de l'org à chaque page ([`lib/data/dashboard.ts:161-172`](apps/web/lib/data/dashboard.ts#L161) → `getContentItems` sans `.limit()` ni borne de date), avec hydratation `.in()` sur tous les ids.

---

## Findings (P0 → P3)

### [P0] Aucun écran d'inscription : `signUpWithPassword` est du code mort — go-live : bloquant
- **Où** : [`apps/web/app/(auth)/actions.ts:57`](apps/web/app/(auth)/actions.ts#L57)
- **Constat** : la fonction est complète (Zod l.25-27, `auth.signUp` l.69, dérivation de slug l.78-84, `rpc create_organization` l.85) et n'a **aucun importeur**. Le groupe `(auth)` ne contient que `login`, `forgot-password`, `reset-password`. `login-form.tsx` n'affiche qu'email + mot de passe + « mot de passe oublié ». `/signup` n'est pas dans `PUBLIC_EXACT` (`proxy.ts:12-18`). *Nuance* : un chemin manuel documenté existe (`deploy/02_seed_org.sql:4-10` : créer l'user dans le Dashboard puis exécuter le seed), donc le blocage n'est pas absolu pour Étienne lui-même.
- **Scénario d'échec** : ouvrir la landing → « Se connecter » → `/login` → aucun lien d'inscription ; taper `/signup` → non public → redirigé sur `/login?next=/signup`. Boucle fermée.
- **Pourquoi ça bloque le scaling** : à l'ouverture SaaS, l'entonnoir d'acquisition entier manque ; chaque compte créé à la main contourne `create_organization` et arrive orphelin.
- **Reco** : `app/(auth)/signup/page.tsx` + `signup-form.tsx` branchés sur `signUpWithPassword` ; ajouter `/signup` à `PUBLIC_EXACT` ; **tester le retour de la RPC l.85** (collision de slug = `unique_violation` avalée) ; implémenter réellement le bootstrap d'org promis par le commentaire l.54-55 dans `signInWithPassword`.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : aucune

### [P0] `/onboarding` n'existe pas : tout utilisateur sans org est enfermé dans un 404 — go-live : bloquant
- **Où** : [`apps/web/lib/auth/org-context.ts:79`](apps/web/lib/auth/org-context.ts#L79) et `:88` ; [`apps/web/proxy.ts:45-50`](apps/web/proxy.ts#L45) ; `components/auth/login-form.tsx:18`
- **Constat** : `getActiveOrg` fait `redirect("/onboarding")` quand `organization_members` est vide ou quand la jointure `organizations` est nulle. **La route n'existe pas** (aucun segment `onboarding` parmi les 32 routes de `apps/web/app`, aucune entrée dans `lib/routes.ts`, pas de `app/not-found.tsx` racine ; `components/app/onboarding/**` est le wizard de création de **client**, monté par `clients/new/page.tsx:27`). `app/(app)/layout.tsx:20` appelle `getActiveOrg()` sans garde → les 19 pages y mènent. Et `proxy.ts:45-50` renvoie **inconditionnellement** tout utilisateur authentifié de `/login` vers `/dashboard`, `login-form.tsx:18` faisant par défaut `next ?? "/dashboard"`.
- **Scénario d'échec** : le Reviewer (org-less par conception, `accept/route.ts:70-78` n'insère que `client_members`) ouvre l'app depuis un favori, clique « Se connecter » → `/dashboard` → `/onboarding` → **404 brut de Next**, sans navigation. Idem après `updatePassword` (`actions.ts:146` → `/dashboard`). Idem pour un owner dont `create_organization` a échoué. Seule sortie : `INSERT` SQL.
- **Pourquoi ça bloque le scaling** : « user sans org » est l'état **normal** de tout nouveau compte (r9 : `handle_new_user` n'écrit que `profiles`, `003_identity_orgs.sql:53-79`), et chaque reviewer de chaque client rencontre ce mur.
- **Reco** : (1) créer réellement `/onboarding` **hors du groupe `(app)`** (formulaire nom d'org → `create_organization`, avec gestion explicite de l'erreur de slug) ; (2) `landingFor(user)` côté serveur : org → `/dashboard`, `client_members` seul → `/portal`, sinon `/onboarding` — l'appeler dans `proxy.ts:45-50` et comme défaut de `next` ; (3) ajouter un `app/not-found.tsx` racine.
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r6, r10

### [P0] L'invitation Reviewer ne crée jamais de session, et brûle le token — go-live : bloquant
- **Où** : [`apps/web/app/api/invitations/accept/route.ts:92-98`](apps/web/app/api/invitations/accept/route.ts#L92) (+ `:55-58`, `:81-88`)
- **Constat** : compte créé **sans mot de passe** (`createUser({ email, email_confirm: true })`), invitation marquée `accepted`/`accepted_at` **avant** la tentative de session (et l.44-51 rejette tout rejeu), puis `NextResponse.redirect(link.properties.action_link)` — endpoint GoTrue `/auth/v1/verify` sans flow state PKCE → jetons dans le **fragment**, jamais transmis au serveur. Rien ne le consomme : `lib/supabase/client.ts` n'a **zéro importeur**, aucun `detectSessionInUrl`, `setSession` ou `location.hash` dans `apps/web`. `/portal` n'est ni dans `PUBLIC_EXACT` ni dans `PUBLIC_PREFIXES` → fail-closed `proxy.ts:56-60` → `/login`, password-only (`actions.ts:31`).
- **Scénario d'échec** : Étienne copie le lien depuis la modale (`reviewer-invite-dialog.tsx:71`, l'email Brevo étant inerte), le contact clique → compte créé, `client_members` posé, invitation consommée → atterrit sur « Connexion » avec un champ mot de passe. Non rejouable.
- **Pourquoi ça bloque le scaling** : tout onboarding invité (reviewer, futur membre d'équipe) est cassé de la même façon, structurellement.
- **Reco** : remplacer la redirection par `` `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=/portal` `` — le handler existe déjà et pose les cookies côté serveur (`app/auth/callback/route.ts:25-28`). Ne marquer `accepted` **qu'après** succès. Prévoir un chemin « définir mon mot de passe » pour les connexions suivantes.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r6, §9

### [P0] Une connexion Meta rattache TOUTES les Pages/comptes IG au client cible — go-live : bloquant
- **Où** : [`apps/web/lib/oauth/identity.ts:69-98`](apps/web/lib/oauth/identity.ts#L69) + [`apps/web/lib/oauth/tokens.ts:178-182`](apps/web/lib/oauth/tokens.ts#L178)
- **Constat** : `resolveMeta` pousse **chaque** Page de `/me/accounts` + chaque `instagram_business_account` associé, sans filtre ; `persistPlatformConnection` boucle `persistSocialAccount(..., ctx.clientId, ...)` — tous avec le même `client_id`, celui du query string (`connect-account-menu.tsx:38`, qui n'envoie même pas de paramètre `platform`). Aucun écran de sélection (`callback/route.ts:49-58` enchaîne resolve → persist → redirect). La contrainte DB est `unique (client_id, platform, provider_account_id)` (`005_accounts_shell.sql:52`) : N comptes IG par client sont **légaux**. Aucune action de déconnexion nulle part dans `apps/web`.
- **Scénario d'échec** : freelance admin des Pages de 5 clients depuis un seul compte Facebook. Connexion sur la fiche du client A → les 5 Pages + 5 comptes IG sous `client_id = A`, chacun avec son token de Page chiffré. **La défense de `reconcileTargets`** (`lib/actions/content.ts:173-181`, « le compte doit appartenir au client », `.eq("client_id", clientId)`) est **vaincue par construction** : l'IG du client B devient une cible de publication légitime pour le contenu du client A. Effet visible immédiat : `getClient` (`lib/data/clients.ts:98-106`) fait `.eq('platform','instagram').maybeSingle()` → `PGRST116` → abonnés à 0.
- **Pourquoi ça bloque le scaling** : les grants Meta étant cumulatifs par app+user, le mélange se déclenche dès le **2e client**, même avec une discipline parfaite dans le dialogue Meta.
- **Reco** : ne rien écrire dans `social_accounts` au callback. Stocker `resolved.subAccounts` en session courte (ou cookie httpOnly signé), rediriger vers un écran de sélection, écrire `social_accounts` + `*_secrets` **après** choix explicite (Server Action Zod, `org_id` injecté). Ajouter une action de déconnexion qui supprime aussi le secret Vault.
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : §12 (publication non voulue = confiance détruite)

### [P0] Aucun refresh ni échange long-lived : les tokens meurent et personne ne le sait — go-live : bloquant
- **Où** : [`apps/worker/src/tokens/refresh.ts:35-44`](apps/worker/src/tokens/refresh.ts#L35) + [`apps/web/lib/oauth/index.ts:62-87`](apps/web/lib/oauth/index.ts#L62)
- **Constat** : `refresh.ts` = `withAccountLock` (correct, mais **jamais importé**) + un bloc de commentaires « flux réel à brancher ». `exchangeCode` ne fait que `grant_type=authorization_code` ; `fb_exchange_token` = **0 occurrence** dans le dépôt. `refreshTokens()` existe (`index.ts:93-116`) mais a **zéro appelant** et coderait `grant_type=refresh_token` pour tous les providers — faux pour Meta. `token_expires_at` est écrit (`tokens.ts:114-115,170-171`) et **relu par personne** ; `db/secrets.ts:22-40` charge le token sans aucun contrôle d'expiry ; `social_account_secrets` (les tokens qui servent réellement à publier) n'est même jamais alimenté en `token_expires_at` (`tokens.ts:229-235`). Aucun cron, aucune tâche quotidienne.
- **Scénario d'échec** : T0 connexion Meta → token utilisateur **court** ; les tokens de Page en héritent. Post programmé à T0+3 h → `OAuthException` → `failPermanent`. Aucun email `needs-reauth` (template déclaré `transactional.ts:21`, aucun émetteur). Étienne l'apprend par son client.
- **Pourquoi ça bloque le scaling** : sans refresh proactif, chaque compte est une bombe à échéance fixe ; à 20 clients, 20 reconnexions manuelles le même jour.
- **Reco** : (1) au callback Meta, enchaîner `GET /oauth/access_token?grant_type=fb_exchange_token` **avant** `resolveIdentity` pour que les tokens de Page héritent des 60 j ; (2) implémenter le corps de `refresh.ts` sous `withAccountLock` (Meta si expiry < 10 j, TikTok à la volée, Microsoft en rotation) ; (3) tâche quotidienne lisant `token_expires_at` → `needs_reauth` + email Brevo ; (4) alimenter `token_expires_at` sur `social_account_secrets`.
- **Effort** : L  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r14, §5

### [P0] Aucun chemin d'upload : impossible de faire entrer une seule photo — go-live : bloquant
- **Où** : [`apps/web/components/app/library/upload-dialog.tsx:32`](apps/web/components/app/library/upload-dialog.tsx#L32) (+ `library-workspace.tsx:224`, [`lib/actions/media.ts:37`](apps/web/lib/actions/media.ts#L37))
- **Constat** : la drop-zone est un `<button>` (l.46-70) ; `onClick` et `onDrop` appellent tous deux `simulate()` qui ne fait qu'`onSimulate()` + fermeture ; `e.dataTransfer.files` n'est jamais lu. Le seul consommateur passe `toast.info(t("library.upload.pending"))` = « L'upload de fichiers arrive bientôt (câblage TUS). » (`library.fr.ts:148`). Sur tout le dépôt : **0** `type="file"`, **0** `.upload(`/`uploadToSignedUrl`/`createSignedUploadUrl`, **0** `tus-js-client` (ni dans `package.json` ni dans `pnpm-lock.yaml`), pas de `apps/web/lib/media/` (imposé par §4), aucune conversion JPEG/HEIC, aucune vignette WebP. `recordUploadedAsset` est complète et Zod-validée mais orpheline — c'est le **seul** INSERT possible dans `media_assets`. `deploy/09_seed_demo.sql:11-16` documente lui-même qu'aucun média n'est semé.
- **Scénario d'échec** : glisser une photo iPhone dans la médiathèque → toast bleu, dialogue fermé, `media_assets` vide. Puis au composer : picker vide. Puis programmation d'un contenu sans média (aucun garde-fou en `content-status.ts:95`) → Instagram refuse tout post sans média.
- **Pourquoi ça bloque le scaling** : sans asset, la grille, le portail, la performance et le worker n'ont rien à montrer. Et sans validation de specs à l'upload (r22), chaque média non conforme deviendra un job en échec en production au lieu d'un message d'erreur à la seconde 0.
- **Reco** : ajouter `tus-js-client` ; créer `lib/media/` (validation specs, PNG/HEIC → JPEG en canvas, vignette WebP ~400 px) ; remplacer le `<button>` par `<input type="file" multiple accept="image/*,video/*">` **sans `capture`** (picker Photos iOS) qui valide → convertit → upload TUS 6 Mo vers `media-originals` au chemin `{org_id}/{client_id}/{content_item_id}/{media_asset_id}/…` → upload la vignette vers `media-thumbs` → appelle `recordUploadedAsset`. Ne pas toucher à la Server Action.
- **Effort** : L  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r20, r21, r22, §1, §4

### [P0] Rouvrir un contenu dans le composer et l'enregistrer détache TOUS ses médias — go-live : bloquant
- **Où** : [`apps/web/components/app/studio/composer/composer-types.ts:151`](apps/web/components/app/studio/composer/composer-types.ts#L151)
- **Constat** : `draftFromContent` mappe `id/type/thumbUrl/fullUrl/width/height/durationSec/fileSizeMb/mimeType/altText` — **jamais** `libraryAssetId` ni `crop`, alors que `mediaFromLibrary` (même fichier, l.86) le fait et que `MediaAsset.id` **est** l'id de l'asset (`lib/data/content-media.ts:118`, commentaire explicite). `composer-screen.tsx:144-149` : `draft.media.flatMap(m => m.libraryAssetId ? [...] : [])` → **toujours vide** en édition (rien ne le réinjecte : `composer-media.tsx` ne patche qu'`altText` et `crop`). Serveur : `reconcileMedia` (`lib/actions/content.ts:219-220`) `delete()` **puis** `if (!media.length) return`. Statuts concernés : `idea`, `draft`, `changes_requested` (`content.ts:71`). Le bouton « Enregistrer » n'est gaté que par `saving` (`composer-header.tsx:76`).
- **Scénario d'échec** : brouillon carrousel à 3 photos → corriger une virgule → « Enregistrer » → deux toasts rassurants (dont « 3 médias non encore uploadés ont été ignorés », **faux**) → les 3 lignes `content_media` supprimées, plus l'ordre, l'`alt_text_override`, le `crop_preset` et — par `ON DELETE CASCADE` (`013_collaboration.sql:138-139`) — **les annotations du portail** épinglées sur ces médias.
- **Pourquoi ça bloque le scaling** : perte de données silencieuse et systématique déclenchée par l'action la plus banale du produit ; rien ne la journalise, `content_versions` ne couvre pas les liaisons médias.
- **Reco** : (1) `libraryAssetId: m.id` et `crop: m.cropPreset` dans `draftFromContent` (exposer `crop_preset` dans `loadContentMedia`, il est déjà en base) ; (2) défense en profondeur serveur : exiger un flag explicite `mediaTouched` plutôt qu'un tableau vide ambigu ; (3) supprimer le toast `mediaIgnored` qui masque le bug.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r27

### [P0] Le worker en STUB marque de VRAIS contenus « publié » avec un permalien bidon — go-live : bloquant
- **Où** : [`apps/worker/src/publishers/index.ts:21`](apps/worker/src/publishers/index.ts#L21) (+ `stub.ts:21-25`, [`db/pg-store.ts:146-164`](apps/worker/src/db/pg-store.ts#L146))
- **Constat** : `STUB_MODE = true` est une **constante en dur**, sans garde d'environnement (`env.ts` ne valide que `DATABASE_URL` et le port). Le stub renvoie `targetStatus:'published'` (IG/FB) / `'pushed_to_platform'` (TikTok), `stub-<platform>-post-<uuid>`, `https://stub.local/<platform>/<uuid>`. `succeed()` écrit ces valeurs **telles quelles** dans `content_targets` puis `recomputeParent` promeut `content_items.status='published'`. En stub, `context.ts:15` rend même un token **absent** non bloquant : la fausse publication réussit sans aucun compte connecté. Le runbook `deploy/GO-LIVE-points-1-2.md:50-70` demande de brancher ce worker sur le Supavisor de **PROD** en affirmant « sans publier chez un client » — vrai pour Instagram, **faux pour la base**.
- **Scénario d'échec** : post programmé 18h pour un vrai client. À 18h00 le stub « publie ». L'app affiche « Publié » + bouton « Voir » vers `stub.local` (`content-targets.tsx:112-131`), le portail et le rapport client montrent le contenu livré. Rien n'est parti. Et la cible est **brûlée** : `enqueue_publish_jobs` exclut `published` (`020:195`) et `016_transitions.sql:76` donne à `published` un ensemble de transitions vide → réparation = `UPDATE` SQL en service_role (ou suppression destructive de la cible, qui cascade les métriques `014:75-77`).
- **Pourquoi ça bloque le scaling** : chaque jour en stub sur la prod détruit tout le backlog du jour, sans marque distinguant une publication simulée d'une vraie (seul le préfixe `stub-` le trahit).
- **Reco** : (1) `STUB_MODE` lu depuis l'env, avec **refus de démarrer** si stub actif ET `DATABASE_URL` non-localhost ; (2) en stub, ne **jamais** écrire d'état terminal métier — s'arrêter sur `dead_letter` ou un statut `simulated` dédié ; (3) colonne `publish_jobs.simulated boolean` pour tracer ; (4) corriger la ligne 69 du runbook.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r15, §12

### [P0] À l'heure H il ne se passe rien, et rien n'est prévu pour le détecter — go-live : bloquant
- **Où** : [`apps/worker/src/db/pg-store.ts:79-81`](apps/worker/src/db/pg-store.ts#L79) (commentaire) + `supabase/` (aucun `functions/`, aucun `pg_cron`)
- **Constat** : le reaper délègue par écrit au « watchdog pg_cron (indépendant, §5) qui notifie » — **ce watchdog n'existe nulle part** : 0 `cron.schedule` dans les 21 migrations, pas de répertoire `supabase/functions`. `publish_jobs` n'est lu par **aucun écran** (les seules occurrences dans `apps/web` sont 3 appels RPC + les types), malgré la policy SELECT « observabilité » (`020:132-136`). Le worker n'a **aucun client HTTP**, aucun Sentry, aucune table de heartbeat, et `apps/worker/package.json` n'a que `pg` en dépendance — donc pas même un healthcheck Coolify possible. La plomberie d'alerte existe pourtant **sauf le producteur** : enum `watchdog_alert` (`002_enums.sql:106`), template Brevo (`transactional.ts:23`), icône UI (`notification-row.tsx:33`). Et `emit_notification` exige `auth.uid()` non nul (`013:785-787`) : le worker en service_role ne pourrait même pas l'appeler. Enfin, l'app Coolify worker n'est pas créée (`deploy/GO-LIVE-points-1-2.md:50`).
- **Scénario d'échec** : 5 posts programmés ce soir. Aucun worker. Les jobs restent `scheduled`, les cibles `queued`, le calendrier dit « Programmé ». Le lendemain : aucun email, aucune notification, aucun badge. Même silence si le worker crash-loop.
- **Pourquoi ça bloque le scaling** : le modèle est app-driven et assume « pas de scan worker » (`020:9-11`) ; toute défaillance du chemin d'enfilement **ou** du worker est structurellement invisible, et le nombre de publications perdues croît linéairement sans plafond ni alerte.
- **Reco** : (1) migration `pg_cron` 1×/5 min : jobs `run_at < now() - 2 min` non claimés + leases expirées → notification `watchdog_alert` + Edge Function → Brevo ; (2) table `worker_heartbeats` (worker_id, last_tick_at) écrite à chaque tick, alerte si > 3 min ; (3) un écran listant les `publish_jobs` non terminaux de l'org (la policy existe déjà).
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : non  **Règle CLAUDE.md** : §5, §10

### [P0] La fenêtre de grâce est évaluée AVANT le contrôle d'idempotence — go-live : bloquant
- **Où** : [`apps/worker/src/engine.ts:34-37`](apps/worker/src/engine.ts#L34) vs `engine.ts:61-63`
- **Constat** : `deadLetter("grace_window_exceeded")` est la **première** instruction de `processJob`, avant tout examen de `job.publishStartedAt`. `deadLetter` (`pg-store.ts:209-223`) écrit `content_targets.status='failed'` + `recomputeParent`, sans jamais appeler `getContainerStatus`. Or `020_publish_jobs.sql:222-224` énonce l'invariant inverse noir sur blanc (« un job avec `publish_started_at` non nul appartient au worker … la publication a peut-être déjà eu lieu ») et `cancel_publish_jobs` l'applique correctement (`and publish_started_at is null`, l.249). Le test de la fenêtre de grâce (`engine.test.ts:186-196`) utilise `publishStartedAt: null` : **le croisement n'est couvert par aucun test**, et la CI n'exécute de toute façon jamais `pnpm --filter worker test`.
- **Scénario d'échec** : 18h00 `publish_started_at` posé, `media_publish` appelé, le post part, le conteneur Coolify est tué. 20h15 le worker redémarre → reaper (`pg-store.ts:82-89`, `status in ('claimed','publishing')` → `retrying`) → claim → **ligne 34** → dead_letter → l'app affiche « Échec » sur une cible **en ligne** chez le client → Étienne reprogramme → **double publication** (l'index unique partiel `020:115-117` exclut `dead_letter`, donc un 2e job actif est légal). Atteignable **sans crash** : `markAwaitingMedia` (`engine.ts:101`) reboucle toutes les 60 s sans incrémenter `attempts` — un Reel dont le traitement dérive au-delà de 2 h est dead-lettré par un worker parfaitement sain.
- **Pourquoi ça bloque le scaling** : toute indisponibilité > 2 h convertit en masse des publications réussies en « échecs » affichés, avec une incitation produit à republier — exactement ce que la règle 15 existe pour empêcher.
- **Reco** : (1) déplacer le test de fenêtre de grâce **après** `if (job.publishStartedAt)` ; (2) ne dead-letterer qu'un job dont `publish_started_at is null` ; (3) ajouter le test « grâce + publishStartedAt ⇒ resolvePublished, jamais deadLetter » ; (4) brancher `pnpm --filter worker test` et `tsc --noEmit` **bloquants** dans la CI.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r15

---

### [P1] `next/image` : l'hôte Supabase Storage n'est pas déclaré — go-live : bloquant
- **Où** : [`apps/web/next.config.ts:14`](apps/web/next.config.ts#L14)
- **Constat** : `remotePatterns` ne contient que `images.pexels.com` — hôte qui n'apparaît **nulle part ailleurs** dans le dépôt (reliquat de mocks). Or 100 % des URLs viennent de `hgdeopkmkwyoumsfggrm.supabase.co` (`content-media.ts:43` `createSignedUrls`, `:50` `getPublicUrl` ; `pro.ts:268,574`) ou du CDN Meta (`pro.ts:580`, fallback `row.thumb_url`). 17 fichiers utilisent `next/image`, **0** `unoptimized`. Vérifié dans le vendor installé (next 16.2.9) : `shared/lib/image-loader.js:96` lève `E231 … hostname not configured` sous le garde `NODE_ENV !== 'production'` (l.57), et `server/image-optimizer.js:597-599` renvoie `"url" parameter is not allowed` → **HTTP 400** en prod.
- **Scénario d'échec** : ne nécessite même pas l'upload — importer les posts IG suffit (`grid/page.tsx:211`). En prod : grille de feed en carrés gris (`media-thumb.tsx:30-33,43`, fallback `onError`), avatar vide, rapport client à 3 cases grises, **carrousel du portail vide** (`components/portal/media-carousel.tsx`, le reviewer approuve un contenu qu'il ne voit pas). En dev : error boundary.
- **Pourquoi ça bloque le scaling** : allowlist par hostname en dur alors que l'URL du projet vient d'une env var (staging ≠ prod) ; chaque nouveau CDN redemandera une édition + un redeploy.
- **Reco** : `{ protocol:'https', hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname }` + `scontent*.cdninstagram.com` / `*.fbcdn.net`. **Attention** : ne pas limiter le `pathname` à `/storage/v1/object/public/**` — les URLs signées du portail sont sous `/storage/v1/object/sign/…` avec query string. Poser `unoptimized` sur les vignettes (déjà des WebP ~400 px : l'optimiseur ne fait que consommer du CPU sur le VPS). Retirer Pexels.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : non  **Règle CLAUDE.md** : r20

### [P1] Le statut des comptes ne devient jamais `needs_reauth` : bouton « Reconnecter » mort — go-live : dégradé
- **Où** : [`apps/worker/src/db/pg-store.ts:196-203`](apps/worker/src/db/pg-store.ts#L196) vs `apps/web/lib/data/clients.ts:127` et `components/app/settings/account-row.tsx:22,45-50`
- **Constat** : `failPermanent(..., needsReauth)` écrit `platform_connections.status='needs_reauth'` — table que le web **ne lit jamais** (les 2 seules occurrences dans `apps/web` sont des écritures, `lib/oauth/tokens.ts:130,147`). Toute l'UI lit `social_accounts.status`, colonne écrite **une seule fois dans tout le dépôt**, en dur à `"connected"` (`tokens.ts:203`), sans aucun trigger de propagation (`005_accounts_shell.sql:81-93` n'a que `set_updated_at`). 11 surfaces testent `status !== "connected"` — toutes mortes, dont `settings/accounts/page.tsx:31-33`, `client-nav.ts:34`, `calendar-banners.tsx:28` et surtout **`studio/composer/preflight.ts:74`**, une garde de programmation qui ne peut jamais se déclencher.
- **Scénario d'échec** : token révoqué → jobs en `failed` (visible sur le contenu, ça oui) mais le compte reste **vert « Connecté »**, le bandeau « X compte(s) à reconnecter » à 0, aucun bouton Reconnecter. Le chemin de réparation existe pourtant à un clic : `ConnectAccountMenu` pointe exactement la même URL que `reconnectHref`.
- **Pourquoi ça bloque le scaling** : le signal de santé atterrit dans une table que personne ne lit ; la dette grandit à chaque nouveau canal (idem `calendar_accounts.status`, écrit uniquement par le callback).
- **Reco** : dans `failPermanent`, mettre **aussi** à jour `social_accounts.status='needs_reauth'` pour tous les comptes de la connexion (ou calculer un statut effectif par jointure explicite sur `platform_connection_id` — pas un `max()` sur enum). Toujours afficher « Reconnecter », pas seulement en erreur. Ajouter l'email `needs-reauth`.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r14

### [P1] Le client n'est jamais prévenu qu'il a quelque chose à valider — go-live : dégradé
- **Où** : [`apps/web/lib/actions/collaboration.ts:247-284`](apps/web/lib/actions/collaboration.ts#L247)
- **Constat** : `sendReviewRequest` insère `review_requests` + `_items` + `_recipients` puis `revalidatePath` + `return` (l.279-280). Aucun `sendTransactional`, aucune notification — alors que `submitReviewDecision` (l.78-92), `postComment` (l.171-188) et `inviteReviewer` (l.366-376) du **même fichier** notifient tous. Le template `"review-requested"` (`transactional.ts:15,27`) n'a **aucun appelant**. Aucune notification d'audience `reviewer` n'est possible : `notifyOrgMembers` code `audience: "owner"` en dur (`notify-org.ts:91`) et c'est le seul émetteur ; le portail n'a d'ailleurs aucune cloche.
- **Scénario d'échec** : 6 contenus envoyés en validation → toast « Demande de validation envoyée à {nom} », **sans le hedge « (aperçu) »** que portent les toasts voisins (`studio.fr.ts:23` vs `:19`). Zéro email, zéro notification. Le lot est bien visible dans le portail — mais le client doit y penser tout seul.
- **Pourquoi ça bloque le scaling** : à 10 clients × 4 lots/mois, 40 relances manuelles ; et l'invariant `clients.approval_mode` transforme chaque oubli en publication manquée. Surtout : le jour où Brevo sera configuré, `changes-requested`, `content-approved`, `review-comment` et `reviewer-invitation` partiront tout seuls **pendant que `review-requested` restera mort en silence** — une passe de go-live purement config ne l'attrapera jamais.
- **Reco** : résoudre les emails des `recipientUserIds` via le client admin puis `sendTransactional({ template:'review-requested', params:{ url, count, message } })` ; insérer une `notifications` `audience:'reviewer'` (l'enum `review_requested` existe, `002_enums.sql:99`, et la policy `notifications_select_own` laisse déjà passer un reviewer) ; brancher une cloche dans le layout du portail (chantier à part : `lib/data/notifications.ts:13` filtre par `orgId`, qu'un reviewer n'a pas). En attendant, hedger le toast.
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : §10, §11

### [P1] Aucun email ne part du produit, et tous les envois sont avalés silencieusement — go-live : dégradé
- **Où** : [`apps/web/lib/brevo/transactional.ts:59-63`](apps/web/lib/brevo/transactional.ts#L59) ; `lib/actions/collaboration.ts:366-376`
- **Constat** : `sendTransactional` lève si `BREVO_API_KEY` manque (l.60) ou si l'ID de template n'est pas renseigné (l.63). `apps/web/.env.local:51` porte `BREVO_API_KEY=` **vide** et aucune variable `BREVO_TEMPLATE_*` n'existe nulle part. Tous les appelants avalent : `catch {}` nu en `collaboration.ts:374-376` et `notify-org.ts:120-122` ; `notifyOrgMembers` dégrade même `channels` à `["in_app"]` (l.79-80). Aucun Sentry dans les deps.
- **Scénario d'échec** : invitation reviewer → ligne créée, exception avalée **sans aucune trace**, action `{ok:true}`, boîte mail vide. Idem pour `changes-requested` quand le client demande des modifications. Le canal « GARANTI » du triple canal n'existe pas.
- **Pourquoi ça bloque le scaling** : chaque nouveau template hérite du silence, et un `catch {}` sans log rend indétectable **pour toujours** un échec en prod (quota Brevo, template supprimé).
- **Reco** : renseigner `BREVO_API_KEY` + `BREVO_SENDER_*` + les IDs de template dans Coolify ; pointer le SMTP custom Supabase sur Brevo (débloque reset-password et l'OTP) ; remplacer les `catch {}` nus par un log structuré (template + status, **jamais** le corps) ; ajouter une section « Brevo » au runbook.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : §10

### [P1] Une invitation ratée est définitive : ni ré-invitation, ni révocation, ni liste — go-live : bloquant
- **Où** : [`supabase/migrations/013_collaboration.sql:301-303`](supabase/migrations/013_collaboration.sql#L301) ; `apps/web/lib/actions/collaboration.ts:358`
- **Constat** : l'index unique partiel est `(client_id, lower(email)) where accepted_at is null and revoked_at is null` — **`expires_at` n'est pas dans le prédicat**, donc une invitation périmée (14 j, `collaboration.ts:344`) bloque **à vie**. Le `23505` est traduit en `already_invited` → toast « Une invitation est déjà en attente pour cet email. ». Aucune sortie : `client_invitations` n'est jamais lue en liste, `revoked_at` n'est jamais écrit, aucun DELETE ; et **aucune action ne retire jamais un `client_members`** (`section-approval.tsx:111-140` n'affiche que le reviewer et un bouton « Inviter »). Aggravant : le token clair n'est renvoyé qu'une fois et `reset()` l'efface à la fermeture de la modale — l'impasse est atteignable à J+0.
- **Scénario d'échec** : (1) le contact ne clique pas en 14 j (probable, aucun email ne part) → la route refuse le token **et** la modale refuse d'en créer un nouveau. (2) Fin de mission : aucun bouton ne coupe l'accès du reviewer, qui continue de voir le calendrier et les visuels non publiés de son ancien prestataire — alors que r4 justifie toute l'architecture RLS par « révoquer un Reviewer doit être effectif immédiatement ».
- **Pourquoi ça bloque le scaling** : la rotation des interlocuteurs côté client est permanente ; chaque rotation = une intervention SQL manuelle, et une exposition RGPD qui grandit avec le portefeuille.
- **Reco** : rendre la ré-invitation **idempotente** (UPSERT régénérant `token_hash` + `expires_at` quand l'existante est expirée, ou filtrer l'index sur `status='pending'` avec un job qui bascule les périmées) ; ajouter dans `section-approval.tsx` la liste des invitations en attente avec « Renvoyer » / « Révoquer » (`revoked_at = now()`) ; ajouter `removeClientMember(clientId, userId)`.
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r4, r6

### [P1] Le wizard fabrique une invitation fantôme : le token est jeté — go-live : dégradé
- **Où** : [`apps/web/lib/actions/clients.ts:167`](apps/web/lib/actions/clients.ts#L167)
- **Constat** : `await inviteReviewer({ clientId, email })` — la valeur de retour, **seule copie en clair du token** (`collaboration.ts:379` ; la base ne garde que le SHA-256, l.342-343), est jetée. Le wizard affiche « Invitation du relecteur enregistrée. » (`onboarding.fr.ts:36`) puis redirige (`wizard-shell.tsx:145`). L'email ne part pas (Brevo inerte). La ligne `client_invitations`, elle, existe.
- **Scénario d'échec** : Étienne remplit le champ optionnel à l'étape 5 → toast de succès → il va ensuite dans Réglages → « Inviter » pour récupérer un lien → `already_invited`. Contournement in-app : supprimer/recréer le client (la FK composite cascade, `013:295`), ou utiliser un alias d'adresse.
- **Pourquoi ça bloque le scaling** : chaque client créé avec le champ rempli produit une ligne morte et bloquante.
- **Reco** : remonter le token dans le retour de `createClientAction` et l'afficher en fin de wizard (copier le lien), exactement comme `reviewer-invite-dialog.tsx:71` ; faire de l'échec Brevo un état **visible** (« invitation enregistrée, email non envoyé — copiez le lien ») plutôt qu'un `catch {}`.
- **Effort** : S  **Impact** : moyen
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r27, §7

### [P1] L'enfilement est en fire-and-forget : « Programmé » sans aucun job — go-live : dégradé
- **Où** : [`apps/web/lib/actions/content-status.ts:95-99`](apps/web/lib/actions/content-status.ts#L95) (+ `lib/actions/content.ts:311`)
- **Constat** : `await supabase.rpc('enqueue_publish_jobs', …)` sans destructurer ni tester `{data, error}`, ni le nombre de jobs créés. Le commentaire l.92-94 justifie : « le watchdog worker rattrapera » — or `020:9-11` acte « APP-DRIVEN … pas de scan worker » et aucun watchdog n'existe. Vérifié dans `postgrest-js` : `shouldThrowOnError = false` par défaut et un `.catch()` interne transforme **même les échecs réseau** en objet retourné — le `await` nu avale tout. Symétrique ignoré de la même façon : `cancel_publish_jobs` (l.98), donc une annulation ratée laisse un job vivant sur un contenu annulé.
- **Scénario d'échec** : glisser un contenu approuvé vers « Programmé » → l'`UPDATE content_items` est commité, la RPC échoue (timeout, `42501`) → `{ok:true}` → toast « Programmé », pastille au calendrier, **zéro `publish_jobs`**. Le contenu ne partira jamais et rien ne le signalera.
- **Pourquoi ça bloque le scaling** : aucun mécanisme de réconciliation entre `content_items.status='scheduled'` et l'existence d'un job ; l'écart entre l'état affiché et la file ne peut que croître, sans détection.
- **Reco** : tester l'erreur RPC et retourner `{ok:false, error:'ENQUEUE_FAILED'}` (ou afficher « programmé mais non mis en file ») ; **attention** : ne pas alerter naïvement sur « 0 job », la RPC retourne légitimement 0 quand `scheduled_at` est null (`020:178-180`) ; ajouter un job `pg_cron` de réconciliation (idempotent par l'index partiel).
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r16, r27

### [P1] Aucune notification n'existe pour la publication : un échec à 7h du matin est invisible — go-live : dégradé
- **Où** : [`apps/web/lib/notifications/notify-org.ts:82`](apps/web/lib/notifications/notify-org.ts#L82)
- **Constat** : seul chemin d'écriture dans `notifications`, appelé **2 fois**, toutes deux côté Reviewer (`collaboration.ts:78` et `:172`). Le worker n'insère rien et n'envoie rien : `succeed`/`retryOrFail`/`failPermanent`/`deadLetter`/`deferForQuota` n'écrivent que dans `publish_jobs`/`content_targets`/`content_items`/`platform_connections`, et les seules occurrences de « notification|brevo » dans `apps/worker` sont des **commentaires**. Realtime n'est câblé nulle part (`.channel(` = 0). Pas de service worker ni de push. 5 templates Brevo sur 10 n'ont aucun appelant (`publish-failed`, `publish-delayed`, `needs-reauth`, `tiktok-draft-ready`, `watchdog-alert`).
- **Scénario d'échec** : post de 07h30 en échec → aucun email, aucune notification in-app, aucun push, aucun badge. *Nuance honnête* : l'échec **est** visible en *pull* (`dashboard.ts:55-68` → `task-list.tsx:40`, tone danger avec `lastError`) — Étienne le voit s'il ouvre l'app, il n'en est simplement pas averti.
- **Pourquoi ça bloque le scaling** : à 10 clients × 12 posts/mois, la seule surveillance est l'ouverture manuelle de 10 calendriers.
- **Reco** : faire écrire au worker, en fin de job, une ligne `notifications` via service_role + un appel Brevo (`publish-failed`, `publish-delayed`, `tiktok-draft-ready`) — factoriser `notify-org.ts` dans `packages/shared`. Attention : `emit_notification` exige `auth.uid()` (`013:785-787`), il faut un chemin service_role dédié. Brancher Realtime sur `notifications` pour la cloche.
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : §5, §10, §11

### [P1] Le shell recharge TOUT l'historique de l'org à chaque page — go-live : dégradé
- **Où** : [`apps/web/lib/data/dashboard.ts:161-172`](apps/web/lib/data/dashboard.ts#L161) → `lib/data/content.ts:213-227` → `content.ts:103-104` et `lib/data/content-media.ts:90-91`
- **Constat** : `app/(app)/layout.tsx:21` appelle `getShellSnapshot` à **chaque** rendu de page du groupe `(app)` — layout dynamique, donc jamais statique. `getContentItems(orgId)` fait `select … eq org_id … order created_at asc` **sans `.limit()` ni borne de date** (les seuls `.limit()` du dépôt sont dans `pro.ts`), uniquement pour alimenter la palette de commandes. L'hydratation passe **tous** les ids en `.in("content_item_id", itemIds)` (cibles, médias, étiquettes) — donc en query params GET PostgREST. Bonus : `content-media.ts:107` signe **toutes** les URLs originales de l'org à chaque rendu. `clients/page.tsx:19-45` y ajoute un N+1 (getContentItems + getSocialAccounts par client, hors cache car arguments différents).
- **Scénario d'échec** : rien ce soir. Vers ~200 contenus, la chaîne `.in(...)` dépasse ~8 Ko d'URL → **414** → le shell entier échoue, donc toutes les pages. Plus tôt encore, le plafond `max-rows` PostgREST tronque **silencieusement** — et comme l'ordre est **ascendant**, ce sont les contenus les **plus récents** qui disparaissent : « 0 publication aujourd'hui » et agenda vide alors que les posts du jour existent.
- **Pourquoi ça bloque le scaling** : point de rupture temporel n°1, atteignable par un seul freelance actif en un an, sans multi-tenant ni ouverture SaaS — et la troncature est silencieuse, donc prise pour un bug métier.
- **Reco** : (1) `getShellSnapshot` minimal (clients + notifications non lues + compteurs), palette chargée à la demande ; (2) borner `getContentItems` par fenêtre temporelle + `.limit()` explicite, pagination pour l'historique ; (3) remplacer les `.in(itemIds)` par une jointure PostgREST imbriquée ou un RPC unique ; (4) agréger les compteurs de `clients/page.tsx` en SQL.
- **Effort** : L  **Impact** : fort
- **⚠ Comportement** : non  **Règle CLAUDE.md** : aucune

---

### [P2] Les noms de variables d'env OAuth du `.env.local.example` ne sont pas ceux que le code lit — go-live : dégradé
- **Où** : `apps/web/.env.local.example:47-54` vs [`apps/web/lib/oauth/config.ts:55-56,68-69,80-81,92-93`](apps/web/lib/oauth/config.ts#L55)
- **Constat** : l'exemple documente `META_APP_ID` / `TIKTOK_CLIENT_KEY` / `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` ; le code lit `process.env[config.clientIdEnv]` (l.106) avec `OAUTH_META_CLIENT_ID`, `OAUTH_TIKTOK_CLIENT_KEY`, `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_MICROSOFT_CLIENT_ID`. **Zéro recouvrement.** `OAUTH_STATE_SECRET` (obligatoire, `state.ts:23-24`) est absent de l'exemple. Le `catch {` de `app/api/oauth/[provider]/route.ts:50` est **nu** : il avale une Error qui contient pourtant le nom de la variable (`config.ts:109`), sans aucun log. *Nuance* : le fichier d'exemple est git-ignoré, et le runbook `deploy/GO-LIVE-points-1-2.md:37-44` (versionné, celui réellement suivi pour Coolify) porte les **bons** noms — le déploiement n'est pas égaré, seul le setup local l'est.
- **Scénario d'échec** : coller son App ID Meta comme l'exemple le dit → « Connecter Instagram » → toast « Erreur / connexion non configurée » (`oauth-result-toast.tsx:42-47`) alors qu'on vient de la configurer, sans aucun log serveur.
- **Pourquoi ça bloque le scaling** : deux sources de vérité pour la même config ; chaque provider redouble la divergence.
- **Reco** : aligner l'exemple + ajouter `OAUTH_STATE_SECRET` ; ajouter un `env.ts` Zod côté web qui **fail-fast** au boot (comme `apps/worker/src/env.ts`) ; faire remonter le nom de la variable manquante dans le log et dans `?error=oauth_unconfigured&var=…`.
- **Effort** : S  **Impact** : fort
- **⚠ Comportement** : non  **Règle CLAUDE.md** : §7 (variables d'env correctes, web ET worker)

### [P2] Le worker n'a aucun gate automatisé : ni typecheck, ni test en CI — go-live : dégradé
- **Où** : [`.github/workflows/ci.yml:107-137`](.github/workflows/ci.yml#L107) + `Dockerfile:9-20` + `package.json:10`
- **Constat** : le job `web` enchaîne install / Biome / typecheck / build — et **Biome comme le typecheck sont en `continue-on-error`** (l.130, l.134) : seul `pnpm build` bloque. Aucun `--filter worker` nulle part (`grep worker .github/` = 0). Or `apps/worker/src/engine.test.ts` est le **seul** fichier de test JS du dépôt (7 tests, dont « RÈGLE 15 : reprise d'un job DÉJÀ publié ⇒ JAMAIS republier ») et il ne tourne nulle part. Le script racine `build` ne compile que web ; le stage `deps` du Dockerfile ne copie que le `package.json` racine + `apps/web` (rejoué : « all 2 workspace projects », `pg`/`tsx` absents). *Correction du scénario souvent avancé* : ce n'est **pas** un blocage de déploiement — `deploy/GO-LIVE-points-1-2.md:50-60` prescrit une app Coolify en **buildpack** (`pnpm install` / `pnpm --filter worker start`), et le worker s'exécute en TS direct via `tsx`.
- **Scénario d'échec** : quelqu'un casse l'idempotence dans `engine.ts` → push → **CI verte**. L'unique preuve automatisée de la règle 15 n'est jamais exécutée.
- **Pourquoi ça bloque le scaling** : chaque migration future (nouvelle colonne `publish_jobs`, nouveau publisher) sera écrite sans filet.
- **Reco** : job `worker` dédié en CI : `pnpm --filter worker exec tsc --noEmit` + `pnpm --filter worker test`, **bloquants**. Retirer les `continue-on-error` du job web une fois la dette Biome/CRLF traitée.
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : non  **Règle CLAUDE.md** : r15, r17

### [P2] Wizard étape 2 : les comptes sociaux « connectés » sont jetés à la soumission — go-live : dégradé
- **Où** : [`apps/web/components/app/onboarding/wizard-shell.tsx:103-127`](apps/web/components/app/onboarding/wizard-shell.tsx#L103) + `components/app/onboarding/account-connect-card.tsx:37-47`
- **Constat** : `connect()` ne fait qu'un `onChange({ ...account, connected: true })` local (aucun appel serveur, aucune redirection OAuth), et le payload envoyé à `createClientAction` ne contient **pas** `draft.accounts` — `draftSchema` (`clients.ts:19-53`) n'a d'ailleurs aucun champ `accounts`, donc même transmis il serait supprimé par Zod. `clients.ts:90-101` n'écrit jamais dans `social_accounts` (le seul écrivain du dépôt est le callback OAuth, `tokens.ts:193`).
- **Scénario d'échec** : trois cartes vertes « Connecté », compteur « 3 comptes connectés », fin de wizard → zéro compte, aucune icône plateforme dans l'en-tête client (`clients/[clientId]/layout.tsx:54-57`). Les libellés portent bien « (aperçu) » (`onboarding.fr.ts:72,91-94`) — mais le badge de la carte affiche « Connecté » sec sur bordure verte.
- **Pourquoi ça bloque le scaling** : chaque client créé démarre sans compte, et le freelance doit refaire le tour par `/settings/accounts` sans y être invité.
- **Reco** : soit supprimer l'étape 2 et rediriger vers `/settings/accounts?clientId=…` juste après la création, soit transformer le bouton en vrai lien `/api/oauth/{platform}?clientId=…` post-création (la route accepte déjà `clientId`, `route.ts:32`). Dans les deux cas, retirer l'état `connected` local.
- **Effort** : M  **Impact** : fort
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : aucune

### [P2] Le ton de marque stocké en base est une clé i18n brute — go-live : dégradé
- **Où** : [`apps/web/components/app/onboarding/step-brand.tsx:37`](apps/web/components/app/onboarding/step-brand.tsx#L37) et `:43` → `lib/actions/clients.ts:153` → `components/app/client-settings/section-brand-kit.tsx:96`
- **Constat** : `<SelectItem value={toneKey}>` porte la **clé** i18n (`TONES = ["onboarding.tone.warm", …]`, `wizard-types.ts:88-95`), `patch({ tone: String(v) })` la stocke telle quelle, `createClientAction` l'écrit sans traduction dans `brand_kits.tone` (Zod : simple `z.string().max(2000)`), et les réglages la rendent dans un `<Textarea value={tone}>` brut. Seul `step-review.tsx:68-71` la résout pour l'affichage — d'où l'illusion pendant l'onboarding.
- **Scénario d'échec** : choisir « Chaleureux » → Réglages > Identité de marque affiche littéralement `onboarding.tone.warm` ; un simple changement de palette déclenche `updateBrandKit` et fige la chaîne parasite.
- **Pourquoi ça bloque le scaling** : toute donnée métier stockée sous forme de clé d'UI casse au renommage d'une clé ou à l'ajout d'une langue — d'autant que le contenu client est monolingue par décision.
- **Reco** : `value={t(toneKey)}` (ou un enum stable en DB + traduction à l'affichage) + migration de rattrapage sur les lignes `brand_kits` contenant `onboarding.tone.*`.
- **Effort** : S  **Impact** : moyen
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : aucune

### [P2] Le cookie `active_org_id` n'est jamais écrit et le repli n'a aucun `ORDER BY` — go-live : après
- **Où** : [`apps/web/lib/auth/org-context.ts:71-82`](apps/web/lib/auth/org-context.ts#L71)
- **Constat** : `ACTIVE_ORG_COOKIE` est **lu** (l.71) et jamais écrit : aucune Server Action `switchOrg`, aucun `cookies().set('active_org_id', …)` dans tout le dépôt, aucun sélecteur d'org dans `app-sidebar.tsx`. Le repli `memberships.find(...) ?? memberships[0]` porte sur une requête **sans `.order()`**. Aucun chemin applicatif ne crée aujourd'hui une seconde appartenance (aucune Server Action n'insère dans `organization_members` ; seule la RPC `create_organization` le fait, `010:166`).
- **Scénario d'échec** : invisible aujourd'hui. Dès deux organisations, l'org active devient non déterministe entre deux rendus, sans moyen de choisir. C'est r10 à moitié implémentée : la lecture existe, l'écriture non.
- **Pourquoi ça bloque le scaling** : le multi-org est la structure même du multi-tenant ; sans switcher ni ordre stable, la fonctionnalité donne des rendus incohérents plutôt qu'une erreur franche.
- **Reco** : ajouter la Server Action `switchOrg` du CLAUDE.md §3 (validation de membership → cookie httpOnly/secure/sameSite=lax) + un sélecteur dans la sidebar, et `.order("created_at", { ascending: true })` **dès maintenant** pour rendre le repli déterministe.
- **Effort** : M  **Impact** : moyen
- **⚠ Comportement** : non  **Règle CLAUDE.md** : r10

### [P2] Les `catch {}` nus des Server Actions avalent le `NEXT_REDIRECT` — go-live : dégradé
- **Où** : [`apps/web/lib/actions/clients.ts:208`](apps/web/lib/actions/clients.ts#L208) (et `:236`, `:263`) — **26** `} catch {` dans `apps/web/lib/actions/`
- **Constat** : `requireClientInOrg` (`_helpers.ts:21-32`) appelle `getActiveOrg`, qui appelle `redirect()` — lequel **lève** un `NEXT_REDIRECT` que le framework doit voir remonter (la doc Next 16 embarquée dans le dépôt le dit explicitement : `node_modules/next/dist/docs/.../redirect.md:50-52`, et `unstable_rethrow.md:46-50`). Les actions l'enveloppent dans un `catch` sans discriminer. 25 de ces 26 catch sont sur le chemin d'auth (celui de `collaboration.ts:374` est délibéré, il couvre Brevo).
- **Scénario d'échec** : le cas « session expirée » est largement pré-empté par le proxy fail-closed. Restent : appartenance org révoquée onglet ouvert (→ `redirect("/onboarding")` avalé → « accès refusé »), et surtout **tout** échec (driver Postgres, sérialisation) remonté en `error: "forbidden"` — exactement le signal qu'un opérateur solo doit pouvoir distinguer d'un vrai refus RLS.
- **Pourquoi ça bloque le scaling** : le motif est copié dans tout `actions/` ; chaque nouvelle action l'hérite, et les faux « forbidden » masquent les vrais dans les logs.
- **Reco** : garde partagée dans `_helpers.ts` (`if (isRedirectError(e)) throw e` / `unstable_rethrow`, disponible dans la version installée) + interdire `} catch {` nu dans `lib/actions/` via un motif interdit en CI (le job `db` en a déjà).
- **Effort** : M  **Impact** : moyen
- **⚠ Comportement** : oui  **Règle CLAUDE.md** : r27

---

## Annexe — pistes non vérifiées

> Relevées pendant les passes mais **non soumises à réfutation adversariale**. À traiter comme des hypothèses à confirmer, pas comme des faits établis.

**OAuth & tokens**
- `access_type=offline` absent côté Google → aucun `refresh_token`, l'agenda mourrait en 1 h (`lib/oauth/index.ts:26-36` + `config.ts:71-82`).
- Scope `pages_manage_posts` absent → publication FB Page refusée même après App Review (`config.ts:44-50`).
- Zéro log sur tout échec OAuth, réduit à un toast générique (`api/oauth/[provider]/callback/route.ts:61-65`, `route.ts:50-53`).
- Aucune déconnexion possible, tokens Vault jamais supprimés (pas de `lib/actions/accounts.ts`).
- State OAuth sans expiration, sans lien à la session, verifier PKCE lisible dedans (`lib/oauth/state.ts:33-57`).
- `redirect_uri` dérivé de l'origin de la requête au lieu de l'URL publique (`route.ts:22,33` ; `callback/route.ts:20,39`).
- Token utilisateur Meta en query string vers Graph (`identity.ts:66,70`).
- Abonnés figés à l'instant de la connexion, abonnements toujours à zéro (`tokens.ts:205`).

**Médias & composer**
- `reconcileMedia` : delete+insert non atomique, code d'erreur jamais lu (`content.ts:231`).
- Le picker médiathèque n'a aucun état vide (`media-picker-dialog.tsx:82`).
- Le recadrage est une fiction en mémoire qui fait passer le pré-flight au vert (`composer-types.ts:91`).
- « Conversion automatique avant publication » promise à l'utilisateur, zéro code derrière (`i18n/dictionaries/fr.ts:121`).
- Le pré-flight ne bloque rien, le serveur ne valide aucune spec (`composer-header.tsx:76`).
- Renommer l'alt / supprimer un média ne persiste rien ; les 6 Server Actions de `media.ts` sont mortes (`use-library-assets.ts:23`).
- Lien de dépôt client : domaine inventé, envoi d'email factice (`library-utils.ts:122`).
- Aucune Edge Function `media-cleanup` : le Storage grossit sans borne (`deploy/05_migration_012.sql:59`).

**Portail & collaboration**
- « Approuver » échouerait systématiquement sur un contenu en `changes_requested` (`portal/[contentId]/page.tsx:44` vs `013:691`).
- Le Reviewer ne peut pas obtenir d'URL signée : vignette 400 px ou rien (`012_media_storage.sql:54-62`).
- `/portal` planterait pour tout utilisateur sans `client_members`, dont l'owner (`portal/page.tsx:22-23`).
- `last_active_at` jamais écrit → « n'a jamais ouvert le portail » pour toujours (`board-review-banner.tsx:43-48`).
- Le fil de commentaires est à sens unique : la réponse de l'agence ne notifie jamais le client (`collaboration.ts:171-188`).
- Le suivi d'un lot de validation n'existe que dans l'état React (`board-state.ts:309-327`).
- Contexte Reviewer mono-org : commentaires et historique disparaîtraient au second client (`org-context.ts:144`).
- `listUsers()` non paginé (50 par défaut) dans la route d'acceptation (`accept/route.ts:61-67`).

**Worker & publication**
- Jobs zombies : le reaper laisse les jobs à tentatives épuisées en `claimed`, et l'index unique partiel interdit alors toute remise en file (`pg-store.ts:82-89` + `020:115-117`).
- Zéro enforcement de quota côté worker, jauge UI toujours à 0 (`context.ts:26-33` + `pro.ts:720-750`).
- Le « report automatique pour quota » se transformerait en échec définitif au bout de 2 h (`engine.ts:49-53`).
- « Réessayer » / « Ignorer » ne font rien : personne ne lit `retry_requested_at` (`content-targets.tsx:55-77`).
- Le contexte de publication ne contient **ni URL de média ni légende** — même publishers réels branchés, rien n'est publiable (`context.ts:11-23` + `publishers/types.ts:13-20`).
- Le modèle « conteneur » n'existe que chez Instagram : la reprise idempotente est inapplicable telle quelle à FB/TikTok (`publishers/types.ts:11-40`).
- La requête de claim ne peut pas utiliser l'index partiel prévu → seq scan toutes les 5 s (`pg-store.ts:60-68` vs `020:104-106`).

**Après publication / transverse**
- Rapport client daté « Juin 2026 » en dur (`report.fr.ts:5`) ; « mot du mois » ni enregistré ni partagé (`report-workspace.tsx:27`).
- `post_metrics` / `imported_posts` n'ont aucun collecteur : performance et rapport resteront à zéro (`perf-data.ts:106`).
- « Dupliquer » / « Reprogrammer » du calendrier : toasts de succès sans écriture (`calendar-actions.ts:241`, `:224`).
- « Synchroniser le feed » et « Dernière synchro il y a 2 h » : bouton décoratif, texte en dur (`use-grid-view.ts:32`).
- « Demander la validation de la grille » : badge local (`validate-grid-dialog.tsx:34`).
- Agenda unifié : rien ne synchronise Google/Outlook (`tokens.ts:64`) ; `toggleCalendar` jamais appelée (`agenda.ts:23`).
- Zéro observabilité : pas de Sentry, `global-error` jette l'objet erreur, worker en stdout seul.
- Realtime déclaré dans la stack, absent du code (`notification-center.tsx:20`).
- PWA réduite à un manifeste : pas de service worker, aucune icône PNG 192/512 ni apple-touch (`app/manifest.ts:15`).
- Aucun analytics : les 15 events de §11 n'existent nulle part.
- Liens publics de rapport sans expiration ni révocation (`report-share-actions.ts:39`).
- Dialog « Automatisations » : 4 interrupteurs sans effet, dont « publier dès approbation » (`automation-dialog.tsx:54`).
- `scripts/gen-types.py` n'écrit aucun fichier ; `types.ts` (1892 l.) est maintenu à la main malgré son en-tête.
- Aucun framework de test côté web ; `packages/shared` (7 lignes) n'est importé par personne, les enums métier sont dupliqués trois fois.
- Règle 24 (≤ 250 lignes) enfreinte sur les fichiers les plus critiques (`lib/actions/content.ts`).
- Chiffres fabriqués dans des écrans montrés au client : heatmap « meilleurs créneaux », « cohérence 82 % » (`perf-utils.ts:50`).
- React Hook Form et TanStack Query absents : 4 `<form>` dans toute l'app.

---

## Ce qui va bien (à préserver)

1. **Le socle multi-tenant est conforme et sérieux.** `org_id` dénormalisé partout, RLS sur 100 % des tables, FK composites (`unique(id, org_id)` / `unique(id, client_id)`), helpers `private.*` SECURITY DEFINER, policies wrappées `(select fn())` et `TO authenticated`. 22 migrations 001→021 appliquées et vérifiées, 19 fichiers pgTAP (231 tests), et un job CI `db` **bloquant** qui enchaîne `supabase db reset` + pgTAP + catalogue d'advisors + motifs interdits. C'est la partie la plus difficile du projet, et elle est faite.
2. **Les tokens sont correctement isolés.** Chiffrés dans Vault, derrière `platform_connection_secrets` / `social_account_secrets` en **deny-all** (aucune policy), OAuth custom en Route Handlers avec state signé — r11 à r13 respectées. Le durcissement `017_advisor_hardening.sql` (révocation d'`emit_notification` à `authenticated`) et le correctif « anon → Vault » du commit 54ef94c montrent que la paranoïa demandée par §12 est effectivement appliquée.
3. **La file de publication est le bon design, bien exécuté.** Postgres `FOR UPDATE SKIP LOCKED`, claim atomique, lease 2 min + reaper, backoff exponentiel + jitter, index unique partiel par cible active, appels HTTP hors transaction, garde `env.ts` interdisant le port 6543. Et `cancel_publish_jobs` (`020:222-249`) applique la règle 15 **à la lettre**, avec le commentaire qui l'explique — c'est la référence à laquelle aligner `engine.ts`.
4. **Le contrat de données média est déjà juste.** Chemins `{org_id}/{client_id}/…`, `storage_path` / `thumb_path` séparés, **aucune URL stockée en base** (dérivée à la lecture), bucket `media-originals` privé + `media-thumbs` public, policies `storage.objects` via `storage.foldername()`. Le câblage TUS se posera **au-dessus**, sans réécriture du modèle.
5. **La machine à états métier est en base, pas dans l'UI.** `016_transitions.sql` gouverne les transitions de `content_items`, `013:417-421` interdit à `authenticated` de poser `publishing`/`published`, `enqueue_publish_jobs` filtre les cibles. La source de vérité est au bon endroit.
6. **L'honnêteté des libellés là où elle existe.** Les toasts « (aperçu) », « recevrait un email Brevo », « aucun envoi », et `notify-org.ts:79-80` qui refuse d'afficher un badge « Email » sans Brevo configuré : c'est une bonne discipline. Elle mérite d'être **généralisée** aux quelques endroits qui affirment encore un envoi qui n'a pas lieu (`studio.fr.ts:23`, `onboarding.fr.ts:36`, `composer.fr.ts:269`).
7. **Le runbook `deploy/GO-LIVE-points-1-2.md`** documente correctement les variables (bons noms OAuth, `OAUTH_STATE_SECRET`) et le mode buildpack du worker. Il lui manque une section Brevo et la correction de la ligne 69 (« sans publier chez un client »).

---

**Chemin de correction conseillé, dans l'ordre** : (1) garde d'env sur `STUB_MODE` + interdiction d'écrire un état terminal en stub — **avant** de créer l'app Coolify worker ; (2) fenêtre de grâce après le contrôle d'idempotence + CI worker bloquante ; (3) `libraryAssetId` dans `draftFromContent` (2 lignes, perte de données) ; (4) `next.config.ts` remotePatterns ; (5) `/onboarding` + `landingFor` + `/signup` ; (6) `token_hash` dans la route d'acceptation d'invitation ; (7) échange long-lived Meta + écran de sélection de Page ; (8) upload TUS ; (9) watchdog `pg_cron` + notifications du worker + Brevo.
