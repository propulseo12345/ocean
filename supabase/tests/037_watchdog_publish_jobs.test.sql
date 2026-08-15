-- Test 037 — le watchdog détecte les bons jobs, et SEULEMENT eux.
--
-- Un watchdog qui alerte trop est aussi inutile qu'un watchdog qui n'alerte
-- pas : on apprend à ignorer ses e-mails, et le jour où il a raison personne ne
-- lit. Ces tests portent donc autant sur ce qu'il NE signale PAS.
--
-- On teste `private.late_publish_jobs()` — la décision, en SQL pur. L'effet
-- (`public.watchdog_publish_jobs`) fait un appel réseau et n'est pas
-- exerçable ici ; sa partie décidable, elle, l'est entièrement.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- ---------------------------------------------------------------------------
-- Fixture : org -> client -> contenu -> compte -> cibles
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'watchdog@test.local');

insert into public.organizations (id, name, slug) values
  ('cccccccc-0000-4000-8000-000000000010', 'Org watchdog', 'org-watchdog');

insert into public.organization_members (org_id, user_id, role) values
  ('cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000001', 'owner');

insert into public.clients (id, org_id, name, handle, timezone) values
  ('cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000010', 'Client watchdog', 'cw', 'Europe/Paris');

insert into public.platform_connections (id, org_id, provider, provider_account_id) values
  ('cccccccc-0000-4000-8000-000000000030',
   'cccccccc-0000-4000-8000-000000000010', 'facebook', 'fb-watchdog');

insert into public.social_accounts
  (id, org_id, client_id, platform_connection_id, platform, provider_account_id)
values
  ('cccccccc-0000-4000-8000-000000000040',
   'cccccccc-0000-4000-8000-000000000010',
   'cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000030',
   'instagram', 'ig-watchdog');

-- SIX contenus, pas un seul : `content_targets_item_account_idx` interdit deux
-- cibles du meme contenu vers le meme compte. Chaque cas de test a donc son
-- propre contenu.
insert into public.content_items (id, org_id, client_id, title, format, status)
select
  ('cccccccc-0000-4000-8000-00000000005' || n)::uuid,
  'cccccccc-0000-4000-8000-000000000010',
  'cccccccc-0000-4000-8000-000000000020',
  'Post surveille ' || n, 'post', 'scheduled'
from generate_series(1, 6) n;

insert into public.content_targets
  (id, org_id, client_id, content_item_id, social_account_id, platform, status)
select
  ('cccccccc-0000-4000-8000-00000000006' || n)::uuid,
  'cccccccc-0000-4000-8000-000000000010',
  'cccccccc-0000-4000-8000-000000000020',
  ('cccccccc-0000-4000-8000-00000000005' || n)::uuid,
  'cccccccc-0000-4000-8000-000000000040',
  'instagram', 'queued'
from generate_series(1, 6) n;

-- ---------------------------------------------------------------------------
-- Les six cas, un par job
-- ---------------------------------------------------------------------------
insert into public.publish_jobs
  (id, org_id, client_id, content_item_id, content_target_id, social_account_id,
   platform, status, run_at, worker_id, lease_expires_at, next_attempt_at, watchdog_alerted_at)
values
  -- ① EN RETARD : dû depuis 10 min, personne ne l'a réclamé. LE cas.
  ('cccccccc-0000-4000-8000-000000000101',
   'cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000051', 'cccccccc-0000-4000-8000-000000000061',
   'cccccccc-0000-4000-8000-000000000040', 'instagram', 'scheduled',
   now() - interval '10 minutes', null, null, null, null),

  -- ② À L'HEURE : dû il y a 30 s. Un worker sain vide son lot en quelques
  --    secondes ; alerter ici serait alerter sur le fonctionnement normal.
  ('cccccccc-0000-4000-8000-000000000102',
   'cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000052', 'cccccccc-0000-4000-8000-000000000062',
   'cccccccc-0000-4000-8000-000000000040', 'instagram', 'scheduled',
   now() - interval '30 seconds', null, null, null, null),

  -- ③ RÉCLAMÉ : entre les mains d'un worker vivant. C'est le cas du REAPER
  --    (lease), pas du watchdog. L'inclure ferait alerter sur chaque Reel un
  --    peu long.
  ('cccccccc-0000-4000-8000-000000000103',
   'cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000053', 'cccccccc-0000-4000-8000-000000000063',
   'cccccccc-0000-4000-8000-000000000040', 'instagram', 'claimed',
   now() - interval '30 minutes', 'worker-1', now() + interval '2 minutes', null, null),

  -- ④ EN BACKOFF : `next_attempt_at` dans le futur = retry NORMAL après échec.
  --    Sans la clause, chaque retry legitime declencherait une alerte.
  ('cccccccc-0000-4000-8000-000000000104',
   'cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000054', 'cccccccc-0000-4000-8000-000000000064',
   'cccccccc-0000-4000-8000-000000000040', 'instagram', 'retrying',
   now() - interval '20 minutes', null, null, now() + interval '5 minutes', null),

  -- ⑤ DÉJÀ ALERTÉ il y a 5 min : on ne ré-alerte pas avant une heure.
  --    288 e-mails par jour sur le même job, c'est un watchdog qu'on ignore.
  ('cccccccc-0000-4000-8000-000000000105',
   'cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000055', 'cccccccc-0000-4000-8000-000000000065',
   'cccccccc-0000-4000-8000-000000000040', 'instagram', 'scheduled',
   now() - interval '40 minutes', null, null, null, now() - interval '5 minutes'),

  -- ⑥ ALERTÉ IL Y A LONGTEMPS (2 h) et toujours en retard : on ré-alerte.
  ('cccccccc-0000-4000-8000-000000000106',
   'cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000020',
   'cccccccc-0000-4000-8000-000000000056', 'cccccccc-0000-4000-8000-000000000066',
   'cccccccc-0000-4000-8000-000000000040', 'instagram', 'scheduled',
   now() - interval '3 hours', null, null, null, now() - interval '2 hours');

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from private.late_publish_jobs()),
  2,
  'deux jobs signales : le retard frais et celui dont l alerte a plus d une heure'
);

select ok(
  exists (select 1 from private.late_publish_jobs() where id = 'cccccccc-0000-4000-8000-000000000101'),
  'un job du depuis 10 min et non reclame EST signale'
);

select ok(
  not exists (select 1 from private.late_publish_jobs() where id = 'cccccccc-0000-4000-8000-000000000102'),
  '30 s de retard : un worker sain vide son lot, aucune alerte'
);

select ok(
  not exists (select 1 from private.late_publish_jobs() where id = 'cccccccc-0000-4000-8000-000000000103'),
  'un job RECLAME releve du reaper, pas du watchdog'
);

select ok(
  not exists (select 1 from private.late_publish_jobs() where id = 'cccccccc-0000-4000-8000-000000000104'),
  'un backoff en cours n est pas un retard'
);

select ok(
  not exists (select 1 from private.late_publish_jobs() where id = 'cccccccc-0000-4000-8000-000000000105'),
  'alerte emise il y a 5 min : pas de repetition'
);

select ok(
  exists (select 1 from private.late_publish_jobs() where id = 'cccccccc-0000-4000-8000-000000000106'),
  'alerte de plus d une heure et toujours en retard : on re-alerte'
);

select ok(
  (select late_by_seconds from private.late_publish_jobs()
    where id = 'cccccccc-0000-4000-8000-000000000101') between 590 and 610,
  'le retard rapporte est exact (l e-mail doit dire de combien)'
);

-- ---------------------------------------------------------------------------
-- Baseline de securite : la faille Vault de 021 venait exactement de la.
--
-- ⚠ CETTE ASSERTION NE DISCRIMINE PAS SUR LE STACK LOCAL, et le taire en
-- ferait un faux positif de plus. Verifie par mutation le 18/08/2026 :
-- remplacer `revoke ... from public, anon, authenticated` par
-- `revoke ... from public` seul laisse ce test AU VERT (Result: PASS). En
-- local, le droit d anon arrive donc par PUBLIC, et le revoke de PUBLIC suffit.
-- Le revoke explicite est CONSERVE quand meme : le projet en ligne s est deja
-- comporte autrement (migration 021), et c est la que la faille avait ete
-- payee. Ce que ce test prouve : l invariant tient. Ce qu il ne prouve pas :
-- que la clause explicite est ce qui le fait tenir.
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.watchdog_publish_jobs()', 'execute'),
  'anon n a AUCUN droit d execution sur la fonction SECURITY DEFINER du watchdog'
);

select * from finish();
rollback;
