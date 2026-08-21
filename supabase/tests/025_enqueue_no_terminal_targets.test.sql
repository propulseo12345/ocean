-- Test 025 — l'enfilement automatique ne rouvre plus les cibles finies.
--
-- Chemin de double publication n°3 : un post part chez Meta, le job termine mal,
-- l'admin fait glisser la carte `failed -> scheduled` dans le kanban,
-- `enqueue_publish_jobs` fabrique un job neuf et republie. Ce fichier verifie que
-- l'enfilement s'arrete sur l'ANCRE, pas sur le statut — et qu'un echec ordinaire
-- (rien n'est parti) reste relancable, sinon la correction serait une regression.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000025001', 'lot3-025-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000025001', 'Ocean Org 025', 'ocean-025', '00000000-0000-4000-8000-000000025001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000025001', '00000000-0000-4000-8000-000000025001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000025001', '10000000-0000-4000-8000-000000025001', 'Client 025', 'client-025');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values
  ('30000000-0000-4000-8000-000000025001', '10000000-0000-4000-8000-000000025001', 'instagram', 'ig-conn-025'),
  ('30000000-0000-4000-8000-000000025002', '10000000-0000-4000-8000-000000025001', 'tiktok', 'tt-conn-025');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values
  ('40000000-0000-4000-8000-000000025001', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', '30000000-0000-4000-8000-000000025001', 'instagram', 'ig-acct-025', 'client025'),
  ('40000000-0000-4000-8000-000000025002', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', '30000000-0000-4000-8000-000000025002', 'tiktok', 'tt-acct-025', 'client025tt');

-- 4 contenus, tous « programmes » : un par cas a couvrir.
--   A : cible `failed` ANCREE          -> refusee (un POST est peut-etre parti)
--   B : cible `failed` SANS ancre      -> ENFILEE (rien n'est parti, retry legitime)
--   C : cible `pushed_to_platform`     -> refusee (le brouillon TikTok existe deja)
--   D : cible `needs_verification`     -> refusee (par definition)
insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values
  ('50000000-0000-4000-8000-00000002500a', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', 'scheduled', now() + interval '1 hour'),
  ('50000000-0000-4000-8000-00000002500b', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', 'scheduled', now() + interval '1 hour'),
  ('50000000-0000-4000-8000-00000002500c', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', 'scheduled', now() + interval '1 hour'),
  ('50000000-0000-4000-8000-00000002500d', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', 'scheduled', now() + interval '1 hour');

insert into public.content_targets
  (id, org_id, client_id, content_item_id, social_account_id, platform, status, publish_started_at, external_container_id)
values
  ('60000000-0000-4000-8000-00000002500a', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', '50000000-0000-4000-8000-00000002500a', '40000000-0000-4000-8000-000000025001', 'instagram', 'failed', now() - interval '3 hours', 'ig-container-025a'),
  ('60000000-0000-4000-8000-00000002500b', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', '50000000-0000-4000-8000-00000002500b', '40000000-0000-4000-8000-000000025001', 'instagram', 'failed', null, null),
  ('60000000-0000-4000-8000-00000002500c', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', '50000000-0000-4000-8000-00000002500c', '40000000-0000-4000-8000-000000025002', 'tiktok', 'pushed_to_platform', null, null),
  ('60000000-0000-4000-8000-00000002500d', '10000000-0000-4000-8000-000000025001', '20000000-0000-4000-8000-000000025001', '50000000-0000-4000-8000-00000002500d', '40000000-0000-4000-8000-000000025001', 'instagram', 'needs_verification', now() - interval '1 hour', 'ig-container-025d');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000025001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000025001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- A — LE cas du ticket : cible ancree, statut `failed`.
-- ---------------------------------------------------------------------------

select is(
  public.enqueue_publish_jobs('50000000-0000-4000-8000-00000002500a'),
  0,
  'cible failed ANCREE : aucun job cree (un POST est peut-etre parti)'
);

select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_target_id = '60000000-0000-4000-8000-00000002500a'::uuid$$,
  $$values (0::bigint)$$,
  'et rien n a ete insere en base'
);

-- ---------------------------------------------------------------------------
-- B — Le cas qu'il NE FAUT PAS casser : echec ordinaire, rien n'est parti.
-- ---------------------------------------------------------------------------

select is(
  public.enqueue_publish_jobs('50000000-0000-4000-8000-00000002500b'),
  1,
  'cible failed SANS ancre : ENFILEE (le retry legitime reste possible)'
);

-- ---------------------------------------------------------------------------
-- C — Brouillon TikTok deja pousse : un second brulerait un des 5 par 24 h.
-- ---------------------------------------------------------------------------

select is(
  public.enqueue_publish_jobs('50000000-0000-4000-8000-00000002500c'),
  0,
  'cible pushed_to_platform : aucun second brouillon TikTok'
);

-- ---------------------------------------------------------------------------
-- D — Issue inconnue : jamais d'automatisme, c'est sa definition.
-- ---------------------------------------------------------------------------

select is(
  public.enqueue_publish_jobs('50000000-0000-4000-8000-00000002500d'),
  0,
  'cible needs_verification : jamais re-enfilee'
);

-- ---------------------------------------------------------------------------
-- Effet de bord a ne pas laisser passer : une cible refusee ne doit pas non
-- plus etre annoncee « en file » cote metier.
-- ---------------------------------------------------------------------------

select is(
  (select status::text from public.content_targets
   where id = '60000000-0000-4000-8000-00000002500a'),
  'failed',
  'la cible refusee garde son statut (pas de faux « en file »)'
);

select is(
  (select status::text from public.content_targets
   where id = '60000000-0000-4000-8000-00000002500d'),
  'needs_verification',
  'idem pour l issue inconnue'
);

reset role;
select * from finish();

rollback;
