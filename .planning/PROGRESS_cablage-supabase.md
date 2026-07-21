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

## FAIT (Phase 1) ✅ — commit f2cb402 + migration 011
- Migration `011_editorial_config.sql` : content_pillars → recurring_slots →
  hashtag_groups, brand_kits (PK client_id), client_events (event_date DATE),
  saved_views (owner_user_id, is_default), **client_settings (D4 org-only)** ;
  ALTER content_items (pillar_id FK composite `on delete set null (pillar_id)`,
  first_comment, pinned, exclude_from_grid, platform_options, updated_by).
  RLS org-only, `revoke all` GUARD-05, checks (color chart-1..5, platforms `<@`
  + cardinality, tags 1..30). pgTAP 011 = **33/33** sur ocean_rev2 (plan==émis).
- `deploy/04_migration_011.sql` (begin/commit) prêt. types.ts 011 à la main.
- Lectures : `lib/data/pro.ts` (7 lectures) + bascule `index.ts` (export nommé
  prime sur `export *`). Mapping `text→loc(x,x)`, colorVar depuis color_token.
- Server Actions `lib/actions/` : _helpers (requireClientInOrg), brand-kit,
  client-settings (cadence + updateApprovalSettings), recurring-slots (add/
  update/delete), pillars (create/update/archive), client-events, saved-views.
- Sections câblées : brand-kit, cadence (settings threadées), approval (dirty
  relance corrigé + persistance), slots (add/remove/patch optimiste, id temp
  non-uuid non persisté). pillarMeta cross-tenant retiré ; board is_default.
- **typecheck 0 erreur.** Biome : seules erreurs = CRLF Windows (mock.ts non
  modifié échoue pareil → environnemental, CI Linux LF passe).
- ⚠️ Runtime NON vérifié : 010+011 pas en ligne (blocage Étienne). Vérif =
  pgTAP local + typecheck. Dettes : label_ids matching (P1), activity_kind enum.

## FAIT (Phase 2) ✅ — migration 012 (médias)
- `012_media.sql` (testable local) : media_assets (pool fille client, dims/mime/
  byte nullable pour import, soft-delete), content_media (liaison N-N, position,
  unique(item,position) DEFERRABLE, FK media restrict), ALTER content_items
  (cover_media_asset_id restrict D11 + cover_frame_ms, exclusion mutuelle),
  helpers is_reviewer_visible_media + can_write_client_media, trigger cardinalité
  IMMÉDIAT (post/story 1, reel 1+vidéo, carousel ≤10), RPC reorder_content_media.
  **pgTAP 27/27** (leak reviewer via table fille, cardinalité 4 formats, cover
  restrict, cascade client A1 malgré restrict cross-child, reorder, GUARD-05).
- `012_media_storage.sql` (**online-only** ; runner saute *_storage.sql) : buckets
  media-originals(privé,300MB,mimes) + media-thumbs(public,1MB,webp), policies
  storage.objects via can_write_client_media([1]=org,[2]=client). **D2** (chemin
  sans content_item_id) + **D3** (thumbs public) = recommandés, À RECONFIRMER.
- deploy/05 prêt. Types media_assets/content_media/cover/RPC à la main.
- `getLibraryAssets` réel (thumb=public URL, full=signed URL batch, usedInContentIds
  depuis content_media). Server Actions `lib/actions/media.ts`.
- ⚠️ NON câblé (runtime-dépendant, online + seed requis) : injection des médias
  DANS content_items (getContentItems reste mock), upload TUS client + conversion
  JPEG/HEIC + vignette WebP, URL signées portail. media_deposit_links → migr 016.

## FAIT (Phase 3) ✅ — migration 013 (collaboration) — commit 4a92604
- 8 tables : content_versions (org-only D5), approvals (immuable, version_label
  dénormalisé, decided_by set null+snapshot), content_comments (client/internal,
  annotation→content_media x/y 0..1, anti-fuite), content_activity (append-only
  org-only), review_requests(+items+recipients FK client_members), client_invitations.
- ALTER : client_members.last_active_at, content_items.client_comments_count,
  content_targets (last_error, manual_published_*, retry_requested_at, skipped_reason).
- Triggers : compteur commentaires client, approval_stale, garde transition
  content_targets (bypass worker via request.jwt.claims). D7 (is_reviewer_visible
  += publishing, failed). Enum activity_kind RÉALIGNÉ front dans 010 (deploy/03 regen).
- 3 RPC : submit_review_decision (B1), touch_client_member_seen, emit_notification (B2).
- **pgTAP 013 = 28/28** (les tests de fuite les plus critiques : internal, draft,
  cross-client, no-op status, RPC, gardes, token_hash illisible, GUARD-05).
- 6 lectures collab (pro.ts, façade basculée) + Server Actions collaboration.ts.
- ⚠️ Non câblé : getReviewerContext réel, UI portail, Route Handler accept invit,
  emails Brevo. label_ids matching (dette Phase 1) toujours ouverte.

## POINT D'ÉTAPE (fin Phase 3) — pour Étienne
- **Migrations à appliquer EN LIGNE, dans l'ordre** (SQL Editor, projet
  hgdeopkmkwyoumsfggrm) : deploy/03 (010, régénéré), deploy/04 (011), deploy/05
  (012 + **reconfirmer D2/D3**), deploy/06 (013). Puis `python scripts/gen-types.py`.
- **Rien n'est vérifié au RUNTIME** (010+ pas en ligne) : vérif = pgTAP local
  (33+27+28 verts) + typecheck 0. Le runtime Playwright suivra l'application.
- **D2/D3** (Phase 2) tranchés par recommandation, à confirmer avant deploy/05.
- Décisions à venir : D8/D9 (Phase 6/016), sélecteur client portail D10 (Phase 3 UI).

## FAIT (Phase 4) ✅ — migration 014 (feed & performance) — commit 4ca1725
- imported_posts (media_product_type, sans caption/media_count), post_metrics
  (XOR content_target/imported_post, engagement_total généré, reach NULLABLE),
  social_account_quota_usage (**PK composite (social_account_id, quota_kind)**).
  ALTER social_accounts (avatar_url, following_count, feed_synced_at/error).
- **Écriture service_role EXCLUSIVE** sur les 3 (falsification de rapport client
  et remise à zéro de jauge sinon possibles). **pgTAP 12/12**.
- Lectures : getImportedPosts, getPostMetrics, getTopPosts, getQuotaUsage.
- ⚠️ Reste : perf-data/perf-breakdown/report-data en async+orgId, suppression de
  PERIOD_FACTOR/DELTA_SHAPE (deltas inventés), N+1 grille.

## FAIT (Phase 5) ✅ — migration 015 (agenda) — commit 2c050cf
- calendar_accounts (user-scopé, FK composite vers organization_members) +
  calendar_account_secrets DENY-ALL (même migration, règle 11), calendar_calendars
  (external_calendar_id stable, color_slot, is_enabled), calendar_events (all-day
  DATE vs timé timestamptz, CHECK strict). Vue `unified_agenda` security_invoker,
  owner_user_id NULLABLE + filtre par branche (sinon les publications disparaissent).
- **pgTAP 14/14** dont la régression du domaine : deux membres de la MÊME org ne
  voient PAS leurs agendas. Lectures + Server Action `toggleCalendar`.
- **Régression attrapée** : le test 003 (« un seul profil visible ») était faux
  depuis la policy `profiles_select_shared` (010) — assertion corrigée.
- **SUITE COMPLÈTE 003→015 : 183/183, tous plans cohérents.**

## ÉCART À TRAITER — les lectures CŒUR sont encore mockées
Les phases 1→5 ont câblé les domaines périphériques. Restent MOCKÉES (jamais
affectées à une phase, alors qu'elles sont le prérequis de « zéro mock ») :
getClients, getClient, getContentItems, getContentItem, getTrashedContent,
getSocialAccounts, getCurrentUser, getNotifications, getUnreadCount,
getDashboardTasks, getPortalContent, getUnifiedAgenda. Les tables existent déjà
(004/005/006/007) — à câbler avec le seed SQL de la Phase 8.

## À FAIRE — Phase 6 et suivantes
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
