begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

-- ===========================================================================
-- Seed : org A {owner UA, admin UA2, reviewer UR sur client A1}, org B {UB}.
-- Clients A1/A2 (org A), B1 (org B). Une ligne de chaque table 011 par tenant.
-- ===========================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000011001', 'ua@011.test'),
  ('00000000-0000-4000-8000-000000011002', 'ua2@011.test'),
  ('00000000-0000-4000-8000-000000011003', 'ur@011.test'),
  ('00000000-0000-4000-8000-000000011004', 'ub@011.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000011001', 'Org A 011', 'org-a-011', '00000000-0000-4000-8000-000000011001'),
  ('10000000-0000-4000-8000-000000011002', 'Org B 011', 'org-b-011', '00000000-0000-4000-8000-000000011004');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000011001', 'owner'),
  ('10000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000011002', 'admin'),
  ('10000000-0000-4000-8000-000000011002', '00000000-0000-4000-8000-000000011004', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', 'Client A1 011', 'client-a1-011'),
  ('20000000-0000-4000-8000-000000011002', '10000000-0000-4000-8000-000000011001', 'Client A2 011', 'client-a2-011'),
  ('20000000-0000-4000-8000-000000011003', '10000000-0000-4000-8000-000000011002', 'Client B1 011', 'client-b1-011');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000011003', 'reviewer');

insert into public.content_pillars (id, org_id, client_id, name, color_token, target_share) values
  ('30000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 'Coulisses A1', 'chart-2', 40),
  ('30000000-0000-4000-8000-000000011002', '10000000-0000-4000-8000-000000011002', '20000000-0000-4000-8000-000000011003', 'Produit B1', 'chart-1', 60);

insert into public.recurring_slots (id, org_id, client_id, weekday, time_of_day, platforms, pillar_id) values
  ('31000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 2, '11:30', array['instagram']::public.platform[], '30000000-0000-4000-8000-000000011001'),
  ('31000000-0000-4000-8000-000000011002', '10000000-0000-4000-8000-000000011002', '20000000-0000-4000-8000-000000011003', 5, '18:00', array['facebook','tiktok']::public.platform[], null);

insert into public.hashtag_groups (id, org_id, client_id, name, tags) values
  ('32000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 'Marque A1', array['#brulerie', '#lille']),
  ('32000000-0000-4000-8000-000000011002', '10000000-0000-4000-8000-000000011002', '20000000-0000-4000-8000-000000011003', 'Marque B1', array['#verde']);

insert into public.brand_kits (client_id, org_id, palette, tone, banned_words) values
  ('20000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', array['oklch(0.46 0.09 62)'], 'Chaleureux', array['pas cher']),
  ('20000000-0000-4000-8000-000000011003', '10000000-0000-4000-8000-000000011002', array['oklch(0.53 0.12 150)'], 'Frais', array['Discount']);

insert into public.client_events (id, org_id, client_id, event_date, title, kind) values
  ('33000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', '2026-07-25', 'Réassort grains', 'note'),
  ('33000000-0000-4000-8000-000000011002', '10000000-0000-4000-8000-000000011002', '20000000-0000-4000-8000-000000011003', '2026-07-26', 'Lancement carte', 'event');

insert into public.saved_views (id, org_id, client_id, owner_user_id, name, statuses, is_default) values
  ('34000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000011001', 'À traiter', array['draft']::public.content_status[], true),
  ('34000000-0000-4000-8000-000000011002', '10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000011002', 'Reels only', '{}', false),
  ('34000000-0000-4000-8000-000000011003', '10000000-0000-4000-8000-000000011002', '20000000-0000-4000-8000-000000011003', '00000000-0000-4000-8000-000000011004', 'En attente', '{}', false);

insert into public.client_settings (client_id, org_id, review_reminder_days, cadence_gap_days) values
  ('20000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', 3, 10),
  ('20000000-0000-4000-8000-000000011003', '10000000-0000-4000-8000-000000011002', 2, 7);

insert into public.content_items (id, org_id, client_id, title, pillar_id) values
  ('35000000-0000-4000-8000-000000011001', '10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 'Post café', '30000000-0000-4000-8000-000000011001');

-- ===========================================================================
-- 1. Contraintes (en postgres, RLS contournée : on teste le schéma, pas la RLS)
-- ===========================================================================

select throws_ok(
  $$insert into public.content_pillars (org_id, client_id, name, color_token)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 'Hors palette', 'chart-6')$$,
  '23514', null,
  'content_pillars refuse un color_token hors chart-1..chart-5');

select lives_ok(
  $$insert into public.content_pillars (org_id, client_id, name, color_token)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011002', 'Cinquième token', 'chart-5')$$,
  'content_pillars accepte chart-5 (la palette UI a 5 tokens, pas 4)');

select throws_ok(
  $$insert into public.recurring_slots (org_id, client_id, weekday, time_of_day, platforms)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 3, '09:00', '{}'::public.platform[])$$,
  '23514', null,
  'recurring_slots refuse un tableau de plateformes vide (cardinality, pas array_length)');

select throws_ok(
  $$insert into public.recurring_slots (org_id, client_id, weekday, time_of_day, platforms)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 3, '09:00', array['newsletter']::public.platform[])$$,
  '23514', null,
  'recurring_slots refuse une plateforme non publiable (newsletter)');

select throws_ok(
  $$insert into public.recurring_slots (org_id, client_id, weekday, time_of_day, platforms)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 8, '09:00', array['instagram']::public.platform[])$$,
  '23514', null,
  'recurring_slots refuse un weekday hors 1..7');

select throws_ok(
  $$insert into public.hashtag_groups (org_id, client_id, name, tags)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 'Vide', '{}')$$,
  '23514', null,
  'hashtag_groups refuse un groupe sans tags');

select throws_ok(
  $$insert into public.content_items (org_id, client_id, title, pillar_id)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 'Fuite pilier', '30000000-0000-4000-8000-000000011002')$$,
  '23503', null,
  'FK composite : un contenu du client A1 ne peut PAS pointer un pilier du client B1');

select throws_ok(
  $$insert into public.saved_views (org_id, client_id, owner_user_id, name, is_default)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000011001', 'Autre défaut', true)$$,
  '23505', null,
  'saved_views : une seule vue par défaut par (client, user)');

-- ===========================================================================
-- 2. RLS owner org A : voit SES lignes, jamais celles de l org B
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000011001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000011001","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.content_pillars where name = 'Produit B1'$$,
  $$values (0)$$,
  'owner A ne lit aucun pilier de l org B');

select results_eq(
  $$select count(*)::int from public.recurring_slots$$,
  $$values (1)$$,
  'owner A lit ses créneaux, pas ceux de l org B');

select results_eq(
  $$select count(*)::int from public.hashtag_groups$$,
  $$values (1)$$,
  'owner A lit ses groupes de hashtags, pas ceux de l org B');

select results_eq(
  $$select count(*)::int from public.brand_kits$$,
  $$values (1)$$,
  'owner A lit son brand kit, pas celui de l org B');

select results_eq(
  $$select count(*)::int from public.client_events$$,
  $$values (1)$$,
  'owner A lit ses événements client, pas ceux de l org B');

select results_eq(
  $$select count(*)::int from public.client_settings$$,
  $$values (1)$$,
  'owner A lit ses réglages client, pas ceux de l org B');

select results_eq(
  $$select count(*)::int from public.saved_views$$,
  $$values (1)$$,
  'owner A ne lit QUE ses propres vues (pas celles de l admin, pas celles de l org B)');

select throws_ok(
  $$insert into public.saved_views (org_id, client_id, owner_user_id, name)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000011002', 'Au nom d un tiers')$$,
  '42501', null,
  'owner A ne peut PAS créer une vue au nom d un autre membre');

reset role;

-- ---------------------------------------------------------------------------
-- Admin A2 (même org) : ne voit que SES vues — le scoping par user, pas org.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000011002';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000011002","role":"authenticated"}';

select results_eq(
  $$select name from public.saved_views$$,
  $$values ('Reels only'::text)$$,
  'un 2e membre de la MÊME org ne voit que ses propres vues');

reset role;

-- ===========================================================================
-- 3. RLS reviewer client A1 : 0 ligne PARTOUT (org-only, décision D4 incluse)
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000011003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000011003","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.content_pillars$$,
  $$values (0)$$,
  'reviewer : 0 pilier (org-only, même pour SON client)');

select results_eq(
  $$select count(*)::int from public.recurring_slots$$,
  $$values (0)$$,
  'reviewer : 0 créneau récurrent');

select results_eq(
  $$select count(*)::int from public.hashtag_groups$$,
  $$values (0)$$,
  'reviewer : 0 groupe de hashtags');

select results_eq(
  $$select count(*)::int from public.brand_kits$$,
  $$values (0)$$,
  'reviewer : 0 brand kit (do/dont/mots interdits = notes internes)');

select results_eq(
  $$select count(*)::int from public.client_events$$,
  $$values (0)$$,
  'reviewer : 0 événement client (notes internes de planification)');

select results_eq(
  $$select count(*)::int from public.saved_views$$,
  $$values (0)$$,
  'reviewer : 0 vue enregistrée');

select results_eq(
  $$select count(*)::int from public.client_settings$$,
  $$values (0)$$,
  'D4 : le reviewer ne lit JAMAIS cadence/relance (client_settings org-only)');

select throws_ok(
  $$insert into public.content_pillars (org_id, client_id, name)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', 'Forgé par reviewer')$$,
  '42501', null,
  'reviewer : INSERT pilier refusé par la RLS');

select throws_ok(
  $$insert into public.client_events (org_id, client_id, event_date, title)
    values ('10000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000011001', '2026-08-01', 'Forgé')$$,
  '42501', null,
  'reviewer : INSERT événement client refusé par la RLS');

reset role;

-- ---------------------------------------------------------------------------
-- Owner org B : symétrique — ne voit que sa ligne.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000011004';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000011004","role":"authenticated"}';

select results_eq(
  $$select name from public.content_pillars$$,
  $$values ('Produit B1'::text)$$,
  'owner B ne lit que le pilier de l org B (symétrie cross-org)');

reset role;

-- ===========================================================================
-- 4. SET NULL ciblé (PG15) + cascades — le piège 23502 du plan §2
-- ===========================================================================

select lives_ok(
  $$delete from public.content_pillars where id = '30000000-0000-4000-8000-000000011001'$$,
  'supprimer un pilier référencé ne lève PAS 23502 (set null ciblé sur pillar_id)');

select results_eq(
  $$select (pillar_id is null) and (client_id = '20000000-0000-4000-8000-000000011001'::uuid)
    from public.content_items where id = '35000000-0000-4000-8000-000000011001'$$,
  $$values (true)$$,
  'content_items : pillar_id nullé, client_id INTACT');

select ok(
  (select pillar_id is null from public.recurring_slots
   where id = '31000000-0000-4000-8000-000000011001'),
  'recurring_slots : pillar_id nullé, la ligne survit');

select lives_ok(
  $$delete from public.clients where id = '20000000-0000-4000-8000-000000011001'$$,
  'supprimer un client cascade toutes les tables 011 sans erreur');

select results_eq(
  $$select (select count(*) from public.brand_kits      where client_id = '20000000-0000-4000-8000-000000011001')::int
        + (select count(*) from public.client_settings  where client_id = '20000000-0000-4000-8000-000000011001')::int
        + (select count(*) from public.client_events    where client_id = '20000000-0000-4000-8000-000000011001')::int
        + (select count(*) from public.hashtag_groups   where client_id = '20000000-0000-4000-8000-000000011001')::int
        + (select count(*) from public.recurring_slots  where client_id = '20000000-0000-4000-8000-000000011001')::int
        + (select count(*) from public.saved_views      where client_id = '20000000-0000-4000-8000-000000011001')::int
        + (select count(*) from public.content_pillars  where client_id = '20000000-0000-4000-8000-000000011001')::int$$,
  $$values (0)$$,
  'cascade client : plus aucune ligne 011 orpheline');

-- ===========================================================================
-- 5. GUARD-05 : TRUNCATE jamais accordé à authenticated (non soumis à la RLS)
-- ===========================================================================

select results_eq(
  $$select count(*)::int from (values
      ('public.content_pillars'), ('public.recurring_slots'), ('public.hashtag_groups'),
      ('public.brand_kits'), ('public.client_events'), ('public.saved_views'),
      ('public.client_settings')
    ) as t(name)
    where has_table_privilege('authenticated', t.name, 'TRUNCATE')$$,
  $$values (0)$$,
  'GUARD-05 : aucune table 011 ne laisse TRUNCATE à authenticated');

select * from finish();

rollback;
