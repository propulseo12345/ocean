-- Leak test des ÉCRITURES CŒUR (lib/actions/content.ts). Comme 090, ce n'est pas
-- le test d'une migration mais des GARDES sur lesquelles les Server Actions
-- s'appuient : un contenu naît en idea/draft, un membre d'org B n'écrit rien
-- chez A, et un reviewer n'écrit JAMAIS de contenu (il valide, il ne rédige pas).

begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000091001', 'ua@091.test'),
  ('00000000-0000-4000-8000-000000091002', 'ur@091.test'),
  ('00000000-0000-4000-8000-000000091003', 'ub@091.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000091001', 'Org A 091', 'org-a-091', '00000000-0000-4000-8000-000000091001'),
  ('10000000-0000-4000-8000-000000091002', 'Org B 091', 'org-b-091', '00000000-0000-4000-8000-000000091003');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000091001', '00000000-0000-4000-8000-000000091001', 'owner'),
  ('10000000-0000-4000-8000-000000091002', '00000000-0000-4000-8000-000000091003', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000091001', '10000000-0000-4000-8000-000000091001', 'Client A1 091', 'client-a1-091'),
  ('20000000-0000-4000-8000-000000091002', '10000000-0000-4000-8000-000000091002', 'Client B1 091', 'client-b1-091');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', '00000000-0000-4000-8000-000000091002', 'reviewer');

insert into public.content_items (id, org_id, client_id, title, status, format) values
  ('35000000-0000-4000-8000-000000091001', '10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', 'A1 draft', 'draft', 'post');

-- ===========================================================================
-- 1. Owner A (chemin nominal) : INSERT d'un contenu qui NAÎT en draft.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000091001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000091001","role":"authenticated"}';

select lives_ok(
  $$insert into public.content_items (org_id, client_id, title, status, format)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', 'Nouveau', 'draft', 'post')$$,
  'owner A cree un contenu draft (chemin composer nominal)');

select lives_ok(
  $$insert into public.content_items (org_id, client_id, title, status, format)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', 'Idee', 'idea', 'post')$$,
  'owner A cree une idee');

-- La policy INSERT interdit de NAÎTRE dans un statut d'exécution/revue.
select throws_ok(
  $$insert into public.content_items (org_id, client_id, title, status, format)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', 'Triche', 'published', 'post')$$,
  '42501', null,
  'un contenu ne peut PAS naitre publie (policy INSERT 006 : idea/draft only)');

select throws_ok(
  $$insert into public.content_items (org_id, client_id, title, status, format)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', 'Triche2', 'in_review', 'post')$$,
  '42501', null,
  'un contenu ne peut PAS naitre en revue');

select lives_ok(
  $$insert into public.content_targets (org_id, client_id, content_item_id, platform, status)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', '35000000-0000-4000-8000-000000091001', 'instagram', 'pending')$$,
  'owner A ajoute une cible pending a son contenu');

reset role;

-- ===========================================================================
-- 2. Owner B : ne peut RIEN écrire chez A. On teste l ISOLATION par relecture :
--    l update ne LÈVE pas (RLS = 0 ligne, silencieux) mais ne change RIEN.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000091003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000091003","role":"authenticated"}';

select throws_ok(
  $$insert into public.content_items (org_id, client_id, title, status, format)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', 'Intrus', 'draft', 'post')$$,
  '42501', null,
  'org B ne cree AUCUN contenu chez A');

select throws_ok(
  $$insert into public.content_targets (org_id, client_id, content_item_id, platform, status)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', '35000000-0000-4000-8000-000000091001', 'facebook', 'pending')$$,
  '42501', null,
  'org B ne cree AUCUNE cible chez A');

select lives_ok(
  $$update public.content_items set title = 'pirate B' where id = '35000000-0000-4000-8000-000000091001'$$,
  'org B : l update ne leve pas (RLS masque la ligne, no-op)');

reset role;

-- ===========================================================================
-- 3. Reviewer A1 : valide, ne RÉDIGE jamais.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000091002';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000091002","role":"authenticated"}';

select throws_ok(
  $$insert into public.content_items (org_id, client_id, title, status, format)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', 'Reviewer redige', 'draft', 'post')$$,
  '42501', null,
  'un reviewer ne CREE aucun contenu (il valide, il ne redige pas)');

select throws_ok(
  $$insert into public.content_item_labels (org_id, client_id, content_item_id, content_label_id)
    values ('10000000-0000-4000-8000-000000091001', '20000000-0000-4000-8000-000000091001', '35000000-0000-4000-8000-000000091001', gen_random_uuid())$$,
  '42501', null,
  'un reviewer n etiquette aucun contenu');

select lives_ok(
  $$update public.content_items set caption = 'reviewer edit' where id = '35000000-0000-4000-8000-000000091001'$$,
  'reviewer : l update ne leve pas mais ne touche rien (content_items_update est org-only)');

-- Le reviewer ne LIT meme pas le contenu draft.
select results_eq(
  $$select count(*)::int from public.content_items where id = '35000000-0000-4000-8000-000000091001'$$,
  $$values (0)$$,
  'un reviewer ne LIT meme pas le contenu draft (D7)');

reset role;

-- ===========================================================================
-- 4. Preuve d ISOLATION : apres les tentatives B + reviewer, le contenu de A
--    est INCHANGE (ni 'pirate B', ni 'reviewer edit').
-- ===========================================================================

select is(
  (select title from public.content_items where id = '35000000-0000-4000-8000-000000091001'),
  'A1 draft',
  'apres les tentatives org B / reviewer, le contenu de A est INCHANGE');

select * from finish();

rollback;
