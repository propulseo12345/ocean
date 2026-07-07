# Audit — Clean Architecture (2026-07-07)

> Dimension 05 — architecte senior, reconstruction propre. Objectif : séparer les responsabilités, augmenter la modularité, réduire le couplage, SANS changer le comportement produit. Cible imposée : convergence vers CLAUDE.md §4 (apps/web + apps/worker + packages/shared + supabase/) et préparation du swap mock→Supabase sans réécriture UI.

## Verdict

Le front validé est de bonne facture en surface — 23 pages en `async` Server Components, une façade data existante (`lib/mocks/index.ts`), des types miroir du PRD §6 — mais **le contrat central de la phase preview (CLAUDE.md §0 : « brancher Supabase ensuite sans réécrire l'UI ») n'est pas tenu en l'état**. Cinq verrous structurels s'y opposent : (1) la façade data est synchrone, fuit ses constantes brutes et est appelée au rendu par 8 composants client du shell ; (2) les types domaine sont contaminés par le wrapper bilingue démo `L<string>` (145 `pick()` dans 70 fichiers) ; (3) l'horloge figée `MOCK_NOW` est importée en dur par 22 fichiers, y compris `lib/format.ts` (utils → mocks : dépendance inversée) ; (4) types DB, méta statuts, quotas et specs — les actifs que `apps/worker` devra partager — vivent sous le dossier jetable `lib/mocks` (~230 points d'import) alors que `pnpm-workspace.yaml` déclare déjà `packages/*` vide ; (5) le middleware prescrit par CLAUDE.md §9 ne protège **aucune** route de cette arborescence (groupe `(app)` sans segment `/app`) — appliqué tel quel au câblage, l'app entière reste publique en silence. Risque principal pour la mise en prod et le câblage : **soit une réécriture UI sous pression en pleine phase backend (exactement ce que la phase preview devait éviter), soit des seams de compatibilité permanents (faux `L<>`, lib/mocks vivant en prod)** — plus un fail-open d'authentification si la recette documentée est suivie à la lettre. Tout est réparable maintenant par des mouvements mécaniques (codemods, extractions, façade async) ; dans trois mois, ce sera un refactoring à risque sur une UI en production.

## Fonctionnement reel observe

**Flux de données actuel (vérifié sur pièces) :**

1. **Pages → façade → fixtures.** Les 23 pages sont des `async` Server Components qui appellent la façade `apps/web/lib/mocks/index.ts` (getters `getClients`, `getContentItems`, `getComments`…) puis passent des props aux composants. Bon pattern… mais la façade est 100 % synchrone, ré-exporte les tableaux bruts (`index.ts:20-35` : `export * from "./brand"`, `export { CALENDAR_ACCOUNTS, CLIENTS, CURRENT_USER, ORG, REVIEWERS, SOCIAL_ACCOUNTS }`) et contient du code mort (`getActiveClient`, `index.ts:48`, zéro usage). Trois pages consomment les constantes brutes au lieu des getters (`app/(app)/agenda/page.tsx:15-17`, `dashboard/page.tsx:28-29`, `settings/accounts/page.tsx:33-34`).
2. **Shell client → mocks en direct.** 8 composants `"use client"` du chrome applicatif court-circuitent le pattern props et lisent les mocks au rendu synchrone : `components/app/app-sidebar.tsx:39`, `client-switcher.tsx:71`, `nav-user.tsx:26` (`CURRENT_USER` brut), `notifications-button.tsx:17-18`, `shell/command-palette.tsx:55`, `shell/quick-capture.tsx:37`, `shell/client-health-banner.tsx:10`, plus `shell/client-nav.ts:34` qui mélange helpers d'URL purs et accès données.
3. **Actifs durables sous le dossier jetable.** `lib/mocks/types/core.ts` = enums/entités miroir PRD §6 (importé par ~150 fichiers) ; `lib/mocks/labels.ts` = `contentStatusMeta`, `targetStatusMeta`, `platformMeta`, `API_PLATFORMS`, `MANUAL_PLATFORMS` (22 fichiers) ; `lib/mocks/quotas.ts:11-16` = `PLATFORM_QUOTAS` (les limites réelles CLAUDE.md §6). Cycle de couches : `mocks/labels.ts:1` importe `MessageKey` de `@/lib/i18n` pendant que `i18n/labels.ts:11` importe les méta de `@/lib/mocks/labels`.
4. **i18n démo dans les types domaine.** `lib/i18n/localized.ts:6` définit `L = {fr,en}` ; `types/core.ts:76-81` type `bio`, `category`, `notes` (et §147-176 : `title`, `caption`, `lastError`…) en `L<string>`. Résolution disséminée : 144-145 appels `pick()` dans 70 fichiers de `app/` et `components/`, plus 6 sites qui fabriquent des `loc(s,s)` artificiels (`components/app/studio/board-state.ts:96,114,123,162`…).
5. **Horloge.** `lib/mocks/time.ts:3` (`MOCK_NOW` figé au 11/06/2026) est importé par 22 fichiers dont `lib/format.ts:2` (câblé dans `isPast:63-65`, `formatRelative:52`, `isSameDay:68`) et des règles métier (`components/app/studio/composer/preflight.ts:243` — lead-time, `board-utils.ts:69-77` — retards).
6. **Routes et sécurité.** Le groupe `(app)` n'ajoute aucun segment : URLs réelles `/dashboard`, `/clients/[id]/…`, `/agenda` (`lib/routes.ts:4-26`). Aucun `middleware.ts`, aucun `app/api/` (pas de `/api/health`), aucun `error.tsx`/`not-found.tsx`/`loading.tsx`/`global-error.tsx` dans tout `app/`. `app/(app)/layout.tsx:17` est un shell UI sans garde. Portail : `DEMO_REVIEWER_CLIENT_ID` en dur dans `(portal)/layout.tsx:11-12`, `portal/page.tsx:19` (cast `as Client`), `portal/[contentId]/page.tsx:40`.
7. **Règles métier dans les mauvaises couches.** ~100 lignes de règles du feed IG dans `app/(app)/clients/[clientId]/grid/page.tsx:31-134` ; règle d'éditabilité `READ_ONLY` écrite 3× (`content/[contentId]/page.tsx:40`, `edit/page.tsx:30`, `components/app/studio/content-actions.tsx:15`) ; couche requête perf/report sous `components/app/performance/` (`perf-data.ts`, `report-data.ts` — consommés par les pages) ; règle de confidentialité `clientFacingStatus` dans un fichier de carte UI (`components/portal/portal-card.tsx:18-26`).
8. **Racine monorepo.** `pnpm-workspace.yaml:3` déclare `packages/*` (vide) ; `Dockerfile` racine web-only (`--filter web`, `node:22-alpine` vs CLAUDE.md §1 « node 20 » vs dev local en 24) ; aucun script `typecheck`, aucun `.github/`, aucun HEALTHCHECK.

**Lecture clean architecture :** il n'existe aujourd'hui que deux couches réelles — « présentation » (app/ + components/, avec des poches de logique métier et d'accès données) et « fixtures » (lib/mocks, qui contient à la fois le domaine, les données démo, l'horloge et une demi-façade). Le sens des dépendances est violé dans les deux directions : utils → mocks (`format.ts`), app → components pour de la donnée (`perf-data`), app → portal (`content-detail-media.tsx:6`), mocks ↔ i18n (cycle).

## Findings (tries par severite P0 -> P3)

### [P0] URLs du groupe `(app)` sans préfixe `/app` : le contrat middleware CLAUDE.md §9 ne protège RIEN dans cette arborescence, et aucun `middleware.ts` n'existe
- **Ou** : `apps/web/app/(app)/layout.tsx:17` (aucune garde auth) ; `apps/web/lib/routes.ts:4` (`'/dashboard'`) ; `apps/web/middleware.ts` ABSENT (glob vérifié) ; `apps/web/app/manifest.ts:9` (`start_url '/dashboard'`)
- **Constat** : le route group `(app)` n'ajoute pas de segment d'URL — les routes réelles sont `/dashboard`, `/clients/[id]/...`, `/agenda`, `/notifications`, `/settings/accounts`. Or le middleware prescrit par CLAUDE.md §9 protège via `pathname.startsWith('/app')` et redirige vers `/app/dashboard`. Tracé sur cet espace d'URL : **aucune route applicative ne matche**, tout tombe dans le `return response` final, et le redirect post-login `/app/dashboard` serait un 404. C'est une contradiction interne du document de référence lui-même (§4 produit `/dashboard`, §9 protège `/app`).
- **Scenario d echec / cout a l echelle** : au câblage Supabase, le dev colle le middleware §9 documenté → toutes les routes app restent publiques, sans erreur ni warning : un utilisateur déconnecté ouvre `/clients/cl_x/content` et obtient la page. Nuance actée en vérification : la defense-in-depth cible (RLS `TO authenticated` sur 100 % des tables, `getActiveOrg()` en première ligne des Server Actions) empêcherait la fuite de données réelles — le déconnecté verrait des coquilles vides, pas la data d'un tenant. Mais le modèle devient default-open : la sécurité repose sur la mémoire du développeur route par route.
- **Pourquoi ca bloque le scaling** : sur des années de routes ajoutées, une liste énumérée de préfixes protégés pourrit silencieusement ; l'auth doit être default-deny au niveau middleware pour que chaque nouvelle route naisse protégée. C'est LE point de divergence structure-réelle vs doc-de-référence à trancher AVANT toute écriture d'auth.
- **Reco** : acter la décision avant tout câblage. (a) Renommer le groupe en segment réel `app/` pour matcher §9 — déconseillé : change toutes les URLs validées (et le `start_url` du manifest). (b) **Recommandé** : acter l'arborescence actuelle et réécrire CLAUDE.md §9 en default-deny — middleware qui protège TOUT sauf allowlist publique explicite (`/`, `/login`, `/otp`, `/api/health`, `/api/oauth/*`, manifest/sw/assets) + branche `/portal` (authentifié sans org). Créer le squelette `middleware.ts` dès maintenant (no-op en preview) pour que le point d'ancrage existe et que le diff de câblage soit minimal.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §9 (middleware auth) + §4 — divergence interne du CLAUDE.md lui-même

### [P1] Façade data non swappable : getters synchrones, constantes brutes ré-exportées, 8 composants client du shell lisent les mocks au rendu
- **Ou** : `apps/web/lib/mocks/index.ts:20-35` (ré-export des tableaux bruts + `export {CLIENTS, CURRENT_USER, ORG, SOCIAL_ACCOUNTS, CALENDAR_ACCOUNTS…}`) ; `index.ts:48` (`getActiveClient` mort) ; `components/app/app-sidebar.tsx:39`, `client-switcher.tsx:71`, `nav-user.tsx:26`, `notifications-button.tsx:17-18`, `shell/command-palette.tsx:55`, `shell/quick-capture.tsx:37`, `shell/client-health-banner.tsx:10`, `shell/client-nav.ts:34` ; pages : `agenda/page.tsx:15-17`, `dashboard/page.tsx:28-29`, `settings/accounts/page.tsx:33-34`
- **Constat** : la façade — le seam déclaré du branchement Supabase — expose les getters ET les données brutes, en 100 % synchrone (0 `async`). Trois familles de consommateurs la contournent ou la figent : (1) 8 composants `"use client"` du chrome (chargé sur 100 % des pages) appellent `getClients()`/`getNotifications()`/`getSocialAccounts()`/`CURRENT_USER` dans le corps du rendu, sans props du layout ; (2) 3 pages serveur lisent les constantes module-level au lieu de getters ; (3) `getDashboardTasks(t, locale)` (`index.ts:156`) mélange requête et view-model i18n (imports `Translator`/`routes` dans la couche données). ~29 sites d'import `@/lib/mocks` dans `app/**`, 87 imports runtime `@/lib/mocks*` au total.
- **Scenario d echec / cout a l echelle** : au câblage, `getClients()` devient `await supabase.from('clients')…` et `CURRENT_USER` devient `supabase.auth.getUser()` — **impossible d'`await` dans le corps d'un composant client**, et une constante module-level n'offre aucun point d'interception. La sidebar, le switcher, la palette de commandes, le badge notifications doivent être restructurés (props ou TanStack Query) en même temps que la DB : exactement la réécriture UI que CLAUDE.md §0 interdit, avec risque de régression sur l'UI validée par Étienne. Pire : un site oublié qui lit encore une constante brute compile toujours et sert des données démo en prod à un vrai tenant.
- **Pourquoi ca bloque le scaling** : sans façade étanche (getter-only, async-only, fermée), chaque nouveau composant choisit librement getter / constante brute / import profond — la surface de câblage grossit à chaque feature au lieu de rester constante (1 adapter). Le shell est de plus la surface transverse du multi-tenant (switch d'org, santé tokens `needs_reauth`, badge Realtime) : chaque évolution backend retoucherait N composants au lieu d'un module.
- **Reco** : convertir la façade en **getter-only + async-only dès maintenant** (impls mock en `Promise.resolve(...)`) ; ajouter `getCurrentUser()`/`getOrg()`/`getCalendarAccounts()` ; supprimer les ré-exports de constantes et `getActiveClient`. Les composants shell reçoivent leurs données par props depuis les Server Components parents (pattern déjà appliqué à `today-panel`) ou via `hooks/data/` (`use-clients`, `use-notifications`, `use-current-user`…) qui encapsulent aujourd'hui les getters et demain TanStack Query + Realtime. Scinder `client-nav.ts` (helpers URL purs vs accès données) et `getDashboardTasks` (requête dans la façade, mapping i18n/href dans `lib/dashboard/tasks.ts`). Renommer le point d'entrée en `@/lib/data` (le mot « mocks » dans ~30 chemins d'import force sinon un rename global au swap). Verrouiller par Biome : seul `lib/data/mock/*` importe les fixtures.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (swap sans réécriture) + §1 (state: TanStack Query) + §2 règle 10 (org active côté serveur)

### [P1] Types DB cibles, méta statuts/plateformes et constantes durables enfermés sous `lib/mocks` (~230 points d'import) : le futur `packages/shared` est piégé dans le dossier jetable, avec cycle mocks↔i18n
- **Ou** : `pnpm-workspace.yaml:3` (`packages/*` déclaré, aucun package) ; `apps/web/lib/mocks/types/core.ts` (miroir PRD §6, importé par ~150 fichiers) ; `lib/mocks/labels.ts:1` (import `MessageKey` depuis `@/lib/i18n`) ↔ `lib/i18n/labels.ts:11` (import des méta depuis `@/lib/mocks/labels`) ; `labels.ts:81-83` (`pillarMeta` dérivé des données démo `CONTENT_PILLARS`) ; `app/(app)/clients/[clientId]/content/[contentId]/page.tsx:31` (`MANUAL_PLATFORMS` depuis `@/lib/mocks/labels`, règle métier `isManualTarget` lignes 42-49)
- **Constat** : `lib/mocks` mélange 4 natures : (a) jeux de données démo jetables (`CONTENT_ITEMS`…) ; (b) constantes de domaine permanentes (`labels.ts` : `contentStatusMeta`, `targetStatusMeta`, `platformMeta`, `API_PLATFORMS`, `MANUAL_PLATFORMS` — importées par 22 fichiers components et par des routes) ; (c) types/enums DB cibles (`types/core.ts`, ~150 fichiers) ; (d) horloge démo (`time.ts`). S'y ajoute un cycle de couches réel entre mocks et i18n, et `pillarMeta` couple la méta durable aux ids démo `pil_bru_*`. Ni les types ni ces métadonnées ne sont des mocks : c'est le modèle de domaine. CLAUDE.md §0 prescrit explicitement ces mocks typés dans `packages/shared` — divergence actée et confirmée.
- **Scenario d echec / cout a l echelle** : au swap, supprimer/neutraliser `lib/mocks` casse `isManualTarget` et tous les écrans qui lisent `platformMeta`/statuts — ou `lib/mocks` survit en prod comme dépendance du bundle avec les données démo embarquées. Au Lot 2, `apps/worker` doit consommer les MÊMES enums (`PublishJob`, `ContentTarget`) et ne peut pas importer depuis une app Next : soit duplication web/worker qui diverge silencieusement (un statut ajouté côté web, absent côté worker → job jamais traité ou mal agrégé), soit réécriture de ~230 imports en plein câblage backend.
- **Pourquoi ca bloque le scaling** : la machine à états PublishJob/ContentTarget doit être UNE source de vérité web+worker+Edge Functions+tests pgTAP sur des années ; toute divergence d'enum entre les deux apps = bug de publication (le verrou produit n°1). Le sens de dépendance doit être unique : `shared ← {web, worker}`. La séparation durable/jetable est le prérequis n°1 de la structure cible §4 — déplacé maintenant, c'est un codemod mécanique ; pendant le câblage, c'est un gel de feature + risque de régression sur l'UI validée.
- **Reco** : créer `packages/shared` (`@ocean/shared`) : `src/types/` (core, collab, library, pro — déplacés depuis `lib/mocks/types`), `src/constants/platforms.ts` (`platformMeta`, `API_PLATFORMS`, `MANUAL_PLATFORMS`), `src/constants/quotas.ts`, `status-meta.ts` (avec `labelKey` en string générique — l'app narrow vers `MessageKey` côté web, ce qui casse le cycle mocks↔i18n et libère le worker des dictionnaires). `pillarMeta` rejoint l'adapter mock (dérivé des fixtures, `ContentPillar.colorVar` = source de vérité). Migration : codemod `@/lib/mocks/types` → `@ocean/shared` ; `next.config` `transpilePackages:['@ocean/shared']` évite tout pipeline de build du package. Zod arrivera dans shared au Lot 0 (Server Actions), pas avant. Voir l'arborescence cible complète en fin de rapport.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (mocks typés dans packages/shared) + §4 (packages/shared : types DB, schémas Zod, constantes plateformes)

### [P1] Le wrapper bilingue démo `L<string>` contamine les types domaine : 145 appels `pick()` dans 70 fichiers à défaire au câblage
- **Ou** : `apps/web/lib/mocks/types/core.ts:76` (`bio: L<string>`) et `:147-176` (`title`, `caption`, `lastError`, `labels`, `internalNotes`…) ; `apps/web/lib/i18n/localized.ts:6` ; sites de création artificiels : `components/app/studio/board-state.ts:96,114,123,162`, `components/app/calendar/use-calendar-state.ts:92`, `components/app/studio/detail-thread.tsx:57`
- **Constat** : décision documentée du 19/06/2026 (entête de `core.ts`) : tous les champs narratifs des types « miroir du PRD §6 » sont typés `L<string> = {fr,en}`, résolus à l'affichage via `pick(field, locale)`. Mesuré : 144-145 appels `pick()` dans 70 fichiers de `app/` et `components/`. 6 sites de création côté client fabriquent des `L` artificiels via `loc(s,s)` pour rester compatibles (hack admis en commentaire dans `board-state.ts:63`). Aucune façade n'absorbe le problème : `lib/mocks/index.ts` exporte les fixtures `L<>` brutes, la résolution de locale est disséminée dans les composants.
- **Scenario d echec / cout a l echelle** : au câblage, `content_items.caption` revient de Postgres en string simple (PRD §6) : le type `ContentItem` n'est plus satisfait. Soit on réécrit les 70 fichiers consommateurs en pleine phase backend (la réécriture UI que CLAUDE.md §0 interdit), soit on emballe chaque row DB dans un faux `{fr:x, en:x}` pour toujours — mensonge de type permanent, `pick()` appliqué à des données qui ne sont pas bilingues.
- **Pourquoi ca bloque le scaling** : chaque nouvel écran ajouté d'ici le câblage crée de nouveaux call sites `pick()` — la dette croît linéairement avec le front. Le worker et les Server Actions futurs manipuleront des strings simples : deux représentations du même modèle coexisteraient dans le monorepo pendant des années.
- **Reco** : résoudre la locale **à la frontière de la façade data**, avant le câblage : (1) les types domaine (futur `packages/shared`) passent tous les champs narratifs en `string` simple ; (2) les fixtures gardent `L<>` en interne (type `DemoLocalized` réservé au dossier fixtures) ; (3) l'adapter mock fait `pick(fixture.title, locale)` et rend des objets domaine en string (la façade reçoit la locale — le toggle FR/EN du contenu démo est conservé). Les 145 `pick()` des composants disparaissent par codemod mécanique (`pick(c.title, locale)` → `c.title`), les `loc(s,s)` de création deviennent des strings. UI identique au pixel.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (« brancher Supabase ensuite sans réécrire l'UI ») ; PRD §6 (`content_items.caption` = texte simple)

### [P1] Horloge figée `MOCK_NOW` importée en dur par 22 fichiers — y compris `lib/format.ts` (utils → mocks : dépendance inversée) et des règles métier — sans aucun seam d'horloge
- **Ou** : `apps/web/lib/format.ts:2` (câblé dans `isPast:63-65`, `formatRelative:52`, `isSameDay:68`) ; `lib/mocks/time.ts:3` ; règles métier : `components/app/studio/composer/preflight.ts:243` (lead-time minimal), `board-utils.ts:69-77` (retards), `composer-utils.ts:92-105` (créneau par défaut), `grid-date-utils.ts:37-72` ; + `lib/marronniers.ts:2,121`, `app/(app)/dashboard/page.tsx:13`, `calendar-schedule.ts:66`, `use-calendar-state.ts:37`, `unified-agenda.tsx:52`, `board-kanban.tsx:16`, `board-schedule-dialog.tsx:24`, `detail-manual-center.tsx:12`… (22 fichiers au total)
- **Constat** : l'horloge démo figée au 11/06/2026 est une constante brute importée directement par la couche utils générique, par des règles métier (préflight, retards, planification) et par des composants. Le sens de dépendance est inversé (utils génériques → mocks). Les helpers de fixtures `days`/`hours`/`fromNow` sont aussi appelés au runtime UI. Le frozen clock résout un vrai problème (déterminisme d'hydratation — aucun `Date.now()` au rendu), mais sans point d'accès unique.
- **Scenario d echec / cout a l echelle** : passage en prod — le swap naïf `MOCK_NOW = new Date()` compile mais fige l'horloge **au boot du process serveur Next longue durée** (+ drift d'hydratation client/serveur) : posts programmés affichés « en retard » pour toujours, agenda du jour vide, fenêtre 24 h des quotas fausse, préflight qui refuse/accepte des créneaux à tort. Bugs silencieux, aucune erreur de compilation. La constante `Date` est la mauvaise forme d'API pour une horloge injectable.
- **Pourquoi ca bloque le scaling** : chaque écran temporel futur ajoute un import `MOCK_NOW` ; le problème d'hydratation devra être résolu proprement en prod (instant résolu par requête côté serveur, transmis aux clients) — impossible sans seam unique. Côté worker, l'horloge est `now()` Postgres (règle 17) : les deux mondes doivent rester découplés proprement.
- **Reco** : créer `apps/web/lib/clock.ts` : `now(): Date` — implémentation preview = `MOCK_NOW`, implémentation prod = instant serveur injecté par le layout (stable par requête, hydratation déterministe). `format.ts`, `marronniers.ts` et tous les composants consomment `clock.now()`. Les helpers de construction de fixtures (`fromNow`, `dayAt`) restent dans les fixtures ; les usages runtime UI de `days`/`hours`/`fromNow` sont rebasés sur clock. Interdire l'import de `lib/mocks/time` hors de `lib/data/mock` (Biome). Swap prod = 1 fichier.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (préparation du câblage) ; §5 (horloge = now() Postgres côté worker) ; §12 (stockage UTC, TZ client/freelance)

### [P1] Tenant reviewer de démo (`DEMO_REVIEWER_CLIENT_ID`) codé en dur dans les 3 fichiers de routes du portail au lieu d'un seam « contexte Reviewer »
- **Ou** : `apps/web/app/(portal)/layout.tsx:11-12` ; `apps/web/app/(portal)/portal/page.tsx:19` (cast `as Client` masquant le null) ; `apps/web/app/(portal)/portal/[contentId]/page.tsx:40` (+ 2e cast `as Client` ligne 45)
- **Constat** : le layout portail résout `getClient(DEMO_REVIEWER_CLIENT_ID)` + `getReviewer(DEMO_REVIEWER_CLIENT_ID)` inline ; la page liste caste `as Client` un retour typé `Client | undefined` puis déréférence `client.timezone` ; la page détail vérifie le scoping tenant contre la constante démo. CLAUDE.md §3 prescrit un contexte Reviewer résolu via `client_members` (équivalent portail de `getActiveOrg`), jamais un client fixe. Le layout actuel est structurellement **mono-client** alors que le modèle `client_members` du PRD est multi-clients. `lib/auth/` n'existe pas.
- **Scenario d echec / cout a l echelle** : au câblage — chasse au `DEMO_REVIEWER_CLIENT_ID` dans 3 fichiers de routes ; le cast `as Client` devient un crash runtime dès que `getClient` devient un appel DB nullable (révocation d'un Reviewer = effet immédiat exigé par la règle 4 §2). Un câblage naïf « premier `client_members` trouvé » rendrait le portail silencieusement faux pour un reviewer multi-clients.
- **Pourquoi ca bloque le scaling** : le portail est la surface multi-tenant la plus sensible (utilisateur externe) — son scoping doit passer par UN point unique et auditable, pas par des constantes éparpillées que chaque nouvel écran portail ré-importera.
- **Reco** : créer `lib/auth/reviewer-context.ts` exposant `getReviewerContext(): Promise<{ reviewer, clients: Client[] } | null>` — impl mock qui renvoie le reviewer démo aujourd'hui, impl Supabase (`client_members` via helpers `private.*`) demain. Layout et pages consomment ce contexte ; remplacer les casts `as Client` par `notFound()`. Prévoir le multi-clients dans la signature dès maintenant (liste, pas singleton).
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §3 (contexte Reviewer) + §2 règles 4 et 6 (client_members, révocation immédiate)

### [P1] PWA iOS : manifest avec une seule icône SVG (ignorée par iOS), pas d'apple-touch-icon PNG, hex de marque dupliqués manifest/viewport
- **Ou** : `apps/web/app/manifest.ts:15` (`icons: [{ src: '/icon.svg' }]`) ; `apps/web/app/layout.tsx:28` (`appleWebApp` sans icône raster) et `:33-36` (mêmes hex `#0f3d63`/`#0b2238` redéclarés vs `manifest.ts:12-13`)
- **Constat** : le manifest ne déclare qu'une icône SVG `any`. Safari iOS ignore les icônes SVG du manifest et exige un PNG (apple-touch-icon 180×180 ou convention `app/apple-icon.png`, absente — `public/` ne contient que des SVG placeholders). Les deux hex de marque sont écrits en dur à deux endroits sans source commune. `name`/`description` du manifest figés en FR (app FR/EN — limitation à acter).
- **Scenario d echec / cout a l echelle** : mise en prod imminente + Étienne premier utilisateur sur iPhone : « Ajouter à l'écran d'accueil » produit une icône = screenshot de la page et un splash générique. L'onboarding d'installation PWA « soigné, priorité iOS » (§0/§12) est cassé au premier geste du parcours prioritaire.
- **Pourquoi ca bloque le scaling** : prod-readiness surtout ; la duplication des hex divergera au premier rebranding (le futur worker/emails Brevo utiliseront aussi ces couleurs).
- **Reco** : générer les PNG (icon-192, icon-512, maskable, apple-touch-icon 180) via les conventions fichiers de `app/` (`apple-icon.png`, `icon.png`) + les déclarer dans `manifest.ts` ; centraliser les 2 hex dans une constante unique (`lib/brand.ts`, future `packages/shared/constants/brand.ts`) importée par `manifest.ts` et `layout.tsx`. Acter la langue du manifest (fr).
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0/§12 (PWA priorité iOS) + règle 25 (source unique des couleurs)

### [P2] Constantes de quotas plateformes (source de vérité future du worker) enterrées dans la couche mock, couplées au type i18n de l'app
- **Ou** : `apps/web/lib/mocks/quotas.ts:11-16` (`PLATFORM_QUOTAS` : IG 100, FB 30, TikTok 5) ; `:20-30` (fixture `BASE_USAGE`) ; `:41-70` (`getQuotaUsage`/`mockUsage`)
- **Constat** : `PLATFORM_QUOTAS` (les limites réelles de CLAUDE.md §6) cohabite dans le même fichier avec la fixture `BASE_USAGE` et la règle de calcul `mockUsage` qui encode déjà la vraie sémantique métier (IG = posts publiés, FB = Reels uniquement, TikTok = brouillons poussés, fenêtre 24 h glissante) — sémantique qui n'existe nulle part ailleurs. La constante embarque `windowKey: MessageKey` (type i18n de apps/web) : le futur worker ne peut pas l'importer sans traîner les dictionnaires.
- **Scenario d echec / cout a l echelle** : le worker (règle 19 : rate limiting PAR social_account) devra enforcer exactement ces limites et cette sémantique. Enterrées sous `lib/mocks`, elles seront recopiées dans `apps/worker` au Lot 2 → le jour où Meta change une limite, deux endroits à modifier, et la jauge UI peut afficher un quota différent de celui réellement enforcé.
- **Pourquoi ca bloque le scaling** : CLAUDE.md §6 : « Enforcement côté DB/worker (source de vérité), UI = affichage » — cela exige physiquement une constante partagée unique, pas une copie par app.
- **Reco** : `PLATFORM_QUOTAS` + la sémantique de comptage → `packages/shared/constants/quotas.ts` (clé de fenêtre en string générique, narrowée côté web). `getQuotaUsage` devient un getter async de la façade `lib/data` (impl mock garde `BASE_USAGE` dans les fixtures ; impl Supabase interrogera DB/worker). À traiter à la création de `packages/shared` (Lot 0).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §6 (quotas — enforcement DB/worker) + §4 (packages/shared : constantes quotas)

### [P2] Le type domaine `Client` dépend du catalogue d'images démo (`theme: keyof typeof IMAGES`)
- **Ou** : `apps/web/lib/mocks/types/core.ts:74` ; fuite hors fixtures : `components/app/library/use-library-assets.ts:31` (`IMAGES[client.theme]`)
- **Constat** : `Client.theme` est typé `keyof typeof import("../images").IMAGES` — le type cœur du modèle référence le module d'URLs Pexels, alors que l'entête du même fichier promet « aucune dépendance backend » et que le Client du PRD porte un `logo` (pas de colonne `theme`). Aucun `logoUrl` dans le type.
- **Scenario d echec / cout a l echelle** : impossible d'extraire `types/core.ts` vers `packages/shared` sans embarquer `images.ts` et ses URLs Pexels ; au câblage, le champ `theme` n'a pas de colonne DB correspondante → cassage du type sur chaque row `clients`.
- **Pourquoi ca bloque le scaling** : un type partagé worker+web+migrations ne peut pas dépendre d'assets de démo ; ce couplage type→fixture se multiplie s'il n'est pas coupé au premier cas.
- **Reco** : dans les types domaine : `logoUrl?: string` (aligné PRD `clients.logo`). Le `theme` devient `DemoClientExtras{clientId, theme}` côté fixtures, consommé uniquement par l'adapter mock pour fabriquer les visuels de démo.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 (clients : name, logo, brand_color, timezone) ; CLAUDE.md §4 (packages/shared)

### [P2] Zéro boundary `error`/`not-found`/`loading` dans tout `app/` : les échecs rendront les pages par défaut de Next, non brandées, sans capture Sentry
- **Ou** : `apps/web/app/(app)/clients/[clientId]/layout.tsx:24` (`notFound()` → 404 par défaut) ; glob `error.tsx`/`loading.tsx`/`not-found.tsx`/`global-error.tsx` = 0 fichier ; 14 appels `notFound()` dans 13 fichiers (dont le portail)
- **Constat** : 13 fichiers appellent `notFound()` (client inexistant, contenu archivé…) et aucune route ne définit de boundary. En preview mock, les getters ne throwent jamais — le trou est invisible aujourd'hui, mais `/clients/id-inconnu` affiche déjà la 404 Next par défaut, y compris côté portail face client.
- **Scenario d echec / cout a l echelle** : dès le câblage, un échec réseau/RLS dans un Server Component affiche la page d'erreur générique de Next (anglais, non brandée) sans remontée Sentry côté rendu. Sans `loading.tsx`, aucun streaming fallback sur les segments lourds (grid, calendar) quand les fetches deviendront réels.
- **Pourquoi ca bloque le scaling** : chaque nouvelle route hérite du trou ; après câblage, les erreurs backend sont le quotidien — les boundaries sont le point d'ancrage render-side du Sentry acté (stack §1).
- **Reco** : ajouter `app/not-found.tsx` et `app/global-error.tsx` (hook Sentry prêt à brancher), `(app)/error.tsx` et `(portal)/error.tsx` brandés, + `loading.tsx` sur `clients/[clientId]` (skeleton). À faire AVANT la mise en prod pour que le câblage tombe sur des filets existants.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui (seuls les chemins d'erreur changent — le happy path validé est intact)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (errors: Sentry web) — indirect

### [P2] ~100 lignes de règles métier du feed IG enfermées dans `grid/page.tsx`, et règle d'éditabilité `READ_ONLY` écrite 3 fois
- **Ou** : `apps/web/app/(app)/clients/[clientId]/grid/page.tsx:31-134` (`PLANNED_STATUSES`, `inFeed`, `publishedDate`, `toContentTile`, `toImportedTile`) et `:150-205` (assemblage pinned/published/shelf + profil IG) ; `clients/page.tsx:17-26` (`clientStats`) ; `READ_ONLY` : `content/[contentId]/page.tsx:40`, `content/[contentId]/edit/page.tsx:30`, `components/app/studio/content-actions.tsx:15`
- **Constat** : la route grid (225 lignes, en approche du plafond 250) contient les règles produit de l'écran signature : quels statuts restent visibles dans la grille (correctif audit §1 P0 documenté en commentaire lignes 29-30), quelle date fait foi pour un publié, comment un ContentItem devient une tuile — le tout non exporté, donc ni testable ni réutilisable. La règle d'éditabilité PRD §5.B est dupliquée en 3 exemplaires.
- **Scenario d echec / cout a l echelle** : au câblage, la requête Supabase du feed devra reproduire exactement `PLANNED_STATUSES`/`inFeed` ; règles dupliquées entre page et query = divergence silencieuse — un `failed` qui redisparaît de la grille est précisément la régression P0 que l'audit §1 avait corrigée.
- **Pourquoi ca bloque le scaling** : la grille est l'écran différenciant du produit ; ses invariants doivent vivre dans un module pur, testé, réutilisable par la future query et par le portail.
- **Reco** : extraire un view-model pur : `lib/feed/grid-view.ts` avec `buildGridViewModel(items, importedPosts, opts)` → `{ pinned, scheduled, published, imported, shelf, profile }` + les constantes de statuts ; la page devient I/O pur (params → fetch → build → render). Extraire la règle `READ_ONLY` dans `lib/content/editability.ts`, importée par les 3 sites. Aucun pixel ne change.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : règle 24 (225/250 en approche) ; PRD §5.B (règle d'éditabilité dupliquée)

### [P2] Inversion de couche : les pages importent données et règles métier depuis `components/` (perf-data, report-data, clientFacingStatus, wrapper tz) — sans garde-fou `server-only`
- **Ou** : `apps/web/app/(app)/clients/[clientId]/performance/page.tsx:3` (`getAllPerfData` depuis `components/app/performance/perf-data`) ; `report/page.tsx:3` (`getReportData`) ; `content/new/page.tsx:8` (`zonedToUtcIso` via `components/.../composer-utils`, pass-through de `lib/tz`) ; `(portal)/portal/[contentId]/page.tsx:6` (`clientFacingStatus`/`statusBadgeLabel` depuis `components/portal/portal-card.tsx:18-26`) ; fait aggravant : `perf-workspace.tsx:12` (`"use client"`) importe `PERIOD_META` en valeur depuis `perf-data.ts` → le graphe du module (façade mocks incluse) part déjà dans le bundle client
- **Constat** : des modules d'assemblage de données (perf-data.ts — qui se décrit lui-même « couche de données », report-data.ts, perf-breakdown.ts, 342 lignes cumulées) et une règle de confidentialité produit (`clientFacingStatus` : failed→scheduled, publishing→scheduled, partially_published→published — le client ne doit jamais voir un statut interne brut) vivent sous `components/` et sont consommés par la couche route. Aucun `import 'server-only'` dans l'app hors `lib/i18n/server.ts`.
- **Scenario d echec / cout a l echelle** : au câblage, perf-data/report-data deviennent des requêtes Supabase scopées org/client (RLS + filtre explicite, règle 7) : soit la logique de requête part côté navigateur (import client qui compile), soit on déplace ces modules en cassant les imports du studio sous pression. `clientFacingStatus` est une règle que le worker et les emails Brevo (`publish-failed`) devront appliquer à l'identique — introuvable dans un fichier de carte UI.
- **Pourquoi ca bloque le scaling** : le sens des dépendances doit être `components → lib`, jamais `app → components` pour de la donnée ; `lib/data/` + `server-only` rend le mauvais usage impossible à la compilation.
- **Reco** : déplacer `perf-data.ts`, `perf-breakdown.ts`, `report-data.ts` vers `lib/data/performance/` (marqués `server-only` au câblage ; les constantes UI type `PERIOD_META` restent côté composants ou dans un module de view-model importable client) ; extraire `clientFacingStatus`/`statusBadgeLabel` vers `lib/review/status.ts` (candidat packages/shared) ; `content/new` importe `zonedWallToUtcIso` depuis `@/lib/tz` directement.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §4 (séparation lib/ vs components/) + §2 règle 7 (filtre org côté serveur)

### [P2] Duplications divergentes onboarding vs réglages client : deux palettes de marque incompatibles et deux `string-list-editor`
- **Ou** : `apps/web/components/app/onboarding/wizard-types.ts:99` (`BRAND_COLORS`, 12 teintes oklch) vs `apps/web/components/app/client-settings/constants.ts:15` (`BRAND_HUES`, 12 teintes) ; deux `brand-color-palette.tsx` (APIs incompatibles) ; deux `string-list-editor.tsx`
- **Constat** : deux catalogues oklch pour le même concept (couleur de marque du client, futur `clients.brand_color`) ne partagent que ~5 valeurs (coral 0.55 0.15 25 vs brick 0.55 0.15 30 ; blue 235 vs ocean 230 ; slate a déjà divergé : 0.5 0.05 280 vs 0.45 0.04 250). `section-profile.tsx:44/123` injecte `client.brandColor` dans la palette BRAND_HUES uniquement.
- **Scenario d echec / cout a l echelle** : un client créé au wizard avec « coral » arrive dans Réglages : aucune pastille sélectionnée, et changer de couleur perd l'ancienne sans équivalent. Dès que les deux écrans écrivent la même colonne DB, valeurs orphelines garanties en base. Chaque amélioration (contraste, teinte) doit être faite deux fois.
- **Pourquoi ca bloque le scaling** : chaque paire dupliquée diverge davantage avec le temps ; `brand_color` étant persisté, l'incohérence devient de la donnée sale.
- **Reco** : un seul référentiel `BRAND_HUES` dans le module domaine (celui qui alimentera `clients.brand_color`) et un seul `BrandColorPalette` + un seul `StringListEditor` dans `components/shared/`, paramétrés par props. Faire arbitrer par Étienne la palette unifiée (le visuel d'un des deux écrans change).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui (palette unifiée = un des deux écrans change visuellement)   **Verrou PRD/CLAUDE.md** : PRD §6 (clients.brand_color) ; règle 25
- 
### [P2] Aucune route `/api/health` ni HEALTHCHECK — l'image Docker part en prod sans sonde alors que la mise en prod Coolify est l'étape déclarée
- **Ou** : `Dockerfile:37` (EXPOSE 3000 sans HEALTHCHECK) ; `apps/web/app/` ne contient aucun dossier `api/`
- **Constat** : le runner Docker expose 3000 et lance `server.js` sans HEALTHCHECK, et l'app n'a aucune route API : le `app/api/health/route.ts` prévu par CLAUDE.md §4 et référencé par le middleware §9 n'existe pas. Une route health est du pur Next sans dépendance Supabase — rien ne justifie son absence par la phase preview.
- **Scenario d echec / cout a l echelle** : Coolify déploie et bascule le trafic sans vérifier que Next répond ; un standalone qui crash au boot (variable d'env manquante au câblage) = downtime silencieux dès le premier deploy prod, sans rollback automatique.
- **Pourquoi ca bloque le scaling** : toute la chaîne deploy/rolling-update/watchdog des années suivantes s'appuie sur cette sonde.
- **Reco** : créer `apps/web/app/api/health/route.ts` (200 + commit SHA/version), pointer le health check Coolify dessus, ajouter un HEALTHCHECK wget/curl dans le stage runner du Dockerfile.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §4 (api/health — health check Coolify) + §9

### [P2] Runtime Node non pinné : CLAUDE.md dit 20 LTS, l'image prod tourne en 22 (fix forcé par pnpm 11), la machine dev est en 24, `engines` accepte `>=20`
- **Ou** : `package.json:6` (engines node >=20) ; `Dockerfile:4` (node:22-alpine) ; commit 253dbfe
- **Constat** : le commit 253dbfe (« fix(deploy): Node 22 dans le Dockerfile (pnpm 11.1.2 incompatible Node 20) ») a déjà forcé Node 22 en prod, mais CLAUDE.md §1 dit toujours node 20 LTS, `engines` reste `>=20` non borné (alors que le package manager pinné y est cassé — contradiction interne prouvée par le commit), aucun `.nvmrc`, dev local en 24.13.0. Quatre versions coexistent.
- **Scenario d echec / cout a l echelle** : divergence dev(24)/prod(22) : une API Node 24-only utilisée en dev (et validée visuellement) casse dans l'image 22 au build ou au runtime ; le précédent existe (fix prod à chaud). Le worker (long-running, advisory locks) sera encore plus sensible à ce drift.
- **Pourquoi ca bloque le scaling** : web + worker + CI doivent partager une version Node unique et bornée pendant des années ; sans pin, chaque montée de version machine crée un environnement fantôme.
- **Reco** : pinner engines à `>=22 <23`, ajouter `.nvmrc` `22` à la racine, aligner la future CI, et acter avec Étienne la mise à jour de CLAUDE.md §1 (node: 22 LTS) — la ligne actuelle est périmée.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (node: 20 LTS — verrou périmé à réacter)

### [P2] Aucun script `typecheck` ni squelette CI au root — le seul filet de typage est le `next build` dans Docker
- **Ou** : `package.json:8-15`
- **Constat** : scripts root = dev/build/start (tous `--filter web`) + biome check/format. Aucun `tsc --noEmit`, aucun test runner, pas de `.github/workflows` (cohérent avec l'absence de remote — pas un bug en soi, mais rien n'est prêt).
- **Scenario d echec / cout a l echelle** : à la mise en prod, une erreur TS n'est détectée qu'au `next build` dans l'image (minutes) au lieu d'un tsc local/CI (secondes) ; au câblage, les leak tests pgTAP exigés par CLAUDE.md §2 règle 8 n'auront aucun pipeline où s'accrocher.
- **Pourquoi ca bloque le scaling** : le monorepo passe de 1 à 3 packages ; sans commandes agrégées (`pnpm -r`) ni workflow prêt, chaque package invente sa discipline.
- **Reco** : ajouter `typecheck` root (`pnpm -r exec tsc --noEmit`) + équivalent dans apps/web ; préparer `.github/workflows/ci.yml` (biome → typecheck → build web) à committer avec la création du remote, en réservant les jobs pgTAP/get_advisors du Lot 0.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (ci: GitHub Actions) + §2 règle 8 (pgTAP en CI)

### [P3] `MemberRole = "owner" | "reviewer"` : le miroir de types écrase le modèle de rôles à deux tables du PRD
- **Ou** : `apps/web/lib/mocks/types/core.ts:47` ; unique consommateur : `Comment.role` (`collab.ts:39`, 4 usages présentationnels)
- **Constat** : le type fusionne en un seul enum ce que PRD §6 et CLAUDE.md §2 règle 4 modélisent en deux tables : `organization_members` (owner|admin) et `client_members` (reviewer|editor). Les rôles admin et editor n'existent pas dans le miroir. Blast radius actuel limité (style des bulles de commentaires agence/client), mais un type nommé `MemberRole` est un piège pour le câblage de la couche permissions.
- **Scenario d echec / cout a l echelle** : au câblage RLS, le mapping helpers `private.*` → UI ne tombe pas : re-typage des branchements de permission en pleine phase où une erreur = fuite de capacité (un editor traité comme owner).
- **Pourquoi ca bloque le scaling** : le multi-tenant est LE verrou du produit ; plus le front grossit sur un modèle de rôle simplifié, plus la mise en conformité coûte cher.
- **Reco** : aligner maintenant : `OrgRole = 'owner' | 'admin'` et `ClientRole = 'reviewer' | 'editor'`, avec `OrganizationMember{userId, orgId, role}` et `ClientMember{userId, clientId, role}` dans les types domaine. Les mocks instancient owner + reviewer (UI strictement identique).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règle 4 ; PRD §6

### [P3] Règle des 250 lignes : 12 fichiers du périmètre en infraction sans exemption actée, et zéro outillage pour la faire respecter
- **Ou** : `apps/web/lib/i18n/dictionaries/zones/studio.fr.ts:1` (464 l.) + studio.en 432, calendar.fr/en 319×2, onboarding.fr 276, composer.en 272, composer.fr 270, `lib/mocks/history.ts` 270, onboarding.en 256 ; fichiers produit : `components/app/studio/composer/preflight.ts` (296 l., ~9 checks dans un module), `composer-media.tsx` (257), `onboarding/wizard-types.ts` (257 — types + 8 catalogues de constantes) ; `biome.json:25-48` (aucune contrainte de taille, et Biome n'a pas de règle max-lines native)
- **Constat** : CLAUDE.md règle 24 (≤250 lignes) ne prévoit aucune exception, or 9 fichiers de lib (dictionnaires i18n + history.ts) et 3 fichiers produit la dépassent (ui/sidebar.tsx 691 et dropdown-menu.tsx 257 = shadcn vendoré, hors grief). Rien ne vérifie la règle : ni Biome, ni CI, ni script.
- **Scenario d echec / cout a l echelle** : une règle de fer avec exceptions tacites cesse d'être auditable — chaque futur dépassement invoquera le précédent des dictionnaires. Le préflight grossira à chaque plateforme/règle ; les catalogues enfouis dans wizard-types.ts sont déjà dupliqués plutôt que retrouvés (cas BRAND_COLORS vs BRAND_HUES, avéré). Dans 2 ans, fichiers de 600+ lignes et refactos backend plus risqués.
- **Pourquoi ca bloque le scaling** : une règle non exécutable ne survit ni à la croissance du code ni aux sessions agentiques successives ; les dictionnaires zone sont les fichiers à plus forte croissance mécanique du repo.
- **Reco** : trancher explicitement — scinder par sous-namespace (studio.board/studio.detail, calendar.grid/calendar.filters ; history.ts → versions.ts + activity.ts) OU acter dans CLAUDE.md une exemption formelle « dictionnaires i18n et fixtures » avec plafond dédié (ex. 500). Scinder `preflight.ts` en checks unitaires (`composer/preflight/checks-*.ts` + agrégateur) ; extraire les constantes de `wizard-types.ts` vers `onboarding/constants.ts`. Ajouter un check CI simple (script node listant les .ts/.tsx > 250 hors exemptions, exit en erreur) branché sur le futur workflow. Pas de zone grise.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règle 24

### [P3] `specs.ts` duplique les libellés de plateformes déjà définis dans `platformMeta`, avec fallback silencieux
- **Ou** : `apps/web/lib/specs.ts:124-128` (`platformName`) vs `lib/mocks/labels.ts:93-100` (`platformMeta`)
- **Constat** : `platformName()` re-hardcode "TikTok"/"Facebook"/"Instagram" (if-chain avec default "Instagram") alors que `platformMeta` est un `Record<Platform,…>` exhaustif vérifié par le compilateur. Deux définitions du même nom propre dans deux couches, dont l'une échappe à l'exhaustivité.
- **Scenario d echec / cout a l echelle** : ajout d'une plateforme (LinkedIn post-MVP) : `platformMeta` est forcé par le compilateur, `platformName` retourne silencieusement "Instagram" → messages de validation faux (« Une vidéo est requise… sur Instagram » pour un média LinkedIn).
- **Pourquoi ca bloque le scaling** : micro-duplication, mais elle siège dans le module specs qui sera partagé avec le worker — le pire endroit pour une divergence de libellés.
- **Reco** : après déplacement de `platformMeta` vers `packages/shared/constants/platforms.ts`, `specs.ts` importe `platformMeta[p].label` et supprime `platformName`. Fallback exhaustif via `Record<Platform, …>` vérifié par le compilateur.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Divergences cosmétiques §4 : landing hors groupe `(marketing)`, bloc BrandMark dupliqué 3×, feature-list dupliquée, import dynamique inutile dans le root layout
- **Ou** : `apps/web/app/page.tsx:15` (landing inline hors `(marketing)/`) ; `app/page.tsx:34-39` vs `(auth)/layout.tsx:8-17` vs `(portal)/layout.tsx:18-23` (logo Waves+Ocean recopié) ; `app/page.tsx:17-23` vs `(auth)/layout.tsx:21-27` (feature-list) ; `app/layout.tsx:19` (import dynamique de `@/lib/i18n/server` déjà importé statiquement ligne 7)
- **Constat** : CLAUDE.md §4 prévoit un groupe `(marketing)/` ; la landing vit à la racine. Le bloc de marque est recopié dans 3 fichiers, la liste des 5 features dans 2, et `generateMetadata` fait un `import()` dynamique redondant.
- **Scenario d echec / cout a l echelle** : rebranding (le codename Ocean DOIT être vérifié INPI avant lancement, §0) = retoucher 3+ fichiers ; oubli d'un site = marque incohérente. Coût faible mais certain.
- **Pourquoi ca bloque le scaling** : négligeable — pure maintenabilité.
- **Reco** : créer `components/shared/brand-mark.tsx` (variantes tailles) + constante partagée pour la feature-list ; déplacer la landing vers `app/(marketing)/page.tsx` (les groupes ne changent pas l'URL — zéro impact) ; supprimer l'import dynamique redondant.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §4 ((marketing)) + §0 (rebranding probable)

### [P3] `slots-week-preview` résout la couleur des piliers via un map global keyé sur les ids mock, au lieu des props comme son voisin `slot-row`
- **Ou** : `apps/web/components/app/client-settings/slots-week-preview.tsx:35` (lookup `pillarMeta[slot.pillarId]`, fallback silencieux `var(--border)` ligne 40) vs `slot-row.tsx:30` (`pillars: ContentPillar[]` en props) ; parent commun `section-slots.tsx:23/84/103`
- **Constat** : la couleur du liseré d'un créneau est cherchée dans `pillarMeta` (map statique construit depuis `CONTENT_PILLARS`, ids démo `pil_bru_*`), alors que le parent a déjà `pillars` en scope et que `ContentPillar.colorVar` est la source de vérité.
- **Scenario d echec / cout a l echelle** : avec des piliers en DB (ids uuid), `pillarMeta[uuid]` retourne `undefined` → tous les liserés retombent sur `var(--border)`. Aucune erreur, régression visuelle invisible en CI. Même piège pour tout client créé hors du jeu de démo.
- **Pourquoi ca bloque le scaling** : tout lookup global keyé sur des ids d'entités dynamiques est une bombe à retardement du swap — la donnée par-client doit circuler par props/query, jamais par constante module.
- **Reco** : passer `pillars` (ou une Map id→colorVar dérivée en amont) en props à SlotsWeekPreview, comme SlotRow. Supprimer `pillarMeta` de labels.ts.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 (ContentPillar par client, ids DB)

### [P3] Import inversé app → portal : le studio importe `MediaCarousel` depuis `components/portal`
- **Ou** : `apps/web/components/app/studio/content-detail-media.tsx:6` ; aggravant : `media-carousel.tsx` utilise des clés i18n du namespace `portal.carousel.*`
- **Constat** : le détail contenu (espace freelance) importe MediaCarousel depuis le dossier du portail Reviewer — contexte utilisateur et périmètre distincts. C'est le seul import app→portal du dépôt ; `components/shared/` existe déjà (13 composants), la convention violée est établie. L'isolation sécurité Reviewer est portée par routes/auth/RLS (pas par les dossiers) — enjeu de direction de dépendances, pas de sécurité.
- **Scenario d echec / cout a l echelle** : toute évolution du portail pensée « côté Reviewer » (wording client final, allègement du bundle reviewer) casse ou pollue l'écran studio du freelance.
- **Pourquoi ca bloque le scaling** : app et portal évoluent à des rythmes différents (le portail doit rester minimal) ; un graphe `app → shared ← portal` est la seule structure qui tient dans le temps.
- **Reco** : déplacer `media-carousel.tsx` vers `components/shared/` (déjà générique) ; extraire `clientFacingStatus`/`statusBadgeLabel` dans un module sans JSX (cf. finding inversion de couche). Règle : jamais d'import `components/portal ↔ components/app`.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §3 (contexte Reviewer isolé) — indirect

### [P3] Le chrome applicatif est éclaté entre 7 fichiers plats à la racine de `components/app` et le dossier `components/app/shell`
- **Ou** : `apps/web/components/app/client-switcher.tsx:20` (imports croisés vers `./shell/client-nav` et `./shell/shell-provider`) ; `app-sidebar.tsx:25-26`, `nav-user.tsx:28`
- **Constat** : app-sidebar, client-switcher, client-tabs, locale-toggle, nav-user, notifications-button, theme-toggle vivent à plat pendant que le même concern a un dossier `shell/` (9 fichiers). Les fichiers plats importent `shell/` — un seul sous-système, deux emplacements (ex. : header-search-button dans shell/, notifications-button à plat).
- **Scenario d echec / cout a l echelle** : les prochains composants de chrome iront au hasard dans l'un ou l'autre ; la future règle de dépendance (shell = seul consommateur des hooks data transverses) est invérifiable sur un périmètre flou.
- **Pourquoi ca bloque le scaling** : coût faible aujourd'hui, croissant chaque année ; le déplacement est un pur move + fix imports.
- **Reco** : regrouper les 7 fichiers plats sous `components/app/shell/` ; trancher l'emplacement de locale-toggle/theme-toggle (aussi consommés par (auth) et (portal) → candidats `components/shared/`). La racine de `components/app` ne contient plus que des dossiers de features.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Pseudo-dossiers par préfixe dans `studio/` (15 board-*, 12 detail-*, 6 content-*) alors que `composer/` a son sous-dossier
- **Ou** : `apps/web/components/app/studio/board-state.ts:1` (parmi 33 fichiers plats à préfixes + composer/ 19 fichiers = 52)
- **Constat** : trois écrans distincts (board `/content`, détail `/content/[id]`, composer `/content/new|edit`) partagent un répertoire plat. La convention de préfixe a déjà dégénéré : la famille content-* chevauche deux écrans, des imports croisés inter-familles existent (`content-actions.tsx:12` → detail-duplicate-dialog ; `content-card.tsx:23-25` → board-*), et `board-idea-bank.tsx` est consommé par une 4e route `/ideas`.
- **Scenario d echec / cout a l echelle** : la plus grosse feature du repo (52 fichiers) devient non navigable ; un couplage board→detail passe inaperçu en revue.
- **Pourquoi ca bloque le scaling** : symétrie = prévisibilité ; le découpage en sous-dossiers rend les frontières d'écrans vérifiables d'un `ls`.
- **Reco** : créer `studio/board/` et `studio/detail/` sur le modèle de `composer/` ; `content-card` va dans `board/` (unique consommateur : content-board) ; les utilitaires réellement communs remontent dans `studio/`. Pur déplacement.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Contournements ponctuels de la façade mocks (2 imports profonds) et collision de nom `DemoBanner`
- **Ou** : `apps/web/components/app/library/use-library-assets.ts:6` (`IMAGES` depuis `@/lib/mocks/images` — module absent de la façade) ; `apps/web/components/app/studio/composer/schedule-dialog.tsx:21` (`CURRENT_USER` depuis `@/lib/mocks/clients` alors que la façade l'exporte, `index.ts:35`) ; `app/grid/demo-banner.tsx:8` vs `app/shell/demo-banner.tsx:13` (deux `DemoBanner`, sémantiques différentes)
- **Constat** : deux fichiers court-circuitent la façade — seuls deep imports data du dépôt hors types/labels/time (énumération exhaustive vérifiée). Le cas schedule-dialog est un survivant silencieux plausible au swap (`CURRENT_USER.timezone` pilote le hint de fuseau, lignes 168-172, compile après câblage). Deux composants distincts exportent le même nom `DemoBanner` (bandeau prospect de la grille vs bandeau preview global).
- **Scenario d echec / cout a l echelle** : au swap, la façade est rebranchée mais ces fichiers continuent de servir des constantes mock : l'utilisateur démo et les images Pexels apparaissent chez de vrais tenants. La collision DemoBanner provoque des auto-imports erronés difficiles à repérer en revue.
- **Pourquoi ca bloque le scaling** : la discipline « une seule porte d'entrée données » ne tient que sans exception ; chaque contournement toléré en autorise dix.
- **Reco** : rebasculer les 2 imports sur la façade (ajouter un getter images côté façade/adapter) ; renommer le bandeau de la grille en `ProspectModeBanner` ; verrouiller avec Biome `noRestrictedImports` interdisant `@/lib/mocks/*` hors façade — à poser en même temps que le renommage `lib/data`.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (swap sans réécriture)

### [P3] Dockerfile racine unique câblé web-only alors que la cible Coolify = 2 apps (web + worker)
- **Ou** : `Dockerfile:10-11` (stage deps ne copie que package.json racine + apps/web/package.json), `Dockerfile:20` (`pnpm --filter web build`), `Dockerfile:38` (CMD web)
- **Constat** : un seul `Dockerfile` sans variante worker. Dès que `packages/shared/package.json` existera et que le lockfile sera régénéré, le stage deps échoue en `ERR_PNPM_OUTDATED_LOCKFILE` (importers du lockfile ≠ workspace découvert dans l'image). Échec bruyant, au build, corrigeable dans le même commit — mais évitable.
- **Scenario d echec / cout a l echelle** : casse du build au moment précis de la création de packages/shared (première brique du chantier backend) ; convention de nommage des Dockerfiles à figer avant le premier deploy pour éviter une migration de config d'infra.
- **Pourquoi ca bloque le scaling** : le pattern 2-apps Coolify est acté (CLAUDE.md §1).
- **Reco** : renommer en `Dockerfile.web` (chemin explicite dans Coolify) et réserver `Dockerfile.worker` ; à la création de packages/shared, ajouter `COPY packages/shared/package.json packages/shared/` dans le stage deps des deux images.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (hosting : 2 apps) + §4

### [P3] `.dockerignore` ne couvre pas `_research/`, `.playwright-mcp/`, `.claude/` ni le jpeg racine — cache de build invalidé par chaque rapport d'audit
- **Ou** : `.dockerignore:1-17` ; `Dockerfile:19` (`COPY . .`)
- **Constat** : le stage build fait `COPY . .` ; .dockerignore exclut node_modules/.next/docs/.git/.planning mais pas `_research/` (rapports, non gitignoré), `.playwright-mcp/`, `.claude/` ni `ocean-demo-dashboard.jpeg` (135 Ko, tracké).
- **Scenario d echec / cout a l echelle** : chaque fichier écrit dans `_research/` invalide la couche `COPY . .` → rebuild complet à chaque audit ; artefacts internes embarqués dans le contexte Docker (et committables par un `git add -A`, donc cache Coolify sautant ensuite).
- **Pourquoi ca bloque le scaling** : les audits et sessions agentiques produiront des dizaines de fichiers.
- **Reco** : ajouter `_research`, `.playwright-mcp`, `.claude`, `*.jpeg` (racine) à `.dockerignore` (+ `_research/` et `.claude/` à `.gitignore`) ; déplacer le jpeg vers docs/.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] CLI shadcn en dependencies de production
- **Ou** : `apps/web/package.json:25` (`"shadcn": "^4.11.0"`)
- **Constat** : le paquet est en `dependencies` aux côtés des libs runtime. Précision de vérification : `app/globals.css:3` fait `@import "shadcn/tailwind.css"` — c'est donc une dépendance de BUILD (CSS compilé par next build), pas un CLI orphelin : ne pas le supprimer, le déplacer.
- **Scenario d echec / cout a l echelle** : install prod plus lourde (arbre transitif : @babel/core, ts-morph, execa…) et surface d'audit sécurité/licences gonflée — le tracing standalone ne l'embarque pas au runtime.
- **Pourquoi ca bloque le scaling** : la frontière dependencies/devDependencies devient un critère réel quand le worker et la CI installent en `--prod`.
- **Reco** : déplacer shadcn en devDependencies (comme tailwindcss et @tailwindcss/postcss déjà en dev).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Images démo hot-linkées depuis images.pexels.com — le preview prod dépend d'un CDN tiers
- **Ou** : `apps/web/next.config.ts:14` (remotePatterns : images.pexels.com uniquement) ; `lib/mocks/images.ts` (48 URLs) ; rendu via next/image (17 composants, dont `components/shared/media-thumb.tsx:23`)
- **Constat** : toutes les images de la démo validée sont optimisées par Next à partir d'URLs Pexels externes ; aucun pattern `*.supabase.co` prévu. Facteur aggravant : `output "standalone"` en Docker = cache `.next/cache/images` éphémère à chaque redeploy (re-fetch systématique).
- **Scenario d echec / cout a l echelle** : rate-limit ou suppression d'une image côté Pexels = trous visuels dans la démo en prod, découverts devant un prospect.
- **Pourquoi ca bloque le scaling** : au câblage, les vignettes viendront de `media-thumbs` public sur `*.supabase.co` — autant figer la stratégie médias démo maintenant.
- **Reco** : self-héberger les images démo (public/ ou bucket) OU accepter explicitement la dépendance Pexels ; préparer `{ hostname: '*.supabase.co', pathname: '/storage/v1/object/public/media-thumbs/**' }` pour le swap.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règle 20 (media-thumbs PUBLIC)

## Code production-grade propose (NON applique)

### A. Arborescence cible (converge CLAUDE.md §4, prépare le swap mock→Supabase sans réécriture UI)

```text
/ (racine monorepo)
├── pnpm-workspace.yaml              # apps/* + packages/* (déjà déclaré — inchangé)
├── tsconfig.base.json               # NOUVEAU — paths/strict partagés web+worker+shared
├── Dockerfile.web                   # ex-Dockerfile (renommé) + HEALTHCHECK + COPY packages/shared/package.json
├── Dockerfile.worker                # réservé Lot 2 (jumeau)
├── .nvmrc                           # 22 (engines >=22 <23)
├── biome.json                       # + noRestrictedImports (@/lib/mocks/* hors lib/data/mock)
├── .github/workflows/ci.yml         # biome → typecheck → check-250-lignes → build ; jobs pgTAP réservés Lot 0
│
├── packages/
│   └── shared/                      # @ocean/shared — COUCHE DOMAINE (zéro dépendance framework/i18n)
│       └── src/
│           ├── types/               # ex apps/web/lib/mocks/types — core, collab, library, pro
│           │                        #   • champs narratifs en string simple (plus de L<>)
│           │                        #   • OrgRole/ClientRole alignés PRD (plus de MemberRole fusionné)
│           │                        #   • Client.logoUrl (le `theme` démo part dans les fixtures)
│           ├── constants/
│           │   ├── platforms.ts     # platformMeta (labelKey string générique), API_PLATFORMS, MANUAL_PLATFORMS
│           │   ├── quotas.ts        # PLATFORM_QUOTAS + sémantique de comptage (IG posts / FB Reels / TT drafts)
│           │   ├── specs.ts         # ex lib/specs.ts (validation médias — platformName supprimé)
│           │   ├── caption.ts       # limites légendes
│           │   └── brand.ts         # hex marque (manifest, viewport, futurs emails Brevo)
│           ├── status-meta.ts       # contentStatusMeta / targetStatusMeta (machine à états PRD §6)
│           └── schemas/             # Zod — introduit au Lot 0 (Server Actions), pas avant
│
├── apps/
│   ├── web/
│   │   ├── middleware.ts            # NOUVEAU — default-deny + allowlist publique (no-op en preview)
│   │   ├── app/
│   │   │   ├── (marketing)/page.tsx # landing déplacée (URL inchangée)
│   │   │   ├── (auth)/{login,otp}/
│   │   │   ├── (app)/…              # URLs actuelles ACTÉES (décision vs §9) — pages = I/O pur
│   │   │   ├── (portal)/portal/…    # consomme getReviewerContext(), plus de constante démo
│   │   │   ├── api/health/route.ts  # NOUVEAU — sonde Coolify
│   │   │   ├── error.tsx, not-found.tsx, global-error.tsx, loading.tsx (segments lourds)
│   │   │   ├── manifest.ts          # + icônes PNG ; apple-icon.png / icon.png (conventions app/)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── shell/               # chrome regroupé (sidebar, switcher, nav-user, notifications, palette…)
│   │   │   ├── app/                 # features : studio/{board,detail,composer}, calendar, grid, library,
│   │   │   │                        #   performance (rendu seul), client-settings, onboarding, agenda…
│   │   │   ├── portal/              # jamais importé par app/ (règle : partage via shared/)
│   │   │   ├── shared/              # brand-mark, media-carousel, brand-color-palette, string-list-editor…
│   │   │   └── ui/                  # shadcn vendoré (exempté 250 l. — à acter)
│   │   ├── hooks/
│   │   │   └── data/                # use-clients, use-notifications, use-current-user, use-account-issues
│   │   │                            #   (aujourd'hui : props/getters ; demain : TanStack Query + Realtime)
│   │   └── lib/
│   │       ├── data/                # COUCHE ACCÈS DONNÉES — seule porte d'entrée
│   │       │   ├── index.ts         # façade async, getter-only, fermée (ex lib/mocks/index.ts)
│   │       │   ├── mock/
│   │       │   │   ├── adapter.ts   # pick(locale) à la frontière, DemoClientExtras (theme), pillarMeta dérivé
│   │       │   │   └── fixtures/    # ex lib/mocks/*.ts — SEUL habitat de L<>, IMAGES, MOCK_NOW source
│   │       │   ├── performance/     # ex components/app/performance/{perf-data,report-data,perf-breakdown}
│   │       │   └── supabase/        # (câblage) même façade, impl Supabase — `import 'server-only'`
│   │       ├── auth/
│   │       │   ├── org-context.ts   # (câblage — getActiveOrg pattern §3)
│   │       │   └── reviewer-context.ts  # getReviewerContext(): {reviewer, clients: Client[]} | null
│   │       ├── clock.ts             # now(): Date — preview = MOCK_NOW ; prod = instant par requête
│   │       ├── feed/grid-view.ts    # buildGridViewModel + PLANNED_STATUSES (invariants grille IG, testables)
│   │       ├── content/editability.ts  # règle READ_ONLY unique (3 sites → 1)
│   │       ├── review/status.ts     # clientFacingStatus / statusBadgeLabel (candidat shared : worker + Brevo)
│   │       ├── dashboard/tasks.ts   # view-model tâches (i18n/href hors couche data)
│   │       ├── i18n/                # dictionnaires scindés par sous-namespace ; narrowing labelKey→MessageKey
│   │       └── format.ts, tz.ts, routes.ts, utils.ts, marronniers.ts   # PURS — zéro import mocks
│   │
│   └── worker/                      # Lot 2 — consomme @ocean/shared (types, quotas, specs, status-meta)
│       └── src/{index.ts, queue/, publishers/, tokens/, media/}
│
└── supabase/                        # Lot 0 — migrations/, functions/, tests/ (pgTAP leak tests)
```

### B. Découpage clean architecture (couches + sens de dépendance unique)

| Couche | Contenu | Dépend de | Règle d'or |
|---|---|---|---|
| **1. Domaine** | `@ocean/shared` : types PRD §6, enums statuts, constantes plateformes/quotas/specs | rien | zéro framework, zéro i18n, zéro fixture — consommable par web, worker, Edge Functions, pgTAP |
| **2. Accès données** | `lib/data` (façade async getter-only) + `hooks/data` | domaine | UNE porte d'entrée ; impl `mock/` swappée par `supabase/` derrière la MÊME signature ; locale et horloge résolues ICI |
| **3. Services / view-models** | `lib/{feed,content,review,dashboard,clock,auth,tz,format}` | domaine (+ data pour les contexts) | fonctions pures, testables unitairement, réutilisables par la future query et le portail |
| **4. Présentation** | `app/` (routes = I/O pur) + `components/` | 2 + 3 + domaine | `app → components → lib → shared` ; `portal ↮ app` (partage via `components/shared`) |
| **5. Infra** | middleware (default-deny), api/health, Dockerfiles, CI, manifest/PWA | — | default-deny, sondes, versions pinnées |

**Améliorations architecturales obtenues (sans changer le comportement)** :
1. **Swap mock→Supabase = substitution d'implémentation** derrière une façade fermée — les 23 pages ajoutent `await` (diff mécanique), le shell consomme des hooks dont seule l'implémentation change, zéro pixel modifié.
2. **Source de vérité unique web+worker** pour enums/statuts/quotas/specs — la machine à états PublishJob/ContentTarget ne peut plus diverger entre apps (règles 15-19 enforçables sur une seule constante).
3. **Types domaine = types DB** : la locale est résolue à la frontière (adapter mock aujourd'hui, jamais côté Postgres), l'horloge est injectable (1 seam, hydratation déterministe conservée).
4. **Sécurité default-open → default-deny** : middleware allowlist + contextes auth (`org-context`, `reviewer-context`) posés comme points d'ancrage AVANT le câblage RLS.
5. **Règles métier extraites des routes** (grille IG, éditabilité, confidentialité statuts) : testables, partagées avec la future query, le portail, le worker et les emails.
6. **Frontières vérifiables mécaniquement** : Biome `noRestrictedImports`, `server-only` sur lib/data/supabase, check 250 lignes en CI — les règles de fer redeviennent exécutables.

### C. Ordre de migration recommandé (chaque étape = comportement identique, build vert)

1. **Décision P0** (avec Étienne) : acter les URLs actuelles + réécrire CLAUDE.md §9 en default-deny ; committer `middleware.ts` no-op + `api/health` + boundaries + icônes PWA PNG. *(S — débloque la mise en prod)*
2. **Créer `packages/shared`** : déplacer types (dé-`L<>`-ifiés, `OrgRole`/`ClientRole`, `logoUrl`) + constantes (platforms, quotas, specs, status-meta, brand) ; codemod `@/lib/mocks/types` → `@ocean/shared` ; `transpilePackages` ; COPY dans le Dockerfile. *(M)*
3. **`lib/mocks` → `lib/data/{index,mock/adapter,mock/fixtures}`** : façade async getter-only fermée, locale résolue dans l'adapter (codemod des 145 `pick()`), pages en `await`, shell via props/`hooks/data`, extraction perf-data/report-data. *(M/L — le gros du chantier)*
4. **`lib/clock.ts`** : rebaser format.ts, marronniers.ts et les 22 consommateurs ; interdire `lib/mocks/time` hors fixtures. *(M)*
5. **Seams auth** : `reviewer-context.ts` (portail sans constante démo), squelette `org-context.ts`. *(S)*
6. **Extractions métier** : `lib/feed/grid-view.ts`, `lib/content/editability.ts`, `lib/review/status.ts`, `lib/dashboard/tasks.ts`. *(M)*
7. **Verrous outillage** : Biome noRestrictedImports, `typecheck` root, check 250 lignes, `.nvmrc`, `Dockerfile.web`, `.dockerignore`, shadcn en dev, palette de marque unifiée (arbitrage Étienne). *(S)*

Après l'étape 7, le câblage Supabase (Lot 0) consiste à écrire `lib/data/supabase/` derrière la façade existante, `supabase/migrations` + pgTAP, et à remplir les deux contexts auth — sans toucher ni `app/` ni `components/`.

## Ce qui va bien (a preserver)

- **23 pages en `async` Server Components** (`export default async function` partout) : le prérequis n°1 du câblage sans réécriture est déjà en place — le passage de la façade en async est un diff mécanique côté pages.
- **Une façade data existe déjà** (`lib/mocks/index.ts`) et la majorité des composants riches reçoivent leurs données par props depuis les pages (pattern vérifié sur `content-board.tsx`, `notification-center.tsx`, `accounts-tab.tsx`, `today-panel.tsx`) : le seam est né, il faut le fermer et l'async-ifier, pas le créer.
- **Types miroir du PRD §6 disciplinés** : `types/core.ts` recoupe fidèlement les statuts ContentItem/ContentTarget/PublishJob de la cible DB — l'extraction vers `packages/shared` est un déménagement, pas une réécriture de modèle.
- **Horloge figée = bonne intuition** : le frozen clock résout réellement le déterminisme d'hydratation (aucun `Date.now()` au rendu) ; il faut le mettre derrière un seam, pas le supprimer.
- **`lib/tz.ts` et `lib/routes.ts` sont des primitives propres** au bon endroit — `routes.ts` comme source unique des chemins est exactement ce qu'il faut préserver (et réutiliser dans le middleware default-deny).
- **`components/shared/` et `components/ui/` (shadcn) existent et sont respectés** à une exception près (media-carousel) : la convention de partage est établie.
- **Le sous-dossier `composer/`** montre que le découpage par écran est déjà pratiqué dans le studio — il suffit de généraliser (board/, detail/).
- **Biome + TS strict + Tailwind v4 sans couleurs hardcodées dans le JSX** (les teintes passent par `colorVar`/oklch centralisés) : les règles de fer 25-28 sont globalement tenues dans le code produit.
- **`pnpm-workspace.yaml` déclare déjà `packages/*`** : la structure monorepo cible est prête à accueillir `@ocean/shared` sans changement d'outillage.
- **Le portail est physiquement séparé** (route group `(portal)`, composants `components/portal/`, layout dédié) : la frontière de rôles du produit existe dans la structure — elle demande un contexte d'auth, pas une refonte.
