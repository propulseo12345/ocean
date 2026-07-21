# Session State — 2026-07-21 (câblage Supabase, Phase 0 faite)

## Branch / Commit
`feat/cablage-supabase` @ `2a57f46` (dirty: 2 — `__tz_repro.mjs` debug + `scripts/` non commités)

## Completed This Session
- Schéma Lot 0 déployé et vérifié EN LIGNE (hgdeopkmkwyoumsfggrm) : RLS OK, secrets 401/403, compte owner linda@socean.com.
- Audit multi-agents (12 domaines) → plan par phases : `docs/superpowers/plans/2026-07-21-cablage-supabase-PLAN-DETAILLE.md`.
- **Phase 0 câblage faite** : auth mot de passe RÉELLE (login linda → /dashboard vérifié Playwright), migration 010 (pgTAP 9/9), clients Supabase, DAL, proxy corrigé, OTP supprimé.

## Next Task
- **Phase 1** : migration 011 (config éditoriale + `client_settings` org-only) + câblage 6 pages. Suivre `.planning/PROGRESS_cablage-supabase.md` (méthode par phase invariante).

## Blockers
- Étienne doit appliquer `deploy/03_migration_010.sql` en ligne (SQL Editor — MCP Supabase sur mauvais compte).

## Key Context
- Reprise 100% guidée par `.planning/PROGRESS_cablage-supabase.md` (phases, pièges, décisions actées : password only, D1 text mono, D4 client_settings org-only, merge à la fin).
- Dev sur `PORT=3010` (3000/3001 pris par d'autres projets). Conteneur pgtap = `ocean_rev2`.
- `scripts/gen-types.py` régénère `apps/web/lib/supabase/types.ts` après chaque migration en ligne.
- PR #1 (`fix/lot-0-guardrails`) ouverte non mergée ; i18n déjà sur origin/main.
