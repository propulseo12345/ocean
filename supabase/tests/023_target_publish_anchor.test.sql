-- Test 023 — L'ancre d'idempotence de la cible est intouchable depuis l'app.
--
-- La migration 023 deplace la DECISION de la regle 15 sur content_targets. Cette
-- ancre ne vaut que si `authenticated` ne peut ni la poser, ni la deplacer, ni
-- l'effacer, ni la supprimer avec sa ligne — content_targets est UPDATE et
-- DELETE-able par tout is_org_member (006:206, 006:211).

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000023001', 'lot3-023-owner-a@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000023001', 'Ocean Org 023 A', 'ocean-023-a', '00000000-0000-4000-8000-000000023001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000023001', '00000000-0000-4000-8000-000000023001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000023001', '10000000-0000-4000-8000-000000023001', 'Client 023 A1', 'client-023-a1');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values ('30000000-0000-4000-8000-000000023001', '10000000-0000-4000-8000-000000023001', 'instagram', 'ig-conn-023-a');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values ('40000000-0000-4000-8000-000000023001', '10000000-0000-4000-8000-000000023001', '20000000-0000-4000-8000-000000023001', '30000000-0000-4000-8000-000000023001', 'instagram', 'ig-acct-023-a1', 'client023a1');

-- Deux contenus : `content_targets_item_account_idx` interdit deux cibles du
-- meme compte sur le meme contenu.
insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values
  ('50000000-0000-4000-8000-000000023001', '10000000-0000-4000-8000-000000023001', '20000000-0000-4000-8000-000000023001', 'scheduled', now() + interval '1 hour'),
  ('50000000-0000-4000-8000-000000023002', '10000000-0000-4000-8000-000000023001', '20000000-0000-4000-8000-000000023001', 'scheduled', now() + interval '2 hours');

-- Cible 1 : ANCREE (une publication est peut-etre partie).
-- Cible 2 : vierge (rien n'est jamais parti).
insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values
  ('60000000-0000-4000-8000-000000023001', '10000000-0000-4000-8000-000000023001', '20000000-0000-4000-8000-000000023001', '50000000-0000-4000-8000-000000023001', '40000000-0000-4000-8000-000000023001', 'instagram', 'queued'),
  ('60000000-0000-4000-8000-000000023002', '10000000-0000-4000-8000-000000023001', '20000000-0000-4000-8000-000000023001', '50000000-0000-4000-8000-000000023002', '40000000-0000-4000-8000-000000023001', 'instagram', 'queued');

-- ---------------------------------------------------------------------------
-- 1. Le schema porte bien l'ancre.
-- ---------------------------------------------------------------------------

select has_column('public', 'content_targets', 'publish_started_at',
  'content_targets porte publish_started_at (ancre durable, regle 15)');
select has_column('public', 'content_targets', 'external_container_id',
  'content_targets porte external_container_id (l ancre doit rester interrogeable)');

-- ---------------------------------------------------------------------------
-- 2. Le worker (claims vides = connexion directe) pose l'ancre.
-- ---------------------------------------------------------------------------

update public.content_targets
set publish_started_at = now() - interval '5 minutes',
    external_container_id = 'ig-container-023'
where id = '60000000-0000-4000-8000-000000023001';

select is(
  (select external_container_id from public.content_targets
   where id = '60000000-0000-4000-8000-000000023001'),
  'ig-container-023',
  'le worker (hors PostgREST) pose l ancre sans obstacle'
);

-- ---------------------------------------------------------------------------
-- 3. authenticated : aucune prise sur l'ancre.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000023001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000023001","role":"authenticated"}';

-- L'owner voit bien sa cible : ce qui suit teste l'ecriture, pas la lecture.
select results_eq(
  $$select count(*)::bigint from public.content_targets
    where id = '60000000-0000-4000-8000-000000023001'$$,
  $$values (1::bigint)$$,
  'l owner lit bien sa cible (le refus qui suit porte sur l ecriture)'
);

select throws_ok(
  $$update public.content_targets set publish_started_at = null
    where id = '60000000-0000-4000-8000-000000023001'$$,
  '42501',
  null,
  'authenticated NE PEUT PAS effacer l ancre (ce serait rouvrir la double publication)'
);

select throws_ok(
  $$update public.content_targets set publish_started_at = now()
    where id = '60000000-0000-4000-8000-000000023002'$$,
  '42501',
  null,
  'authenticated NE PEUT PAS poser une ancre (elle appartient au worker)'
);

select throws_ok(
  $$update public.content_targets set external_container_id = 'forge'
    where id = '60000000-0000-4000-8000-000000023001'$$,
  '42501',
  null,
  'authenticated NE PEUT PAS changer le conteneur (il deciderait de la question posee)'
);

select throws_ok(
  $$delete from public.content_targets
    where id = '60000000-0000-4000-8000-000000023001'$$,
  '42501',
  null,
  'authenticated NE PEUT PAS supprimer une cible ancree (l ancre partirait avec la ligne)'
);

-- ---------------------------------------------------------------------------
-- 4. Ce qui doit RESTER possible : l'edition ordinaire et la suppression d'une
--    cible dont on sait que rien n'est parti. Une garde qui bloque tout serait
--    une regression fonctionnelle, pas une protection.
-- ---------------------------------------------------------------------------

update public.content_targets set caption_override = 'legende retouchee'
where id = '60000000-0000-4000-8000-000000023001';

select is(
  (select caption_override from public.content_targets
   where id = '60000000-0000-4000-8000-000000023001'),
  'legende retouchee',
  'une cible ancree reste editable sur ses colonnes ordinaires'
);

delete from public.content_targets where id = '60000000-0000-4000-8000-000000023002';

select results_eq(
  $$select count(*)::bigint from public.content_targets
    where id = '60000000-0000-4000-8000-000000023002'$$,
  $$values (0::bigint)$$,
  'une cible NON ancree reste supprimable (reconciliation normale du composer)'
);

reset role;
select * from finish();

rollback;
