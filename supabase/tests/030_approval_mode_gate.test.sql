-- Test 030 — LA promesse produit : pas de programmation sans validation client.
--
-- `approval_mode` existait depuis 004 et n'etait lu nulle part qui puisse dire
-- non. Un glisser-deposer du kanban vers « Programme » suffisait a programmer,
-- puis publier, un contenu que le client n'avait jamais vu.
--
-- Le test couvre les trois modes, plus les deux subtilites qui font toute la
-- valeur de la garde : le ROLE de celui qui approuve, et la PEREMPTION.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000030001', 'lot4-030-owner@example.test'),
  ('00000000-0000-4000-8000-000000030002', 'lot4-030-reviewer@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000030001', 'Ocean Org 030', 'ocean-030', '00000000-0000-4000-8000-000000030001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000030001', '00000000-0000-4000-8000-000000030001', 'owner');

-- Trois clients, un par mode.
insert into public.clients (id, org_id, name, handle, approval_mode)
values
  ('20000000-0000-4000-8000-00000003000d', '10000000-0000-4000-8000-000000030001', 'Client required', 'client-030-req', 'required'),
  ('20000000-0000-4000-8000-00000003000e', '10000000-0000-4000-8000-000000030001', 'Client optional', 'client-030-opt', 'optional'),
  ('20000000-0000-4000-8000-00000003000f', '10000000-0000-4000-8000-000000030001', 'Client auto', 'client-030-auto', 'auto');

insert into public.client_members (org_id, client_id, user_id, role)
values ('10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', '00000000-0000-4000-8000-000000030002', 'reviewer');

-- 1 : required, jamais valide            -> REFUSE
-- 2 : required, valide par le REVIEWER   -> autorise
-- 3 : required, valide par l'OWNER seul  -> REFUSE (auto-approbation)
-- 4 : required, valide puis modifie      -> REFUSE (approbation perimee)
-- 5 : optional, jamais valide            -> autorise
-- 6 : auto, jamais valide                -> autorise
insert into public.content_items (id, org_id, client_id, status, scheduled_at, caption)
values
  ('50000000-0000-4000-8000-000000030001', '10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', 'draft', now() + interval '1 hour', 'legende v1'),
  ('50000000-0000-4000-8000-000000030002', '10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', 'draft', now() + interval '1 hour', 'legende v1'),
  ('50000000-0000-4000-8000-000000030003', '10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', 'draft', now() + interval '1 hour', 'legende v1'),
  ('50000000-0000-4000-8000-000000030004', '10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', 'draft', now() + interval '1 hour', 'legende v1'),
  ('50000000-0000-4000-8000-000000030005', '10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000e', 'draft', now() + interval '1 hour', 'legende v1'),
  ('50000000-0000-4000-8000-000000030006', '10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000f', 'draft', now() + interval '1 hour', 'legende v1');

insert into public.approvals (org_id, client_id, content_item_id, decided_by, decided_by_role, decision)
values
  -- Validation CLIENT en bonne et due forme.
  ('10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', '50000000-0000-4000-8000-000000030002', '00000000-0000-4000-8000-000000030002', 'reviewer', 'approved'),
  -- Auto-approbation de l'agence : ne doit PAS suffire.
  ('10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', '50000000-0000-4000-8000-000000030003', '00000000-0000-4000-8000-000000030001', 'owner', 'approved'),
  -- Validation client, mais le contenu changera apres.
  ('10000000-0000-4000-8000-000000030001', '20000000-0000-4000-8000-00000003000d', '50000000-0000-4000-8000-000000030004', '00000000-0000-4000-8000-000000030002', 'reviewer', 'approved');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000030001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000030001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- LE test du ticket : le drag kanban qui programmait un contenu jamais valide.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.content_items set status = 'scheduled'
    where id = '50000000-0000-4000-8000-000000030001'$$,
  '42501',
  null,
  'required + aucune validation : programmation REFUSEE (c est la promesse n 1)'
);

select is(
  (select status::text from public.content_items where id = '50000000-0000-4000-8000-000000030001'),
  'draft',
  'et le contenu n a pas bouge'
);

-- ---------------------------------------------------------------------------
-- Ce qu'il ne faut PAS casser : un contenu reellement valide se programme.
-- ---------------------------------------------------------------------------

update public.content_items set status = 'scheduled'
where id = '50000000-0000-4000-8000-000000030002';

select is(
  (select status::text from public.content_items where id = '50000000-0000-4000-8000-000000030002'),
  'scheduled',
  'required + validation REVIEWER : programmation autorisee'
);

-- ---------------------------------------------------------------------------
-- Le role compte : l'agence ne se valide pas elle-meme.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.content_items set status = 'scheduled'
    where id = '50000000-0000-4000-8000-000000030003'$$,
  '42501',
  null,
  'required + approbation OWNER seule : REFUSEE (l agence ne se valide pas elle-meme)'
);

-- ---------------------------------------------------------------------------
-- La peremption : approuver puis reecrire la legende n'est pas une approbation.
-- Le drapeau approval_stale existait depuis 013 et n'etait lu par personne.
-- ---------------------------------------------------------------------------

update public.content_items set caption = 'legende v2 reecrite apres validation'
where id = '50000000-0000-4000-8000-000000030004';

select is(
  (select approval_stale from public.content_items where id = '50000000-0000-4000-8000-000000030004'),
  true,
  'le trigger 013 marque bien l approbation perimee'
);

select throws_ok(
  $$update public.content_items set status = 'scheduled'
    where id = '50000000-0000-4000-8000-000000030004'$$,
  '42501',
  null,
  'required + approbation PERIMEE : REFUSEE (le client a valide un autre texte)'
);

-- ---------------------------------------------------------------------------
-- Les deux autres modes ne sont pas affectes.
-- ---------------------------------------------------------------------------

update public.content_items set status = 'scheduled'
where id = '50000000-0000-4000-8000-000000030005';

select is(
  (select status::text from public.content_items where id = '50000000-0000-4000-8000-000000030005'),
  'scheduled',
  'optional : le freelance decide au cas par cas, la base n impose rien'
);

update public.content_items set status = 'scheduled'
where id = '50000000-0000-4000-8000-000000030006';

select is(
  (select status::text from public.content_items where id = '50000000-0000-4000-8000-000000030006'),
  'scheduled',
  'auto : publication directe, c est le sens meme du mode'
);

reset role;
select * from finish();

rollback;
