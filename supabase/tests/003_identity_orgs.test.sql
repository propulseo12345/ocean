begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000301', 'lot0-003-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000302', 'lot0-003-owner-b@example.test'),
  ('00000000-0000-4000-8000-000000000303', 'lot0-003-admin-a@example.test'),
  ('00000000-0000-4000-8000-000000000304', 'lot0-003-outsider@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000301', 'Ocean Org 003 A', 'ocean-003-a', '00000000-0000-4000-8000-000000000301'),
  ('10000000-0000-4000-8000-000000000302', 'Ocean Org 003 B', 'ocean-003-b', '00000000-0000-4000-8000-000000000302');

insert into public.organization_members (id, org_id, user_id, role)
values
  ('a0000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000301', 'owner'),
  ('a0000000-0000-4000-8000-000000000302', '10000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000302', 'owner'),
  -- l'admin de l'org A : c'est lui qui ne doit pas pouvoir s'auto-promouvoir
  ('a0000000-0000-4000-8000-000000000303', '10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000303', 'admin');

select hasnt_column(
  'public',
  'profiles',
  'org_id',
  'profiles has no org_id column'
);

select hasnt_column(
  'public',
  'profiles',
  'role',
  'profiles has no role column'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.organizations where id = '10000000-0000-4000-8000-000000000301'::uuid$$,
  $$values (1::bigint)$$,
  'org member sees own organization'
);

select results_eq(
  $$select count(*)::bigint from public.organizations where id = '10000000-0000-4000-8000-000000000302'::uuid$$,
  $$values (0::bigint)$$,
  'non-member cannot see another organization'
);

select results_eq(
  $$select count(*)::bigint from public.profiles$$,
  $$values (1::bigint)$$,
  'profiles policy exposes only the current user profile'
);

-- ---------------------------------------------------------------------------
-- Escalade de role : l'admin de l'org A ne gere pas les membres.
-- UPDATE / DELETE bloques par le USING d'une policy n'affectent 0 ligne
-- (pas d'exception) ; seul un INSERT bloque par WITH CHECK leve 42501.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000303';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000303","role":"authenticated"}';

select results_eq(
  $$with updated as (
      update public.organization_members set role = 'owner'
      where id = 'a0000000-0000-4000-8000-000000000303'::uuid
      returning id
    )
    select count(*)::bigint from updated$$,
  $$values (0::bigint)$$,
  'admin cannot promote themselves to owner'
);

select results_eq(
  $$with deleted as (
      delete from public.organization_members
      where id = 'a0000000-0000-4000-8000-000000000301'::uuid
      returning id
    )
    select count(*)::bigint from deleted$$,
  $$values (0::bigint)$$,
  'admin cannot delete the owner'
);

select throws_ok(
  $$insert into public.organization_members (org_id, user_id, role)
    values (
      '10000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000304',
      'admin'
    )$$,
  '42501',
  null,
  'admin cannot add a new member'
);

-- Contrepartie : la garde ne doit pas bloquer l'owner.
-- Un test qui ne prouve que le refus ne prouve rien sur l'autorisation.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated"}';

select lives_ok(
  $$insert into public.organization_members (org_id, user_id, role)
    values (
      '10000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000304',
      'admin'
    )$$,
  'owner can add a member'
);

reset role;
select * from finish();

rollback;
