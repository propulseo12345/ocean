-- Test 029 — LE critere de sortie du lot B.
--
-- « un test pgTAP prouve qu'un contenu corbeille, de-programme ou re-date n'a
-- plus aucun job vivant incoherent ». Les trois cas sont ci-dessous, verifies
-- SANS passer par le code applicatif : ce sont des UPDATE nus sur content_items,
-- exactement ce que ferait une surface d'edition qui aurait oublie d'appeler
-- `syncPublishQueue`. C'est tout l'objet du filet.
--
-- Le 4e bloc verifie le piege inverse : le filet ne doit PAS faire disparaitre
-- les cibles voisines quand le worker passe un contenu multi-plateformes en
-- `publishing`.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000029001', 'lot4-029-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000029001', 'Ocean Org 029', 'ocean-029', '00000000-0000-4000-8000-000000029001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000029001', '00000000-0000-4000-8000-000000029001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000029001', '10000000-0000-4000-8000-000000029001', 'Client 029', 'client-029');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values
  ('30000000-0000-4000-8000-000000029001', '10000000-0000-4000-8000-000000029001', 'instagram', 'ig-conn-029'),
  ('30000000-0000-4000-8000-000000029002', '10000000-0000-4000-8000-000000029001', 'facebook', 'fb-conn-029');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values
  ('40000000-0000-4000-8000-000000029001', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '30000000-0000-4000-8000-000000029001', 'instagram', 'ig-acct-029', 'client029ig'),
  ('40000000-0000-4000-8000-000000029002', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '30000000-0000-4000-8000-000000029002', 'facebook', 'fb-acct-029', 'client029fb');

-- A corbeille · B de-programme · C re-date · D multi-plateformes (piege)
insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values
  ('50000000-0000-4000-8000-00000002900a', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', 'scheduled', now() + interval '5 hours'),
  ('50000000-0000-4000-8000-00000002900b', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', 'scheduled', now() + interval '5 hours'),
  ('50000000-0000-4000-8000-00000002900c', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', 'scheduled', now() + interval '5 hours'),
  ('50000000-0000-4000-8000-00000002900d', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', 'scheduled', now() + interval '5 hours');

insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values
  ('60000000-0000-4000-8000-00000002900a', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900a', '40000000-0000-4000-8000-000000029001', 'instagram', 'queued'),
  ('60000000-0000-4000-8000-00000002900b', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900b', '40000000-0000-4000-8000-000000029001', 'instagram', 'queued'),
  ('60000000-0000-4000-8000-00000002900c', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900c', '40000000-0000-4000-8000-000000029001', 'instagram', 'queued'),
  ('60000000-0000-4000-8000-00000002900d', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900d', '40000000-0000-4000-8000-000000029001', 'instagram', 'queued'),
  ('60000000-0000-4000-8000-00000002900e', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900d', '40000000-0000-4000-8000-000000029002', 'facebook', 'queued');

insert into public.publish_jobs
  (id, org_id, client_id, content_item_id, content_target_id, social_account_id, platform, status, run_at)
values
  ('70000000-0000-4000-8000-00000002900a', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900a', '60000000-0000-4000-8000-00000002900a', '40000000-0000-4000-8000-000000029001', 'instagram', 'scheduled', now() + interval '5 hours'),
  ('70000000-0000-4000-8000-00000002900b', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900b', '60000000-0000-4000-8000-00000002900b', '40000000-0000-4000-8000-000000029001', 'instagram', 'scheduled', now() + interval '5 hours'),
  ('70000000-0000-4000-8000-00000002900c', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900c', '60000000-0000-4000-8000-00000002900c', '40000000-0000-4000-8000-000000029001', 'instagram', 'scheduled', now() + interval '5 hours'),
  ('70000000-0000-4000-8000-00000002900d', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900d', '60000000-0000-4000-8000-00000002900d', '40000000-0000-4000-8000-000000029001', 'instagram', 'scheduled', now() + interval '5 hours'),
  ('70000000-0000-4000-8000-00000002900e', '10000000-0000-4000-8000-000000029001', '20000000-0000-4000-8000-000000029001', '50000000-0000-4000-8000-00000002900d', '60000000-0000-4000-8000-00000002900e', '40000000-0000-4000-8000-000000029002', 'facebook', 'scheduled', now() + interval '5 hours');

-- ---------------------------------------------------------------------------
-- A — CORBEILLE. UPDATE nu : aucun appel a syncPublishQueue.
-- ---------------------------------------------------------------------------

update public.content_items set deleted_at = now()
where id = '50000000-0000-4000-8000-00000002900a';

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_item_id = '50000000-0000-4000-8000-00000002900a'::uuid
      and status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying')$$,
  $$values (0::bigint)$$,
  'CORBEILLE : plus aucun job vivant, sans que le code applicatif ait rien fait'
);

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002900a'),
  'canceled',
  'et le job est explicitement annule (pas supprime : la trace reste)'
);

-- ---------------------------------------------------------------------------
-- B — DE-PROGRAMME (la date est retiree).
-- ---------------------------------------------------------------------------

update public.content_items set scheduled_at = null
where id = '50000000-0000-4000-8000-00000002900b';

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_item_id = '50000000-0000-4000-8000-00000002900b'::uuid
      and status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying')$$,
  $$values (0::bigint)$$,
  'DE-PROGRAMME : plus aucun job vivant'
);

-- ---------------------------------------------------------------------------
-- C — RE-DATE : le job doit suivre, pas mourir.
-- ---------------------------------------------------------------------------

update public.content_items set scheduled_at = now() + interval '30 hours'
where id = '50000000-0000-4000-8000-00000002900c';

select is(
  (select run_at from public.publish_jobs where id = '70000000-0000-4000-8000-00000002900c'),
  (select scheduled_at from public.content_items where id = '50000000-0000-4000-8000-00000002900c'),
  'RE-DATE : run_at suit scheduled_at (le worker publiait a l ancienne heure)'
);

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002900c'),
  'scheduled',
  'et le job reste vivant : re-dater n est pas annuler'
);

-- ---------------------------------------------------------------------------
-- D — LE PIEGE. Le worker passe un contenu MULTI-PLATEFORMES en `publishing`
--     (markPublishStarted). Les jobs des cibles voisines doivent SURVIVRE.
-- ---------------------------------------------------------------------------

-- L'ancre de la cible Instagram est posee : c'est elle qui publie.
update public.content_targets
set publish_started_at = now(), external_container_id = 'ig-container-029'
where id = '60000000-0000-4000-8000-00000002900d';

update public.publish_jobs set status = 'publishing', publish_started_at = now()
where id = '70000000-0000-4000-8000-00000002900d';

update public.content_items set status = 'publishing'
where id = '50000000-0000-4000-8000-00000002900d';

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002900e'),
  'scheduled',
  'PIEGE EVITE : le job Facebook survit au passage du contenu en publishing'
);

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002900d'),
  'publishing',
  'et le job Instagram en vol n est pas touche non plus'
);

-- ---------------------------------------------------------------------------
-- REGLE 15 — un job DEMARRE n'est jamais annule par le filet, meme a la corbeille.
-- ---------------------------------------------------------------------------

update public.content_items set deleted_at = now()
where id = '50000000-0000-4000-8000-00000002900d';

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002900d'),
  'publishing',
  'REGLE 15 : mettre a la corbeille n arrache pas un job deja demarre'
);

select * from finish();

rollback;
