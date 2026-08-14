-- Test 031 — poser une date dans le passe publierait immediatement.
--
-- Une date passee de moins de 2 h tombe DANS la fenetre de grace du worker : le
-- job est reclame au tick suivant et publie sur-le-champ. Au-dela, il naît hors
-- fenetre et part en dead_letter. Les deux sont des surprises.
--
-- Le test verifie aussi ce qu'il ne faut PAS casser : un contenu deja en retard
-- doit rester modifiable, sinon on rend immodifiable ce qui est deja rate.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000031001', 'lot4-031-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000031001', 'Ocean Org 031', 'ocean-031', '00000000-0000-4000-8000-000000031001');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000031001', '00000000-0000-4000-8000-000000031001', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000031001', '10000000-0000-4000-8000-000000031001', 'Client 031', 'client-031');

-- Le contenu B est cree AVANT de prendre le role authenticated : il porte deja
-- une date depassee (contenu en retard, situation legitime).
insert into public.content_items (id, org_id, client_id, status, scheduled_at, caption)
values
  ('50000000-0000-4000-8000-00000003100a', '10000000-0000-4000-8000-000000031001', '20000000-0000-4000-8000-000000031001', 'draft', now() + interval '3 hours', 'a'),
  ('50000000-0000-4000-8000-00000003100b', '10000000-0000-4000-8000-000000031001', '20000000-0000-4000-8000-000000031001', 'draft', now() - interval '6 hours', 'b');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000031001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000031001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- LE cas du ticket : une date passee de MOINS de 2 h. C'est le plus dangereux —
-- elle tombe dans la fenetre de grace, donc le worker publie tout de suite.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.content_items set scheduled_at = now() - interval '30 minutes'
    where id = '50000000-0000-4000-8000-00000003100a'$$,
  '22007',
  null,
  'date passee de 30 min : REFUSEE (elle publierait immediatement)'
);

select throws_ok(
  $$update public.content_items set scheduled_at = now() - interval '2 days'
    where id = '50000000-0000-4000-8000-00000003100a'$$,
  '22007',
  null,
  'date passee de 2 jours : REFUSEE aussi (elle naîtrait en dead_letter)'
);

select throws_ok(
  $$insert into public.content_items (org_id, client_id, status, scheduled_at)
    values ('10000000-0000-4000-8000-000000031001', '20000000-0000-4000-8000-000000031001',
            'draft', now() - interval '1 hour')$$,
  '22007',
  null,
  'a l INSERT aussi : creer un contenu deja date dans le passe est refuse'
);

-- ---------------------------------------------------------------------------
-- Ce qui doit RESTER possible.
-- ---------------------------------------------------------------------------

update public.content_items set scheduled_at = now() + interval '10 minutes'
where id = '50000000-0000-4000-8000-00000003100a';

select ok(
  (select scheduled_at from public.content_items where id = '50000000-0000-4000-8000-00000003100a')
    > now(),
  'une date future passe sans obstacle'
);

-- Contenu DEJA en retard : on modifie autre chose, la date ne bouge pas.
update public.content_items set caption = 'legende retouchee sur un contenu en retard'
where id = '50000000-0000-4000-8000-00000003100b';

select is(
  (select caption from public.content_items where id = '50000000-0000-4000-8000-00000003100b'),
  'legende retouchee sur un contenu en retard',
  'un contenu DEJA en retard reste modifiable (la date inchangee ne declenche rien)'
);

-- Et le retirer de la programmation reste possible.
update public.content_items set scheduled_at = null
where id = '50000000-0000-4000-8000-00000003100b';

select is(
  (select scheduled_at from public.content_items where id = '50000000-0000-4000-8000-00000003100b'),
  null,
  'de-programmer un contenu en retard reste possible'
);

reset role;
select * from finish();

rollback;
