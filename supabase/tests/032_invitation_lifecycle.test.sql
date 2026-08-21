-- Test 032 — Cycle de vie d'une invitation reviewer (ticket P7-7).
--
-- Le defaut : une invitation ratee etait DEFINITIVE. L'index unique partiel
-- ignore `expires_at`, `revoked_at` n'etait ecrit nulle part, et aucun retrait
-- de client_members n'existait — alors que la regle 4 exige qu'une revocation
-- soit effective immediatement.
--
-- Ce test prouve les trois sorties : revoquer, re-inviter (l'ancien jeton
-- meurt), retirer un membre. Et les gardes de tenant sur chacune.

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000032001', 'lot7-032-owner@example.test'),
  ('00000000-0000-4000-8000-000000032002', 'lot7-032-reviewer@example.test'),
  ('00000000-0000-4000-8000-000000032003', 'lot7-032-intrus@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000032001', 'Ocean Org 032', 'ocean-032', '00000000-0000-4000-8000-000000032001'),
  ('10000000-0000-4000-8000-000000032009', 'Org Intruse 032', 'intruse-032', '00000000-0000-4000-8000-000000032003');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000032001', '00000000-0000-4000-8000-000000032001', 'owner'),
  ('10000000-0000-4000-8000-000000032009', '00000000-0000-4000-8000-000000032003', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000032001', '10000000-0000-4000-8000-000000032001', 'Client 032', 'client-032');

-- Une invitation PERIMEE depuis longtemps, jamais acceptee, jamais revoquee.
-- C'est exactement la ligne qui bloquait l'index unique partiel a vie.
insert into public.client_invitations
  (id, org_id, client_id, email, role, token_hash, expires_at, created_at, invited_by)
values (
  '30000000-0000-4000-8000-000000032001',
  '10000000-0000-4000-8000-000000032001',
  '20000000-0000-4000-8000-000000032001',
  'lot7-032-reviewer@example.test', 'reviewer', 'hash-perime-032',
  now() - interval '30 days', now() - interval '44 days',
  '00000000-0000-4000-8000-000000032001'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000032001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000032001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- LE defaut du ticket : une invitation perimee bloque toute nouvelle invitation.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.client_invitations
      (org_id, client_id, email, role, token_hash, expires_at)
    values ('10000000-0000-4000-8000-000000032001',
            '20000000-0000-4000-8000-000000032001',
            'lot7-032-reviewer@example.test', 'reviewer', 'hash-nouveau-032',
            now() + interval '14 days')$$,
  '23505',
  null,
  'INSERT nu : une invitation perimee bloque toujours la suivante (le defaut)'
);

-- ---------------------------------------------------------------------------
-- La sortie : invite_client_reviewer retire l'ancienne, puis insere.
-- ---------------------------------------------------------------------------

select isnt(
  public.invite_client_reviewer(
    '20000000-0000-4000-8000-000000032001',
    'lot7-032-reviewer@example.test',
    'hash-nouveau-032',
    now() + interval '14 days'
  ),
  null,
  're-invitation possible malgre l invitation perimee'
);

select is(
  (select status::text from public.client_invitations
   where id = '30000000-0000-4000-8000-000000032001'),
  'expired',
  'l ancienne invitation perimee est marquee expired'
);

select isnt(
  (select revoked_at from public.client_invitations
   where id = '30000000-0000-4000-8000-000000032001'),
  null,
  'et revoked_at est pose — c est ce qui la sort de l index unique partiel'
);

select is(
  (select count(*)::int from public.client_invitations
   where client_id = '20000000-0000-4000-8000-000000032001'
     and accepted_at is null and revoked_at is null),
  1,
  'une seule invitation vivante par (client, adresse) : l invariant tient'
);

-- ---------------------------------------------------------------------------
-- Re-inviter une adresse deja invitee TUE l ancien jeton. Deux jetons vivants
-- pour une meme adresse seraient une surface d attaque sans contrepartie.
-- ---------------------------------------------------------------------------

select isnt(
  public.invite_client_reviewer(
    '20000000-0000-4000-8000-000000032001',
    'LOT7-032-Reviewer@Example.Test',
    'hash-troisieme-032',
    now() + interval '14 days'
  ),
  null,
  're-invitation d une invitation VIVANTE acceptee (casse ignoree)'
);

-- On ne peut pas filtrer sur `token_hash` : le grant colonne de 013 le cache a
-- `authenticated` (et c'est voulu — le hash ne doit jamais transiter). On
-- compte donc les lignes retirees : la perimee + le jeton precedent = 2.
select is(
  (select count(*)::int from public.client_invitations
   where client_id = '20000000-0000-4000-8000-000000032001'
     and revoked_at is not null),
  2,
  'le jeton precedent est revoque a l instant (2 lignes retirees au total)'
);

select is(
  (select count(*)::int from public.client_invitations
   where client_id = '20000000-0000-4000-8000-000000032001'
     and accepted_at is null and revoked_at is null),
  1,
  'toujours une seule invitation vivante apres re-invitation'
);

-- ---------------------------------------------------------------------------
-- Revocation explicite.
-- ---------------------------------------------------------------------------

select is(
  public.revoke_client_invitation(
    (select id from public.client_invitations
     where client_id = '20000000-0000-4000-8000-000000032001'
       and accepted_at is null and revoked_at is null)
  ),
  true,
  'revoke_client_invitation revoque une invitation vivante'
);

select is(
  (select count(*)::int from public.client_invitations
   where client_id = '20000000-0000-4000-8000-000000032001'
     and accepted_at is null and revoked_at is null),
  0,
  'plus aucune invitation vivante : l adresse est de nouveau invitable'
);

-- ---------------------------------------------------------------------------
-- Retrait d un membre — la revocation de la regle 4.
-- ---------------------------------------------------------------------------

insert into public.client_members (org_id, client_id, user_id, role)
values ('10000000-0000-4000-8000-000000032001', '20000000-0000-4000-8000-000000032001',
        '00000000-0000-4000-8000-000000032002', 'reviewer');

select is(
  public.remove_client_member(
    '20000000-0000-4000-8000-000000032001',
    '00000000-0000-4000-8000-000000032002'
  ),
  true,
  'remove_client_member retire l adhesion (regle 4 : effet immediat)'
);

select is(
  (select count(*)::int from public.client_members
   where client_id = '20000000-0000-4000-8000-000000032001'
     and user_id = '00000000-0000-4000-8000-000000032002'),
  0,
  'l adhesion a bien disparu'
);

-- ---------------------------------------------------------------------------
-- Gardes de tenant : un owner d une AUTRE org ne touche a rien.
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000032003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000032003","role":"authenticated"}';

select throws_ok(
  $$select public.invite_client_reviewer(
      '20000000-0000-4000-8000-000000032001', 'intrus@example.test',
      'hash-intrus-032', now() + interval '14 days')$$,
  '42501',
  null,
  'une autre org ne peut pas inviter sur un client qui ne lui appartient pas'
);

select throws_ok(
  $$select public.remove_client_member(
      '20000000-0000-4000-8000-000000032001',
      '00000000-0000-4000-8000-000000032002')$$,
  '42501',
  null,
  'une autre org ne peut pas retirer un membre d un client qui ne lui appartient pas'
);

select * from finish();
rollback;
