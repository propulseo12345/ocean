# Session State — 2026-07-21 (câblage Supabase : Phases 1→5 faites)

## Branch / Commit
`feat/cablage-supabase` @ `a401103`. Working tree propre sauf
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

**Suite pgTAP complète 003→015 : 183/183, tous les plans cohérents.**
**`pnpm --filter web exec tsc --noEmit` : 0 erreur.**

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

## ⚠️ ÉCART STRUCTUREL — priorité n°1 du travail restant
Les phases 1→5 ont câblé les domaines **périphériques**. Les lectures **cœur**
n'ont jamais été affectées à une phase et restent MOCKÉES :
`getClients`, `getClient`, `getContentItems`, `getContentItem`,
`getTrashedContent`, `getSocialAccounts`, `getCurrentUser`, `getNotifications`,
`getUnreadCount`, `getDashboardTasks`, `getShellSnapshot`, `getPortalContent`,
`getPortalContentItem`, `getUnifiedAgenda`.

Conséquence : **la Phase 8 ne peut PAS s'exécuter telle qu'écrite** — supprimer
`lib/data/mock.ts` casserait l'app tant que ces 14 lectures en dépendent. Les
tables existent déjà (migrations 004/005/006/007) : il faut câbler ces lectures
+ produire le seed SQL, avant ou pendant la Phase 8.

## Reste à faire, dans cet ordre suggéré
1. **Lectures cœur + seed SQL** (l'écart ci-dessus) — prérequis de « zéro mock ».
2. **Phase 6** — complétude Server Actions & transitions : conflits C1/C2/C3 avec
   la garde 008, RPC `mark_target_published_manually`, retry `content_targets`.
3. **Phase 7** — aplatissement `L<string>` → `text` (~70 fichiers, stratégie 4
   temps du plan §6 : shim `pick()` → types → cas système → nettoyage).
4. **Phase 8** — suppression des mocks, **dégel de l'horloge** (`lib/clock.ts`
   MOCK_NOW + 5 composants), `get_advisors` clean, vérif visuelle post-dégel.

## Dettes connues
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
