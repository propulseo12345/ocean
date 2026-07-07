# Audit — Architecture (2026-07-07)

> Dimension : reverse-engineering de l'architecture réelle + qualité/scalabilité/maintenabilité.
> Périmètre : apps/web (391 fichiers TS/TSX, ~42 650 lignes), phase preview front validée, câblage Supabase = étape suivante.
> Tous les findings ci-dessous ont été vérifiés sur pièces (fichier:ligne lus) et ont résisté à une passe de réfutation adversariale. Zéro finding supposé.

## Verdict

Le front est globalement bien construit : pages 100 % Server Components async, façade de lecture unique (`lib/mocks/index.ts`), types miroir du PRD §6, i18n custom cohérente sur la majorité des surfaces. Mais la promesse centrale de la phase (« brancher Supabase sans réécrire l'UI », CLAUDE.md §0) **n'est aujourd'hui tenue que pour une partie des lectures, et pour rien d'autre**. Quatre seams manquent ou fuient : (1) la façade de données est 100 % synchrone et consommée inline dans des `.map()` de pages ET directement dans des composants `use client` — un contrat impossible à honorer avec Supabase+RLS ; (2) il n'existe aucun seam d'horloge (MOCK_NOW figé au 11/06/2026 tissé dans lib/format.ts et ~22 fichiers de logique métier) ; (3) aucune couche de mutations (toutes les écritures = toast inline dans les composants, zéro Server Action stub, zéro RHF+Zod) ; (4) le wrapper bilingue de démo `L<string>` est baké dans le contrat de données (144 `pick()` dans 70 fichiers) alors que la DB stockera des strings. S'ajoutent deux angles morts de mise en prod imminente : le middleware prescrit par CLAUDE.md §9 ne protégerait aucune route réelle (préfixe `/app` inexistant), et zéro boundary error/not-found/loading dans toute l'app. **Risque principal : entamer le câblage Lot 0 sans poser ces seams transforme un swap d'implémentation en réécriture sous pression de la moitié des écrans validés, avec régressions garanties sur une UI déjà validée par Étienne.**

## Fonctionnement réel observé

**Flux de lecture.** Chaque page est un `export default async function` Server Component (23 pages, 5 layouts). Les données viennent de la façade `apps/web/lib/mocks/index.ts:40-236` : getters **synchrones** (`getClients`, `getContentItems`, `getPortalContent`, `getDashboardTasks`…) qui filtrent des constantes typées (`CONTENT_ITEMS`, `CLIENTS`…). Les types (`lib/mocks/types/core.ts`) recoupent le schéma PRD §6 (enums `ContentStatus`, `TargetStatus`, `Platform`…) — bon socle. Trois fuites de ce flux : des pages appellent les getters au milieu de helpers/`.map()` (ex. `clientStats()` par client dans la boucle, `clients/page.tsx:48` ; `metricsOf()` par tuile, `grid/page.tsx:68-71`), des composants `use client` importent la façade et l'appellent au rendu (command-palette, client-switcher, notifications-button, quick-capture, client-health-banner), et 3 pages + plusieurs composants importent les **constantes brutes** (`CURRENT_USER`, `CALENDAR_ACCOUNTS`, `MOCK_NOW`) en contournant la façade.

**Horloge.** `lib/mocks/time.ts:3` fige MOCK_NOW au 11/06/2026. Cette constante est importée par ~22 fichiers **hors** lib/mocks, dont du code permanent : `lib/format.ts:2` (formatRelative/isPast/isSameDay), `lib/marronniers.ts`, tout le studio (preflight.ts:243, board-utils.ts:69, composer-utils.ts:92…), le calendrier, l'agenda (`unified-agenda.tsx:52`). Aucune fonction `now()` injectable n'existe.

**Écritures.** Aucune. Toutes les mutations (validation reviewer, login/OTP, board, grille, settings) sont des `toast.success()` + état local inline dans les composants clients (`review-actions.tsx:16-22`, `login-form.tsx:23-54`, `board-state.ts:105` : mutations `void` synchrones sur overrides `useState`). Ni `use server`, ni `lib/actions/`, ni zod, ni react-hook-form, ni @tanstack/react-query dans package.json — trois éléments pourtant imposés par la stack (CLAUDE.md §1).

**i18n.** Dictionnaires maison par zones (21 paires FR/EN, ~229 Ko source) aplatis eagerly des DEUX locales dans le bundle client de chaque page (`dictionaries/index.ts:26-29` via LocaleProvider `use client`, `app/layout.tsx:49`). Le contenu de démo est bilingue via `L<string> = {fr,en}` (`lib/i18n/localized.ts:6`) — baké jusque dans les types domaine et résolu par les composants eux-mêmes (144 `pick()` / 70 fichiers).

**Routing/auth.** Routes à la racine via route groups sans segment (`lib/routes.ts:2-27` : `/dashboard`, `/clients/...`, `/agenda`, `/portal`). Pas de middleware.ts (attendu en preview), pas de seam auth dans `(app)/layout.tsx:17-52` (pur shell UI), pas de résolveur de contexte reviewer (chaque page portail refait `getClient(DEMO_REVIEWER_CLIENT_ID)`). Zéro `error.tsx` / `not-found.tsx` / `loading.tsx` / `global-error.tsx` dans tout `app/`, alors que 14 `notFound()` sont déjà appelés.

**Frontières brouillées.** `lib/mocks/` mélange du jetable (données démo) et du permanent : `types/` (~170 fichiers importeurs), `labels.ts` (méta statuts/plateformes, consommée par la couche i18n de prod), `getDashboardTasks` (vraie logique produit), re-export d'`isPast`. Inversement, de la logique métier PRD vit dans des composants (`clientFacingStatus` PRD §5.F dans `portal-card.tsx:18-26` ; 4 copies divergentes de la machine à états ContentStatus dans le studio).

---

## Findings (triés par sévérité P0 → P3)

Aucun P0 (rien ne casse la preview actuelle ni ne crée de faille immédiate — les données sont mockées). Les P1 sont les obstacles structurels au câblage et à la mise en prod imminente.

### [P1] Façade de données 100 % synchrone, consommée inline dans les pages (helpers dans `.map()`, N+1 garanti)
- **Où** : `apps/web/lib/mocks/index.ts:40-110` ; `app/(app)/clients/page.tsx:17-26,47-49` ; `app/(app)/clients/[clientId]/grid/page.tsx:68-71,148-179` ; layout client vs pages (double fetch `getClient`, `layout.tsx:23-25` vs `grid/page.tsx:142,178`)
- **Constat** : tous les getters sont synchrones et appelés non seulement en tête de page mais au milieu de helpers purs et de `.map()` : `clientStats()` appelle `getContentItems()` par client dans la boucle de rendu ; `metricsOf()` appelle `getPostMetrics()` par tuile dans 3 pipelines `.map` ; layout + pages re-fetchent le même client sans `cache()`.
- **Scénario d'échec / coût à l'échelle** : au Lot 0 chaque getter devient async (query Supabase) ; ajouter `await` ne suffit pas — les helpers dans `.map()` ne peuvent pas devenir async sans restructurer l'assemblage de données des pages. Câblé naïvement : N+1 pur (1 query metrics par tuile, 1 query contenus par client) et 2-4 requêtes DB identiques par navigation.
- **Pourquoi ça bloque le scaling** : la promesse §0 devient fausse pour clients/, grid/ et partiellement content/[contentId] — réécriture de la couche d'assemblage sous pression de livraison, régressions sur UI validée.
- **Reco** : rendre la façade async DÈS MAINTENANT (`Promise.resolve` en mock), wrapper chaque getter dans `cache()` de React, restructurer les pages pour awaiter TOUTES les données en tête puis passer des Maps préchargées aux helpers purs. Le branchement Supabase devient un swap dans `lib/mocks/index.ts` uniquement.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0

### [P1] La même façade synchrone est importée et appelée au rendu dans des composants `use client` (shell transverse)
- **Où** : `components/app/shell/command-palette.tsx:20,55,63` ; `client-switcher.tsx:17` ; `app-sidebar.tsx:21` ; `notifications-button.tsx:9,17-18` ; `quick-capture.tsx:27,37` ; `client-health-banner.tsx:10,23` ; `shell/client-nav.ts:1`
- **Constat** : au moins 6 composants clients (montés sur TOUTES les pages via `(app)/layout.tsx:46-47` et le layout client) appellent `getClients()/getContentItems()/getNotifications()` au rendu. Ça ne marche que parce que le dataset mock complet est bundlé dans le JS client — tout le contenu démo part dans le bundle de chaque page.
- **Scénario d'échec / coût à l'échelle** : au câblage, les getters deviennent async et server-only (RLS + cookie `active_org_id` httpOnly) : un contrat « sync, appelable partout » est physiquement impossible avec Supabase. Chaque call-site client doit être re-routé (props de Server Components ou TanStack Query) — retouche de la topologie de composants validée.
- **Pourquoi ça bloque le scaling** : le bandeau santé et la palette recalculent des agrégats par client à chaque rendu client ; câblé naïvement = N requêtes par ouverture de palette.
- **Reco** : (1) le layout (app) serveur charge un contexte léger {clients résumés, comptes en échec, unreadCount} passé en props/provider ; (2) recherche de contenus = TanStack Query vers une route serveur (top-K, débounce) ; (3) interdire l'import des getters mocks depuis les fichiers `use client` (règle Biome no-restricted-imports) — seuls les types restent importables.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0, §1 (TanStack Query), règle 26

### [P1] Le wrapper bilingue de démo `L<string>` est baké dans le contrat de données — 144 `pick()` dans 70 fichiers alors que la DB stockera des strings
- **Où** : `lib/mocks/types/core.ts:147-148` (title/caption), `:76-81,:125,:141,:154,:162-164,:176` ; `lib/i18n/localized.ts:6` ; usages ex. `portal-card.tsx:42-43`, `annotation-viewer.tsx:171`, `composer-types.ts` (9 occurrences dans l'état de formulaire) ; rustine inverse déjà présente : `use-library-assets.ts:60` (`{fr: trimmed, en: trimmed}`)
- **Constat** : le contenu utilisateur (titres, légendes, notes, altText, lastError) est typé `L<string> = {fr,en}` pour la démo bilingue, alors que le PRD §6 stocke ces champs en `text` simple (le contenu d'un client n'est pas bilingue). Les composants résolvent eux-mêmes la locale via `pick()`.
- **Scénario d'échec / coût à l'échelle** : au câblage, soit `ContentItem.title` devient `string` et 70 fichiers cassent en même temps que le branchement, soit on embarque un adaptateur permanent `{fr:s, en:s}` en prod (artefact de démo dans Zod, Server Actions, TanStack Query, sérialisations doublées). La divergence grandit à chaque nouveau composant qui appelle `pick()`.
- **Pourquoi ça bloque le scaling** : c'est LA plus grosse divergence contrat/DB de la couche mock, en contradiction frontale avec le verrou §0 « mêmes types que la future DB ».
- **Reco** : résoudre la locale à la frontière de la façade : les getters (server) prennent la locale (`getLocale()`) et retournent des types contrat en `string` ; les constantes mock gardent `L<string>` en interne, résolu UNE fois dans index.ts (pattern déjà prouvé par `getDashboardTasks`, index.ts:156). Les composants ne connaissent plus que des strings = shape DB exact.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 ; PRD §6 (content_items.caption text)

### [P1] Aucun seam d'horloge : MOCK_NOW (11/06/2026 figé) tissé dans lib/format.ts et ~22 fichiers de logique métier
- **Où** : `lib/format.ts:2,52,64,68` (formatRelative/isPast/isSameDay) ; `lib/mocks/time.ts:3` ; studio : `board-utils.ts:69,77`, `composer/preflight.ts:243`, `composer-utils.ts:92-105`, `schedule-dialog.tsx:85`, `board-state.ts:163`, `board-idea-bank.tsx:113`, `board-kanban.tsx:112` ; `agenda/unified-agenda.tsx:52` ; `use-calendar-state.ts:5` ; `lib/marronniers.ts:2` ; `dashboard/page.tsx:13`
- **Constat** : la couche durable (lib/, composants métier) dépend de la couche jetable (mocks/time). Aucune fonction pure temporelle (isOverdue, computePreflight, nextSlotIso, scheduleShortcuts) n'accepte de paramètre `now`. Piège technique : MOCK_NOW étant une const évaluée au chargement du module, la remplacer par `new Date()` gèlerait « maintenant » au boot du serveur — la bascule correcte exige un `now()` appelable, donc de toucher tous les call-sites.
- **Scénario d'échec / coût à l'échelle** : au câblage progressif, un seul fichier oublié = « il y a 2 heures » sur un commentaire de 3 semaines, contenus réels tous « en retard », preflight qui rejette des dates valides — bugs silencieux, zéro erreur de compilation. Bloque aussi l'extraction vers packages/shared (§4) et la testabilité de la fenêtre de grâce 2 h (§5).
- **Pourquoi ça bloque le scaling** : le temps est la seule dépendance transverse non injectée ; chaque nouvelle feature temporelle (relances, fenêtres de grâce) agrandit la surface à migrer.
- **Reco** : créer `lib/clock.ts` exposant `now(): Date` (retourne MOCK_NOW aujourd'hui, `new Date()` demain, surchargeable en test) — seul fichier autorisé à importer mocks/time. `lib/format.ts` et la logique métier consomment `clock.now()` ; passer `now: Date` en paramètre des fonctions pures du studio. Le jour J, une seule ligne change.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0

### [P1] Pages et composants branchés sur des constantes brutes (CURRENT_USER, CALENDAR_ACCOUNTS, MOCK_NOW) : pas de seam pour l'utilisateur courant
- **Où** : `app/(app)/dashboard/page.tsx:12-13,28-30` (CURRENT_USER + MOCK_NOW via chemin profond `@/lib/mocks/time`) ; `app/(app)/agenda/page.tsx:5,15-17` ; `app/(app)/settings/accounts/page.tsx:6,33-34` ; composants : `composer/schedule-dialog.tsx:21,168-174` (CURRENT_USER.timezone pour « dans votre fuseau »), `nav-user.tsx:26`, `today-panel.tsx:9`
- **Constat** : aucun getter `getCurrentUser()` / `getCalendarAccounts()` / `now()` n'existe dans la façade ; ces surfaces importent les constantes directement, ScheduleDialog le fait même depuis un composant client (deep import `@/lib/mocks/clients`).
- **Scénario d'échec / coût à l'échelle** : au câblage, l'utilisateur vient de `supabase.auth.getUser()` + profiles : chaque import de constante est un point de couture non répertorié. En migration incrémentale (mocks conservés + page non migrée), un utilisateur réel voit le fuseau d'« Étienne Mercier » au moment de programmer un post, ou un dashboard à la date figée de la démo — sans erreur.
- **Pourquoi ça bloque le scaling** : chaque écran qui copie le pattern multiplie les fuites de seam ; la migration devient un grep-and-pray.
- **Reco** : ajouter `getCurrentUser()`, `getCalendarAccounts()` à la façade (async, `cache()`), ajouter `userTimezone` à ComposerData, migrer les call-sites, puis CESSER de ré-exporter les constantes brutes depuis `lib/mocks/index.ts:35` pour que TS signale tout contournement futur.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0

### [P1] Aucune couche de mutations : toutes les écritures sont des toasts inline dans les composants (asymétrie totale avec les lectures)
- **Où** : `components/portal/review-actions.tsx:16-22` (LA mutation cœur du portail : approve/request changes = toast local) ; `components/auth/login-form.tsx:13,23-54` (regex email maison + useState, hors stack RHF+Zod) ; `otp-form.tsx:67-86` ; pattern propagé dans 40+ composants (studio, calendrier, grille, settings, library)
- **Constat** : les lectures ont un seam propre (façade), les écritures n'en ont AUCUN — ni `lib/actions/`, ni `use server`, ni états pending/erreur. `zod`, `react-hook-form`, `@tanstack/react-query` sont absents de package.json.
- **Scénario d'échec / coût à l'échelle** : au câblage, chaque composant validé visuellement doit être rouvert et sa logique interne réécrite (Server Action + pending/erreur/optimistic) ; le diff de câblage se mélange au diff UI, irrelisable, régressions sur UI validée. Le coût croît linéairement avec chaque nouvel écran qui copie le pattern.
- **Pourquoi ça bloque le scaling** : contrat §0 respecté pour les lectures, structurellement violé pour les écritures.
- **Reco** : créer `lib/actions/` avec des stubs typés async (`submitReviewDecision`, `requestMagicLink`, `verifyOtp`, `updateContentStatus`…) simulant aujourd'hui (délai + succès), Server Actions Zod-validées demain. Les composants consomment ces fonctions et gèrent déjà pending/erreur — le câblage ne touche plus aucun composant validé.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règles 27-28, §7, §1 (RHF+Zod)

### [P1] Topologie d'URLs incompatible avec le middleware prescrit par CLAUDE.md §9 (préfixe /app inexistant) et aucun seam auth dans le layout
- **Où** : `lib/routes.ts:2-27` (toutes les URLs à la racine : /dashboard, /clients/…, /agenda) ; `app/(app)/layout.tsx:17-52` (pur shell UI, aucun `requireAuthAndOrg`) ; référence : CLAUDE.md §9 (`startsWith('/app')`, redirect `/app/dashboard`)
- **Constat** : les route groups `(app)/(auth)/(portal)` ne créent aucun segment d'URL. Le middleware canonique de §9 — document déclaré « à suivre exactement » — ne matcherait AUCUNE route réelle et redirigerait post-login vers un 404. CLAUDE.md est incohérent en interne (§4 = URLs racine, §9 = préfixe /app littéral) ; le code suit §4.
- **Scénario d'échec / coût à l'échelle** : middleware copié tel quel au Lot 0 → `/dashboard` et `/clients/*` tombent dans le fallthrough final (fail-open silencieux : pages rendues sans gate de login), redirect post-login = 404. Changer les URLs après mise en prod casserait les deep links Brevo, bookmarks et push.
- **Pourquoi ça bloque le scaling** : chaque nouvelle route creuse l'écart entre l'arborescence réelle et le plan d'auth documenté ; le schéma d'URL doit être figé AVANT le câblage.
- **Reco** : acter maintenant : conserver les URLs racine ; réécrire le futur middleware en deny-by-default à partir de routes.ts (PUBLIC_PATHS = [/, /login, /otp, /api/health, /api/oauth/*], PORTAL_PREFIX = /portal, tout le reste = app authentifiée) ; corriger CLAUDE.md §9 ; poser le seam `requireAuthAndOrg()` (no-op en preview) dans `(app)/layout.tsx`. Ne PAS renommer les URLs validées.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §9, §4, règle 10

### [P1] Zéro boundary error/not-found/loading/global-error dans toute l'app, alors que 14 `notFound()` sont déjà appelés et que la prod est imminente
- **Où** : glob `app/**/{error,not-found,loading,global-error}.tsx` = 0 fichier ; `notFound()` appelé dans `clients/[clientId]/layout.tsx:24`, 12 pages du segment (app) et `(portal)/portal/[contentId]/page.tsx:40`
- **Constat** : URL invalide → page 404 Next par défaut, non brandée, en anglais — y compris sur le portail Reviewer (surface la plus sensible : les CLIENTS des freelances). Toute exception SSR → écran blanc « Application error » sans retry. Sans `global-error.tsx`, le futur Sentry (imposé §1) n'a pas de point de capture React racine. Les `loading.tsx` deviendront le contrat de streaming dès que la façade sera async.
- **Scénario d'échec / coût à l'échelle** : première erreur runtime au câblage (il y en aura) = écran blanc en prod ; après câblage, navigations de 1-3 s sans aucun feedback sur un produit dont la preview validée est instantanée.
- **Pourquoi ça bloque le scaling** : poser les boundaries au niveau des segments coûte 1 fichier chacun maintenant ; les rattraper page par page après coûte 20.
- **Reco** : avant mise en prod : `app/(app)/error.tsx` (message + réessayer, Sentry-ready), `app/(app)/not-found.tsx` et un `not-found.tsx` dédié à `(portal)` (brandés, FR/EN), `app/global-error.tsx`, et des `loading.tsx` squelettes sur `(app)`, `clients/[clientId]/` et `(portal)` (à activer avec la façade async).
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (Sentry), §12 (confiance produit)

### [P1] Page Performance : les 3 périodes complètes (posts inclus) précalculées et sérialisées vers le client
- **Où** : `components/app/performance/perf-data.ts:199-205` (getAllPerfData construit 30d/month/90d avec `posts: PostRow[]` complets, titres pré-rendus FR+EN) ; `perf-workspace.tsx:29-38` (switch local `useState`) ; `getPerfPosts` (l.92-104) itère TOUS les posts du client sans filtre de date
- **Constat** : la page passe le Record des 3 périodes en props au composant client ; les agrégats (KPIs, tendance, répartition piliers) sont des `reduce()` JS sur tous les posts.
- **Scénario d'échec / coût à l'échelle** : câblé sur données réelles : 3 jeux d'analytics complets calculés et sérialisés à chaque visite, dont 2 jamais regardés. Avec 2-3 ans de posts, payload RSC massif, TTFB qui explose.
- **Pourquoi ça bloque le scaling** : les agrégats doivent devenir du SQL (vue/RPC) par période demandée — le contrat de props actuel (`byPeriod` complet) l'interdit sans remodelage.
- **Reco** : ne charger que la période active : période en searchParams (rendu serveur) ou TanStack Query par période — le ToggleGroup ne change pas. Déplacer perf-data.ts/report-data.ts vers `lib/data/performance.ts` (server-only) pour matérialiser la couture ; conserver les contrats KpiValue/TrendBucket/PillarSlice.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P1] Grille : ~25 chaînes UI françaises en dur dans les hooks (toasts, tuiles fantômes, pluriel FR) — régression du chantier i18n
- **Où** : `components/app/grid/use-grid-tiles.ts:30,64-206` ; `use-grid-view.ts:26,53-84` (dont `lastSync = "il y a 2 h"` stocké comme chaîne d'affichage) ; `grid-mutations.ts:74,78,98` (« Nouveau créneau », « Emplacement X ») ; `grid-visibility.ts:9-14`
- **Constat** : tous les toasts de la grille (permutation, dépôt étagère, retry, actions par lot) sont des littéraux FR avec helper de pluriel français, en contraste total avec `calendar-actions.ts` et la library qui passent par le Translator. Le commit b18341f prétend « traduire toute l'UI FR/EN » — ces fichiers ont été oubliés.
- **Scénario d'échec / coût à l'échelle** : utilisateur EN sur /clients/x/grid : chaque drag/action affiche un toast français ; les emplacements réservés sont titrés en français en mode présentation. `lastSync` en chaîne d'affichage bloque le branchement d'un vrai timestamp de synchro Meta.
- **Pourquoi ça bloque le scaling** : chaque nouvelle action de grille copie le pattern non traduit ; au câblage ces toasts deviennent les confirmations de vraies mutations et devront être réécrits deux fois.
- **Reco** : injecter Translator + locale dans useGridTiles/useGridView (pattern calendar-actions.ts), clés à paramètre `count` au lieu de `plural()`, titres fantômes en MessageKey résolues au rendu, `lastSync` en ISO formaté via `f.relative()`.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : oui (libellés EN corrigés)   **Verrou PRD/CLAUDE.md** : chantier i18n acté (feat/i18n-fr-en) ; CLAUDE.md §12

### [P1] Fork d'état props→useState dans useGridTiles/useLibraryAssets : données figées au premier rendu, seam Supabase cassé
- **Où** : `components/app/grid/use-grid-tiles.ts:38-49` ; `components/app/library/use-library-assets.ts:27` ; contre-exemple correct : `use-calendar-state.ts:69,101-107` (overrides dérivés des props)
- **Constat** : useGridTiles copie initialPlanned/initialShelf dans useState + initialRef sans jamais resynchroniser quand les props serveur changent. Reproductible aujourd'hui : le toggle FR→EN (`router.refresh()`, provider.tsx:44) renvoie de nouvelles props… ignorées → grille mi-FR mi-EN (tuiles publiées traduites, planifiées/étagère dans l'ancienne langue).
- **Scénario d'échec / coût à l'échelle** : demain, après Server Action + revalidatePath (ou invalidation TanStack Query), la grille et la médiathèque affichent les données d'avant mutation ; `resetTiles()` restaure un snapshot périmé du tout premier rendu.
- **Pourquoi ça bloque le scaling** : avec TanStack Query, planned/shelf devront venir du cache requête ; si l'état local possède le dataset complet, tout l'arbre useGridTiles est à réécrire.
- **Reco** : refondre sur le pattern overlay du calendrier : props = source de vérité, état local = diffs uniquement (permutations en attente, ids masqués, assets ajoutés localement), listes affichées dérivées par useMemo(props + diffs). Aucun changement visuel à iso-données.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (corrige la grille mi-FR mi-EN)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0, §1 (TanStack Query)

### [P1] Constantes de marque divergentes entre création (wizard) et édition (réglages client) : 3 palettes, 2 listes de fuseaux, 2 modèles pour tone et category
- **Où** : `components/app/onboarding/wizard-types.ts:74-112` vs `client-settings/constants.ts:15-44` et `section-profile.tsx:23-30` ; `step-review.tsx:70` (tone = clé i18n castée) vs `section-brand-kit.tsx:38` (tone = texte libre)
- **Constat** : BRAND_COLORS (wizard) et BRAND_HUES (réglages) ne partagent que 5 valeurs sur 12 (corail 25 vs brique 30, bleu 235 vs océan 230…) ; PALETTE_SWATCHES est un 3e jeu ; TIMEZONES wizard (9 entrées, DOM-TOM) ≠ réglages (6) ; category = enum stable au wizard, Input libre aux réglages. La sélection par égalité stricte (`brand-color-palette.tsx:25`) et l'absence de SelectItem correspondant rendent la panne mécanique.
- **Scénario d'échec / coût à l'échelle** : client créé au wizard avec « corail » ou Indian/Reunion → réglages sans pastille sélectionnée et Select fuseau incohérent. Au câblage DB, `brand_kits.tone` ne peut pas être à la fois clé i18n et texte libre : double modèle ou migration dès le premier jour.
- **Pourquoi ça bloque le scaling** : chaque nouvelle surface qui touche la marque (composer, rapport, portail) repart d'un des 3 jeux — divergence mécaniquement croissante ; ce sont exactement les contrats destinés à packages/shared.
- **Reco** : source unique `lib/brand-constants.ts` (futur packages/shared) : BRAND_COLORS, PALETTE_SWATCHES, TIMEZONES, CATEGORIES avec identifiants stables + clés i18n ; UN SEUL modèle pour tone et category dans les deux surfaces.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (alignement des palettes/listes)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0/§4 (packages/shared), règle 25

### [P2] Agrégats (compteurs clients, tâches dashboard) calculés en matérialisant toutes les entités
- **Où** : `app/(app)/clients/page.tsx:17-26,48` (clientStats hors façade, 3 filtres sur tous les content_items, par client dans la boucle) ; `lib/mocks/index.ts:156-234` (getDashboardTasks : 4 boucles sur CONTENT_ITEMS)
- **Constat** : les pages les plus visitées dérivent des nombres en chargeant les listes complètes ; aucun getter d'agrégat `getClientStats(clientId)` n'existe.
- **Scénario d'échec / coût à l'échelle** : câblé naïvement, /clients à 50 clients × 500 contenus = 25 000 lignes transférées pour 150 nombres ; coût linéaire avec des années de contenu.
- **Pourquoi ça bloque le scaling** : ces écrans doivent devenir des `count()` groupés ou des vues SQL (client_stats, dashboard_tasks), pas des scans applicatifs.
- **Reco** : getters d'agrégat dédiés dans la façade (impl mock = filter/count ; impl Supabase = vue/RPC documentée). Les pages ne reçoivent plus jamais une liste complète pour en dériver un nombre.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Règle d'éditabilité (PRD §5.B) dupliquée et DIVERGENTE : un contenu in_review est éditable par URL directe
- **Où** : `…/content/[contentId]/page.tsx:40,75` vs `…/content/[contentId]/edit/page.tsx:30,42`
- **Constat** : READ_ONLY dupliqué à l'identique dans les deux pages, mais le détail calcule `canEdit = !READ_ONLY && status !== 'in_review'` tandis que la page edit ne bloque QUE READ_ONLY : `/content/[id]/edit` ouvre le composer complet sur un contenu in_review (et intégralement sur un scheduled, que le PRD limite à la date). PRD (docs/PRD.md:197) interdit explicitement l'édition en in_review.
- **Scénario d'échec / coût à l'échelle** : le freelance édite pendant que le client valide (URL directe, historique) : l'approbation porte sur une version qui n'existe plus — le scénario approvalStale que le produit veut éviter. La divergence se recopiera telle quelle dans la Server Action.
- **Pourquoi ça bloque le scaling** : deux sources de vérité pour une règle métier centrale = divergence à chaque évolution.
- **Reco** : module unique `lib/content-rules.ts` (`isEditable(status)`, plus tard `editableFields(status)`), consommé par les deux pages puis par la future Server Action ; aligner edit sur la règle du détail.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : PRD §5.B

### [P2] getContentItem() ignore deletedAt : contenus en corbeille consultables et éditables par URL directe
- **Où** : `lib/mocks/index.ts:59-61` ; pages détail (`page.tsx:58-59`) et edit (`edit/page.tsx:39-40`) ; reproductible (mocks avec deletedAt : `content-extra.ts:134,160`)
- **Constat** : la façade distingue getContentItems (filtre !deletedAt) et getTrashedContent, mais le getter unitaire fait un `find` sans filtre — le composer complet s'ouvre sur un contenu supprimé.
- **Scénario d'échec / coût à l'échelle** : si la query Supabase copie ce contrat (pas de filtre deleted_at sur le fetch unitaire), la corbeille n'est un soft-delete que sur les listes.
- **Pourquoi ça bloque le scaling** : le contrat de la façade EST la spec des futures queries : chaque getter unitaire doit porter les mêmes invariants de visibilité que les listes.
- **Reco** : `getContentItem(id, { includeTrashed = false })` retournant undefined si deletedAt (opt-in pour l'écran corbeille) ; les pages tombent naturellement en notFound(). Documenter le même invariant pour l'impl Supabase.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun (comportement corbeille produit)

### [P2] Machine à états ContentStatus encodée 4 fois, déjà incohérente (kanban vs actions par lot)
- **Où** : `components/app/studio/board-utils.ts:173` vs `board-kanban.tsx:32` vs `content-actions.tsx:15` vs `board-types.ts:137`
- **Constat** : TO_REVIEW_FROM (kanban) inclut idea/approved alors que canSendReview (lot) les exclut — glisser une carte approved vers « En validation » réussit au kanban, mais le bouton « Envoyer en validation » du board déclare le même contenu inéligible (« aucun contenu éligible »).
- **Scénario d'échec / coût à l'échelle** : au câblage, les Server Actions devront choisir UNE règle ; chaque copie UI non alignée produira des mutations rejetées côté serveur. Chaque nouvelle surface (calendrier, portail, mobile) recopiera sa table.
- **Pourquoi ça bloque le scaling** : la dérive UI vs enforcement DB/worker devient un bug de prod récurrent (double envoi en revue, reprogrammation d'un contenu verrouillé).
- **Reco** : module unique `lib/content-lifecycle.ts` (futur packages/shared) : `canTransition(from, to)` + prédicats dérivés (canSendReview, canSchedule, isReadOnly, kanbanColumnOf). Arbitrer la divergence kanban/lot avec Étienne, puis faire consommer la table partout (et par les futures Server Actions).
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (arbitrage des divergences)   **Verrou PRD/CLAUDE.md** : PRD §5.B

### [P2] Classification des erreurs de publication par sniffing de mots-clés sur un message localisé
- **Où** : `components/app/studio/detail-target-error.tsx:22-54` ; modèle sans champ structuré : `types/core.ts:132-162` (lastError = L<string>)
- **Constat** : classify() cherche « token », « jeton », « ratio »… dans le message affiché pour choisir le bouton d'action (Reconnecter / Corriger le média / Relancer).
- **Scénario d'échec / coût à l'échelle** : vraie erreur Meta code 190 (« session invalid… password ») sans le mot « token » → classée generic → le bouton Reconnecter n'apparaît pas alors que c'est LA bonne action. Deux taxonomies d'erreurs à maintenir (UI textuelle vs error_class du worker).
- **Pourquoi ça bloque le scaling** : le PRD stocke error_history structuré et l'event publish_failed porte error_class — la donnée structurée existera, le classifieur textuel est un doublon fragile par plateforme et par locale.
- **Reco** : ajouter `errorClass: 'reauth' | 'media' | 'generic'` au type ContentTarget/mock (aligné worker) passé en prop ; le texte ne sert plus qu'à l'affichage ; supprimer classify() au câblage.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §11 (publish_failed.error_class), §5
- **Note connexe (vérifiée)** : l'aperçu natif résout aussi le compte par plateforme (`detail-native-preview.tsx:55` : premier `a.platform === platform`) au lieu du `socialAccountId` porté par la cible — dès qu'un client a 2 comptes Instagram, l'écran de validation affiche le mauvais handle. Fix S : lookup par `target.socialAccountId` (pattern correct déjà présent à `content-targets.tsx:71`), fallback plateforme si null.

### [P2] API de mutations du board 100 % synchrone : incompatible Server Actions / TanStack Query
- **Où** : `components/app/studio/board-state.ts:105,132,148,152` ; call-sites optimistes : `board-batch-actions.tsx:74-97`, `board-kanban.tsx:70-73`
- **Constat** : useBoardState expose des mutations `void` synchrones (setStatusBatch, scheduleBatch, sendReviewRequest…) ; les appelants enchaînent mutation + toast succès immédiat + clear de sélection, encodant « la mutation ne peut pas échouer ».
- **Scénario d'échec / coût à l'échelle** : au câblage, chaque mutation devient async avec échec possible (RLS, réseau, transition refusée) : tous les call-sites sont à convertir (pending/rollback, sélection vidée après succès seulement). Plus gros poste de réécriture du studio, et les toasts optimistes deviennent des mensonges UX en prod.
- **Pourquoi ça bloque le scaling** : chaque action ajoutée sur ce contrat synchrone grossit la facture de conversion.
- **Reco** : sans rien câbler : signatures en `async (…) => Promise<void>` (impl mock résolue immédiatement), regrouper dans un objet `BoardMutations` documenté comme seam Supabase, toasts en attente de la promesse. Le swap devient mécanique.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query), §7

### [P2] Aperçu natif du détail = réimplémentation dupliquée de l'aperçu du composer (~150 lignes, divergence déjà visible)
- **Où** : `detail-native-preview.tsx:172-214` (CaptionBlock) vs `composer/composer-preview.tsx:150-189` (CaptionPreview) ; `detail-preview-media.tsx:30-64` vs `composer-preview.tsx:72-119`
- **Constat** : troncature « … plus » à IG_TRUNCATE_AT, hashtags, compteur/flèches de carrousel et header compte existent en deux exemplaires quasi identiques (le commentaire du fichier l'assume) ; les dots de carrousel existent déjà côté composer mais pas côté détail — divergence entamée.
- **Scénario d'échec / coût à l'échelle** : tout ajustement de la simulation IG doit être fait deux fois ; un oubli = aperçu détail qui contredit l'aperçu composer pour le MÊME contenu, sur la promesse centrale du produit.
- **Pourquoi ça bloque le scaling** : la grille et le portail affichent aussi des simulations de post — à 3-4 surfaces, chaque évolution des specs coûte n corrections synchronisées.
- **Reco** : primitives partagées dans components/shared : `TruncatedCaption`, `PreviewCarousel`, `PostPreviewHeader` ; les deux aperçus les composent avec leurs variantes.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Contrats de données non bornés : grille, calendrier — tout l'historique client chargé, transformé et rendu
- **Où** : `grid/page.tsx:150-171` + `grid-board.tsx:63-110` (chaque tuile en DOM, grid-cols-3, ni virtualisation ni « charger plus ») ; `calendar/page.tsx:32` + `use-calendar-state.ts:101-122` (navigation par mois en pur état client sur la totalité des items)
- **Constat** : les props (`published: GridTileData[]`, `items: ContentItem[]`) n'offrent aucun seam de pagination ou de fenêtre de période (searchParam, cursor, onLoadMore).
- **Scénario d'échec / coût à l'échelle** : client actif 3 ans ≈ 1 500 posts : payload RSC de plusieurs Mo, et au câblage le contrat force un `select * from content_items where client_id=…`.
- **Pourquoi ça bloque le scaling** : c'est le principal risque pluriannuel du périmètre — la grille IG réelle pagine (l'API Graph aussi), le calendrier n'a besoin que de [mois-1, mois+1].
- **Reco** : acter le contrat dès la preview : grille = première page (~60 tuiles) + hasMore/onLoadMore (futur cursor `.range()`) ; calendrier = items scoped à la fenêtre affichée, période en searchParam `?month=` pour que le Server Component requête par intervalle. Les mocks simulent ces pages sans changer le rendu.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 ; PRD §6

### [P2] La palette ⌘K rend TOUS les contenus de TOUS les clients dans le DOM
- **Où** : `components/app/shell/command-palette.tsx:63,144-159` (un CommandItem par contenu, légende complète en keywords l.149, filtrage mémoire cmdk)
- **Constat** : pattern « liste exhaustive pré-rendue » — l'inverse du modèle cible (recherche server-side bornée sous RLS + index Postgres).
- **Scénario d'échec / coût à l'échelle** : avec des années d'usage, l'ouverture de la palette monte des milliers d'items en mémoire/DOM : palette lente, payload énorme.
- **Pourquoi ça bloque le scaling** : cette architecture devra être REMPLACÉE, pas branchée.
- **Reco** : groupe « Contenus » en recherche à la frappe (debounce + TanStack Query vers une action serveur, top-K filtré org/client) ; clients + navigation + actions rapides restent statiques (bornés). Même UI.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md règle 7 (defense in depth)

### [P2] Agenda unifié : dataset complet chargé d'un bloc, navigation illimitée filtrée client-side, horloge mock dans le composant
- **Où** : `components/app/agenda/unified-agenda.tsx:20,45,52,62,67-75`
- **Constat** : la prop `agenda: AgendaItem[]` reçoit la totalité de getUnifiedAgenda() ; weekOffset non borné filtre le tableau en mémoire ; `new Date(MOCK_NOW)` instancié dans le composant client.
- **Scénario d'échec / coût à l'échelle** : avec Google+Outlook synchronisés, calendar_events = années × comptes : impossible de tout charger en prop ; naviguer loin afficherait du vide ou exigerait un chargement intégral.
- **Pourquoi ça bloque le scaling** : le modèle cible est un fetch par plage (semaine ± buffer) — la vue unified_agenda du PRD s'y prête ; l'état « weekOffset sur données complètes » devra être remplacé par une query keyed-by-range.
- **Reco** : garder l'UI, changer l'alimentation : TanStack Query keyed par weekStart (prefetch semaine adjacente) derrière la même interface AgendaItem[] ; `now` injecté en prop depuis la page serveur.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 ; PRD calendar_events

### [P2] Agenda : identité des calendriers = libellé FR affiché, liste des filtres dérivée des events chargés
- **Où** : `components/app/agenda/agenda-utils.ts:119-121` (calendarKey = name.fr) ; `unified-agenda.tsx:23-37,57-61` (buildCalendars depuis les events, état enabled porté par chaque event)
- **Constat** : le libellé bilingue FR sert d'identifiant de filtre ; la sidebar est reconstruite depuis les events présents ; la préférence enabled vit par event alors qu'elle appartient à calendar_calendars (PRD).
- **Scénario d'échec / coût à l'échelle** : deux calendriers homonymes (« Personnel » Google et Outlook) fusionnent en un filtre ; un calendrier sans event dans la plage disparaît de la sidebar dès que le fetch par plage arrive.
- **Pourquoi ça bloque le scaling** : le modèle PRD (calendar_accounts → calendar_calendars → calendar_events) place identité et visibilité au niveau calendrier — le modèle actuel devra être inversé.
- **Reco** : ajouter `calendarId` sur CalendarEvent (aligné PRD), clé de filtre = calendarId, liste des calendriers (avec enabled) passée en prop depuis la page — dérivée des comptes, pas des events.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 calendar_calendars

### [P2] File evergreen détectée par magic string sur le libellé d'un label (`l.fr === "Evergreen"`)
- **Où** : `components/app/calendar/use-calendar-derived.ts:19,39-43` ; labels libres user-éditables (`board-label-popover.tsx:42-48`)
- **Constat** : le concept métier « evergreen » (file de recyclage, auto-remplissage du PlanningShelf) repose sur une comparaison de texte de contenu éditable, sensible à la casse et à la langue. Le type ContentItem ne porte aucun attribut evergreen.
- **Scénario d'échec / coût à l'échelle** : label renommé « Intemporel » ou en minuscules → file evergreen et auto-remplissage silencieusement vides ; côté backend, aucun index/contrainte ne peut cibler « le label qui s'appelle Evergreen ».
- **Pourquoi ça bloque le scaling** : les labels seront des lignes user-éditables par org — la sémantique par nom ne survit ni au multi-tenant ni au multi-langue ; le schéma PRD §6 ne modélise pas ce flag, le figer maintenant évite une migration.
- **Reco** : promouvoir evergreen en attribut de premier ordre (boolean `isEvergreen` aligné sur une future colonne `content_items.is_evergreen`) ; adapter les mocks à iso-démo.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 (attribut à acter avant migration)

### [P2] Garde client archivé incohérente : décidée page par page (5 pages gardées, 6+ non gardées)
- **Où** : garde présente : `library/page.tsx:24`, settings:31, report:23, performance:24, content/new:68 ; absente : `[clientId]/layout.tsx:23-24`, calendar:29, grid:142-143, ideas:19, content:29, content/[contentId]
- **Constat** : la règle d'accès à un client archivé (soft-delete PRD §6) est répliquée à la main et incohérente : /library → 404, /calendar et /grid → pages interactives (chrome complet, bouton « Nouveau contenu » pointant vers une route qui 404) ; le 404 de settings rend même l'UI de désarchivage inatteignable.
- **Scénario d'échec / coût à l'échelle** : au backend, cet éparpillement produit des Server Actions qui mutent un client archivé ; chaque nouvel onglet client doit répliquer la garde.
- **Pourquoi ça bloque le scaling** : archived_at deviendra le point d'entrée du contrôle d'accès par client — écrit une fois dans le layout, ou N fois avec oublis.
- **Reco** : acter le comportement (archivé = lecture seule ou 404 global, en préservant l'accès au désarchivage) et hisser UN check dans `clients/[clientId]/layout.tsx` ; au câblage ce point devient `getClientOrThrow(ctx.org.id, clientId)`.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : PRD §6 (archived_at) ; CLAUDE.md règle 7

### [P2] Formatage de dates hors locale : 6 sites calendrier utilisent formatTime/formatDateTime avec défaut fr
- **Où** : `calendar/content-quick-view.tsx:64`, `day-entry.tsx:21`, `week-view.tsx:200`, `calendar-dnd.tsx:100`, `day-sheet-row.tsx:56`, `export-dialog.tsx:148` ; cause : défauts `locale = DEFAULT_LOCALE` dans `lib/format.ts:15-50`
- **Constat** : deux APIs co-existent (fonctions nues à défaut fr vs `useFormat()` lié à la locale) ; en EN, l'aperçu rapide, la vue semaine, l'export et le ghost de drag affichent « mer. 10 juin · 09:00 » (vocabulaire FR, 24 h).
- **Scénario d'échec / coût à l'échelle** : chaque nouveau composant a 50 % de chance de choisir la mauvaise API — même classe de bug que le fix b64b959.
- **Reco** : remplacer par useFormat()/getFormat() dans les 6 fichiers, puis rendre le paramètre locale OBLIGATOIRE dans lib/format.ts (seule makeFormat lie la locale) pour empêcher toute récidive à la compilation.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui (rendu EN corrigé)   **Verrou PRD/CLAUDE.md** : chantier i18n FR/EN

### [P2] Contexte reviewer sans abstraction : DEMO_REVIEWER_CLIENT_ID résolu dans 3 fichiers, casts `as Client`, paramètre par défaut tenant-implicite
- **Où** : `(portal)/layout.tsx:11-12`, `portal/page.tsx:19-20`, `portal/[contentId]/page.tsx:45` ; `lib/mocks/index.ts:146` (`getPortalContent(clientId = DEMO_REVIEWER_CLIENT_ID)`, appelé SANS argument à portal/page.tsx:24)
- **Constat** : pas d'équivalent de getActiveOrg pour le reviewer ; deux pages forcent `getClient(...) as Client` (crash runtime sur id invalide au lieu d'un notFound) ; le default param scope silencieusement sur le client démo.
- **Scénario d'échec / coût à l'échelle** : au câblage client_members : 3 points de modification, et un futur `getPortalContent()` sans argument renverrait le contenu du mauvais tenant — sur la surface la plus sensible du produit.
- **Reco** : `getReviewerContext(): { client, reviewer }` dans la façade (seul endroit qui connaît DEMO_REVIEWER_CLIENT_ID aujourd'hui, client_members demain), notFound() si absent ; clientId OBLIGATOIRE dans getPortalContent (règle 7, defense in depth explicite).
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md règle 7, §3 (contexte Reviewer)

### [P2] Le flux login ignore le paramètre `next` — les deep links post-auth casseront au câblage
- **Où** : `components/auth/login-form.tsx:27,45,53` ; `otp-form.tsx:77` ; 0 lecture de searchParams dans app/(auth)
- **Constat** : le futur middleware (§9) émet `/login?next=<pathname>`, mais tous les chemins de sortie poussent `routes.dashboard` en dur.
- **Scénario d'échec / coût à l'échelle** : reviewer qui suit un lien Brevo vers /portal/ct_123, session expirée → login → atterrit sur /dashboard, route interdite à un Reviewer (aucune org). Tout le parcours d'invitation client casse ; chaque canal de notification produit des deep links.
- **Reco** : la page login lit `searchParams.next` (validé chemin relatif interne — anti open-redirect) et le passe en prop aux forms comme destination par défaut. Comportement démo inchangé sans param. (Le chemin magic link transitera en plus par emailRedirectTo au câblage.)
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §9
​
### [P2] Aucune couche formulaire RHF+Zod : wizard + 7 sections de réglages en useState manuel, validations ad hoc, aucun schéma réutilisable
- **Où** : `onboarding/wizard-types.ts:243-253` (EMAIL_RE maison, isIdentityValid), `wizard-shell.tsx:40-104`, `client-settings/section-profile.tsx:39-60`, `section-approval.tsx:57-67`, `section-brand-kit.tsx:44-61`, `section-cadence.tsx:29-49`, `section-slots.tsx:26-50`
- **Constat** : zéro zod/react-hook-form dans le projet (absents de package.json) alors que la stack les impose ; dirty calculé à la main par champ ; aucun schéma pour ClientDraft, Client, BrandKit, RecurringSlot.
- **Scénario d'échec / coût à l'échelle** : au câblage, chaque save() devient une Server Action qui DOIT parser en Zod (règle 27) : validation écrite deux fois avec divergences (email accepté par EMAIL_RE, refusé par z.email() ; bornes clampées client non re-validées serveur).
- **Bug concret déjà présent (vérifié)** : `section-approval.tsx:61` — `dirty = mode !== client.approvalMode` uniquement : modifier le délai de relance (reminderDays, l.143-152) laisse le bouton Enregistrer grisé (« aucune modification ») ; save() ignore aussi reminderDays. Fix court terme S.
- **Reco** : écrire dès maintenant les schémas Zod (clientDraftSchema, clientProfileSchema, brandKitSchema, recurringSlotSchema, cadenceSchema) dans lib/schemas (future packages/shared), en dériver les types, remplacer les validations maison par safeParse ; brancher RHF section par section sans toucher au visuel (formState.isDirty élimine la classe de bug reminderDays).
- **Effort** : L (schémas + conversion) / S (fix reminderDays)   **Impact scaling** : fort
- **⚠ Comportement** : oui (reminderDays enregistrable)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1, règle 27

### [P2] Composants dupliqués onboarding vs client-settings, comportements déjà divergents ; stub « reconnecter » copié dans 5 fichiers
- **Où** : `client-settings/string-list-editor.tsx:11` vs `onboarding/string-list-editor.tsx:14` (le second déduplique + borne à maxItems, le premier non) ; BrandColorPalette ×2 (sources et a11y divergentes) ; `slot-row.tsx:23` vs `slot-editor.tsx:32` ; `settings/account-row.tsx:11` vs `section-accounts.tsx:58` (toast.warning vs toast.info) ; stub reconnect : account-row.tsx:18, section-accounts.tsx:66, calendars-tab.tsx:55, client-health-banner.tsx:47, shared/account-alert.tsx:36
- **Constat** : même domaine (marque/comptes/créneaux), deux implémentations par surface, 5 copies du futur point d'entrée OAuth avec 5 namespaces i18n.
- **Scénario d'échec / coût à l'échelle** : au câblage OAuth (règle 13), l'action reconnect réelle doit être implémentée 5 fois ; toute correction d'un seul côté crée des incohérences visibles wizard vs réglages.
- **Reco** : extraire dans components/shared : StringListEditor unique (props tone/maxItems), BrandColorPalette unique, SocialAccountRow unique, SlotFields commun, et un helper partagé `startReconnect(provider, accountId)` — futur lien vers /api/oauth/[provider].
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md règle 13 (abstraction OAuth unique)

### [P2] Code permanent emprisonné dans lib/mocks : types/, labels.ts, getDashboardTasks — et la couche i18n de prod qui en dépend
- **Où** : `lib/mocks/types/index.ts:1-8` (~170 fichiers importeurs), `lib/mocks/labels.ts:1-127` (méta statuts/plateformes, 22+ fichiers), `lib/mocks/index.ts:156-234` (getDashboardTasks = vraie logique produit), index.ts:236 (re-export d'isPast) ; côté i18n : `lib/i18n/labels.ts:1-21` + `components/shared/status-badge.tsx:5-18`, `status-dot.tsx:4`, `platform-badge.tsx:3` importent @/lib/mocks/labels ; couplage même bidirectionnel (`lib/mocks/labels.ts:1` importe MessageKey)
- **Constat** : le dossier « à jeter » mélange contrat DB, constantes produit permanentes et logique métier ; 175 occurrences d'import @/lib/mocks/(labels|types) dans 154 fichiers. Divergence actée avec CLAUDE.md §0/§4 (mocks prescrits dans packages/shared).
- **Scénario d'échec / coût à l'échelle** : le jour où on « supprime les mocks », on ne peut pas — refactor d'imports massif au pire moment (pendant le câblage), logique dashboard/agrégation à ré-identifier dans le fichier qu'on jette ; le worker ne pourra pas consommer les types tant qu'ils vivent sous apps/web/lib/mocks.
- **Reco** : créer packages/shared (prescrit) ou a minima `apps/web/lib/domain/` et y déplacer types/, labels.ts, la dérivation de statut agrégé et getDashboardTasks — avec ré-exports temporaires depuis lib/mocks pour un déplacement mécanique zéro-touch. lib/mocks ne garde que données + builders + façade.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0, §4

### [P2] Règle métier PRD §5.F (masquage des statuts techniques au client) logée dans un composant UI
- **Où** : `components/portal/portal-card.tsx:16-26` (NEUTRAL_STATUS/clientFacingStatus : publishing→scheduled, failed→scheduled, partially_published→published) et `:95-99` (statusBadgeLabel) ; importés par `portal/[contentId]/page.tsx:6`
- **Constat** : règle de confidentialité produit (pure, sans dépendance React) déclarée dans un .tsx de composant.
- **Scénario d'échec / coût à l'échelle** : la même règle sera requise hors UI — emails Brevo review-requested/content-approved, notifications, et le worker (apps/worker, app séparée, ne peut PAS importer un composant de apps/web). Duplication puis divergence : un canal montre « échec de publication » au client final — exactement ce que le PRD interdit.
- **Reco** : déplacer vers `lib/review/client-facing-status.ts` (candidat naturel à packages/shared), ré-exporter depuis portal-card pour ne toucher aucun import. Zéro changement de rendu.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §5.F

### [P2] Dictionnaire bilingue complet (~229 Ko source, FR+EN, 21 zones) embarqué dans le bundle client de chaque page
- **Où** : `lib/i18n/provider.tsx:14` → `translator.ts:2` → `dictionaries/index.ts:26-29` (FLAT fr + en aplatis eagerly ; FLAT.fr sert aussi de fallback runtime l.41, donc rien n'est tree-shakeable) ; LocaleProvider monté dans `app/layout.tsx:49`
- **Constat** : les deux locales partent dans le JS de toutes les routes alors qu'une seule est active.
- **Scénario d'échec / coût à l'échelle** : chaque zone ajoutée gonfle le bundle de toutes les pages ; une 3e langue = +50 % de payload dictionnaire. Sur la PWA iOS (cible prioritaire, réseau mobile), TTI/hydration se dégradent linéairement avec la croissance du produit.
- **Reco** : le layout serveur passe à LocaleProvider les messages de la locale ACTIVE uniquement ; le toggle charge l'autre locale en import dynamique par locale, puis router.refresh(). Zéro changement visuel.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 (PWA iOS prioritaire)

### [P3] Assemblage ComposerData + quotas dupliqué intégralement entre content/new et content/edit
- **Où** : `content/new/page.tsx:70-84` vs `content/[contentId]/edit/page.tsx:67-81` (8 sources identiques, copier-coller strict)
- **Constat / échec** : au câblage cet assemblage devient ~8 requêtes à paralléliser (Promise.all) maintenues en double ; le type ComposerData garde les deux pages structurellement synchrones, mais les comportements hors type (parallélisation, cache, filtres) divergeront.
- **Reco** : fonction partagée `getComposerData(clientId): Promise<ComposerData>` consommée par les deux pages — prépare directement le Promise.all du câblage.
- **Effort** : S   **Impact scaling** : moyen   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] getT/getLocale/getFormat non mémoïsés par requête + Intl.DateTimeFormat reconstruit à chaque appel
- **Où** : `lib/i18n/server.ts:26-47` (aucun `cache()`) ; `lib/format.ts:11-13,51,70` (formatters neufs par appel) ; `portal-card.tsx:37-39` (×3 awaits par carte, rendu en liste)
- **Constat / échec** : sur les pages listes, 2N+ constructions Intl par requête SSR — quelques ms de CPU pur formatage par requête sur le VPS mono-instance, croissant avec volume et trafic.
- **Reco** : wrapper getLocale/getT/getFormat dans `cache()` de React (pattern déjà prescrit §3 pour getActiveOrg) ; mémoïser les Intl.*Format dans une Map module-level clé (locale|tz|options). Zéro changement d'API.
- **Effort** : S   **Impact scaling** : moyen   **⚠ Comportement** : non   **Verrou** : CLAUDE.md §3 (pattern cache())

### [P3] Listes non bornées secondaires : historique du portail et centre de notifications
- **Où** : `portal/page.tsx:26-28,62-66` + `lib/mocks/index.ts:146-148` (getPortalContent sans limit/cursor) ; `notifications/page.tsx:14` + `notification-center.tsx:19,23,26,88-96` (unreadCount et filtre dérivés du tableau complet)
- **Constat / échec** : après 2 ans à 20 posts/mois, ~500 PortalCard SSR (première impression client = page la plus lente) ; la table notifications est la plus croissante du produit (append-only, triple canal).
- **Reco** : paramètre optionnel `{ limit?, cursor? }` sur les getters de listes (convention façade), limite généreuse aujourd'hui (aucun changement visible), « voir plus »/infinite query au câblage ; unreadCount servi par le serveur ; couture markAllRead (future Server Action).
- **Effort** : S/M   **Impact scaling** : moyen   **⚠ Comportement** : non   **Verrou** : CLAUDE.md §1 (Realtime)

### [P3] Règle de fer ≤250 lignes : 4 fichiers métier + 7 dictionnaires en infraction, zone i18n « board » vide et morte
- **Où** : `composer/preflight.ts` (296 l, 9 checkers), `composer/composer-media.tsx` (257), `onboarding/wizard-types.ts` (257, mélange types/constantes/validation), `lib/mocks/history.ts` (270, 2 ressources indépendantes, coupure naturelle l.80) ; dictionnaires : studio.fr 464, studio.en 432, calendar.fr/en 319, onboarding.fr 276, composer.en/fr 272/270 ; `zones/board.fr.ts:2-4` exporte `board: {}` sans aucun consommateur (les clés board vivent sous studio.*)
- **Constat / échec** : preflight.ts accumulera les règles (quotas IG live, TikTok, fenêtre de grâce) → 400+ lignes avant la fin des Lots 1-2 ; les dictionnaires géants rendent les diffs de trads illisibles. Bonus vérifié : `getActiveClient(): Client` (index.ts:48-50) indexe `[0]` sans garde — type menteur si tous les clients démo sont archivés ; et la façade re-exporte `isPast` (util de date) brouillant la frontière données/utils.
- **Reco** : scinder preflight en preflight/{checks-content,checks-caption,index}.ts ; extraire le bloc « détails du média actif » de composer-media (l.179-225) ; scinder wizard-types (draft/constants/validation Zod) et history (versions/activity) ; déplacer les clés kanban/board de studio.* vers board.* (repasse studio sous 250) ou supprimer la zone morte ; typer `getActiveClient(): Client | undefined` ; supprimer le re-export d'isPast.
- **Effort** : S   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : CLAUDE.md §2 règle 24

### [P3] Identité auteur codée en dur dans le fil de discussion
- **Où** : `components/app/studio/detail-thread.tsx:54` (`authorName: "Étienne Mercier"` littéral dans sendReply, alors que reviewerName arrive en prop)
- **Constat / échec** : au câblage, tout owner qui répond apparaît comme « Étienne Mercier » tant que la ligne n'est pas repérée — visible par le freelance et, en miroir portail, par le client.
- **Reco** : passer `currentUserName` (ou l'objet user) en prop depuis la page détail via la façade.
- **Effort** : S   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : CLAUDE.md §0

### [P3] Normalisation des hashtags (préfixe #) dupliquée en 3+1 points
- **Où** : `composer/composer-types.ts:139`, `detail-manual-center.tsx:75` (chemin copie presse-papiers TikTok), `detail-native-preview.tsx:59` ; variante per-tag : `content/[contentId]/page.tsx:123` ; lib/caption.ts (module dédié) n'a pas de formatHashtags
- **Constat / échec** : une évolution du format appliquée à un seul point = légende copiée dans TikTok différente de celle prévisualisée, sur le canal manuel où l'utilisateur copie sans relire (extractHashtags normalise déjà lowercase+dédoublonnage, les sites inline non).
- **Reco** : `formatHashtags(tags: string[]): string` dans lib/caption.ts, utilisé aux 4 call-sites.
- **Effort** : S   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] Contrôles interactifs imbriqués dans le `<Link>` de la carte studio
- **Où** : `components/app/studio/content-card.tsx:81-225` (Checkbox l.88-103, bouton Relancer l.188-200, CardLabelPopover l.220-225, wrapper anti-navigation dans board-label-popover.tsx l.110-114)
- **Constat / échec** : HTML invalide (contrôles interactifs dans une ancre), nom accessible de l'ancre pollué, et chaque nouveau contrôle doit se rappeler du span preventDefault sous peine de naviguer au clic — la carte kanban a évité le problème.
- **Reco** : pattern « overlay link » : carte = div, le titre porte le Link avec pseudo-élément étendu (after:absolute after:inset-0), contrôles au-dessus (z-10) sans preventDefault.
- **Effort** : S   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] Re-renders complets du composer à chaque frappe + Intl.NumberFormat par render (réserve de perf)
- **Où** : `composer/composer-screen.tsx:94-101,108-119` (draft monolithique, computePreflight relancé sur chaque frappe : validateMedia média×plateformes + regex banned words) ; `composer-media.tsx:63`, `media-picker-dialog.tsx:42` (new Intl.NumberFormat par render)
- **Constat / échec** : aucun problème à l'échelle actuelle ; sur mobile bas de gamme avec carrousel 10 slides + longue légende, frappe potentiellement laggy. Croît linéairement avec les règles preflight.
- **Reco** : si un lag est mesuré : React.memo sur les sections par slice de draft, debounce computePreflight (150 ms), Intl.NumberFormat hissés en module-level (cache par locale).
- **Effort** : M   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] Jours de semaine : 4 jeux de clés i18n parallèles + WEEKDAY_KEYS copié-collé ×3 + export mort hardcodé FR
- **Où** : jeux i18n : `agenda/agenda-utils.ts:13-21`, `performance/perf-utils.ts:37-45`, `client-settings/constants.ts:47-55`, `onboarding/wizard-types.ts:171-207` (8 listes FR+EN, divergence réelle « lun » vs « Lun » masquée par CSS capitalize) ; WEEKDAY_KEYS identique dans `month-grid.tsx:15-23`, `week-view.tsx:26-34`, `export-dialog.tsx:22-30` (l'ordre des données vit ailleurs : WEEK_OPTS calendar-utils.ts:79) ; code mort : `calendar-utils.ts:134` (WEEKDAY_LABELS FR hardcodé, 0 importeur, homonyme piégeux de l'export légitime de client-settings)
- **Constat / échec** : changer le jour de début de semaine (client US = dimanche, cas réel à l'ouverture SaaS) impose de retrouver toutes les copies ; ajouter une locale exige 8 éditions ; l'export mort invite à une future régression i18n.
- **Reco** : helper unique `weekdayLabel(isoWeekday, locale, style)` basé Intl dans lib/format.ts (approche déjà validée par b64b959) ; exporter WEEKDAY_KEYS depuis calendar-utils à côté de WEEK_OPTS ; supprimer WEEKDAY_LABELS mort.
- **Effort** : S   **Impact scaling** : moyen   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] Formatage numérique compact réimplémenté localement avec l'hypothèse « 2 locales » codée en dur
- **Où** : `performance/perf-utils.ts:7-34` (compactNumber duplique formatFollowers de lib/format.ts:79-87 avec un rendu déjà divergent « 1,7 k » vs « 1.7k » ; percent/signedPercent répètent `locale === 'fr' ? ',' : '.'`)
- **Constat / échec** : un 3e affichage compact choisira une implémentation au hasard ; l'ajout d'une locale (es, de) casse silencieusement les séparateurs.
- **Reco** : centraliser dans lib/format.ts via Intl.NumberFormat (notation compact / style percent) derrière un wrapper mince qui préserve le rendu validé (snapshots FR/EN).
- **Effort** : S   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] Générateurs d'IDs par compteur module-level ×3 + cache Intl non borné
- **Où** : `client-settings/section-slots.tsx:14`, `onboarding/slot-editor.tsx:26`, `onboarding/pillar-editor.tsx:23` (trois `let counter = 0`, préfixes divergents, reset à chaque chargement de page) ; `agenda/agenda-utils.ts:34` (partsCache Map iso|tz sans éviction)
- **Constat / échec** : persister ces IDs brouillon tels quels au câblage = collisions (slot_new_1 réutilisé) ; le cache accumule une entrée par instant×fuseau sur une session PWA longue.
- **Reco** : helper unique `makeDraftId(prefix)` (crypto.randomUUID) dans lib/utils ; borner partsCache (LRU simple) ou le supprimer.
- **Effort** : S   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] Mocks : commentsCount dénormalisé contredit les COMMENTS générés (deux sources de vérité)
- **Où** : `lib/mocks/content.ts:139-146` (3/2/1 à la main) vs `interactions.ts:11-70` (2 pour changes_requested, 1-2 pour in_review, 0 pour approved)
- **Constat / échec** : badge « 1 commentaire » sur un contenu approuvé → fil vide, visible dans la démo validée (badge rendu dans studio, grille et calendrier). En prod ce champ sera un count SQL — le pattern « compteur écrit à la main à côté de la source » est l'anti-pattern à ne pas reproduire.
- **Reco** : supprimer commentsCount du builder et le dériver dans la façade (`COMMENTS.filter(...).length`) — même sémantique que le futur count SQL.
- **Effort** : S   **Impact scaling** : moyen   **⚠ Comportement** : oui (badges corrigés)   **Verrou** : aucun

### [P3] Enrichissement démo couplé aux index positionnels du BLUEPRINT (ids ct_<client>_<i>)
- **Où** : `lib/mocks/content.ts:134` (ids par position) ; référencés en dur par `content-extra.ts:22-92`, `history.ts:7-263`, `metrics.ts:20-23`, `notifications.ts:18,46,60,74,116,130`
- **Constat / échec** : insérer un post au milieu du BLUEPRINT décale tous les indices : l'historique v1→v3 s'attache à un autre contenu, l'annotation pointe une image sans rapport, la notification « Échec » ouvre un contenu publié — sans erreur de compilation, la démo validée se dégrade en silence.
- **Reco** : slug stable par entrée du Blueprint (`ct_${client.id}_${slug}`) + assert de cohérence dev (chaque clé d'override/href résout vers un contenu existant).
- **Effort** : M   **Impact scaling** : moyen   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] MemberRole réduit à owner|reviewer — divergence avec le modèle 4 rôles du PRD
- **Où** : `lib/mocks/types/core.ts:47` ; consommé par `types/collab.ts:39` (Comment.role) et des checks binaires (`detail-thread-items.tsx:30`, `detail-thread.tsx:42,118`)
- **Constat / échec** : le PRD définit organization_members (owner|admin) + client_members (reviewer|editor) ; un futur commentaire admin serait rendu côté client, un commentaire editor côté agence, sans erreur de type.
- **Reco** : `OrgRole = "owner"|"admin"`, `ClientRole = "reviewer"|"editor"`, `MemberRole = OrgRole|ClientRole` dès maintenant (mocks inchangés visuellement, contrat correct).
- **Effort** : S   **Impact scaling** : moyen   **⚠ Comportement** : non   **Verrou** : CLAUDE.md §2.4 ; PRD §6

### [P3] Types du contrat pollués par des champs purement démo (Client.theme → pool Pexels ; MediaAsset en URLs directes)
- **Où** : `lib/mocks/types/core.ts:74` (`theme: keyof typeof import("../images").IMAGES`, fuit dans use-library-assets.ts:31) ; `core.ts:115-130` (thumbUrl/fullUrl au lieu de storage_path/thumb_path du PRD)
- **Constat / échec** : au câblage, Client n'a pas de theme (casse bruyante ou contamination du schéma DB par la démo) ; pour MediaAsset l'écart est acceptable (le serveur résoudra path→URL signée) mais doit être un choix documenté.
- **Reco** : `DemoClient = Client & { theme: ImageTheme }` côté mocks ; documenter en tête de MediaAsset que thumbUrl/fullUrl sont la projection résolue des paths (shape UI identique après câblage).
- **Effort** : S   **Impact scaling** : moyen   **⚠ Comportement** : non   **Verrou** : PRD §6 ; CLAUDE.md §2.20-21

### [P3] notifications.ts contourne lib/routes.ts : 10 hrefs en littéraux
- **Où** : `lib/mocks/notifications.ts:18,32,46,60,74,88,102,116,130,144` (alors que getDashboardTasks passe par routes.content()/routes.settings)
- **Constat / échec** : un renommage de segment met à jour routes.ts et tous les call-sites… sauf ces 10 littéraux (404 silencieux). En prod, les hrefs seront construits par le serveur/worker — routes.ts est le pattern à centraliser.
- **Reco** : remplacer chaque littéral par le helper (routes.content, routes.settings, routes.clientCalendar…) — déjà couvert.
- **Effort** : S   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : aucun

### [P3] Hygiène i18n résiduelle (5 findings mineurs vérifiés)
- **Où / Constat** :
  1. `zones/portal.fr.ts:70-84` : SelectionBar et AccountAlert (composants app-wide, 11 fichiers) traduits sous le namespace `portal.shared.*` — bloquerait un futur split par surface. Reco : namespace top-level `shared`.
  2. `zones/fr.ts:22-41` + `dictionaries/index.ts:10-11` : spreads superficiels sans garde de disjonction — une future zone déclarant `common:` écrase silencieusement la base au runtime (MessageKey = intersection de types, compile quand même ; getMessage renvoie la clé brute). Reco : test de disjonction ou `satisfies`.
  3. `Widen<T>` copié-collé dans 19 fichiers (fr.ts:137 + 18 zones .en.ts). Reco : exporter une fois.
  4. Strings a11y anglaises vendorées : `ui/dialog.tsx:64` et `ui/sheet.tsx:67` (sr-only « Close », ~28 fichiers consommateurs), `ui/sidebar.tsx:263-278` (« Toggle Sidebar ») — un utilisateur FR de lecteur d'écran entend de l'anglais. Reco : passer par useT() (common.close, nav.toggleSidebar).
  5. `lib/i18n/format-message.ts:102` : le `#` d'un plural est remplacé globalement AVANT récursion — un plural imbriqué sur un autre paramètre afficherait le mauvais nombre (latent, 0 cas aujourd'hui) ; aucun échappement de `#` littéral. Reco : remplacer # après récursion sur la branche courante, ou documenter la limite + test.
  Divers : `app/layout.tsx:19` — import dynamique inutile de getT alors que le module est déjà importé statiquement l.7 (remplacer par l'import statique) ; `app/layout.tsx:34-35` + `manifest.ts:12-13` — hex #0f3d63/#0b2238 dupliqués sans constante (exception themeColor légitime, mais créer `lib/brand-tokens.ts` consommé par les deux, sinon barre de statut iOS désynchronisée au premier rebranding) ; triplication du BrandMark et duplication du hero (`page.tsx:17-38` vs `(auth)/layout.tsx:8-38` vs `(portal)/layout.tsx:18-23` — extraire `components/shared/brand-mark.tsx` + `landingFeatures(t)`).
- **Effort** : S chacun   **Impact scaling** : faible   **⚠ Comportement** : non   **Verrou** : CLAUDE.md règle 25 (exception documentée pour themeColor)

---

## Code production-grade proposé (NON appliqué)

Les trois seams à poser AVANT le câblage — chacun sans changer un pixel :

```ts
// apps/web/lib/clock.ts — SEUL fichier autorisé à importer lib/mocks/time
import { MOCK_NOW } from "@/lib/mocks/time";
export const now = (): Date => MOCK_NOW; // au câblage : () => new Date()
// Les fonctions pures reçoivent le temps : isOverdue(item, now()), computePreflight(draft, ctx, now())
```

```ts
// apps/web/lib/mocks/index.ts — façade async + cache(), contrat = shape DB (strings, pas L<string>)
import { cache } from "react";
import { getLocale } from "@/lib/i18n/server";
import { pick } from "@/lib/i18n/localized";

export const getClient = cache(async (clientId: string): Promise<Client | undefined> => {
  // impl mock : Promise.resolve(CLIENTS.find(...)) — impl Supabase : query RLS + filtre org_id explicite
  return CLIENTS.find((c) => c.id === clientId);
});

export const getContentItems = cache(async (clientId: string, opts?: { limit?: number; cursor?: string }) => {
  const locale = await getLocale();
  return CONTENT_ITEMS.filter((c) => c.clientId === clientId && !c.deletedAt)
    .slice(0, opts?.limit ?? 200)
    .map((c) => ({ ...c, title: pick(c.title, locale), caption: pick(c.caption, locale) })); // strings = shape DB
});

export const getContentItem = cache(
  async (id: string, opts?: { includeTrashed?: boolean }): Promise<ContentItemView | undefined> => {
    const item = CONTENT_ITEMS.find((c) => c.id === id);
    if (!item || (item.deletedAt && !opts?.includeTrashed)) return undefined;
    return resolve(item);
  },
);

// Contexte reviewer — équivalent portail de getActiveOrg (CLAUDE.md §3)
export const getReviewerContext = cache(async (): Promise<{ client: Client; reviewer: Reviewer }> => {
  const client = await getClient(DEMO_REVIEWER_CLIENT_ID); // demain : résolution client_members
  const reviewer = getReviewer(DEMO_REVIEWER_CLIENT_ID);
  if (!client || !reviewer) notFound();
  return { client, reviewer };
});
```

```ts
// apps/web/lib/actions/review.ts — stub de mutation, future Server Action Zod-validée
export type ReviewDecision = { contentId: string; decision: "approved" | "changes_requested"; message?: string };
export async function submitReviewDecision(input: ReviewDecision): Promise<{ ok: true } | { ok: false; error: string }> {
  reviewDecisionSchema.parse(input);              // schéma Zod déjà écrit, réutilisé par la Server Action
  await new Promise((r) => setTimeout(r, 300));   // simulation preview
  return { ok: true };
  // Au câblage : 'use server' + getReviewerContext() + insert approvals (INSERT-ONLY) + revalidatePath('/portal')
}
```

```ts
// apps/web/lib/content-rules.ts — règle d'éditabilité unique (PRD §5.B)
const READ_ONLY: ContentStatus[] = ["publishing", "published", "partially_published"];
export const isEditable = (s: ContentStatus) => !READ_ONLY.includes(s) && s !== "in_review";
export const editableFields = (s: ContentStatus) => (s === "scheduled" ? (["scheduledAt"] as const) : "all");
```

Et la règle Biome qui verrouille les seams (à ajouter dans biome.json une fois les fuites purgées) : interdire `@/lib/mocks/*` (hors `@/lib/mocks/types`) dans `components/**` et tout fichier `use client` via `no-restricted-imports`.

## Ce qui va bien (à préserver)

- **Pages 100 % Server Components async** (23/23) avec composants clients feuilles : la topologie serveur/client est déjà la bonne pour le streaming Supabase — c'est la couche d'assemblage de données, pas la structure, qui est à corriger.
- **La façade `lib/mocks/index.ts` existe et est majoritairement respectée pour les lectures** : le seam de branchement est identifié, il faut le durcir (async, locale, bornes), pas le créer.
- **Types miroir du PRD §6** (`lib/mocks/types/core.ts` : enums ContentStatus/TargetStatus/Platform, PublishJob, ContentTarget avec socialAccountId/externalPostId/permalink) : le contrat DB est déjà pensé — les divergences (L<string>, MemberRole, theme) sont localisées et corrigeables.
- **`lib/routes.ts` comme source unique des URLs** : exactement ce qu'il faut pour dériver le futur middleware deny-by-default et les hrefs serveur (worker, emails).
- **Le pattern overlay du calendrier** (`use-calendar-state.ts:69,101-107` : props = source de vérité, Map d'overrides locale) : c'est LE modèle à généraliser à la grille et à la library — il est déjà écrit et validé dans le repo.
- **`calendar-actions.ts` et la library côté i18n** (Translator/locale injectés partout) : le bon pattern existe, la grille doit s'y aligner.
- **i18n custom par zones avec MessageKey typé** (autocomplétion, parité FR/EN par Widen) : architecture saine pour un produit à 2 locales sans next-intl — seuls le bundling eager des 2 locales et quelques rangements sont à revoir.
- **`useFormat()`/`getFormat()` liés à la locale** (lib/i18n/format-bound.ts) : la bonne API de formatage existe — il reste à rendre son usage obligatoire.
- **Décision produit du contenu démo bilingue** : légitime et utile pour la validation — elle doit juste migrer du contrat vers l'intérieur des mocks.
- **URLs racine propres sans préfixe /app** : plus simples que le plan §9 ; c'est la doc qu'il faut corriger, pas le code.
