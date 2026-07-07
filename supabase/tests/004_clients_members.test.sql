begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000401', 'lot0-004-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000402', 'lot0-004-owner-b@example.test'),
  ('00000000-0000-4000-8000-000000000403', 'lot0-004-reviewer@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000401', 'Ocean Org 004 A', 'ocean-004-a', '00000000-0000-4000-8000-000000000401'),
  ('10000000-0000-4000-8000-000000000402', 'Ocean Org 004 B', 'ocean-004-b', '00000000-0000-4000-8000-000000000402');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000401', 'owner'),
  ('10000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000402', 'owner');

insert into public.clients (id, org_id, name, handle)
values
  ('20000000-0000-4000-8000-000000000401', '10000000-0000-4000-8000-000000000401', 'Client 004 A1', 'client-004-a1'),
  ('20000000-0000-4000-8000-000000000402', '10000000-0000-4000-8000-000000000401', 'Client 004 A2', 'client-004-a2'),
  ('20000000-0000-4000-8000-000000000403', '10000000-0000-4000-8000-000000000402', 'Client 004 B1', 'client-004-b1');

insert into public.client_members (org_id, client_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000401',
  '20000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000403',
  'reviewer'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000401';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.clients where org_id = '10000000-0000-4000-8000-000000000401'::uuid$$,
  $$values (2::bigint)$$,
  'org member can see own clients'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000402';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.clients where org_id = '10000000-0000-4000-8000-000000000401'::uuid$$,
  $$values (0::bigint)$$,
  'org B cannot see org A clients'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000403';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000403","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.clients where id = '20000000-0000-4000-8000-000000000401'::uuid$$,
  $$values (1::bigint)$$,
  'reviewer can see own client through client_members'
);

select results_eq(
  $$select count(*)::bigint from public.clients where id = '20000000-0000-4000-8000-000000000402'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer cannot see another client in same org'
);

reset role;
select * from finish();

rollback;
