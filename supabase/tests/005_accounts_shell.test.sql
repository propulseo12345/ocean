begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000501', 'lot0-005-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000502', 'lot0-005-owner-b@example.test'),
  ('00000000-0000-4000-8000-000000000503', 'lot0-005-reviewer-c1@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000501', 'Ocean Org 005 A', 'ocean-005-a', '00000000-0000-4000-8000-000000000501'),
  ('10000000-0000-4000-8000-000000000502', 'Ocean Org 005 B', 'ocean-005-b', '00000000-0000-4000-8000-000000000502');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000501', 'owner'),
  ('10000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000502', 'owner');

-- Deux clients dans l'org A : le reviewer n'appartient qu'au premier.
insert into public.clients (id, org_id, name, handle)
values
  ('20000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000501', 'Client 005 A1', 'client-005-a1'),
  ('20000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000501', 'Client 005 A2', 'client-005-a2'),
  ('20000000-0000-4000-8000-000000000503', '10000000-0000-4000-8000-000000000502', 'Client 005 B1', 'client-005-b1');

insert into public.client_members (org_id, client_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000501',
  '20000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000503',
  'reviewer'
);

insert into public.platform_connections (id, org_id, provider, connected_by, provider_account_id, provider_account_name)
values
  ('30000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000501', 'instagram', '00000000-0000-4000-8000-000000000501', 'ig-platform-005-a', 'IG Platform 005 A'),
  ('30000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000502', 'instagram', '00000000-0000-4000-8000-000000000502', 'ig-platform-005-b', 'IG Platform 005 B');

insert into public.platform_connection_secrets (platform_connection_id, org_id, vault_access_token_secret_id)
values (
  '30000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000501',
  '90000000-0000-4000-8000-000000000501'
);

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values
  ('40000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000501', '30000000-0000-4000-8000-000000000501', 'instagram', 'ig-social-005-a1', 'client005a1'),
  ('40000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000502', '30000000-0000-4000-8000-000000000501', 'instagram', 'ig-social-005-a2', 'client005a2'),
  ('40000000-0000-4000-8000-000000000503', '10000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000503', '30000000-0000-4000-8000-000000000502', 'instagram', 'ig-social-005-b1', 'client005b1');

insert into public.social_account_secrets (social_account_id, org_id, client_id, vault_access_token_secret_id)
values (
  '40000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000501',
  '20000000-0000-4000-8000-000000000501',
  '90000000-0000-4000-8000-000000000502'
);

-- On simule VOLONTAIREMENT un grant qui fuit : RLS activee sans policy doit
-- tenir meme si un grant est ajoute par erreur. C'est la preuve du deny-all.
grant select on public.platform_connection_secrets to authenticated;
grant select on public.social_account_secrets to authenticated;

-- ---------------------------------------------------------------------------
-- Owner de l'org B : ne voit rien de l'org A.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000502';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.platform_connections
    where org_id = '10000000-0000-4000-8000-000000000501'::uuid$$,
  $$values (0::bigint)$$,
  'org B cannot read org A platform_connections'
);

select results_eq(
  $$select count(*)::bigint from public.social_accounts
    where org_id = '10000000-0000-4000-8000-000000000501'::uuid$$,
  $$values (0::bigint)$$,
  'org B cannot read org A social_accounts'
);

-- ---------------------------------------------------------------------------
-- Reviewer du client 1 : voit les comptes de SON client, pas ceux du client 2
-- de la meme org, et jamais les platform_connections (org-level).
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000503';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000503","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.social_accounts
    where client_id = '20000000-0000-4000-8000-000000000501'::uuid$$,
  $$values (1::bigint)$$,
  'reviewer reads social_accounts of their own client'
);

select results_eq(
  $$select count(*)::bigint from public.social_accounts
    where client_id = '20000000-0000-4000-8000-000000000502'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer of client 1 cannot read social_accounts of client 2 (same org)'
);

-- ---------------------------------------------------------------------------
-- Deny-all des *_secrets, malgre le grant simule plus haut.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.platform_connection_secrets$$,
  $$values (0::bigint)$$,
  'authenticated cannot read platform_connection_secrets (RLS holds despite grant)'
);

select results_eq(
  $$select count(*)::bigint from public.social_account_secrets$$,
  $$values (0::bigint)$$,
  'authenticated cannot read social_account_secrets (RLS holds despite grant)'
);

reset role;
select * from finish();

rollback;
