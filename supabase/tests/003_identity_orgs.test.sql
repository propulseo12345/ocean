begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000301', 'lot0-003-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000302', 'lot0-003-owner-b@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000301', 'Ocean Org 003 A', 'ocean-003-a', '00000000-0000-4000-8000-000000000301'),
  ('10000000-0000-4000-8000-000000000302', 'Ocean Org 003 B', 'ocean-003-b', '00000000-0000-4000-8000-000000000302');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000301', 'owner'),
  ('10000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000302', 'owner');

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

reset role;
select * from finish();

rollback;
