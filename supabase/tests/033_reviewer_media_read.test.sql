-- Test 033 — Le Reviewer peut voir le media qu'il valide (P5-10).
--
-- Les policies de media-originals etaient toutes gardees par
-- can_write_client_media, dont la premiere condition est is_org_member. Un
-- Reviewer n'est PAS membre de l'org (regle 6) : il ne passait pas la policy
-- SELECT, createSignedUrls ne lui rendait rien, et l'app retombait en silence
-- sur la vignette. Le client validait donc sur une image de 400 px.
--
-- Ce test porte sur `can_read_client_media`, la DECISION. La policy
-- storage.objects qui l'utilise n'est pas exercable ici (le conteneur pgTAP a un
-- schema storage ancien, cf. le runner qui saute les *_storage.sql) : c'est la
-- limite connue, et elle est dite dans le plan.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000033001', 'lot5-033-owner@example.test'),
  ('00000000-0000-4000-8000-000000033002', 'lot5-033-reviewer@example.test'),
  ('00000000-0000-4000-8000-000000033003', 'lot5-033-etranger@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000033001', 'Ocean Org 033', 'ocean-033', '00000000-0000-4000-8000-000000033001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000033001', '00000000-0000-4000-8000-000000033001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000033001', '10000000-0000-4000-8000-000000033001', 'Client 033', 'client-033');

-- Le reviewer est membre du CLIENT, jamais de l'org.
insert into public.client_members (org_id, client_id, user_id, role)
values ('10000000-0000-4000-8000-000000033001', '20000000-0000-4000-8000-000000033001',
        '00000000-0000-4000-8000-000000033002', 'reviewer');

-- Deux contenus : un soumis a validation, un brouillon interne.
insert into public.content_items (id, org_id, client_id, status, caption)
values
  ('50000000-0000-4000-8000-000000033001', '10000000-0000-4000-8000-000000033001', '20000000-0000-4000-8000-000000033001', 'in_review', 'a valider'),
  ('50000000-0000-4000-8000-000000033002', '10000000-0000-4000-8000-000000033001', '20000000-0000-4000-8000-000000033001', 'draft', 'brouillon interne');

insert into public.media_assets (id, org_id, client_id, type, storage_path, uploaded_by)
values
  ('60000000-0000-4000-8000-000000033001', '10000000-0000-4000-8000-000000033001', '20000000-0000-4000-8000-000000033001', 'image',
   '10000000-0000-4000-8000-000000033001/20000000-0000-4000-8000-000000033001/50000000-0000-4000-8000-000000033001/60000000-0000-4000-8000-000000033001/photo.jpg',
   '00000000-0000-4000-8000-000000033001'),
  ('60000000-0000-4000-8000-000000033002', '10000000-0000-4000-8000-000000033001', '20000000-0000-4000-8000-000000033001', 'image',
   '10000000-0000-4000-8000-000000033001/20000000-0000-4000-8000-000000033001/50000000-0000-4000-8000-000000033002/60000000-0000-4000-8000-000000033002/interne.jpg',
   '00000000-0000-4000-8000-000000033001');

insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position)
values
  ('10000000-0000-4000-8000-000000033001', '20000000-0000-4000-8000-000000033001', '50000000-0000-4000-8000-000000033001', '60000000-0000-4000-8000-000000033001', 0),
  ('10000000-0000-4000-8000-000000033001', '20000000-0000-4000-8000-000000033001', '50000000-0000-4000-8000-000000033002', '60000000-0000-4000-8000-000000033002', 0);

-- ---------------------------------------------------------------------------
-- Le cast defensif d'un segment de chemin.
-- ---------------------------------------------------------------------------

select is(
  private.safe_uuid('pas-un-uuid'),
  null,
  'safe_uuid rend null au lieu de lever sur un segment mal forme'
);

select is(
  private.safe_uuid('60000000-0000-4000-8000-000000033001'),
  '60000000-0000-4000-8000-000000033001'::uuid,
  'safe_uuid rend bien l uuid quand le segment est valide'
);

-- ---------------------------------------------------------------------------
-- L agence : rien ne doit changer pour elle.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000033001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000033001","role":"authenticated"}';

select is(
  private.can_read_client_media(
    '10000000-0000-4000-8000-000000033001',
    '20000000-0000-4000-8000-000000033001',
    '60000000-0000-4000-8000-000000033001'),
  true,
  'org member : lit le media d un contenu en validation'
);

select is(
  private.can_read_client_media(
    '10000000-0000-4000-8000-000000033001',
    '20000000-0000-4000-8000-000000033001',
    '60000000-0000-4000-8000-000000033002'),
  true,
  'org member : lit aussi le media d un brouillon interne'
);

-- ---------------------------------------------------------------------------
-- LE ticket : le reviewer accede a l original du contenu qu il doit valider.
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000033002';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000033002","role":"authenticated"}';

select is(
  private.can_write_client_media(
    '10000000-0000-4000-8000-000000033001',
    '20000000-0000-4000-8000-000000033001'),
  false,
  'le reviewer ne passe PAS le predicat d ecriture — c est le defaut d origine'
);

select is(
  private.can_read_client_media(
    '10000000-0000-4000-8000-000000033001',
    '20000000-0000-4000-8000-000000033001',
    '60000000-0000-4000-8000-000000033001'),
  true,
  'et il passe desormais le predicat de LECTURE sur le media a valider'
);

-- ---------------------------------------------------------------------------
-- Ce qu'on n'ouvre surtout pas : le reste du client.
-- ---------------------------------------------------------------------------

select is(
  private.can_read_client_media(
    '10000000-0000-4000-8000-000000033001',
    '20000000-0000-4000-8000-000000033001',
    '60000000-0000-4000-8000-000000033002'),
  false,
  'le reviewer ne lit PAS le media d un brouillon interne (is_client_member seul aurait tout ouvert)'
);

select is(
  private.can_read_client_media(
    '10000000-0000-4000-8000-000000033001',
    '20000000-0000-4000-8000-000000033001',
    null),
  false,
  'chemin sans segment media : refus, jamais d ouverture par defaut'
);

-- ---------------------------------------------------------------------------
-- Un tiers ne lit rien.
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000033003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000033003","role":"authenticated"}';

select is(
  private.can_read_client_media(
    '10000000-0000-4000-8000-000000033001',
    '20000000-0000-4000-8000-000000033001',
    '60000000-0000-4000-8000-000000033001'),
  false,
  'un compte etranger a l org ET au client ne lit rien'
);

select * from finish();
rollback;
