-- Test 026 — le job zombie gele sa cible, et le statut terminal la libere.
--
-- Ce fichier ne teste PAS le code du reaper (il est en TypeScript, et aucune base
-- n'est joignable depuis l'hote — le conteneur ocean_rev2 tourne sans mapping de
-- port). Il prouve le MECANISME DE SCHEMA qui rend le ticket P3-7 necessaire, et
-- verifie que le geste choisi (terminaliser) le resout bien :
--
--   1. un job a bout de tentatives laisse `claimed` occupe l'index unique partiel
--      des statuts actifs (020:115), donc plus AUCUN job ne peut etre enfile pour
--      cette cible — elle est impubliable a vie ;
--   2. le passer `dead_letter` / `needs_verification` libere l'index.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000026001', 'lot3-026-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000026001', 'Ocean Org 026', 'ocean-026', '00000000-0000-4000-8000-000000026001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000026001', '00000000-0000-4000-8000-000000026001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000026001', '10000000-0000-4000-8000-000000026001', 'Client 026', 'client-026');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values ('30000000-0000-4000-8000-000000026001', '10000000-0000-4000-8000-000000026001', 'instagram', 'ig-conn-026');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values ('40000000-0000-4000-8000-000000026001', '10000000-0000-4000-8000-000000026001', '20000000-0000-4000-8000-000000026001', '30000000-0000-4000-8000-000000026001', 'instagram', 'ig-acct-026', 'client026');

insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values ('50000000-0000-4000-8000-000000026001', '10000000-0000-4000-8000-000000026001', '20000000-0000-4000-8000-000000026001', 'scheduled', now() + interval '1 hour');

insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values ('60000000-0000-4000-8000-000000026001', '10000000-0000-4000-8000-000000026001', '20000000-0000-4000-8000-000000026001', '50000000-0000-4000-8000-000000026001', '40000000-0000-4000-8000-000000026001', 'instagram', 'queued');

-- LE zombie : lease expire depuis longtemps, 5 tentatives sur 5 consommees.
-- La clause `attempts < max_attempts` du requeue ne le touche pas.
insert into public.publish_jobs
  (id, org_id, client_id, content_item_id, content_target_id, social_account_id, platform,
   status, run_at, attempts, max_attempts, worker_id, claimed_at, lease_expires_at)
values
  ('70000000-0000-4000-8000-000000026001', '10000000-0000-4000-8000-000000026001', '20000000-0000-4000-8000-000000026001', '50000000-0000-4000-8000-000000026001', '60000000-0000-4000-8000-000000026001', '40000000-0000-4000-8000-000000026001', 'instagram',
   'publishing', now() - interval '3 hours', 5, 5, 'worker-mort', now() - interval '2 hours', now() - interval '110 minutes');

-- ---------------------------------------------------------------------------
-- 1. Le requeue du reaper ne peut rien pour lui : c'est le point de depart.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where status in ('claimed', 'publishing')
      and lease_expires_at < now()
      and attempts < max_attempts$$,
  $$values (0::bigint)$$,
  'le requeue du reaper ne selectionne PAS un job a bout de tentatives'
);

-- ---------------------------------------------------------------------------
-- 2. Consequence : la cible est gelee. L'index unique partiel des statuts
--    actifs refuse tout nouveau job — la cible est impubliable a vie.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.publish_jobs
      (org_id, client_id, content_item_id, content_target_id, social_account_id, platform, run_at)
    values ('10000000-0000-4000-8000-000000026001', '20000000-0000-4000-8000-000000026001',
            '50000000-0000-4000-8000-000000026001', '60000000-0000-4000-8000-000000026001',
            '40000000-0000-4000-8000-000000026001', 'instagram', now())$$,
  '23505',
  null,
  'tant que le zombie vit, aucun autre job ne peut exister pour cette cible'
);

-- ---------------------------------------------------------------------------
-- 3. Le geste du reaper corrige (P3-7) : terminaliser.
--    Ancre nulle ici => rien n'est parti => dead_letter, pas needs_verification.
-- ---------------------------------------------------------------------------

update public.publish_jobs
set status = 'dead_letter', failed_at = now(),
    worker_id = null, claimed_at = null, lease_expires_at = null,
    last_error = jsonb_build_object('error', 'reaper_exhausted', 'detail', 'test')
where id = '70000000-0000-4000-8000-000000026001';

update public.content_targets set status = 'failed'
where id = '60000000-0000-4000-8000-000000026001';

select is(
  (select status::text from public.publish_jobs
   where id = '70000000-0000-4000-8000-000000026001'),
  'dead_letter',
  'le job est clos (dead_letter : l ancre etait nulle, donc rien n est parti)'
);

-- ---------------------------------------------------------------------------
-- 4. Et l'index est libere : la cible redevient enfilable.
-- ---------------------------------------------------------------------------

insert into public.publish_jobs
  (id, org_id, client_id, content_item_id, content_target_id, social_account_id, platform, run_at)
values
  ('70000000-0000-4000-8000-000000026002', '10000000-0000-4000-8000-000000026001', '20000000-0000-4000-8000-000000026001',
   '50000000-0000-4000-8000-000000026001', '60000000-0000-4000-8000-000000026001',
   '40000000-0000-4000-8000-000000026001', 'instagram', now());

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_target_id = '60000000-0000-4000-8000-000000026001'::uuid
      and status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying')$$,
  $$values (1::bigint)$$,
  'cible liberee : un job neuf redevient possible'
);

-- ---------------------------------------------------------------------------
-- 5. Le statut terminal `needs_verification` existe bien cote job : c'est celui
--    que le reaper pose quand l'ancre est posee (l issue est alors inconnue).
-- ---------------------------------------------------------------------------

update public.publish_jobs set status = 'needs_verification'
where id = '70000000-0000-4000-8000-000000026002';

select is(
  (select status::text from public.publish_jobs
   where id = '70000000-0000-4000-8000-000000026002'),
  'needs_verification',
  'un job peut etre clos en issue inconnue (cas ancre du reaper)'
);

select * from finish();

rollback;
