begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Org A {owner UA, reviewer UR sur client A1}, org B {owner UB}, reviewer C2 UR2.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001001', 'ua@010.test'),
  ('00000000-0000-4000-8000-000000001002', 'ur@010.test'),
  ('00000000-0000-4000-8000-000000001003', 'ur2@010.test'),
  ('00000000-0000-4000-8000-000000001004', 'ub@010.test'),
  ('00000000-0000-4000-8000-000000001005', 'newuser@010.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000001001', 'Org A 010', 'org-a-010', '00000000-0000-4000-8000-000000001001'),
  ('10000000-0000-4000-8000-000000001002', 'Org B 010', 'org-b-010', '00000000-0000-4000-8000-000000001004');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001001', 'owner'),
  ('10000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000001004', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000001001', '10000000-0000-4000-8000-000000001001', 'Client A1 010', 'client-a1-010'),
  ('20000000-0000-4000-8000-000000001002', '10000000-0000-4000-8000-000000001001', 'Client A2 010', 'client-a2-010');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001001', '20000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001002', 'reviewer'),
  ('10000000-0000-4000-8000-000000001001', '20000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000001003', 'reviewer');

-- ---------------------------------------------------------------------------
-- shares_scope_with : la lecture des profils partagés, dans les deux sens.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.sees(_caller uuid, _other uuid)
returns boolean language plpgsql as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', _caller::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', _caller, 'role', 'authenticated')::text, true);
  select private.shares_scope_with(_other) into r;
  return r;
end $$;

select ok(
  pg_temp.sees('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001002'),
  'owner A voit le profil du reviewer de son client (agence -> reviewer)');

select ok(
  pg_temp.sees('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000001001'),
  'reviewer voit le profil de l owner de l agence (reviewer -> agence, sens inverse)');

select ok(
  not pg_temp.sees('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001004'),
  'owner A ne voit PAS l owner d une autre org (cross-org)');

select ok(
  not pg_temp.sees('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000001003'),
  'reviewer client 1 ne voit PAS le reviewer client 2 de la meme org');

select ok(
  pg_temp.sees('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001003'),
  'owner A voit le reviewer de son 2e client');

-- ---------------------------------------------------------------------------
-- La policy profiles_select_shared applique le helper (test via RLS reelle).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001002';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000001002","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.profiles
    where id = '00000000-0000-4000-8000-000000001001'::uuid$$,
  $$values (1)$$,
  'via RLS : le reviewer lit le profil de l owner (policy shares)');

select results_eq(
  $$select count(*)::int from public.profiles
    where id = '00000000-0000-4000-8000-000000001004'::uuid$$,
  $$values (0)$$,
  'via RLS : le reviewer ne lit PAS le profil d un owner d une autre org');

reset role;
select set_config('request.jwt.claims', null, true);

-- ---------------------------------------------------------------------------
-- create_organization : org + membership owner en une transaction.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000001005';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000001005","role":"authenticated"}';

select lives_ok(
  $$select public.create_organization('Nouvelle Boite 010', 'nouvelle-boite-010')$$,
  'un user sans org peut amorcer son organisation');

reset role;

select is(
  (select role::text from public.organization_members m
   join public.organizations o on o.id = m.org_id
   where o.slug = 'nouvelle-boite-010'
     and m.user_id = '00000000-0000-4000-8000-000000001005'),
  'owner',
  'create_organization pose l appelant comme owner');

select * from finish();

rollback;
