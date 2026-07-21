# Audit — Frontend / Design System & UI (2026-07-07)

## Verdict

Le front d'Ocean est **remarquablement propre pour une preview** : 100 % des pages sont des Server Components `async`, l'i18n FR/EN passe par des dictionnaires côté serveur ET client, les mocks sont typés sur le schéma DB cible et centralisés derrière une façade (`lib/mocks/index.ts`) qui est le futur point de branchement Supabase. Le design system a de bonnes fondations (EmptyState générique, primitives de statut factorisées, un seul composant média `MediaThumb`). **Mais la dimension arrive au jalon « chaque vue va gagner du fetch async » avec un socle asynchrone incomplet** : c'est là qu'est le risque principal pour la mise en prod et le câblage backend. Concrètement — (1) **zéro frontière `error.tsx` / `global-error.tsx`** : la première erreur de fetch Supabase (timeout, refus RLS, 500 Supavisor) fera un crash plein écran non brandé, non récupérable, sur PWA iOS ; (2) la trilogie d'états async est incomplète (EmptyState OK, Loading embryonnaire, **ErrorState absent**), et aucun `loading.tsx` n'existe → chaque navigation bloquera sur le fetch le plus lent avant de peindre ; (3) la seule primitive média n'a aucun état d'erreur/chargement, or dès que `thumbUrl` deviendra une URL signée Supabase (TTL 48 h par construction), les 404/expirations tomberont sur le glyphe « image cassée » natif dans les deux vitrines client (grille IG + portail). Aucun de ces trous n'est visible aujourd'hui (mocks synchrones + URLs Pexels stables), mais chacun est un obstacle concret au câblage « sans réécriture ». S'y ajoutent des dettes d'accessibilité réelles (kanban non pilotable au clavier avec fausse affordance ARIA, tablist IG à moitié implémentée, annonces DnD en anglais dans une UI FR) et un manque PWA (aucune `apple-touch-icon` PNG → icône d'accueil iOS = capture de page). **Rien n'est cassé en preview ; tout devient réel au premier `await` réseau.** Priorité : poser les frontières `error`/`loading`/`not-found` et compléter la trilogie d'états AVANT le câblage, pour que le branchement Supabase hérite d'une architecture prête plutôt que d'un rétrofit vue par vue.

## Fonctionnement réel observé

**Rendu & data flow (préparé pour l'async, mais synchrone aujourd'hui).**
Toutes les pages sont des `export default async function` (Server Components). Elles appellent des getters de la façade `lib/mocks/index.ts`, qui sont aujourd'hui **synchrones et ne jettent jamais** (`export function getClient(id): Client | undefined`, etc. — aucun `async`/`Promise` réel dans `lib/mocks/`). Exemple représentatif : `app/(app)/dashboard/page.tsx:22-30` résout `getT`, `getFormat`, `getLocale`, `getDashboardTasks`, `getNotifications` en séquence — instantané en mock. Au câblage, chaque getter devient un `await supabase.from(...)` échouable → le pattern `const x = getX(); const y = getY()` devient un **waterfall réseau** (pas parallèle).

**Agrégation lourde dans le corps des pages, pas les layouts.**
Les deux layouts (`(app)/layout.tsx`, `clients/[clientId]/layout.tsx`) ne font que du fetch léger (`getT`, `getClient`, `getSocialAccounts`). L'agrégation massive vit dans le `<main>` : `content/[contentId]/page.tsx:66-73` enchaîne 8 lectures (getComments, getApprovals, getContentVersions, getActivityEntries, getSocialAccounts, getReviewer, getClients, getQuotaUsage) ; `grid/page.tsx` en enchaîne autant. Le shell (sidebar/header, via le layout) sera peint, mais le corps restera vide sans skeleton jusqu'à la dernière requête résolue.

**Résolution i18n à double face.**
`lib/i18n/server.ts` expose `getT`/`getFormat`/`getLabels` pour les Server Components ; `lib/i18n` (hooks `useT`/`useLabels`/`useFormat`) pour les Client Components. `mocks/labels.ts` fournit des `Meta = { labelKey, tone }` **locale-indépendants**, et `makeLabels(t)` est conçu pour serveur OU client. Le portail exploite déjà la voie serveur (`portal-card.tsx` = Server Component async qui résout `getT`/`getFormat`).

**Frontière async : convention de fichiers Next quasi absente.**
Glob exhaustif `app/**/{error,global-error,not-found,loading}.tsx` → **0 fichier**. Seuls des `layout.tsx` existent. 14 `notFound()` sont dispersés (dont plusieurs servent de garde tenant : `content/[contentId]/page.tsx:59` `content.clientId !== clientId → notFound()`), mais aucun `not-found.tsx` custom ne les rend → écran 404 générique de Next, anglais, sans shell, sans i18n.

**Design system — inventaire des primitives d'état async.**
- `components/shared/empty-state.tsx` : EmptyState générique, bien fait, prop `action` pour CTA — utilisé dans 16 fichiers.
- `components/ui/skeleton.tsx` : `div animate-pulse` brut, utilisé dans du code applicatif réel à **un seul endroit** (`grid-board.tsx:100`).
- **Aucun** ErrorState / ErrorBoundary (grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` = 0), **aucun** spinner canonique dans `shared/` (Loader2 = sonner vendoré + 2 composants app).
- `components/shared/media-thumb.tsx` : **seule primitive média**, consommée dans ~13 fichiers, rend un `<Image fill>` nu sans `onError`/`onLoad`/placeholder (grep `onError|onLoad|onLoadingComplete` sur `apps/web` = 0).

**Primitives de statut forcées client.**
`status-badge.tsx`, `status-dot.tsx`, `format-icon.tsx`, `quota-gauge.tsx` sont tous `"use client"` **uniquement** parce qu'ils appellent `useLabels()`/`useT()`/`useFormat()` — alors que leur donnée sous-jacente est locale-indépendante. Frottement démontré : `portal-card.tsx` (Server Component) maintient un pont serveur parallèle `statusBadgeLabel(status, t)` pour résoudre le libellé côté serveur, tout en rendant `<ContentStatusBadge>` (client) pour la pastille.

**Interactions DnD (4 `DndContext`).**
`grid-workspace.tsx` et `composer-media.tsx` ont un `KeyboardSensor` ; `board-kanban.tsx:55-60` et `calendar-dnd.tsx` n'en ont **pas** (PointerSensor + TouchSensor seulement). Aucun des 4 ne passe de prop `accessibility`/`announcements` → annonces lecteur d'écran en anglais par défaut de dnd-kit, dans une UI 100 % FR/EN.

---

## Findings (triés par sévérité P0 → P3)

_Aucun P0._ La dimension ne présente aucun défaut atteignable qui casse la preview aujourd'hui, ni de faille de sécurité/correction. Les findings ci-dessous sont des **obstacles concrets au câblage backend** et des **dettes UX/a11y** à traiter avant l'ouverture à des tiers.

### [P1] Aucune frontière `error.tsx` dans `(app)` : la moindre erreur de fetch Supabase = crash plein écran non stylé, non récupérable

- **Où** : `apps/web/app/(app)/` — 0 `error.tsx` / `global-error.tsx` dans tout `app/` (glob `**/error.tsx` et `**/global-error.tsx` = 0 fichier)
- **Constat** : Zéro error boundary dans l'arbre. Toutes les pages sont des Server Components qui appellent aujourd'hui des getters mocks synchrones qui ne jettent jamais (impact preview = nul). Au câblage Supabase, chaque getter devient un `await` réseau susceptible d'échouer (timeout, refus RLS, 500 Supavisor, token expiré). En App Router, une erreur non catchée remonte à la frontière `error` la plus proche ; avec zéro frontière, le fallback est le message générique de Next.
- **Scénario d'échec / coût à l'échelle** : Un freelance ouvre `/dashboard`, la requête Supabase timeout (VPS Coolify sous charge, ou maintenance Supabase). Sans error boundary : écran d'erreur par défaut (page blanche en prod), aucun bouton « réessayer », **perte de tout le shell** (sidebar/header). Sur PWA iOS installée, l'app paraît cassée sans recours. Fréquence croissante avec les 23 pages branchées.
- **Pourquoi ça bloque le scaling** : Le fil rouge « se brancher sur Supabase SANS réécriture » est directement cassé. Ajouter la gestion d'erreur après coup impose de créer `error.tsx` par segment ET souvent de refactorer les pages pour distinguer erreur/vide. Une error boundary est un Client Component avec callback de reprise : c'est un **ajout structurel**, pas cosmétique. Plus la surface grandit, plus le rattrapage coûte.
- **Reco** : Poser dès la preview un `(app)/error.tsx` (fallback global brandé, bouton réessayer via le callback de reprise) + un `app/global-error.tsx` racine (capture les erreurs du root layout : fonts + providers). Descendre des `error.tsx` plus fins sur les segments à fetch lourd (`[clientId]`, `dashboard`, `agenda`) au câblage. Les câbler à Sentry (`captureException` dans un `useEffect` du composant — le canal Sentry front prévu ne reçoit AUCUNE erreur de rendu serveur sans cette frontière). Note d'implémentation : en Next 16 la prop de reprise a été renommée `retry()` (ex-`reset()`) — vérifier dans `node_modules/next/dist/docs/`.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (errors : Sentry web+worker) — l'absence d'error boundary prive le canal Sentry front des erreurs de rendu serveur

---

### [P2] `MediaThumb` (13 consommateurs) n'a aucun état d'erreur ni de chargement : au câblage, chaque URL signée expirée/cassée affiche le glyphe « image cassée » du navigateur

- **Où** : `apps/web/components/shared/media-thumb.tsx:22-41`
- **Constat** : Le composant rend un `<Image fill>` nu (src/alt/fill/sizes/priority/className), sans `onError`, sans `onLoad`, sans placeholder. Aucune gestion d'échec/chargement n'existe nulle part dans `apps/web` (grep `onError|onLoad|onLoadingComplete` = 0). C'est la SEULE primitive d'affichage média, consommée dans ~13 fichiers (portal-card, board-kanban-card, grid-shelf/tile, board-review-dialog, day-sheet-row/entry, content-quick-view, content-card, week-view, planning-shelf, trash-list). Le cas « aucun média » est déjà réimplémenté à la main dans CHAQUE consommateur (bloc `bg-muted` + `FormatIcon` : `board-kanban-card.tsx:36-40`, `portal-card.tsx:58-62`, `day-sheet-row.tsx:47-51`, `grid-tile.tsx:37-44`) — signe que la primitive devrait porter cet état. Plusieurs call sites passent `alt=""` (kanban, day-sheet-row) → sur échec, pas même de texte lisible.
- **Scénario d'échec / coût à l'échelle** : Un reviewer ouvre le portail sur iPhone en 3G faible : 8 des 12 vignettes n'ont pas fini de charger ou pointent vers un thumb purgé → 8 rectangles « image cassée » gris, au lieu d'un skeleton pendant le chargement puis d'un fallback propre (icône format + fond muted). La grille IG et le portail — les deux vitrines client — paraissent cassées.
- **Pourquoi ça bloque le scaling** : C'est LE point de bascule vers l'async. Dès que `thumbUrl` = URL Supabase, le taux d'échec/latence passe de 0 (Pexels mocké) à non négligeable : les originaux passeront par des **URL signées TTL 48 h** (CLAUDE.md §20, expiration garantie par construction), l'Edge Function `media-cleanup` peut avoir purgé un fichier (§23), thumb pas encore généré, offline PWA. 13 vues dépendant d'une primitive unique : corriger ici couvre toute l'app d'un coup ; ne pas le faire oblige à rattraper l'état cassé vue par vue.
- **Reco** : Convertir `MediaThumb` en client component minimal avec état local : skeleton (`animate-pulse`) tant que `onLoad` n'a pas résolu, et sur `onError` un fallback intégré (fond `bg-muted` + `FormatIcon`/icône générique + alt). Exposer une prop `fallback?: ReactNode` pour surcharge, et supprimer les blocs « pas de média » dupliqués en les faisant passer par cette prop. Ajouter le hostname du bucket Supabase à `next.config` `remotePatterns` au câblage (aujourd'hui : seulement `images.pexels.com`, normal en phase mock).
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §20 (media-thumbs / URL signées 48 h) — le fallback ne viole rien, il rend l'invariant robuste

---

### [P2] Aucune primitive partagée d'état d'erreur async — la trilogie est incomplète (EmptyState OK, Loading embryonnaire, ErrorState absent, aucun error boundary)

- **Où** : `apps/web/components/shared/empty-state.tsx:5` (seul état partagé) ; `apps/web/components/ui/skeleton.tsx:3`
- **Constat** : Inventaire des états async du design system : (1) **EmptyState** — bien fait, générique, réutilisable. (2) **Skeleton** — `div animate-pulse` basique, utilisé dans du code applicatif réel à UN seul endroit (`grid-board.tsx:100`). (3) **Aucun ErrorState / ErrorBoundary** (grep `ErrorBoundary|error.tsx|componentDidCatch` = 0). (4) **Aucun spinner partagé** dans `shared/` (`Loader2` = sonner vendoré + 2 composants app). La carte confirme aussi 0 `loading.tsx` / `error.tsx` / `not-found.tsx` dans `app/`.
- **Scénario d'échec / coût à l'échelle** : Au câblage TanStack Query, chaque page (dashboard, calendrier, grille, studio, agenda, portail) doit gérer `isLoading`/`isError`/`isEmpty`. Sans primitives partagées, chaque écran réinvente son skeleton et surtout son rendu d'erreur — soit en l'oubliant (l'erreur remonte en crash React), soit en le bricolant différemment partout → 23 pages, 23 traitements d'erreur incohérents.
- **Pourquoi ça bloque le scaling** : Le contexte imposé pose l'exigence « every view will gain async data fetching (loading/error/empty states become mandatory) ». Le design system arrive à ce jalon avec **1 primitive sur 3**. C'est le socle réutilisable à poser AVANT le câblage : le poser une fois = 23 vues cohérentes et branchables sans réécriture ; le poser après = rétrofit vue par vue. Structurel, pas cosmétique. (Nuance de sévérité : ce n'est pas un bloqueur strict — on _peut_ brancher TanStack Query sans ces primitives, ce serait juste incohérent et coûteux à rattraper — d'où P2 et non P1.)
- **Reco** : Compléter la trilogie dans `components/shared/` en miroir d'EmptyState : (a) un `ErrorState {title, description, retry?}` réutilisable (icône destructive, bouton Réessayer) ; (b) des skeletons composés prêts à l'emploi (`CardSkeleton`, `ListRowSkeleton`, `GridSkeleton`) au-dessus de la primitive `Skeleton` ; (c) au minimum un `ui/spinner` canonique. Ces trois briques sont le prérequis des `error.tsx`/`loading.tsx` par segment (posés au câblage). Ne rien câbler maintenant — juste doter la bibliothèque.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

---

### [P2] Aucun `loading.tsx` / Suspense : au câblage, chaque navigation bloque sur le fetch le plus lent avant de peindre quoi que ce soit

- **Où** : `apps/web/app/(app)/` — 0 `loading.tsx` dans tout `app/` ; 0 occurrence de `Suspense`/`dynamic`/`revalidate` dans `(app)` (grep vide)
- **Constat** : Zéro `loading.tsx`, zéro `<Suspense>`, zéro streaming. Les pages agrègent séquentiellement de nombreux getters (`content/[contentId]/page.tsx:66-73` : 8 lectures ; `grid/page.tsx` idem). En mock c'est instantané ; en réseau, la page ne rend qu'après la dernière requête résolue.
- **Scénario d'échec / coût à l'échelle** : Ouverture de la fiche contenu sur Supabase : 8 requêtes séquentielles ~80 ms = ~600 ms de `<main>` blanc (le shell est déjà là via layout, mais le corps reste vide, sans skeleton). L'utilisateur clique, rien ne bouge pendant 0,5–1 s à chaque navigation. Sur iOS 4G le ressenti double. Perçu comme « lent/figé ».
- **Pourquoi ça bloque le scaling** : C'est le point le plus coûteux à rattraper tardivement _si_ on vise le streaming intra-page : `<Suspense>` n'est pas un wrapper, il impose de découper la page en sous-composants async indépendants. Le faire a posteriori sur 23 pages = réécriture de la structure de chaque page. **Mitigation la moins chère (purement additive)** : un `loading.tsx` par segment réutilisant `ui/skeleton.tsx` — ne touche aucun interne de page. (Impact utilisateur aujourd'hui = nul ; jamais « cassé », seulement « lent » ; d'où P2.)
- **Reco** : Adopter le pattern `loading.tsx` par segment (skeleton par archétype : board, grid, detail, list) + envelopper les blocs lourds indépendants dans `<Suspense fallback={<Skeleton/>}>` à l'intérieur des pages (ex. l'aside activité/versions de la fiche contenu). **Paralléliser** les getters d'une même page via `Promise.all` quand ils deviennent async, pour tuer le waterfall.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : Contexte imposé (« chaque vue va gagner du fetch async, loading/error/empty deviennent obligatoires ») — prérequis explicite non satisfait

---

### [P2] 14 appels `notFound()` mais aucun `not-found.tsx` : les 404 (ressource inexistante ou d'un autre tenant) tombent sur la page Next par défaut, hors charte

- **Où** : `apps/web/app/(app)/clients/[clientId]/layout.tsx:24` (+ 13 autres call sites : `grid:143`, `content/[contentId]/page.tsx:59`, `edit/page.tsx:40`, `calendar:29`, `ideas:19`, `library:24`, `performance:24`, `report:23` et `26`, `content/page.tsx:29`, `content/new:68`, `settings:31`, + `portal/[contentId]/page.tsx:40`)
- **Constat** : 14 `notFound()` (app) répartis, dont plusieurs servent de garde de sécurité multi-tenant (`content/[contentId]/page.tsx:59` `content.clientId !== clientId → notFound()` ; le portail fait `content.clientId !== DEMO_REVIEWER_CLIENT_ID → notFound()`). Aucun `not-found.tsx` dans l'arbre → rendu = écran 404 générique de Next (typo système noir/blanc), sans sidebar, sans lien retour, sans i18n FR/EN. **Ces états sont atteignables DÈS MAINTENANT** en preview (un `clientId`/`contentId` invalide → lookup mock `undefined` → `notFound()`).
- **Scénario d'échec / coût à l'échelle** : Un reviewer/owner suit un lien périmé vers un contenu archivé ou tape `/clients/xxx` invalide : page 404 brute anglaise hors-marque, perte de la navigation, ambiguïté « droit manquant (isolation tenant) ou ressource supprimée ? ». En prod multi-tenant, ces 404 seront fréquents (liens partagés, ressources déplacées entre statuts).
- **Pourquoi ça bloque le scaling** : `notFound()` est déjà LE mécanisme de défense en profondeur pour l'isolation tenant (ressource d'une autre org → `notFound()` plutôt que fuite). Il sera massivement sollicité au câblage RLS. Sans `not-found.tsx` cohérent, l'UX de refus/absence n'existe pas et devra être conçue en urgence en prod.
- **Reco** : Ajouter `(app)/not-found.tsx` (404 brandé, i18n, lien retour dashboard, garde le shell) et éventuellement `clients/[clientId]/not-found.tsx` pour rester dans le contexte client. Distinguer visuellement « introuvable » de « accès refusé » quand la logique tenant arrivera — message neutre côté sécurité, **jamais** « ce contenu appartient à une autre organisation ».
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règles 7-8 (defense in depth, test de fuite) — `notFound()` est le rendu de la défense tenant ; il doit exister comme surface UI maîtrisée

---

### [P2] Primitives d'affichage de statut (badge/dot/format/quota) forcées `"use client"` par `useLabels` — inutilisables dans un Server Component sans franchir une frontière client, à contre-courant de « Server Components par défaut »

- **Où** : `apps/web/components/shared/status-badge.tsx:1` ; `status-dot.tsx:1` ; `format-icon.tsx:1` ; `quota-gauge.tsx:1`
- **Constat** : `ContentStatusBadge`/`TargetStatusBadge`/`AccountStatusBadge`/`ReviewStateBadge`, `StatusDot`, `FormatIcon`/`FormatLabel`, `QuotaGauge` sont tous `"use client"` **uniquement** parce qu'ils appellent `useLabels()`/`useT()`/`useFormat()`. Or leur donnée (`mocks/labels.ts`) est locale-indépendante (`Meta = { labelKey, tone }`) et la résolution i18n existe AUSSI côté serveur (`lib/i18n/server`, `makeLabels(t)` conçu serveur OU client). Preuve du frottement : `portal-card.tsx` est un Server Component async qui résout `getT`/`getFormat` côté serveur, maintient un pont serveur parallèle `statusBadgeLabel(status, t)` pour le libellé, mais rend quand même `<ContentStatusBadge>` (client) pour la pastille. La page portail `(portal)/portal/[contentId]/page.tsx` résout `getT`/`getFormat`/`getLocale` côté serveur mais importe/rend `<ContentStatusBadge>` et `<FormatLabel>` en composants client.
- **Scénario d'échec / coût à l'échelle** : Toute liste rendue côté serveur (portail, futures pages server-first branchées sur Supabase) qui veut afficher un simple badge de statut doit soit importer un composant client (frontière RSC + JS envoyé au navigateur pour une pastille statique), soit réimplémenter le mapping tone→classe à la main (duplication déjà présente).
- **Pourquoi ça bloque le scaling** : La règle CLAUDE.md (Server Components par défaut, Client minimal) et le fil rouge « se brancher sur Supabase sans réécriture » poussent vers des listes rendues serveur. Des primitives de statut qui n'existent qu'en variante client obligent, à chaque nouvelle vue server, à choisir entre boundary client ou duplication. (La plupart des ~30 consommateurs actuels sont déjà dans des arbres client — grid, calendrier, studio DnD — donc coût nul là ; le portail est la surface légitimement server-first où le coût s'applique dès aujourd'hui → P2.)
- **Reco** : Découpler l'affichage de la source de locale : variante présentationnelle recevant le label déjà résolu en prop (`Badge` + `tone` + `label: string`, sans hook) que le parent (server ou client) alimente via `getT()` ou `useT()`. Le mapping `toneDotClass` est déjà pur. Objectif : afficher un statut dans un RSC sans embarquer de JS ; supprimer le pont `statusBadgeLabel`.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §Code règle 26 (Server Components par défaut, Client minimal)

---

### [P2] Kanban : déplacement de carte impossible au clavier (`DndContext` sans `KeyboardSensor` + fausse affordance `role=button`)

- **Où** : `apps/web/components/app/studio/board-kanban.tsx:55-60` (sensors) ; `board-kanban-card.tsx:87-103` (`DraggableKanbanCard`)
- **Constat** : Le `DndContext` du kanban ne déclare que `PointerSensor` + `TouchSensor` (55-60), **aucun `KeyboardSensor`**. Or `DraggableKanbanCard` (89-102) spread `{...attributes}` de `useDraggable` sur un `<div>` : en dnd-kit 6.3.1 ces attributes posent `role="button"`, `tabIndex=0` et `aria-roledescription="draggable"`. Le div devient focusable et s'annonce « bouton déplaçable » aux lecteurs d'écran, mais Espace/Entrée ne déclenchent AUCUN drag (pas de sensor clavier). Changer le statut d'un contenu par glisser entre colonnes n'a aucun équivalent clavier en mode kanban. `KANBAN_LOCKED` ne verrouille que `publishing/published/partially_published` → la majorité des cartes reçoit la fausse affordance. Inventaire : sur 4 `DndContext`, seuls `grid-workspace.tsx:73` et `composer-media.tsx:70` ont un `KeyboardSensor`.
- **Scénario d'échec / coût à l'échelle** : Un utilisateur clavier (ou lecteur d'écran) tabule sur une carte, entend « brouillon, déplaçable, bouton », presse Entrée/Espace : rien. Il ne peut pas faire avancer un contenu dans le pipeline via le kanban. Pire, l'`aria-roledescription` lui promet une action inexistante.
- **Pourquoi ça bloque le scaling** : Le kanban est LE poste de pilotage quotidien (CLAUDE.md §4). Au câblage, ces déplacements deviendront de vraies transitions de la machine à états `ContentStatus` (PRD §6). Livrer une transition métier centrale sans chemin clavier verrouille une dette d'accessibilité qui grossit à chaque nouveau statut, et rend l'app non conforme RGAA/WCAG 2.1.1 (Clavier) au moment d'ouvrir le SaaS à des tiers.
- **Reco** : Ajouter `useSensor(KeyboardSensor)` au `DndContext` du kanban (pattern déjà identique dans `grid-workspace.tsx:73` et `composer-media.tsx:70`). dnd-kit gère alors nativement le déplacement clavier. Complément : exposer un menu « Déplacer vers… » sur la carte (les callbacks `board.setStatusBatch` existent). Sans l'un des deux, retirer les `attributes` draggable des cartes verrouillées pour ne pas mentir aux AT.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun (§5 fige la machine à états, pas l'interaction)

---

### [P2] Aucune `apple-touch-icon` PNG : l'icône d'écran d'accueil iOS retombera sur une capture de la page

- **Où** : `apps/web/app/manifest.ts:15`
- **Constat** : Le manifest ne déclare qu'une icône SVG (`/icon.svg`, `sizes:"any"`, `type image/svg+xml`) et `public/` ne contient que des SVG (icon.svg + placeholders Next). `layout.tsx:28` pose bien `appleWebApp.capable:true`/statusBar/title, mais **aucune `apple-touch-icon` PNG** n'est référencée (ni via `metadata.icons.apple`, ni fichier `app/apple-icon.png` ; grep `apple-touch-icon` = 0). iOS Safari n'utilise PAS les icônes SVG du manifest pour l'écran d'accueil.
- **Scénario d'échec / coût à l'échelle** : Quand Étienne (premier utilisateur iPhone) fait « Sur l'écran d'accueil », iOS ne trouve pas d'`apple-touch-icon` exploitable et génère une vignette = capture rognée de la page (souvent le header/login) au lieu du logo Ocean. L'onboarding installation « soigné » exigé par le PRD démarre sur une icône cassée.
- **Pourquoi ça bloque le scaling** : L'app se veut aussi vitrine build-in-public (CLAUDE.md §12) : une icône d'accueil dégradée est vue par chaque prospect qui installe la PWA. Fournir les PNG une fois est un prérequis unique, pas une dette récurrente. (Défaut purement cosmétique, la PWA s'installe et fonctionne, zéro risque données/publication → P2, fix mono-fichier ajoutable avant tout vrai utilisateur.)
- **Reco** : Ajouter `app/apple-icon.png` (180×180) — Next le mappe automatiquement en `<link rel=apple-touch-icon>` — et des icônes PNG 192/512 (dont une `purpose:maskable`) dans le manifest, en plus du SVG. Garder le SVG pour les navigateurs qui le supportent.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 (onboarding installation iOS soigné) + §1 (PWA priorité iOS)

---

### [P3] État vide manquant sur la liste clients : une org fraîchement créée (0 client) affiche une grille vide sans onboarding

- **Où** : `apps/web/app/(app)/clients/page.tsx:46-86` (`clients.map` dans le grid, aucun garde `clients.length === 0` ; seule la section archivés ligne 88 est gardée)
- **Constat** : La grille mappe `getClients()` dans un `<div grid>` sans fallback vide. `EmptyState` existe pourtant (`components/shared/empty-state.tsx`) et est déjà utilisé ailleurs. Le `PageHeader` rend bien un bouton primaire « nouveau client » **toujours visible** (38-43), donc l'affordance n'est pas nulle — ce qui manque est un état vide central qui guide l'activation.
- **Scénario d'échec / coût à l'échelle** : Premier login d'un nouveau freelance en prod : `/clients` affiche un header + une zone vide. Aucune invite claire « ajoutez votre premier client », aucun call-to-action central. Le moment le plus critique du parcours (activation) est le moins guidé.
- **Pourquoi ça bloque le scaling** : SaaS multi-tenant où chaque nouvel utilisateur DÉMARRE forcément à vide. Les états vides ne sont pas un cas rare mais le premier écran de 100 % des comptes. (Changement purement additif, aucun blocage de câblage → P3.)
- **Reco** : Ajouter `clients.length === 0 → <EmptyState>` avec CTA « Ajouter un client » (`routes.clientNew`). Systématiser EmptyState sur toutes les pages qui mappent en inline au niveau page.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

---

### [P3] État vide manquant sur « Activité récente » du dashboard (map inline sans garde)

- **Où** : `apps/web/app/(app)/dashboard/page.tsx:110-129` (`recent.map` dans `<ul>`, aucun garde `recent.length === 0`)
- **Constat** : La carte « Activité récente » mappe `getNotifications("owner").slice(0,5)` sans fallback. `getNotifications` filtre par audience → peut structurellement retourner `[]`. Contrairement aux cartes voisines (`TaskList` → `task-list.tsx:52-61`, `TodayPanel` → `today-panel.tsx:21-30`) qui portent chacune leur `EmptyState`, cette liste est rendue inline dans la page sans branche vide. (Latent aujourd'hui : `notifications.ts` contient 9 notifs owner, donc `recent` est non vide en preview.)
- **Scénario d'échec / coût à l'échelle** : Nouveau compte ou compte sans notifications (dès le câblage, owner fraîchement créé) : la carte affiche un titre puis un `<ul>` vide (bloc visuellement cassé). Cosmétique mais visible dès le premier écran d'un compte neuf.
- **Pourquoi ça bloque le scaling** : Même racine que le finding précédent : les listes rendues inline au niveau page échappent au pattern EmptyState propre appliqué dans les composants enfants. L'incohérence grandit à mesure que des cartes « récent/résumé » se multiplient.
- **Reco** : Extraire un composant (`RecentActivity`) portant son propre `EmptyState`, comme `TodayPanel`/`TaskList` — ou a minima ajouter la branche `recent.length === 0`. Règle à uniformiser : toute liste = composant qui possède son état vide.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

---

### [P3] Sections du rapport rendues même à zéro donnée : titre + grille vide au lieu d'un état vide (client fraîchement créé)

- **Où** : `apps/web/components/app/performance/report-highlights.tsx:46`
- **Constat** : `ReportHighlights` rend toujours `<section>` + `<h2>` + une grille `grid-cols-3` qui mappe `top3` ; si `posts` est vide, on obtient un titre « Temps forts » surmontant une grille vide. Idem `ReportContentMix` (`report-highlights.tsx:61`) : barre de 0 largeur + liste vide. `ReportWorkspace` n'a aucun garde « aucune publication mesurée » — `getReportData` ne retourne `null` que si le client n'existe pas, pas s'il n'a aucun post. `EmptyState` existe déjà. (Non atteignable en preview : le wizard ne persiste aucun client, tous les clients mockés reçoivent une BLUEPRINT complète de contenus publiés ; c'est un gap qui se manifeste **au câblage** pour un client neuf/en pause.)
- **Scénario d'échec / coût à l'échelle** : Une fois Supabase câblé, un client venant d'être créé (0 publication mesurée, cas nominal en phase solo) génère un rapport « présentable/partageable » avec des sections à en-tête mais sans contenu, imprimé tel quel en PDF. Le livrable envoyé au client final paraît cassé.
- **Pourquoi ça bloque le scaling** : Dès que les données deviennent réelles, la période courante d'un nouveau client ou d'un client en pause aura régulièrement 0 post : l'état vide n'est pas rare mais le point de départ de chaque client. (Additif, l'UI se branche sans réécriture → P3.)
- **Reco** : Ajouter un garde « aucune publication mesurée sur la période » au niveau `ReportWorkspace` (et/ou par section) qui rend un `EmptyState` au lieu des grilles vides, et masque la section du PDF. Aligner `PerfTopPosts` pour ne pas rendre un bloc Top vide.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

---

### [P3] `getClient(clientId)` refetché dans le layout ET dans chaque page enfant : waterfall dupliqué à chaque navigation une fois Supabase branché

- **Où** : `apps/web/app/(app)/clients/[clientId]/layout.tsx:23` (`getClient` + `getSocialAccounts`) redondant avec les 11 pages enfants qui rappellent `getClient(clientId)` (`calendar:28`, `grid:142`, `content/[contentId]:57`, `edit:38`, `ideas:18`, `library:23`, `performance:23`, `report:22`, `content:28`, `content/new:67`, `settings:30`)
- **Constat** : Le layout résout `getClient` + `getSocialAccounts`, puis chaque page enfant re-résout `getClient` (souvent + `getSocialAccounts`). En mock synchrone c'est gratuit. `@tanstack/react-query` est ABSENT de `package.json` et **aucun `cache()` de React n'existe encore** dans `apps/web` (le snippet `getActiveOrg = cache(...)` de CLAUDE.md §3 est aspirationnel). Sans dédup, chaque `await` Supabase sera émis 2× par navigation. (Ce sont deux point-reads triés par index — amplification ×2, pas un N+1, sans dimension correction/sécurité → P3.)
- **Scénario d'échec / coût à l'échelle** : Naviguer entre onglets d'un client (grid → calendar → content) sur Supabase : à chaque onglet, layout + page relancent la lecture du client et des comptes = 2× la même requête réseau par transition. Latence perçue et charge DB doublées sur le chemin le plus fréquenté.
- **Pourquoi ça bloque le scaling** : « Ça ne tient pas quand ça grossit » : la dénormalisation `org_id`/`client_id` et RLS rendent chaque lecture non triviale (helpers `SECURITY DEFINER`). Le fix propre doit être posé au niveau du seam mocks pour que le câblage en hérite sans réécrire les pages. _Correction d'une imprécision fréquente_ : le préjudice n'est PAS « connexions Supavisor SESSION » (réservées au worker, port 5432 ; l'app web passe par le pooler transaction 6543) — c'est de la latence + charge DB. Et le coût de remédiation est faible : `cache()` enveloppe le getter, pas les 11 sites d'appel → zéro edit de page.
- **Reco** : Envelopper les getters de contexte (`getClient`, `getSocialAccounts`) dans `React.cache()` dès la couche `lib/mocks` (ou l'adaptateur Supabase futur), à l'image de `getActiveOrg = cache(async () => …)` prescrit dans CLAUDE.md §3. Décision à acter maintenant pour que le seam `lib/mocks/index.ts` expose des getters cache-ables.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §3 (`getActiveOrg` via `cache(React)`) — pattern déjà norme du projet, non appliqué aux getters de contexte client

---

### [P3] `QuotaGauge` : `role="meter"` avec `aria-valuemax = usage.limit` se casse si `limit` vaut 0

- **Où** : `apps/web/components/shared/quota-gauge.tsx:41-56`
- **Constat** : `ratio` est protégé contre `limit<=0` (ligne 41 → 0), mais l'élément `role="meter"` expose `aria-valuemax={usage.limit}` / `aria-valuenow={usage.used}` bruts (52-54). Avec `limit=0`, un meter `min=0`/`max=0` est un range dégénéré (WAI-ARIA) : VoiceOver (cible iOS prioritaire) annoncerait une valeur non signifiante. (Le claim secondaire du finding source sur le `title` est non fondé : quand `showLabel=true`, le label est rendu juste au-dessus en `whitespace-nowrap` sans troncature, et la barre porte déjà `aria-label` complet — l'AT a l'info.) (`limit=0` est actuellement inatteignable : `PLATFORM_QUOTAS` ne contient que 100/30/5 et `getQuotaUsage` renvoie `null`, pas un objet à 0 ; état de chargement/dégradé au câblage → P3.)
- **Scénario d'échec / coût à l'échelle** : Au câblage, `getQuotaUsage` peut renvoyer momentanément `{used:0, limit:0}` pendant le chargement ou si `content_publishing_limit` échoue → le meter annonce une plage 0..0 à VoiceOver, état non signifiant.
- **Pourquoi ça bloque le scaling** : Impact faible et localisé (1 composant, 6 sites d'usage), mais typique de l'edge case (donnée à 0 / chargement) qui n'existe pas en mock et apparaît au premier fetch réel. À traiter quand `QuotaGauge` sera branché sur le worker/DB (source de vérité des quotas, §6).
- **Reco** : Clamp défensif : `aria-valuemax={Math.max(usage.limit, 1)}` et gérer explicitement `limit===0` (état neutre « quota indisponible » plutôt qu'une jauge 0/0). Optionnel : `aria-valuetext` avec le label lisible (« 87 sur 100 publications ») pour un rendu vocal correct sur iOS.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

---

### [P3] `initials()` ne borne pas la chaîne vide/espaces — `ClientAvatar` peut afficher une pastille vide

- **Où** : `apps/web/lib/format.ts:89-95` (consommé par `apps/web/components/shared/client-avatar.tsx:28`)
- **Constat** : `initials(name)` fait `split(/\s+/).slice(0,2)` puis prend `w[0]`. Pour `name=''` ou `'   '`, `split` renvoie `['']` → `w[0]` undefined → `''` : `ClientAvatar` rend une pastille colorée VIDE. (Le sous-titre « trop de caractères » du finding source est FAUX : `.slice(0,2)` borne à 2 mots × 1 char = ≤2 chars, aucun débordement. `name` est typé `string` non-null, donc seul le cas vide/whitespace est atteignable, et uniquement pour un client persisté — impossible avec les mocks propres. Certains call sites gardent déjà : `step-review.tsx:94`, `step-identity.tsx:32` passent `draft.name || "?"`.)
- **Scénario d'échec / coût à l'échelle** : Au câblage, un client créé avec un nom vide/whitespace (donnée importée ou saisie incomplète) produit un avatar coloré sans initiales dans toutes les listes (switcher client, en-têtes, cartes). Purement cosmétique.
- **Pourquoi ça bloque le scaling** : Trivial, mais la primitive est très réutilisée (avatar omniprésent). En mock les noms sont propres ; la donnée réelle ne l'est pas forcément. (Contrat `string→string` conservé, aucun obstacle au câblage → P3.)
- **Reco** : Ajouter un fallback dans `initials` (`'?'` ou première lettre non-espace si aucune initiale) et `trim` l'entrée. Optionnel : `ClientAvatar` accepte un `fallback` explicite.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

---

### [P3] Drag-and-drop : annonces lecteur d'écran non traduites (anglais dnd-kit par défaut) alors que l'app est FR/EN

- **Où** : `apps/web/components/app/grid/grid-workspace.tsx:77` (`DndContext`) ; `composer-media.tsx:149` ; `board-kanban.tsx:140` ; `calendar-dnd.tsx:76`
- **Constat** : Aucun des 4 `DndContext` ne passe de prop `accessibility`/`announcements`/`screenReaderInstructions` (grep = 0). dnd-kit 6.3.1 rend un composant `Accessibility` qui applique par défaut des chaînes **anglaises codées en dur** (« Picked up draggable item… », « …was dropped. »). Là où un `KeyboardSensor` existe (`grid-workspace.tsx:73`, `composer-media.tsx:70`), ces annonces sont réellement déclenchées — dans une app dont 100 % de l'UI passe par les dictionnaires FR/EN.
- **Scénario d'échec / coût à l'échelle** : Un francophone lecteur d'écran réordonne le carrousel dans le composer (KeyboardSensor actif) : annonces en anglais au milieu d'une interface entièrement française. Incohérence linguistique pour la population qui dépend justement de ces annonces.
- **Pourquoi ça bloque le scaling** : Le chantier i18n FR/EN vise une UI bilingue complète ; laisser les annonces DnD hors dictionnaire crée une zone non traduite permanente qui échappe aux revues visuelles (audible seulement au lecteur d'écran). (Screen-reader-only, 2 surfaces, impact « faible » → P3.)
- **Reco** : Définir un objet `accessibility={{ announcements, screenReaderInstructions }}` avec des libellés tirés des dictionnaires (`lib/i18n`), partagé entre les 4 `DndContext` (helper commun). À faire en même temps que l'ajout des `KeyboardSensor` manquants.
- **Effort** : M   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun (cohérent avec le chantier i18n)

---

### [P3] En-tête profil IG : pattern `tablist` incomplet (pas de `tabpanel`, pas d'`aria-controls`, pas de navigation flèches)

- **Où** : `apps/web/components/app/grid/instagram-profile-header.tsx:131-170` (`role=tablist` + `role=tab`) ; panneau associé dans `grid-workspace.tsx:94-109`
- **Constat** : L'en-tête déclare `role="tablist"` avec deux `role="tab"` et `aria-selected` (131-162), mais : (1) **aucun** `role="tabpanel"` ni `aria-controls` (grep sur tout `apps/web/components` = 0) ne relie les onglets au contenu (la grille Posts/Reels est rendue plus loin dans `grid-workspace.tsx` sans rôle de panneau) ; (2) pas de roving-tabindex / flèches gauche-droite exigés par le pattern ARIA Tabs (aucun `onKeyDown`) ; (3) une 3e « tuile » décorative (`aria-hidden`, 163-169) est intercalée dans la tablist. Les boutons restent activables via Tab+Entrée (vrais `<button>`), donc l'usage de base marche, mais la sémantique ARIA annoncée est trompeuse.
- **Scénario d'échec / coût à l'échelle** : Un lecteur d'écran annonce « onglet sélectionné » puis ne trouve aucun panneau associé (pas d'`aria-controls`/`tabpanel`). Un utilisateur habitué aux flèches constate qu'elles ne font rien. Attentes ARIA non tenues.
- **Pourquoi ça bloque le scaling** : Composant cœur de la démo client (simulation de profil). Un pattern ARIA à moitié implémenté sert de modèle copié ailleurs → mieux vaut soit le compléter, soit l'assumer comme simple groupe de boutons.
- **Reco** : Deux options propres — (a) compléter le pattern Tabs (`aria-controls` + `id`, `role=tabpanel` sur le conteneur de grille, roving tabindex + flèches) ; ou plus simple (b) abandonner `role=tablist/tab` et exposer un `role="group"` `aria-label` avec des boutons `aria-pressed` (comme `RatioSwitch` `grid-toolbar.tsx:41` — idiome déjà pervasif dans le produit). L'option (b) est cohérente avec le reste de l'UI et sans dette.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

---

### [P3] Cibles tactiles sous 44 px sur les commandes du carrousel du portail (points de pagination 6 px, pins d'annotation 28 px)

- **Où** : `apps/web/components/portal/media-carousel.tsx:77` (points) ; `annotation-viewer.tsx:98-99` (pins)
- **Constat** : Les points de pagination sont des `<button>` de `h-1.5` (6 px) / `w-1.5`–`w-6`, sans zone de hit élargie (71-84). Les pins d'annotation sont `size-7` (28 px). Un target de 6 px est objectivement sous le plancher WCAG 2.5.8 (24 px) et la HIG Apple (44 px). (Note : le finding source qualifie les flèches `Button size="icon"` = 32 px de « correctes », alors que 32 px < 44 px aussi — incohérence interne ; mais les flèches offrent un chemin de nav plus large et récupérable, ce qui adoucit la sévérité → P3.)
- **Scénario d'échec / coût à l'échelle** : Sur le portail (surface la plus grand-public : c'est le CLIENT final qui l'utilise, souvent sur mobile), toucher un point de 6 px ou un pin de 28 px pour naviguer/lire une annotation rate fréquemment. Un client qui ne valide pas proprement érode la confiance produit — l'enjeu « paranoia = feature » de CLAUDE.md §12.
- **Pourquoi ça bloque le scaling** : Le portail est la vitrine de fiabilité vendue aux clients des freelances ; multiplié par tous les clients de tous les freelances, une ergonomie tactile approximative sur l'action centrale coûte des allers-retours de support.
- **Reco** : Envelopper les points dans un bouton à padding transparent (zone tappable ≥44 px, indicateur visuel fin conservé), ou augmenter les pins à `size-9`/`size-10`. Pattern réutilisable à factoriser si d'autres carrousels apparaissent (grille feed).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

---

## Code production-grade proposé (NON appliqué)

> Blocs de référence pour la phase de câblage. À ne PAS écrire dans le dépôt hors ce rapport.

**1. `MediaThumb` robuste (couvre le finding P2 média + supprime les blocs « pas de média » dupliqués dans 13 fichiers).**

```tsx
// components/shared/media-thumb.tsx
"use client"
import { Film, ImageOff, Layers } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import type { ReactNode } from "react"
import type { MediaAsset } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

export function MediaThumb({
  media, alt, count, className, sizes = "(max-width: 768px) 33vw, 220px",
  priority = false, fallback,
}: {
  media?: MediaAsset | null
  alt: string
  count?: number
  className?: string
  sizes?: string
  priority?: boolean
  fallback?: ReactNode // état « aucun média » surchargeable par l'appelant
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const showFallback = !media || state === "error"

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-muted", className)}>
      {showFallback ? (
        fallback ?? (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-5" aria-hidden />
            <span className="sr-only">{alt}</span>
          </div>
        )
      ) : (
        <>
          {state === "loading" ? (
            <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" aria-hidden />
          ) : null}
          <Image
            src={media.thumbUrl}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn("object-cover transition-opacity", state === "ready" ? "opacity-100" : "opacity-0")}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
          />
        </>
      )}
      {/* badges type/carrousel inchangés */}
    </div>
  )
}
```

**2. `ErrorState` partagé (complète la trilogie — finding P2 socle async).**

```tsx
// components/shared/error-state.tsx
"use client"
import { TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ErrorState({
  title, description, retry, className,
}: { title: ReactNode; description?: ReactNode; retry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 p-10 text-center", className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {retry ? <Button variant="outline" className="mt-4" onClick={retry}>{/* t("common.retry") */}Réessayer</Button> : null}
    </div>
  )
}
```

**3. Frontière `error.tsx` (finding P1) — consomme `ErrorState`, câble Sentry, i18n via hook client.**

```tsx
// app/(app)/error.tsx
"use client"
import { useEffect } from "react"
// import * as Sentry from "@sentry/nextjs"
import { ErrorState } from "@/components/shared/error-state"
import { useT } from "@/lib/i18n"

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT()
  useEffect(() => {
    // Sentry.captureException(error) — seule voie pour capturer les erreurs de rendu serveur côté front
  }, [error])
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <ErrorState title={t("errors.title")} description={t("errors.description")} retry={retry} />
    </div>
  )
}
// + app/global-error.tsx (racine, capture les erreurs du root layout) sur le même modèle, avec <html><body>.
// NB Next 16 : la prop de reprise est `retry` (ex-`reset`) — confirmer dans node_modules/next/dist/docs.
```

**4. Dédup des getters de contexte (finding P3 waterfall) — au seam mocks, hérité par le câblage sans toucher les pages.**

```ts
// lib/mocks/index.ts (ou l'adaptateur Supabase futur)
import { cache } from "react"
export const getClient = cache((id: string) => { /* … supabase.from('clients')… */ })
export const getSocialAccounts = cache((clientId: string) => { /* … */ })
// layout + page partagent alors une seule résolution par requête, zéro edit des 11 pages.
```

---

## Ce qui va bien (à préserver)

- **100 % des pages sont des Server Components `async`** (18 pages `(app)` + auth + portal). C'est le meilleur signal pour un câblage Supabase sans réécriture : le corps des getters change, la structure de page reste. À **ne pas** régresser en composants client.
- **Façade mocks unique (`lib/mocks/index.ts`)** comme seam de branchement : toutes les pages passent par des getters (`getClient`, `getContentItems`, `getSocialAccounts`…), jamais par les constantes brutes. C'est exactement l'endroit où poser `cache()` et brancher Supabase.
- **Mocks typés sur le schéma DB cible** (`lib/mocks/types/core.ts` : `Platform`, `ContentStatus`, `TargetStatus`, `MemberRole`… miroir du PRD §6). Le câblage héritera de types déjà alignés.
- **i18n à double face bien conçue** : `lib/i18n/server` (getT/getFormat/getLabels) pour RSC + hooks pour client, données de statut locale-indépendantes (`labels.ts`, `makeLabels(t)`). Base saine pour découpler les primitives de statut (finding P2).
- **`EmptyState` générique et déjà largement adopté** (16 fichiers, prop `action` pour CTA). Modèle exact à répliquer pour `ErrorState` et à généraliser aux 3-4 listes rendues inline.
- **Primitives de statut factorisées** (`status-badge`, `status-dot`, `format-icon`, `quota-gauge`) avec un mapping `tone→classe` pur (`toneDotClass`) et zéro couleur hardcodée (tokens `bg-primary`/`bg-warning`/`bg-destructive`). La seule dette est le `"use client"` inutile, pas la structure.
- **Une seule primitive média (`MediaThumb`)** consommée partout : le trou d'état d'erreur se corrige **une fois** pour 13 vues. La centralisation est le bon choix ; il ne manque que l'état async.
- **DnD accessible là où il compte le plus déjà amorcé** : `grid-workspace` et `composer-media` ont un `KeyboardSensor`. Le pattern existe dans le repo, il suffit de l'étendre au kanban/calendrier.
- **Manifest PWA présent et soigné** (`app/manifest.ts` : name, short_name, description, `display:standalone`, theme/background aux couleurs Ocean, `appleWebApp` dans le layout). Il ne manque que les icônes PNG/apple-touch.
- **Idiome de toggle cohérent** (`aria-pressed` + `role="group"`, ex. `RatioSwitch`) réutilisable pour corriger la tablist IG sans réinventer.

---

**Fichier écrit** : `c:/Users/etien/Desktop/Ocean/_research/audits/2026-07-07/07-frontend.md`
