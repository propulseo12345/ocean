# Audit — Refacto propre : inventaire duplication & couplage (2026-07-07)

> Dimension 02 — passe INVENTAIRE (duplication de logique + couplage fort). Aucun changement de comportement produit. Tous les findings ci-dessous ont été vérifiés fichier:ligne sur le code réel puis ont résisté à une passe de réfutation adversariale. Findings quasi-jumeaux fusionnés (mentionné dans « Où »).

## Verdict

Le front preview est fonctionnellement sain et visuellement validé, mais son **architecture interne n'honore pas encore la promesse centrale de la phase (CLAUDE.md §0 : « brancher Supabase sans réécrire l'UI »)**. Trois failles structurelles dominent : (1) la **machine à états ContentStatus — LA règle métier du produit — est dupliquée en 12+ tableaux locaux avec des divergences déjà visibles à l'écran** (kanban vs actions de lot, page détail vs route /edit) ; (2) le **shell entier (sidebar, palette, notifications, quick-capture) consomme la façade mocks de façon synchrone dans des composants client**, ce qui rend la conversion vers des requêtes Supabase async impossible sans restructurer ~9 composants montés sur toutes les pages ; (3) les **types domaine et la méta UI vivent sous `lib/mocks/` et embarquent des artefacts démo (`L<string>`, `IMAGES`, `MessageKey`)**, soudant 151 fichiers à un namespace destiné à disparaître et bloquant la future migration vers `packages/shared`. Risque principal pour la mise en prod : un câblage backend qui se transforme en réécriture sous pression, avec des règles de statut qui divergent entre UI, Server Actions et worker. La bonne nouvelle : tout est corrigeable par extractions mécaniques (codemods + modules partagés) AVANT le câblage, pendant que le repo est encore petit.

## Fonctionnement reel observe

**Flux de données nominal (le bon pattern).** Les 23 pages sont des `async` Server Components qui appellent la façade `apps/web/lib/mocks/index.ts` (getters `getClients`, `getContentItems`, `getSocialAccounts`… lignes 40-110) puis passent les données aux composants racine de zone (`editorial-calendar`, `content-board`, `feed-grid`, `perf-workspace`…). Deux pages (performance, report) délèguent même l'assemblage du view-model à des modules dédiés (`components/app/performance/perf-data.ts`, `report-data.ts`) — c'est le pattern cible.

**Flux de données réel (les fuites).** Ce schéma est contourné à trois niveaux :
- **Shell client auto-fetch** : `app/(app)/layout.tsx:28-47` rend `AppSidebar`, `CommandPalette`, `QuickCapture`, `NotificationsButton` sans aucune prop ; ces composants `"use client"` importent et appellent la façade en plein rendu (`app-sidebar.tsx:39`, `command-palette.tsx:55`, `quick-capture.tsx:37`, `notifications-button.tsx:17-18`, `client-switcher.tsx:71`, `client-health-banner.tsx:23`, `nav-user.tsx:26`, `shell/client-nav.ts:34-35`). Tout le jeu de démo part dans le bundle navigateur.
- **Constantes brutes** : `agenda/page.tsx:15-17`, `dashboard/page.tsx:28-29`, `settings/accounts/page.tsx:33-34` importent `CURRENT_USER`/`CALENDAR_ACCOUNTS` comme constantes module-level ; `composer/schedule-dialog.tsx:21` contourne même la façade en important `@/lib/mocks/clients` directement.
- **Logique dans les routes** : `grid/page.tsx:31-134` embarque ~110 lignes de mapping domaine→viewmodel inline, à rebours du pattern perf-data/report-data.

**État local par zone.** Chaque grande zone maintient son propre magasin de mutations : `studio/board-state.ts:64-66` (Records d'overrides statut/label/schedule), `calendar/use-calendar-state.ts:69-79` (Map d'overrides scheduledAt), `grid/use-grid-tiles.ts:38-57` (view-model `GridTileData` complet avec commit/undo/baseline). Les mêmes opérations produit (reprogrammer, annuler, envoyer en validation, retry) existent donc en 3 sémantiques.

**Types et vocabulaire domaine.** `lib/mocks/types/core.ts` (miroir déclaré du PRD §6) et `lib/mocks/labels.ts` (méta statuts/plateformes/tones) sont consommés par 151 et 22 fichiers respectivement — y compris `lib/i18n/labels.ts` et tout `components/shared`. Les champs texte métier sont typés `L<string>` (objet `{fr,en}` de démo, `core.ts:9` importe `@/lib/i18n/localized`), résolus par `pick()` dans 144 call-sites de 70 fichiers.

**i18n.** Système maison par zones de dictionnaires (`lib/i18n/dictionaries/zones/*`), translator typé `MessageKey`, `useFormat()/getFormat()` lié à la locale active. Deux fuites : les fonctions libres de `lib/format.ts` gardent `DEFAULT_LOCALE` (fr) en défaut, et `grid/use-grid-tiles.ts` contourne entièrement le système (~18 littéraux FR).

**Temps et fuseaux.** `lib/tz.ts` ne contient que `zonedWallToUtcIso` ; la décomposition inverse (instant → heure murale) est réimplémentée 5 fois (`composer-utils.ts:46`, `agenda-utils.ts:36`, `calendar-utils.ts:21`, `grid-date-utils.ts:13`, `calendar-schedule.ts:49` — cette dernière par parsing de chaîne formatée).

## Findings (tries par severite P0 -> P3)

Aucun P0 (pas de fuite de données réelles ni de casse runtime en production — nous sommes en preview mockée).

---

### [P1] Machine à états ContentStatus dupliquée en 4 endroits avec des règles DIVERGENTES pour la même transition
- **Où** : `components/app/studio/board-utils.ts:173`, `components/app/studio/board-kanban.tsx:32`, `components/app/studio/board-types.ts:137`, `components/app/calendar/calendar-schedule.ts:12`
- **Constat** : les transitions autorisées du cycle de vie (PRD §5.B) sont encodées 4 fois : board-utils `REVIEWABLE=[draft,changes_requested]` / `SCHEDULABLE=[idea,draft,approved]` / `LOCKED` ; board-kanban `TO_REVIEW_FROM=[idea,draft,changes_requested,approved]` et `TO_SCHEDULED_FROM=[...,failed]` ; board-types `KANBAN_LOCKED` ; calendar-schedule `LOCKED_STATUSES=[...,failed,canceled]`. Divergences réelles : envoyer en validation depuis `idea`/`approved` passe en drag kanban mais est refusé en action de lot ; programmer un `failed` passe en kanban et en grille mais pas en lot ; `failed` est verrouillé au calendrier mais mobile ailleurs. Deux des fichiers citent le même PRD §5.B en encodant des règles différentes.
- **Scénario d'échec / coût à l'échelle** : un utilisateur sélectionne 3 idées → « Envoyer en validation » répond « aucun contenu éligible » ; il glisse la même idée dans la colonne kanban → succès. Même produit, deux réponses. Au câblage, ces listes deviennent les gardes des Server Actions et du worker : chaque zone enverra sa propre règle.
- **Pourquoi ça bloque le scaling** : la machine à états est LA règle métier centrale (statuts agrégés `partially_published`, verrous worker) et doit vivre dans `packages/shared` pour être partagée web/worker/DB. Toute évolution de statut (ex. `pushed_to_platform` TikTok) devra être reportée dans 4+ fichiers.
- **Reco** : module unique de transitions (destiné à `packages/shared`) : `canTransition(from, to)` + dérivés nommés (`isMovable`, `canSendReview`, `canSchedule`, `isLocked`). Faire converger les 4 fichiers dessus, en faisant **arbitrer par Étienne les divergences actuelles** (failed reprogrammable ? idea → in_review ?) avant unification.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non (unification à arbitrer explicitement)   **Verrou PRD/CLAUDE.md** : PRD §5.B + CLAUDE.md §6 (enforcement DB/worker, jamais uniquement UI)

### [P1] Règle d'éditabilité PRD §5.B dupliquée en 5 endroits, avec divergence réelle entre page détail et route /edit
- **Où** : `app/(app)/clients/[clientId]/content/[contentId]/edit/page.tsx:30` (doublons : `content/[contentId]/page.tsx:40`, `components/app/studio/content-actions.tsx:15`, `board-utils.ts:175`, `board-types.ts:137`)
- **Constat** : `READ_ONLY = ["publishing","published","partially_published"]` est redéclaré 5 fois. La règle diverge déjà : la page détail calcule `canEdit = !READ_ONLY && status !== "in_review"` (page.tsx:75) alors que la route edit ne bloque que READ_ONLY (edit/page.tsx:42) — un contenu `in_review` est éditable en accédant directement à l'URL `/edit` alors que le bouton Éditer est masqué sur le détail.
- **Scénario d'échec / coût à l'échelle** : un contenu envoyé en validation client est modifié via l'URL /edit pendant que le reviewer le valide : la version approuvée ne correspond plus au contenu. Au câblage, si la Server Action de sauvegarde reprend la liste de la route edit et pas celle du détail, l'incohérence devient une écriture réelle en base.
- **Pourquoi ça bloque le scaling** : c'est LA règle qui devra être enforced côté Server Action + RLS au Lot 1-2 ; 5 copies déjà divergentes garantissent que la version serveur ne matchera pas toutes les versions UI.
- **Reco** : `lib/content/editability.ts` (futur `packages/shared`) exposant `isPublishLocked(status)` et `canEdit(content)` ; remplacer les 5 déclarations ; faire arbitrer la divergence `in_review` par Étienne (le détail fait foi a priori) et aligner la route edit.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : oui (alignement de la route /edit)   **Verrou PRD/CLAUDE.md** : PRD §5.B ; CLAUDE.md §7

### [P1] Groupes de statuts (pré-publication, visible reviewer, lecture seule, buckets grille…) redéfinis en 12+ tableaux locaux, dont `deriveStatus` enfoui dans les données démo
- **Où** : `lib/mocks/content.ts:25-34` et `:82-92` (`deriveStatus`) ; `lib/mocks/index.ts:112,137-144` ; `lib/mocks/metrics.ts:8` ; `app/(app)/clients/[clientId]/grid/page.tsx:31-41` (PLANNED/PUBLISHED/SHELF) ; `app/(portal)/portal/page.tsx:15` (TO_REVIEW) ; `app/(app)/clients/page.tsx:17-26` (littéraux) ; `calendar-schedule.ts:12`, `calendar-insights.ts:11` ; + READ_ONLY ×3 (finding précédent). *(Fusion de 2 findings vérifiés : mocks + pages.)*
- **Constat** : les sous-ensembles sémantiques de ContentStatus/TargetStatus sont déclarés comme tableaux locaux dans les mocks ET re-déclarés indépendamment dans les pages et composants. `deriveStatus` (agrégation targets → statut global, `partially_published` inclus — exactement la logique que le worker devra implémenter, CLAUDE.md §5) vit dans un fichier de génération de données démo. `labels.ts` centralise les méta mais pas les groupes. Le prédicat `platform === "instagram"` est lui aussi dupliqué (calendar/page.tsx:34, grid/page.tsx:178, +10 fichiers).
- **Scénario d'échec / coût à l'échelle** : l'ajout d'un statut (le PRD §6 en définit 11 pour ContentItem ; `dead_letter` n'est traité nulle part) exige de retrouver ~12 tableaux épars ; un oubli rend un contenu invisible dans une vue — exactement la classe de bug P0 déjà corrigée une fois (commentaire `grid/page.tsx:29-30`). TS ne vérifie pas l'exhaustivité d'appartenance à un tableau.
- **Pourquoi ça bloque le scaling** : sans taxonomie unique, la règle vivra en 3 exemplaires divergents (mock, web, worker). Les groupes de statuts sont du domaine, pas de la donnée démo.
- **Reco** : créer `lib/content-status.ts` (futur `packages/shared`) : groupes nommés exportés (`PREPUBLISH_STATUSES`, `READ_ONLY_STATUSES`, `REVIEWER_VISIBLE_STATUSES`, `STATUS_GROUPS.{shelf,plannedVisible,publishedLike}`…), prédicats (`isReadOnly`, `isLocked`, `isAwaitingReview`), `deriveContentStatus(targets)` et `findIgAccount(accounts)`. Mocks, pages et composants consomment ce module, jamais de littéraux.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §5.B/§6 + CLAUDE.md §5 (statut global agrégé)

### [P1] Le shell entier auto-fetch la façade mocks de façon SYNCHRONE dans des composants client — point de blocage direct du câblage Supabase
- **Où** : `app/(app)/layout.tsx:28-47` (rendu sans props) ; consommateurs `"use client"` : `app-sidebar.tsx:39`, `client-switcher.tsx:71`, `shell/command-palette.tsx:55`, `shell/quick-capture.tsx:37`, `shell/client-health-banner.tsx:23` (monté par `clients/[clientId]/layout.tsx:64`), `notifications-button.tsx:17-18`, `nav-user.tsx:26`, `composer/schedule-dialog.tsx:21` (importe `@/lib/mocks/clients` directement), `shell/client-nav.ts:34-35` ; getters sync : `lib/mocks/index.ts:40-110`. *(Fusion de 3 findings vérifiés convergents : shell/composants, façade sync, layout sans props.)*
- **Constat** : la façade est bien le seam prévu pour Supabase, mais elle est consommée dans la MAUVAISE couche : appels synchrones (`getClients()`, `getContentItems()`, `getNotifications()`, lecture de `CURRENT_USER`) exécutés dans le bundle navigateur, au rendu. `quick-capture.tsx:38` initialise même un `useState` depuis les données fetchées. Aucun garde `server-only` sur le module de données. Conséquence annexe : tout le jeu de démo (tous clients, tous contenus) est lisible dans le JS de n'importe quelle page.
- **Scénario d'échec / coût à l'échelle** : au câblage, `getClients()` devient une requête Postgres RLS asynchrone scopée org_id : impossible à appeler synchroniquement dans un composant client. Les ~9 composants du shell — montés sur TOUTES les pages — doivent être restructurés (props serveur ou TanStack Query + états de chargement), c'est-à-dire exactement la réécriture que la phase preview promettait d'éviter. Tant que le shell tire lui-même ses données, aucune page ne peut migrer au backend indépendamment.
- **Pourquoi ça bloque le scaling** : la façade n'est un seam que si elle n'est consommée que côté serveur ; le pattern se propage à chaque nouveau composant de shell. La defense in depth (filtre org_id explicite serveur, règle 7) est inapplicable dans cette couche.
- **Reco** : (1) déplacer la résolution de données dans les layouts/pages serveur et passer clients/notifications/comptes/viewer en props sérialisées ; (2) marquer le module de données `server-only` et exposer un entrypoint client-safe séparé (types + labels/méta uniquement) ; (3) pour les données vivantes (badge notifications), poser dès maintenant le hook TanStack Query avec fetcher stub sur les mocks ; (4) `CURRENT_USER` devient une prop viewer/session injectée par le layout. Zéro changement visuel.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (brancher sans réécrire) + règles 7, 10, 26 + §1 (TanStack Query)

### [P1] Le type `L<string>` (bilingue démo) est cuit dans les types miroir de la future DB
- **Où** : `lib/mocks/types/core.ts:76` (Client.bio), `:141` (captionOverride), `:147-148` (ContentItem.title/caption) + ~12 autres champs dans core.ts et 17 dans collab.ts/pro.ts/library.ts ; `core.ts:9` importe `@/lib/i18n/localized` ; `pick()` = 144 call-sites dans 70 fichiers
- **Constat** : les types annoncés « miroir simplifié du modèle PRD §6 » portent des champs métier en `L<string>` (`{fr,en}`) : title, caption, bio, notes, lastError, altText, labels… Toute l'UI les résout via `pick(field, locale)`. Or la DB réelle stockera des `string` simples — le contenu d'un client n'est pas bilingue, le bilinguisme est un artefact de la démo.
- **Scénario d'échec / coût à l'échelle** : au câblage, chaque champ texte revenant de la DB est un `string` : soit on réécrit les 144 `pick()`, soit on fabrique des `L<string>` factices dans le mapper (et les formulaires du composer émettent des `L<string>` que les Server Actions doivent déballer) — les deux contredisent la promesse « brancher sans réécrire ».
- **Pourquoi ça bloque le scaling** : c'est LE contrat de données qui sépare la preview du backend. Tant que `L<string>` fuit au-delà de la façade, les types ne peuvent pas migrer vers `packages/shared` (dépendance à `lib/i18n` du web) et `generate_typescript_types` Supabase ne pourra jamais s'aligner dessus.
- **Reco** : déplacer la résolution de locale à la frontière : les getters de la façade prennent la locale et retournent des objets domaine en `string` simple (types domaine = string ; types démo internes = `L<string>`). L'UI ne voit plus jamais `L` ni `pick` pour le contenu ; les types domaine deviennent portables tels quels.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (mocks = mêmes types que la future DB)

### [P1] Types domaine et méta UI logés sous `lib/mocks/` — 151 fichiers couplés à un namespace destiné à disparaître
- **Où** : `components/shared/status-badge.tsx:5-18` (idem status-dot, platform-badge, format-icon, account-alert, quota-gauge, client-avatar, media-thumb) ; définitions dans `lib/mocks/labels.ts` et `lib/mocks/types/` ; mesure repo : 151 fichiers importent `@/lib/mocks/types`, 22 importent `@/lib/mocks/labels` ; `lib/i18n/labels.ts` (module permanent) dépend aussi de lib/mocks
- **Constat** : `labels.ts` (contentStatusMeta, targetStatusMeta, toneDotClass, platformMeta, API_PLATFORMS) et `types/` (enums Platform, ContentStatus, TargetStatus miroir PRD §6) ne sont PAS des données mockées : c'est le vocabulaire domaine permanent + la méta de présentation, noyés dans le même dossier que les ~18 fichiers de données jetables.
- **Scénario d'échec / coût à l'échelle** : l'étape naturelle « supprimer/remplacer lib/mocks » au câblage casse la compilation de 150+ fichiers dont tout le layer shared et le module i18n. Risque élevé de garder `lib/mocks` en prod pour toujours, ou de faire un rename massif sous pression.
- **Pourquoi ça bloque le scaling** : CLAUDE.md §4 impose `packages/shared` comme foyer des types partagés web/worker ; le futur `apps/worker` ne peut pas consommer des enums logés sous `apps/web/lib/mocks` sans dépendre de l'app web. Le codemod est mécanique aujourd'hui, coûteux demain.
- **Reco** : extraire `lib/mocks/types/` et `lib/mocks/labels.ts` vers un module neutre (`apps/web/lib/domain/`, futur `packages/shared`) ; `lib/mocks` ré-exporte pendant la transition ; codemod des imports. Résultat : lib/mocks ne contient plus QUE les données jetables + la façade.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (divergence packages/shared déjà actée à auditer) + §4

---

### [P2] Trois systèmes parallèles d'overrides locaux réimplémentent les mêmes mutations métier sans couche commune
- **Où** : `components/app/studio/board-state.ts:64-66`, `components/app/calendar/use-calendar-state.ts:69-79`, `components/app/grid/use-grid-tiles.ts:38-57`
- **Constat** : le board (Records statusOverrides/labelOverrides/scheduleOverrides), le calendrier (Map d'overrides scheduledAt) et la grille (état GridTileData complet avec commit/undo/baseline, dates fabriquées localement type `retryDate`) implémentent chacun leur magasin de mutations pour les MÊMES opérations : reprogrammer, annuler, envoyer en validation, retry, programmer en lot. Aucune abstraction de mutation partagée.
- **Scénario d'échec / coût à l'échelle** : au câblage, « reprogrammer un contenu » doit devenir UNE Server Action Zod-validée + invalidation TanStack Query ; ici elle sera recâblée 3 fois avec 3 sémantiques d'optimistic update. Oubli d'une zone = le calendrier montre une date que le studio ne connaît pas.
- **Pourquoi ça bloque le scaling** : chaque nouvelle surface (dashboard actions, portail, PWA offline) ajoutera un 4e/5e store divergent ; la convergence TanStack Query exige un point d'entrée unique par mutation.
- **Reco** : extraire une couche `content-mutations` (ex. `lib/actions/content.ts`, futures Server Actions) exposant reschedule/cancel/sendReview/retry/scheduleBatch avec signature unique. En phase mock : un store partagé unique ; au câblage : seule cette couche devient TanStack Query + Server Actions. Les hooks de zone ne gardent que l'état de VUE.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query) + §7 (workflow Server Actions)

### [P2] Cinq implémentations parallèles de la décomposition heure-murale/fuseau, dont une par parsing de chaîne formatée, + deux `zonedToUtcIso` homonymes
- **Où** : `composer/composer-utils.ts:46` (wallClockIn, en-US), `agenda/agenda-utils.ts:36` (zonedParts, fr-CA), `calendar/calendar-utils.ts:21` (dayKeyOf, fr-CA), `grid/grid-date-utils.ts:13` (localHour, parse fr-FR), `calendar/calendar-schedule.ts:49` (wallTimeOf, fr-FR + `.replace("h", ":")`) ; homonymes : `composer-utils.ts:24` vs `calendar-schedule.ts:42` ; imports trans-module : `board-kanban.tsx:21`, `board-schedule-dialog.tsx:26`, `content/new/page.tsx:8`
- **Constat** : `lib/tz.ts` ne contient que `zonedWallToUtcIso` (avec l'avertissement « toute divergence ici = décalage horaire silencieux ») ; la décomposition inverse est réimplémentée 5 fois avec des locales et mécanismes différents, dont un parsing de chaîne formatée fragile.
- **Scénario d'échec / coût à l'échelle** : une correction DST appliquée à une variante ne profite pas aux autres : un post programmé 09:00 heure client peut s'afficher différemment entre vues autour d'une bascule d'heure d'été. Les 5 variantes sont cohérentes aujourd'hui — la divergence est latente, pas actuelle.
- **Pourquoi ça bloque le scaling** : le produit repose entièrement sur « TZ du client pour le contenu, TZ du freelance pour l'agenda, stockage UTC » (CLAUDE.md §12) ; le worker devra faire exactement ces conversions côté serveur — primitive unique et testable attendue dans `packages/shared`.
- **Reco** : étendre `lib/tz.ts` avec `wallClockIn(iso, tz)`, `dayKeyOf(iso, tz)`, `wallTimeOf(iso, tz)` sur `formatToParts` (jamais de parsing de chaîne formatée) ; migrer les 5 variantes ; supprimer l'import studio→composer-utils au profit de lib/tz ; renommer l'un des deux `zonedToUtcIso`.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 + en-tête de lib/tz.ts

### [P2] `use-grid-tiles.ts` contourne entièrement le système i18n : ~18 chaînes FR en dur, pluralisation maison, dates sans locale
- **Où** : `components/app/grid/use-grid-tiles.ts:64-67, 75, 79-81, 91-93, 110-112, 123-125, 150-152, 160-163, 176, 192-206` ; `plural()` ligne 30 ; `formatDateTime` sans locale lignes 66, 91, 150, 176
- **Constat** : tous les toasts de la grille planifiée sont des littéraux français ; c'est le seul fichier du périmètre dans ce cas — tout le reste passe par `t()`/`useFormat` (référence : `calendar-actions.ts` injecte le Translator).
- **Scénario d'échec / coût à l'échelle** : en locale EN, chaque drag/permutation/insertion dans la grille affiche des toasts FR avec dates au format FR — régression fonctionnelle du chantier bilingue livré.
- **Pourquoi ça bloque le scaling** : chaque chaîne en dur est une clé i18n manquante ; `plural()` maison ne survivra pas à l'anglais.
- **Reco** : migrer les 18 chaînes vers le dictionnaire `grid.*` avec interpolation `{count}`, injecter t/f dans `useGridTiles` comme `calendar-actions.ts`, remplacer `formatDateTime(iso, tz)` par `f.dateTime(iso, tz)`.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui (toasts EN corrects)   **Verrou PRD/CLAUDE.md** : chantier i18n feat/i18n-fr-en
- **Effort** : S   **Impact scaling** : moyen

### [P2] Double API de formatage de dates : `lib/format` avec locale FR par défaut, utilisée sans locale dans 6 fichiers calendrier
- **Où** : `lib/format.ts:15` (défaut `DEFAULT_LOCALE`) ; call-sites sans locale : `calendar/content-quick-view.tsx:64`, `day-sheet-row.tsx:56`, `week-view.tsx:200`, `day-entry.tsx:21`, `export-dialog.tsx:148`, `calendar-dnd.tsx:100`
- **Constat** : deux voies coexistent : fonctions libres avec défaut fr vs `useFormat()/getFormat()` lié à la locale active. 4 des 6 composants fautifs ont déjà la locale en scope et ne la passent pas — le défaut fr masque l'oubli au lieu de le faire échouer à la compilation. Le commit b64b959 montre que cette classe de bug a déjà été chassée une fois.
- **Scénario d'échec / coût à l'échelle** : en EN, la fiche express du calendrier affiche « mer. 17 juin · 09:00 » pendant que la carte studio du même contenu affiche « Wed, Jun 17 · 9:00 AM ». Tout nouveau composant a 50 % de chances de prendre la mauvaise API.
- **Reco** : rendre la locale OBLIGATOIRE dans `lib/format.ts` (TS force chaque call-site à choisir) et migrer les 6 call-sites vers `useFormat`/le Format en scope ; `lib/format` devient le moteur interne de format-bound uniquement.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui (dates EN correctes)   **Verrou PRD/CLAUDE.md** : chantier i18n FR/EN

### [P2] Constantes de règles produit dupliquées : lead time 15 min, fenêtre 9h-21h, « demain 9h » recodés par zone
- **Où** : `composer/composer-utils.ts:11` + `grid/grid-date-utils.ts:9` (MIN_LEAD_MS ×2) ; `grid-date-utils.ts:10-11` + `calendar-schedule.ts:61-62` (fenêtre 9h-21h ×2) ; « demain 9h » : `composer-utils.ts:107-113`, `board-kanban.tsx:116-119`, `board-schedule-dialog.tsx:61-67`
- **Constat** : trois règles produit numériques recodées indépendamment, sans module partagé (grep négatif). Le preflight gate sur une copie, la grille génère avec l'autre.
- **Scénario d'échec / coût à l'échelle** : décision « lead time 30 min » ou « fenêtre 8h-22h » = 3-5 sites non reliés à retrouver ; un oubli et le calendrier propose des créneaux que le composer refuse au preflight.
- **Pourquoi ça bloque le scaling** : ces valeurs seront enforced côté worker/DB (garde-fou, fenêtre de grâce 2h) ; la source unique prévue est `packages/shared` — les dupliquer dans l'UI garantit une divergence UI/worker.
- **Reco** : module `scheduling` partagé : `MIN_LEAD_MS`, `SCHEDULING_WINDOW = {startHour: 9, endHour: 21}`, `defaultNextSlot(tz)` ; consommé par composer, grille, calendrier, board.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §5.B (>= now + 15 min) + CLAUDE.md §5 (fenêtre de grâce 2h)

### [P2] `MemberRole` fusionne les deux tables d'appartenance en un seul enum divergent du PRD
- **Où** : `lib/mocks/types/core.ts:47` + `types/collab.ts:39` (Comment.role) ; branches UI : `annotation-viewer.tsx:135`, `detail-thread.tsx:42/55/118`, `detail-thread-items.tsx:30`
- **Constat** : `MemberRole = "owner" | "reviewer"` écrase 4 rôles sur 2 tables (organization_members owner|admin ; client_members reviewer|editor) en 2 valeurs sur 1 enum ; `Comment.role` s'appuie dessus pour distinguer agence/client.
- **Scénario d'échec / coût à l'échelle** : au câblage, un commentaire posté par un `editor` ou un `admin` ne rentre dans aucune valeur : retypage de Comment + ré-audit de chaque branche `role === "reviewer"`.
- **Reco** : scinder `OrgRole = "owner"|"admin"` et `ClientRole = "reviewer"|"editor"` ; typer l'auteur d'un Comment par un discriminant `side: "agency"|"client"`. Aucun rendu ne change.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règle 4

### [P2] `getDashboardTasks` : view-model UI (i18n, routes, tones) construit dans la couche données
- **Où** : `lib/mocks/index.ts:156-234` + `types/core.ts:212-228` (DashboardTask)
- **Constat** : la façade de données prend un Translator + Locale, résout les titres via `pick()`, compose des detail strings « · », assigne tones et hrefs. `DashboardTask` (strings pré-résolus) vit au milieu des types miroir DB alors qu'il n'existe pas au PRD §6. Seul endroit où la couche mock dépend du système i18n de rendu.
- **Scénario d'échec / coût à l'échelle** : `getDashboardTasks` n'a aucun équivalent requête au câblage — c'est une dérivation métier+présentation, à déplacer en urgence ou à ré-implémenter dans la couche d'accès données.
- **Reco** : extraire `buildDashboardTasks(contentItems, socialAccounts, t, locale)` vers `lib/dashboard/tasks.ts` ; déplacer DashboardTask hors de types/core.ts ; la façade ne connaît plus Translator ni routes.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Types domaine pollués par des dépendances démo/web (IMAGES, MessageKey)
- **Où** : `lib/mocks/types/core.ts:74` (`Client.theme: keyof typeof import("../images").IMAGES`) ; `types/pro.ts:78` (`QuotaUsage.windowKey: import("@/lib/i18n").MessageKey`)
- **Constat** : le type Client (miroir de la table clients) porte un champ typé sur le pool d'images Pexels de démo ; QuotaUsage embarque une clé de dictionnaire i18n web. Deux imports inline qui soudent les types « partageables » à des artefacts démo/front.
- **Scénario d'échec / coût à l'échelle** : impossible de déplacer `types/` vers `packages/shared` sans embarquer images.ts et tout lib/i18n — le worker importerait des URLs Pexels et des clés de traduction UI.
- **Reco** : sortir `theme` du type Client (map démo-only `DEMO_THEMES` côté mocks ou type `DemoClient = Client & {theme}`) ; remplacer `windowKey` par un discriminant domaine (`window: "24h" | "24h_reels" | "24h_drafts"`) traduit côté UI.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0/§4

### [P2] Labels sans identité stable : filtres de vues enregistrées comparés à la valeur localisée
- **Où** : `types/core.ts:176` (`labels?: L<string>[]`), `types/pro.ts:60`, `views.ts:33-35` (`["Lancement","Promo"]` en dur), match : `board-utils.ts:44` (`pick(l, locale)`)
- **Constat** : les étiquettes n'ont pas d'id/slug ; les vues enregistrées stockent des valeurs françaises et le filtre compare au label résolu. `ct_cl_nove_1` porte `loc("Lancement","Launch")` : en EN, la vue « Drops & promos » ne matche plus — le même filtre enregistré retourne des résultats différents selon la langue (bug actif dans la démo EN).
- **Scénario d'échec / coût à l'échelle** : au câblage les labels deviendront des lignes DB (id + libellé) : tout le filtrage par valeur affichée est à rejeter, y compris les SavedViewFilters persistés ; le renommage d'une étiquette casserait toutes les vues.
- **Reco** : identité stable : `{ slug: string; name: L<string> }`, SavedViewFilters référence les slugs, match sur slug, affichage sur name. Corrige au passage l'incohérence FR/EN.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : oui (vue EN à nouveau complète)   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Résolution du libellé plateforme dupliquée et déjà divergente : PlatformIcon/PlatformBadge rendent « — » pour `custom`
- **Où** : `components/shared/platform-badge.tsx:23-24, 56-57` (lecture brute `platformMeta[platform].label`) vs résolveur canonique `lib/i18n/labels.ts:37` ; placeholder `lib/mocks/labels.ts:99` (`custom: { label: "—" }`)
- **Constat** : deux chemins de résolution coexistent ; `FormatIcon` (même dossier shared) suit le bon pattern `useLabels`. Les cibles `platform="custom"` existent (content.ts:99) et atteignent PlatformIcon via today-panel:92, day-sheet-row:59, content-quick-view:85, detail-manual-center:105 → aria-label « — » annoncé au lecteur d'écran dès aujourd'hui ; PlatformBadge n'échappe au « — » visible que parce que son unique consommateur filtre sur IG/FB/TikTok.
- **Scénario d'échec / coût à l'échelle** : chaque nouveau consommateur doit deviner le bon chemin ; toute nouvelle plateforme (LinkedIn…) exige de synchroniser deux sources.
- **Reco** : supprimer le double chemin : PlatformIcon/PlatformBadge résolvent via `useLabels().platform` (comme FormatIcon) ou acceptent un label pré-résolu en prop ; `platformMeta` ne garde que colorVar/short.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui (a11y « Sur mesure »/« Custom » au lieu de « — »)   **Verrou PRD/CLAUDE.md** : chantier i18n
- **Effort** : S   **Impact scaling** : moyen

### [P2] Contexte Reviewer du portail codé en dur via `DEMO_REVIEWER_CLIENT_ID` dans 4 fichiers au lieu d'un seam unique
- **Où** : `(portal)/layout.tsx:11-12`, `portal/page.tsx:19-20`, `portal/[contentId]/page.tsx:40` (garde d'accès), `onboarding/wizard-shell.tsx:103` ; + défaut caché `lib/mocks/index.ts:146`
- **Constat** : le scoping tenant du portail est réimplémenté inline dans chaque route ; il n'existe aucun équivalent preview du futur `getReviewerContext()` (miroir de `getActiveOrg` de CLAUDE.md §3).
- **Scénario d'échec / coût à l'échelle** : au câblage auth, le remplacement par la résolution `client_members` doit être fait à 4+ endroits ; en oublier un érode la defense in depth sur la garde d'accès du portail — la zone la plus sensible RGPD du produit (RLS restera la défense primaire).
- **Reco** : créer `lib/auth/reviewer-context.ts` (version preview) exposant `getReviewerContext(): { client, reviewer, canAccessContent(contentId) }` — aujourd'hui sur la constante démo, demain sur `client_members`. Les routes portail et wizard-shell consomment ce seam ; la constante n'est plus exportée hors de lib/mocks.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règle 6 + §3

### [P2] Zéro `error.tsx` / `loading.tsx` / `not-found.tsx` dans tout app/ — aucun filet pour le passage aux fetchs réels
- **Où** : `app/` entier (glob = 0 fichier) ; `notFound()` appelé dans 14+ pages dont `(portal)/portal/[contentId]/page.tsx:40`
- **Constat** : aucune boundary d'erreur, aucun fallback de streaming, 404 par défaut de Next non brandé — y compris sur le portail vu par les clients finaux des freelances, dès aujourd'hui.
- **Scénario d'échec / coût à l'échelle** : dès que les getters deviennent des requêtes Supabase, la moindre erreur réseau/RLS affiche l'écran d'erreur brut de Next en prod (digest illisible), et chaque navigation bloque sans feedback pendant la latence DB.
- **Reco** : ajouter par groupe de routes : `error.tsx` (+ hook Sentry à terme), `not-found.tsx` brandé (surtout (portal)), `loading.tsx`/Suspense ciblés sur grid, calendar, content. Purement additif.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : Sentry imposé par la stack §1

### [P2] La page grid embarque ~110 lignes de mapping domaine→viewmodel inline, à rebours du pattern perf-data/report-data
- **Où** : `app/(app)/clients/[clientId]/grid/page.tsx:31-134` (+ construction InstagramProfileData lignes 186-205 ; fichier à 225 lignes)
- **Constat** : `inFeed`, `toContentTile`, `toImportedTile`, `metricsOf`, 3 listes de statuts et l'assemblage du profil vivent dans le fichier de route, alors que performance et report délèguent le même travail à des modules `*-data.ts` appelés depuis des pages de ~30 lignes. Helpers non exportés = non testables.
- **Scénario d'échec / coût à l'échelle** : le contrat `GridTileData` (consommé par toute la feature grid) n'est ni testable ni réutilisable ; la page franchira la limite 250 lignes à la prochaine évolution ; au câblage, requête + mapping devront être démêlés du JSX de route. Deux conventions coexistantes = chaque nouvel écran choisit au hasard.
- **Reco** : extraire `components/app/grid/grid-data.ts` (module serveur) : `buildGridData(clientId, { t, f, locale })` → `{ profile, pinned, scheduled, published, imported, shelf, quota, pillars }`. La page tombe à ~30 lignes.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md règle 24 (page à 225/250 lignes)

### [P2] Pages serveur câblées sur les constantes brutes `CURRENT_USER` / `CALENDAR_ACCOUNTS` — le futur point d'entrée session n'existe pas
- **Où** : `agenda/page.tsx:15-17`, `dashboard/page.tsx:28-29`, `settings/accounts/page.tsx:33-34` ; ré-export brut `lib/mocks/index.ts:35` ; contournement direct `composer/schedule-dialog.tsx:21` ; aussi côté client : `nav-user.tsx:26`, `today-panel.tsx:9`
- **Constat** : ni `getCurrentUser()` ni `getCalendarAccounts()` n'existent ; l'utilisateur courant est importé comme constante module-level dans des pages ET des composants client.
- **Scénario d'échec / coût à l'échelle** : `CURRENT_USER` deviendra « session Supabase + profile + timezone » — une valeur async par requête, inexprimable en constante. Chaque site d'import devra être chassé au grep pendant le câblage auth, le chantier le plus sensible du Lot 0.
- **Reco** : ajouter `getCurrentUser()` / `getCalendarAccounts()` à la façade (miroir du `getActiveOrg()` avec `cache()` de CLAUDE.md §3), migrer les 6+ sites, cesser d'exporter les constantes brutes ; interdire l'import de `@/lib/mocks/clients` hors façade.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §3 (pattern getActiveOrg)

---

### [P3] Modèle de filtres ContentItem et `matchesFilters` dupliqués en trois variantes (board, calendrier, grille)
- **Où** : `studio/board-utils.ts:36-48`, `calendar/calendar-types.ts:54-64` (quasi-verbatim, drift déjà amorcé sur le cas pilier null), `grid/use-grid-view.ts:17-18` (variante Set) ; + 2 `EMPTY_FILTERS` (board-types.ts:24, calendar-types.ts:38) et 2 `toggleValue` identiques (board-filters.tsx:21-23, calendar-filters.tsx:25-27)
- **Constat** : le prédicat de filtrage (statuts, formats, plateformes, piliers) est écrit trois fois ; ajouter un critère impose 3 modifications synchrones.
- **Scénario d'échec / coût à l'échelle** : un oubli donne un calendrier qui filtre différemment du studio sur le même client ; au câblage, trois traductions WHERE au lieu d'une (nuance : la grille peut rester un filtrage client sur données fusionnées).
- **Reco** : type `ContentFilter` unique + `matchesContentFilter(item, filter, locale)` dans `lib/content-filter.ts` (futur packages/shared) ; déduper `toggleValue` dans lib/utils.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Cinq systèmes de libellés de jours de semaine, dont un tableau FR hardcodé et mort
- **Où** : `calendar/calendar-utils.ts:134` (WEEKDAY_LABELS FR, 0 import = mort), `calendar/month-grid.tsx:15-23` + `export-dialog.tsx:22-30` (WEEKDAY_KEYS dupliqué verbatim), `agenda/agenda-utils.ts:13-21` (`agenda.weekday.*`), `client-settings/constants.ts:47-54` (`clientSettings.weekday.*`), `onboarding/wizard-types.ts:171-205` (`onboarding.weekday.*`)
- **Constat** : 4 namespaces i18n parallèles + 1 tableau FR mort — piège de copie pour un futur dev.
- **Reco** : supprimer WEEKDAY_LABELS mort ; mutualiser un `common.weekday.*` unique + un `WEEKDAY_KEYS` exporté une seule fois.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Micro-duplications de rendu : chip d'étiquette (×2 verbatim), pastille colorée (~13 occurrences), mapping tone→classe redondant
- **Où** : `studio/content-card.tsx:172-182` vs `board-kanban-card.tsx:68-78` (chip) ; pastille colorVar : calendar-filters:142, content-quick-view:72, pillar-mix-panel:28, quick-view-body:129, board-filters:137, grid-toolbar:171, composer-basics:125, perf-pillar-split:51, report-highlights:85, pillar-editor:108, board-idea-bank:193, event-block:33, today-panel:67 ; `dashboard/task-list.tsx:30-36` (TONE_CLASS ré-encode `toneTextClass` de labels.ts:115)
- **Constat** : motifs de rendu dupliqués là où `components/shared/status-dot.tsx` montre déjà le bon pattern de primitive.
- **Reco** : créer `<LabelChip>` et `<PillarDot>` dans components/shared ; faire pointer task-list sur `toneTextClass`.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Réseau d'IDs magiques positionnels non vérifiés entre 8 fichiers de mocks
- **Où** : `content-extra.ts:22-70` (clés `ct_cl_*_13` indexées sur l'ordre de BLUEPRINT, généré à `content.ts:134`), `history.ts:10,21,49`, `metrics.ts:21-22`, `quotas.ts:20-30`, `planning.ts:134-144`, `library.ts:64-69`, `notifications.ts:18,46,60,74,116,130` (hrefs en dur au lieu de routes.ts)
- **Constat** : identifiants référencés par convention positionnelle sans aucune vérification TS/runtime ; mapping client→short en 3 exemplaires.
- **Scénario d'échec / coût à l'échelle** : insérer une entrée au milieu de BLUEPRINT décale tous les `ct_*_N` : versions, journal d'activité, overrides et hrefs pointent d'autres contenus sans erreur — la démo se dégrade silencieusement. Limité aux fixtures (remplacées par des FK réelles au câblage).
- **Reco** : module `ids.ts` (constantes sémantiques typées + helpers `contentId`, `pillarId`, map client→short unique) ; routes.ts pour tous les hrefs ; optionnel : test d'intégrité des références.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Doublons mineurs et scories de la façade
- **Où** : `metrics.ts:11-23` vs `imported.ts:10-25` (deux pools d'engagement quasi identiques avec chacun leur override de top post) ; `index.ts:236` (ré-export mort d'`isPast`, util de formatage) ; `history.ts` (266 lignes > règle 24)
- **Reco** : factoriser `engagement-pools.ts` ; supprimer le ré-export d'isPast ; scinder history.ts (versions / activités).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md règle 24

### [P3] Action « Reconnecter » simulée dupliquée 3 fois sans seam d'injection
- **Où** : `components/shared/account-alert.tsx:36-40` (handleReconnect en dur, pas de prop onReconnect) ; doublons avec clés i18n ET sévérités de toast divergentes : `settings/account-row.tsx:18-22` (toast.warning), `client-settings/section-accounts.tsx:66-70` (toast.info) ; AccountAlert consommé par 4 surfaces (calendar-banners:35, feed-grid:160, content-targets:107, composer-targets:68)
- **Constat** : le chemin de récupération critique du produit (needs_reauth → email Brevo → clic reconnecter) a 3 implémentations divergentes au lieu d'un point d'entrée unique pour brancher `/api/oauth/[provider]?relink=…`.
- **Reco** : `lib/accounts/reconnect.ts` exportant `startReconnect(account)` (stub toast aujourd'hui, redirect OAuth demain), consommé par les 3 composants ; prop `onReconnect` optionnelle sur AccountAlert.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 règles 13-14

### [P3] Clés i18n des composants shared rangées sous `portal.shared.*`
- **Où** : `components/shared/selection-bar.tsx:32,37,44,49`, `account-alert.tsx:37-83` ; clés définies dans `zones/portal.fr.ts:70-84` (commentaire assumant le contournement)
- **Constat** : composants transverses (studio, grille, calendrier, médiathèque, composer) couplés au namespace du portail Reviewer. Mitigé : `t()` est typé MessageKey (une suppression casse le build, pas le runtime) et les dictionnaires sont fusionnés statiquement.
- **Reco** : créer une zone `shared.{fr,en}.ts`, déplacer les clés, 10 occurrences à mettre à jour ; `portal.*` redevient exclusif au portail.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Pastille de tonalité dupliquée en 8 sites (deux Dot locaux dans shared + réimplémentations ad hoc)
- **Où** : `shared/status-badge.tsx:21-23` (size-1.5) et `status-dot.tsx:18-42` (ring-2 + sr-only) ; inline : `calendar-legend.tsx:26`, `grid-filters.tsx:73`, `reels-tab.tsx:45`, `tile-overlays.tsx:23`, `grid-legend.tsx:20-28`, `day-cell.tsx:171` — tous important `toneDotClass` (qui vit dans lib/mocks/labels.ts)
- **Constat** : motif dupliqué avec a11y incohérente (certains sans aucun label).
- **Reco** : primitive `ToneDot({ tone, size, label? })` dans components/shared, fusion des deux Dot ; `toneDotClass` n'est plus importé hors de cette primitive.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] QuotaGauge redéfinit sa propre table tonalité→classe en parallèle de toneDotClass/toneTextClass
- **Où** : `components/shared/quota-gauge.tsx:13-23` vs système canonique `lib/mocks/labels.ts:106-122`
- **Constat** : BAR_CLASS/TEXT_CLASS dupliquent le mapping warning/danger déjà centralisé (l'état « ok » est un composite volontaire ; seuls les seuils 0.8/0.95 sont légitimement locaux).
- **Reco** : `toneOf()` produit un StatusTone ; consommer `toneTextClass` + une `toneBgClass` centralisée, seuils locaux conservés, ok = brand/neutral préservé.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Primitives ui mortes : aspect-ratio.tsx et breadcrumb.tsx sans aucun consommateur
- **Où** : `components/ui/aspect-ratio.tsx:1`, `components/ui/breadcrumb.tsx:1` (grep exhaustif : 0 référence)
- **Reco** : supprimer (ré-ajout trivial via shadcn CLI) ou documenter comme stock volontaire — dans une passe de nettoyage groupée avant mise en prod.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Assemblage ComposerData dupliqué verbatim entre les pages new et edit du composer
- **Où** : `content/new/page.tsx:70-84` et `content/[contentId]/edit/page.tsx:67-81` (8 getters + map quotas identiques)
- **Constat** : le pattern loader partagé existe déjà dans le repo (perf-data.ts, report-data.ts) ; l'interface typée couvre en partie le risque (champ requis = erreur de compil sur les deux pages), mais l'orchestration des futures requêtes (Promise.all, cache(), filtre org_id) sera dupliquée.
- **Reco** : loader serveur partagé `getComposerData(clientId): ComposerData` (ex. `composer/composer-data.ts`) ; les pages ne gardent que prefill et garde READ_ONLY.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Loaders en boucle par client (pattern N+1) dans les pages liste
- **Où** : `app/(app)/clients/page.tsx:47-50` (clientStats + getSocialAccounts dans le map de rendu), `settings/accounts/page.tsx:15-17`
- **Constat** : le contrat implicite du seam est « un aller-retour données par client » ; la façade n'offre que des getters unitaires.
- **Scénario d'échec / coût à l'échelle** : branché tel quel, 15 clients = 31 requêtes (1 + 2N) par rendu ; côté SQL la bonne forme est une vue/RPC agrégée — le seam doit déjà avoir cette signature.
- **Reco** : getters agrégés dans la façade avec la signature de la future vue SQL : `getClientsOverview(): { client, stats, accounts, needsReauth }[]`, `getAccountsByClient()`.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0
- **Effort** : S   **Impact scaling** : moyen

### [P3] Prédicat de santé de compte social (`status !== "connected"`) dupliqué 14 fois
- **Où** : `clients/[clientId]/layout.tsx:33`, `clients/page.tsx:50`, `settings/accounts/page.tsx:21`, + 11 occurrences composants (calendar-insights.ts:73, preflight.ts:74, feed-grid.tsx:159, content-targets.tsx:74, client-nav.ts:35…)
- **Constat** : AccountStatus a déjà 3 états (`connected|needs_reauth|expired`) que le prédicat inline conflate ; le PRD prévoit des états plus fins (expiration proche, health check §10).
- **Reco** : exporter `needsReauth(account)` / `anyNeedsReauth(accounts)` (lib/accounts.ts) et remplacer les 14 comparaisons.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Page serveur du composer importée sur les internals d'un module composant (`zonedToUtcIso` re-exporté au lieu de lib/tz)
- **Où** : `content/new/page.tsx:8` → `composer/composer-utils.ts:24-33` (wrapper une-ligne de `zonedWallToUtcIso` de `@/lib/tz`)
- **Constat** : la route dépend des internals du dossier composer pour une primitive qui vit déjà dans lib/. Un futur `"use client"` sur composer-utils casserait la page serveur.
- **Reco** : importer `zonedWallToUtcIso` directement depuis `@/lib/tz` ; supprimer le re-export à terme (cf. finding TZ P2).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Portail : assertion `as Client` masque un null possible au lieu d'un `notFound()`
- **Où** : `(portal)/portal/page.tsx:19`, `portal/[contentId]/page.tsx:45` (+ 3e site : `lib/mocks/index.ts:126`) ; `getClient()` retourne `Client | undefined` (index.ts:44)
- **Constat** : le cast court-circuite le TS strict ; il survivrait silencieusement au câblage (un `.maybeSingle()` nullable compilerait toujours) et transforme un client archivé/supprimé en TypeError au rendu au lieu d'un 404. La page détail utilise `notFound()` correctement 5 lignes plus haut.
- **Reco** : garde explicite `if (!client) notFound()` (disparaît naturellement avec le seam `getReviewerContext()`).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md règle 25 (esprit TS strict)

### [P3] Dashboard : liste « activité récente » ré-implémentée inline au lieu de réutiliser NotificationRow
- **Où** : `app/(app)/dashboard/page.tsx:110-129` vs `components/app/notifications/notification-row.tsx:66-116`
- **Constat** : mêmes champs AppNotification rendus à la main, sans icône par type ni indicateur non-lu (divergence visuelle déjà présente).
- **Scénario d'échec / coût à l'échelle** : les notifications passeront en Supabase Realtime — un composant de rendu unique par item est le prérequis pour brancher le flux à un seul endroit.
- **Reco** : variante compacte de NotificationRow (prop `density="compact"`) consommée par la card du dashboard.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

## Code production-grade propose (NON applique)

Squelette des deux modules qui débloquent le plus de findings (P1 machine à états + P1 groupes de statuts). Destinés à `apps/web/lib/content/` aujourd'hui, `packages/shared` demain — rien n'est écrit dans le dépôt hors ce rapport.

```ts
// lib/content/status.ts — source unique de vérité des états (PRD §5.B/§6)
import type { ContentStatus, ContentTarget } from "@/lib/domain/types";

export const PUBLISH_LOCKED = ["publishing", "published", "partially_published"] as const satisfies readonly ContentStatus[];
export const REVIEWER_VISIBLE = ["in_review", "changes_requested", "approved", "scheduled", "publishing", "published", "partially_published"] as const satisfies readonly ContentStatus[];
// … PREPUBLISH, SHELF, PLANNED_VISIBLE, QUOTA_COUNTED (littéraux à reprendre des sites actuels, arbitrés avec Étienne)

export const isPublishLocked = (s: ContentStatus) => (PUBLISH_LOCKED as readonly ContentStatus[]).includes(s);
export const canEdit = (s: ContentStatus) => !isPublishLocked(s) && s !== "in_review"; // règle de la page détail — à faire acter

/** Transitions autorisées — remplace REVIEWABLE/SCHEDULABLE/TO_REVIEW_FROM/LOCKED_STATUSES.
 *  Les divergences actuelles (idea→in_review ? failed reprogrammable ?) sont des DÉCISIONS produit à acter avant remplissage. */
const TRANSITIONS: Partial<Record<ContentStatus, readonly ContentStatus[]>> = { /* … */ };
export const canTransition = (from: ContentStatus, to: ContentStatus) => TRANSITIONS[from]?.includes(to) ?? false;
export const canSendReview = (s: ContentStatus) => canTransition(s, "in_review");
export const canSchedule = (s: ContentStatus) => canTransition(s, "scheduled");

/** Agrégation targets → statut global (partially_published) — logique miroir du futur worker (CLAUDE.md §5). */
export function deriveContentStatus(targets: readonly ContentTarget[]): ContentStatus { /* extrait de lib/mocks/content.ts:82-92 */ }
```

```ts
// lib/tz.ts — extension (finding TZ P2) : décomposition inverse unique, jamais de parsing de chaîne formatée
export interface WallClock { year: number; month: number; day: number; hour: number; minute: number }
const partsCache = new Map<string, Intl.DateTimeFormat>();
export function wallClockIn(iso: string, tz: string): WallClock { /* formatToParts + cache par tz */ }
export const dayKeyOf = (iso: string, tz: string): string => { const w = wallClockIn(iso, tz); return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`; };
export const wallTimeOf = (iso: string, tz: string): string => { const w = wallClockIn(iso, tz); return `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`; };
```

Ordre de chantier recommandé (pré-câblage, chaque étape = codemod mécanique vérifiable par build + screenshots) :
1. Extraction `lib/domain/` (types + labels hors de lib/mocks, ré-exports de compat) — débloque tout le reste.
2. `lib/content/status.ts` + arbitrage Étienne des divergences de transitions/éditabilité.
3. Shell : données par props depuis les layouts serveur + `server-only` sur le module de données.
4. `lib/tz.ts` étendu + constantes scheduling partagées.
5. Dé-L<string>-isation de la façade (le plus gros lot, à planifier comme chantier propre).

## Ce qui va bien (a preserver)

- **Toutes les pages sont des `async` Server Components** avec layouts par groupe de routes — la condition n°1 du câblage Supabase sans réécriture est remplie côté routes.
- **La façade `lib/mocks/index.ts` existe et est presque partout le point de passage** : le seam de branchement est réel, il faut le durcir (async, server-only), pas le créer.
- **Le pattern `perf-data.ts` / `report-data.ts`** (page mince → module serveur de dérivation) est exactement la bonne convention : le généraliser (grid, composer), pas le remplacer.
- **`lib/mocks/labels.ts` centralise déjà les méta statuts/plateformes/tones** avec labelKeys i18n — bonne fondation, il ne manque que les groupes/prédicats et un meilleur emplacement.
- **`lib/routes.ts` et `lib/tz.ts`** : les bons réflexes de centralisation existent (routes typées, avertissement DST explicite) ; les findings ne font qu'étendre ces modules.
- **Le système i18n maison est solide** : dictionnaires par zones, `MessageKey` strictement typé (les suppressions de clés cassent le build, pas le runtime), `useFormat`/`getFormat` liés à la locale — les fuites sont périphériques (défaut fr, grid), pas structurelles.
- **`components/shared` suit déjà le pattern primitive** (status-dot, status-badge, format-icon avec useLabels) : les micro-duplications sont des écarts à une convention existante, pas l'absence de convention.
- **Les types miroir PRD §6 recoupent fidèlement les statuts cibles** (ContentStatus/TargetStatus/enums) : le contrat de données est bon sur le fond, c'est son emplacement et ses artefacts démo (`L<string>`, theme, windowKey) qui sont à corriger.
- **Aucun `any`, aucune couleur hardcodée constatés dans le périmètre audité ; Biome en place** — les règles de fer 25/28 tiennent.
