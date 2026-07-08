begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000801', 'lot0-008-owner-a@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000000801', 'Ocean Org 008 A', 'ocean-008-a', '00000000-0000-4000-8000-000000000801');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000801', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-000000000801', '10000000-0000-4000-8000-000000000801', 'Client 008 A1', 'client-008-a1');

insert into public.content_items (id, org_id, client_id, title, status, created_by)
values
  ('50000000-0000-4000-8000-000000000801', '10000000-0000-4000-8000-000000000801', '20000000-0000-4000-8000-000000000801', 'Draft item',     'draft',    '00000000-0000-4000-8000-000000000801'),
  ('50000000-0000-4000-8000-000000000802', '10000000-0000-4000-8000-000000000801', '20000000-0000-4000-8000-000000000801', 'Idea item',      'idea',     '00000000-0000-4000-8000-000000000801'),
  ('50000000-0000-4000-8000-000000000803', '10000000-0000-4000-8000-000000000801', '20000000-0000-4000-8000-000000000801', 'Scheduled item', 'scheduled','00000000-0000-4000-8000-000000000801'),
  ('50000000-0000-4000-8000-000000000804', '10000000-0000-4000-8000-000000000801', '20000000-0000-4000-8000-000000000801', 'Worker item',    'scheduled','00000000-0000-4000-8000-000000000801');

-- ---------------------------------------------------------------------------
-- Chemin BLOQUANT : un membre org ne peut pas court-circuiter l'approbation.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}';

-- LE test : la validation client ne doit pas etre contournable par PostgREST.
select throws_ok(
  $$update public.content_items set status = 'published'
    where id = '50000000-0000-4000-8000-000000000801'::uuid$$,
  '42501',
  'authenticated cannot set status = published (worker-owned)'
);

select throws_ok(
  $$update public.content_items set status = 'publishing'
    where id = '50000000-0000-4000-8000-000000000801'::uuid$$,
  '42501',
  'authenticated cannot set status = publishing (worker-owned)'
);

-- Saut par-dessus l'approbation : idea -> in_review n'existe pas dans la matrice.
select throws_ok(
  $$update public.content_items set status = 'in_review'
    where id = '50000000-0000-4000-8000-000000000802'::uuid$$,
  '42501',
  'authenticated cannot jump idea -> in_review'
);

-- ---------------------------------------------------------------------------
-- Chemin PASSANT : les transitions legales de la matrice PRD 5.B.
-- Un test qui ne prouve que le refus ne prouve rien sur l'autorisation.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$update public.content_items set status = 'in_review'
    where id = '50000000-0000-4000-8000-000000000801'::uuid$$,
  'authenticated can move draft -> in_review'
);

select lives_ok(
  $$update public.content_items set status = 'draft'
    where id = '50000000-0000-4000-8000-000000000802'::uuid$$,
  'authenticated can move idea -> draft'
);

-- Chemin direct sans validation (PRD 5.B, approval_mode = optional).
select lives_ok(
  $$update public.content_items set status = 'canceled'
    where id = '50000000-0000-4000-8000-000000000803'::uuid$$,
  'authenticated can cancel a scheduled item'
);

-- Le trigger ne se declenche pas sur une edition hors statut (`of status`).
select lives_ok(
  $$update public.content_items set title = 'Renamed'
    where id = '50000000-0000-4000-8000-000000000804'::uuid$$,
  'editing a non-status column never triggers the guard'
);

-- ---------------------------------------------------------------------------
-- Chemin WORKER : session_user privilegie, aucun request.jwt.claims.
-- C'est exactement la connexion Postgres directe du worker (regle 17).
-- Sans cette assertion, un correctif qui bloque le worker passerait au vert.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', null, true);

select lives_ok(
  $$update public.content_items set status = 'published'
    where id = '50000000-0000-4000-8000-000000000804'::uuid$$,
  'worker (direct pg connection, no jwt claims) can set status = published'
);

select * from finish();

rollback;
