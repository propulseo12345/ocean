# Analyse de lancement — Ocean

**Date :** 11 juin 2026
**Méthode :** workflow multi-agents (15 agents) — 4 recherches API sur docs officielles + 4 contre-vérifications adversariales + 5 études d'architecture sur la stack Propul'SEO + 2 revues critiques du PRD v0.1 ([PRD.md](PRD.md)).

---

## 1. Verdict global

**Le PRD est solide et le chemin MVP est viable sur les 4 plateformes** — verdict unanime : `viable_avec_ajustements` partout. La stratégie centrale (§7.2 : tester en solo via les accès développeur pour éviter les validations d'API) est **confirmée pour Meta, mais réfutée pour TikTok** (voir §2.3 — c'est la correction la plus importante de cette analyse).

Trois familles d'ajustements :
1. **Corrections factuelles au PRD** (chiffres, terminologie, opportunités ignorées) — §2.
2. **Architecture arrêtée sur la stack Propul'SEO** (le PRD suggérait R2/Auth0/BullMQ ; tout reste dans la stack canonique) — §3.
3. **7 gaps bloquants à trancher avant Lot 0/1** (le plus structurant : l'entité ContentTarget manquante) — §4.

---

## 2. Vérification API — état réel juin 2026 (sources officielles citées en fin de section)

### 2.1 Instagram — viable, et MEILLEUR que prévu

| Claim du PRD | Verdict | Réalité juin 2026 |
|---|---|---|
| Mode dev sans App Review, ~25 comptes | ⚠️ Modifié | Le principe tient via le **Standard Access** (auto-accordé, utilisateurs avec rôle sur l'app). Mais ~25 est faux : **~50 testeurs** (500 si Business Manager vérifié). Le « mode développeur » est un terme piège : **créer l'app en type Business** (pas de toggle dev/live — une app Consumer en mode dev produit des posts INVISIBLES du public). |
| Page Facebook liée requise | ❌ Infirmé | La variante **« Instagram API with Instagram Login »** (graph.instagram.com, scopes `instagram_business_*`) publie photos/carrousels/Reels/Stories **sans Page Facebook**. Recommandation : IG Login pour Instagram + Facebook Login for Business (séparément) pour les Pages FB. Limites IG Login : pas d'ads/tagging/recherche hashtag, **pas de resumable upload** (URL publique obligatoire). |
| ~100 posts/24h | ✅ Confirmé | 100 posts API/24h glissantes (carrousel = 1 post), via `GET /content_publishing_limit`. **+ limite découverte : 400 créations de conteneurs/24h** (conteneurs non publiés comptent). |
| Tous formats publiables | ✅ Confirmé | Photos, carrousels (10 max), Reels, Stories. **JPEG uniquement pour les images** (pipeline conversion PNG/HEIC→JPEG obligatoire). Plus de `media_type VIDEO` feed : toute vidéo feed = `REELS`. Stories confirmées sur la variante IG Login (la « zone grise » du 1er agent a été levée par le contre-vérificateur : exemples explicites sur graph.instagram.com/v25.0). |
| URL publique au moment T | ✅ Confirmé | Meta cURL l'URL fournie. Resumable upload : réservé au FB Login, vidéo uniquement. |
| Workflow conteneur asynchrone | ✅ Confirmé | POST /media → poll `status_code` jusqu'à FINISHED (1×/min) → POST /media_publish. Conteneur expire à 24h. |

**Nouveautés exploitables ignorées par le PRD :** Graph API v25.0 (fév. 2026) ; DELETE média via API (avr. 2026) ; Trial Reels ; Audio API Reels ; oEmbed sans token (utile pour la grille) ; nouvelles métriques views/reposts (module stats V2). Tokens IG Login : long-lived 60 jours, refresh via `/refresh_access_token` (≥24h d'âge, non expiré ; **non rafraîchi en 60 j = perdu** → worker de refresh obligatoire).

**Réserve résiduelle (confiance moyenne) :** aucune phrase officielle ne dit POSITIVEMENT que les posts publiés en Standard Access sont visibles de tous. Les indices convergent (compte de test obligatoirement public, test pré-review explicitement prévu) mais → **Spike n°1 : publier 1 post test et vérifier sa visibilité depuis un compte tiers sans rôle. À faire en tout premier au Lot 2.**

### 2.2 Facebook Pages — viable avec 3 ajustements

- **Ajustement 1 (critique)** : même piège terminologique. En 2026 la création d'app passe par des **use cases** (choisir un use case Pages type « Manage everything on your Page ») ; apps Business = pas de modes dev/live. Si un toggle dev/live apparaît, passer en Live (sans review). Publication réelle et publique sur les Pages où l'utilisateur à rôle sur l'app détient la tâche `CREATE_CONTENT` (attribuée via Meta Business Suite par le client). Validation empirique recommandée (post test en navigation privée).
- **Ajustement 2** : `scheduled_publish_time` (programmation native Meta, fenêtre 10 min–30 jours) **n'existe que pour les posts feed**. Reels (`POST /video_reels`, 9:16, 3–90 s) et Stories (`/photo_stories`, `/video_stories`) n'ont PAS de programmation native → c'est le worker interne qui programme (architecture déjà prévue, rien ne change).
- **Ajustement 3 (rate limits réels)** : tokens de Page → BUC = **4800 appels × « engaged users »/24h par Page** (⚠️ petites Pages clientes peu actives = budget réduit ; surveiller le header `X-Business-Use-Case-Usage`). **30 Reels API/24h par Page** (à faire respecter par l'app). Pas de plafond « X posts/jour » pour le feed. Tokens de Page long-lived n'expirent pas — idéal pour le worker.
- **Alerte V2** : le changelog v25.0 déprécie massivement les métriques d'insights Pages (suppression à v26.0 fin 2026) → le module Statistiques V2 devra cibler les nouvelles métriques.

### 2.3 TikTok — la correction stratégique majeure ⚠️

Le contre-vérificateur a **réfuté** un point clé : contrairement à Meta, **il n'y a pas de « mode dev » TikTok utilisable en phase solo**.

- Le **Sandbox** TikTok (10 target users, 5 sandboxes, sans soumission) **ne permet PAS de posts publics** (« Sandbox mode does not offer access to Content Posting API for public videos ») et exige de se connecter au compte cible avec ses identifiants. Il couvre le dev/test, **pas l'usage réel sur les comptes clients**.
- La phase solo TikTok EST déjà de la production → la **revue d'app TikTok standard** (distincte de l'audit Content Posting ; dossier léger : privacy policy, démo ; quelques jours à semaines) est un **jalon bloquant à soumettre dès le DÉBUT du Lot 2**, pas « avant l'ouverture SaaS ».
- Ce qui reste vrai : le mode brouillon/inbox (scope `video.upload`) échappe à l'audit Content Posting ET aux restrictions SELF_ONLY/5 utilisateurs (qui ne visent que le Direct Post) — **pour la vidéo**.
- **Risque résiduel photos** : l'endpoint carrousels photo (`/content/init/`, partagé Direct Post/brouillon) documente l'erreur 403 `unaudited_client_can_only_post_to_private_accounts` sans exemption explicite du mode brouillon → **Spike n°2 : tester 1 brouillon photo sur compte client public avec app non auditée.**
- Limites réelles : **max 5 brouillons en attente/24h par créateur** (le « ~15/jour » ne vise que le Direct Post) ; 6 req/min/token sur les endpoints init.
- **Médias** : `PULL_FROM_URL` exige la vérification de propriété du domaine — **impossible sur \*.supabase.co**. Vidéo → `FILE_UPLOAD` chunké depuis le worker (5–64 MB, RAM/disque VPS à prévoir pour ~200 MB/Reel). **Photos → PULL_FROM_URL uniquement** → custom domain Supabase (add-on payant) requis si carrousels photo TikTok au périmètre.
- **UX friction** : le pré-remplissage titre/description en brouillon existe pour les **photos seulement** ; pour les brouillons **vidéo**, le freelance re-saisit la légende dans l'app → prévoir un bouton « copier la légende » + notification push à l'heure planifiée (« ton brouillon TikTok est prêt »).

### 2.4 Agendas (Google + Microsoft) — viable, le piège est l'OAuth, pas l'API

- **Piège Google phase solo** : app en statut « Testing » avec scopes sensibles = **refresh tokens expirés tous les 7 jours** (vérifié mot pour mot) → reconnexion hebdo des agendas. Le scope Calendar est « sensible » (PAS restreint) : vérification Google **gratuite, ~10 jours, sans CASA** → contrairement à Meta/TikTok, **la lancer tôt** (Lot 4) plutôt que rester en mode test. Alternative transitoire : publier « In production » non vérifié (écran d'avertissement + plafond à vie de 100 utilisateurs, sans expiration 7 j).
- **Opportunité** : scopes granulaires `calendar.events.readonly` + `calendar.calendarlist.readonly` (plus simples à justifier que `calendar.readonly`).
- **Microsoft phase solo** : zéro friction (app multi-tenant + comptes perso dans son propre tenant Entra, self-admin-consent, comptes Outlook.com perso non affectés).
- **Microsoft phase SaaS (le PRD sous-estime)** : depuis « Secure by Default » (juil.–nov. 2025), la politique par défaut des tenants M365 **bloque le consentement utilisateur pour tous les scopes Calendars.*** → admin consent du tenant client requis + **publisher verification** quasi obligatoire (compte Microsoft AI Cloud Partner Program, gratuit). → À ajouter au §12 comme jalon V2 au même titre que l'App Review Meta.
- **Sync** : Google `syncToken` incompatible timeMin/timeMax ; watch channels sans renouvellement auto (lire l'expiration réelle, ne jamais coder 7 j en dur) ; Graph subscriptions <7 j renouvelables. **MVP : polling fenêtré 15 min suffit largement** (quotas Google : 600 req/min/user — note : dépassements facturables « later in 2026 »).

### Sources principales
developers.facebook.com (access-levels, app-modes, app-roles, instagram-platform/instagram-api-with-instagram-login, content-publishing, pages-api, video-api, page-stories-api, rate-limiting, changelog) · developers.tiktok.com (content-posting-api-*, content-sharing-guidelines, add-a-sandbox, our-guidelines) · developers.google.com (sensitive-scope-verification, calendar/api/guides/sync & push, quota) · learn.microsoft.com (permissions-reference, publisher-verification, change-notifications) · mc.merill.net (MC1097272, MC1163922) · support.google.com/cloud (15549945, 7454865).

---

## 3. Architecture arrêtée sur la stack Propul'SEO

> Le PRD §8 suggérait NestJS/BullMQ/Redis, R2/B2/S3, Auth0/Clerk. **Tout reste dans la stack canonique** — aucune impossibilité technique ne justifie d'en sortir.

### 3.1 Multi-tenant & RLS (Supabase)

- **`org_id` dénormalisé NOT NULL sur 100 % des tables métier** + `client_id` sur les tables filles de Client, verrouillés par **FK composites** (`UNIQUE(id, org_id)` sur clients, `UNIQUE(id, client_id)` sur content_items) : une ligne fille ne peut physiquement pas pointer vers un autre tenant, même avec un bug applicatif. Policies sans jointure (reco officielle Supabase, +99,78 % perf).
- **Pas de claims JWT d'autorisation au MVP** : helpers `SECURITY DEFINER` dans un schéma `private` non exposé, lisant 2 tables d'appartenance indexées (`organization_members` : owner/admin ; `client_members` : reviewer/editor). Raison : les claims ne se rafraîchissent qu'au refresh du token → révoquer un Reviewer resterait effectif ~1h (inacceptable pour un externe) ; et un claim plat ne représente pas le scoping par client.
- **Reviewer = vrai utilisateur Supabase Auth** (magic link), possédant uniquement une ligne `client_members` → ne passe aucune policy org-level par construction. Editor/AgencyAdmin = simple INSERT + 1 policy le jour J, zéro refonte.
- **Tokens OAuth : tables sœurs `*_secrets` en deny-all** (RLS activée, ZÉRO policy) → seuls le worker/serveur (service role) y accèdent. Aucun token ne transite jamais vers le navigateur.
- Schéma SQL complet (tables, FK composites, helpers, 3 policies modèles) fourni par l'agent — voir transcript du workflow ; à reprendre tel quel dans les migrations du Lot 0.
- **Pièges à imposer en revue de code** : wrapping `(select fn())` dans les policies (sinon −95 % perf) ; `TO authenticated` sur chaque policy ; vues en `security_invoker = true` ; RLS aussi sur les tables d'appartenance (via helpers, sinon récursion) ; trigger `handle_new_user` qui n'insère QUE dans profiles ; test d'isolation pgTAP en CI + `get_advisors` après chaque migration.

### 3.2 Worker de publication — LE composant critique

**Décision : worker Node.js dédié sur Coolify + Postgres comme file (`SELECT … FOR UPDATE SKIP LOCKED`). Pas de Redis/BullMQ, pas d'Edge Functions pour publier.**

- **(a) pg_cron+pgmq+Edge Functions disqualifié** : limites runtime (2 s CPU / 400 s wall / 256 MB) face au polling IG de 5–10 min ; pont pg_cron→pg_net fire-and-forget sur tables UNLOGGED = échecs silencieux (le risque n°1 du PRD §12).
- **(b-bis) BullMQ+Redis écarté** : Redis = seconde source de vérité de l'état des jobs à réconcilier avec Postgres — le scénario classique de double publication.
- **(c) Trigger.dev/Inngest écartés** : composant cœur chez un tiers US (RGPD §10), coût récurrent, hors stack.
- Design : monorepo pnpm `apps/worker`, 2e app Coolify ; connexion **Supavisor mode SESSION (port 5432)** — jamais le pooler transaction (6543, casse advisory locks) ; tick 5 s ; claim atomique + lease 2 min + reaper ; appels HTTP hors transaction ; horloge = `now()` Postgres.
- **États PublishJob** : `scheduled → claimed → (awaiting_media ⇄ claimed)* → succeeded | retrying → … | failed | dead_letter | canceled`, sous-étapes `refresh_token → check_quota → create_container → publish → verify`. Backoff exponentiel + jitter, max 5 tentatives ; erreurs permanentes (token révoqué, média invalide) = failed direct.
- **Idempotence (règle absolue)** : index unique partiel `(content_item_id, social_account_id)` sur jobs actifs ; `publish_started_at` posé AVANT `media_publish` ; un job retrouvé avec `publish_started_at` non nul ne retry JAMAIS aveuglément — il interroge d'abord `GET /{container}?fields=status_code` (PUBLISHED → succès).
- **Refresh tokens** : tâche quotidienne (Meta 60 j, refresh si <10 j) ; TikTok à la volée avant chaque job (access 24h/refresh 365 j, **rotation du refresh token à chaque échange** → advisory lock par compte). Échec refresh → `needs_reauth` + email Brevo.
- **Filet de sécurité** : Sentry (worker + Cron Monitors) + **watchdog pg_cron indépendant** (1×/5 min : jobs en retard >2 min non claimés → Edge Function → email Brevo). pg_cron trop fragile pour publier, parfait pour surveiller.
- Rate limiting PAR social_account : IG `content_publishing_limit` avant chaque post ; FB header BUC ; TikTok compteur local.

### 3.3 Stockage médias — réponse formelle à la question ouverte n°1

**Décision : 100 % Supabase Storage. R2/B2/S3 écartés** — le plan Pro (25 $/mois, **requis de toute façon : le Free plafonne à 50 MB/fichier, incompatible Reels ≤300 MB**) inclut 100 GB stockage + 250 GB egress ≈ 10× le besoin (~3–10 GB en régime permanent) → l'« egress gratuit » de R2 vaut 0 €, et R2 coûterait un 2e fournisseur sans RLS ni TUS. Seuil de réexamen : egress >250 GB/mois soutenu.

- **2 buckets** : `media-originals` PRIVÉ (300 MB max, jpeg/png/mp4/mov) — exposition uniquement par **URL signée TTL 48h** générée par le worker à la publication (satisfait le « publicly accessible at the time of the attempt » de Meta ; jamais de bucket public pour du contenu client non publié) ; `media-thumbs` (vignettes ~400px WebP — public recommandé pour le cache, à arbitrer).
- **Chemins = mécanisme d'isolation** : `{org_id}/{client_id}/{content_item_id}/{media_asset_id}/…` ; policies storage.objects via `storage.foldername()`. À poser avant le premier upload.
- **Miniatures côté client à l'upload** (canvas/createImageBitmap → WebP ; frame vidéo via `<video>` seek) — PAS les transformations Supabase (Pro-only, $5/1000, **pas de support vidéo** alors que la grille affiche des vignettes de Reels). La miniature persiste après purge de l'original = l'« historique léger » du §7.3.
- **Rétention (pas de lifecycle natif Supabase — confirmé)** : pg_cron quotidien → Edge Function `media-cleanup` (suppression par l'API Storage par lots de 100, **jamais DELETE SQL sur storage.objects** — fichiers orphelins). Original purgé **J+7 après publication, SEULEMENT si tous les publish_jobs de l'asset sont terminaux** (un contenu multi-plateforme peut attendre TikTok). Contenus jamais publiés : purge à 180 j d'inactivité (à valider).
- **Upload mobile** : TUS resumable (Uppy), **chunks exactement 6 MB**, endpoint direct `<project>.storage.supabase.co/storage/v1/upload/resumable`, URL d'upload valide 24h.
- **Conversions obligatoires** : IG = JPEG uniquement ≤8 MB, ratio 4:5–1.91:1 (conversion PNG/HEIC côté client, attention HEIC iPhone) ; Reels = MP4/MOV **moov atom en tête (faststart)**, 3 s–15 min, ≤300 MB.

### 3.4 PWA mobile

- **Service worker : Serwist via `@serwist/turbopack`** (Next 16 = Turbopack par défaut ; ne pas forcer `--webpack`).
- **Web Push** : payload **double format** — Declarative Web Push (`"web_push": 8030`, iOS 18.4+, sans dépendance SW) + handler `push` classique pour Android. iOS exige toujours l'installation écran d'accueil (inchangé iOS 26) → onboarding d'installation iOS soigné dès le Lot 0. **Triple canal** : push + Realtime in-app + email Brevo sur échec (canal garanti).
- **⚠️ Piège n°1 (Lot 0) : magic link sur PWA iOS** — le lien ouvert depuis Mail crée la session dans Safari, PAS dans la PWA installée (stockage séparé) → déconnexion en boucle. **Parade : OTP 6 chiffres (`signInWithOtp`/`verifyOtp`) sur mobile.** Décision d'auth transverse à prendre avant le Lot 0.
- **Web Share Target** (partager une photo de la galerie vers le studio) : **Android uniquement** (Chromium ; WebKit ne le supporte pas). Le SW intercepte le POST, stocke en IndexedDB, redirect 303. Fallback iOS : FAB « Nouveau contenu » → picker Photos natif (~1 tap de plus). Vrai share-sheet iOS = natif V2.
- **Offline minimal** : lecture (calendrier, dashboard, liste + thumbs) via persister TanStack Query + IndexedDB ; file d'upload ; **jamais de publication offline**. Background Sync = Android only. Wake Lock pendant l'upload. Le SW ne cache JAMAIS /auth/v1/* ni les POST (allowlist explicite — sinon fuite de données post-logout).
- **Impossible en PWA (cadrage V2 natif)** : partage galerie iOS, upload écran verrouillé iOS, push iOS sans installation.

### 3.5 Intégration agendas

- **OAuth custom (Route Handlers), PAS Supabase Auth** : `linkIdentity` lierait chaque compte Google d'agenda comme **identité de connexion** (un compte Google « client » pourrait ouvrir la session !), le multi-comptes même provider n'est pas supporté, et Supabase ne stocke/rafraîchit pas les provider tokens de toute façon. Une seule abstraction `IntegrationOAuthProvider` partagée avec Meta/TikTok (souhait §12 du PRD).
- **Tokens : Supabase Vault** (clés hors base, backups chiffrés ; pgsodium direct en pending deprecation). Alternative AES-GCM applicatif si self-host envisagé — à trancher avant la migration 001.
- Google : `access_type=offline` + `prompt=consent` (sinon pas de refresh token aux connexions suivantes) ; identifier par `sub` (jamais l'email) ; **max 100 refresh tokens par compte/client_id** (le plus ancien révoqué silencieusement). Microsoft : flow confidential web app (jamais SPA), **rotation du refresh token à chaque échange** → remplacement sous verrou FOR UPDATE.
- **Sync : cache local en tables + « refetch fenêtré »** ([-30 j, +180 j], cron 15 min via pg_cron→pgmq→Route Handler sur Coolify, sync-on-open débouncée 2 min) plutôt que syncToken strict (incompatible timeMin/timeMax → expansion RRULE locale, surdimensionné en solo). Récurrences déléguées aux providers (`singleEvents=true` / `calendarView`). Sweep par `last_sync_run_id` obligatoire (suppressions sans tombstones). All-day Google = date-only + flag (jamais convertis UTC). Graph : `$top` explicite + suivre `@odata.nextLink` + `Prefer: outlook.timezone="UTC"`.
- **Vue unifiée** : vue Postgres `unified_agenda` en `security_invoker` — UNION ALL calendar_events (calendriers `is_enabled`) + content_items planifiés. Pas de duplication des ContentItems. Toggle par calendrier dès le MVP (évite le bruit « Jours fériés »).
- Déconnexion propre : révocation Google (`POST /revoke`), suppression vault.secrets, cascade.

---

## 4. Revue critique du PRD — gaps à traiter

### Bloquants (à trancher avant Lot 0/1)

1. **Entité ContentTarget manquante** — LE point structurant. Un ContentItem multi-plateformes n'a qu'un statut global : que vaut-il si IG réussit et FB échoue ? Introduire `content_targets` (plateforme, social_account, **statut par plateforme**, ID externe du post publié, permalink, horodatage, variante de légende V2) + statut global agrégé (`partially_published`). PublishJob porte l'exécution technique, ContentTarget l'état métier.
2. **Fuseaux horaires absents** — convention recommandée : saisie/affichage en TZ du client pour le contenu, TZ du freelance pour l'agenda unifié, stockage UTC `timestamptz`. `Client.timezone` absent du modèle §6.
3. **Machine à états incomplète/contradictoire** — `changes_requested` : statut persistant (§6) ou transition vers draft (Module F) ? Choisir (recommandé : statut persistant, plus lisible). **Chemin `draft → scheduled` direct manquant** : la validation client doit être OPTIONNELLE (par contenu ou par client). Définir la matrice de transitions complète (annuler un scheduled, éditer un approved → approbation invalidée, sortir de failed).
4. **Sémantique du drag & drop** — tranchée en §5 Q3 (permutation des dates).
5. **Import du feed IG existant** — la promesse de la grille (« juger l'harmonie ») est vide si elle ne montre que les posts créés dans l'app. Recommandé : import via `GET /media` à la connexion du compte + sync périodique (posts « importés » sans ContentItem complet — entité légère dédiée).
6. **Module Notifications inexistant** — cité partout (Module E, §7.4, §10, §12, Lot 2), spécifié nulle part. NB : le « Module Médias » est lui aussi référencé (Module B) mais jamais défini. Spécifier un **Module I — Notifications** : matrice événement × canal (in-app Realtime / push / email Brevo) × rôle. Incohérence : §4 met « notifications email au client » en V2 mais le Parcours 2 MVP commence par un email d'invitation → Brevo requis dès le Lot 3.
7. **Approbation tardive / date dépassée** — un `in_review` dont la date passe (alerte J-1 ?) ; le client approuve après la date → recommandé : **retour à l'admin pour choisir une nouvelle date** (jamais de publication immédiate automatique).

### Importants (avant le lot concerné)

- **Specs médias par plateforme** (validation à l'upload, conversion auto, messages d'erreur AVANT programmation) — Lot 1.
- **Statut TikTok post-push** : ni scheduled ni published → ajouter `pushed_to_platform` + réconciliation manuelle + relance si brouillon jamais finalisé — Lot 2.
- **Onboarding connexion de comptes sociaux** non spécifié (qui fait l'OAuth, sélection de la Page/compte parmi les accessibles, rattachement au Client) + **health check proactif des tokens** (détecter avant l'heure H, pas à l'heure H) — Lot 2.
- **Entité PlatformConnection** (niveau User/Org) dont dérivent les SocialAccounts : une révocation Facebook du freelance casse N clients — à représenter — Lot 2.
- **Portail client** : plusieurs reviewers en désaccord (règle de résolution), périmètre exact de visibilité, **versioning de l'approbation** (le client a approuvé QUELLE version ? → approbation invalidée/périmée si modification après coup ; table `approvals` insert-only = preuve) — Lot 3.
- **« Annotations » indéfinies** — recommandé MVP : pin (x,y) + commentaire par slide ; pas d'annotation vidéo (commentaire simple) — Lot 3.
- **Entité ReviewRequest/Batch** (envoi « par lot » sans objet correspondant) — Lot 3.
- **Offboarding client** (archivage vs suppression, soft-delete `archived_at`, conservation des preuves d'approbation, annulation des jobs, révocation tokens) — schéma au Lot 0, flux UI plus tard.
- **Fenêtre de grâce du worker** (publier avec 2h de retard ou marquer failed ?) — à définir, Lot 2.

### Mineurs / backlog
Définition des « tâches du jour » du dashboard ; recherche full-text ; audit log généralisé (au-delà des approbations) ; « temps réel » du Module F = Realtime Supabase (déjà dans la stack, coût faible) ; nettoyage terminologique (V1.5 non défini, Owner vs Admin, prérequis dev/prod mélangés au §7.1, champs newsletter jamais spécifiés).

### Edge cases recensés (26)
Liste complète conservée dans le transcript du workflow ; les plus critiques sont intégrés ci-dessus (publication partielle, approbation tardive, double publication, token révoqué à l'heure H, conteneur vidéo en retard, quota atteint, drag & drop vs posts publiés, stories hors grille, post supprimé côté IG, média purgé puis retry, DST, deux reviewers en désaccord, compte repassé en « Personnel »).

---

## 5. Réponses aux 7 questions ouvertes (§13 du PRD)

| # | Question | Recommandation |
|---|---|---|
| 1 | Médias : stockage objet + suppression auto ? | **OUI, mais Supabase Storage** (pas R2) : bucket privé + URL signée 48h + purge pg_cron J+7 (si tous les jobs terminaux) + miniatures persistantes générées côté client. Détail en §3.3. |
| 2 | Accès client : lien magique ou compte léger ? | **Les deux à la fois via Supabase Auth** : invitation `inviteUserByEmail` → vrai compte sans mot de passe → connexions via `signInWithOtp` (`shouldCreateUser: false`). UX perçue = lien magique ; côté base un vrai `auth.uid()` porte la RLS et la **valeur de preuve des approbations**. Option code OTP dans le même email (scanners de liens des messageries d'entreprise). Jamais de lien public signé non authentifié. |
| 3 | Drag & drop : dates ou champ d'ordre ? | **Réordonne les DATES** (permutation des créneaux existants). Le champ d'ordre indépendant produit une grille qui MENT (l'ordre réel d'un feed IG = l'heure de publication, point). Règles : posts publiés = zone verrouillée en queue ; aperçu + confirmation avant commit ; drafts sans date dans une étagère latérale (date interpolée 9h–21h TZ client) ; permutations journalisées. C'est le modèle Later/Planoly. |
| 4 | TikTok : brouillon ou notification ? | **Mode brouillon** (MEDIA_UPLOAD). La « simple notification » existe déjà gratuitement = canal « Sur mesure » → c'est le fallback à coût zéro. Construire l'OAuth+upload TikTok au MVP dé-risque la V2 (l'audit exige une app finie). ⚠️ Avec la correction §2.3 : revue d'app TikTok à soumettre dès le début du Lot 2. |
| 5 | Newsletter V2 : quel ESP ? | **Brevo, ferme et sans étude** : déjà l'ESP canonique de la stack, API campagnes complète (`POST /v3/emailCampaigns`), français/UE (RGPD), l'ESP le plus probable chez les clients finaux FR. Abstraction `NewsletterProvider` prévue, aucun travail spéculatif. |
| 6 | Écriture agenda deux sens ? | **Lecture seule au MVP**, écriture en V1.5/V2 (entérine le PRD). Scopes minimaux (`calendar.events.readonly`, `Calendars.Read`) → vérifications Google/Microsoft plus légères. Stocker les scopes accordés par compte pour une montée de privilèges par re-consentement incrémental. |
| 7 | Nom du produit ? | **« Ocean » déconseillé en nom commercial** (Mediaocean = même champ sémantique, DigitalOcean, mot générique anglais imprononçable en SEO, et « océan » = l'immensité subie, l'anti-promesse du poste de pilotage). OK comme codename. Pistes filant la métaphore maritime côté MAÎTRISE : **Vigie**, **Timonerie/Timonier**, **Passerelle**, **Cap**. Vérifier INPI/EUIPO (classes 9, 35, 42) + domaines + handles avant d'acter. Décision humaine. |

---

## 6. Décisions — ACTÉES par Etienne le 11 juin 2026

| # | Décision | Choix |
|---|---|---|
| 1 | Nom du produit | **« Ocean » conservé** (contre la recommandation — assumer le risque Mediaocean/SEO). ⚠️ Vérification INPI/EUIPO (classes 9, 35, 42) + domaine + handles **avant le lancement commercial**. |
| 2 | Validation client | **Optionnelle par contenu** : chemin direct `draft → scheduled` autorisé ; l'admin décide d'envoyer en revue contenu par contenu. La machine à états doit intégrer cette bifurcation. |
| 3 | Import du feed IG existant | **Oui, au MVP** (Lot 1) : `GET /media` à la connexion du compte + sync périodique, posts importés en lecture seule (entité légère). |
| 4 | Auth mobile | **OTP 6 chiffres sur mobile** (`signInWithOtp`/`verifyOtp`), magic link conservé sur desktop. À implémenter dès le Lot 0. |
| 5 | Quota IG atteint | **Report automatique** au prochain créneau disponible + notification du décalage. |
| 6 | Fenêtre de grâce du worker | **Publier si < 2h de retard** ; au-delà : échec + notification, l'admin choisit une nouvelle date. |
| 7 | Rétention des originaux | **J+7 après publication** (si tous les publish_jobs terminaux) ; purge des jamais-publiés à 180 j d'inactivité. |
| 8 | Plan Supabase Pro | **Le plus tard possible** — dev sur Free. ⚠️ **Garde-fou obligatoire** : item de checklist bloquant au Lot 2 « passer en Pro AVANT le premier test de Reel » (le Free plafonne à 50 MB/fichier → les uploads de Reels échoueraient de façon incompréhensible). |
| 9 | Bucket miniatures | **Public** (vignettes ~400px, URLs stables, cache optimal). |
| 10 | Chiffrement des tokens OAuth | **Supabase Vault**. |
| 11 | Téléphone d'Etienne | **iPhone** → priorités PWA : onboarding d'installation iOS soigné dès le Lot 0, OTP (cf. n°4), Web Push déclaratif iOS, fallback FAB + picker Photos (pas de Share Target). Le parcours Android passe en second plan pendant la phase solo. |

---

## 7. Impacts sur la roadmap (§11 du PRD)

| Lot | Ajouts/corrections issus de l'analyse |
|---|---|
| **Lot 0** | + Décision OTP mobile (piège PWA iOS) ; + schéma avec ContentTarget, content de soft-delete, entité Notification ; + FK composites & helpers RLS ; + manifest PWA/installation iOS ; + créer l'app Meta **type Business/use cases** (pas Consumer). |
| **Lot 1** | + Specs médias & validation upload (conversion JPEG/HEIC, ratios) ; + miniatures côté client ; + machine à états complète ; + TZ par client ; + import du feed IG existant (si validé). |
| **Lot 2** | + **Spike n°1 visibilité Meta** (premier jour) ; + **soumettre la revue d'app TikTok immédiatement** (délai parallèle au dev) ; + **Spike n°2 brouillon photo TikTok** ; + plan Supabase Pro ; + worker SKIP LOCKED + watchdog ; + refresh tokens ; + Module Notifications (triple canal). |
| **Lot 3** | + Invitations Brevo (email transactionnel dès ce lot) ; + versioning des approbations (insert-only) ; + entité ReviewRequest ; + annotations = pin (x,y) MVP. |
| **Lot 4** | + **Lancer la vérification Google « sensible » tôt** (gratuite, ~10 j — sinon reconnexion hebdo) ; + scopes granulaires ; + toggle par calendrier. |
| **V2 (à ajouter au §12)** | App Review Meta + audit TikTok Direct Post + **vérification Google** + **admin consent & publisher verification Microsoft** ; nouvelles métriques insights (dépréciation v26.0) ; custom domain Supabase si carrousels photo TikTok. |

---

*Document généré le 11 juin 2026 à partir du workflow `ocean-prd-launch-analysis` (run wf_f7d4cc87-ad4). Le PRD v0.1 reste la référence fonctionnelle ; ce document le complète et le corrige sur les points cités.*
