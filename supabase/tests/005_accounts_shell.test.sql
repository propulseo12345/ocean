begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000501', 'lot0-005-owner-a@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000000501', 'Ocean Org 005 A', 'ocean-005-a', '00000000-0000-4000-8000-000000000501');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000501', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000501', 'Client 005 A1', 'client-005-a1');

insert into public.platform_connections (id, org_id, provider, connected_by, provider_account_id, provider_account_name)
values (
  '30000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000501',
  'instagram',
  '00000000-0000-4000-8000-000000000501',
  'ig-platform-005',
  'IG Platform 005'
);

insert into public.platform_connection_secrets (platform_connection_id, org_id, vault_access_token_secret_id)
values (
  '30000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000501',
  '90000000-0000-4000-8000-000000000501'
);

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values (
  '40000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000501',
  '20000000-0000-4000-8000-000000000501',
  '30000000-0000-4000-8000-000000000501',
  'instagram',
  'ig-social-005',
  'client005'
);

insert into public.social_account_secrets (social_account_id, org_id, client_id, vault_access_token_secret_id)
values (
  '40000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000501',
  '20000000-0000-4000-8000-000000000501',
  '90000000-0000-4000-8000-000000000502'
);

grant select on public.platform_connection_secrets to authenticated;
grant select on public.social_account_secrets to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.platform_connection_secrets$$,
  $$values (0::bigint)$$,
  'authenticated cannot read platform_connection_secrets'
);

select results_eq(
  $$select count(*)::bigint from public.social_account_secrets$$,
  $$values (0::bigint)$$,
  'authenticated cannot read social_account_secrets'
);

reset role;
select * from finish();

rollback;
