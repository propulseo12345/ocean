begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- ===========================================================================
-- Seed : org A {owner UA, reviewer UR sur A1}, org B {UB}. Compte IG A1,
-- post importé, métriques (importée + cible), quota.
-- ===========================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000014001', 'ua@014.test'),
  ('00000000-0000-4000-8000-000000014003', 'ur@014.test'),
  ('00000000-0000-4000-8000-000000014004', 'ub@014.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000014001', 'Org A 014', 'org-a-014', '00000000-0000-4000-8000-000000014001'),
  ('10000000-0000-4000-8000-000000014002', 'Org B 014', 'org-b-014', '00000000-0000-4000-8000-000000014004');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000014001', '00000000-0000-4000-8000-000000014001', 'owner'),
  ('10000000-0000-4000-8000-000000014002', '00000000-0000-4000-8000-000000014004', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000014001', '10000000-0000-4000-8000-000000014001', 'Client A1 014', 'client-a1-014'),
  ('20000000-0000-4000-8000-000000014003', '10000000-0000-4000-8000-000000014002', 'Client B1 014', 'client-b1-014');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '00000000-0000-4000-8000-000000014003', 'reviewer');

insert into public.platform_connections (id, org_id, provider, provider_account_id) values
  ('60000000-0000-4000-8000-000000014001', '10000000-0000-4000-8000-000000014001', 'instagram', 'ig-conn-a1');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username) values
  ('61000000-0000-4000-8000-000000014001', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '60000000-0000-4000-8000-000000014001', 'instagram', 'ig-a1', 'brulerie');

insert into public.content_items (id, org_id, client_id, title, status) values
  ('35000000-0000-4000-8000-000000014001', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', 'Publié', 'published');

insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status, external_post_id) values
  ('62000000-0000-4000-8000-000000014001', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '35000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'instagram', 'published', 'ig-media-1');

insert into public.imported_posts (id, org_id, client_id, social_account_id, external_post_id, media_product_type, published_at) values
  ('63000000-0000-4000-8000-000000014001', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'ig-imported-1', 'FEED', now());

insert into public.post_metrics (org_id, client_id, social_account_id, platform, imported_post_id, likes, comments_count, saves, reach) values
  ('10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'instagram', '63000000-0000-4000-8000-000000014001', 100, 10, 5, 2000);

insert into public.social_account_quota_usage (social_account_id, quota_kind, org_id, client_id, platform, used, quota_limit) values
  ('61000000-0000-4000-8000-000000014001', 'ig_publish', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', 'instagram', 12, 100),
  ('61000000-0000-4000-8000-000000014001', 'ig_container', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', 'instagram', 30, 400);

-- ===========================================================================
-- 1. Contraintes
-- ===========================================================================

select is(
  (select engagement_total from public.post_metrics where imported_post_id = '63000000-0000-4000-8000-000000014001'),
  115,
  'engagement_total = likes + comments + saves (colonne générée)');

select throws_ok(
  $$insert into public.post_metrics (org_id, client_id, social_account_id, platform, content_target_id, imported_post_id)
    values ('10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'instagram', '62000000-0000-4000-8000-000000014001', '63000000-0000-4000-8000-000000014001')$$,
  '23514', null,
  'post_metrics refuse les DEUX références (target ET importé) — XOR');

select throws_ok(
  $$insert into public.post_metrics (org_id, client_id, social_account_id, platform)
    values ('10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'instagram')$$,
  '23514', null,
  'post_metrics refuse AUCUNE référence — XOR');

select lives_ok(
  $$insert into public.post_metrics (org_id, client_id, social_account_id, platform, content_target_id, likes, reach)
    values ('10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'instagram', '62000000-0000-4000-8000-000000014001', 50, null)$$,
  'post_metrics accepte reach NULL (non garanti en Standard Access)');

select throws_ok(
  $$insert into public.imported_posts (org_id, client_id, social_account_id, external_post_id, media_product_type, published_at)
    values ('10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'ig-imported-2', 'CAROUSEL', now())$$,
  '23514', null,
  'imported_posts refuse un media_product_type hors FEED/REELS/STORY');

select throws_ok(
  $$insert into public.social_account_quota_usage (social_account_id, quota_kind, org_id, client_id, platform, used)
    values ('61000000-0000-4000-8000-000000014001', 'ig_publish', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', 'instagram', 1)$$,
  '23505', null,
  'quota : PK composite (social_account_id, quota_kind) — pas de doublon');

select lives_ok(
  $$insert into public.social_account_quota_usage (social_account_id, quota_kind, org_id, client_id, platform, used)
    values ('61000000-0000-4000-8000-000000014001', 'fb_reels', '10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', 'instagram', 3)$$,
  'quota : un 2e quota_kind pour le même compte est accepté (2 compteurs)');

-- ===========================================================================
-- 2. RLS org-only : owner voit, reviewer et autre org ne voient rien.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000014001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000014001","role":"authenticated"}';

select ok(
  (select count(*) from public.imported_posts) >= 1,
  'owner A lit ses posts importés');
select ok(
  (select count(*) from public.post_metrics) >= 1,
  'owner A lit ses métriques');

-- authenticated ne peut PAS écrire (service_role exclusif).
select throws_ok(
  $$insert into public.post_metrics (org_id, client_id, social_account_id, platform, imported_post_id, likes)
    values ('10000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000014001', '61000000-0000-4000-8000-000000014001', 'instagram', '63000000-0000-4000-8000-000000014001', 99999)$$,
  '42501', null,
  'un membre d org ne peut PAS falsifier les métriques (écriture service_role seule)');

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000014003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000014003","role":"authenticated"}';

select results_eq(
  $$select (select count(*) from public.imported_posts)::int
        + (select count(*) from public.post_metrics)::int
        + (select count(*) from public.social_account_quota_usage)::int$$,
  $$values (0)$$,
  'reviewer ne voit AUCUNE donnée feed/perf/quota (org-only)');

reset role;

-- ===========================================================================
-- 3. GUARD-05
-- ===========================================================================

select results_eq(
  $$select count(*)::int from (values
      ('public.imported_posts'), ('public.post_metrics'), ('public.social_account_quota_usage')
    ) as t(name)
    where has_table_privilege('authenticated', t.name, 'TRUNCATE')$$,
  $$values (0)$$,
  'GUARD-05 : TRUNCATE des tables feed/perf refusé à authenticated');

select * from finish();

rollback;
