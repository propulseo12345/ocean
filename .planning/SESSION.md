# Session State — 2026-07-21 (câblage Supabase, Phases 1→5 faites)

## Branch / Commit
`feat/cablage-supabase` @ `2c050cf` (dirty : `__tz_repro.mjs` débug non commité — Phase 8).
Rien n'est poussé, aucune PR mergée (décision : on merge à la fin).

## Fait cette session (5 phases, 5 commits)
| Phase | Commit | Migration | pgTAP |
|---|---|---|---|
| 1 — config éditoriale | f2cb402 | 011 (7 tables + client_settings D4) | 33/33 |
| 2 — médias & Storage | 2c8511e | 012 + 012_media_storage | 27/27 |
| 3 — collaboration | 4a92604 | 013 (8 tables + 3 RPC) | 28/28 |
| 4 — feed & performance | 4ca1725 | 014 (3 tables) | 12/12 |
| 5 — agenda unifié | 2c050cf | 015 (4 tables + vue) | 14/14 |

**Suite pgTAP complète 003→015 : 183/183, tous les plans cohérents.**
**typecheck `tsc --noEmit` : 0 erreur** après chaque phase.

## ⚠️ BLOCAGE — rien n'est vérifié au RUNTIME
Les migrations 010→015 ne sont PAS appliquées en ligne (le MCP Supabase est sur
un autre compte). Toute la vérification est donc : **pgTAP local (ocean_rev2) +
typecheck**. Le runtime Playwright ne pourra être fait qu'après application.

**À faire par Étienne, dans l'ordre, SQL Editor du projet hgdeopkmkwyoumsfggrm :**
1. `deploy/03_migration_010.sql` (RÉGÉNÉRÉ : enum activity_kind réaligné)
2. `deploy/04_migration_011.sql`
3. `deploy/05_migration_012.sql` — **reconfirmer D2 et D3 avant** (voir en-tête)
4. `deploy/06_migration_013.sql`
5. `deploy/07_migration_014.sql`
6. `deploy/08_migration_015.sql`
Puis `python scripts/gen-types.py` (NB : le script n'écrit pas encore le fichier ;
`apps/web/lib/supabase/types.ts` est maintenu à la main en attendant).

## Décisions en attente
- **D2** (chemin Storage sans content_item_id — contredit la règle 21) et **D3**
  (media-thumbs public) : appliqués **par recommandation du plan**, à confirmer
  avant deploy/05.
- **D8/D9** (reset mot de passe, lien de dépôt) : Phase 6 / migration 016.
- **D10** (sélecteur de client au portail) : UI Phase 3, non câblé.

## Next Task — ÉCART IMPORTANT À TRAITER EN PRIORITÉ
Les phases 1→5 ont câblé les domaines **périphériques**. Les lectures **cœur**
n'ont jamais été affectées à une phase et restent MOCKÉES :
`getClients`, `getClient`, `getContentItems`, `getContentItem`,
`getTrashedContent`, `getSocialAccounts`, `getCurrentUser`, `getNotifications`,
`getUnreadCount`, `getDashboardTasks`, `getPortalContent`, `getUnifiedAgenda`.
C'est le prérequis de « zéro mock » (Phase 8) — à câbler avant/pendant la Phase 8,
en même temps que le seed SQL (les tables existent déjà : 004/005/006/007).

Puis : **Phase 6** (complétude Server Actions & transitions : conflits C1/C2/C3
avec la garde 008, RPC mark_target_published_manually, retry content_targets),
**Phase 7** (aplatissement L<string>→text, ~70 fichiers, stratégie 4 temps),
**Phase 8** (suppression mocks, dégel de l'horloge, seed, get_advisors).

## Dettes notées
- `saved_views.filters.labels` reçoit des `label_ids` (uuid) mais board-utils
  matche encore par NOM → filtre étiquettes inopérant jusqu'au refactor par id.
- N+1 de la grille (un `getPostMetrics` par tuile) non corrigé.
- `perf-data.ts` / `perf-breakdown.ts` / `report-data.ts` importent `@/lib/mocks`
  en SYNCHRONE (contournent la façade) → à passer async+orgId, et supprimer la
  mise à l'échelle mock (PERIOD_FACTOR / DELTA_SHAPE : deltas inventés dans un
  rapport client).
- UI portail (review-actions, annotation-viewer, thread), Route Handler
  d'acceptation d'invitation, emails Brevo : non câblés.

## Contexte technique
- Dev `PORT=3010`. pgTAP : `bash scripts/run-pgtap.sh 0NN <tests...>` (conteneur
  `ocean_rev2`, saute les fichiers `*_storage.sql` — schéma storage local ancien).
- Piège pgTAP payé : dollar-quoting `$$ ... $t$ ... $t$$$` casse (le lexer matche
  `$$` trop tôt) → utiliser un tag externe distinct (`$run$`) ou éviter les DO.
- Piège pgTAP payé : un constraint trigger DEFERRED ne se déclenche qu'au commit,
  donc invisible à `throws_ok` dans un test qui finit par rollback.
- Toujours vérifier **plan == tests émis** (j'ai sur/sous-compté 3 fois).
