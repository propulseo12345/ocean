# Audit — Debug Production (2026-07-07)

## Verdict
La dimension « debug production » est globalement saine dans sa structure (Server Components partout, façade mocks, primitives timezone correctes dans `lib/tz.ts`), mais elle porte **un défaut P0 qui explose précisément à la mise en prod annoncée** : la grille du calendrier éditorial calcule ses clés jour en mélangeant date-fns en heure locale et getters UTC — reproduit empiriquement, tout runtime UTC+ (100 % du marché FR) affiche chaque date sous la mauvaise colonne de jour, avec hydration mismatch React entre le serveur Coolify (UTC) et le navigateur français. Autour de ce P0 gravitent deux familles de fragilités systémiques : (1) **le temps n'est pas injecté mais importé** — `MOCK_NOW` est consommé en direct par 22 fichiers dont le formatteur générique `lib/format.ts`, sans couture de remplacement, et l'arithmétique de jours en millisecondes fixes (86 400 000 ms) dérive d'une heure à chaque bascule DST dans la grille et le batch du studio ; (2) **des mutations silencieuses dans les interactions drag** — le drag de la grille permute les dates de tuiles masquées par les filtres et `commit()` entérine des permutations jamais confirmées, exactement la classe « publication non voulue » que CLAUDE.md §12 qualifie de destructrice de confiance. Côté portail (surface exposée aux clients finaux), la règle de visibilité reviewer n'est appliquée que sur la liste, pas sur le détail. Risque principal pour le câblage : ces défauts vivent dans du code UI qui sera conservé tel quel — les corriger après branchement Supabase coûtera une réécriture, les corriger maintenant coûte majoritairement S/M.

## Fonctionnement reel observe
- **Temps** : l'horloge démo est une constante figée `MOCK_NOW` (`lib/mocks/time.ts:3`, 11/06/2026, commentaire lignes 1-2 : déterminisme d'hydratation). Elle est importée directement par 22 fichiers, dont la logique bloquante du composer (`components/app/studio/composer/preflight.ts:242-243`, garde-fou +15 min), les raccourcis de programmation (`composer-utils.ts:92-105`), les retards du board (`board-utils.ts:69/77/160`), le surlignage du jour courant (`components/app/calendar/use-calendar-state.ts:37`) et le formatteur partagé `lib/format.ts:2,52,64` — inversion de dépendance : la couche présentation générique dépend de `lib/mocks`. La façade `lib/mocks/index.ts` n'exporte pas `./time` : la couture temps n'existe pas.
- **Calendrier éditorial** : `use-calendar-state.ts:124-125` calcule la grille via `monthGridKeys/weekGridKeys` (`calendar-utils.ts:82-98`) qui passent des ancres midi-UTC dans `startOfWeek/startOfMonth/eachDayOfInterval` (date-fns 4.4.0, heure LOCALE) puis relisent via `keyFromDate` en `getUTC*` (`:45-50`). Les en-têtes lun→dim sont statiques et positionnels (`month-grid.tsx:15-23`). Le hook consomme `CalendarData.items` = TOUS les ContentItem du client (`page.tsx:32` → `getContentItems` sans borne, `lib/mocks/index.ts:53-57`), avec overrides en overlay (bon modèle, `use-calendar-state.ts:69-107`).
- **Grille feed IG** : `feed-grid.tsx:74-78` filtre `plannedVisible`, mais `use-grid-tiles.ts:59-63` permute sur la liste COMPLÈTE `plannedRef.current` via `permuteDates` (`grid-mutations.ts:12-30`). Le hook forke les props en useState au montage (`use-grid-tiles.ts:38-44`) et `commit()` (`:52-57`) entérine l'état courant y compris permutations non appliquées. Chaque tuile publiée/importée est un droppable individuel (`locked-grid-tile.tsx:30-33`), feed non paginé (`grid-board.tsx:89-109`).
- **Décalages de dates** : la grille et le batch studio additionnent des multiples de 24 h en ms (`grid-date-utils.ts:35-73`, `board-state.ts:132-146` + constantes `:19-20`) là où le calendrier fait l'arithmétique murale correcte et documente le piège (`calendar-actions.ts:90-93`) ; les primitives DST-correctes existent (`lib/tz.ts:30` `zonedWallToUtcIso`, `composer-utils.ts` `wallClockIn/shiftDay`).
- **Portail reviewer** : la liste passe par `getPortalContent` (REVIEWER_VISIBLE + corbeille, `lib/mocks/index.ts:137-148`) mais le détail charge via `getContentItem` non filtré (`app/(portal)/portal/[contentId]/page.tsx:37-40`). Layout/liste/détail importent chacun `DEMO_REVIEWER_CLIENT_ID` ; casts `as Client` sur un retour `Client | undefined` (`portal/page.tsx:19`, `[contentId]/page.tsx:45`) ; aucun `error.tsx` dans tout `app/`.
- **Auth** : `login-form.tsx:40-54` et `otp-form.tsx:67-78` — aucune lecture de `?next=`, l'email n'est pas transporté vers `/otp`, magic link → dashboard immédiat. `lib/routes.ts:4-9` expose un espace d'URL SANS préfixe `/app`, alors que le middleware de référence CLAUDE.md §9 garde `startsWith('/app')` ; aucun `middleware.ts` n'existe.
- **Agenda unifié** : semaines ancrées sur des minuits UTC (`agenda-utils.ts:85-98`), durée = minutes murales du même jour (`:75-82`), cache module-level non borné `partsCache` (`:34-62`).

## Findings (tries par severite P0 -> P3)

### [P0] Grille calendrier : clés jour dépendantes du fuseau du runtime (date-fns local mélangé à des getters UTC) — off-by-one confirmé empiriquement
- **Ou** : apps/web/components/app/calendar/calendar-utils.ts:82-98 (monthGridKeys/weekGridKeys) + :45-50 (keyFromDate)
- **Constat** : `startOfWeek/startOfMonth/endOfWeek/eachDayOfInterval` (date-fns 4.4.0) travaillent en heure LOCALE du runtime, mais `keyFromDate` relit les résultats avec `getUTCFullYear/getUTCMonth/getUTCDate`. Reproduit en exécutant le code réel : runtime UTC → grille juin = 2026-06-01→2026-07-05, semaine du 11/06 = lun 08/06→dim 14/06 (correct) ; runtime Europe/Paris (machine d'Étienne) → grille = 2026-05-31→2026-07-04, semaine = DIM 07/06→SAM 13/06. Les en-têtes lun→dim (`month-grid.tsx:15-23`) sont statiques : chaque date s'affiche sous la mauvaise colonne (le 11/06/2026, un jeudi, tombe sous « Ven »). Le commentaire du fichier (l.13-15) promet exactement l'invariant que le code viole.
- **Scenario d echec / cout a l echelle** : en prod, le serveur Coolify (Docker, TZ=UTC) SSR la grille correcte, le navigateur d'un utilisateur français recalcule la grille décalée d'un jour → hydration mismatch React à chaque affichage + grille finale fausse pour 100 % des utilisateurs UTC+. Un freelance programme « le mardi 11h30 » en se fiant à la colonne — la date réelle est celle de la clé, pas de la colonne : publication au mauvais jour, classe adjacente à la « publication non voulue » de CLAUDE.md §12.
- **Pourquoi ca bloque le scaling** : bug qui explose exactement à la mise en prod (étape suivante annoncée) ; toute feature assise sur DayKey (drag&drop performDrop, sélection en lot, export) hérite du décalage ; irréconciliable avec des clients multi-fuseaux.
- **Reco** : faire toute l'arithmétique de grille en UTC pur, sans date-fns local — calculer le lundi de semaine comme `agenda-utils.startOfWeekMonday` (getUTCDay/setUTCDate, déjà correct dans le repo) ou passer par @date-fns/utc TZDate. Contrat : monthGridKeys/weekGridKeys ne dépendent QUE du curseur et de la clé, jamais du fuseau runtime. Ajouter un test unitaire exécuté sous 2 TZ (`process.env.TZ`) en CI.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 (TZ du client, stockage UTC) ; PRD §5 calendrier

### [P1] Le drag de la grille permute les dates de tuiles MASQUÉES par les filtres (mutation invisible)
- **Ou** : apps/web/components/app/grid/use-grid-tiles.ts:59-63 (+ grid-mutations.ts:12-30, feed-grid.tsx:74-78)
- **Constat** : FeedGrid affiche `plannedVisible` (filtré statut/format, exclusions, reels hors grille), mais `permute()` appelle `permuteDates(plannedRef.current, ...)` sur la liste COMPLÈTE. `permuteDates` calcule fromPos/toPos parmi TOUS les sortables (y compris cachés par un filtre) et réassigne les dates par position via arrayMove.
- **Scenario d echec / cout a l echelle** : planned desc = [A(scheduled), B(in_review), C(scheduled)] ; filtre « scheduled » actif → l'utilisateur voit [A, C] et drague A sur C. arrayMove(0→2) sur [A,B,C] : B — invisible, en attente de validation client — change silencieusement de date. Le toast n'annonce que A ; au « Appliquer » câblé sur Supabase, une mutation de `scheduled_at` jamais vue part en base sur un contenu potentiellement approuvé.
- **Pourquoi ca bloque le scaling** : plus il y a de contenus et de filtres, plus la fenêtre du bug grandit ; c'est exactement le type de « publication non voulue » destructeur de confiance (CLAUDE.md §12). Le codebase a d'ailleurs la bonne discipline ailleurs (feed-grid.tsx:91-101 élague la multi-sélection des tuiles invisibles) — le chemin drag ne l'a pas.
- **Reco** : passer à `permute()` les ids visibles (ou un prédicat de visibilité) et restreindre le sous-ensemble permutable aux tuiles sortables ET visibles ; alternative simple : désactiver le drag quand un filtre est actif (comme en finalRender), avec un hint. Appliquer le même raisonnement à `dropFromShelf`.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : PRD §5.C ; CLAUDE.md §12 (paranoïa = feature)

### [P1] useGridTiles fork les données serveur en state local et `commit()` entérine silencieusement les permutations en attente
- **Ou** : apps/web/components/app/grid/use-grid-tiles.ts:38-57 et 120-126
- **Constat** : le hook initialise `planned`/`shelf` via useState(props) et fige `initialRef` au montage : toute donnée serveur ultérieure est ignorée. Surtout, `commit()` (appelé par dropFromShelf:87, insertSlotBefore:149, addPlaceholder:159, retryTile:175, batchShiftWeek:187, batchSendReview:198, batchCancel:205) pose `baselineRef = plannedRef.current` — qui contient les permutations NON appliquées — et vide `history`. Contredit frontalement le contrat affiché par PendingBar (« un drag ne vaut qu'une fois appliqué », pending-bar.tsx:7-8).
- **Scenario d echec / cout a l echelle** : l'utilisateur permute deux dates (barre « Appliquer/Annuler » visible), puis insère un créneau : la barre disparaît, les permutations sont intégrées à la baseline sans confirmation, « Tout annuler » ne peut plus les défaire. Une fois câblé : payloads de dates mêlant confirmé + aperçu envoyés à Supabase ; et un refetch TanStack Query / événement Realtime ne rafraîchira jamais la grille.
- **Pourquoi ca bloque le scaling** : c'est LE seam de câblage de la grille — l'UI validée ne se branchera pas sur Supabase sans réécriture de ce hook. Le calendrier a le bon modèle (overlay d'overrides sur les props, use-calendar-state.ts:69-107) ; la grille a le mauvais (fork complet).
- **Reco** : restructurer useGridTiles sur le modèle overlay du calendrier : props = source de vérité, état local = Map d'overrides `id → {dateIso, status}` + insertions fantômes ; permutations pending dans un overlay séparé fusionné uniquement à `applyPending` ; autres mutations bloquées tant que pendingCount > 0 ou indépendantes de l'overlay. `resetTiles` = vider les overlays.
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query au câblage) ; PRD §5.C

### [P1] Le calendrier exige le dataset complet multi-années du client à chaque visite
- **Ou** : apps/web/components/app/calendar/use-calendar-state.ts:101-122 (+ calendar-types.ts:17-29)
- **Constat** : le contrat `CalendarData.items` = TOUS les ContentItem du client (page.tsx:32 → getContentItems sans borne, lib/mocks/index.ts:53-57 n'accepte aucun range) ; `effectiveItems` re-mappe la liste entière à chaque changement d'override, `groupByDay` indexe tout l'historique, et goPrev/goNext naviguent sans limite en supposant tout en mémoire.
- **Scenario d echec / cout a l echelle** : client actif 3 ans à ~20 posts/mois = 700+ items (media, targets, labels bilingues) sérialisés du Server Component vers le client à chaque ouverture. Payload RSC de plusieurs Mo, TTI dégradé sur iPhone (plateforme prioritaire), coût croissant linéairement chaque mois.
- **Pourquoi ca bloque le scaling** : le câblage Supabase devra requêter par plage ; le curseur de navigation vit DANS le hook qui consomme `data.items` en prop — passer à des requêtes par plage exige de restructurer la propriété de l'état. Si le seam n'est pas posé maintenant, c'est une réécriture du hook après coup.
- **Reco** : sans changer l'UI : borner `CalendarData.items` à la période visible ± 1 (la façade mock peut accepter un range dès maintenant), et prévoir au câblage une query TanStack keyée `{clientId, cursor}` (`.gte/.lt` sur scheduled_at + shelf non datée séparée). Seuls counts/pendingReview sont à repenser en agrégats.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 (TanStack Query) ; §12 (PWA iOS prioritaire)

### [P1] Le détail portail n'applique pas la règle de visibilité reviewer (statuts + corbeille) — seule la liste la respecte
- **Ou** : apps/web/app/(portal)/portal/[contentId]/page.tsx:37-40
- **Constat** : la page détail charge via `getContentItem(contentId)` et ne vérifie que `content.clientId !== DEMO_REVIEWER_CLIENT_ID`. `getContentItem` (lib/mocks/index.ts:59-61) ne filtre ni `deletedAt` ni les statuts. La liste, elle, passe par `getPortalContent` qui applique REVIEWER_VISIBLE (index.ts:137-148, exclut idea/draft/publishing/failed/canceled) et exclut la corbeille. Deux règles de visibilité divergentes pour la même ressource — exploitable dès aujourd'hui en deep-link (`clientFacingStatus` laisse passer les badges draft/idea bruts, portal-card.tsx:18-26).
- **Scenario d echec / cout a l echelle** : un reviewer garde `/portal/ct_x` en favori ; l'agence repasse le contenu en draft ou le met à la corbeille → le reviewer voit toujours la page (brouillon non fini, légende en cours d'écriture). Idem un contenu `failed` accessible en deep-link alors que la liste le masque volontairement (PRD §5.F).
- **Pourquoi ca bloque le scaling** : au câblage, la RLS (client_members) garantira le périmètre tenant mais PAS la visibilité par statut/corbeille — règle applicative. Dupliquée entre liste et détail, chaque nouvelle page portail la ré-invente et la fuite de workflow devient systémique.
- **Reco** : centraliser dans la façade un `getPortalContentItem(contentId, clientId)` encapsulant clientId + REVIEWER_VISIBLE + !deletedAt, retournant undefined sinon (→ notFound()). Liste et détail consomment la MÊME règle ; au câblage, cette fonction devient la requête Supabase avec filtre statut explicite (défense en profondeur, règle 7).
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §5.F + CLAUDE.md §2 règle 7

### [P1] Horloge figée MOCK_NOW sans couture : 22 fichiers l'importent en direct et lib/format.ts (formatteur partagé) dépend de lib/mocks
- **Ou** : apps/web/lib/format.ts:2,52,64 (formatRelative/isPast) + 21 autres importeurs de @/lib/mocks/time
- **Constat** : MOCK_NOW est volontairement figé (déterminisme d'hydratation) mais aucun point d'injection n'existe : board-utils.ts:69/77/160, preflight.ts:242-243 (garde +15 min), composer-utils.ts:92-105, grid-date-utils.ts:37/72, calendar-insights.ts:103/140, use-calendar-state.ts:37 (todayKey) et lib/format.ts comparent tous directement à la constante. lib/format.ts, couche présentation générique, importe depuis lib/mocks — le module censé survivre au câblage dépend du module censé disparaître. La façade `lib/mocks/index.ts` n'exporte même pas `./time` : la couture temps n'existe pas.
- **Scenario d echec / cout a l echelle** : au câblage, 22 imports à retrouver à la main. Un seul oublié = bug silencieux en prod : « programmé il y a 3 semaines » faux, preflight qui refuse toute programmation (MOCK_NOW = 11/06/2026 désormais passé), todayKey qui surligne le mauvais jour. Aucune erreur de compilation ne signalera l'oubli — et un remplacement naïf par `Date.now()` réintroduit le mismatch d'hydratation que MOCK_NOW évitait.
- **Pourquoi ca bloque le scaling** : c'est LA couture temps du branchement backend ; le fil rouge « brancher Supabase sans réécrire l'UI » casse ici. Chaque nouveau composant aggrave la dette.
- **Reco** : créer `lib/clock.ts` exportant `now(): Date` (impl. actuelle = MOCK_NOW) ; interdire l'import direct de @/lib/mocks/time hors lib/clock (règle Biome/grep CI). Au câblage : le Server Component sérialise `now` et le passe en prop (préserve le déterminisme d'hydratation) ; lib/format.ts prend `now` en paramètre.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 (mocks = brancher Supabase sans réécrire l'UI)

### [P2] Incohérence ASAP_DELAY_MS (5 min) < MIN_LEAD_MS (15 min) : « publier dès que possible » produit une date immédiatement bloquée par le preflight
- **Ou** : apps/web/components/app/studio/composer/schedule-dialog.tsx:97 (+ composer-utils.ts:11,15 ; preflight.ts:242-250)
- **Constat** : confirm() avec lateChoice=asap écrit `draft.scheduledAt = MOCK_NOW + 5 min`, or `dateItem()` déclare 'error' toute date < MOCK_NOW + 15 min. Toast de succès + panneau preflight rouge (datePast) + triangle d'alerte sur le bouton Programmer (composer-header.tsx:70). Ré-ouvrir le dialog re-déclenche isLate (schedule-dialog.tsx:85) : boucle sans sortie propre.
- **Scenario d echec / cout a l echelle** : l'utilisateur coche « dès que possible » → succès affiché MAIS état bloquant permanent ; au câblage, ce timestamp synthétique client sera de plus rejeté par la validation serveur → flux ASAP inutilisable.
- **Pourquoi ca bloque le scaling** : l'ASAP est le pont vers la règle worker « fenêtre de grâce 2 h » (décision actée) ; encoder l'intention comme un faux timestamp rend impossible un contrat propre avec `publish_jobs.run_at` (le serveur devra deviner que « now+5min » voulait dire « dès que possible »).
- **Reco** : représenter l'intention explicitement (`scheduledAt: { mode: 'asap' } | { mode: 'at', iso }`) ; dateItem accepte ce mode. Fix minimal S : dateItem n'erre que si time < now (le lead 15 min reste un garde-fou du picker), ou ASAP_DELAY_MS >= MIN_LEAD_MS. Au câblage, 'asap' → `run_at = now()` serveur.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : PRD §5.B (lead ≥ now+15 min) + décision actée n°12

### [P2] MOCK_NOW et CURRENT_USER importés directement des mocks dans la logique métier du composer
- **Ou** : apps/web/components/app/studio/composer/preflight.ts:4 (+ composer-utils.ts:2, schedule-dialog.tsx:21-22, board-state.ts:5)
- **Constat** : quatre fichiers de logique importent MOCK_NOW (et schedule-dialog importe CURRENT_USER depuis lib/mocks/clients) directement. Toute la validation temporelle (dateItem, isLate, scheduleShortcuts, nextSlotIso) et l'affichage du fuseau (schedule-dialog.tsx:168-174) dépendent de constantes figées. isLate est calculé au rendu sans timer : dialog ouvert 20 min = verdict périmé.
- **Scenario d echec / cout a l echelle** : au câblage, remplacer MOCK_NOW exige de toucher ces fichiers dispersés ; en oublier un et la prod valide les dates contre juin 2026. CURRENT_USER.timezone en dur affiche le mauvais fuseau dès le 2e utilisateur réel.
- **Pourquoi ca bloque le scaling** : chaque import direct est un point de réécriture caché — cas particulier du P1 « MOCK_NOW 22 fichiers » sur le sous-système le plus sensible (validation bloquante de programmation).
- **Reco** : provider unique `now()` (lib/clock.ts, cf. P1) + transiter l'utilisateur courant (timezone) par props/contexte depuis le Server Component ; plus aucun import lib/mocks/* hors façade dans components/app/studio/**. Documenter que dateItem/isLate seront re-validés côté Server Action (Zod) avec now() Postgres comme source de vérité.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §0 + §2 r.27 + §5 (horloge = now() Postgres)

### [P2] scheduleBatch : échelonnement en pas fixes de 86 400 000 ms (naïf au DST) et passage forcé en 'scheduled' sans garde-fou preflight
- **Ou** : apps/web/components/app/studio/board-state.ts:132-146 (+ constantes lignes 19-20)
- **Constat** : la programmation par lot ajoute `i * gapDays * DAY_MS` (24 h fixes) à l'epoch de startIso, alors que la primitive DST-correcte `zonedWallToUtcIso` existe (lib/tz.ts:30) et est utilisée pour le point de départ (board-schedule-dialog.tsx:73). Convention magique gap 0 = toutes les heures. `setStatusBatch(ids, 'scheduled')` s'applique sans vérifier cibles/médias/comptes.
- **Scenario d echec / cout a l echelle** : lot « 1 post/jour à 09:00 » démarrant le 23/10 en Europe/Paris : dès le 25/10 (fin DST), tous les posts glissent à 08:00. Un item sans cible ni média peut passer en 'scheduled' via la sélection multiple — état que le backend rejettera (divergence UI/serveur).
- **Pourquoi ca bloque le scaling** : chaque lot traversant un changement d'heure (2×/an) dérive d'une heure ; la Server Action de programmation par lot devra ré-implémenter l'échelonnement — autant fixer le calcul mural maintenant pour que le contrat soit déjà le bon.
- **Reco** : calculer chaque occurrence en heure murale du fuseau client (wallClockIn → shiftDay → zonedWallToUtcIso, helpers existants). Remplacer gap 0 par un paramètre explicite (`unit: 'hour' | 'day'`). Mini-preflight (cibles + média) avant setStatusBatch('scheduled').
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 (TZ client, stockage UTC)

### [P2] Vue par défaut du board résolue par comparaison du libellé FR en dur ('À traiter')
- **Ou** : apps/web/components/app/studio/board-state.ts:53
- **Constat** : `savedViews.find((v) => v.name.fr === "À traiter")`. L'identité fonctionnelle d'une vue repose sur sa chaîne d'affichage française ; le type SavedView (lib/mocks/types/pro.ts:66-71) n'a aucun discriminant sémantique. Deux clients mockés (cl_nove, cl_rise) n'ont déjà aucune vue par défaut.
- **Scenario d echec / cout a l echelle** : dès que saved_views vient de la DB : renommage ou org anglophone → defaultView = null silencieusement, le board s'ouvre sans filtre ; toute vue homonyme devient la vue par défaut.
- **Pourquoi ca bloque le scaling** : le couplage donnée-affichage interdit le multi-locale et le multi-org ; le schéma saved_views exigera de toute façon une colonne dédiée — la poser maintenant dans le type mock évite une migration de comportement.
- **Reco** : ajouter `isDefault: boolean` ou `kind: 'inbox' | 'custom'` au type SavedView, renseigner les mocks, sélectionner via ce champ.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] calendar-dnd mélange PointerSensor + TouchSensor : le long-press documenté est court-circuité sur tactile
- **Ou** : apps/web/components/app/calendar/calendar-dnd.tsx:53-58
- **Constat** : vérifié dans la source dnd-kit 6.3.1 : l'activator de PointerSensor accepte tout pointerdown primaire (y compris tactile) et pointerdown précède touchstart — sur mobile c'est PointerSensor (distance 6 px, sans délai) qui gagne, jamais le TouchSensor 220 ms. Les commentaires d'entry-shell.tsx:93-95 décrivent un comportement qui n'existe pas. La grille fait juste (grid-workspace.tsx:69-73 : MouseSensor + TouchSensor).
- **Scenario d echec / cout a l echelle** : sur iPhone (PWA prioritaire), scroller le mois en posant le doigt sur une carte déclenche un départ de drag dès 6 px (cases en pointillé, ghost) avant le pointercancel du pan : flicker systématique + drags accidentels.
- **Pourquoi ca bloque le scaling** : chaque nouvel écran drag copiera l'un des deux patterns ; sur mobile bas de gamme le start/cancel répété re-render 42 cases à chaque frottement.
- **Reco** : aligner calendar-dnd sur grid-workspace (MouseSensor distance 6 + TouchSensor delay 220/tolerance 8) et extraire la config sensors dans un helper partagé pour interdire la divergence.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 (PWA iOS prioritaire)

### [P2] Le swipe de période se déclenche au relâchement d'un drag tactile : drop + changement de mois simultanés
- **Ou** : apps/web/components/app/calendar/use-swipe.ts:17-28 (+ editorial-calendar.tsx:49 et 164)
- **Constat** : les handlers onTouchStart/onTouchEnd du swipe sont posés sur le conteneur enveloppant MonthGrid/WeekView, où vivent les cartes draggables. dnd-kit ne supprime que le click synthétique post-drag, pas la propagation du touchend ; useSwipe ignore l'état drag, seuil 56 px (calendar-types.ts:102).
- **Scenario d echec / cout a l echelle** : long-press sur une carte, drag horizontal ~100 px, relâchement : le drop applique l'override ET onTouchEnd voit dx > 56 → goNext()/goPrev() — le calendrier saute de période à l'instant du dépôt, l'utilisateur perd des yeux la carte posée.
- **Pourquoi ca bloque le scaling** : survivra tel quel au câblage (drop = mutation réelle suivie d'un saut de période) ; toute future zone swipeable contenant des draggables reproduira le conflit.
- **Reco** : gater le swipe sur l'état drag — le DragActiveContext existe déjà (calendar-dnd.tsx:28-33) : flag posé sur onDragStart, nettoyé un tick après onDragEnd, ignoré par onTouchEnd.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

### [P2] Couche interactions grille non traduite : toasts, lastSync et titres fantômes en français en dur
- **Ou** : apps/web/components/app/grid/use-grid-tiles.ts:64-206, use-grid-view.ts:26,53-85, grid-mutations.ts:74,78,98
- **Constat** : le calendrier passe intégralement par `t()` (calendar-actions.ts), mais la grille a une couche hors dictionnaire : ~12 toasts (« Permutation de dates en attente (aperçu) », « Zone verrouillée… »), lastSync (« il y a 2 h »), et les titres des tuiles fantômes (« Nouveau créneau ») persistés dans GridTileData.title. Pluralisation refaite à la main hors i18n.
- **Scenario d echec / cout a l echelle** : en locale EN (la feature de la branche courante), chaque drag/dépôt/action par lot répond en français ; « Nouveau créneau » s'affiche jusque dans le mode présentation client. Au câblage, les titres FR risquent d'être persistés en base (le littéral vit dans l'objet de données).
- **Pourquoi ca bloque le scaling** : deux conventions i18n coexistantes = régression garantie ; chaque nouvelle interaction copiée sur ce pattern creuse l'écart.
- **Reco** : migrer vers les dictionnaires zone grid (passer `t` aux hooks ou retourner clés+params résolus au rendu) ; tuiles fantômes en label bilingue (pattern `loc(fr, en)` déjà utilisé par addNote). Interdire `toast()` avec littéral dans components/app (convention Biome/revue).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun (chantier feat/i18n-fr-en)

### [P2] shiftDays de la grille ajoute n×24 h UTC : dérive d'heure murale à chaque bascule heure d'été/hiver
- **Ou** : apps/web/components/app/grid/grid-date-utils.ts:66-68 (utilisé par use-grid-tiles.ts:171,186-191 et grid-mutations.ts:62-64)
- **Constat** : `shiftDays` fait `getTime() + days*86400000`. Le calendrier documente et évite explicitement ce piège (calendar-actions.ts:90-93 : « ajouter days × 24 h en UTC glisserait de ±1 h ») ; la grille (batchShiftWeek +7 j, insertSlot +1 j) fait exactement ce que le calendrier interdit. retryDate est partiellement protégé par clampToWindow.
- **Scenario d echec / cout a l echelle** : post à 21:00 Europe/Paris un jeudi ; « Décaler d'une semaine » par-dessus le passage à l'heure d'hiver → 22:00 murale, hors fenêtre 9h–21h que grid-date-utils prétend garantir. Sur un lot de 10 tuiles, toutes dérivent. Au câblage, ces ISO deviennent les `run_at` réels.
- **Pourquoi ca bloque le scaling** : deux implémentations divergentes du même calcul dans le même repo : celle de la grille sera copiée par erreur ; les décalages par lot sont l'opération de replanification la plus courante.
- **Reco** : réimplémenter shiftDays via clé jour + heure murale ré-ancrée (dayKeyOf/wallTimeOf/zonedWallToUtcIso existants) et mutualiser l'utilitaire calendrier/grille. Corriger au passage interpolateDate/ensureFuture (grid-date-utils.ts:35-63) qui peut casser l'invariant de tri desc.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12

### [P2] Arithmétique de jours en millisecondes fixes pour toutes les reprogrammations — famille du même défaut, prototype des futures Server Actions
- **Ou** : apps/web/components/app/grid/grid-date-utils.ts:35-73 (ensureFuture/shiftDays/interpolateDate/retryDate) + board-state.ts:132-146 (scheduleBatch)
- **Constat** : (recoupe et généralise les deux findings précédents shiftDays/scheduleBatch) « demain », « +n jours » et l'échelonnement en lot sont calculés en multiples de 24 h ms alors que la sémantique produit est murale (« demain à la même heure, fenêtre 9h–21h fuseau client »). clampToWindow ne corrige que si on sort de 9h–21h et suppose des offsets à l'heure pleine.
- **Scenario d echec / cout a l echelle** : portés tels quels en Server Actions : un report automatique « quota atteint → +24h » (décision actée) programmé le 24/10 à 21h00 atterrit le 25/10 à 20h00 ; un échelonnement de 10 posts « 1/jour à 18h » bascule à 17h à mi-série.
- **Pourquoi ca bloque le scaling** : deux fois par an, sur toute la base clients simultanément, avec des publications réelles en jeu — le « décalage horaire silencieux » que lib/tz.ts:4 existe pour empêcher. La primitive correcte existe déjà.
- **Reco** : réécrire shiftDays/retryDate/scheduleBatch en arithmétique calendaire murale (wallClockIn → décalage jour → zonedWallToUtcIso, comme composer-utils.nextSlotIso). Réserver l'arithmétique en ms aux durées pures (interpolation ordonnée).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §5 (report auto quota) ; §12

### [P2] Chaque tuile publiée/importée est un droppable individuel et le feed n'est pas paginé : coût O(n) au drag start avec des années d'historique
- **Ou** : apps/web/components/app/grid/locked-grid-tile.tsx:30-33 (+ grid-board.tsx:89-109, feed-grid.tsx:53-58)
- **Constat** : LockedGridTile enregistre un useDroppable par tuile uniquement pour l'anneau « interdit » au survol ; dnd-kit mesure tous les droppables (getBoundingClientRect) à chaque début de drag et les inclut dans closestCenter à chaque mouvement. FeedGrid rend l'intégralité de `published` + `imported` sans pagination ni virtualisation.
- **Scenario d echec / cout a l echelle** : compte IG avec 3 ans d'historique (~800 posts importés) : 800+ droppables mesurés à chaque prise de tuile → jank de centaines de ms au drag start sur mobile + DOM de milliers de nœuds au premier rendu.
- **Pourquoi ca bloque le scaling** : coût croissant avec chaque post publié, pour toujours — structurel, pas un pic. Au câblage : autant de lignes imported_posts chargées par visite.
- **Reco** : UN droppable englobant les zones verrouillées (le rejet passe déjà par `over.data.current?.locked`, use-grid-tiles.ts:78/109) ; paginer published/imported (« Afficher plus », fenêtre initiale ~2-3 mois) — la zone planifiée triable reste bornée par nature.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P2] ReviewActions n'a aucune couture de câblage : pas de contentId, pas de server action, décision = toast pur, double-clic non protégé
- **Ou** : apps/web/components/portal/review-actions.tsx:11-22
- **Constat** : le composant ne reçoit que `contentTitle` (string d'affichage). Approve et request-changes appellent `recorded()` (toast + reset local). Aucun identifiant de contenu, aucune notion de version (alors qu'ApprovalHistory affiche versionLabel), aucun état pending, bouton cliquable en rafale ; le parent a `contentId` en scope (page.tsx:36) mais ne le transmet pas.
- **Scenario d echec / cout a l echelle** : au câblage : impossible d'insérer l'approval (INSERT-ONLY, PRD §6) sans réécrire l'interface du composant ET le parent. Double-clic = double insert. Décision prise sur la version N alors que l'agence a poussé N+1 = approbation ambiguë.
- **Pourquoi ca bloque le scaling** : c'est LE point d'écriture du portail (approve/changes_requested pilote toute la machine à états ContentItem). Sans couture server-action dès maintenant, le câblage impose de retoucher page serveur + composant + façade en même temps — ce que la phase mock devait éviter.
- **Reco** : passer `contentId + versionLabel` en props ; extraire une server action `submitReviewDecision({contentId, decision, message, versionLabel})` Zod-validée (impl mock : no-op + toast) ; `isPending` (useTransition) avec boutons disabled et refresh après succès. UI visuelle identique.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §7 ; PRD §6 approvals INSERT-ONLY

### [P2] Espace d'URL sans préfixe /app alors que le middleware acté (CLAUDE.md §9) protège startsWith('/app') — matrice de protection à l'envers au câblage
- **Ou** : apps/web/lib/routes.ts:4-9 (+ absence de apps/web/middleware.ts)
- **Constat** : routes.ts expose /dashboard, /clients, /agenda, /settings/accounts, /notifications sans préfixe /app (les groupes (app)/(portal)/(auth) sont invisibles dans l'URL). Le middleware de référence CLAUDE.md §9 protège via `pathname.startsWith('/app')` et redirige vers /app/dashboard. Aucun middleware n'existe.
- **Scenario d echec / cout a l echelle** : au câblage auth, coller le middleware de référence tel quel : /dashboard, /clients/*, /agenda ne matchent aucun garde → fail-open (return response final) pour tout l'espace d'URL réel. Scénario d'échec le plus probable du Lot 0 : le document « qui fait foi » décrit un espace d'URL qui n'est pas celui du front validé. (Nuance : (app)/layout.tsx et getActiveOrg() restent des verrous prévus en aval.)
- **Pourquoi ca bloque le scaling** : chaque nouvelle route doit être classée publique/app/portal ; sans source unique de classification, la matrice middleware dérive à chaque feature.
- **Reco** : trancher maintenant (garder l'URL space sans /app, validé visuellement) : middleware.ts squelette classant par préfixes dérivés de routes.ts (PUBLIC = /, /login, /otp, /api/health, /api/oauth ; PORTAL = /portal ; APP = tout le reste), user mocké toujours présent en preview. Mettre à jour CLAUDE.md §9.
- **Effort** : S   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §9 — divergence doc/code à résorber

### [P2] Flow auth sans gestion de ?next= et sans transport de l'email vers /otp — le câblage Supabase (signInWithOtp/verifyOtp) casse le parcours
- **Ou** : apps/web/components/auth/login-form.tsx:40-54 et components/auth/otp-form.tsx:67-78
- **Constat** : sendMagicLink() et enterDemo() font router.push(dashboard) inconditionnellement ; sendOtp() pousse '/otp' statique sans transporter l'email. verify() ne connaît donc pas l'email, or `supabase.auth.verifyOtp` exige `{email, token}`. Aucun composant ne lit `?next=` alors que le middleware acté redirige vers `/login?next=...`. Magic link → dashboard immédiat au lieu d'un état « email envoyé ». resend() sans cooldown.
- **Scenario d echec / cout a l echelle** : reviewer invité → /login?next=/portal/ct_x → après auth, atterrit sur /dashboard qu'il n'a pas le droit de voir (pas d'org) → boucle. OTP : impossible d'appeler verifyOtp sans l'email = parcours mobile PWA (prioritaire iOS) cassé.
- **Pourquoi ca bloque le scaling** : l'auth est le seul chemin d'entrée de TOUS les rôles ; le routage post-login par rôle (app vs portal) n'a aucun point d'ancrage aujourd'hui.
- **Reco** : 1) lire `next` via searchParams (page serveur → prop) et le propager ; 2) transporter l'email vers /otp (query param) et l'afficher ; 3) modéliser l'état « lien envoyé » pour le magic link ; 4) router post-auth par rôle : membre d'org → next ou /dashboard, reviewer → /portal.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 auth + §8 (anti-pattern magic link mobile)

### [P2] Portail câblé en dur sur un seul client / un seul reviewer (DEMO_REVIEWER_CLIENT_ID dispersé dans 3 fichiers)
- **Ou** : apps/web/app/(portal)/layout.tsx:11-12, portal/page.tsx:19-20, portal/[contentId]/page.tsx:40
- **Constat** : layout, liste et détail importent chacun DEMO_REVIEWER_CLIENT_ID et résolvent client + reviewer indépendamment. `getReviewer(clientId)` prend le premier reviewer du client (index.ts:82-84) — identité résolue client→reviewer alors que le modèle cible (CLAUDE.md §3) est session→reviewer→clientS (pluriel via client_members).
- **Scenario d echec / cout a l echelle** : reviewer membre de 2 clients (contact marketing d'un groupe à 2 enseignes) : header figé sur un client, liste tronquée, contenus du second inaccessibles (notFound), footer « connecté en tant que » potentiellement au mauvais nom.
- **Pourquoi ca bloque le scaling** : la signature même de la façade est incâblable — aucune requête Supabase ne correspond à « LE reviewer d'un client ». Le layout single-client verrouille l'IA du portail sur une hypothèse fausse du modèle de données.
- **Reco** : `getPortalContext()` unique dans la façade retournant `{ reviewer, clients: Client[] }` (impl mock : [getClient(DEMO_REVIEWER_CLIENT_ID)]). Liste = une section par client (avec 1 client, rendu strictement identique). Au câblage : session + client_members via RLS.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §3 contexte Reviewer

### [P2] Casts 'as Client' masquant undefined sur le chemin critique du portail, sans aucun error boundary dans l'app
- **Ou** : apps/web/app/(portal)/portal/page.tsx:19 et portal/[contentId]/page.tsx:45
- **Constat** : `getClient()` retourne `Client | undefined` (index.ts:44-46) ; les deux pages forcent `as Client` puis accèdent `client.timezone`. Aucun error.tsx/global-error.tsx dans tout app/. Même pattern dans getUnifiedAgenda (index.ts:126). Ironie : la page détail utilise notFound() correctement 5 lignes au-dessus du cast.
- **Scenario d echec / cout a l echelle** : au câblage : client archivé/supprimé pendant qu'un reviewer a un onglet ouvert → getClient retourne null → TypeError serveur → écran d'erreur Next brut, sans boundary, sur la page la plus exposée à des utilisateurs externes.
- **Pourquoi ca bloque le scaling** : le cast `as` neutralise exactement la garantie que TS strict devait donner au branchement Supabase — chaque cast est un crash différé qui ne se révèle qu'en prod avec des données réelles.
- **Reco** : remplacer les casts par `if (!client) notFound()`. Ajouter au minimum un error.tsx dans (portal)/ (message neutre face au client final). Interdire `as Client` en revue.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 r.25 (esprit : pas de cast masquant null)

### [P2] MediaCarousel rend les vidéos via next/image sur fullUrl : aucun playback, rupture garantie quand fullUrl deviendra une URL signée .mp4
- **Ou** : apps/web/components/portal/media-carousel.tsx:38-55
- **Constat** : le carrousel rend systématiquement `<Image src={current.fullUrl}>` et se contente d'un badge « Video » si type === 'video'. Ça marche en démo uniquement parce que les mocks donnent aux vidéos une fullUrl d'image (lib/mocks/content.ts:47-58 : mimeType 'video/mp4' mais url d'un pool d'images). Aucun élément `<video>` dans tout apps/web.
- **Scenario d echec / cout a l echelle** : au câblage : media_assets vidéo → URL signée 48h vers un .mp4 → next/image échoue (optimiseur d'image sur un flux vidéo) → slide cassée. Pire : le client doit approuver un Reel (format cœur du produit) sans pouvoir le visionner.
- **Pourquoi ca bloque le scaling** : le même composant servira toutes les surfaces média du portail ; chaque format vidéo ajouté (Reel, story, TikTok) retombe sur le même mur.
- **Reco** : brancher sur type === 'video' : `<video controls playsInline poster={thumbUrl}><source src={fullUrl}/></video>` — les mocks actuels (fullUrl = image) continuent de rendre un visuel via poster, rendu démo inchangé. Afficher durationSec (déjà dans le type).
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun (specs média PRD : Reels MP4)

### [P2] Le portail n'offre aucun moyen de créer les annotations/commentaires que la démo elle-même met en scène comme rédigés par le reviewer
- **Ou** : apps/web/components/portal/annotation-viewer.tsx:12-72 (viewer read-only) vs lib/mocks/interactions.ts:24-32,59-66
- **Constat** : les mocks contiennent des commentaires role 'reviewer' AVEC annotation positionnée (x/y sur une slide) — données qui n'ont pu naître que dans le portail. Or le portail ne propose ni composer de commentaire, ni pose de pin : la seule saisie reviewer est le textarea global de « demander des modifications » (review-actions.tsx:53-59), qui produit un message d'approval, pas un Comment annoté. Le PRD verrouille pourtant les annotations (pin) en MVP (PRD:98, :298, :573).
- **Scenario d echec / cout a l echelle** : au câblage, le parcours vendu par la démo validée (« le client pointe un détail sur la photo ») est impossible ; comments.annotation reste vide côté reviewer. L'écart démo/produit se découvre au pire moment (premiers vrais clients).
- **Pourquoi ca bloque le scaling** : la pose de pin est une interaction structurante ; la concevoir après coup sur un viewer read-only impose de refactorer carousel + viewer + fil ensemble (atténué : MediaCarousel a déjà un prop overlay, AnnotationViewer possède l'état de slide — l'ajout est additif).
- **Reco** : acter la décision produit maintenant : (a) différer officiellement et retirer les annotations reviewer des mocks (la démo ne survend plus), ou (b) — recommandé — ajouter le mode « ajouter un pin » (clic sur MediaCarousel → x/y normalisés → mini-composer) avec server-action seam mockée ; le viewer a déjà toute la géométrie (pins x*100%/y*100%).
- **Effort** : L   **Impact scaling** : moyen
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : PRD §6 comments.annotation

### [P2] Agenda unifié : semaines ancrées sur des minuits UTC — colonnes décalées d'un jour pour tout fuseau à offset négatif, durée négative sur événement franchissant minuit
- **Ou** : apps/web/components/app/agenda/agenda-utils.ts:85-98 (startOfWeekMonday/addDays) + :75-82 (durationFraction) ; unified-agenda.tsx:64-74
- **Constat** : les 7 jours de la semaine sont des Date à minuit UTC, convertis en clés jour via dayKeyOf(date, tz), sous des en-têtes statiques par index (WEEKDAY_KEYS, week-grid.tsx:81). Pour Europe/Paris (offset +) c'est correct ; pour un fuseau à offset négatif (Martinique, Québec — marchés francophones), minuit UTC lundi = dimanche soir local → toute la grille glisse dim→sam. `durationFraction` calcule endMin−startMin sur les heures murales du même jour : événement 23h→1h = raw négatif écrasé à 4 % (bloc tronqué).
- **Scenario d echec / cout a l echelle** : freelance aux Antilles (TZ du freelance pour l'agenda, CLAUDE.md §12) : lundi affiché sous « mar », fenêtre de filtrage décalée ; événement Google/Outlook nocturne (vol, astreinte) affiché en bloc de 24 px une fois le vrai sync câblé (Lot 4).
- **Pourquoi ca bloque le scaling** : le sync Google+Outlook injectera des événements réels multi-fuseaux et franchissant minuit — les deux hypothèses implicites (offset positif, événement intrajournalier) seront violées dès les premières données réelles.
- **Reco** : ancrer la semaine en DayKey calculée dans le fuseau d'affichage (même contrat que le fix P0 calendrier) ; durée = end−start en millisecondes d'instants (Date.parse), clippée aux bornes 7h–21h du jour affiché.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12 (TZ du freelance pour l'agenda)

### [P3] validateCarousel appliqué même sans aucune plateforme API ciblée : une limite Meta bloque un contenu newsletter/sur-mesure
- **Ou** : apps/web/components/app/studio/composer/preflight.ts:105
- **Constat** : dans mediaItem, `validateCarousel(draft.media.length)` est poussé inconditionnellement dès que format === 'carousel', alors que la boucle validateMedia juste au-dessus (l.100-104) est correctement scopée aux plateformes API (validateMedia retourne [] pour newsletter/custom — specs.ts:136). CAROUSEL_LIMITS est documenté « limite API Meta » (specs.ts:34). Le même défaut de scoping existe dans composer-media.tsx:107/127/242 (bouton d'ajout désactivé à 10 même pour un canal manuel).
- **Scenario d echec / cout a l echelle** : carrousel ciblant uniquement newsletter : warning « min 2 visuels » injustifié + impossible d'ajouter un 11e visuel pour un canal manuel (picker grisé).
- **Pourquoi ca bloque le scaling** : chaque règle plateforme non scopée devient un faux bloquant à mesure que les canaux manuels s'enrichissent ; le pattern correct existe trois lignes plus haut — dérive de scoping qui se reproduira à chaque nouvelle règle.
- **Reco** : conditionner l'appel aux plateformes API ciblées (comme validateMedia via son switch), dans preflight.ts ET composer-media.tsx.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

### [P3] preflight.ts à 296 lignes : infraction à la règle de fer ≤ 250 lignes
- **Ou** : apps/web/components/app/studio/composer/preflight.ts:1-296
- **Constat** : 9 vérificateurs (targets, accounts, media, caption, hashtags, banned, approval, date, alt) + computePreflight + hasBlocking = 296 lignes, au-dessus du plafond CLAUDE.md §2 r.24. L'un des 3 fichiers métier en infraction du repo.
- **Scenario d echec / cout a l echelle** : chaque nouveau check (quota par compte, lien FB, TikTok brouillon — tous prévus au PRD) allonge le fichier ; la revue de la logique bloquante devient de moins en moins auditable sur le composant le plus sensible du studio.
- **Pourquoi ca bloque le scaling** : le preflight grossira à chaque plateforme et sera partiellement mirroré côté Server Action ; un monolithe rend l'extraction vers packages/shared plus coûteuse.
- **Reco** : scinder en preflight/items-*.ts (items-content, items-targeting, items-scheduling), preflight.ts réduit à l'orchestrateur + types. Zéro changement de comportement (vérificateurs déjà des fonctions pures indépendantes).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §2 r.24

### [P3] captionOverrides orphelins : les déclinaisons des canaux manuels et des comptes dé-ciblés survivent dans le brouillon, invisibles et non scannées
- **Ou** : apps/web/components/app/studio/composer/preflight.ts:192-196 (+ composer-types.ts:131-134, composer-caption.tsx:67-75)
- **Constat** : bannedItem ne scanne que les overrides des plateformes API ciblées. Or draftFromContent recopie les captionOverride de TOUTES les cibles (y compris newsletter/custom), et composer-caption n'affiche des onglets que pour les plateformes API. Un override de canal manuel, ou un override IG après dé-sélection du compte, reste dans draft.captionOverrides : invisible, non éditable, non vérifié (mots interdits, longueur). newsletterSubject non scanné non plus. Aucune purge à la dé-sélection (composer-targets.tsx:33-45).
- **Scenario d echec / cout a l echelle** : override newsletter contenant un mot interdit du brand kit : preflight affiche « aucun mot interdit » alors que le texte partira tel quel. Variante : override IG écrit, compte retiré, re-ciblé plus tard → texte oublié qui ressurgit silencieusement. Au câblage : content_targets.caption_override dangling sur des cibles disparues.
- **Pourquoi ca bloque le scaling** : petite fuite de cohérence qui grossit avec le nombre de canaux.
- **Reco** : (1) bannedItem scanne Object.values(draft.captionOverrides) + newsletterSubject ; (2) à la dé-sélection d'une cible, purger l'override correspondant (ou l'afficher comme « déclinaison orpheline » avec action de suppression).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : aucun

### [P3] Libellés de jour et ancrage des notes décalés d'un jour pour les fuseaux à offset ≥ +12 (Pacific/Wallis, territoire français)
- **Ou** : apps/web/components/app/calendar/calendar-utils.ts:101-108 (+ use-calendar-state.ts:90)
- **Constat** : `weekdayDayMonth` formate l'ancre midi-UTC de la clé avec `timeZone: tz` alors que la clé est DÉJÀ résolue dans le fuseau client : pour tz ≥ UTC+12 (Pacific/Wallis, Auckland en été), midi UTC tombe le lendemain → aria-labels, titres du DaySheet et toasts de drop affichent le mauvais jour. Même ancre midi-UTC pour les notes locales, re-résolue via dayKeyOf(tz) : note ajoutée au jour J affichée en J+1.
- **Scenario d echec / cout a l echelle** : client à Wallis-et-Futuna (UTC+12, cible FR légitime) : drop sur « lundi 9 » → toast « déplacé au mardi 10 », panneau Jour titré au lendemain, note posée sur le mauvais jour.
- **Pourquoi ca bloque le scaling** : invisible en métropole, systématique dès le premier client Pacifique ; le pattern « re-formater une clé jour avec le tz client » se propage facilement.
- **Reco** : formater les clés jour avec `timeZone: "UTC"` (la clé est calendaire, l'ancre midi-UTC est faite pour ça) ; ancrer les notes via zonedWallToUtcIso(dayKey, 12:00, tz) plutôt que `T12:00:00.000Z`.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §12

### [P3] Drop sur « aujourd'hui » : l'heure murale conservée peut planifier dans le passé
- **Ou** : apps/web/components/app/calendar/calendar-schedule.ts:76-79 (+ calendar-actions.ts:26-33)
- **Constat** : performDrop rejette dayKey < todayKey mais accepte todayKey ; movedIso conserve l'heure murale d'origine. Un item à 08:00 déposé sur aujourd'hui à 15:00 obtient un scheduledAt déjà passé, sans garde ni message (contrairement à defaultCreationTime qui borne les créations). Même trou dans performShift (calendar-actions.ts:94-98) pour le même jour.
- **Scenario d echec / cout a l echelle** : au câblage : scheduledAt passé → publish_job avec run_at < now → publication immédiate non voulue si < 2 h de retard, ou failed direct au-delà (fenêtre de grâce §5) — dans les deux cas pas l'intention de l'utilisateur. Cas quotidien (replanifier la publication du matin ratée vers aujourd'hui).
- **Pourquoi ca bloque le scaling** : incohérence interne (le codebase interdit déjà la planification passée ailleurs) qui passe telle quelle au câblage.
- **Reco** : dans movedIso, si dayKey === todayKey et heure murale passée → retomber sur defaultCreationTime (prochaine heure pleine 9-21 h) et le dire dans le toast.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : oui   **Verrou PRD/CLAUDE.md** : CLAUDE.md §5 (fenêtre de grâce 2 h)

### [P3] Pins d'annotation résolus par slideIndex dénormalisé au lieu de mediaAssetId — champ qui n'existera pas en DB
- **Ou** : apps/web/components/portal/annotation-viewer.tsx:26-30
- **Constat** : slidePins filtre sur annotation.slideIndex et focusComment fait setSlideIndex(annotation.slideIndex). Le type Annotation mock porte mediaAssetId ET slideIndex (types/collab.ts:28-33), mais le schéma cible PRD §6 définit annotation jsonb = {media_asset_id, x, y} — sans slideIndex. mediaAssetId, la vraie clé, n'est jamais utilisé par le viewer (pattern aussi présent dans content-detail-media.tsx:43 et detail-thread-items.tsx:48).
- **Scenario d echec / cout a l echelle** : l'agence réordonne les slides d'un carrousel après une annotation client (cas courant en changes_requested) : le pin pointe un autre visuel → correction faite sur la mauvaise slide. Au câblage, slideIndex absent de la DB force de toute façon la réécriture.
- **Pourquoi ca bloque le scaling** : divergence de contrat silencieuse (le champ « marche » en démo) entre types mocks et schéma PRD.
- **Reco** : résoudre l'index au rendu : `media.findIndex(m => m.id === c.annotation.mediaAssetId)` ; retirer slideIndex du type Annotation. Rendu démo strictement identique.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : PRD §6 comments.annotation jsonb

### [P3] Formulaires login/OTP hors stack imposée (pas de React Hook Form + Zod, regex email maison)
- **Ou** : apps/web/components/auth/login-form.tsx:13-21 et components/auth/otp-form.tsx:20-25
- **Constat** : validation email par regex locale EMAIL_RE + useState brut ; OTP géré par un widget 6 cases maison (useState + refs) alors que la stack impose RHF + Zod (CLAUDE.md §1) et que shadcn fournit un InputOTP.
- **Scenario d echec / cout a l echelle** : au câblage, la validation sera dupliquée côté server action (Zod) : deux sources de vérité divergent (EMAIL_RE accepte des adresses que z.string().email() refuse, ex. a@b..c) → messages d'erreur incohérents client/serveur.
- **Pourquoi ca bloque le scaling** : faible surface mais c'est l'exemple canonique que les futurs formulaires copieront.
- **Reco** : migrer vers RHF + zodResolver avec schéma partagé (packages/shared à terme) réutilisé par la future server action. Rendu et comportements identiques.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md §1 forms + §2 r.27

### [P3] Cache module-level non borné dans zonedParts (clé iso|tz) — croissance mémoire monotone avec des données réelles
- **Ou** : apps/web/components/app/agenda/agenda-utils.ts:34-62
- **Constat** : partsCache est une Map au niveau module accumulant une entrée par instant ISO unique, sans éviction. Les importeurs sont 'use client' mais SSR-rendent : en prod le process Node long-vivant partage cette Map entre toutes les requêtes de tous les tenants. Bonus : le cache recrée l'Intl.DateTimeFormat coûteux à chaque miss (l.40) et ne met en cache que le résultat bon marché.
- **Scenario d echec / cout a l echelle** : après câblage du sync Google+Outlook : milliers d'événements aux timestamps uniques, renouvelés à chaque semaine de navigation, par tenant → croissance monotone côté serveur (fuite lente ; l'OOM réel reste toutefois lointain à ~200 octets/entrée).
- **Pourquoi ca bloque le scaling** : anti-pattern classique de cache sans borne dans un singleton de module, O(événements distincts jamais vus) × tenants.
- **Reco** : supprimer le cache de résultats et ne mettre en cache que l'Intl.DateTimeFormat par tz (pattern déjà correct dans calendar-utils.ts:19-33), ou LRU ~1000 entrées si un profil prouve le besoin.
- **Effort** : S   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : aucun

### [P3] history.ts dépasse la règle des 250 lignes (270)
- **Ou** : apps/web/lib/mocks/history.ts:1-270
- **Constat** : deux jeux de données indépendants (CONTENT_VERSIONS + getter, l.7-79 ; ACTIVITY_ENTRIES + getter, l.83-270) sans dépendance mutuelle, au-dessus de la limite CLAUDE.md r.24.
- **Scenario d echec / cout a l echelle** : aucun échec runtime — dérive de la règle de fer qui, tolérée ici, se propage.
- **Pourquoi ca bloque le scaling** : ces mocks sont le miroir des futures tables content_versions/activity_log : les scinder donne un fichier-par-table mappant 1:1 sur les futurs fetchers Supabase.
- **Reco** : scinder en versions.ts et activity.ts, ré-exportés par lib/mocks/index.ts (façade déjà en place, index.ts:24) — invisible pour les consommateurs.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou PRD/CLAUDE.md** : CLAUDE.md r.24

## Code production-grade propose (NON applique)

**Fix P0 — clés de grille en UTC pur (calendar-utils.ts)** :
```ts
// Contrat : ne dépend QUE de la clé/du curseur, jamais du fuseau du runtime.
function mondayOfUtc(d: Date): Date {
  const r = new Date(d);
  const dow = (r.getUTCDay() + 6) % 7; // 0 = lundi
  r.setUTCDate(r.getUTCDate() - dow);
  return r;
}
export function weekGridKeys(anchorKey: DayKey): DayKey[] {
  const start = mondayOfUtc(dateFromKey(anchorKey)); // ancre midi UTC existante
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return keyFromDate(d); // getUTC* : cohérent car tout est UTC
  });
}
// Test CI : exécuter sous process.env.TZ = 'UTC' puis 'Pacific/Kiritimati'
// et asserter la même sortie.
```

**Couture temps (lib/clock.ts)** :
```ts
// Unique point d'accès au temps. Phase preview : horloge figée.
// Au câblage : le Server Component sérialise now et le passe en prop.
import { MOCK_NOW } from "@/lib/mocks/time";
export function now(): Date {
  return new Date(MOCK_NOW); // impl. future : injectée (prop/contexte), jamais Date.now() nu côté client
}
// Règle CI (grep) : import de "@/lib/mocks/time" interdit hors lib/clock.ts.
```

**Permutation restreinte aux tuiles visibles (grid-mutations.ts)** :
```ts
export function permuteDates(
  tiles: GridTileData[],
  fromId: string,
  toId: string,
  isVisible: (t: GridTileData) => boolean, // NOUVEAU : prédicat fourni par feed-grid
): GridTileData[] {
  const movable = tiles.filter((t) => isSortable(t) && isVisible(t));
  // arrayMove uniquement sur `movable` ; les tuiles filtrées gardent date ET position.
  ...
}
```

**Décalage de jours DST-correct partagé (lib/tz.ts)** :
```ts
export function shiftDaysWall(iso: string, days: number, tz: string): string {
  const { dayKey, hh, mm } = wallClockIn(iso, tz);   // décomposition murale
  const shifted = shiftDayKey(dayKey, days);          // arithmétique calendaire pure
  return zonedWallToUtcIso(shifted, hh, mm, tz);      // ré-ancrage mural → UTC
}
// Remplace grid-date-utils.shiftDays et board-state.scheduleBatch (pas fixes en ms).
```

## Ce qui va bien (a preserver)
- **`lib/tz.ts` et les primitives murales du composer** (`zonedWallToUtcIso`, `wallClockIn`, `shiftDay`) sont correctes et documentées — le problème n'est jamais la primitive mais son non-usage ; les mutualiser, ne pas les réécrire.
- **Le modèle overlay du calendrier** (`use-calendar-state.ts:69-107` : props = source de vérité, Map d'overrides fusionnée en useMemo) est exactement le pattern à généraliser à la grille — c'est le bon seam TanStack Query/Realtime.
- **`calendar-actions.ts`** : arithmétique de dates murale correcte, entièrement passé par `t()` (i18n), et commente ses pièges (l.90-93) — la référence interne à imposer partout.
- **Toutes les pages sont des async Server Components** avec composants clients feuilles : la topologie de câblage Supabase est bonne, pas de réécriture de structure à prévoir.
- **La façade `lib/mocks/index.ts`** existe et la liste portail l'utilise correctement (getPortalContent avec REVIEWER_VISIBLE) — étendre ce pattern (getPortalContentItem, getPortalContext, ranges), ne pas le contourner.
- **La discipline de multi-sélection de la grille** (feed-grid.tsx:91-101 élague les tuiles invisibles avant les actions par lot) montre que le réflexe « ne jamais muter l'invisible » existe — l'appliquer au chemin drag.
- **grid-workspace.tsx:69-73** (MouseSensor + TouchSensor) est la bonne config dnd tactile ; en faire le helper partagé.
- **MOCK_NOW figé pour le déterminisme d'hydratation** est une bonne décision de preview — le défaut est l'absence de couture, pas la constante elle-même.
- **Le preflight en fonctions pures indépendantes** : découpage trivial, et base saine pour le mirror Server Action / packages/shared.
