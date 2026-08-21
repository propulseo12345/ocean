-- Test 024 — `needs_verification` : issue INCONNUE, et personne ne s'en sort seul.
--
-- Le statut ne sert a rien s'il est posable ou franchissable depuis l'app :
-- ce fichier verifie que seul le worker le pose, qu'AUCUNE transition n'en sort
-- cote `authenticated`, et que la sortie humaine par cible existe bel et bien
-- (sinon le statut serait un cul-de-sac, ce qui est pire que le mensonge).

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000024001', 'lot3-024-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000024001', 'Ocean Org 024', 'ocean-024', '00000000-0000-4000-8000-000000024001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000024001', '00000000-0000-4000-8000-000000024001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000024001', '10000000-0000-4000-8000-000000024001', 'Client 024', 'client-024');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values ('30000000-0000-4000-8000-000000024001', '10000000-0000-4000-8000-000000024001', 'instagram', 'ig-conn-024');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values ('40000000-0000-4000-8000-000000024001', '10000000-0000-4000-8000-000000024001', '20000000-0000-4000-8000-000000024001', '30000000-0000-4000-8000-000000024001', 'instagram', 'ig-acct-024', 'client024');

insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values
  ('50000000-0000-4000-8000-000000024001', '10000000-0000-4000-8000-000000024001', '20000000-0000-4000-8000-000000024001', 'scheduled', now() - interval '10 minutes'),
  ('50000000-0000-4000-8000-000000024002', '10000000-0000-4000-8000-000000024001', '20000000-0000-4000-8000-000000024001', 'draft', null);

insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values
  ('60000000-0000-4000-8000-000000024001', '10000000-0000-4000-8000-000000024001', '20000000-0000-4000-8000-000000024001', '50000000-0000-4000-8000-000000024001', '40000000-0000-4000-8000-000000024001', 'instagram', 'queued'),
  ('60000000-0000-4000-8000-000000024002', '10000000-0000-4000-8000-000000024001', '20000000-0000-4000-8000-000000024001', '50000000-0000-4000-8000-000000024002', '40000000-0000-4000-8000-000000024001', 'instagram', 'queued');

-- ---------------------------------------------------------------------------
-- 1. Le statut existe dans les trois enums (le mensonge existait aux 3 niveaux).
-- ---------------------------------------------------------------------------

select ok(
  'needs_verification' = any (enum_range(null::public.target_status)::text[]),
  'target_status porte needs_verification'
);
select ok(
  'needs_verification' = any (enum_range(null::public.content_status)::text[]),
  'content_status porte needs_verification (l agregat lu par le dashboard)'
);
select ok(
  'needs_verification' = any (enum_range(null::public.publish_job_status)::text[]),
  'publish_job_status porte needs_verification'
);

-- ---------------------------------------------------------------------------
-- 2. Le worker pose l'issue inconnue (claims vides = connexion directe).
-- ---------------------------------------------------------------------------

update public.content_targets
set status = 'needs_verification',
    publish_started_at = now() - interval '3 minutes',
    external_container_id = 'ig-container-024'
where id = '60000000-0000-4000-8000-000000024001';

update public.content_items set status = 'needs_verification'
where id = '50000000-0000-4000-8000-000000024001';

select is(
  (select status::text from public.content_items where id = '50000000-0000-4000-8000-000000024001'),
  'needs_verification',
  'le worker pose needs_verification sur le contenu'
);

-- ---------------------------------------------------------------------------
-- 3. authenticated : ne le pose pas, et surtout n'en sort pas.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000024001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000024001","role":"authenticated"}';

select throws_ok(
  $$update public.content_items set status = 'needs_verification'
    where id = '50000000-0000-4000-8000-000000024002'$$,
  '42501',
  null,
  'authenticated NE PEUT PAS declarer une issue inconnue (c est un constat du worker)'
);

-- LE test du ticket : c'est cette transition qui produisait le doublon.
select throws_ok(
  $$update public.content_items set status = 'scheduled'
    where id = '50000000-0000-4000-8000-000000024001'$$,
  '42501',
  null,
  'needs_verification -> scheduled REFUSE (c est exactement la double publication)'
);

select throws_ok(
  $$update public.content_items set status = 'draft'
    where id = '50000000-0000-4000-8000-000000024001'$$,
  '42501',
  null,
  'needs_verification -> draft REFUSE (il ramene a scheduled en deux clics)'
);

-- Une relance de cible sur une issue inconnue est refusee elle aussi : la RPC
-- n'accepte que 'failed', et c'est la difference entiere entre les deux statuts.
select throws_ok(
  $$select public.request_target_retry('60000000-0000-4000-8000-000000024001')$$,
  '42501',
  null,
  'request_target_retry REFUSE une cible en issue inconnue'
);

-- ---------------------------------------------------------------------------
-- 4. La SORTIE existe : « j'ai regarde, c'est bien en ligne ». Sans elle, le
--    statut serait un cul-de-sac definitif.
-- ---------------------------------------------------------------------------

select is(
  (select public.mark_target_published_manually(
     '60000000-0000-4000-8000-000000024001', 'ig-post-024', 'https://instagram.test/p/024'
   )::text),
  'published',
  'mark_target_published_manually SORT une cible de l issue inconnue'
);

reset role;
select * from finish();

rollback;
