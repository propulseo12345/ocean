-- Test 026 — la garde de suppression couvre aussi l'ancre residuelle d'un JOB.
--
-- 023 refuse deja la suppression d'une cible dont `publish_started_at` est pose.
-- 026 ajoute le cas ou l'ancre n'existe QUE sur un job (donnee heritee d'un
-- worker anterieur a 023). Et verifie surtout ce qu'il ne faut PAS casser : la
-- suppression d'une cible non ancree portant un job `canceled` — le chemin exact
-- de `reconcileTargets`, qui serait tombe si la FK etait passee en `restrict`.

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000026101', 'lot3-026g-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000026101', 'Ocean Org 026g', 'ocean-026g', '00000000-0000-4000-8000-000000026101');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000026101', '00000000-0000-4000-8000-000000026101', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000026101', '10000000-0000-4000-8000-000000026101', 'Client 026g', 'client-026g');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values ('30000000-0000-4000-8000-000000026101', '10000000-0000-4000-8000-000000026101', 'instagram', 'ig-conn-026g');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values ('40000000-0000-4000-8000-000000026101', '10000000-0000-4000-8000-000000026101', '20000000-0000-4000-8000-000000026101', '30000000-0000-4000-8000-000000026101', 'instagram', 'ig-acct-026g', 'client026g');

insert into public.content_items (id, org_id, client_id, status)
values
  ('50000000-0000-4000-8000-00000002610a', '10000000-0000-4000-8000-000000026101', '20000000-0000-4000-8000-000000026101', 'draft'),
  ('50000000-0000-4000-8000-00000002610b', '10000000-0000-4000-8000-000000026101', '20000000-0000-4000-8000-000000026101', 'draft');

-- A : cible NON ancree, mais un JOB ancre (cas herite d'avant 023).
-- B : cible NON ancree, job `canceled` — le chemin de reconcileTargets.
insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values
  ('60000000-0000-4000-8000-00000002610a', '10000000-0000-4000-8000-000000026101', '20000000-0000-4000-8000-000000026101', '50000000-0000-4000-8000-00000002610a', '40000000-0000-4000-8000-000000026101', 'instagram', 'pending'),
  ('60000000-0000-4000-8000-00000002610b', '10000000-0000-4000-8000-000000026101', '20000000-0000-4000-8000-000000026101', '50000000-0000-4000-8000-00000002610b', '40000000-0000-4000-8000-000000026101', 'instagram', 'pending');

insert into public.publish_jobs
  (id, org_id, client_id, content_item_id, content_target_id, social_account_id, platform, status, run_at, publish_started_at, canceled_at)
values
  ('70000000-0000-4000-8000-00000002610a', '10000000-0000-4000-8000-000000026101', '20000000-0000-4000-8000-000000026101', '50000000-0000-4000-8000-00000002610a', '60000000-0000-4000-8000-00000002610a', '40000000-0000-4000-8000-000000026101', 'instagram', 'failed', now(), now() - interval '1 hour', null),
  ('70000000-0000-4000-8000-00000002610b', '10000000-0000-4000-8000-000000026101', '20000000-0000-4000-8000-000000026101', '50000000-0000-4000-8000-00000002610b', '60000000-0000-4000-8000-00000002610b', '40000000-0000-4000-8000-000000026101', 'instagram', 'canceled', now(), null, now());

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000026101';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000026101","role":"authenticated"}';

select throws_ok(
  $$delete from public.content_targets where id = '60000000-0000-4000-8000-00000002610a'$$,
  '42501',
  null,
  'ancre portee par un JOB seul : la suppression est refusee aussi'
);

-- Ce qu'il ne faut PAS casser : le chemin de reconcileTargets.
delete from public.content_targets where id = '60000000-0000-4000-8000-00000002610b';

select results_eq(
  $$select count(*)::bigint from public.content_targets
    where id = '60000000-0000-4000-8000-00000002610b'::uuid$$,
  $$values (0::bigint)$$,
  'cible non ancree avec job canceled : suppression OK (chemin reconcileTargets)'
);

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_target_id = '60000000-0000-4000-8000-00000002610b'::uuid$$,
  $$values (0::bigint)$$,
  'et son job canceled part en cascade — c est ce que `restrict` aurait casse'
);

reset role;
select * from finish();

rollback;
