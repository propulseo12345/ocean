# Audit — Backend Systems : contrats de données & surface de câblage Supabase (2026-07-07)

## Verdict

La dimension est **saine sur les fondamentaux du swap** (100 % des pages sont des Server Components `async`, une façade unique `lib/mocks/index.ts` sert de seam de branchement, les enums de statuts recoupent fidèlement le PRD §6) mais **porte une dette de contrat structurelle qui, si elle n'est pas soldée au design du schéma, force une réécriture UI au câblage** — exactement ce que la phase preview devait éviter (CLAUDE.md §0). Le risque principal n'est **pas** un crash présent (mono-tenant mock, aucun backend, tout est déterministe et figé via `MOCK_NOW`) : c'est un **écart silencieux entre la forme des mocks et la forme des tables cibles**. Trois classes de problèmes dominent : (1) **le tenant est absent du contrat** — aucune entité ne porte `org_id`, aucune page ne thread un `getActiveOrg()`, et la defense-in-depth §2.7 (filtre `org_id` explicite) n'est donc outillée nulle part ; (2) **des entités riches déjà consommées par l'UI n'ont aucune table cible au PRD §6** (médiathèque réutilisable, piliers, hashtags, brand kit, vues, labels, créneaux récurrents, notes client) — les découvrir au câblage viole la règle « toute table métier a `org_id` dès sa création » (§8) ; (3) **des divergences de forme jsonb/enum/topologie** (annotation `slideIndex` vs `{media_asset_id,x,y}`, agenda incluant `approved`, calendrier aplati à 2 niveaux, quotas mono-limite, labels FR bruts filtrés contre le libellé localisé) produisent soit des régressions visuelles au branchement de la vraie vue/table, soit un bug déjà observable en anglais. Aucun de ces points ne bloque la mise en ligne de la maquette ; **tous doivent être tranchés au niveau schéma AVANT le Lot média / worker**, pas au câblage.

## Fonctionnement réel observé

**Le seam de branchement.** `apps/web/lib/mocks/index.ts` est une façade barrel : elle re-exporte les 22 modules de mocks + les enums/types DB (`export * from "./types"`) et définit ~20 getters synchrones (`getClients`, `getContentItem`, `getComments`, `getApprovals`, `getUnifiedAgenda`, `getPortalContent`…). C'est LE point unique que le câblage Supabase remplacera : chaque `getX(): T[]` devient une requête `await supabase.from(...)`. C'est un bon découpage — tant que la signature et la forme de `T` restent stables, l'UI ne bouge pas.

**Résolution tenant = néant.** `grep org_id|orgId|getActiveOrg|active_org_id` sur tout `apps/web` = **0 occurrence**. Le modèle mock ne connaît qu'UNE org implicite (`ORG = org_marea`, `clients.ts:5`), jamais threadée. Les getters résolvent par id brut sur des tableaux globaux : `getContentItem(id)` = `CONTENT_ITEMS.find(c => c.id === id)` (`index.ts:59-61`), sans filtre client/org. Les pages compensent par une garde UI (`content.clientId !== clientId → notFound`, `content/[contentId]/page.tsx:59` ; portail `[contentId]/page.tsx:40`), mais les getters enfants (`getComments`/`getApprovals`/`getContentVersions`/`getActivityEntries`, `page.tsx:66-69`) ne re-scopent rien — ils font confiance au `contentId`.

**Data flow des pages.** Le bon pattern domine : `content/new/page.tsx:59-89` (Server Component) appelle les getters côté serveur et passe un objet `ComposerData` en prop au `"use client"` `ComposerScreen` → survivra intact au câblage. Le **shell persistant fait exception** : 7 composants `"use client"` appellent les getters de données directement au rendu — `command-palette.tsx:20+54` (`getClients`/`getContentItems`), `notifications-button.tsx:9+17` (`getNotifications`/`getUnreadCount`), `client-health-banner.tsx:10+23` (`getContentItems(clientId)`), `app-sidebar.tsx:21`, `client-switcher.tsx:17`, `quick-capture.tsx:27`, `nav-user.tsx:26` (`CURRENT_USER`).

**Touchpoints worker (état métier vs technique).** Le mock modélise correctement la séparation ContentItem (statut global) / ContentTarget (statut par plateforme + `externalPostId`/`permalink`) : `content.ts:110-123` (`buildTargets`) pose `externalPostId: ${platform}_${contentId}`. Les statuts `pushed_to_platform` (TikTok brouillon), `partially_published`, `awaiting_manual` sont présents (`core.ts:18-41`) et pilotent le dashboard (`index.ts:194` détecte les brouillons TikTok, `:179` les échecs). Mais **rien du cycle de vie technique du PublishJob** (idempotence `publish_started_at`, lease, `ig_container_id`, `error_history`) n'existe côté front — c'est légitime (100 % worker/backend), sauf là où l'UI a besoin de connaître un état métier dérivé (ex. `deleted_externally`, `original_deleted_at`).

**Quotas.** `PLATFORM_QUOTAS` (`quotas.ts:11-16`) = **une** limite par plateforme (IG 100 / FB 30 / TikTok 5) ; `getQuotaUsage` (`:60-70`) retourne un unique couple `{used, limit, windowKey}`. `mockUsage` (`:41-53`) ne compte que les Reels pour Facebook. L'enforcement réel (worker/DB, source de vérité par CLAUDE.md §6) manipulera plusieurs compteurs par compte (IG 100 posts + 400 conteneurs ; FB BUC 4800 + 30 Reels).

**Agenda unifié.** `getUnifiedAgenda` (`index.ts:114-130`) unit les `CALENDAR_EVENTS` actifs et les `CONTENT_ITEMS` dont `status ∈ {scheduled, approved, publishing}` avec un `scheduledAt` (`AGENDA_PUBLISH`, `:112`). La vue cible actée `unified_agenda` (PRD §6 l.331, ANALYSE §3.5) = `UNION events + content_items PLANIFIÉS`. Le calendrier est aplati : `CalendarEvent` porte `calendarName`/`colorVar`/`enabled` sur chaque event (`core.ts:187-199`), le composant re-dérive la liste des calendriers par `groupBy(calendarKey(e.calendarName))` (`unified-agenda.tsx:23-37`) — le niveau `calendar_calendars` du PRD §6 (l.447) n'existe pas comme entité.

---

## Findings (triés par sévérité P0 → P3)

> Aucun **P0** n'a survécu à la vérification : pas de backend, mono-tenant mock, aucune fuite/double-publication/perte de données possible aujourd'hui. Les deux findings « seam tenant » ont été réconciliés en P2 (dette de forme du seam, impact prospectif conditionné au câblage, pas d'exploit vivant).

### [P1] Médiathèque réutilisable (`LibraryAsset`) : entité UI-inventée sans table ni bucket au PRD §6

- **Où** : `apps/web/lib/mocks/library.ts:77-114` + `apps/web/lib/mocks/types/library.ts:9-28` ; usages `components/app/library/asset-details.tsx:29-51,98-121`
- **Constat** : `LibraryAsset { clientId, type, thumbUrl, fullUrl, source: upload|depot_client|import, usedInContentIds[], … }` est une médiathèque de premier plan (page `/library` + media-picker du composer). Le PRD §6 ne connaît que `media_assets` **SOUS un content_item** (l.436, avec `position`/`storage_path`/`expires_at` — cycle de vie lié à la publication, original purgé J+7) et `imported_posts` (l.429). Il n'existe **NI table `media_library` NI bucket** pour des assets réutilisables détachés d'un contenu. `usedInContentIds` est **calculé** (`library.ts:83-85`) en comparant `m.thumbUrl === url` — une jointure par URL, pas par id.
- **Scénario d'échec / coût à l'échelle** : au branchement, aucune requête Supabase ne peut renvoyer un `LibraryAsset` : un asset « inédit » (`usedInContentIds: []`) n'a pas de content_item parent, pas de `position`, pas de publication → il ne peut pas être une ligne `media_assets` telle que spécifiée. `/library` et le media-picker n'ont pas de source back. Le rapprochement usage par égalité d'URL devient ingérable dès qu'un visuel a une URL signée qui tourne (48 h).
- **Pourquoi ça bloque le scaling** : un client avec des centaines d'assets réutilisés sur des années exige une FK indexée (`media_asset_id`), pas une comparaison de chaînes recalculée à chaque rendu. Sans décision schéma (table dédiée OU `media_assets` détaché + table de jonction `content_media` + chemin bucket `{org_id}/{client_id}/library/…`), une fonctionnalité **validée dans la maquette** n'a pas de home backend.
- **Reco** : acter au niveau PRD §6 une entité média réutilisable + son bucket, remplacer `usedInContentIds` calculé par une relation persistée, documenter `source` comme colonne. À trancher **avant le Lot média**.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.436 (`media_assets` fille de content_items uniquement) + §5 Module J (2 buckets, aucun pour médiathèque réutilisable)

### [P1] `Annotation.slideIndex` absent du jsonb acté `comments.annotation {media_asset_id, x, y}`

- **Où** : `apps/web/lib/mocks/types/collab.ts:28-33` ; `interactions.ts:31,65` (`slideIndex: 0`) ; consommé `components/portal/annotation-viewer.tsx:26,30`, `components/app/studio/content-detail-media.tsx:43`, `components/app/studio/detail-thread-items.tsx:48`
- **Constat** : l'annotation UI = `{ mediaAssetId, slideIndex, x, y }`. Le PRD §6 l.438 définit `annotation jsonb {media_asset_id, x, y}` — **sans `slideIndex`**. Or `slideIndex` est load-bearing : `annotation-viewer.tsx:26` filtre `slidePins = pinned.filter(c => (c.annotation?.slideIndex ?? 0) === slideIndex)`, `:30` saute au bon slide, `detail-thread-items.tsx:48` affiche `slideIndex + 1`. `media_asset_id` n'est **jamais** lu pour rattacher la pin au slide.
- **Scénario d'échec / coût à l'échelle** : si le jsonb est matérialisé strictement selon le PRD, `annotation.slideIndex === undefined` → les deux `?? 0` (viewer:26, media:43) rabattent **toute** pin sur le slide 0 (une pin posée sur le slide 3 d'un carrousel s'affiche sur le slide 1), `setSlideIndex(undefined)` (viewer:30), et `slideIndex + 1` (thread:48) affiche `NaN`. Perte silencieuse de l'ancrage par slide — cœur de la valeur « annotation pin par slide » (PRD §5.F l.298).
- **Pourquoi ça bloque le scaling** : l'annotation est une preuve de validation client (approbation versionnée, valeur d'audit). Un désalignement jsonb entre ce que l'UI écrit/lit et ce que la migration crée fait diverger les pins dès le premier carrousel multi-slides en prod, sans erreur visible.
- **Reco** : trancher le contrat jsonb **avant d'écrire la migration `comments`** — soit inclure `slide_index` (recommandé, l'UI en dépend), soit dériver la slide depuis `media_assets.position` du `media_asset_id` (et calculer l'index à la volée, ne pas le stocker : deux sources de position peuvent se contredire au réordonnancement). Aligner `types/collab.ts` sur la forme retenue.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non (mock aujourd'hui ; comportement faux au câblage naïf)   **Verrou PRD/CLAUDE.md** : PRD §6 l.438 + §5.F l.298

### [P2] Aucune entité mock ne porte `org_id` : le tenant est absent de tout le contrat de données front

- **Où** : `apps/web/lib/mocks/types/core.ts:66,84,102,132,144` (Client/SocialAccount/ImportedPost/ContentTarget/ContentItem) + `collab.ts:7,18,35,47,60` + `pro.ts` + `library.ts`
- **Constat** : `grep orgId|org_id` sur tout `lib/mocks` = **0**. Aucun type métier n'a `org_id` ; le mock ne modélise qu'une org implicite (`ORG = org_marea`, `clients.ts:5`). Les filles de Client portent `clientId` mais jamais `orgId`. Or CLAUDE.md §2.1 impose `org_id uuid NOT NULL DÉNORMALISÉ` sur 100 % des tables métier, et §2.7 impose un filtre `org_id` **explicite** dans le code EN PLUS de la RLS (defense in depth).
- **Scénario d'échec / coût à l'échelle** : au câblage, chaque row supabase-js portera `org_id`. Les composants continueront de compiler, mais **aucune Server Action générée à partir de ces types n'aura le réflexe d'injecter `org_id`** — la defense-in-depth §2.7 n'est outillée nulle part. Le risque n'est pas un crash mais une query sans filtre explicite qui passe en revue de code parce que le type ne l'exige pas.
- **Pourquoi ça bloque le scaling** : c'est LE contrat qui rend le swap sûr. Tant que `org_id` n'est pas dans les types partagés, chaque nouvelle Server Action réinvente l'injection à la main → dérive garantie sur des dizaines d'actions. Ajouter `org_id` après coup = toucher les 24 fichiers mocks + tous les points de construction.
- **Reco** : introduire un type de base `{ orgId: string }` (et `{ orgId, clientId }` pour les filles de Client) dans `packages/shared`, dont héritent Client/ContentItem/ContentTarget/SocialAccount/etc. Le peupler avec `ORG.id`. Le jour du câblage, le type **exige** `org_id` → toute Server Action/insert qui l'omet ne compile pas : la defense-in-depth devient structurelle, pas disciplinaire.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2.1, §2.7 ; PRD §6 invariants structurels

### [P2] Le contexte tenant (`getActiveOrg` / cookie `active_org_id`) n'est threadé dans aucune page ; chaque lecture est un scan global par id brut

- **Où** : `apps/web/lib/mocks/index.ts:44-96` (getters résolvent par id sans org) ; consommateurs `content/[contentId]/page.tsx:57-59`, `portal/[contentId]/page.tsx:37-40`, `clients/[clientId]/layout.tsx:23-24` ; `grep getActiveOrg|active_org_id = 0`
- **Constat** : `getContentItem(id)` (`index.ts:59`) fait `.find(c => c.id === id)` sur un tableau global. `getComments`/`getApprovals`/`getContentVersions`/`getActivityEntries` (`page.tsx:66-69`) ne re-vérifient rien : ils font confiance au `contentId`. Le seam `getActiveOrg()` imposé par CLAUDE.md §3 n'existe nulle part, et le cookie httpOnly `active_org_id` (§2.10) n'est lu par personne.
- **Scénario d'échec / coût à l'échelle** : au câblage, il faut insérer ce contexte en tête de CHAQUE page (23 pages) et de chaque Server Action, et transformer chaque `getX(id)` en `getX(id, orgId)`/`getX(id, clientId)`. Un `getComments(contentId)` laissé tel quel devient une query non scopée — fuite inter-tenant SI la RLS a un trou. (Nuance honnête : aujourd'hui la garde de tête `!== clientId` prouve déjà l'appartenance, et il n'existe encore aucun `"use server"` ; en prod, la frontière PRIMAIRE est la RLS, `getActiveOrg` n'étant que la defense-in-depth secondaire.)
- **Pourquoi ça bloque le scaling** : à mesure que les tables et pages se multiplient, l'absence d'un helper d'org-context central signifie que la garde tenant est réinventée ad hoc, parfois oubliée — l'anti-pattern « query sans filtre `org_id` » (§8). Un seul oubli sur la durée = incident RGPD.
- **Reco** : introduire dès maintenant le seam `getActiveOrg()` (stub renvoyant `ORG` + rôle owner) appelé en première ligne de chaque page (app) + `getReviewerContext()` pour le portail. Faire transiter `clientId`/`orgId` dans TOUTES les signatures de getters même en phase mock, pour que le branchement Supabase ne touche que le corps. Remplacer les gardes `!== clientId` par une résolution scopée (le getter ne renvoie déjà que ce qui appartient au tenant).
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2.1/§2.7/§2.10, §3, §7

### [P2] Piliers, hashtags, brand kit, vues enregistrées : 4 entités org/client-level absentes du schéma §6, déjà consommées par 20+ écrans

- **Où** : `apps/web/lib/mocks/pillars.ts:17-46`, `hashtags.ts:6-77`, `brand.ts:6-110`, `views.ts:5-48` ; types `pro.ts:8-71`
- **Constat** : `ContentPillar { clientId, name, colorVar, targetShare }`, `HashtagGroup`, `BrandKit { …, bannedWords }`, `SavedView` sont des entités riches, référencées par `content_items` via `pillarId` (`core.ts:166`) et par `lib/caption.ts:93-95` (`findBannedWords`). `grep pillar|pilier|targetShare|content_pillars|hashtag_groups|brand_kits|saved_views` sur le PRD = **0** dans le schéma §6 (l.418-449). Les hashtags n'apparaissent qu'en colonne V2 (l.94).
- **Scénario d'échec / coût à l'échelle** : `content_items.pillarId` est une FK vers une table `content_pillars` qui n'existe pas au schéma → soit on l'invente à la volée sans les invariants multi-tenant (`org_id` dénormalisé, FK composite `UNIQUE(id, client_id)`), soit la fonctionnalité pilier/brand kit/vue reste mockée alors que l'UI l'expose comme réelle. `BrandKit`/`SavedView` pourraient tenir en jsonb sur `clients`, mais `ContentPillar` **ne peut pas** : c'est une cible de FK composite référencée par id stable depuis deux entités et groupée/filtrée sur de nombreux écrans.
- **Pourquoi ça bloque le scaling** : 4 tables filles de Client à créer avec RLS + FK composites + leak tests pgTAP (§2, §7). Les découvrir au câblage fait sauter la règle « toute table métier a `org_id` dès sa création » et risque des tables ajoutées après coup sans policies — l'anti-pattern §8. `targetShare` (mix éditorial) et `bannedWords` (garde-fou légende) doivent être versionnés proprement.
- **Reco** : étendre le schéma §6 avec `content_pillars`, `hashtag_groups`, `brand_kits`, `saved_views` (toutes filles de `clients` : `org_id` NOT NULL + `client_id` + FK composite + RLS helpers `private.*`), les typer en miroir dans `packages/shared`, écrire les leak tests dès la migration. À trancher au **design du schéma**, pas au câblage.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.418-449 ; CLAUDE.md §2 règles 1-3, §7

### [P2] `recurring_slots` et `client_events` : deux entités du calendrier éditorial sans table cible au §6

- **Où** : `apps/web/lib/mocks/planning.ts:147-160` (`RECURRING_SLOTS`), `:109-121` (`CLIENT_EVENTS`) ; types `pro.ts:21-40`
- **Constat** : `RecurringSlot { clientId, weekday, time, platforms, pillarId }` et `ClientEvent` (notes/événements datés) sont consommés par le calendrier : `use-calendar-state.ts:82-98` (`addNote` pousse un `ClientEvent` éphémère), `components/app/client-settings/section-slots.tsx:26-50` (add/patch/remove complet de `RecurringSlot`). Le schéma §6 (l.418-449) ne contient NI `recurring_slots` NI `client_events`. Le PRD §4 l.96 marque « modèles récurrents » comme **V2**.
- **Scénario d'échec / coût à l'échelle** : au câblage du calendrier, ces surfaces (ajout de note, gestion des créneaux) n'ont aucune table à écrire — leur état est purement local et n'a nulle part où persister. Soit on livre une UI qui ne persiste rien, soit on improvise deux tables non spécifiées (donc sans RLS/`org_id`/FK composites pensés) en urgence.
- **Pourquoi ça bloque le scaling** : les créneaux récurrents sont un levier de productivité multi-clients (auto-remplissage). Le trou est une décision de périmètre PRD + au plus deux tables boilerplate — mais le subir au câblage (aller-retour PRD→migration→RLS→pgTAP en pleine phase backend) contredit le fil rouge « brancher sans réécrire ». Note : `recurring_slots` absent du MVP est arguablement **correct** puisque §4 le classe V2 — le mock est en avance sur la roadmap actée.
- **Reco** : trancher explicitement au §6 : soit ajouter `recurring_slots` + `client_events` (org_id + client_id + FK composites), soit marquer ces surfaces UI-only/Post-MVP et griser les actions en preview. Ne pas laisser deux entités mockées consommées par l'UI sans destination décidée.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.418-449 (aucune table) ; CLAUDE.md §2 (invariants table métier)

### [P2] `MediaAsset` mock ne modélise pas le cycle de vie storage (`storage_path`, `thumb_path`, `expires_at`, `original_deleted_at`)

- **Où** : `apps/web/lib/mocks/types/core.ts:115-130`
- **Constat** : `MediaAsset` = `{id, type, thumbUrl, fullUrl, width, height, durationSec, position, altText, fileSizeMb, mimeType}`. Le PRD §6 l.436-437 impose `storage_path`, `thumb_path`, `expires_at`, `original_deleted_at`. `thumbUrl`/`fullUrl` sont des URLs Pexels absolues **identiques** (`content.ts:51-52` pose `thumbUrl: url, fullUrl: url`) — le mock ne sépare même pas la vignette persistante de l'original éphémère. `fullUrl` est consommé comme src d'image permanente dans 5 fichiers (`media-carousel.tsx:40`, `asset-sheet.tsx:67`, `detail-preview-media.tsx:34`, `composer-preview.tsx:78`, `media-crop-dialog.tsx:88`).
- **Scénario d'échec / coût à l'échelle** : au câblage Storage, `media-originals` est privé, exposé UNIQUEMENT par URL signée 48 h générée par le worker à la publication (§20). Un composant qui lit `media.fullUrl` comme URL utilisable en permanence suppose un accès direct qui n'existera jamais. La distinction thumb-persistant / original-éphémère n'est pas dans le type → l'UI ne sait pas qu'un original peut avoir été purgé (`original_deleted_at`) et qu'il faut re-uploader avant retry (PRD §5.B l.173/189, Module J).
- **Pourquoi ça bloque le scaling** : la rétention J+7 et les URL signées sont le cœur du modèle coût/RGPD (PRD §10 minimisation). Une UI qui ignore `expires_at`/`original_deleted_at` affichera des vignettes mortes ou promettra un original disparu à grande échelle.
- **Reco** : aligner `MediaAsset` sur `media_assets` : remplacer `fullUrl` (URL permanente) par `storage_path` + un getter `signedUrl()` mocké (qui deviendra l'appel Storage) ; garder `thumbUrl` comme `thumb_path` public ; ajouter `expiresAt`/`originalDeletedAt` (nullable). Les surfaces qui affichent l'original passent par le getter, jamais par une URL brute. Grille/historique ne lisent QUE la vignette.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.436-437, Module J ; CLAUDE.md §20-21

### [P2] `content_targets` mock n'a ni `client_id` ni `org_id` : l'invariant anti-fuite intra-tenant n'a aucun reflet dans le contrat

- **Où** : `apps/web/lib/mocks/types/core.ts:132-142` (ContentTarget) ; `content.ts:110-123` (`buildTargets` génère `tg_<contentId>_<platform>`)
- **Constat** : `ContentItem` porte `clientId` (`core.ts:147`) mais pas `orgId`. `ContentTarget` ne porte NI `orgId` NI `clientId` : seulement `socialAccountId` (nullable) et `platform`. Le PRD §6 exige que toutes les filles de Client portent `client_id` (+ `org_id`), verrouillées par FK composites `UNIQUE(id, client_id)`/`UNIQUE(id, org_id)` (§2.3). `content_targets` est une petite-fille de client (via `content_items`) : elle doit porter la dénormalisation.
- **Scénario d'échec / coût à l'échelle** : le contrat front laisse croire qu'un `ContentTarget` se résout uniquement par son parent (`content.targets[]`). Au câblage, `content_targets` porte `org_id`+`client_id` NOT NULL. Une Server Action qui insère un target à partir du type mock n'a ni `org_id` ni `client_id` à injecter → insert rejeté par la contrainte, découvert au runtime backend, pas à la compilation.
- **Pourquoi ça bloque le scaling** : les FK composites sont la garantie physique anti-fuite intra-tenant (reviewer client 1 ne voit jamais client 2). Si les types ne portent pas la dénormalisation, elle est ajoutée à la main table par table au câblage, avec le risque d'en oublier une.
- **Reco** : faire hériter `ContentTarget` (et `media_assets`, `comments`, `approvals`) du type de base `{ orgId, clientId }` (finding org_id ci-dessus). Peupler dans `buildTargets`/`buildMedia` depuis le client courant. Le seed devient un jeu de données qui satisferait déjà les FK composites — validation gratuite du modèle avant Supabase.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2.1/§2.3 ; PRD §6 invariants

### [P2] `ImportedPost` n'a pas d'`external_id` : la clé de déduplication du feed IG (§5.C / §6) n'existe pas dans le contrat

- **Où** : `apps/web/lib/mocks/types/core.ts:102-113` + `imported.ts:33-42` (`buildImported`)
- **Constat** : `ImportedPost` porte `id, clientId, thumbUrl, permalink, publishedAt, mediaType, metrics, pinned` — **aucun `externalPostId`**. Le PRD §6 l.429 impose `imported_posts (external_id, permalink, thumb, timestamp, media_type)` et §5.C l.212 exige que la sync du feed dédoublonne sur l'`external_post_id` des `content_targets` existants. Or `content.ts:118` pose bien `externalPostId: ${platform}_${contentId}`. Les deux entités ne partagent **aucune clé de jointure**.
- **Scénario d'échec / coût à l'échelle** : au Lot 2, un post publié via Ocean est aussi renvoyé par `GET /media`. Sans `external_id` sur `imported_posts`, impossible de dédoublonner → même post deux fois dans la grille. `feed-grid.tsx:89` concatène `[...pinned, ...planned, ...published, ...imported]` **sans dédup**. (Nuance : le doublon n'est PAS reproductible dans la preview — mocks volontairement non chevauchants, `imported.ts:7` ; et le PRD §5.C place la dédup dans le WORKER/sync, pas dans `grid/page.tsx` — donc au câblage, `getImportedPosts` renverra des lignes déjà dédupliquées et le composant ne change pas.)
- **Pourquoi ça bloque le scaling** : la grille de feed est la fonctionnalité signature. Le cœur défendable se réduit à « le type mock `ImportedPost` omet le champ `external_id` que la DB aura » — un ajout additif de champ + peuplement d'un builder.
- **Reco** : ajouter `externalPostId: string` (non optionnel) à `ImportedPost`, le peupler dans `imported.ts` (même forme que `content.ts:118`). La dédup reste worker-side. Le contrat mock reflétera alors §6 l.429.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (ajout de champ, données seed)   **Verrou PRD/CLAUDE.md** : PRD §6 l.429 + §5.C l.212

### [P2] Agenda unifié inclut les contenus `approved` non planifiés — contredit la vue actée `unified_agenda` (= PLANIFIÉS)

- **Où** : `apps/web/lib/mocks/index.ts:112` (`AGENDA_PUBLISH = ['scheduled','approved','publishing']`) + `:120-128` (`getUnifiedAgenda`)
- **Constat** : `getUnifiedAgenda` inclut tout `ContentItem` `status ∈ {scheduled, approved, publishing}` ayant un `scheduledAt`. Or `unified_agenda` (PRD §6 l.331 ; ANALYSE §3.5 : `UNION events + content_items PLANIFIÉS`) unit events et content_items **planifiés = `scheduled`** (et en cours). `approved` n'est PAS planifié : §5.B définit `approved → scheduled` comme l'acte qui crée les PublishJobs (l.166), et un `approved` à date dépassée est justement le cas « à reprogrammer » (l.200, « jamais de publication immédiate automatique »). `content-blueprint.ts:67` (`status: approved, day: 1`) + `content.ts:156` posent un `scheduledAt` concret sur des items `approved`, rejoués pour chaque client (`:193`) → plusieurs `approved` datés peuplent l'agenda aujourd'hui.
- **Scénario d'échec / coût à l'échelle** : au branchement de la vraie vue Postgres (`security_invoker`) — `AUDIT-PAGES-CLIENT.md:1339` prévoit `getUnifiedAgenda → SELECT ... unified_agenda`, même signature — soit les `approved` disparaissent (régression visuelle vs maquette validée), soit on réécrit la vue SQL pour matcher le mock et on affiche des publications qui **ne partiront jamais** automatiquement (pas de PublishJob). Faux sentiment de sécurité sur le canal le plus sensible (le temps du freelance).
- **Pourquoi ça bloque le scaling** : si le prédicat d'inclusion du mock diverge du prédicat de la vue, chaque évolution de l'agenda (filtres, multi-clients V2) part d'un contrat faux et l'écart se creuse.
- **Reco** : restreindre `AGENDA_PUBLISH` à `scheduled` (+ états en cours `publishing`/`partially_published` si on veut montrer l'exécution) et **exclure `approved`**. Aligner strictement sur la définition SQL pour que le branchement de la vue ne change pas ce que l'UI affiche.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui (moins d'items affichés)   **Verrou PRD/CLAUDE.md** : PRD §6 Module G / l.331, ANALYSE §3.5, §5.B l.166/200

### [P2] `CalendarEvent` aplatit l'arbre à 3 niveaux : le calendrier n'est pas une entité, couleurs/toggles vivent sur l'event

- **Où** : `apps/web/lib/mocks/agenda.ts:124-135` + `types/core.ts:187-199` ; consommé `components/app/agenda/unified-agenda.tsx:23-37`
- **Constat** : `CalendarEvent` porte `accountId` + `calendarName` + `colorVar` + `enabled` sur chaque event. Le niveau `calendar_calendars` du PRD §6 l.447 (`provider_calendar_id, name, color, is_enabled`) n'existe pas comme entité. `unified-agenda.tsx:23-37` re-dérive la liste des calendriers par `groupBy(calendarKey(e.calendarName))`, l'état on/off déduit de `e.enabled` event par event (`:57-61`). Aucun `external_id`, `provider_calendar_id`, `series_master_id`, `last_sync_run_id` (l.448-449).
- **Scénario d'échec / coût à l'échelle** : au câblage, `calendar_calendars` est une vraie table (name/color/is_enabled une fois, pas N fois répliqués). Le composant qui reconstruit par `groupBy` devra prendre une liste de calendriers en prop. Une couleur changée côté Google ne peut pas se propager (copiée sur chaque event). (Nuance : le « calendrier vide qui disparaît » n'est pas un bug présent — `buildCalendars` tourne sur le prop `events` complet, stable semaine à semaine ; ça se matérialise seulement avec un cache fenêtré `[-30j,+180j]` — cadre futur/scaling.)
- **Pourquoi ça bloque le scaling** : un freelance avec 2 comptes Google + 1 Outlook, 10-15 calendriers, milliers d'events récurrents : sans `series_master_id`/`provider_calendar_id` la sync incrémentale (`last_sync_run_id`) est impossible, et le toggle par calendrier ne tient pas sur des semaines sans event.
- **Reco** : introduire un type `CalendarCalendar { id, accountId, providerCalendarId, name, colorVar, isEnabled }` distinct, faire consommer aux composants la **liste de calendriers en prop** (pas un `groupBy` sur les events). `CalendarEvent` ne garde que `calendarId` + `externalId` + `seriesMasterId`. La forme cible est à moitié présente (`CalendarFilter` `agenda-sidebar.tsx:11-18` a déjà `{key, name, colorVar, accountId}`).
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.445-449

### [P2] `SavedView.filters.labels` stocke des chaînes FR brutes comparées au libellé localisé : « Drops & promos » renvoie 0 résultat en anglais

- **Où** : `apps/web/lib/mocks/views.ts:34` (`labels: ["Lancement","Promo"]`) ; matché `components/app/studio/board-utils.ts:44` ; labels source `content-extra.ts:24-64` (`loc("Lancement","Launch")`)
- **Constat** : les labels de contenu sont bilingues `L<string>` (`content-extra.ts:24`). La `SavedView` filtre sur des string mono-langue FR. `board-utils.ts:44` fait `f.labels.includes(pick(l, locale))` : en FR `pick` → "Lancement" → match ; en EN `pick` → "Launch" → jamais égal à "Lancement" → filtre vide. `SavedViewFilters.labels: string[]` (`pro.ts:59-60`) sans id stable, alors que `statuses`/`formats`/`platforms` sont des enums. Symptôme corroborant : `board-filters.tsx:150` rend la checkbox "Launch" décochée alors que la vue est active — état EN incohérent.
- **Scénario d'échec / coût à l'échelle** : un utilisateur en anglais ouvre la vue enregistrée « Drops & promos » du client Atelier Nove → la board se vide, alors que les mêmes contenus s'affichent en français. **Bug observable sur la maquette validée dès qu'on bascule la langue.**
- **Pourquoi ça bloque le scaling** : les labels n'ont AUCUNE table cible au §6 — taxonomie libre inventée par l'UI, dupliquée entre `content.labels` (L<string>), `SavedView.filters.labels` (string FR), et le popover de création ad hoc. Au câblage : soit une table `labels(id, name L<string>)` référencée par id partout, soit le filtre reste cassé multilingue.
- **Reco** : modéliser un label comme entité `{ id, clientId, name: L<string> }` et faire porter aux filtres et contenus des `labelId` (pas des chaînes localisées). Corriger `board-utils` pour matcher par id. Décider une table cible (ajout PRD probable : `labels` + `content_labels`) avant le branchement.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : oui (corrige un bug EN)   **Verrou PRD/CLAUDE.md** : aucun (labels absents du §6 — entité UI-inventée à modéliser)

### [P2] `interactions.ts` (comments/approvals/review_requests) est entièrement DÉRIVÉ du statut au module-load, pas persisté

- **Où** : `apps/web/lib/mocks/interactions.ts:11-15` (`REVIEW_TARGETS = filter status`), `:72-104` (`approvalsFor` déduit la décision du status), `:106-127` (`REVIEW_REQUESTS` reconstruit, `state` hardcodé `"partial"` `:124`)
- **Constat** : `COMMENTS`, `APPROVALS`, `REVIEW_REQUESTS` ne sont pas autonomes : calculés depuis `CONTENT_ITEMS`. `approvalsFor` retourne `approved` SI `status ∈ {approved, scheduled}`, `changes_requested` SI `status === changes_requested`, et hardcode `versionLabel: "v1"`. L'approbation est une **projection du statut courant**, pas un fait horodaté immuable — alors que §6 l.439 exige `approvals` **INSERT-ONLY** avec snapshot de version. Preuve concrète : `ct_cl_brulerie_13` (changes_requested, `approvalStale: true`) a TROIS versions (`history.ts:7-46`) et un journal multi-décisions, mais `approvalsFor` ne produit qu'UNE approbation figée `v1` → `detail-versions.tsx:52` apparie approbations↔versions par `versionLabel === version.label`, donc v2/v3 ne portent jamais de puce, et aucune 2e décision n'est représentable.
- **Scénario d'échec / coût à l'échelle** : le flux réel est inverse — l'approbation (fait reviewer) DÉTERMINE le statut. En dérivant, le mock ne peut pas représenter (a) un contenu repassé en draft gardant l'ancienne approbation en historique, (b) plusieurs approbations successives, (c) l'état dérivé d'une review_request multi-reviewers. Le Realtime des statuts (§5.F l.573) n'a pas d'événement source. `content-review-panel.tsx:78,139-152` et `detail-versions.tsx` consomment `approvals[]` comme un historique mais ne reçoivent jamais que 0-1 ligne → logique jointure non éprouvée contre des données multi-lignes.
- **Pourquoi ça bloque le scaling** : l'approbation insert-only est une preuve d'audit (valeur juridique, §5.F l.297). Un contrat où l'approbation est recalculée depuis le statut ne prépare ni la table append-only ni le Realtime.
- **Reco** : rendre approvals/comments/review_requests autonomes (données posées, pas dérivées), avec `versionLabel` et snapshot cohérents, et faire dériver le statut du contenu depuis eux. Modéliser `review_request_items` (jointure §6 l.431) plutôt que `contentIds: string[]` inline. La forme mock = table INSERT-ONLY + jointure prêtes pour Realtime.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.430-431/439, §5.F l.297/573

### [P2] Les 7 composants du shell persistant appellent des getters de DONNÉES à l'exécution dans le navigateur

- **Où** : `command-palette.tsx:20+54`, `notifications-button.tsx:9+17`, `client-health-banner.tsx:10+23`, `app-sidebar.tsx:21`, `client-switcher.tsx:17`, `quick-capture.tsx:27`, `nav-user.tsx:26`
- **Constat** : ces 7 fichiers `"use client"` invoquent des getters de données mock (pas seulement `MOCK_NOW`/labels statiques) directement au rendu : `useMemo(() => getClients()…)`, `getNotifications("owner").slice(0,6)`, `getContentItems(clientId).filter(…)`. Le reste de l'app passe les données en props depuis les Server Components (bon pattern, ex. `content/new/page.tsx:59-89 → ComposerScreen`).
- **Scénario d'échec / coût à l'échelle** : ces getters synchrones deviendront des accès DB asynchrones tenant-scopés. Dans un `"use client"`, on ne peut pas `await` une lecture serveur → il faudra soit remonter la donnée via un layout serveur en props, soit TanStack Query + Server Function. Les deux **réécrivent** ces composants (signatures, états de chargement, providers). Note : `client-health-banner` re-fetche des données que son parent async (`clients/[clientId]/layout.tsx:14-25`) tient déjà → fix trivial par prop-threading.
- **Pourquoi ça bloque le scaling** : le shell est rendu sur TOUTES les pages — point le plus chaud pour la donnée tenant live (clients de l'org, compteur de notifs non lues Realtime, santé des comptes). Le garder en getter synchrone bloque le passage à Realtime/queries.
- **Reco** : déplacer ces lectures dans `(app)/layout.tsx` (Server Component) et les passer en props (clients, unreadCount, healthByClient) — le `ShellProvider` existe déjà — OU câbler TanStack Query maintenant avec `useClients()`/`useUnreadCount()` dont le stub lit le mock. Objectif : le shell ne connaît qu'un hook ou une prop, jamais `getX()`.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2.26 (Server par défaut), §1 (state = TanStack Query)

### [P2] La façade barrel `@/lib/mocks` mêle types DB, maps de présentation et getters de données, et est importée par des composants client

- **Où** : `apps/web/lib/mocks/index.ts` (barrel) importé par ~7 fichiers `"use client"` consommant de la donnée ; motif getter-in-client étendu à ~14 fichiers interactifs (sidebar, calendrier, composer)
- **Constat** : `index.ts` re-exporte les 22 modules + enums/types + définit les getters de données localement. Aucun marqueur `server-only`. Des composants client appellent ces getters sync directement (confirmé sidebar/switcher/quick-capture/command-palette/notifications-button/health-banner). CLAUDE.md §0 prescrit les mocks dans `packages/shared` avec « mêmes types/enums que la future DB pour brancher sans réécrire l'UI ».
- **Scénario d'échec / coût à l'échelle** : quand les getters deviennent des accès DB server-only, chaque call site client `getClients()` (sync) ne peut pas devenir une requête Supabase (async + potentiellement server-only) sans réécrire le call site. Il faudra scinder la façade et re-router les imports. (Précision : importer un module qui appelle Supabase ne « casse » pas le bundling — le client JS est browser-compatible ; ce qui casse réellement = changement de signature sync→async + données server-only à déplacer. La surface de DONNÉES via le barrel = ~7 fichiers, pas 115 ; la majorité des ~115 imports `@/lib/mocks` ne prennent que types/labels/time, légitimes.)
- **Pourquoi ça bloque le scaling** : tant que data-getters, types et labels partagent le même point d'entrée importé partout, impossible de déplacer proprement la couche données vers le serveur/`packages/shared` sans effet domino.
- **Reco** : scinder en 3 surfaces dès maintenant — (1) `@/lib/contracts` (types+enums+schémas Zod, isomorphe → `packages/shared`) ; (2) `@/lib/labels` (maps de présentation, client-safe) ; (3) couche data server-only (`getX`, marquée `server-only`) importable UNIQUEMENT par Server Components/Actions. Re-router les composants client vers (1) et (2), jamais (3). Le branchement ne touche alors que (3).
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0

### [P2] Le portail résout toute sa frontière tenant depuis la constante `DEMO_REVIEWER_CLIENT_ID` : aucun seam reviewer → `client_members` (multi-clients)

- **Où** : `apps/web/lib/mocks/index.ts:38+146` (`DEMO_REVIEWER_CLIENT_ID`, `getPortalContent(clientId = DEMO…)`) ; `app/(portal)/layout.tsx:11-12`, `portal/page.tsx:19-24`, `portal/[contentId]/page.tsx:40`
- **Constat** : `getPortalContent()` prend un seul `clientId` avec défaut = la constante `cl_brulerie`. Le layout portail, la home et le détail (garde `content.clientId !== DEMO_REVIEWER_CLIENT_ID → notFound`) résolvent le client du reviewer depuis cette constante, jamais depuis une identité authentifiée. `REVIEWERS` (`clients.ts:111-144`) modélise un reviewer → un seul `clientId`, et `getReviewer(clientId)` (`index.ts:82`) résout client→reviewer, l'inverse du modèle cible (§3 : session → reviewer → `client_members[]`, pluriel).
- **Scénario d'échec / coût à l'échelle** : dès qu'un reviewer valide pour 2 marques (ou une agence a plusieurs reviewers), le modèle mono-constante casse. Au câblage il faut résoudre req → user → `client_members[]`, transformer `getPortalContent(clientId)` en `getPortalContentForReviewer(userId)` renvoyant potentiellement plusieurs clients, refaire les gardes de détail — réécriture des 3 fichiers portail + de la home. Un câblage naïf « premier `client_members` » serait silencieusement faux sur la surface la plus sensible (client externe).
- **Pourquoi ça bloque le scaling** : le portail est la surface la plus sensible ; sa frontière tenant doit être dérivée de l'identité, pas d'une constante. La signature `getPortalContent(clientId: string)` est structurellement incapable d'exprimer « n clients accessibles ».
- **Reco** : définir le seam `getReviewerContext()` (stub : renvoie `[{client, reviewer}]`) et faire consommer au portail une LISTE de clients accessibles (même si 1 en démo). La home portail doit tolérer 0..n clients. Le branchement `client_members` ne change alors que le stub.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : oui (portail multi-clients)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2.6, §3

### [P2] `notifications.href` code des chemins client-scopés en dur : deep links non générés via `routes.ts`, non rattachés à un objet typé

- **Où** : `apps/web/lib/mocks/notifications.ts:18,32,46,60,74,88,102,116,130,144` (href littéraux) ; `AppNotification.href: string` (`collab.ts:69`) ; rendu `components/app/notifications/notification-row.tsx:74`
- **Constat** : chaque notification embarque un href textuel figé (`"/clients/cl_brulerie/content/ct_cl_brulerie_5"`, `"/settings/accounts"`, `"/clients/cl_verde/grid"`). Ces chemins ne passent pas par `routes.ts` (`routes.content(clientId, contentId)`, `:22`) pourtant déclaré « source unique des chemins » (`:1`). `AppNotification` n'a ni `entityType` ni `entityId` : le lien profond est une string opaque, pas une référence à content_item/social_account/client.
- **Scénario d'échec / coût à l'échelle** : le PRD §6 l.443 modélise `notifications` avec un « deep link » et §5.I l.381 « lien profond vers l'objet concerné ». Un href construit à l'insertion côté worker/serveur **fige la structure d'URL dans la donnée persistée** — si les routes évoluent (préfixe `/(app)`, slug), tous les href stockés pointent vers du 404. (Précision : le PRD impose le COMPORTEMENT — naviguer vers l'objet — pas la FORME de stockage ; stocker type+id est une bonne pratique d'ingénierie, pas un lock PRD dur. Fenêtre de correction grande ouverte : aucun schéma committé, ~3 lecteurs à adapter.)
- **Pourquoi ça bloque le scaling** : des années de notifications accumulées avec URLs absolues gelées : toute refonte de routing casse l'historique. La bonne forme = stocker `(entity_type, entity_id)` et résoudre l'URL à l'affichage via `routes.ts`.
- **Reco** : remplacer `href: string` par `{ entityType, entityId, clientId? }` dans `AppNotification`, résoudre l'URL à l'affichage via `routes.ts` (lecteurs : `notification-row.tsx:74`, `dashboard/page.tsx:113`, `notifications-button.tsx:52`). La colonne DB porte le type+id, jamais le chemin.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.443 + §5.I l.381

### [P3] `Approval.versionLabel: string` diverge du snapshot/hash de version imposé (piste d'audit de preuve)

- **Où** : `apps/web/lib/mocks/types/collab.ts:24` ; valeurs `"v1"` en dur `interactions.ts:83,96` ; consommé `portal/[contentId]/page.tsx:171`, `content-review-panel.tsx:178`, `detail-versions.tsx:52`
- **Constat** : l'`Approval` ne porte qu'un `versionLabel: string` libre. Le PRD §5.F l.297 et §6 l.439 exigent que `approvals` stocke la VERSION APPROUVÉE = snapshot/hash de (légende + hashtags + médias + ordre + format). Le mock ne capture aucun snapshot ; `ContentVersion` (`collab.ts:73`) ne porte QUE `caption`. `detail-versions.tsx:52` joint approval↔version par égalité de label texte, pas par identité de contenu.
- **Scénario d'échec / coût à l'échelle** : au câblage, `approvals.version` doit être un snapshot (jsonb/hash) pour porter la valeur de preuve. Les trois sites d'affichage rendent `versionLabel` comme un simple badge humain (« v1 ») — qu'un vrai schéma garde en champ dénormalisé, donc ce chemin survit intact. Le seul point réel : le lien par string-match est fragile (deux versions homonymes / un relabel cassent l'association).
- **Pourquoi ça bloque le scaling** : la preuve d'approbation est un asset légal (litige « ce que j'ai validé »). Le snapshot/hash est une colonne pure-backend qu'un mock visuel n'a pas à porter ; la seule action preview = remplacer le join label par un join id.
- **Reco** : remplacer `versionLabel` par une référence de version stable (`versionId`) + enrichir `ContentVersion` (hashtags/format/mediaIds/ordre) pour matcher le hash DB. Joindre approval↔version par id (swap du prédicat `detail-versions.tsx:52`). Marquer `Approval` insert-only (commentaire, pas de setters).
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §5.F l.297, §6 l.439

### [P3] Le modèle de quota est mono-limite : IG (400 conteneurs/24h) et FB (BUC 4800/24h) non représentables

- **Où** : `apps/web/lib/mocks/quotas.ts:11-16` (`PLATFORM_QUOTAS`) + `types/pro.ts:73-79` (`QuotaUsage`)
- **Constat** : `PLATFORM_QUOTAS` = UNE limite par plateforme (IG 100 / FB 30 / TikTok 5) et `QuotaUsage = {used, limit, windowKey}` — un seul couple. Or CLAUDE.md §6 définit DEUX limites concurrentes côté IG (100 posts + 400 conteneurs) et FB (BUC 4800 + 30 Reels). `mockUsage` (`:44`) ne compte que les Reels pour FB ; le libellé FB est « Reels · 24 h ». La limite BUC (qui gouverne TOUS les posts FB) et les conteneurs IG sont absents du contrat.
- **Scénario d'échec / coût à l'échelle** : l'enforcement réel (worker) manipule plusieurs compteurs par compte. Quand le worker signalera « BUC FB atteint » alors que le compteur Reels est à 3/30, `QuotaGauge` affichera « 3/30 Reels » — verte — pendant que la publication est bloquée. (Nuance : ce mode d'échec vit ENTIÈREMENT dans la couche worker/DB, désignée source de vérité par §6 — « UI = affichage ergonomique » ; le rôle du mock est de rendre une jauge plausible, ce qu'il fait. Les limites absentes ne mordent quasiment jamais pour le profil réel — `AUDIT-PAGES-CLIENT.md:243` : « Rarement critique pour un freelance ».)
- **Pourquoi ça bloque le scaling** : la reco elle-même admet que `QuotaGauge` peut afficher « la limite la plus contraignante (min du ratio) » — collapser vers une limite est un rendu valide qui laisse `QuotaGauge`/`board-quotas`/`grid-toolbar`/`calendar-controls` **inchangés**. L'obstacle réel = un simple élargissement du contrat de données côté producteur.
- **Reco** : transformer `QuotaUsage` en collection `{ limits: Array<{ used, limit, windowKey, kind }> }` (kind = posts|containers|reels|buc), `getQuotaUsage` multi-limites. À aligner au moment du câblage de l'enforcement quotas.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (forme du contrat quota)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §6

### [P3] `AccountStatus` mock ajoute `expired` là où le PRD/CLAUDE ne connaît que `needs_reauth`

- **Où** : `apps/web/lib/mocks/types/core.ts:43` (`connected|needs_reauth|expired`) ; `labels.ts:48-52` (mappe les 3) ; réutilisé par `CalendarAccount` (`core.ts:184`) et `SocialAccount` (`core.ts:90`)
- **Constat** : `AccountStatus` a 3 valeurs. Le PRD §6 (`social_accounts: status, needs_reauth`) et §7.4 (health check → `needs_reauth`) ne mentionnent que `needs_reauth` ; `expired` n'apparaît pas dans le modèle DB. Les données mock n'utilisent jamais `expired` (`clients.ts` n'a que connected/needs_reauth) — 3e valeur d'enum morte mais typée, câblée dans des consommateurs exhaustifs (`Record<AccountStatus,…>`).
- **Scénario d'échec / coût à l'échelle** : au câblage, `generate_typescript_types` produira un enum DB (probablement `connected|needs_reauth`) sans `expired`. Tout code exhaustif (switch, `Record`) devra retirer la branche `expired`, ou le build DB ajoutera une valeur jamais utilisée. Divergence enum front↔DB = friction au moment du branchement (mais un enum DB sur-ensemble serait inoffensif, aucune ligne n'utilise `expired`).
- **Pourquoi ça bloque le scaling** : les enums qui divergent silencieusement mock↔DB sont la source classique de bugs au swap. Réconcilier maintenant coûte une ligne.
- **Reco** : soit retirer `expired` (aligner sur `needs_reauth`, §6), soit acter explicitement `expired` comme valeur produit et l'ajouter au PRD/schéma. Décision **avant** de générer les types DB. Vérifier aussi que `CalendarAccount` partage réellement le même enum que `social_accounts` côté DB (le PRD les modélise séparément).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6, §7.4 (aucune mention de `expired`)

### [P3] `ContentTarget` omet `deleted_externally`, champ acté au §6 pour la sync du feed IG

- **Où** : `apps/web/lib/mocks/types/core.ts:132-142` — comparé à PRD §6 `content_targets` (l.435) + Module C (l.212)
- **Constat** : le §6 liste `content_targets` avec `deleted_externally`. Le mock porte status/externalPostId/permalink/publishedAt/captionOverride mais PAS `deletedExternally`. Le Module C est explicite : un post publié via l'app puis supprimé côté IG → cible marquée `deleted_externally` (retrait de la grille, historique conservé).
- **Scénario d'échec / coût à l'échelle** : au Lot 2, quand la sync marque une cible `deleted_externally`, l'UI grille n'a aucun champ pour distinguer « post retiré côté IG mais historique conservé ». (Nuance forte : `deleted_externally` est une préoccupation de RETRAIT/omission — per le PRD « retrait de la grille » — pas un nouvel état de rendu. `grid/page.tsx:31-41,159-162` construit le groupe « published » en FILTRANT les ContentItems ; un post retiré se rend comme ABSENCE, aucune tuile à dessiner. L'ajout est purement additif : `deletedExternally?: boolean` + un prédicat dans le filtre.)
- **Pourquoi ça bloque le scaling** : la partie load-bearing du contrat de sync (clé de dédup `external_post_id`) est déjà modélisée ; `deleted_externally` est un ajout d'un booléen optionnel + un prédicat, S-effort, sans restructuration.
- **Reco** : ajouter `deletedExternally?: boolean` (ou date) à `ContentTarget` + un prédicat `!c.targets.some(t => t.deletedExternally)` dans le filtre `publishedAll`. Coût quasi nul en preview, évite une reprise au Lot 2.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.435, Module C l.212

### [P3] `AppNotification.type` est string libre (pas d'enum) alors que 10 types fermés pilotent icône/tonalité via lookups à fallback

- **Où** : `apps/web/lib/mocks/types/collab.ts:62` (`type: string`) ; 10 valeurs en dur `notifications.ts:7,22,36,50,64,78,92,106,120,134` ; mappées `notification-row.tsx:22-46` (`TYPE_ICON`/`TYPE_TONE` `Record<string,…>` avec `??` fallback)
- **Constat** : `AppNotification.type` est typé `string`. Les valeurs réelles sont un ensemble fermé aligné sur la matrice §5.I (publish_failed, token_reauth_needed, tiktok_draft_pushed, changes_requested, content_approved, publish_succeeded, publish_delayed, review_comment, manual_due, watchdog). `notification-row.tsx:70-71` fait `TYPE_ICON[type] ?? Bell` / `TYPE_TONE[type] ?? "text-muted-foreground"` : un type inconnu tombe en fallback muet. Naming-drift déjà présent : CLAUDE.md §11 EventMap a `publish_delayed_quota` vs mock `publish_delayed`, et `changes_requested` (event) vs `review_comment` (notif). Les frères du même fichier (`ApprovalDecision:16`, `ReviewRequestState:45`, `ActivityKind:84`) sont tous des unions — celui-ci est `string` par incohérence.
- **Scénario d'échec / coût à l'échelle** : le worker/back émet un type légèrement différent → notification avec icône cloche générique et tonalité neutre, sans erreur. Incohérence visuelle non détectée à la compilation. (Zéro défaut runtime aujourd'hui : les 10 valeurs ont des clés dans les deux Records, le fallback ne tire jamais.)
- **Pourquoi ça bloque le scaling** : sans enum partagé, chaque producteur (worker publish, refresh tokens, watchdog, portail) risque d'inventer sa propre chaîne ; le mapping à fallback masque les régressions sur la durée.
- **Reco** : définir `NotificationType` comme union fermée dans `packages/shared` (source unique UI + worker + colonne DB enum), alignée sur §5.I et l'EventMap PostHog. Remplacer les `Record<string,…>` à fallback par des `Record<NotificationType,…>` exhaustifs (erreur de compilation si un type manque).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §5.I l.362-378 ; CLAUDE.md §11

### [P3] `metrics.ts` attribue les métriques par index de position dans la liste filtrée, pas par identité stable

- **Où** : `apps/web/lib/mocks/metrics.ts:25-30` — `.map((c, i) => ({ refId: c.id, ...(APP_OVERRIDES[c.id] ?? APP_BASES[i % APP_BASES.length]) }))`
- **Constat** : `appMetrics()` cycle `APP_BASES` sur l'index `i` du `CONTENT_ITEMS` filtré. La métrique d'un post dépend de sa POSITION, pas de son id. Déterministe aujourd'hui (`MOCK_NOW`) mais fragile : insérer/retirer un contenu publié décale les métriques de tous les suivants. La vraie table `post_metrics` sera clé sur `content_target`/`external_id`.
- **Scénario d'échec / coût à l'échelle** : ajout d'un contenu `published` en milieu de blueprint → le top post (`APP_OVERRIDES ct_cl_verde_1`) reste stable (override par id), mais tous les posts sur `APP_BASES` voient leur reach changer, faussant `getTopPosts` (`:44`, tri par reach) et la page Performance (`perf-data.ts:96/100`). Régression silencieuse d'un classement présenté comme réel. Nul impact au câblage : `appMetrics()` est jeté et remplacé par une source clé-par-`refId`.
- **Pourquoi ça bloque le scaling** : purement une fragilité de mock, sans effet utilisateur au repos, sans impact sur le futur câblage — nit de maintenabilité.
- **Reco** : attribuer les bases par un hash stable de `c.id` (ou un dictionnaire explicite par id, comme `APP_OVERRIDES`). Rend les métriques démo insensibles à l'ordre et cohérentes avec un futur `post_metrics` clé-par-`refId`.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui (valeurs démo)   **Verrou PRD/CLAUDE.md** : aucun

### [P3] `Client.theme` couple l'UI aux pools d'images de démo — champ inexistant dans la DB cible

- **Où** : `apps/web/lib/mocks/types/core.ts:74` (`theme: keyof typeof IMAGES`) ; consommé `content.ts:42,127`, `imported.ts:28`, `library.ts:78-79`, `components/app/library/use-library-assets.ts:31`
- **Constat** : `Client.theme` est typé `keyof typeof IMAGES` (union `coffee|food|fashion|yoga`). Le PRD §6 l.425 liste pour `clients` : `name, logo, brand_color, timezone, archived_at` — PAS de `theme`. C'est une clé de sélection de pool d'images de démo dans un type censé miroiter la DB, lue non seulement par les générateurs mais aussi par un hook (`use-library-assets.ts:31`). (Nuance : `use-library-assets.ts:31` est dans `addMockAssets()`, fonction jetable — son propre commentaire `:10-11` la déclare simulation sans persistance ; au câblage, le vrai upload TUS → Storage remplace toute cette fonction. Le sole consommateur non-générateur est donc du scaffolding disposable.)
- **Scénario d'échec / coût à l'échelle** : au câblage, `clients` n'a pas de colonne `theme` → le type perd ce champ → `use-library-assets.ts:31` (`IMAGES[client.theme]`) ne compile plus. Couplage UI↔mock que la preview devait éviter.
- **Pourquoi ça bloque le scaling** : un champ de démo dans un type censé miroiter la DB est une fuite de couche — mécanique à nettoyer, blast radius nul au-delà d'un fix de type trivial.
- **Reco** : sortir `theme` du type `Client`. Le confiner à une correspondance interne aux mocks (`Record<clientId, ImageTheme>`) que seuls les générateurs lisent ; les composants reçoivent leurs assets via un getter mock (`getLibraryAssets(clientId)`) qui deviendra une query Storage. Le type `Client` n'expose que les colonnes DB réelles.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 l.425 ; CLAUDE.md §0

### [P3] `history.ts` dépasse 250 lignes (270) et couple en dur des IDs de contenu générés

- **Où** : `apps/web/lib/mocks/history.ts:1-270` — IDs en dur `ct_cl_brulerie_13` (`:10`), `ct_cl_nove_13` (`:49`), `ct_cl_verde_4` (`:147`)
- **Constat** : `history.ts` fait 270 lignes (> 250, CLAUDE.md §24). `CONTENT_VERSIONS` et `ACTIVITY_ENTRIES` référencent en dur des `contentId` GÉNÉRÉS par `content.ts` (`id = ct_${client.id}_${i}`). Aucun lien de type ne garantit que ces IDs existent : si `BLUEPRINT` change de longueur/ordre, les getters (`getContentVersions`/`getActivityEntries`, `:75/266`) filtrent et renvoient `[]` silencieusement.
- **Scénario d'échec / coût à l'échelle** : un dev réordonne/raccourcit `BLUEPRINT` → `ct_cl_brulerie_13` n'existe plus → le journal d'activité et les versions se vident sans erreur (`content/[contentId]/page.tsx:68-69`, aucun garde). Régression invisible en review de maquette. (Purement conditionnel/hypothétique : aucun bug actuel, et le pattern de couplage par chaîne magique est déjà une convention acceptée du repo — `content-extra.ts:33/86`, `notifications.ts:60`.)
- **Pourquoi ça bloque le scaling** : dette de maintenabilité des mocks — leur cohérence interne repose sur des chaînes magiques non vérifiées par le compilateur ; ça grossira avec chaque contenu de démo. Code jetable qui ne migrera jamais vers Supabase, donc aucun obstacle au câblage.
- **Reco** : scinder `history.ts` (< 250 l) en séparant `CONTENT_VERSIONS` et `ACTIVITY_ENTRIES`, remplacer les `contentId` magiques par des constantes dérivées de `content.ts` (ou un assert de dev qui vérifie que chaque `contentId` référencé existe dans `CONTENT_ITEMS`).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §24

---

## Code production-grade proposé (NON appliqué)

Deux fondations à poser dans `packages/shared` avant le câblage. Elles rendent la defense-in-depth §2.7 **structurelle** (elle échoue à la compilation, pas en revue de code) et isolent le seam de données du bundle client.

```ts
// packages/shared/src/tenant.ts — types de base tenant (source unique UI + backend)
/** Toute table métier. org_id NOT NULL dénormalisé (CLAUDE.md §2.1). */
export interface OrgScoped { orgId: string }
/** Toute fille de Client : porte AUSSI client_id (§2.1) — verrouillé DB par FK composite. */
export interface ClientScoped extends OrgScoped { clientId: string }

// Les entités héritent → un insert/Server Action qui omet orgId/clientId NE COMPILE PAS.
export interface Client extends OrgScoped { id: string; name: string; /* … */ }
export interface ContentItem extends ClientScoped { id: string; status: ContentStatus; /* … */ }
export interface ContentTarget extends ClientScoped { id: string; platform: Platform; /* … */ }
export interface MediaAsset extends ClientScoped {
  id: string; type: MediaType; position: number;
  thumbPath: string;              // bucket public media-thumbs (persistant)
  storagePath: string;            // bucket privé media-originals (JAMAIS d'URL brute)
  expiresAt: string | null;       // URL signée 48h
  originalDeletedAt: string | null; // purge J+7 — gate le retry (PRD §5.B)
}
```

```ts
// packages/shared/src/data.ts — frontière serveur (le SEUL fichier que Supabase remplace)
import "server-only"; // interdit l'import depuis un "use client"
/**
 * Signatures tenant-scopées DÈS la phase mock : au câblage, seul le CORPS change
 * (mock .filter → await supabase…), jamais les call sites.
 * getActiveOrg() posé maintenant en stub, appelé en 1re ligne de chaque page (app).
 */
export async function getContentItem(id: string, orgId: string): Promise<ContentItem | null> { /* … */ }
export async function getComments(contentId: string, clientId: string): Promise<Comment[]> { /* … */ }
export async function getReviewerContext(): Promise<Array<{ client: Client; reviewer: Reviewer }>> { /* … */ }
```

```ts
// notifications : deep link LOGIQUE (type+id), résolu à l'affichage — jamais d'URL gelée en base
export interface AppNotification extends OrgScoped {
  id: string; type: NotificationType; // union fermée alignée PRD §5.I + EventMap PostHog
  entityType: "content" | "account" | "client" | "grid";
  entityId: string; clientId?: string;
  // href SUPPRIMÉ : notification-row.tsx résout via routes[entityType](clientId, entityId)
}
```

## Ce qui va bien (à préserver)

- **Le seam central existe et est propre** : `lib/mocks/index.ts` est un point de branchement unique et lisible. Ne pas le disperser — le scinder en 3 surfaces (contracts/labels/data-server-only) le renforce sans casser le principe.
- **Toutes les pages sont des Server Components `async`** : c'est le pré-requis n°1 du swap sans réécriture. Le pattern « Server Component lit les getters → passe un objet de données typé en prop au Client Component » (ex. `content/new/page.tsx → ComposerScreen`) survivra intact au câblage Supabase. À généraliser au shell.
- **Les enums de statuts recoupent fidèlement le PRD §6** : `ContentStatus` (11 valeurs), `TargetStatus` (9), `MemberRole`, `ApprovalMode` sont un miroir exact de la machine à états actée — la génération des types DB s'y appliquera sans conflit (sauf le `expired` mort de `AccountStatus`, finding P3).
- **La séparation état métier / état technique est correcte** : `ContentItem` (statut global) vs `ContentTarget` (statut par plateforme + `externalPostId`/`permalink`), avec `partially_published`, `pushed_to_platform`, `awaiting_manual` — c'est exactement la topologie ContentItem/ContentTarget/PublishJob du worker. Le mock n'a pas essayé de simuler l'idempotence/lease du PublishJob (100 % worker), ce qui est le bon périmètre.
- **`routes.ts` centralise déjà les chemins** : le mécanisme existe pour résoudre les deep links proprement — il suffit de router les notifications au travers (finding P2).
- **`brandColor`/`colorVar` en oklch, zéro couleur hardcodée** dans les entités : conforme §25, et les couleurs de marque/pilier/calendrier passent par des variables de thème.
- **Le fuseau est modélisé correctement** : `timezone` sur `Client` et `User`, `scheduledAt` documenté « ISO UTC », séparation TZ client (contenu) / TZ freelance (agenda) — aligné sur la cible « stockage UTC `timestamptz` » (CLAUDE.md §12).
