-- Test 027 — deprogrammer atteint un job DEJA RECLAME, et jamais un job demarre.
--
-- Avant 027, `cancel_publish_jobs` ne touchait que ('scheduled','retrying') : un
-- job pris par un worker etait ignore en silence, la RPC renvoyait 0, et le post
-- partait quand meme. C'est la fenetre de 2 minutes du lease — sur un Reel, le
-- temps exact qu'il faut pour changer d'avis.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000027001', 'lot3-027-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000027001', 'Ocean Org 027', 'ocean-027', '00000000-0000-4000-8000-000000027001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000027001', '00000000-0000-4000-8000-000000027001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000027001', '10000000-0000-4000-8000-000000027001', 'Client 027', 'client-027');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values ('30000000-0000-4000-8000-000000027001', '10000000-0000-4000-8000-000000027001', 'instagram', 'ig-conn-027');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values ('40000000-0000-4000-8000-000000027001', '10000000-0000-4000-8000-000000027001', '20000000-0000-4000-8000-000000027001', '30000000-0000-4000-8000-000000027001', 'instagram', 'ig-acct-027', 'client027');

-- A : job CLAIMED, rien n'est parti      -> doit etre annule
-- B : job PUBLISHING, ancre posee        -> ne doit JAMAIS etre annule
insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values
  ('50000000-0000-4000-8000-00000002700a', '10000000-0000-4000-8000-000000027001', '20000000-0000-4000-8000-000000027001', 'scheduled', now() + interval '1 hour'),
  ('50000000-0000-4000-8000-00000002700b', '10000000-0000-4000-8000-000000027001', '20000000-0000-4000-8000-000000027001', 'scheduled', now() + interval '1 hour');

insert into public.content_targets
  (id, org_id, client_id, content_item_id, social_account_id, platform, status, publish_started_at, external_container_id)
values
  ('60000000-0000-4000-8000-00000002700a', '10000000-0000-4000-8000-000000027001', '20000000-0000-4000-8000-000000027001', '50000000-0000-4000-8000-00000002700a', '40000000-0000-4000-8000-000000027001', 'instagram', 'queued', null, null),
  ('60000000-0000-4000-8000-00000002700b', '10000000-0000-4000-8000-000000027001', '20000000-0000-4000-8000-000000027001', '50000000-0000-4000-8000-00000002700b', '40000000-0000-4000-8000-000000027001', 'instagram', 'queued', now() - interval '30 seconds', 'ig-container-027b');

insert into public.publish_jobs
  (id, org_id, client_id, content_item_id, content_target_id, social_account_id, platform,
   status, run_at, worker_id, claimed_at, lease_expires_at, publish_started_at)
values
  ('70000000-0000-4000-8000-00000002700a', '10000000-0000-4000-8000-000000027001', '20000000-0000-4000-8000-000000027001', '50000000-0000-4000-8000-00000002700a', '60000000-0000-4000-8000-00000002700a', '40000000-0000-4000-8000-000000027001', 'instagram',
   'claimed', now(), 'worker-1', now(), now() + interval '2 minutes', null),
  ('70000000-0000-4000-8000-00000002700b', '10000000-0000-4000-8000-000000027001', '20000000-0000-4000-8000-000000027001', '50000000-0000-4000-8000-00000002700b', '60000000-0000-4000-8000-00000002700b', '40000000-0000-4000-8000-000000027001', 'instagram',
   'publishing', now(), 'worker-1', now(), now() + interval '2 minutes', now() - interval '30 seconds');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000027001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000027001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- A — LE cas du ticket.
-- ---------------------------------------------------------------------------

select is(
  public.cancel_publish_jobs('50000000-0000-4000-8000-00000002700a'),
  1,
  'un job DEJA RECLAME est annule (avant 027 : 0, et le post partait)'
);

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002700a'),
  'canceled',
  'le job est bien passe canceled'
);

-- Le lease est relache : c'est ce qui fait echouer la prochaine ecriture fencee
-- du worker (P3-5), donc ce qui empeche reellement la publication.
select is(
  (select worker_id from public.publish_jobs where id = '70000000-0000-4000-8000-00000002700a'),
  null,
  'le lease est relache : le worker courant se fera refuser sa prochaine ecriture'
);

select is(
  (select status::text from public.content_targets where id = '60000000-0000-4000-8000-00000002700a'),
  'pending',
  'la cible n affiche plus « en file » (elle y restait a vie avant 027)'
);

-- ---------------------------------------------------------------------------
-- B — RÈGLE 15 : un job demarre n'est jamais annule, meme reclame.
-- ---------------------------------------------------------------------------

select is(
  public.cancel_publish_jobs('50000000-0000-4000-8000-00000002700b'),
  0,
  'un job DEMARRE n est jamais annule (la publication a peut-etre eu lieu)'
);

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002700b'),
  'publishing',
  'il reste publishing : il appartient au worker, pas a l app'
);

reset role;
select * from finish();

rollback;
