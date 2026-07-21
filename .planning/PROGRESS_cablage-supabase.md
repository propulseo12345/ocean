# PROGRESS — Câblage Supabase d'Ocean (du preview mocké au back office réel)

Feature multi-sessions. Objectif : l'UI ne consomme QUE des données Supabase,
schéma complet, back office fonctionnel. Reprise autonome, temps/token illimités,
sans s'arrêter entre phases (sauf blocage réel ou décision non tranchée).

## Références (à lire en reprise, dans cet ordre)
1. `docs/superpowers/plans/2026-07-21-cablage-supabase-PLAN-DETAILLE.md` — LE plan
   (24 tables, migrations 010→016, 9 phases, décisions D1–D11, risques transverses).
2. `docs/superpowers/audits/2026-07-21-cablage/*.json` — specs colonnes exactes par
   domaine (source pour écrire les migrations). `SYNTHESE.md` = copie du plan.
3. `CLAUDE.md` + `apps/web/AGENTS.md` (« ce n'est PAS le Next que tu connais » — lire
   `apps/web/node_modules/next/dist/docs/` avant tout code Next 16).

## Décisions ACTÉES (ne pas re-litiger)
- **Auth = mot de passe uniquement.** Pas d'OTP, pas de magic link (supprimés).
- **D1 = text monolingue.** Contenu client en `text` simple ; i18n = UI seulement.
- **D4 = table `client_settings` fille org-only.** Cadence/relances jamais lisibles
  par le reviewer. NE PAS mettre ces réglages sur `clients` (ajuster migration 011).
- **On merge à la fin** (pas de merge PR intermédiaire). Branche unique de travail.
- D5/D6/D7/D10/D11 : recommandations dans le plan §5 — appliquer sauf objection.
- Restent à trancher AU MOMENT VOULU (pas bloquant maintenant) : D2/D3 (storage,
  Phase 2), D8/D9 (reset password, dépôt — Phase 3/6).

## État git
- Branche : `feat/cablage-supabase` (combine front `wip/pre-0-front` + `supabase/`
  de `fix/lot-0-guardrails`, mergés). NON poussée. On merge à la fin.
- Migrations présentes : `001`→`010`. Tests pgTAP `003`→`010`.
- Backup : `backup/lot-0-guardrails-pre-rebase`. PR #1 (`fix/lot-0-guardrails`)
  ouverte sur GitHub, NON mergée (l'i18n est déjà sur origin/main).

## FAIT (Phase 0) ✅ — commit 2a57f46 + migration 010 (3558568)
- Clients Supabase SSR : `apps/web/lib/supabase/{server,client,admin,middleware,types}.ts`.
- DAL `lib/auth/dal.ts` (verifySession via getUser). `org-context.ts` réel.
- `proxy.ts` fail-closed + refresh session (boucle /dashboard↔/login corrigée).
- Auth `app/(auth)/actions.ts` (signIn/signUp+create_organization/signOut). Login
  form mot de passe. OTP supprimé. Logout câblé sur nav-user.
- Migration `010_cablage_foundations.sql` : 8 enums + account_status.'expired',
  `private.shares_scope_with` (bidirectionnel, bug corrigé), policy
  `profiles_select_shared`, RPC `create_organization`, ajustements
  platform_connections/content_labels. pgTAP 010 = 9/9.
- VÉRIFIÉ Playwright/vrai Supabase : login linda@socean.com → /dashboard rend ;
  fail-closed OK ; plus de boucle. Données affichées encore mockées (normal).
- `deploy/03_migration_010.sql` prêt. `scripts/gen-types.py` (régénère types.ts).

## À FAIRE — reprise ici (Phase 1)
Suivre le plan §4 (migrations) et §6 (phases). Méthode par phase, INVARIANTE :
1. Écrire la migration `0XX_*.sql` (specs colonnes = audits JSON ; corrections
   verif du plan §2 : RLS reviewer `is_reviewer_visible_content`, `revoke all`
   GUARD-05, `on delete set null` + snapshot noms, `set null (col)` PG15).
2. Écrire le test pgTAP `0XX_*.test.sql` (org A vs org B ; reviewer C1 vs C2 quand
   fille de contenu). Mutation-test la garde si trigger.
3. Vérifier localement : conteneur `ocean_rev2` (docker, sans -p, image
   `public.ecr.aws/supabase/postgres:15.8.1.085`) — appliquer 001→0XX sur base
   vierge, lancer les tests. Voir mémoire `ocean-tester-pgtap-localement`.
4. Générer `deploy/0N_migration_0XX.sql` pour application en ligne par Étienne.
5. Câbler l'UI : ajouter la vraie impl dans `lib/data/` et basculer `lib/data/index.ts`
   fonction par fonction (contrat async+cache()+orgId déjà en place, 19 pages).
6. Server Actions (pattern CLAUDE.md §7 : getActiveOrg → rôle → Zod calé sur enums
   SQL → inject org_id → revalidatePath).
7. Typecheck `pnpm --filter web exec tsc --noEmit` = 0. Vérif runtime Playwright
   (dev sur PORT=3010, ports 3000/3001 pris par d'autres projets).
8. Commit par phase. Régénérer types.ts après chaque migration appliquée.

### Ordre des phases (plan §6)
- **Phase 1** (M) : migr 011 config éditoriale (content_pillars → recurring_slots →
  hashtag_groups, brand_kits, client_events, saved_views) + **client_settings
  org-only (D4)** + ALTER content_items (pillar_id, first_comment, pinned,
  exclude_from_grid, platform_options, updated_by). Câbler 6 pages + Server Actions.
- **Phase 2** (XL) : migr 012 médias + buckets Storage (media_assets, content_media,
  is_reviewer_visible_media). Câbler library/composer/grid/portail. D2/D3.
- **Phase 3** (XL) : migr 013 collaboration (content_versions, approvals,
  content_comments, content_activity, review_requests+items+recipients,
  client_invitations) + RPC submit_review_decision/emit_notification + Route
  Handler accept invitation. Câbler portail. **Point d'étape recommandé.**
- **Phase 4** (L) : migr 014 feed/perf (imported_posts, post_metrics,
  social_account_quota_usage). Passer perf-data/perf-breakdown/report-data en
  async+orgId (ils contournent la façade). Supprimer N+1 grid.
- **Phase 5** (L) : migr 015 agenda (calendar_accounts user-scopé +secrets deny-all,
  calendar_calendars, calendar_events) + vue `unified_agenda` security_invoker.
- **Phase 6** (L) : complétude Server Actions & transitions (conflits garde 008
  C1/C2/C3 du plan §6), garde transition content_targets, manual publish.
- **Phase 7** (M) : aplatir L<string>→text (shim pick T1 → types T2 → système T3 →
  nettoyage T4). Retirer le pont `dbClientToClient` d'org-context.
- **Phase 8** (M) : supprimer mocks, DÉGELER l'horloge (`lib/clock.ts` MOCK_NOW +
  5 composants important fromNow/hours/days), relocaliser lib/mocks/types→lib/domain,
  seed SQL, `get_advisors` clean, tous pgTAP verts.

## Blocages / à faire faire par Étienne
- **Appliquer migration 010 en ligne** : `deploy/03_migration_010.sql` dans le SQL
  Editor (MCP Supabase sur mauvais compte — voir mémoire). Idem chaque migration.
- Le back office montre des données mock tant que la page n'est pas câblée (normal).

## Pièges déjà payés (ne pas re-découvrir)
- `session_user` n'est pas schéma-qualifiable ; `SET ROLE` ne le change pas.
- `set_config(guc,null,true)` laisse `''`, pas NULL → tester `coalesce(...,'')=''`.
- Supabase ALTER DEFAULT PRIVILEGES accorde TRUNCATE/REFERENCES/TRIGGER à
  authenticated → `revoke all` sur toute table lecture-seule (GUARD-05).
- Un `grep "not ok"` rate une transaction pgTAP avortée → compter plan==émises.
- `throws_ok(sql, errcode, NULL, description)` — 3e arg = message, pas description.
- Conteneur pgtap `auth.users` est un STUB (pas email_confirmed_at, pas
  auth.identities) : ne pas y tester les INSERT auth ; créer les comptes via
  Dashboard. auth.uid() du stub lit `request.jwt.claim.sub` → poser les 2 formes.
