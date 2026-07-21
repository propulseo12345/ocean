begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

-- ===========================================================================
-- Seed. org A {owner UA}, org B {owner UB}. Client A1 avec un contenu et deux
-- cibles (instagram, tiktok) ; client B1 avec un contenu et une cible.
-- ===========================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000016001', 'ua@016.test'),
  ('00000000-0000-4000-8000-000000016002', 'ub@016.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000016001', 'Org A 016', 'org-a-016', '00000000-0000-4000-8000-000000016001'),
  ('10000000-0000-4000-8000-000000016002', 'Org B 016', 'org-b-016', '00000000-0000-4000-8000-000000016002');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000016001', '00000000-0000-4000-8000-000000016001', 'owner'),
  ('10000000-0000-4000-8000-000000016002', '00000000-0000-4000-8000-000000016002', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000016001', '10000000-0000-4000-8000-000000016001', 'Client A1 016', 'client-a1-016'),
  ('20000000-0000-4000-8000-000000016002', '10000000-0000-4000-8000-000000016002', 'Client B1 016', 'client-b1-016');

insert into public.content_items (id, org_id, client_id, title, status, format) values
  ('35000000-0000-4000-8000-000000016001', '10000000-0000-4000-8000-000000016001', '20000000-0000-4000-8000-000000016001', 'A1 manuel', 'scheduled', 'post'),
  ('35000000-0000-4000-8000-000000016002', '10000000-0000-4000-8000-000000016001', '20000000-0000-4000-8000-000000016001', 'A1 matrice', 'draft', 'post'),
  ('35000000-0000-4000-8000-000000016003', '10000000-0000-4000-8000-000000016002', '20000000-0000-4000-8000-000000016002', 'B1 manuel', 'scheduled', 'post');

insert into public.content_targets (id, org_id, client_id, content_item_id, platform, status) values
  ('52000000-0000-4000-8000-000000016001', '10000000-0000-4000-8000-000000016001', '20000000-0000-4000-8000-000000016001', '35000000-0000-4000-8000-000000016001', 'tiktok', 'pushed_to_platform'),
  ('52000000-0000-4000-8000-000000016002', '10000000-0000-4000-8000-000000016001', '20000000-0000-4000-8000-000000016001', '35000000-0000-4000-8000-000000016001', 'instagram', 'queued'),
  ('52000000-0000-4000-8000-000000016003', '10000000-0000-4000-8000-000000016002', '20000000-0000-4000-8000-000000016002', '35000000-0000-4000-8000-000000016003', 'tiktok', 'failed');

-- ===========================================================================
-- 1. Matrice 008 après 016 : draft -> idea autorisé (C3), et RIEN d'autre
--    n'a bougé. Sous claims authenticated, sinon la garde bypasse.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000016001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated"}';

select lives_ok(
  $$update public.content_items set status = 'idea'
    where id = '35000000-0000-4000-8000-000000016002'$$,
  'C3 : draft -> idea est autorise (ajout 016)');

select is(
  (select status::text from public.content_items where id = '35000000-0000-4000-8000-000000016002'),
  'idea',
  'C3 : le statut idea est bien persiste');

-- Les verrous historiques de 008 tiennent toujours.
select throws_ok(
  $$update public.content_items set status = 'published'
    where id = '35000000-0000-4000-8000-000000016001'$$,
  '42501', null,
  '008 tient : un membre org ne pose PAS published en direct (publication fantome)');

select throws_ok(
  $$update public.content_items set status = 'in_review'
    where id = '35000000-0000-4000-8000-000000016002'$$,
  '42501', null,
  '008 tient : idea -> in_review reste interdit (C1/C2 se font en 2 etapes)');

select throws_ok(
  $$update public.content_items set status = 'in_review'
    where id = '35000000-0000-4000-8000-000000016001'$$,
  '42501', null,
  '008 tient : scheduled -> in_review reste interdit (isMovable etait trop permissif)');

reset role;

-- Remise en etat pour la suite.
update public.content_items set status = 'draft'
where id = '35000000-0000-4000-8000-000000016002';

-- ===========================================================================
-- 2. content_targets : la garde de 013 tient toujours en direct.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000016001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated"}';

select throws_ok(
  $$update public.content_targets set status = 'published'
    where id = '52000000-0000-4000-8000-000000016001'$$,
  '42501', null,
  '013 tient : PATCH direct status=published sur une cible refuse');

-- ===========================================================================
-- 3. mark_target_published_manually — le chemin AUTORISE et TRACE
-- ===========================================================================

select is(
  (select public.mark_target_published_manually(
     '52000000-0000-4000-8000-000000016001', 'ext_1', 'https://tiktok/x')::text),
  'published',
  'RPC : la cible TikTok pushed_to_platform passe a published');

select is(
  (select status::text from public.content_targets
    where id = '52000000-0000-4000-8000-000000016001'),
  'published',
  'RPC : le statut de la cible est persiste malgre la garde 013');

select isnt(
  (select manual_published_by from public.content_targets
    where id = '52000000-0000-4000-8000-000000016001'),
  null,
  'RPC : la declaration humaine est TRACEE (manual_published_by)');

-- Le parent ne bouge PAS : une cible sur deux seulement est publiee.
select is(
  (select status::text from public.content_items
    where id = '35000000-0000-4000-8000-000000016001'),
  'scheduled',
  'RPC : le parent reste scheduled tant qu une cible est en attente');

-- La seconde cible publiee -> le parent devient published.
select lives_ok(
  $$select public.mark_target_published_manually('52000000-0000-4000-8000-000000016002')$$,
  'RPC : la seconde cible (queued) se declare aussi');

select is(
  (select status::text from public.content_items
    where id = '35000000-0000-4000-8000-000000016001'),
  'published',
  'RPC : toutes les cibles publiees -> le parent passe published (statut agrege)');

-- Idempotence : deuxieme appel sur une cible deja published = no-op, pas une erreur.
select lives_ok(
  $$select public.mark_target_published_manually('52000000-0000-4000-8000-000000016001')$$,
  'RPC : re-declarer une cible deja published est un no-op idempotent');

-- LA restauration des claims : apres la RPC, la garde doit avoir REPRIS la main.
select throws_ok(
  $$update public.content_items set status = 'draft'
    where id = '35000000-0000-4000-8000-000000016001'$$,
  '42501', null,
  'les claims sont RESTAURES apres la RPC : published -> draft redevient interdit');

-- ===========================================================================
-- 4. Isolation multi-tenant de la RPC
-- ===========================================================================

select throws_ok(
  $$select public.mark_target_published_manually('52000000-0000-4000-8000-000000016003')$$,
  '42501', null,
  'org A ne declare PAS la publication d une cible de org B');

select throws_ok(
  $$select public.request_target_retry('52000000-0000-4000-8000-000000016003')$$,
  '42501', null,
  'org A ne relance PAS une cible de org B');

-- ===========================================================================
-- 5. request_target_retry — regle 15 : on pose l intention, pas le statut
-- ===========================================================================

reset role;
update public.content_targets set status = 'failed'
where id = '52000000-0000-4000-8000-000000016002';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000016001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated"}';

select isnt(
  (select public.request_target_retry('52000000-0000-4000-8000-000000016002')),
  null,
  'RPC retry : une cible failed accepte la demande');

select is(
  (select status::text from public.content_targets
    where id = '52000000-0000-4000-8000-000000016002'),
  'failed',
  'REGLE 15 : le retry ne remet PAS la cible en queued — le worker decide');

select throws_ok(
  $$select public.request_target_retry('52000000-0000-4000-8000-000000016001')$$,
  '42501', null,
  'RPC retry : une cible published ne se relance pas (double publication)');

reset role;

select * from finish();

rollback;
