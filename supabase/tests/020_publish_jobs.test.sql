-- Test 020 — Isolation multi-tenant de publish_jobs + deny-all d'ecriture.
--
-- publish_jobs porte des donnees d'execution (external_container_id,
-- external_post_id) : une fuite inter-org exposerait l'activite de publication
-- d'un autre tenant. Ecritures reservees au worker (service_role) : aucun
-- `authenticated` ne cree/modifie/supprime un job (seules les RPC le font).

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000002001', 'lot2-020-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000002002', 'lot2-020-owner-b@example.test'),
  ('00000000-0000-4000-8000-000000002003', 'lot2-020-reviewer-c1@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000002001', 'Ocean Org 020 A', 'ocean-020-a', '00000000-0000-4000-8000-000000002001'),
  ('10000000-0000-4000-8000-000000002002', 'Ocean Org 020 B', 'ocean-020-b', '00000000-0000-4000-8000-000000002002');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000002001', 'owner'),
  ('10000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000002002', 'owner');

insert into public.clients (id, org_id, name, handle)
values
  ('20000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000002001', 'Client 020 A1', 'client-020-a1'),
  ('20000000-0000-4000-8000-000000002003', '10000000-0000-4000-8000-000000002002', 'Client 020 B1', 'client-020-b1');

-- Reviewer rattache au client A1 uniquement.
insert into public.client_members (org_id, client_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000002001',
  '20000000-0000-4000-8000-000000002001',
  '00000000-0000-4000-8000-000000002003',
  'reviewer'
);

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values
  ('30000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000002001', 'instagram', 'ig-conn-020-a'),
  ('30000000-0000-4000-8000-000000002003', '10000000-0000-4000-8000-000000002002', 'instagram', 'ig-conn-020-b');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values
  ('40000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000002001', '30000000-0000-4000-8000-000000002001', 'instagram', 'ig-acct-020-a1', 'client020a1'),
  ('40000000-0000-4000-8000-000000002003', '10000000-0000-4000-8000-000000002002', '20000000-0000-4000-8000-000000002003', '30000000-0000-4000-8000-000000002003', 'instagram', 'ig-acct-020-b1', 'client020b1');

insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values
  ('50000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000002001', 'scheduled', now() + interval '1 hour'),
  ('50000000-0000-4000-8000-000000002003', '10000000-0000-4000-8000-000000002002', '20000000-0000-4000-8000-000000002003', 'scheduled', now() + interval '1 hour');

insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values
  ('60000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000002001', '50000000-0000-4000-8000-000000002001', '40000000-0000-4000-8000-000000002001', 'instagram', 'queued'),
  ('60000000-0000-4000-8000-000000002003', '10000000-0000-4000-8000-000000002002', '20000000-0000-4000-8000-000000002003', '50000000-0000-4000-8000-000000002003', '40000000-0000-4000-8000-000000002003', 'instagram', 'queued');

insert into public.publish_jobs (id, org_id, client_id, content_item_id, content_target_id, social_account_id, platform, run_at)
values
  ('70000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000002001', '50000000-0000-4000-8000-000000002001', '60000000-0000-4000-8000-000000002001', '40000000-0000-4000-8000-000000002001', 'instagram', now() + interval '1 hour'),
  ('70000000-0000-4000-8000-000000002003', '10000000-0000-4000-8000-000000002002', '20000000-0000-4000-8000-000000002003', '50000000-0000-4000-8000-000000002003', '60000000-0000-4000-8000-000000002003', '40000000-0000-4000-8000-000000002003', 'instagram', now() + interval '1 hour');

-- ---------------------------------------------------------------------------
-- Owner de l'org B : ne voit aucun job de l'org A.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002002';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000002002","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where org_id = '10000000-0000-4000-8000-000000002001'::uuid$$,
  $$values (0::bigint)$$,
  'org B ne lit pas les publish_jobs de l org A'
);

-- ---------------------------------------------------------------------------
-- Reviewer du client A1 : aucun acces aux jobs (pas de policy client).
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000002003","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.publish_jobs$$,
  $$values (0::bigint)$$,
  'un reviewer ne lit aucun publish_job (pas de livrable client)'
);

-- ---------------------------------------------------------------------------
-- Owner de l'org A : lit ses propres jobs, et NE PEUT PAS ecrire.
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000002001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000002001","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where org_id = '10000000-0000-4000-8000-000000002001'::uuid$$,
  $$values (1::bigint)$$,
  'org A lit ses propres publish_jobs'
);

select throws_ok(
  $$insert into public.publish_jobs (org_id, client_id, content_item_id, content_target_id, social_account_id, platform, run_at)
    values ('10000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000002001', '50000000-0000-4000-8000-000000002001', '60000000-0000-4000-8000-000000002001', '40000000-0000-4000-8000-000000002001', 'instagram', now())$$,
  '42501',
  null,
  'authenticated NE PEUT PAS inserer un publish_job'
);

select throws_ok(
  $$update public.publish_jobs set status = 'succeeded'
    where id = '70000000-0000-4000-8000-000000002001'$$,
  '42501',
  null,
  'authenticated NE PEUT PAS modifier un publish_job'
);

select throws_ok(
  $$delete from public.publish_jobs
    where id = '70000000-0000-4000-8000-000000002001'$$,
  '42501',
  null,
  'authenticated NE PEUT PAS supprimer un publish_job'
);

reset role;
select * from finish();

rollback;
