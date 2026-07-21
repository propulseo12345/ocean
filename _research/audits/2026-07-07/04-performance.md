# Audit — Performance (2026-07-07)

> Dimension 04 — ingénieur performance senior. Périmètre : `apps/web` (préview front validée, mocks, i18n FR/EN), mesures faites sur build de production réel (`next build`, chunks `.next/static`). Tous les findings ci-dessous ont été vérifiés fichier:ligne et ont résisté à la réfutation adversariale. Aucun finding supposé.

## Verdict

La dimension performance est **structurellement saine au niveau des pages** (100 % des pages sont des Server Components async qui lisent la façade mocks côté serveur et passent des props typées — exactement la forme attendue pour le câblage Supabase) mais elle porte **trois dettes systémiques** qui vont coûter cher précisément au moment prévu par la roadmap : (1) la couture de données `lib/mocks/index.ts` est consommée **des deux côtés** de la frontière server/client — la coquille (`app-sidebar`, palette ⌘K, notifications) appelle les getters dans le navigateur, ce qui embarque le dataset démo dans le JS client de toutes les routes et casse la promesse « brancher Supabase sans réécrire l'UI » (CLAUDE.md §0) ; (2) **aucune signature de la façade ne porte de borne** (range/cursor/limit) : grille, calendrier, board studio, picker médiathèque et palette chargent l'historique intégral du client — câblé tel quel, chaque visite devient un `SELECT` sans `LIMIT` dont le coût croît linéairement avec les années ; (3) les **chemins de rendu chauds ne sont pas mémoïsés** (zéro `React.memo` dans `components/`, formatteurs `Intl` construits à chaque appel, état composer monolithique) — invisible sur les mocks, jank garanti sur iPhone (parcours prioritaire §12) dès que les volumes sont réels. Aucun P0 : rien ne casse aujourd'hui, mais les P1 doivent être traités **avant** le câblage — chacun coûte 3 à 5× plus cher une fois Supabase branché. S'y ajoute un angle mort de mise en prod immédiate : zéro `loading.tsx`/`error.tsx`/`Suspense` dans tout `app/`.

## Fonctionnement reel observe

**Flux de données nominal (le bon pattern, majoritaire).** Chaque page est un Server Component async qui appelle la façade `apps/web/lib/mocks/index.ts` (getters fermant sur les constantes `CLIENTS`, `CONTENT_ITEMS`, `NOTIFICATIONS`…, construites à l'évaluation du module — `lib/mocks/content.ts:192-195`) puis sérialise des props vers un workspace client : `calendar/page.tsx:32` → `EditorialCalendar`, `grid/page.tsx:150-166` → `FeedGrid` (mapping en DTO `GridTileData`), `content/page.tsx:31` → `ContentBoard`, `content/new/page.tsx:80` → `ComposerScreen`, `performance/page.tsx` → `PerfWorkspace` (pré-calcul serveur `getAllPerfData`). Aucune fonction de listing de la façade ne porte de paramètre `from/to/cursor/limit` (`lib/mocks/index.ts:53` `getContentItems(clientId?)`, `:70` `getImportedPosts`, `lib/mocks/library.ts:116` `getLibraryAssets`).

**Flux dérogatoire (la fuite).** Les composants de la coquille, montés par `app/(app)/layout.tsx` sur chaque page, sont `"use client"` et appellent les getters **au render dans le navigateur** : `command-palette.tsx:54-63` (`getClients()` + `getContentItems()` sans clientId), `app-sidebar.tsx:39`, `client-switcher.tsx:71`, `quick-capture.tsx:37`, `shell/client-nav.ts:35`, `client-health-banner.tsx:23`, `notifications-button.tsx:17-18`, `nav-user.tsx:26`. Preuve build : le chunk `3rlzifc5vb8ir.js` (39 Ko brut / 13 Ko gzip, contient `COPY_POOL` donc tout le graphe contenus) est référencé par les 18 manifests de routes `(app)` ; les mocks `CLIENTS` sont en plus dans le chunk racine chargé sur `/login`, `/otp` et `/portal`.

**i18n.** `app/layout.tsx:49` monte `LocaleProvider` (`"use client"`, `lib/i18n/provider.tsx:14`) qui importe `createTranslator` → `dictionaries/index.ts:2-11` : imports statiques FR + EN + 18 zones × 2 locales, aplatis eagerly à l'init du module (`:26-29`, `FLAT`). Résultat mesuré : chunk racine `2hybkqc84-t6e.js` = 179 Ko brut / 58 Ko gzip contenant les deux locales (« Studio de contenu » ET « Content studio ») + les mocks `CLIENTS`, référencé par 24/26 manifests. `getLocale()` (`lib/i18n/server.ts:27,30`) lit `cookies()` puis `headers()` depuis le root layout : 100 % des routes sont rendues dynamiquement.

**Formatage et temps.** `lib/format.ts:11-13` construit un `Intl.DateTimeFormat` **à chaque appel** (idem `RelativeTimeFormat:51`, `isSameDay:68-77` en construit deux), consommé en boucle par le calendrier, l'agenda, le board et la médiathèque — alors que le pattern de cache correct existe déjà dans le même sous-arbre (`calendar-utils.ts:19-33`, `KEY_FMT_CACHE`). L'horloge est la constante figée `MOCK_NOW` (`lib/mocks/time.ts`), importée par 22 fichiers dont `lib/format.ts:2` (code permanent).

## Findings (tries par severite P0 -> P3)

*(Aucun P0. Les doublons inter-passes ont été fusionnés ; chaque finding conserve toutes ses ancres vérifiées.)*

---

### [P1] La façade lib/mocks n'a aucune frontière server-only : le dataset démo part dans le JS client de toutes les routes, et la coquille lit les données tenant dans le navigateur
- **Ou** : `apps/web/lib/mocks/index.ts:1-35` (barrel sans `server-only`) ; appels client : `components/app/shell/command-palette.tsx:54-63`, `components/app/app-sidebar.tsx:39`, `components/app/client-switcher.tsx:71`, `components/app/shell/quick-capture.tsx:37`, `components/app/shell/client-nav.ts:35`, `components/app/shell/client-health-banner.tsx:23`, `components/app/notifications-button.tsx:17-18`, `components/app/nav-user.tsx:26`, `components/app/onboarding/wizard-shell.tsx:10`, `components/app/studio/composer/schedule-dialog.tsx:21` ; montés par `app/(app)/layout.tsx:46`
- **Constat** : ~10 composants `"use client"` de la coquille appellent `getClients()/getContentItems()/getNotifications()/getSocialAccounts()` au render côté navigateur. Le barrel importe l'intégralité du graphe démo (content + copy + history + notifications + interactions + library, ≈ 93-165 Ko de source). Vérifié sur build de prod : chunk `3rlzifc5vb8ir.js` (39 Ko brut / 13 Ko gzip, contient `COPY_POOL`) chargé par les 18 routes `(app)` ; la liste `CLIENTS` est en plus dans le chunk racine chargé même sur `/login` et `/portal`. Toutes les **pages**, elles, suivent le bon pattern (fetch serveur → props) : la fuite est limitée à la coquille + 3 fichiers isolés.
- **Scenario d echec / cout a l echelle** : au câblage Supabase, ces composants n'ont aucun moyen synchrone d'obtenir les données — chacun doit être réécrit (props serveur ou TanStack Query). Pire : si le pattern est reproduit, il pousse à interroger la DB depuis le navigateur hors du contexte org serveur (la défense en profondeur de la règle 7 saute), et la liste des clients de l'org partirait vers le portail Reviewer.
- **Pourquoi ca bloque le scaling** : le chunk partagé grossit avec chaque dataset ; en multi-tenant réel ce mode de lecture est physiquement impossible (les données ne sont plus des constantes compilées). C'est LA contradiction principale avec « brancher Supabase sans réécrire l'UI ».
- **Reco** : remonter ces lectures dans `app/(app)/layout.tsx` (Server Component) et passer des props à `AppSidebar`/`ClientSwitcher`/`CommandPalette`/`NotificationsButton`/`QuickCapture` (comme le font déjà `settings/accounts/page.tsx` et `notifications/page.tsx`). Puis verrouiller : `import "server-only"` en tête de `lib/mocks/index.ts` ; seuls `labels.ts`, `types/` et `time.ts` restent client-safe (déjà les seuls légitimement importés côté client). À faire **avant** le câblage, pas pendant.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (brancher sans réécrire) + §2.26 (Client minimal) + §2 règle 7 (defense in depth)

### [P1] Aucune couture de pagination/fenêtrage : la façade retourne l'historique intégral et toutes les surfaces de listing le consomment tel quel
- **Ou** : `apps/web/lib/mocks/index.ts:53` (`getContentItems(clientId?)` sans borne), `:70` (`getImportedPosts`), `lib/mocks/library.ts:116` (`getLibraryAssets`) ; consommés par `app/(app)/clients/[clientId]/calendar/page.tsx:32`, `grid/page.tsx:150-166`, `content/page.tsx:31`, `content/new/page.tsx:80`
- **Constat** : aucune signature de listing de la façade ne porte `range/cursor/limit` (seul `getTopPosts` prend un count, helper de ranking). Le calendrier filtre par mois **côté client**, la grille sérialise chaque publié + importé en `GridTileData` dans le payload RSC, le board reçoit tous les contenus, le composer toute la médiathèque.
- **Scenario d echec / cout a l echelle** : client réel après 3 ans (3 posts/sem ≈ 470 contenus + posts importés + 1000-1500 assets) : chaque visite sérialise des centaines d'items dans le payload RSC et monte autant de `next/image`. Câblé sur Supabase, cela devient un `SELECT` sans `LIMIT` sur `content_items` + `imported_posts` + `media_assets` **par affichage de page**.
- **Pourquoi ca bloque le scaling** : payload, TTFB et mémoire croissent linéairement avec l'ancienneté de chaque client — c'est le point qui casse « tenir des années ». Le fenêtrage ajouté APRÈS câblage force à retoucher pages + façade + composants en même temps (`postCount` et `pinned` dans `grid/page.tsx:169-199` supposent des ensembles complets).
- **Reco** : introduire les bornes dans la façade dès maintenant, à signature stable : `getContentItems(clientId, {from, to})` pour le calendrier (fenêtre mois ± 1), `{cursor, limit}` pour grille/board (seuil ~90 tuiles + « afficher plus »), `getLibraryAssets(clientId, {limit, cursor, search, sort})`. Les mocks tiennent dans la première fenêtre : l'UI validée ne change pas.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (mêmes types que la future DB) + §1 (state: TanStack Query au câblage)

### [P1] Grille feed : dataset intégral hydraté, un useDroppable par tuile verrouillée, zéro virtualisation
- **Ou** : `apps/web/app/(app)/clients/[clientId]/grid/page.tsx:150-166` ; `components/app/grid/locked-grid-tile.tsx:30` (useDroppable par tuile) ; `grid-board.tsx:64-72` (pinned) et `:89-109` (rendu intégral) ; `components/app/grid/tile-quick-view.tsx:29-57` (HoverCard + Popover par tuile)
- **Constat** : la page mappe TOUS les content_items publiés (l.159-162) et TOUS les imported_posts (l.165-166) en `GridTileData` (caption complète l.99, metrics l.103) passés au client `FeedGrid`. Chaque tuile verrouillée enregistre son propre `useDroppable` actif + un HoverCard + un Popover + une `next/image`. Aucun slice, aucune virtualisation, aucun « charger plus ».
- **Scenario d echec / cout a l echelle** : compte IG réel avec 800 posts importés + 2 ans de publiés : payload RSC de plusieurs Mo par visite, hydratation de ~1000 tuiles droppables, et au drag start dnd-kit mesure les rects de ~1000 droppables (`getBoundingClientRect`) → gel de 100-500 ms à chaque prise de tuile, scroll saccadé sur la PWA iOS (parcours prioritaire).
- **Pourquoi ca bloque le scaling** : le feed grossit linéairement pour toujours ; branchée telle quelle, la requête Supabase copie le select non borné. C'est la page la plus chère à corriger après câblage.
- **Reco** : borner à la source (cf. finding pagination : range query + `useInfiniteQuery`, « Voir plus »). Remplacer le `useDroppable` par tuile verrouillée par UN droppable conteneur pour toute la zone verrouillée (même feedback d'anneau destructif). Optionnel : `content-visibility:auto` sur les tuiles hors viewport.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query) + §12 (parcours PWA iOS prioritaire)

### [P1] Calendrier : la page expédie l'historique complet du client alors qu'un seul mois (42 jours) est affiché
- **Ou** : `apps/web/app/(app)/clients/[clientId]/calendar/page.tsx:32` ; `components/app/calendar/use-calendar-state.ts:41` (anchorKey en useState client), `:101-122` (re-map complet + double `groupByDay`)
- **Constat** : `EditorialCalendar` (`"use client"`) reçoit `items = getContentItems(clientId)` sans filtre de période ni de statut. Le hook re-mappe TOUTE la liste (`effectiveItems`) et regroupe TOUT par jour (×2 : filtré + complet) à chaque changement d'override (chaque drop crée une nouvelle Map). Le curseur de période (`anchorKey`) vit uniquement en useState client : **aucune couture n'existe** pour une requête bornée `scheduled_at BETWEEN`.
- **Scenario d echec / cout a l echelle** : après 3 ans, ~1500 contenus par client traversent la frontière RSC à chaque visite du calendrier ; la navigation de mois ne réduit rien puisque tout est déjà en mémoire client. Au câblage : full scan du client par visite, ou restructuration du fetch (searchParams / TanStack Query) — contradiction directe avec §0.
- **Pourquoi ca bloque le scaling** : payload RSC croissant avec l'historique sur la page cœur du produit, visitée quotidiennement.
- **Reco** : contractualiser le seam par période dès maintenant : props `{ itemsInRange (mois ± 1), shelfItems (non datés, requête séparée) }` ou `getContentItemsInRange(clientId, from, to)` ; en cible TanStack Query keyé `(clientId, monthKey)` avec prefetch du mois adjacent. Le pattern overrides-sur-props du hook est bon et à conserver.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 + §1 (TanStack Query)

### [P1] Board studio : contrat « tous les contenus du client en props », filtre par frappe non différé, rendu intégral sans pagination ni virtualisation
- **Ou** : `apps/web/components/app/studio/content-board.tsx:180-193` ; alimenté par `content/page.tsx:31` ; `board-state.ts:193-200` (re-filtre + re-tri complets), `board-utils.ts:21-34` (`matchesSearch` re-normalise titre+légende+labels+hashtags de chaque item), `board-toolbar.tsx:95` (frappe → setFilters sans debounce), `board-kanban.tsx:153` (items filtré 6× par render)
- **Constat** : chaque frappe de recherche re-filtre, re-trie et re-rend TOUTES les cartes (`next/image` chacune) avec des callbacks inline qui interdisent tout `React.memo`.
- **Scenario d echec / cout a l echelle** : ~470 ContentItem (3 ans) : payload RSC ~0,5-1,5 Mo par visite, ~470 cartes × ~50 nœuds DOM à hydrater, chaque frappe re-rend l'intégralité de la grille → recherche pénible sur iPhone. Câblé tel quel : `SELECT` de tous les content_items du client à chaque visite du studio.
- **Pourquoi ca bloque le scaling** : le board est visité quotidiennement et `content_items` ne fait que grossir (soft-delete `archived_at`, jamais de purge). Le contrat « array complet en prop » se propage tel quel dans la requête Supabase si on ne l'acte pas maintenant.
- **Reco** : acter au seam un contrat paginé (filtres/tri/recherche côté serveur, limit+cursor, TanStack Query au câblage) + fenêtre de rendu (« charger plus » ou virtualisation). Court terme sans changer l'UI : `useDeferredValue(filters.search)` pour l'application du filtre, `memo(ContentCard)` avec callbacks stables.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (la recherche devient différée / paramètre de requête)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query)

### [P1] Composer : médiathèque entière sérialisée dans le payload à chaque ouverture, picker rendu sans limite
- **Ou** : `apps/web/components/app/studio/composer/media-picker-dialog.tsx:83-143` ; alimenté par `content/new/page.tsx:80` ET `content/[contentId]/edit/page.tsx:77` ; `composer-screen.tsx:75` (`.find()` linéaires)
- **Constat** : `ComposerScreen` reçoit `libraryAssets: LibraryAsset[]` complet — sérialisé dans le payload RSC de CHAQUE ouverture du composer, même quand le picker n'est jamais ouvert. Le dialog rend ensuite `assets.map(...)` intégral, un `next/image` monté par asset, sans recherche, pagination ni virtualisation.
- **Scenario d echec / cout a l echelle** : médiathèque après 2 ans ≈ 1000-1500 assets : ~0,5 Mo de payload ajouté à chaque ouverture du composer + 1000+ items montés d'un coup à l'ouverture du dialog → gel de plusieurs secondes sur mobile. Au câblage : `SELECT` complet de `media_assets` du client pour afficher un formulaire vierge.
- **Pourquoi ca bloque le scaling** : la médiathèque est l'entité qui croît le plus vite (chaque contenu ajoute 1-10 assets, rien n'est supprimé) ; le contrat lie le coût d'ouverture du composer à l'historique total du client.
- **Reco** : acter le contrat « picker interrogé à l'ouverture » : remplacer la prop `assets` par un fetch paginé + recherche déclenché à l'ouverture du dialog (getter mock `getLibraryAssets(clientId, {limit, cursor})`, TanStack Query au câblage). Le composer ne reçoit que l'asset présélectionné du prefill.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query)

### [P1] État client initialisé depuis les props et jamais resynchronisé (grille + médiathèque) — bug i18n reproductible aujourd'hui, bloquant pour revalidatePath demain
- **Ou** : `apps/web/components/app/grid/use-grid-tiles.ts:38-43` ; `components/app/library/use-library-assets.ts:27` ; `lib/i18n/provider.tsx:44` (`router.refresh()` au toggle) ; `grid/page.tsx:88` (locale cuite dans les titres côté serveur)
- **Constat** : `useGridTiles` capture `initialPlanned/initialShelf` dans useState + ref une seule fois et ignore toute nouvelle prop ; `useLibraryAssets` a le même seed-once. Or le toggle de locale fait `router.refresh()` : le serveur reconstruit les tuiles dans la nouvelle langue mais le hook garde les anciennes. Reproductible en 3 clics : ouvrir la grille, basculer FR→EN → grille mi-anglaise (tuiles verrouillées, props directes) mi-française (zone planifiée + étagère, état figé). Aucun `key={locale}` nulle part (grep = 0). Nuance : côté médiathèque, pas de bug i18n visible aujourd'hui (assets bilingues `L<string>` résolus au render) — seule la faiblesse de revalidation future s'applique.
- **Scenario d echec / cout a l echelle** : avec Supabase, toute Server Action + `revalidatePath` (ou update Realtime) laissera la zone planifiée sur des données périmées — permutation affichée ≠ dates réelles en base → risque de publication à la mauvaise date perçue.
- **Pourquoi ca bloque le scaling** : le pattern rend chaque mutation coûteuse à câbler (contournement de l'état figé). Le calendrier montre déjà le bon pattern maison (props = source de vérité + Map d'overrides locaux, `use-calendar-state.ts:69-107`).
- **Reco** : aligner `useGridTiles` et `useLibraryAssets` sur le pattern overrides-sur-props du calendrier (dériver planned/shelf des props + patchs locaux), ou à terme TanStack Query comme cache source. Correction minimale immédiate : resynchroniser quand les props changent (comparaison d'identité) — pas de `key={locale}` global qui perdrait le bac à sable.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (la grille reflétera les données fraîches)   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (state: TanStack Query)

### [P1] Zéro frontière loading.tsx / error.tsx / not-found.tsx / Suspense dans tout app/ — aucun feedback ni filet pour la mise en prod imminente
- **Ou** : `apps/web/app/**` (glob loading/error/global-error/not-found = 0 fichier ; grep `Suspense` = 0 occurrence) ; 14 appels `notFound()` existants dont `clients/[clientId]/layout.tsx:24` et `portal/[contentId]/page.tsx:40`
- **Constat** : aucune route ne définit de boundary. Invisible aujourd'hui (mocks synchrones, rendu instantané), mais les `notFound()` existants rendent DÈS MAINTENANT la 404 Next par défaut, en anglais, non brandée — en contradiction avec le chantier i18n FR/EN de la branche courante.
- **Scenario d echec / cout a l echelle** : dès le câblage (100-300 ms + réseau), chaque navigation fige l'écran courant sans indicateur (App Router garde la page précédente pendant le render serveur) ; toute exception runtime en prod tombe sur la page d'erreur générique Next, sans récupération ni point d'accroche Sentry (requis Lot 0).
- **Pourquoi ca bloque le scaling** : sans streaming/Suspense, le TTFB perçu de chaque page = la requête la plus lente ; le dashboard (KPIs + tâches + agenda + activité) deviendra la pire page.
- **Reco** : ajouter maintenant : `loading.tsx` avec skeletons par segment lourd (`(app)`, `clients/[clientId]`, `(portal)`), `error.tsx` + `global-error.tsx` (point d'accroche Sentry), `not-found.tsx` localisé. Au câblage, découper le dashboard en `<Suspense>` par carte.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (errors: Sentry web) — prérequis du câblage

---

### [P2] Dictionnaires FR + EN complets (18 zones × 2 locales, 229 Ko de source) embarqués et aplatis dans le chunk client racine de 100 % des routes, y compris /login, /otp et /portal
- **Ou** : `apps/web/lib/i18n/dictionaries/index.ts:2-11` (imports statiques en/fr/zonesEn/zonesFr) et `:26-29` (`FLAT` aplati eagerly à l'init) ; via `lib/i18n/provider.tsx:14` (`"use client"`) monté dans `app/layout.tsx:49`
- **Constat** : mesuré sur build de prod : le chunk `2hybkqc84-t6e.js` fait 179 Ko brut / 58 Ko gzip, contient les DEUX locales (« Studio de contenu » ET « Content studio ») et est référencé par 24/26 client-reference-manifests, dont `(auth)/login`, `(auth)/otp` et `(portal)/portal`. `flatten()` s'exécute sur les 2 dictionnaires complets à l'init du module (serveur ET navigateur) et retient objets imbriqués + 2 maps aplaties. `getMessage` fait un lookup runtime `FLAT[locale]` : aucune locale n'est tree-shakable.
- **Scenario d echec / cout a l echelle** : le Reviewer (persona mobile prioritaire, PWA iOS) qui ouvre `/portal` télécharge et parse ~58 Ko gzip de textes studio/composer/calendar/onboarding qu'il ne verra jamais ; le parse/eval se paie à chaque cold start PWA. Gain récupérable ≈ la moitié du chunk (la locale inactive, ~25-30 Ko gzip).
- **Pourquoi ca bloque le scaling** : croissance O(zones × locales) dans le chunk critique de TOUTES les pages ; une 3e locale ré-augmente de 50 %, à 4 locales le chunk dictionnaires quadruple. Le découpage par zones existe déjà côté fichiers mais est annulé par l'agrégation statique.
- **Reco** : ne livrer au client que la locale active : map aplatie résolue côté serveur (`getLocale()` existe déjà) et passée en prop au `LocaleProvider` (payload RSC = 1 locale), ou `dynamic import('./dictionaries/'+locale)`. Garder le typage `MessageKey` dérivé du FR. Le fallback FR runtime (`getMessage:41`) devient un check CI de parité des clés. Le toggle fait déjà `router.refresh()` : le changement de locale reste fonctionnel.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun (i18n maison actée sur feat/i18n-fr-en)

### [P2] Formatteurs Intl construits à CHAQUE appel dans les boucles de rendu (DateTimeFormat, RelativeTimeFormat, NumberFormat) alors que le pattern de cache existe déjà dans le codebase
- **Ou** : `apps/web/lib/format.ts:11-13` (`fmt`), `:51` (`formatRelative`), `:68-77` (`isSameDay`, 2 constructions/appel) ; `components/app/calendar/calendar-utils.ts:102` (`weekdayDayMonth`) et `:112` (`monthYearLabel`) ; `new Intl.NumberFormat` inline : `composer-media.tsx:63`, `caption-tools.tsx:29`, `media-picker-dialog.tsx:42` ; sites consommateurs en boucle : `day-cell.tsx:71` (42 cellules/render), `day-entry.tsx:21`, `week-view.tsx:101,125,200`, `day-sheet-row.tsx:56`, `calendar-dnd.tsx:100` (pendant le drag), `export-dialog.tsx:148`, `content-card.tsx:212` (par carte du board), `preflight.ts:255`, `composer-utils.ts:48`, `today-panel.tsx:19`, `week-grid.tsx:71,131` (isSameDay par item)
- **Constat** : la construction d'un `Intl.DateTimeFormat` coûte des dizaines de µs à ~0,3 ms (résolution ICU/CLDR) contre ~1 µs pour un `.format()` sur instance cachée. Le pattern correct est connu du codebase : `calendar-utils.ts:19-33` (`KEY_FMT_CACHE`, Map par timezone) — `lib/format.ts` ne l'applique pas. `formatDateTime` construit même DEUX formatteurs par appel.
- **Scenario d echec / cout a l echelle** : vue mois dense + drag & drop (les cellules re-rendent en burst) = 50-170 constructions Intl par passe de rendu ; board de 400 contenus : chaque frappe de recherche re-rend 400 cartes × 2 constructions → 15-65 ms de pure construction de formatteurs par caractère tapé sur desktop, bien pire sur iPhone. Le coût survit tel quel au câblage Supabase.
- **Pourquoi ca bloque le scaling** : coût multiplié par (cellules + items rendus) × interactions ; croît avec la densité de publication et les années d'historique — exactement le chemin qui grossit.
- **Reco** : cache module-level `Map<string, Intl.DateTimeFormat>` keyé `${INTL_LOCALE[locale]}|${tz}|${optionsId}` dans `lib/format.ts` (mêmes options littérales par fonction → id statique suffit), idem `RelativeTimeFormat` et le formatteur fr-CA d'`isSameDay` ; exposer le `NumberFormat` caché via `useFormat()` et supprimer les `new Intl.NumberFormat` inline du studio. Zéro changement de sortie.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Zéro mémoïsation dans components/app/grid : pipeline dérivé recalculé et arbre entier re-rendu à chaque interaction
- **Ou** : `apps/web/components/app/grid/feed-grid.tsx:71-147` (≈10 dérivations map/filter/sort + `visibleKey` tri+join O(n log n) + objets `ctx` et `toolbarView` recréés à chaque render) ; `use-grid-view.ts:96-127` (objet neuf avec ~10 closures instables par render) ; grep `useMemo|useCallback|React.memo` = 0 occurrence dans les 31 fichiers grid
- **Constat** : chaque setState (drag start/end via `use-grid-tiles.ts:96-98`, toggle sélection, sync, filtre, hover-switch) recalcule tout le pipeline et re-rend toutes les `LockedGridTile`/`SortableGridTile` (chacune HoverCard + Popover + `next/image`). Pas de React Compiler (`next.config.ts` sans `reactCompiler`) : la mémoïsation manuelle est le seul mécanisme applicable.
- **Scenario d echec / cout a l echelle** : avec 300-500 tuiles (cf. finding pagination), chaque clic en mode sélection = O(N) recalculs × ~8 passes + re-render de N tuiles → jank visible sur l'iPhone cible, surtout en mode présentation client.
- **Pourquoi ca bloque le scaling** : coût par interaction linéaire au volume total de tuiles ; sans callbacks stables dans `useGridView`, aucun `React.memo` ne peut prendre.
- **Reco** : `useMemo` sur les dérivations (deps : tiles, coverOverrides, filtres), `useCallback` sur les setters de `useGridView`/`useGridTiles`, `React.memo` sur `GridTile`/`SortableGridTile`/`LockedGridTile`, ctx stable. Le calendrier fait déjà exactement ça (`editorial-calendar.tsx:51-92`) : répliquer. Si la pagination borne N à ~90, ce finding devient du confort — le traiter après.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Calendrier : DayCell/WeekDayColumn/DayEntry non mémoïsés — les 42 cellules droppables re-rendent à chaque état
- **Ou** : `apps/web/components/app/calendar/month-grid.tsx:58` (rendu des cellules) et `:62` (`itemsByDay.get(key) ?? []` : tableau neuf par cellule vide) ; `day-cell.tsx:47`, `week-view.tsx:61`, `day-entry.tsx:18` (fonctions nues, aucun `React.memo` dans components/app/calendar)
- **Constat** : le travail de fond est fait (ctx mémoïsé `editorial-calendar.tsx:51-92`, Maps mémoïsées dans `use-calendar-state`) mais ouvrir le DaySheet, un dialog, basculer la sélection ou poser un filtre re-rend les 42 DayCell (useDroppable + DropdownMenu + scan marronniers + `weekdayDayMonth` non caché chacun).
- **Scenario d echec / cout a l echelle** : chaque interaction coûte 42 cellules × (Intl + scan + reconstruction VDOM) au lieu de ~1 cellule concernée ; perceptible sur mobile quand les mois sont denses.
- **Pourquoi ca bloque le scaling** : coût par interaction proportionnel aux items affichés par mois, s'additionne au coût Intl sur plusieurs années de contenu.
- **Reco** : `React.memo` sur DayCell/WeekDayColumn/DayEntry (props déjà stables grâce aux useMemo existants), constante module `EMPTY_ITEMS` pour les cellules vides, `weekdayDayMonth` derrière le cache de formatteurs. Attention : `isSelected` change d'identité (`use-multi-select.ts:66`) — à stabiliser aussi, sinon le memo ne prend pas sur le toggle de sélection.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Médiathèque : recherche non débouncée, re-tri complet à chaque frappe, grille non virtualisée, AssetCard non mémoïsé
- **Ou** : `apps/web/components/app/library/library-toolbar.tsx:100-107` (frappe → `set({search})` direct) ; `library-workspace.tsx:58-63` (useMemo `visible` invalidé par frappe : filtre O(n) + copie + sort O(n log n)) ; `asset-card.tsx:25` (non mémoïsé) et `:126` (`f.dayMonth` → un Intl.DateTimeFormat neuf PAR CARTE) ; `asset-grid.tsx:22-40` (rendu complet) ; `lib/mocks/library.ts:116` (façade non bornée)
- **Constat** : l'Input contrôlé est piloté par le même état que le filtre : la latence de rendu bloque l'écho de saisie. À 1000 assets, ~1000 instanciations Intl par frappe en plus du re-render.
- **Scenario d echec / cout a l echelle** : médiathèque de 3 ans (~1000 assets) : requête de 10 caractères = 10 cycles filtre+tri+re-render de 1000 cartes images → saisie qui lag sur mobile.
- **Pourquoi ca bloque le scaling** : la banque de médias est la table qui grossit le plus vite ; en cible, filtrage/tri doivent descendre dans la requête Supabase (`ilike` + `order`), pas rester client.
- **Reco** : debounce 200-300 ms ou `useDeferredValue` sur search ; `React.memo(AssetCard)` + `useCallback` sur le `onOpen` inline (`library-workspace.tsx:184`, sinon le memo est défait) ; seam paginé `getLibraryAssets(clientId, {limit, cursor, search, sort})` + `useInfiniteQuery` ; à défaut, virtualiser au-delà d'un seuil.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query)

### [P2] Composer : état monolithique contrôlé — chaque frappe re-rend l'écran le plus lourd de l'app, et React Hook Form + Zod (stack imposée) sont absents du projet
- **Ou** : `apps/web/components/app/studio/composer/composer-screen.tsx:94-101` (useState<ComposerDraft> unique) et `:108-119` (computePreflight keyé sur l'identité de draft) ; `composer-types.ts:46-68` (aucun schéma Zod) ; `apps/web/package.json` (ni `zod` ni `react-hook-form`)
- **Constat** : le draft entier est passé en prop aux 7 sections (Basics, Media avec DndContext+slides, Targets, Caption, Advanced, Preview, PreflightPanel), aucune mémoïsée. Chaque frappe (titre, légende 2200 chars, notes, alt text) réconcilie tout l'écran, re-exécute `computePreflight` (9 checks dont regex sur toute la légende) et `validateMedia` pour chaque média × plateforme (~30 appels en carrousel 10 slides × 3 plateformes).
- **Scenario d echec / cout a l echelle** : latence de saisie qui se dégrade linéairement avec la taille de légende, le nombre de slides et de plateformes, sur l'écran de production quotidien du freelance (iPhone). Au câblage, le schéma Zod est de toute façon requis pour la Server Action `createContentItem` : le brouillon fait maison devra être re-plombé en RHF + zodResolver — travail en double partiellement évitable si le schéma est écrit 1:1 sur ComposerDraft.
- **Pourquoi ca bloque le scaling** : divergence avec la stack front imposée sur le formulaire central du produit, avec le contrat explicite (`composer-types.ts:11-13`) de brancher Supabase sans réécrire.
- **Reco** : migrer le draft vers React Hook Form (`useForm({ resolver: zodResolver(contentItemDraftSchema) })`, schéma dans le futur `packages/shared` — il servira aussi à la Server Action), champs texte non contrôlés, Preview/Preflight abonnés via `useWatch` + `useDeferredValue`. À minima court terme : scinder l'état par section + `React.memo` sur les sections.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (forms: React Hook Form + Zod) + règle 27 (Server Actions Zod-validées)

### [P2] Palette ⌘K : index de recherche de TOUS les contenus de TOUS les clients retenu en mémoire sur chaque page, un CommandItem par contenu à l'ouverture
- **Ou** : `apps/web/components/app/shell/command-palette.tsx:63` (`getContentItems()` sans clientId, useMemo `[]`) et `:145-158` (un CommandItem par contenu, sans cap ni virtualisation, filtrage délégué à cmdk) ; monté par `app/(app)/layout.tsx:46`
- **Constat** : le composant retient l'intégralité des contenus cross-clients en mémoire sur chaque page ; les items ne sont montés qu'à l'ouverture du dialog (Radix sans forceMount), mais alors TOUS d'un coup.
- **Scenario d echec / cout a l echelle** : câblé, il faudrait précharger tout le contenu du tenant à chaque session pour faire vivre la recherche ; avec 10 clients × 3 ans, des milliers de CommandItem montés à la première ouverture (freeze sur mobile).
- **Pourquoi ca bloque le scaling** : coût mémoire + rendu linéaire au volume total du tenant, payé sur chaque page — la recherche est le composant qui grossit le plus vite de l'app.
- **Reco** : couture de recherche serveur : Server Action/route de recherche (ILIKE/FTS scopée org_id) appelée en debounce via TanStack Query à l'ouverture, `shouldFilter=false` ; limiter le groupe « Contenus » aux N récents hors recherche active. Les groupes clients/navigation restent statiques.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2.7 (requêtes filtrées org_id côté serveur)

### [P2] Horloge figée MOCK_NOW importée dans 22 fichiers, dont le formatteur global lib/format.ts — la couture « temps réel » n'existe pas
- **Ou** : `apps/web/lib/format.ts:2` (import), `:52` (`formatRelative`), `:64` (`isPast`), `:68` (`isSameDay`) ; + 21 autres fichiers vérifiés par grep dont `use-calendar-state.ts:5`, `board-state.ts:5`, `grid-date-utils.ts:1`, `composer/preflight.ts:4` (12 fichiers `"use client"` directs, ≥6 modules purs importés par des composants clients — compte effectif côté client ≥18)
- **Constat** : inversion de dépendance — `lib/format.ts` (code permanent, serveur ET client) importe le mock jetable `lib/mocks/time`. Les fonctions de format relatif, tri et logique métier (fenêtres de publication, préflight) comparent toutes à cette constante gelée, consommée comme valeur Date (~30 call sites `.getTime()`, capture module-scope dans `mocks/quotas.ts:33`).
- **Scenario d echec / cout a l echelle** : au passage au temps réel : 22 points de modification dispersés à évaluation call-time, et un remplacement naïf par `new Date()` dans les composants clients produit des mismatches d'hydratation (le serveur rend « il y a 2 min », le client recalcule autre chose — `formatRelative` est rendu en RSC dans `dashboard/page.tsx` puis recalculé dans `detail-thread.tsx`).
- **Pourquoi ca bloque le scaling** : chaque nouveau composant qui importe MOCK_NOW aggrave la dette ; le bug d'hydratation apparaîtra partout d'un coup au câblage.
- **Reco** : créer `lib/clock.ts` (export `now()`, aujourd'hui alias de MOCK_NOW, demain Date réelle) et faire converger les 22 imports ; pour les affichages relatifs côté client, passer le « now » serveur en prop/contexte (une seule source par requête) — mismatch éliminé par construction.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 (stockage UTC timestamptz, TZ client/freelance)

### [P2] IDs de slides du carrousel collisionnables (`cm_{assetId}_{position}`) → clés React dupliquées, dnd-kit et suppression/patch groupés cassés
- **Ou** : `apps/web/components/app/studio/composer/composer-types.ts:76` (id dérivé de la position) ; `composer-media.tsx:83` (`position = media.length + i`), `:89` (`handleRemove` filter par id), `:104` (`patchMedia`), `:252` (`applyCrop`)
- **Constat** : l'id dépend de la longueur COURANTE de la liste, pas d'un compteur monotone. Repro vérifiée : ajouter X+Y (`cm_X_0`, `cm_Y_1`), supprimer X, ré-ajouter Y → deux slides `cm_Y_1`. Le picker n'expose pas le draft courant, donc ré-ajouter un asset déjà présent est possible.
- **Scenario d echec / cout a l echelle** : deux slides de même id → clé React dupliquée dans SortableContext (comportement dnd-kit indéfini), `handleRemove(id)` supprime LES DEUX slides, alt text et recadrage appliqués à la mauvaise slide. Reproductible dans l'UI validée en 4 clics.
- **Pourquoi ca bloque le scaling** : au câblage, cet id doit devenir l'identité du media_asset côté DB (position réordonnable) — un id dérivé de la position est structurellement faux et devra être remplacé de toute façon.
- **Reco** : compteur monotone module-level (même pattern SSR-safe que `nextLocalId` de `board-state.ts:23-27`) ou `crypto.randomUUID()` ; la position devient un champ dérivé de l'index, jamais une composante de l'identité.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Champs bilingues L<string> sur les types miroirs de la DB : payload RSC doublé et 143 call-sites pick() à convertir au câblage si la stratégie n'est pas verrouillée à la couture
- **Ou** : `apps/web/lib/mocks/types/core.ts:147-176` (`ContentItem.title/caption/internalNotes/lastError/labels` en `L<string>`) ; résolution via `lib/i18n/localized.ts:8-10` ; 143 appels `pick()` dans components/app/lib, 249 `loc()` dans lib/mocks
- **Constat** : décision actée du 19/06/2026 (contenu démo bilingue) — mais le schéma PRD §6 stocke un seul `text` (`content_items.caption`). Chaque ContentItem sérialisé vers les Client Components porte les deux langues → payload RSC ~2× sur les textes narratifs, résolution de locale côté client.
- **Scenario d echec / cout a l echelle** : jour du câblage : soit modifier 143 call-sites UI (réécriture diffuse de l'UI validée, risque de régressions), soit laisser traîner un type `L<>` qui ne correspond plus à la DB.
- **Pourquoi ca bloque le scaling** : chaque nouveau `pick()` écrit d'ici le câblage est une ligne de dette ; le payload doublé pénalise déjà le TTFB/streaming des grosses listes.
- **Reco** : verrouiller la stratégie MAINTENANT, à la couture plutôt que dans l'UI : au câblage, la façade adapte la ligne DB vers `L<string>` via `asL(s) => ({fr: s, en: s})` — zéro modification des 143 call-sites, l'UI validée ne bouge pas ; retrait progressif de `L<>` par zone ensuite. Documenter ce contrat dans `core.ts` pour que personne ne « nettoie » `pick()` dans l'urgence.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 (caption/title en text simple) + CLAUDE.md §0
- 
### [P2] PWA iOS (priorité produit) : icônes du manifest en SVG uniquement — Safari iOS les ignore, pas d'apple-touch-icon ; lang figé 'fr' ; 5 SVG du starter morts dans public/
- **Ou** : `apps/web/app/manifest.ts:15` (icons: `/icon.svg` seul, sizes 'any') et `:14` (lang:'fr' figé) ; `app/layout.tsx:28` (`appleWebApp.capable:true` sans icône) ; `apps/web/public/` (file.svg, globe.svg, next.svg, vercel.svg, window.svg — 0 usage au grep)
- **Constat** : Safari iOS ne supporte pas les icônes SVG de manifest et exige un `apple-touch-icon` PNG 180×180 (absent — seul `app/favicon.ico` existe) ; Android attend des PNG 192/512 + maskable. L'app se déclare installable iOS mais l'icône d'accueil sera une capture/lettre par défaut.
- **Scenario d echec / cout a l echelle** : première impression ratée du parcours d'installation PWA prioritaire (Étienne sur iPhone) dès la mise en prod ; prompt d'installation dégradé sur Android.
- **Pourquoi ca bloque le scaling** : pas un problème de croissance mais un bloqueur de qualité de la mise en prod imminente — Serwist ne le corrigera pas.
- **Reco** : générer les PNG depuis icon.svg (`apple-icon.png` 180 via convention Next dans app/, + 192/512 + maskable déclarés dans manifest.ts) ; supprimer les 5 SVG du starter ; dériver `manifest.lang` de la locale ou l'omettre.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1/§12 (PWA priorité iOS, onboarding installation soigné)

---

### [P3] Rendu dynamique forcé sur 100 % des routes (cookies() dans le root layout) — aucune page statique/CDN, y compris landing et login
- **Ou** : `apps/web/lib/i18n/server.ts:27,30` (`cookies()` puis `headers()` dans getLocale) ; appelé par `app/layout.tsx:18-30` (generateMetadata) et `:40` (RootLayout) ; `app/page.tsx:16` et `(auth)/login/page.tsx:7,12` appellent aussi getT() directement
- **Constat** : toutes les routes deviennent dynamiques, rendues par le process Node unique (Coolify VPS, `output:"standalone"`, ni PPR ni cacheComponents) à chaque hit ; le fallback Accept-Language rend la réponse variable par requête (non cacheable naïvement par URL).
- **Scenario d echec / cout a l echelle** : chaque hit anonyme (landing, liens partagés) coûte un render React complet sur le VPS ; un pic marketing dégrade l'app authentifiée qui partage le même process.
- **Pourquoi ca bloque le scaling** : CPU serveur linéaire au trafic anonyme pour des pages invariantes par visiteur (2 variantes de locale). Mitigé par le contexte : la landing est « minimale en phase solo » et (app)/(portal) seront dynamiques de toute façon via l'auth.
- **Reco** : accepter le dynamique pour (app)/(portal) ; pour landing et login, sortir la lecture cookie du chemin de rendu (locale par défaut statique + bascule client, ou segmentation `/en` à terme). À défaut, cache proxy devant le render marketing.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] perf-workspace (client) importe PERIOD_META via perf-data, module de couche data dont l'init importe le barrel de mocks et instancie deux traducteurs
- **Ou** : `apps/web/components/app/performance/perf-workspace.tsx:12` (import valeur depuis ./perf-data) ; `perf-data.ts:3` (import @/lib/mocks) et `:70-71` (tFr/tEn createTranslator à l'échelle module) ; la constante vit en réalité dans `perf-core.ts:13-32` (imports 100 % type-only)
- **Constat** : le module data (destiné à devenir la couche Supabase serveur — la page pré-calcule déjà `getAllPerfData` côté serveur) ne pourra jamais être marqué `server-only` ni recevoir un client Supabase serveur tant qu'un composant client l'importe pour une constante UI. Coût bundle actuel quasi nul (le barrel mocks est déjà dans le chunk client via la coquille) mais précédent de mélange « constantes UI + couche data ».
- **Scenario d echec / cout a l echelle** : régression de bundle silencieuse sur /performance et pattern qui se recopie dans les prochaines features.
- **Pourquoi ca bloque le scaling** : chaque module data mixte devient un point de fuite serveur→client à surveiller manuellement.
- **Reco** : importer PERIOD_META depuis `./perf-core` (fix une ligne) ; convention : modules de couche data (perf-data, report-data) marqués `import "server-only"` pour que le build échoue en cas de fuite (la convention existe déjà : `lib/i18n/server.ts`).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Validation specs exécutée en double par frappe (preflight + MediaSpecSummary) et RegExp des mots interdits recompilées à chaque appel
- **Ou** : `apps/web/components/app/studio/composer/media-spec-summary.tsx:28-33` (validateMedia par média × plateforme à chaque render) ; même calcul dans `preflight.ts:100-105` le même cycle ; `lib/caption.ts:98` (`new RegExp` par mot interdit à CHAQUE appel de findBannedWords) ; appelé par frappe par `preflight.ts:192-199` (caption + déclinaisons + firstComment) et `caption-tools.tsx:72` (BannedWordsHint)
- **Constat** : 2 × (10 slides × 3 plateformes) = 60 appels validateMedia par frappe en carrousel ; brand kit à 50 mots interdits → ~200 compilations de RegExp Unicode + 8 scans du texte par frappe. Coût unitaire faible (basses ms au pire), dominé par le re-render composer (finding P2), mais gaspillage pur.
- **Scenario d echec / cout a l echelle** : coût proportionnel à (mots interdits) × (plateformes) × (longueur des textes), ×2 par la double passe — croît avec les brand kits riches.
- **Pourquoi ca bloque le scaling** : chemin de saisie mobile ; plafonné par les limites produit (10 slides, 3 plateformes, 2200 chars) donc P3.
- **Reco** : calculer les SpecIssue une seule fois dans ComposerScreen (`useMemo` sur `[draft.media, platforms, draft.format]`) et les distribuer à PreflightPanel et MediaSpecSummary ; mémoïser les RegExp par liste bannedWords (Map module-level keyée par le tableau, ou précompilation dans le getter du brand kit).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] MediaCropDialog : preset non resynchronisé entre deux médias (état conservé d'une ouverture à l'autre)
- **Ou** : `apps/web/components/app/studio/composer/media-crop-dialog.tsx:49` (`useState<CropPreset>("4:5")` au niveau d'un dialog monté en permanence par `composer-media.tsx:245`)
- **Constat** : le preset choisi pour un média reste sélectionné à l'ouverture suivante pour un autre média ; un média déjà recadré (`media.crop`, jamais lu par le dialog) rouvre sur le dernier preset utilisé au lieu de son crop actuel.
- **Scenario d echec / cout a l echelle** : recadrer la slide 1 en 9:16, ouvrir le recadrage de la slide 2 : 9:16 présélectionné ; « Appliquer » sans regarder écrase avec le mauvais ratio.
- **Pourquoi ca bloque le scaling** : mineur, mais le composant sera conservé au câblage (le recadrage réel remplacera le mock) — autant fixer la sémantique d'état maintenant.
- **Reco** : initialiser le preset à l'ouverture depuis `media.crop ?? "4:5"` (`key={media?.id}` sur le contenu du dialog, ou useEffect sur `media?.id`).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui (le dialog reflétera le crop réel)   **Verrou PRD/CLAUDE.md** : aucun

### [P3] useLabels()/useFormat() fabriquent un objet neuf (7-9 closures) à chaque rendu de chaque consommateur — identité instable dans les composants par-ligne
- **Ou** : `apps/web/lib/i18n/provider.tsx:80-86` (makeLabels/makeFormat appelés hors memo, alors que le contexte mémoïse bien `{locale, setLocale, toggle, t}` l.54-57) ; consommateurs par-ligne : `components/shared/status-badge.tsx:32,49,66,83` (un useLabels par badge, rendus par carte/ligne), ~39 fichiers sur useFormat()
- **Constat** : aucune memoïsation n'est actuellement cassée (grep : zéro dependency array `[f]`/`[lbl]`, zéro React.memo), mais toute optimisation future par `React.memo` des cartes ou deps `[f]` sera silencieusement inopérante — exactement ce que recommandent les findings grid/calendar/board.
- **Scenario d echec / cout a l echelle** : allocations transitoires par passe de rendu sur les listes denses (kanban multi-centaines de cartes) ; surtout, sape les fixes de memoïsation prévus.
- **Pourquoi ca bloque le scaling** : croît avec le nombre de lignes affichées ; fragilise les optimisations des autres findings.
- **Reco** : déplacer labels et format dans le useMemo du provider (`value = {…, labels: makeLabels(t), format: makeFormat(locale)}`) et faire retourner `ctx.labels`/`ctx.format` par les hooks. Aucun changement de rendu.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Deux chemins de formatage d'heure coexistent : formatTime importé en direct (locale FR par défaut) vs f.time locale-aware — heures en format français dans l'UI anglaise du calendrier
- **Ou** : `apps/web/components/app/calendar/day-entry.tsx:21`, `week-view.tsx:200`, `day-sheet-row.tsx:56`, `calendar-dnd.tsx:100`, `export-dialog.tsx:148` (formatTime(iso, tz) sans locale → DEFAULT_LOCALE 'fr', `lib/format.ts:35`) ; l'agenda passe par useFormat().time locale-bound (`event-block.tsx:34`)
- **Constat** : en locale EN, les heures du calendrier restent au format fr-FR 24h (« 10:30 ») tandis que l'agenda rend « 10:30 AM » en en-US ; `day-entry.tsx:25` interpole même l'heure fr dans un tooltip traduit en anglais. Les composants utilisent déjà useT()/useLocale() : l'oubli de locale n'a aucun obstacle architectural.
- **Scenario d echec / cout a l echelle** : incohérence visible entre zones dans le chantier i18n en cours ; le défaut silencieux DEFAULT_LOCALE masque les oublis de locale (indétectable en CI).
- **Pourquoi ca bloque le scaling** : chaque nouveau composant qui importe lib/format en direct reproduit le piège.
- **Reco** : après le fix de cache Intl, rendre le paramètre locale obligatoire dans lib/format.ts (supprimer les défauts) et converger les call-sites calendrier sur useFormat()/getFormat() ; trancher avec Étienne si le 24h partout était voulu (alors figer `hourCycle` explicite plutôt qu'un défaut de locale implicite).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui (format d'heure EN change)   **Verrou PRD/CLAUDE.md** : aucun

## Code production-grade propose (NON applique)

**1. Cache de formatteurs Intl (`lib/format.ts`) — fix S, zéro changement de sortie :**

```ts
const DTF_CACHE = new Map<string, Intl.DateTimeFormat>()

function fmt(optsId: string, opts: Intl.DateTimeFormatOptions, tz: string, locale: Locale) {
  const key = `${INTL_LOCALE[locale]}|${tz}|${optsId}`
  let f = DTF_CACHE.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: tz, ...opts })
    DTF_CACHE.set(key, f)
  }
  return f
}
// Chaque fonction publique passe un optsId statique :
// formatTime -> fmt("time", { hour: "2-digit", minute: "2-digit" }, tz, locale)
// Idem Intl.RelativeTimeFormat (formatRelative) et le fr-CA d'isSameDay.
```

**2. Frontière server-only + signatures bornées à la façade (`lib/mocks/index.ts`) :**

```ts
import "server-only" // le build casse si un composant "use client" importe la façade

export type Page<T> = { items: T[]; nextCursor: string | null }

export function getContentItemsInRange(clientId: string, from: string, to: string): ContentItem[] {
  return CONTENT_ITEMS.filter(
    (c) => !c.deletedAt && c.clientId === clientId &&
      c.scheduledAt != null && c.scheduledAt >= from && c.scheduledAt < to
  )
}

export function getContentItemsPage(
  clientId: string,
  { cursor, limit = 90 }: { cursor?: string; limit?: number } = {}
): Page<ContentItem> {
  const all = getContentItems(clientId) // tri stable par date desc en amont
  const start = cursor ? all.findIndex((c) => c.id === cursor) + 1 : 0
  const items = all.slice(start, start + limit)
  return { items, nextCursor: items.length === limit ? items.at(-1)!.id : null }
}
// Au câblage : mêmes signatures -> .gte/.lt("scheduled_at") et .range() Supabase,
// puis useInfiniteQuery côté client. L'UI validée ne change pas.
```

**3. Couture d'horloge (`lib/clock.ts`) :**

```ts
import { MOCK_NOW } from "@/lib/mocks/time"
export function now(): Date {
  return MOCK_NOW // demain : new Date() — un seul point de bascule
}
// + passer le "now" serveur en prop aux affichages relatifs clients (1 valeur par requête).
```

## Ce qui va bien (a preserver)

- **Toutes les pages sont des Server Components async** qui lisent la façade côté serveur et passent des props typées — la forme exacte attendue pour le câblage Supabase. `settings/accounts/page.tsx` et `notifications/page.tsx` montrent même le bon pattern « layout fournit les données de la coquille » à généraliser.
- **La façade `lib/mocks/index.ts` existe et est documentée comme point de branchement** : le seam est au bon endroit, il faut juste le borner et le fermer côté serveur — pas le déplacer.
- **L'architecture du calendrier est la référence interne** : ctx mémoïsé (`editorial-calendar.tsx:51-92`), Maps dérivées mémoïsées, pattern « props = source de vérité + Map d'overrides locaux » (`use-calendar-state.ts:69-107`) — c'est le modèle à répliquer sur grille et médiathèque, pas à réinventer.
- **`KEY_FMT_CACHE` (`calendar-utils.ts:19-33`)** : le pattern de cache Intl correct existe déjà dans le codebase ; le fix P2 est une généralisation, pas une invention.
- **Les pages performance/report pré-calculent tout côté serveur** (`getAllPerfData`, DTOs typés) — le meilleur exemple du repo de séparation data/UI ; `perf-core.ts` est déjà 100 % type-only.
- **Le mapping en DTO de la grille** (`grid/page.tsx` → `GridTileData`) : la page ne sérialise pas les entités brutes mais un DTO de vue — bon réflexe, il ne manque que la borne.
- **`nextLocalId` (`board-state.ts:23-27`)** : générateur d'ids local SSR-safe correct, à réutiliser pour les slides du composer.
- **Les dictionnaires i18n sont déjà découpés par zones et par locale côté fichiers** : le passage au chargement par locale active est mécanique, la structure est prête.
- **Les types miroirs de `lib/mocks/types/` recoupent le PRD §6** (enums statuts, arbre tenant) : le contrat de types tient ; seule la couche `L<string>` doit être adaptée à la couture.
