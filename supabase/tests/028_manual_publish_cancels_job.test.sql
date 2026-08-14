-- Test 028 — declarer une cible publiee a la main annule SON job, et rien d'autre.
--
-- Le parcours TikTok normal : le worker pousse un brouillon, Etienne le finalise
-- dans l'app TikTok, puis declare « publie » dans Ocean. Avant 028, le job de
-- cette cible restait en file et republiait a l'heure prevue.
--
-- Le test verifie AUSSI ce qu'il ne faut surtout pas casser : les jobs des AUTRES
-- cibles du meme contenu doivent survivre — sinon on remplacerait un doublon par
-- des publications manquantes.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000028001', 'lot4-028-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000028001', 'Ocean Org 028', 'ocean-028', '00000000-0000-4000-8000-000000028001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000028001', '00000000-0000-4000-8000-000000028001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000028001', '10000000-0000-4000-8000-000000028001', 'Client 028', 'client-028');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values
  ('30000000-0000-4000-8000-000000028001', '10000000-0000-4000-8000-000000028001', 'tiktok', 'tt-conn-028'),
  ('30000000-0000-4000-8000-000000028002', '10000000-0000-4000-8000-000000028001', 'instagram', 'ig-conn-028');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values
  ('40000000-0000-4000-8000-000000028001', '10000000-0000-4000-8000-000000028001', '20000000-0000-4000-8000-000000028001', '30000000-0000-4000-8000-000000028001', 'tiktok', 'tt-acct-028', 'client028tt'),
  ('40000000-0000-4000-8000-000000028002', '10000000-0000-4000-8000-000000028001', '20000000-0000-4000-8000-000000028001', '30000000-0000-4000-8000-000000028002', 'instagram', 'ig-acct-028', 'client028ig');

-- UN contenu, DEUX cibles : TikTok (publiee a la main) et Instagram (a partir).
insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values ('50000000-0000-4000-8000-000000028001', '10000000-0000-4000-8000-000000028001', '20000000-0000-4000-8000-000000028001', 'scheduled', now() + interval '1 hour');

insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values
  ('60000000-0000-4000-8000-00000002800a', '10000000-0000-4000-8000-000000028001', '20000000-0000-4000-8000-000000028001', '50000000-0000-4000-8000-000000028001', '40000000-0000-4000-8000-000000028001', 'tiktok', 'pushed_to_platform'),
  ('60000000-0000-4000-8000-00000002800b', '10000000-0000-4000-8000-000000028001', '20000000-0000-4000-8000-000000028001', '50000000-0000-4000-8000-000000028001', '40000000-0000-4000-8000-000000028002', 'instagram', 'queued');

insert into public.publish_jobs
  (id, org_id, client_id, content_item_id, content_target_id, social_account_id, platform, status, run_at)
values
  ('70000000-0000-4000-8000-00000002800a', '10000000-0000-4000-8000-000000028001', '20000000-0000-4000-8000-000000028001', '50000000-0000-4000-8000-000000028001', '60000000-0000-4000-8000-00000002800a', '40000000-0000-4000-8000-000000028001', 'tiktok', 'scheduled', now() + interval '1 hour'),
  ('70000000-0000-4000-8000-00000002800b', '10000000-0000-4000-8000-000000028001', '20000000-0000-4000-8000-000000028001', '50000000-0000-4000-8000-000000028001', '60000000-0000-4000-8000-00000002800b', '40000000-0000-4000-8000-000000028002', 'instagram', 'scheduled', now() + interval '1 hour');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000028001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000028001","role":"authenticated"}';

select is(
  (select public.mark_target_published_manually('60000000-0000-4000-8000-00000002800a')::text),
  'published',
  'la declaration manuelle aboutit'
);

select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002800a'),
  'canceled',
  'LE test : le job de cette cible est annule (il republiait par-dessus avant 028)'
);

-- Ce qu'il ne faut PAS casser.
select is(
  (select status::text from public.publish_jobs where id = '70000000-0000-4000-8000-00000002800b'),
  'scheduled',
  'le job de l AUTRE cible du meme contenu est intact (Instagram doit partir)'
);

select is(
  (select status::text from public.content_targets where id = '60000000-0000-4000-8000-00000002800b'),
  'queued',
  'et sa cible reste en file'
);

-- L'agregat ne ment pas : une seule cible sur deux est publiee.
select is(
  (select status::text from public.content_items where id = '50000000-0000-4000-8000-000000028001'),
  'scheduled',
  'le contenu ne s annonce pas publie tant que l autre cible attend'
);

reset role;
select * from finish();

rollback;
