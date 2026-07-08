# Session State — 2026-07-08 (guardrails Lot 0 + audit Lot 5)

## Branch / Commit
`feat/i18n-fr-en` @ `85f3076` (dirty: 71 fichiers — Pré-0 front, non touché cette session)

## Completed This Session
- 9 commits sur `supabase/` + `.github/`. Couverture pgTAP 27 → 56 assertions.
- GUARD-09/00/01/02/04/05/08/10/14 appliqués. 2 migrations neuves : `008` (garde de
  transition `content_items.status`), `009` (RPC `read_at` + colonnes `plan`/`seats`).
- CI GitHub Actions créée : `db reset` + `test db` + équivalent local de `get_advisors`.
- Audit adversarial du Lot 5 → **ROUGE, 6 bloquants** (`_research/audits/2026-07-08-*.md`).
- `docs/architecture/lot-0-sql-review.md` remis à jour (son STOP était périmé).
- Auto-review : la garde 008 était contournable par `INSERT` (trigger `of status` ne voit
  pas les INSERT). Corrigé dans `content_items_insert` + 2 assertions.

## Next Task
- **Exécuter les tests** — rien n'a encore tourné. Conteneur jetable `ocean_pgtap`
  (port 55432), appliquer `migrations/001→009` puis les 7 tests pgTAP.
  Protocole complet en mémoire persistante (`ocean-tester-pgtap-localement`).

## Blockers
- Aucun. Docker tourne (hors PATH — préfixer `$env:Path`, cf. mémoire).

## Key Context
- **Ne rien pousser sur le projet Supabase online** avant CI verte. Base locale uniquement.
- La stack `supabase_db_context-os` tourne pour un AUTRE projet — ne pas y toucher.
- L'image `supabase/postgres:15.8.1.085` fournit déjà `auth.users`, `auth.uid()`, les
  rôles et pgTAP. Aucun shim `auth` (le schéma appartient à `supabase_admin`).
- Écrire les boucles shell dans un fichier : PowerShell mange les guillemets doubles.
- Décision ouverte non tranchée : policies `DELETE` ouvertes à `authenticated` (8 tables).
- Remote GitHub prévu : `github.com/propulseo12345/ocean` (pas encore configuré).
- `project_id` Laboratoire : inconnu → `list_projects` au prochain `start`.
