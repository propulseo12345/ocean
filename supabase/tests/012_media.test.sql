begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- ===========================================================================
-- Seed : org A {owner UA, reviewer UR sur client A1}, org B {owner UB}.
-- Contenus A1 : post visible (in_review), post masqué (draft), carrousel, reel.
-- Médias : attaché-visible, attaché-masqué, client A2, org B, vidéo.
-- ===========================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000012001', 'ua@012.test'),
  ('00000000-0000-4000-8000-000000012003', 'ur@012.test'),
  ('00000000-0000-4000-8000-000000012004', 'ub@012.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000012001', 'Org A 012', 'org-a-012', '00000000-0000-4000-8000-000000012001'),
  ('10000000-0000-4000-8000-000000012002', 'Org B 012', 'org-b-012', '00000000-0000-4000-8000-000000012004');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000012001', '00000000-0000-4000-8000-000000012001', 'owner'),
  ('10000000-0000-4000-8000-000000012002', '00000000-0000-4000-8000-000000012004', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000012001', '10000000-0000-4000-8000-000000012001', 'Client A1 012', 'client-a1-012'),
  ('20000000-0000-4000-8000-000000012002', '10000000-0000-4000-8000-000000012001', 'Client A2 012', 'client-a2-012'),
  ('20000000-0000-4000-8000-000000012003', '10000000-0000-4000-8000-000000012002', 'Client B1 012', 'client-b1-012');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', '00000000-0000-4000-8000-000000012003', 'reviewer');

insert into public.content_items (id, org_id, client_id, title, status, format) values
  ('35000000-0000-4000-8000-000000012001', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'Visible', 'in_review', 'post'),
  ('35000000-0000-4000-8000-000000012002', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'Masqué', 'draft', 'post'),
  ('35000000-0000-4000-8000-000000012003', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'Carrousel', 'draft', 'carousel'),
  ('35000000-0000-4000-8000-000000012004', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'Reel', 'draft', 'reel');

insert into public.media_assets (id, org_id, client_id, type, thumb_path, width, height) values
  ('40000000-0000-4000-8000-000000012001', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'image', 't/a1-vis.webp', 1080, 1080),
  ('40000000-0000-4000-8000-000000012002', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'image', 't/a1-draft.webp', 1080, 1080),
  ('40000000-0000-4000-8000-000000012003', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012002', 'image', 't/a2.webp', 1080, 1080),
  ('40000000-0000-4000-8000-000000012004', '10000000-0000-4000-8000-000000012002', '20000000-0000-4000-8000-000000012003', 'image', 't/b1.webp', 1080, 1080),
  ('40000000-0000-4000-8000-000000012005', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'video', 't/vid.webp', 1080, 1920);

-- Carrousel dédié au test du RPC de réordonnancement (3 slides, ids fixes).
insert into public.content_items (id, org_id, client_id, title, status, format) values
  ('35000000-0000-4000-8000-000000012005', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'Reorder', 'draft', 'carousel');

insert into public.content_media (id, org_id, client_id, content_item_id, media_asset_id, position) values
  ('41000000-0000-4000-8000-000000012001', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', '35000000-0000-4000-8000-000000012001', '40000000-0000-4000-8000-000000012001', 0),
  ('41000000-0000-4000-8000-000000012002', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', '35000000-0000-4000-8000-000000012002', '40000000-0000-4000-8000-000000012002', 0),
  ('41000000-0000-4000-8000-000000012010', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', '35000000-0000-4000-8000-000000012005', '40000000-0000-4000-8000-000000012001', 0),
  ('41000000-0000-4000-8000-000000012011', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', '35000000-0000-4000-8000-000000012005', '40000000-0000-4000-8000-000000012001', 1),
  ('41000000-0000-4000-8000-000000012012', '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', '35000000-0000-4000-8000-000000012005', '40000000-0000-4000-8000-000000012001', 2);

-- ===========================================================================
-- 1. Schéma / contraintes (rôle postgres, RLS contournée)
-- ===========================================================================

select throws_ok(
  $$insert into public.media_assets (org_id, client_id, type, duration_ms, thumb_path)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'image', 5000, 't/x.webp')$$,
  '23514', null,
  'media_assets refuse duration_ms sur une image');

select lives_ok(
  $$insert into public.media_assets (org_id, client_id, type, thumb_path)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'image', 't/import.webp')$$,
  'media_assets accepte width/height/mime/byte_size NULL (import feed)');

select throws_ok(
  $$insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
            '35000000-0000-4000-8000-000000012001', '40000000-0000-4000-8000-000000012004', 5)$$,
  '23503', null,
  'FK composite : un content du client A1 ne peut PAS lier un média de l org B');

select throws_ok(
  $$insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
            '35000000-0000-4000-8000-000000012003', '40000000-0000-4000-8000-000000012001', -1)$$,
  '23514', null,
  'content_media refuse une position négative');

-- ===========================================================================
-- 2. Trigger de cardinalité (immédiat AFTER INSERT/UPDATE)
-- ===========================================================================

-- post 35..01 a déjà 1 média (pos 0) ; un 2e (pos 1) dépasse.
select throws_ok(
  $$insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
            '35000000-0000-4000-8000-000000012001', '40000000-0000-4000-8000-000000012005', 1)$$,
  '23514', null,
  'un post refuse un 2e média');

-- carrousel à 11 slides : la 11e dépasse (INSERT...SELECT, trigger AFTER ROW).
select throws_ok(
  $$insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
    select '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
           '35000000-0000-4000-8000-000000012003', '40000000-0000-4000-8000-000000012001', g
    from generate_series(0, 10) g$$,
  '23514', null,
  'un carrousel refuse une 11e slide');

-- carrousel à 10 slides : accepté (persiste).
select lives_ok(
  $$insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
    select '10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
           '35000000-0000-4000-8000-000000012003', '40000000-0000-4000-8000-000000012001', g
    from generate_series(0, 9) g$$,
  'un carrousel accepte exactement 10 slides');

-- reel avec une image en 1er média : refusé.
select throws_ok(
  $$insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
            '35000000-0000-4000-8000-000000012004', '40000000-0000-4000-8000-000000012001', 0)$$,
  '23514', null,
  'un reel refuse un 1er média non-vidéo');

-- reel avec une vidéo : accepté (persiste).
select lives_ok(
  $$insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
            '35000000-0000-4000-8000-000000012004', '40000000-0000-4000-8000-000000012005', 0)$$,
  'un reel accepte un média vidéo');

-- réordonnancement delete-puis-insert sur le post : pas d'échec spurious.
-- Tag externe $run$ distinct du tag interne $t$ (évite la collision $$).
select lives_ok(
  $run$do $t$
    begin
      delete from public.content_media where content_item_id = '35000000-0000-4000-8000-000000012001';
      insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
      values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001',
              '35000000-0000-4000-8000-000000012001', '40000000-0000-4000-8000-000000012001', 0);
    end
  $t$$run$,
  'réordonnancement delete-puis-insert : aucun échec de cardinalité');

-- ===========================================================================
-- 2bis. RPC reorder_content_media (permutation atomique, contrainte deferrable)
--       Exécuté sous le rôle owner : la RLS SECURITY INVOKER doit autoriser.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000012001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000012001","role":"authenticated"}';

select lives_ok(
  $$select public.reorder_content_media(
      '35000000-0000-4000-8000-000000012005',
      array['41000000-0000-4000-8000-000000012012',
            '41000000-0000-4000-8000-000000012010',
            '41000000-0000-4000-8000-000000012011']::uuid[])$$,
  'reorder_content_media : permutation acceptée (contrainte unique deferrable)');

select results_eq(
  $$select id::text from public.content_media
    where content_item_id = '35000000-0000-4000-8000-000000012005' order by position$$,
  $$values ('41000000-0000-4000-8000-000000012012'),
           ('41000000-0000-4000-8000-000000012010'),
           ('41000000-0000-4000-8000-000000012011')$$,
  'reorder_content_media : positions permutées dans l ordre demandé');

reset role;

-- ===========================================================================
-- 3. cover : exclusion mutuelle + restrict (D11)
-- ===========================================================================

select throws_ok(
  $$update public.content_items
    set cover_media_asset_id = '40000000-0000-4000-8000-000000012001', cover_frame_ms = 3000
    where id = '35000000-0000-4000-8000-000000012004'$$,
  '23514', null,
  'content_items refuse cover_media_asset_id ET cover_frame_ms simultanés');

select lives_ok(
  $$update public.content_items set cover_media_asset_id = '40000000-0000-4000-8000-000000012001'
    where id = '35000000-0000-4000-8000-000000012004'$$,
  'content_items accepte une cover dédiée seule');

select throws_ok(
  $$delete from public.media_assets where id = '40000000-0000-4000-8000-000000012001'$$,
  '23503', null,
  'D11 : supprimer un média servant de cover est refusé (restrict)');

-- ===========================================================================
-- 4. RLS reviewer : voit le média du contenu visible, PAS le brouillon,
--    PAS le client 2, PAS l org B. Idem content_media.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000012003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000012003","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.media_assets where id = '40000000-0000-4000-8000-000000012001'$$,
  $$values (1)$$,
  'reviewer voit le média d un contenu in_review');

select results_eq(
  $$select count(*)::int from public.media_assets where id = '40000000-0000-4000-8000-000000012002'$$,
  $$values (0)$$,
  'reviewer ne voit PAS le média d un brouillon (fuite via table fille bloquée)');

select results_eq(
  $$select count(*)::int from public.media_assets where client_id = '20000000-0000-4000-8000-000000012002'$$,
  $$values (0)$$,
  'reviewer ne voit AUCUN média du client 2 de la même org');

select results_eq(
  $$select count(*)::int from public.media_assets where org_id = '10000000-0000-4000-8000-000000012002'$$,
  $$values (0)$$,
  'reviewer ne voit AUCUN média de l org B');

select results_eq(
  $$select count(*)::int from public.content_media where content_item_id = '35000000-0000-4000-8000-000000012002'$$,
  $$values (0)$$,
  'reviewer ne voit PAS la liaison content_media d un brouillon');

select results_eq(
  $$select count(*)::int from public.content_media where content_item_id = '35000000-0000-4000-8000-000000012001'$$,
  $$values (1)$$,
  'reviewer voit la liaison content_media d un contenu visible');

select throws_ok(
  $$insert into public.media_assets (org_id, client_id, type, thumb_path)
    values ('10000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000012001', 'image', 't/forge.webp')$$,
  '42501', null,
  'reviewer : INSERT média refusé par la RLS');

reset role;

-- owner A : org-level, jamais l org B
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000012001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000012001","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.media_assets where org_id = '10000000-0000-4000-8000-000000012002'$$,
  $$values (0)$$,
  'owner A ne voit AUCUN média de l org B');

select ok(
  (select count(*) from public.media_assets where client_id = '20000000-0000-4000-8000-000000012002') >= 1,
  'owner A voit la médiathèque de son 2e client (org-level)');

reset role;

-- ===========================================================================
-- 5. Cascade client A1 (a contenus + content_media + médias + cover restrict)
--    + GUARD-05. C'est le test dur : les FK restrict cross-child ne doivent
--    PAS bloquer la suppression du client parent.
-- ===========================================================================

select lives_ok(
  $$delete from public.clients where id = '20000000-0000-4000-8000-000000012001'$$,
  'supprimer le client A1 cascade tout (contenus, content_media, médias, cover) malgré les FK restrict cross-child');

select results_eq(
  $$select (select count(*) from public.media_assets where client_id = '20000000-0000-4000-8000-000000012001')::int
        + (select count(*) from public.content_media where client_id = '20000000-0000-4000-8000-000000012001')::int$$,
  $$values (0)$$,
  'cascade A1 : plus aucun média ni liaison orphelins');

select results_eq(
  $$select count(*)::int from (values ('public.media_assets'), ('public.content_media')) as t(name)
    where has_table_privilege('authenticated', t.name, 'TRUNCATE')$$,
  $$values (0)$$,
  'GUARD-05 : ni media_assets ni content_media ne laissent TRUNCATE à authenticated');

select * from finish();

rollback;
