# Session State — 2026-07-21 (câblage Supabase : Phases 1→7 + lectures CŒUR)

## Branch / Commit
`feat/cablage-supabase` @ `8f0c791`. Working tree propre sauf
`apps/web/__tz_repro.mjs` (débug non commité, à supprimer en Phase 8).
Rien n'est poussé, aucune PR mergée (décision actée : on merge à la fin).

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

**Suite pgTAP complète 003→016 + 090 : 218/218, plan == émis sur les 15 fichiers.**
**`pnpm --filter web exec tsc --noEmit` : 0 erreur. `pnpm --filter web build` : vert.**

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

## Reste à faire, dans cet ordre suggéré
1. **Phase 8** (dernière) — **dégel de l'horloge** (`lib/clock.ts` MOCK_NOW +
   5 composants qui importent fromNow/hours/days ; côté runtime c'est ce gel qui
   fait « 0 à publier aujourd'hui » sur le dashboard seedé). Relocaliser
   `lib/mocks/types` → `lib/domain` (les types domaine ne doivent plus vivre
   sous `mocks`). **Supprimer `lib/mocks/**`** : au passage `loc` disparaît (son
   seul appelant restant après la Phase 7) — le retirer de `lib/i18n`. Reste
   aussi à passer `perf-data`/`perf-breakdown`/`report-data` en async+orgId (ils
   importent `@/lib/mocks` en synchrone) et retirer `Client.theme` +
   `lib/mocks/images` (dérivé par hash aujourd'hui). `get_advisors` clean (à
   faire faire par Étienne, MCP sur autre compte), vérif visuelle post-dégel.

   NB câblage restant hors Phase 8 (déjà noté en dettes) : les 2 RPC de la
   Phase 6 dans l'UI, l'upload TUS, l'UI portail, les emails Brevo.

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
