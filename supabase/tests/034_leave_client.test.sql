-- Test 034 — Un membre peut se retirer LUI-MÊME d'un client (ticket V-3).
--
-- Le défaut : il n'existait aucune sortie. `client_members_delete` (004:101-103)
-- exige `is_org_member(org_id)`, or un Reviewer n'appartient par construction à
-- aucune organisation (règle 6) — il ne pouvait PHYSIQUEMENT pas se retirer.
-- C'était l'aggravant de la CSRF V-3 : une adhésion créée à l'insu de la victime
-- dans le client d'un attaquant n'était révocable que par l'attaquant.
--
-- Ce que ce fichier prouve, et qui n'existait pas :
--   * la sortie fonctionne pour quelqu'un SANS organisation (le cas réel) ;
--   * elle ne retire QUE l'appelant, jamais un tiers ;
--   * elle ne déborde pas sur les autres clients ;
--   * elle révoque au passage le jeton vivant qui permettrait de revenir —
--     la moitié NEUVE de la fonction, celle que le test de la 032 n'exerçait
--     jamais parce qu'il ne laissait aucune invitation vivante avant l'appel.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- ---------------------------------------------------------------------------
-- Décor : une agence, deux de ses clients, un reviewer membre des deux, et une
-- org tierce dont le reviewer n'est PAS membre.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000034001', 'lot0-034-owner@example.test'),
  ('00000000-0000-4000-8000-000000034002', 'lot0-034-reviewer@example.test'),
  ('00000000-0000-4000-8000-000000034003', 'lot0-034-intrus@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000034001', 'Ocean Org 034', 'ocean-034', '00000000-0000-4000-8000-000000034001'),
  ('10000000-0000-4000-8000-000000034009', 'Org Tierce 034', 'tierce-034', '00000000-0000-4000-8000-000000034003');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000034001', '00000000-0000-4000-8000-000000034001', 'owner'),
  ('10000000-0000-4000-8000-000000034009', '00000000-0000-4000-8000-000000034003', 'owner');

insert into public.clients (id, org_id, name, handle)
values
  ('20000000-0000-4000-8000-000000034001', '10000000-0000-4000-8000-000000034001', 'Client A1 034', 'client-a1-034'),
  ('20000000-0000-4000-8000-000000034002', '10000000-0000-4000-8000-000000034001', 'Client A2 034', 'client-a2-034'),
  ('20000000-0000-4000-8000-000000034009', '10000000-0000-4000-8000-000000034009', 'Client Tiers 034', 'client-tiers-034');

-- Le reviewer est membre des deux clients de l'agence. L'owner est AUSSI membre
-- du client A1 : c'est lui qui prouve qu'on ne retire que l'appelant.
insert into public.client_members (org_id, client_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000034001', '20000000-0000-4000-8000-000000034001', '00000000-0000-4000-8000-000000034002', 'reviewer'),
  ('10000000-0000-4000-8000-000000034001', '20000000-0000-4000-8000-000000034002', '00000000-0000-4000-8000-000000034002', 'reviewer'),
  ('10000000-0000-4000-8000-000000034001', '20000000-0000-4000-8000-000000034001', '00000000-0000-4000-8000-000000034001', 'reviewer'),
  ('10000000-0000-4000-8000-000000034009', '20000000-0000-4000-8000-000000034009', '00000000-0000-4000-8000-000000034003', 'reviewer');

-- DEUX invitations VIVANTES pour l'adresse du reviewer : une sur le client
-- qu'il va quitter, une sur celui qu'il garde. C'est le point que le test de la
-- 032 ratait — sans invitation vivante au moment de l'appel, le balayage tourne
-- sur un ensemble vide et on peut supprimer tout le bloc sans casser un test.
insert into public.client_invitations
  (id, org_id, client_id, email, role, token_hash, expires_at, invited_by)
values
  ('30000000-0000-4000-8000-000000034001',
   '10000000-0000-4000-8000-000000034001', '20000000-0000-4000-8000-000000034001',
   'lot0-034-reviewer@example.test', 'reviewer', 'hash-vivant-a1-034',
   now() + interval '14 days', '00000000-0000-4000-8000-000000034001'),
  ('30000000-0000-4000-8000-000000034002',
   '10000000-0000-4000-8000-000000034001', '20000000-0000-4000-8000-000000034002',
   'lot0-034-reviewer@example.test', 'reviewer', 'hash-vivant-a2-034',
   now() + interval '14 days', '00000000-0000-4000-8000-000000034001');

-- ---------------------------------------------------------------------------
-- 1. Sans session, la fonction refuse. Fail-closed.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$select public.leave_client('20000000-0000-4000-8000-000000034001')$$,
  '42501',
  null,
  'sans session, leave_client refuse (auth.uid() nul)'
);

-- ---------------------------------------------------------------------------
-- 2. Le reviewer se retire lui-même — il n'a AUCUNE organisation.
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000034002';

select is(
  public.leave_client('20000000-0000-4000-8000-000000034001'),
  true,
  'un reviewer sans org peut se retirer lui-meme'
);

reset role;

select is(
  (select count(*) from public.client_members
   where client_id = '20000000-0000-4000-8000-000000034001'
     and user_id = '00000000-0000-4000-8000-000000034002'),
  0::bigint,
  'son adhesion au client quitte a disparu'
);

-- ---------------------------------------------------------------------------
-- 3. Le périmètre : ni les autres clients, ni les autres personnes.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.client_members
   where client_id = '20000000-0000-4000-8000-000000034002'
     and user_id = '00000000-0000-4000-8000-000000034002'),
  1::bigint,
  'son adhesion a l AUTRE client de la meme org est intacte'
);

select is(
  (select count(*) from public.client_members
   where client_id = '20000000-0000-4000-8000-000000034001'
     and user_id = '00000000-0000-4000-8000-000000034001'),
  1::bigint,
  'l adhesion d un TIERS au meme client est intacte — on ne retire que l appelant'
);

-- ---------------------------------------------------------------------------
-- 4. La garantie NEUVE : le jeton qui permettrait de revenir est mort.
-- ---------------------------------------------------------------------------

select is(
  (select revoked_at is not null and status = 'revoked'
   from public.client_invitations
   where id = '30000000-0000-4000-8000-000000034001'),
  true,
  'l invitation vivante vers le client quitte est revoquee'
);

select is(
  (select revoked_at is null
   from public.client_invitations
   where id = '30000000-0000-4000-8000-000000034002'),
  true,
  'l invitation vivante vers l AUTRE client n est PAS touchee'
);

-- ---------------------------------------------------------------------------
-- 5. Rejouer, et viser un client dont on n'est pas membre.
-- ---------------------------------------------------------------------------

set local role authenticated;

select is(
  public.leave_client('20000000-0000-4000-8000-000000034001'),
  false,
  'rejouer le retrait ne leve pas et ne ment pas : false'
);

select is(
  public.leave_client('20000000-0000-4000-8000-000000034009'),
  false,
  'quitter un client d une autre org dont on n est pas membre : false'
);

reset role;

select is(
  (select count(*) from public.client_members
   where client_id = '20000000-0000-4000-8000-000000034009'),
  1::bigint,
  'et rien n a bouge chez le tenant tiers'
);

select * from finish();
rollback;
