begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000601', 'lot0-006-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000602', 'lot0-006-owner-b@example.test'),
  ('00000000-0000-4000-8000-000000000603', 'lot0-006-reviewer@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000601', 'Ocean Org 006 A', 'ocean-006-a', '00000000-0000-4000-8000-000000000601'),
  ('10000000-0000-4000-8000-000000000602', 'Ocean Org 006 B', 'ocean-006-b', '00000000-0000-4000-8000-000000000602');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000601', 'owner'),
  ('10000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000602', 'owner');

insert into public.clients (id, org_id, name, handle)
values
  ('20000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', 'Client 006 A1', 'client-006-a1'),
  ('20000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000601', 'Client 006 A2', 'client-006-a2'),
  ('20000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000602', 'Client 006 B1', 'client-006-b1');

insert into public.client_members (org_id, client_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000601',
  '20000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000603',
  'reviewer'
);

insert into public.platform_connections (id, org_id, provider, connected_by, provider_account_id)
values
  ('30000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', 'instagram', '00000000-0000-4000-8000-000000000601', 'ig-platform-006-a'),
  ('30000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000602', 'instagram', '00000000-0000-4000-8000-000000000602', 'ig-platform-006-b');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values
  ('40000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000601', '30000000-0000-4000-8000-000000000601', 'instagram', 'ig-social-006-a1', 'client006a1'),
  ('40000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000602', '30000000-0000-4000-8000-000000000601', 'instagram', 'ig-social-006-a2', 'client006a2'),
  ('40000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000602', '20000000-0000-4000-8000-000000000603', '30000000-0000-4000-8000-000000000602', 'instagram', 'ig-social-006-b1', 'client006b1');

insert into public.social_account_secrets (social_account_id, org_id, client_id, vault_access_token_secret_id)
values (
  '40000000-0000-4000-8000-000000000601',
  '10000000-0000-4000-8000-000000000601',
  '20000000-0000-4000-8000-000000000601',
  '90000000-0000-4000-8000-000000000601'
);

insert into public.content_items (id, org_id, client_id, title, caption, created_by)
values
  ('50000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000601', 'Content 006 A1', 'Caption A1', '00000000-0000-4000-8000-000000000601'),
  ('50000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000602', 'Content 006 A2', 'Caption A2', '00000000-0000-4000-8000-000000000601'),
  ('50000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000602', '20000000-0000-4000-8000-000000000603', 'Content 006 B1', 'Caption B1', '00000000-0000-4000-8000-000000000602');

grant select on public.social_account_secrets to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000602';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.content_items where org_id = '10000000-0000-4000-8000-000000000601'::uuid$$,
  $$values (0::bigint)$$,
  'org B cannot read org A content'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000603';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000603","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.content_items where client_id = '20000000-0000-4000-8000-000000000601'::uuid$$,
  $$values (1::bigint)$$,
  'reviewer client 1 can read own client content'
);

select results_eq(
  $$select count(*)::bigint from public.content_items where client_id = '20000000-0000-4000-8000-000000000602'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer client 1 cannot read client 2 content'
);

select results_eq(
  $$with updated as (
      update public.content_items
      set title = 'Hacked by reviewer'
      where id = '50000000-0000-4000-8000-000000000601'::uuid
      returning id
    )
    select count(*)::bigint from updated$$,
  $$values (0::bigint)$$,
  'reviewer cannot update content_items'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated"}';

select throws_ok(
  $$insert into public.content_targets (
      org_id,
      client_id,
      content_item_id,
      social_account_id,
      platform
    )
    values (
      '10000000-0000-4000-8000-000000000601',
      '20000000-0000-4000-8000-000000000601',
      '50000000-0000-4000-8000-000000000601',
      '40000000-0000-4000-8000-000000000602',
      'instagram'
    )$$,
  '23503',
  'cross-client content_target insert fails by FK composite'
);

select results_eq(
  $$select count(*)::bigint from public.social_account_secrets$$,
  $$values (0::bigint)$$,
  'authenticated cannot read social_account_secrets'
);

reset role;
select * from finish();

rollback;
