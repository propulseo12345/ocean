# Session State — 2026-07-22 (câblage Supabase : Phases 1→8 faites)

## Branch / Commit
`feat/cablage-supabase` @ `42a75cd`. Working tree propre.
Rien n'est poussé, aucune PR mergée (décision actée : on merge à la fin).

## ⏭️ REPRISE — Phase 11 (DERNIÈRE, plan `.planning/PLAN_NUIT_cablage-phases-8-11.md`)
Exécution autonome des 4 dernières phases (8→11). **Phases 8 (2/2) + 9 + 10
FAITES et vérifiées** (commits `dcc5d0c`, `bf6d8dc`, `42a75cd`). Reprendre à la
**Phase 11** : DÉGELER `lib/clock.ts` (vrai now()), relocaliser
`lib/mocks/types`→`lib/domain`, SUPPRIMER `lib/mocks/**` (+ `loc`, `Client.theme`,
`lib/mocks/images`, DemoBanner), suite pgTAP complète rejouée, vérif runtime
post-dégel. `get_advisors` + régén types.ts = handoff Étienne (MCP autre compte).

## ⚠️ RÉSIDUS DE TEST EN LIGNE (Client de demo — à purger SQL par Étienne)
Deux contenus de test créés au runtime, non supprimables via l'UI :
- `88c1a509…` / **« TEST NUIT 8 »** `c092f256-d215-4f7a-9a15-653d3371857d` —
  soft-deleted (corbeille).
- `88c1a509…` / **« TEST PUB 9 »** `f69aa705-d43d-4994-8792-8ec6d0f3ae9e` —
  `published` (terminal, read-only) + 1 cible newsletter publiée manuellement.
Purge : `delete from content_items where id in ('c092f256-d215-4f7a-9a15-653d3371857d','f69aa705-d43d-4994-8792-8ec6d0f3ae9e');`
(les content_targets/content_media cascaderont).

## 🌙 FAIT CETTE NUIT (2026-07-21→22)
### Phase 8 (2/2) — câblage UI des écritures cœur — commit `dcc5d0c`
Les 4 surfaces branchées aux Server Actions (écrites en 8 1/2), **vérifiées
runtime create-verify-delete** sur le projet en ligne (session linda@socean.com,
client « Client de demo ») :
- **Composer → saveContentItem** : création OK, round-trip hashtag vérifié
  (« Recette test #promo » → caption « Recette test », #promo réinjecté sans
  doublon à l'édition). `saving` anti-double-envoi, médias sans libraryAssetId
  écartés (toast).
- **Board kanban → applyStatusIntent** : drag draft→in_review, **persisté**
  (rechargement complet ⇒ « In review »). Optimiste + rollback sur échec.
- **Calendrier → scheduleContentItem** : drag shelf→jour, undated→daté 11:00,
  **persisté** (détail ⇒ « Sat, Jul 4 · 11:00 AM »). Optimiste + rollback.
- **Corbeille → trashContent / restoreContent** : Discard→corbeille (disparaît
  du studio), Restore→retour studio. Les deux persistés.
- i18n fr+en : « (aperçu) » retiré des toasts désormais réels + clés d'erreur.
- **⚠️ Résidu de test** : le contenu « TEST NUIT 8 » (client « Client de demo »,
  id `c092f256-d215-4f7a-9a15-653d3371857d`) est **soft-deleted dans la corbeille**
  (pas d'action hard-delete UI, pas d'accès SQL au projet online). À purger à la
  main par Étienne si voulu (`delete from content_items where id='c092…'`).
- **Piège payé (runtime)** : dnd-kit + Playwright `dragTo` mono-étape ne déclenche
  pas le drop (le pointeur n'atteint pas le droppable). Solution : PointerEvents
  manuels multi-étapes async (pointerdown sur le card → N pointermove sur document
  avec délais → pointerup au centre exact de la section droppable). Le card est un
  `<div role=button aria-roledescription=draggable>`, les colonnes des `<section
  aria-label="… column">`. Les rects droppables sont mesurés au pickup → viser le
  centre exact, pas une bordure.
- **Piège payé (browser MCP)** : profil chrome MCP verrouillé par une instance
  orpheline (« Browser is already in use ») → tuer UNIQUEMENT les chrome du profil
  `mcp-chrome-<hash>` (via CommandLine LIKE `*mcp-chrome-*`), jamais le navigateur
  normal ni d'autres projets.

### Phase 9 — câblage UI des actions déjà écrites — commit `bf6d8dc`
- **markTargetPublishedManually** (detail-manual-center, bouton « Publié ») :
  **VÉRIFIÉ RUNTIME** — contenu frais programmé → cible newsletter « Published »
  → rechargement complet = statut agrégé `published`, permalink sauvé, centre
  manuel disparu. RPC pose status='published' (interdit à authenticated) en
  SECURITY DEFINER.
- **requestTargetRetry** (content-targets retry, RÈGLE 15) : pose
  retry_requested_at, ne remet PAS en file (worker seul). Override optimiste +
  rollback. Wording corrigé (plus de « replacée en file »).
- **submitReviewDecision** (portal review-actions) : approuver / demander modifs.
  Vérif = typecheck + build + pgTAP 013 (pas de compte reviewer, pas de runtime).
- **postComment** (detail-thread, réponse client owner, visibility='client') :
  persisté, refresh lit la ligne canonique.
- i18n fr+en nettoyée + clés d'erreur. Dead code `locale` du portail retiré.
- **DIFFÉRÉ (documenté)** : composer commentaire/annotation PORTAIL (annotation-
  viewer read-only, aucun composer) ; note interne du fil (getComments sans
  `visibility` → note interne fuirait dans l'onglet client) ; média attach/delete/
  alt (médiathèque vide, assets = mock/TUS exclu, ids non-uuid → l'action réelle
  échoue). À câbler quand TUS + composer portail existeront (handoff Étienne).

## Fait (11 commits)
| Phase | Commit | Migration | pgTAP |
|---|---|---|---|
| 1 — config éditoriale | f2cb402 | 011 (7 tables + `client_settings` D4) | 33/33 |
| 2 — médias & Storage | 2c8511e | 012 + 012_media_storage | 27/27 |
| 3 — collaboration | 4a92604 | 013 (8 tables + 3 RPC) | 28/28 |
| 4 — feed & performance | 4ca1725 | 014 (3 tables) | 12/12 |
| 5 — agenda unifié | 2c050cf | 015 (4 tables + vue) | 14/14 |
| fix — deploy 010 idempotent | a401103 | — | — |
| **lectures CŒUR + seed** | **5bcdced** | — (tables 004→007) | **16/16** (090) |
| **6 — transitions** | **1e1eab1** | **016** (matrice + 2 RPC) | **19/19** |
| **7 — aplatissement i18n** | **300fc7a** (T1-3) + **8f0c791** (T4) | — | — |
| **8 (1/2) — actions écriture** | **1a8db10** | — | **13/13** (091) |
| **8 (2/2) — câblage UI écritures** | **dcc5d0c** | — | — (UI-only, actions déjà testées) |
| **9 — câblage RPC + portail + fil** | **bf6d8dc** | — | — (UI-only, RPC déjà testées 013/016) |
| **10 — perf réelle & dettes lecture** | **42a75cd** | — | — (lectures ; getPostMetricsBatch + getSavedViews) |

**Suite pgTAP complète 003→016 + 090 + 091 : 231/231, plan == émis sur 16 fichiers.**
**`pnpm --filter web exec tsc --noEmit` : 0 erreur. `pnpm --filter web build` : vert.**
Phase 8 (2/2) ne touche ni migration ni action DB (câblage UI pur) → pgTAP
inchangé ; la suite complète sera rejouée au gate final Phase 11.

## ÉTAT DE L'APPLICATION EN LIGNE (projet hgdeopkmkwyoumsfggrm)

**Confirmé par le diagnostic** : la migration **010 est DÉJÀ appliquée**
(`media_source` existe, et `account_status = connected, needs_reauth, expired`).

**⚠️ NON VÉRIFIÉ — à faire en priorité** : le reste de `deploy/00_diagnostic.sql`,
en particulier la **requête 2** (valeurs de l'enum `activity_kind` en ligne).
Si elle renvoie `edited` / `status_changed` / `review_requested`, l'enum est en
ANCIENNE version et ne correspond pas au type front `ActivityKind` (collab.ts) :
les `Record<ActivityKind, …>` exhaustifs de l'UI (activityKindMeta, KIND_ICONS)
casseraient au premier événement journalisé. `deploy/03` (idempotent) le répare
automatiquement s'il n'est pas encore utilisé par une colonne.

**Ordre d'application restant, SQL Editor :**
(puis `deploy/09_seed_demo.sql` en dernier — il suppose 001→015 + `deploy/02`)
0. `deploy/00_diagnostic.sql` — terminer la lecture (surtout la requête 2)
1. `deploy/03_migration_010.sql` — idempotent, rejouable, répare l'enum
2. `deploy/04_migration_011.sql`
3. `deploy/05_migration_012.sql` — **⚠️ trancher D2 et D3 AVANT** (en-tête du fichier)
4. `deploy/06_migration_013.sql`
5. `deploy/07_migration_014.sql`
6. `deploy/08_migration_015.sql`
7. `deploy/10_migration_016.sql` — matrice 008 amendée + 2 RPC, rejouable
8. `deploy/09_seed_demo.sql` — seed de démonstration (idempotent), en DERNIER

`deploy/10` ne crée aucune table (create or replace + 2 RPC) : rejouable sans
risque, contrairement aux suivants.

`deploy/04` à `08` sont encapsulés dans `begin/commit` : si l'un est déjà passé,
il échoue proprement et annule tout (aucun état partiel).

Après application : régénérer les types. NB `scripts/gen-types.py` **n'écrit pas
encore le fichier** (il ne fait qu'afficher) ; `apps/web/lib/supabase/types.ts`
est maintenu À LA MAIN en attendant — soit finir le script, soit continuer à la main.

## ✅ VÉRIFIÉ AU RUNTIME (2026-07-21, Étienne a appliqué 03→08 + 10 + le seed 09)
Migrations 010→016 EN LIGNE + `deploy/09_seed_demo.sql` appliqué. Playwright sur
le serveur dev (port 3010) connecté au vrai projet `hgdeopkmkwyoumsfggrm`, session
linda@socean.com :
- **Dashboard** : rend les 3 clients seedés + « Client de demo », les 4 échecs,
  le compte à reconnecter, 3 notifications réelles (badge 2 non-lues). **Mon
  extraction jsonb de `last_error` rend le message propre** (« Jeton Instagram
  expire… »), pas `[object Object]`.
- **Détail contenu** (Recette express, Maison Verde) : format Reel, statut
  « Partiellement publié », légende + hashtags réels, **« Cibles (1) : TikTok
  @maisonverde · 2,4 k abonnés »** → `loadTargets` + résolution du compte social
  + `followers_count` fonctionnent ensemble en ligne. « Aucun média » (attendu,
  pas de fichier seedé). Compteurs discussion + mode de validation réels.
- **Zéro erreur serveur** ; les 2 erreurs console sont des warnings Base UI
  `nativeButton` préexistants, sans rapport avec le câblage.

**Reste vérifié uniquement par pgTAP (pas de compte au runtime)** : le portail
Reviewer (aucun compte reviewer seedé — auth.users + client_members requis). La
suite 090 couvre l'isolation portail de façon rigoureuse.

### Cosmétiques constatés au runtime (pas des bugs de câblage)
- Dashboard : « À publier aujourd'hui = 0 » et « Journée libre » alors que le seed
  date des contenus pour aujourd'hui → **gel de l'horloge** (`lib/clock.ts`
  MOCK_NOW = 11 juin ; le seed date par rapport au vrai `now()` = 21 juil). Se
  résout au dégel de la Phase 8.
- « Bonjour linda@socean.com » : `profiles.full_name` est NULL en ligne. `deploy/02`
  pose `full_name='Linda'` en `on conflict do nothing`, mais le trigger
  `handle_new_user` avait déjà créé la ligne (full_name null) → le seed n'écrase
  pas. Corriger à la main en ligne si voulu : `update profiles set full_name='Linda'
  where email='linda@socean.com';`
- Bandeau « Mode démo » (DemoBanner) : statique, à retirer au passage réel.

## Décisions en attente
- **D2** — chemin Storage `{org}/{client}/{media_asset_id}/` **sans**
  `content_item_id` : contredit la règle 21 du CLAUDE.md. Motif : un asset de
  médiathèque n'a pas de `content_item_id` à l'upload et en a N ensuite.
  Appliqué par recommandation du plan, **à confirmer avant `deploy/05`**.
- **D3** — bucket `media-thumbs` PUBLIC (vignette d'un contenu non publié lisible
  par qui obtient l'URL). Acté PRD L409, **à reconfirmer avant `deploy/05`**.
- **D8/D9** — reset mot de passe, lien de dépôt (migration 017, non écrite).
- **D10** — sélecteur de client au portail (UI Phase 3, non câblé).

## ✅ ÉCART STRUCTUREL RÉSORBÉ (commit 5bcdced)
Les 14 lectures cœur sont câblées sur Supabase, dans 5 modules :
`lib/data/{clients,content,content-media,notifications,dashboard}.ts`.
**`lib/data/mock.ts` est SUPPRIMÉ** et `export *` remplacé par des exports
explicites dans `index.ts`.

Pourquoi la suppression maintenant plutôt qu'en Phase 8 : mock et réel avaient
la **même signature** sur `getPortalContent` — seules les règles de shadowing ES
les départageaient, et le typecheck ne pouvait plus dire laquelle gagnait. Un
`export *` mal placé aurait servi des mocks en silence. Le typecheck vert AVEC
`mock.ts` supprimé est la preuve qu'aucun consommateur n'en dépendait.

**Décision de scope à ne pas « corriger »** : l'hydratation d'un ContentItem
(cibles, médias, étiquettes) filtre sur **`client_id`, jamais `org_id`**. Motif :
un Reviewer n'a pas d'org active et peut être invité par deux freelances, alors
que `getReviewerContext().orgId` ne garde que la première appartenance — filtrer
sur org_id lui masquerait silencieusement son second client. Un client
appartient à une seule org (UNIQUE(id, org_id) + FK composites), donc le filtre
client est au moins aussi fort. **Prouvé** par `090_core_reads.test.sql`.

`deploy/09_seed_demo.sql` : seed de démonstration idempotent (3 clients, 7
comptes sociaux, 16 contenus couvrant les 5 types de tâches du dashboard).
**Vérifié en le jouant deux fois** — compteurs identiques. Il ne sème NI médias
(sans fichier Storage réel = vignettes cassées), NI imported_posts/post_metrics
(écriture service_role exclusive, migration 014), NI calendriers (OAuth).

## ✅ PHASE 7 FAITE — aplatissement i18n (commits 300fc7a + 8f0c791)
Contenu client MONOLINGUE (D1). `L<string>` → `string` (34 champs), `pick` et
le type `L` SUPPRIMÉS, `pick(x, locale)` → `x` (147 appels), `loc` réduit à
`loc(fr,_en)=>fr` et **gardé UNIQUEMENT pour les mocks** (`lib/mocks/**`, ~200
appels) qui meurent en Phase 8 — le code permanent (data layer) en est découplé
(`loc(x,x)` → `x`). 40 `locale` morts + no-op maps nettoyés.

**Levier qui a rendu ça sûr** : `pick` rendu tolérant (`L<T> | T`) en T1 → les
147 consommateurs ont compilé à chaque étape ; seuls ~12 fichiers (types +
producteurs) ont dû changer pour basculer. T4 (retrait de pick) = cosmétique.

**Piège payé — NE PAS refaire** : `biome check --write` sur tout le repo
REFORMATE 319 fichiers (virgules traînantes, reflow). Toujours cibler les
fichiers, et pour retirer des imports morts utiliser un script, jamais le
formateur global (`--formatter-enabled=false` bloque aussi le retrait d'imports).

**VÉRIFIÉ RUNTIME** : toggle EN sur /dashboard → l'UI bascule (Dashboard,
Overview, Awaiting approval, Free day…), le contenu reste FR (Maison Verde,
« Recette express en 30 secondes », « Jeton Instagram expire… »). D1 exact.

## Reste à faire — phases du plan de nuit (§ PLAN_NUIT), dans l'ordre
- **Phase 11** (DERNIÈRE, prochaine) — **dégel `lib/clock.ts`** (vrai now()) ; relocaliser
  `lib/mocks/types` → `lib/domain` ; **supprimer `lib/mocks/**`** (+ `loc`,
  `Client.theme`, `lib/mocks/images`, DemoBanner) ; suite pgTAP complète
  rejouée ; `get_advisors` à faire faire par Étienne (MCP autre compte).

## Dettes connues
- **Phase 6 : les 2 RPC ne sont pas encore appelées par des composants.** Les
  Server Actions `markTargetPublishedManually` / `requestTargetRetry` existent
  et sont testées, mais `detail-manual-center` et le bouton retry appellent
  encore les stubs mockés (`performRetry` = un toast).
- Le calendrier reste MOCKÉ de bout en bout (`calendar-actions.ts` = overrides
  locaux + toasts « (aperçu) »). Le drag ne persiste rien. `isMovable` ne gouverne
  que la DATE, pas le statut — c'est `lib/domain/content-status.ts` qui fait foi
  pour les statuts depuis la Phase 6.
- `Client.theme` n'existe pas en base : dérivé de l'id (hash) dans
  `lib/data/clients.ts` pour que `useLibraryAssets.addMockAssets` compile.
  À retirer du type `Client` en Phase 8, avec `lib/mocks/images`.
- Les contenus seedés n'ont AUCUN média tant que l'upload TUS n'est pas câblé :
  la grille et le studio afficheront des tuiles vides. C'est voulu (cf. en-tête
  de `deploy/09_seed_demo.sql`), pas un bug de câblage.
- `saved_views.filters.labels` reçoit des `label_ids` (uuid) mais `board-utils`
  matche encore par NOM → filtre étiquettes inopérant jusqu'au refactor par id.
- N+1 de la grille (un `getPostMetrics` par tuile) non corrigé.
- `perf-data.ts` / `perf-breakdown.ts` / `report-data.ts` importent `@/lib/mocks`
  en SYNCHRONE (contournent la façade) → à passer async+orgId, et supprimer la
  mise à l'échelle mock (`PERIOD_FACTOR` / `DELTA_SHAPE` : des deltas **inventés**
  affichés dans un rapport destiné au client final).
- UI portail (review-actions, annotation-viewer, thread), Route Handler
  d'acceptation d'invitation, emails Brevo : non câblés.
- Upload TUS client + conversion JPEG/HEIC + vignette WebP : non câblés.

## Contexte technique (pièges déjà payés — ne pas les redécouvrir)
- Dev sur **PORT=3010** (3000/3001 pris par d'autres projets). Ne jamais tuer les
  serveurs dev des autres projets (Refreshment, La Clé, CETé…).
- pgTAP : `bash scripts/run-pgtap.sh 0NN <test1.sql> <test2.sql>` (conteneur
  `ocean_rev2`). Le runner saute les fichiers `*_storage.sql` : le schéma
  `storage` du conteneur est ancien (pas de colonnes `public`/`file_size_limit`).
- Docker hors PATH : `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"`
  et `export MSYS_NO_PATHCONV=1` (sinon Git Bash mange les chemins `/tmp`).
- `docker cp dossier ocean_rev2:/tmp/x` **imbrique** si `/tmp/x` existe déjà →
  faire `docker exec ocean_rev2 rm -rf /tmp/x` avant.
- Dollar-quoting pgTAP : `$$ … $t$ … $t$$$` **casse** (le lexer matche `$$` trop
  tôt) → utiliser un tag externe distinct (`$run$`) ou éviter les blocs DO.
- Un **constraint trigger DEFERRED** ne se déclenche qu'au commit → invisible à
  `throws_ok` dans un test qui finit par `rollback`. Préférer un trigger immédiat
  quand c'est sémantiquement correct.
- Toujours vérifier **plan == nombre de tests émis** (sur/sous-compté 3 fois).
- Biome sous Windows : les seules erreurs restantes sont des CRLF (`autocrlf=true`
  stocke du LF) — `mock.ts` non modifié échoue pareil. Environnemental, le CI
  Linux passe. Ne pas « corriger » en reformatant tout le repo.
