# Session State — 2026-07-21 (câblage Supabase : Phases 1→5 + lectures CŒUR)

## Branch / Commit
`feat/cablage-supabase` @ `30d642b`. Working tree propre sauf
`apps/web/__tz_repro.mjs` (débug non commité, à supprimer en Phase 8).
Rien n'est poussé, aucune PR mergée (décision actée : on merge à la fin).

## Fait (6 commits)
| Phase | Commit | Migration | pgTAP |
|---|---|---|---|
| 1 — config éditoriale | f2cb402 | 011 (7 tables + `client_settings` D4) | 33/33 |
| 2 — médias & Storage | 2c8511e | 012 + 012_media_storage | 27/27 |
| 3 — collaboration | 4a92604 | 013 (8 tables + 3 RPC) | 28/28 |
| 4 — feed & performance | 4ca1725 | 014 (3 tables) | 12/12 |
| 5 — agenda unifié | 2c050cf | 015 (4 tables + vue) | 14/14 |
| fix — deploy 010 idempotent | a401103 | — | — |
| **lectures CŒUR + seed** | **30d642b** | — (tables 004→007) | **16/16** (090) |

**Suite pgTAP complète 003→015 + 090 : 199/199, plan == émis sur les 14 fichiers.**
**`pnpm --filter web exec tsc --noEmit` : 0 erreur, AVEC `lib/data/mock.ts` supprimé.**

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

`deploy/04` à `08` sont encapsulés dans `begin/commit` : si l'un est déjà passé,
il échoue proprement et annule tout (aucun état partiel).

Après application : régénérer les types. NB `scripts/gen-types.py` **n'écrit pas
encore le fichier** (il ne fait qu'afficher) ; `apps/web/lib/supabase/types.ts`
est maintenu À LA MAIN en attendant — soit finir le script, soit continuer à la main.

## RIEN N'EST VÉRIFIÉ AU RUNTIME
Toute la vérification est **pgTAP local (conteneur `ocean_rev2`) + typecheck**.
Le runtime Playwright n'est possible qu'après application en ligne des migrations.

## Décisions en attente
- **D2** — chemin Storage `{org}/{client}/{media_asset_id}/` **sans**
  `content_item_id` : contredit la règle 21 du CLAUDE.md. Motif : un asset de
  médiathèque n'a pas de `content_item_id` à l'upload et en a N ensuite.
  Appliqué par recommandation du plan, **à confirmer avant `deploy/05`**.
- **D3** — bucket `media-thumbs` PUBLIC (vignette d'un contenu non publié lisible
  par qui obtient l'URL). Acté PRD L409, **à reconfirmer avant `deploy/05`**.
- **D8/D9** — reset mot de passe, lien de dépôt (Phase 6 / migration 016).
- **D10** — sélecteur de client au portail (UI Phase 3, non câblé).

## ✅ ÉCART STRUCTUREL RÉSORBÉ (commit 30d642b)
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

## Reste à faire, dans cet ordre suggéré
1. **Phase 6** — complétude Server Actions & transitions : conflits C1/C2/C3 avec
   la garde 008, RPC `mark_target_published_manually`, retry `content_targets`.
2. **Phase 7** — aplatissement `L<string>` → `text` (~70 fichiers, stratégie 4
   temps du plan §6 : shim `pick()` → types → cas système → nettoyage).
3. **Phase 8** — réduite à : **dégel de l'horloge** (`lib/clock.ts` MOCK_NOW +
   5 composants), relocalisation `lib/mocks/types` → `lib/domain`, suppression
   du reste de `lib/mocks/**` (constantes encore lues par `use-library-assets`
   et `perf-data`), `get_advisors` clean, vérif visuelle post-dégel.

## Dettes connues
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
