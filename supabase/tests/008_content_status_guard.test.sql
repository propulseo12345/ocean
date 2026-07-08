begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

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
--
-- `request.jwt.claims` est l'ancre de la garde (cf. 008). Le poser, c'est se
-- placer dans un contexte PostgREST utilisateur -- exactement ce que fait un
-- PATCH /rest/v1/content_items. `set local role` seul ne suffirait PAS : sous
-- SET ROLE, session_user reste 'postgres'.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}';

-- Le contexte de test est bien un contexte utilisateur, pas un bypass worker.
-- Sans cette assertion, toute la section BLOQUANTE pourrait passer au vert en
-- s'executant dans la branche bypass -- ce qui etait le cas avant le fix.
select isnt_empty(
  $$select 1 where coalesce(current_setting('request.jwt.claims', true), '') <> ''$$,
  'test context carries request.jwt.claims (guard is armed, not bypassed)'
);

-- LE test : la validation client ne doit pas etre contournable par PostgREST.
select throws_ok(
  $$update public.content_items set status = 'published'
    where id = '50000000-0000-4000-8000-000000000801'::uuid$$,
  '42501',
  null,
  'authenticated cannot set status = published (worker-owned)'
);

select throws_ok(
  $$update public.content_items set status = 'publishing'
    where id = '50000000-0000-4000-8000-000000000801'::uuid$$,
  '42501',
  null,
  'authenticated cannot set status = publishing (worker-owned)'
);

-- Saut par-dessus l'approbation : idea -> in_review n'existe pas dans la matrice.
select throws_ok(
  $$update public.content_items set status = 'in_review'
    where id = '50000000-0000-4000-8000-000000000802'::uuid$$,
  '42501',
  null,
  'authenticated cannot jump idea -> in_review'
);

-- Le trigger est `before update of status` : il ne voit pas les INSERT.
-- Sans le WITH CHECK de content_items_insert, la garde serait contournable
-- en un POST /rest/v1/content_items {"status":"published"}.
select throws_ok(
  $$insert into public.content_items (org_id, client_id, title, status, created_by)
    values (
      '10000000-0000-4000-8000-000000000801',
      '20000000-0000-4000-8000-000000000801',
      'Born published',
      'published',
      '00000000-0000-4000-8000-000000000801'
    )$$,
  '42501',
  null,
  'authenticated cannot INSERT a content_item already published'
);

select lives_ok(
  $$insert into public.content_items (org_id, client_id, title, status, created_by)
    values (
      '10000000-0000-4000-8000-000000000801',
      '20000000-0000-4000-8000-000000000801',
      'Born draft',
      'draft',
      '00000000-0000-4000-8000-000000000801'
    )$$,
  'authenticated can INSERT a content_item as draft'
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
-- Chemin WORKER : aucun request.jwt.claims.
-- C'est exactement la connexion Postgres directe du worker (regle 17) : PostgREST
-- pose ce GUC, une connexion serveur directe jamais.
--
-- set_config(guc, null, true) ne remet PAS le GUC a NULL -- il le laisse a chaine
-- vide. La garde teste donc `coalesce(..., '') = ''` et non `IS NULL`, sinon cette
-- section virerait au rouge.
--
-- Sans ces assertions, un correctif qui bloque le worker passerait au vert.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', null, true);

select is_empty(
  $$select 1 where coalesce(current_setting('request.jwt.claims', true), '') <> ''$$,
  'worker context carries no request.jwt.claims (bypass branch is reachable)'
);

-- Statut worker-only : interdit a authenticated (assertions 2 et 3), permis ici.
select lives_ok(
  $$update public.content_items set status = 'published'
    where id = '50000000-0000-4000-8000-000000000804'::uuid$$,
  'worker (direct pg connection, no jwt claims) can set status = published'
);

-- Transition legitime hors statut worker-only : le bypass n'est pas la seule
-- raison pour laquelle le worker passe. La matrice reste franchissable.
select lives_ok(
  $$update public.content_items set status = 'in_review'
    where id = '50000000-0000-4000-8000-000000000802'::uuid$$,
  'worker can perform a legitimate non-worker-only transition (draft -> in_review)'
);

select * from finish();

rollback;
