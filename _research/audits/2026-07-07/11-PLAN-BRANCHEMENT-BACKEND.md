# Plan de branchement backend Ocean — du front mocké au back-office Supabase (2026-07-07)

> Rédigé à la main à partir des 7 rapports d'audit du jour (01→07), du PRD §6/§11/§13, de CLAUDE.md §2-10 et de la lecture directe des types mocks. Les 3 rapports d'audit restants (08 tech-lead, 09 sécurité, 10 devops) et les sous-sections détaillées 11a-11d seront produits au reset de quota (10/07). Ce document est le **sommaire exécutif du câblage** et se suffit pour démarrer le Lot 0.
>
> **READ-ONLY** — rien n'est appliqué au code sans validation d'Étienne.

---

## 0. Vision cible en une page

Le front est une **preview UI validée, 100 % mockée**. La maquette est saine pour un swap : toutes les pages sont des Server Components `async`, et **une façade unique** — `apps/web/lib/mocks/index.ts` — sert de point de branchement (chaque `getX(): T[]` deviendra une requête Supabase). La promesse de la phase (CLAUDE.md §0 : « brancher Supabase SANS réécrire l'UI ») est **tenable**, mais **quatre coutures manquent aujourd'hui** et transformeraient le swap en réécriture si on branchait tel quel. Le présent plan solde ces coutures d'abord (pré-câblage), puis déroule le câblage lot par lot dans l'ordre du PRD §11.

```
AUJOURD'HUI                          CIBLE
page.tsx (async RSC)                 page.tsx (async RSC)         ← inchangé
   │ getX() synchrone                   │ await getX() async
   ▼                                     ▼
lib/mocks/index.ts (façade sync)     packages/shared (types+Zod+quotas)
   │ .find() sur tableaux                +
   ▼                                  apps/web/lib/data/*.ts (façade async)
constantes typées L<string>             │ createServerClient() + RLS
                                         ▼
                                     Supabase Postgres (RLS 100%) + Storage + Vault
                                         ▲
                                     apps/worker (SKIP LOCKED, idempotence)
```

**Les 4 coutures pré-câblage** (détail §3) — toutes déjà pointées par ≥3 rapports :
1. **Façade async server-only.** Getters synchrones aujourd'hui, lus jusque dans 7 composants `use client` du shell. Incompatible avec Supabase+RLS (server-only + cookie httpOnly). → rendre async + `cache()` + `server-only`, re-router les 7 call-sites clients.
2. **Résolution du tenant.** `grep org_id` sur tout `apps/web` = **0 occurrence**. Aucune entité ne porte `org_id`, aucune page ne thread `getActiveOrg()`. → introduire le seam org/client dès maintenant (mock à une seule org, mais threadé).
3. **Champs bilingues `L<string>`.** Le contenu utilisateur (title, caption, notes…) est typé `{fr,en}` pour la démo, alors que la DB stocke du `text` simple. ~145 `pick()` dans 70 fichiers. → résoudre la locale **à la frontière de la façade** (les getters prennent la locale, retournent des `string`).
4. **Seam d'horloge + boundaries.** `MOCK_NOW` figé importé par 22 fichiers dont `lib/format.ts` ; zéro `error.tsx`/`loading.tsx`/`not-found.tsx` dans tout `app/`. → `lib/clock.ts` `now()` + les 3 boundaries par groupe de routes.

---

## 1. Ordre des lots (aligné PRD §11) et durées estimées

Durées en **jours-homme solo** (Étienne + moi), hypothèse : pré-câblage soldé d'abord. Ce sont des estimations de cadrage, à affiner au fil de l'eau.

| Lot | Contenu | Dépend de | Estimé | Livrable vérifiable |
|---|---|---|---|---|
| **Pré-0** | Solder les 4 coutures (§3) sur le front mocké, build vert, comportement identique | — | **3-5 j** | Front async + tenant threadé + strings + boundaries, 0 régression visuelle |
| **Lot 0** | Bootstrap : `supabase/`, `packages/shared`, remote GitHub, CI, Sentry/PostHog, migrations fondatrices (orgs, profiles, memberships, clients, content_items, content_targets, notifications, push_subscriptions) + RLS + helpers `private` + leak tests pgTAP. Auth (magic link + OTP), invitation reviewer. PWA (manifest, Serwist, onboarding iOS). | Pré-0 | **8-12 j** | `supabase db push` OK, `get_advisors` clean, pgTAP vert, login réel fonctionne |
| **Lot 1** | Studio (machine à états, validation optionnelle), Module J (upload/conversion/TUS/thumbs), grille feed (DnD = permutation dates, import IG en seed), calendrier éditorial (fuseau client) | Lot 0 | **10-15 j** | Créer/éditer/programmer un contenu réel bout en bout (sans publication) |
| **Lot 2** | Worker (SKIP LOCKED, lease, idempotence, fenêtre grâce, watchdog pg_cron), URL signées + purge J+7, IG Login + import feed réel, Facebook, TikTok brouillon, health check tokens, notifications de publication. 🚩 Jour 1 : Spikes Meta + soumission revue TikTok. ⚠️ Supabase Pro avant 1er Reel. | Lot 1 | **15-20 j** | Publication IG réelle programmée → publiée par le worker, idempotence testée (kill -9) |
| **Lot 3** | Portail reviewer (accès cloisonné, invitation Brevo), ReviewRequests, commentaires + annotations pin, approbations versionnées, Realtime des statuts, flux approbation tardive | Lot 0 (auth) + Lot 1 (contenu) | **8-10 j** | Un reviewer invité valide/commente ; l'owner voit le statut en Realtime |
| **Lot 4** | OAuth Google + Microsoft (Vault), sync fenêtrée (cron 15 min), vue `unified_agenda`. 🚩 Jour 1 : vérif Google « scope sensible ». | Lot 0 | **6-8 j** | Agenda unifié affiche vrais RDV Google/Outlook + publications |

**Total MVP solo ≈ 50-70 j** hors délais externes (revues d'app Meta/TikTok qui courent en parallèle).

**Chemin critique** : Pré-0 → Lot 0 → Lot 1 → Lot 2. Les Lots 3 et 4 sont parallélisables après le Lot 1 (portail) / Lot 0 (agenda) mais on est solo, donc séquentiels. La contrainte réelle du planning n'est pas le code mais les **revues d'app** : TikTok (2-4 sem) et la vérif Google (~10 j) doivent être **soumises dès l'entrée dans leur lot**.

---

## 2. Mapping mocks → schéma DB cible (synthèse)

Le contrat mock recoupe fidèlement le PRD §6 sur le cœur. Trois catégories à trancher **au design du schéma, avant le Lot média** (source : rapport 06-backend-systems).

### 2.1 Entités mock ↔ tables PRD §6 (correspondance directe)

| Entité mock (`lib/mocks/types/`) | Table cible PRD §6 | Notes de câblage |
|---|---|---|
| `Organization` (core) | `organizations` | ajouter tout ce qui manque au mock (juste id+name aujourd'hui) |
| `User` (core) | `profiles` (1:1 auth.users) + `organization_members` | `timezone` → profiles ; rôle → memberships (PAS sur le user) |
| `Client` (core) | `clients` | **retirer `theme: keyof typeof IMAGES`** (couplage démo) ; `brandColor`/`timezone`/`archivedAt` OK ; `bio`/`category`/`notes` → `text` (dé-`L<string>`) |
| `SocialAccount` (core) | `social_accounts` (+ `social_account_secrets` deny-all) | `AccountStatus` mock a `expired` en trop → aligner sur `needs_reauth` seul |
| `ImportedPost` (core) | `imported_posts` | **ajouter `external_id`** (clé de dédup du feed IG, absente du mock) |
| `MediaAsset` (core) | `media_assets` | **ajouter cycle storage** : `storage_path`, `thumb_path`, `expires_at`, `original_deleted_at` |
| `ContentTarget` (core) | `content_targets` | **ajouter `client_id`+`org_id`** (FK composite anti-fuite) et `deleted_externally` |
| `ContentItem` (core) | `content_items` | title/caption/notes → `text` ; `pinned`/`excludeFromGrid`/`coverUrl`/`deletedAt`/`labels` à mapper |
| `Reviewer` (collab) | `client_members` (role reviewer) + jointure profiles | pas une table à part : c'est un membership |
| `Approval` (collab) | `approvals` (INSERT-ONLY) | `versionLabel: string` → **snapshot/hash de version** (piste d'audit) |
| `Comment` + `Annotation` (collab) | `comments` (annotation jsonb) | **`slideIndex` → retirer** ; jsonb acté = `{media_asset_id, x, y}` |
| `ReviewRequest` (collab) | `review_requests` + `review_request_items` | contentIds[] → table de jointure |
| `AppNotification` (collab) | `notifications` | `type: string` → **enum fermé** (10 types pilotent icône/tonalité) ; `href` → généré via `routes.ts` |
| `ContentVersion` (collab) | (snapshot dans `approvals` ou table `content_versions`) | à acter : table dédiée ou snapshot jsonb |
| `ActivityEntry` (collab) | `activity_log` (implicite) | acter la table du journal d'activité |
| `CalendarAccount` (core) | `calendar_accounts` (+ Vault) | provider_account_id = sub/oid, **jamais l'email** |
| `CalendarEvent` (core) | `calendar_calendars` + `calendar_events` | **le mock aplatit 3 niveaux à 2** : extraire `calendar_calendars` (colorVar/enabled/name y vont) |
| `PostMetrics` (library) | (métriques externes, post-MVP) | attribution par **identité stable**, pas par index de position |

### 2.2 Entités mock SANS table au PRD §6 — décisions de schéma à ACTER

Ces entités sont déjà consommées par 20+ écrans mais n'ont aucune table cible. **Il faut les ajouter au schéma dès le Lot 0/1** (règle §8 : toute table métier a `org_id` dès sa création), pas les découvrir au câblage.

| Entité mock | Écrans consommateurs | Décision requise |
|---|---|---|
| `LibraryAsset` (library) | médiathèque, composer (picker) | table `library_assets` + réutilise-t-elle le bucket `media-originals` ou un bucket dédié ? |
| `ContentPillar` (pro) | studio, calendrier, slots, perf | table `content_pillars` (org/client-level) |
| `HashtagGroup` (pro) | composer | table `hashtag_groups` |
| `BrandKit` (pro) | client-settings, composer, `lib/caption.ts` | table `brand_kits` (bannedWords pilote la détection) |
| `SavedView` (pro) | studio (board) | table `saved_views` ; **`filters.labels` doit stocker des IDs stables, pas des libellés FR** (bug EN confirmé) |
| `RecurringSlot` (pro) | calendrier éditorial | table `recurring_slots` |
| `ClientEvent` (pro) | calendrier éditorial | table `client_events` |
| `Client.notes` / labels transverses | studio, client-settings | colonnes ou tables selon cardinalité |

### 2.3 Divergences de forme (régressions silencieuses au branchement)

- **Agenda unifié** inclut les contenus `approved` non planifiés → la vue actée `unified_agenda` = PLANIFIÉS uniquement. Aligner le getter mock **maintenant** pour que le swap de vue ne change pas l'affichage.
- **Quotas mono-limite** : le mock a 1 limite/plateforme ; le worker en aura plusieurs (IG 100 posts + 400 conteneurs ; FB BUC + 30 Reels). Étendre le type `QuotaUsage` en tableau de compteurs.
- **`MemberRole = "owner" | "reviewer"`** écrase le modèle à 2 tables du PRD (`organization_members` owner/admin + `client_members` reviewer/editor). Séparer en 2 enums.

---

## 3. Les 4 coutures pré-câblage (le vrai travail à faire d'abord)

C'est le lot **Pré-0**. Il se fait **sur le front encore mocké**, à comportement identique (aucun changement visible pour Étienne), et c'est ce qui rend le Lot 0 un vrai swap et non une réécriture.

### Couture 1 — Façade async + server-only
- **Quoi** : `lib/mocks/index.ts` → tous les getters retournent des `Promise` (`return Promise.resolve(...)` en mock), wrappés dans `cache()` de React. Marquer la façade `server-only`. Les pages ajoutent `await`.
- **Les 7 call-sites clients** (`command-palette`, `notifications-button`, `client-health-banner`, `app-sidebar`, `client-switcher`, `quick-capture`, `nav-user`) : le layout `(app)` serveur charge un **contexte léger** {clients résumés, comptes en échec, unreadCount} passé en props/provider ; la recherche de contenus (palette ⌘K) passe par TanStack Query → route serveur (top-K, débounce).
- **Garde-fou** : règle Biome `no-restricted-imports` interdisant l'import des getters mocks depuis les fichiers `use client` (seuls les types restent importables).
- **Effort** : M · **Comportement** : inchangé.

### Couture 2 — Seam tenant (org/client)
- **Quoi** : créer `lib/auth/org-context.ts` avec `getActiveOrg()` (cf. CLAUDE.md §3, version mock retournant l'org unique) et threader `orgId`/`clientId` dans les getters. Même en mock mono-org, le **contrat** doit porter `org_id` (defense in depth §2.7).
- **Portail** : remplacer `DEMO_REVIEWER_CLIENT_ID` (dispersé dans 3-4 fichiers) par un **seam « contexte Reviewer »** résolvant les clients accessibles (multi-clients via `client_members`).
- **Effort** : M · **Comportement** : inchangé.

### Couture 3 — Résolution locale à la frontière (dé-`L<string>`)
- **Quoi** : les getters (server) prennent la locale (`getLocale()`) et retournent des types contrat en `string`. Les constantes mock gardent `L<string>` en interne, résolu **une fois** dans `index.ts` (pattern déjà prouvé par `getDashboardTasks`). Les composants ne connaissent plus que des `string` = shape DB exact.
- **Impact** : ~145 `pick()` disparaissent des composants ; le plus gros chantier de la couture (L).
- **Effort** : L · **Comportement** : inchangé (l'UI affiche toujours la bonne langue).

### Couture 4 — Horloge + boundaries + routing
- **`lib/clock.ts`** : `now(): Date` (retourne `MOCK_NOW` aujourd'hui, `new Date()` demain, surchargeable en test). Seul fichier autorisé à importer `mocks/time`. `lib/format.ts` et la logique métier consomment `clock.now()` ; passer `now: Date` en param des fonctions pures du studio.
- **Boundaries** : `error.tsx` + `loading.tsx` + `not-found.tsx` par groupe de routes (`(app)`, `(portal)`, `(auth)`) + `global-error.tsx` racine. Compléter la trilogie d'états async (ajouter `ErrorState`, primitive sœur d'`EmptyState`). `MediaThumb` gagne un état erreur/chargement (URL signées expireront).
- **Routing** : trancher le préfixe `/app`. Le middleware acté (CLAUDE.md §9) protège `startsWith('/app')` mais les routes sont à la racine (`/dashboard`, `/clients/...`). **Deux options** : (a) déplacer les routes sous `/app/*`, ou (b) réécrire le matcher du middleware pour la topologie réelle. À décider (§5, décision D-3).
- **Effort** : M (horloge) + M (boundaries) + S (routing) · **Comportement** : inchangé.

---

## 4. Couche d'accès données cible (le seam de swap)

```
packages/shared/
├── src/types/database.ts      # types générés Supabase (source de vérité)
├── src/types/domain.ts        # types contrat UI (= mocks actuels, dé-L<string>)
├── src/schemas/*.ts           # contrats Zod (Server Actions)
└── src/constants/quotas.ts    # PLATFORM_QUOTAS (source worker + UI)

apps/web/lib/data/             # façade async, remplace lib/mocks/index.ts
├── clients.ts    getClients(orgId), getClient(orgId, clientId)   [cache()]
├── content.ts    getContentItems(orgId, clientId, {page}), getContentItem(...)
├── portal.ts     getPortalContent(reviewerCtx), getPortalContentItem(...)
├── agenda.ts     getUnifiedAgenda(orgId)   # PLANIFIÉS uniquement
├── notifications.ts, library.ts, quotas.ts, ...
└── mutations/    createContentItem, scheduleContent, submitReview, ...  ('use server' + Zod)
```

**Stratégie de bascule** : module par module derrière la façade `lib/data/*`. Tant que la signature `getX(orgId, ...) : Promise<T>` et la forme de `T` sont stables, chaque module bascule de `Promise.resolve(MOCK)` à `await supabase.from(...)` **sans toucher l'UI**. On peut garder un flag `USE_MOCKS` par module pour un basculement incrémental (Lot 0 branche clients/dashboard, Lot 1 le contenu, etc.).

**Contrat d'états attendu par l'UI** (à câbler dès Pré-0) : chaque vue async gère loading (`loading.tsx`/Suspense), error (`error.tsx` + `ErrorState`), empty (`EmptyState`, déjà présent). C'est ce qui permet aux 500 Supavisor / refus RLS / timeouts d'hériter d'une architecture prête.

**Mutations** : aujourd'hui 100 % des écritures sont des `toast.success()` inline. Le câblage introduit des Server Actions `'use server'` Zod-validées injectant `org_id: ctx.org.id` (CLAUDE.md §3), avec `revalidatePath`/`revalidateTag`. Il n'existe aujourd'hui **aucun** stub de Server Action, ni React Hook Form + Zod, ni TanStack Query dans `package.json` — les trois sont à ajouter (stack imposée §1).

---

## 5. Décisions à faire acter par Étienne (avant Lot 0)

| # | Décision | Options | Reco |
|---|---|---|---|
| D-1 | Tables des 8 entités mock hors PRD §6 (§2.2) | les ajouter au schéma / en fusionner certaines / en différer | **Ajouter au Lot 0/1** (règle §8) — c'est du produit déjà en UI |
| D-2 | `LibraryAsset` : bucket | réutilise `media-originals` / bucket `library` dédié | à trancher (impacte les chemins storage) |
| D-3 | Préfixe `/app` | déplacer routes sous `/app/*` / réécrire matcher middleware | **Réécrire le matcher** (moins de churn sur les 23 pages + `routes.ts`) |
| D-4 | `ContentVersion` | table dédiée / snapshot jsonb dans `approvals` | à trancher |
| D-5 | `next-intl` vs dictionnaires maison | garder le custom actuel / migrer next-intl | **Garder le custom** (déjà en place, next-intl différé par CLAUDE.md §1) |
| D-6 | Ordre Lot 3 vs Lot 4 | portail avant agenda / inverse | **Portail (Lot 3) d'abord** (dépend de moins d'externes) |

---

## 6. Prérequis externes (à lancer tôt, délais parallèles)

- **Lot 0** : repo GitHub (remote absent aujourd'hui), projet Supabase (Free), **app Meta via use case Business** (pas de modes dev/live), app TikTok créée, Brevo (SMTP custom Supabase).
- **Lot 2 jour 1** : Spike 1 (visibilité Meta) + **soumission revue d'app TikTok** (2-4 sem) + Spike 2 (brouillon photo TikTok). **⚠️ Passage Supabase Pro avant le 1er test de Reel** (Free plafonne à 50 MB/fichier — garde-fou bloquant, décision actée §13.14).
- **Lot 4 jour 1** : **vérification Google « scope sensible »** (~10 j, sinon reconnexion hebdo des agendas).

---

## 7. Checklist mise en prod Coolify (résumé — détaillé au rapport 10-devops à venir)

- 2 apps Coolify : `web` (Next.js) + `worker` (Node). Dockerfile actuel = **web-only** → en ajouter un pour le worker.
- `/api/health` + `HEALTHCHECK` Docker (absents aujourd'hui).
- Env vars par environnement (web ET worker) : jamais de service role en `NEXT_PUBLIC_*`.
- Sentry (web + worker + Cron Monitors, sourcemaps) + PostHog EU.
- CI GitHub Actions : `typecheck` + `next build` + pgTAP + `get_advisors` sur chaque migration.
- Worker : connexion Supavisor **SESSION port 5432** (jamais 6543), horloge `now()` Postgres.
- PWA : SW ne cache jamais `/auth/v1/*` ni les POST ; `apple-touch-icon` PNG (manquante) ; runtime Node **pinné** (CLAUDE.md dit 20 LTS, l'image tourne en 22).

---

## 8. Ce qui va bien (à préserver absolument)

- **Le seam de branchement existe** : façade unique `lib/mocks/index.ts`, 100 % des pages en Server Components async → l'architecture de swap est la bonne.
- **Les enums recoupent le PRD §6** (ContentStatus, TargetStatus, Platform) : le contrat de statuts est déjà bon.
- **Séparation ContentItem/ContentTarget** correctement modélisée (état métier global vs par plateforme).
- **Design system** : `EmptyState` générique, primitives de statut factorisées, `MediaThumb` unique.
- **i18n FR/EN** cohérente sur la majorité des surfaces.

Ne rien casser de tout ça pendant le pré-câblage : les coutures se posent **autour** de ce socle, pas contre lui.
