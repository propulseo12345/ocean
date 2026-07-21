begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- ===========================================================================
-- Seed. org A {owner UA, reviewer UR sur client A1}, org B {owner UB}.
-- Contenus A1 : in_review (visible), draft (masqué). Contenu A2 : in_review.
-- Contenu B1 : in_review. Commentaires client/internal, approvals, activité.
-- ===========================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000013001', 'ua@013.test'),
  ('00000000-0000-4000-8000-000000013003', 'ur@013.test'),
  ('00000000-0000-4000-8000-000000013004', 'ub@013.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000013001', 'Org A 013', 'org-a-013', '00000000-0000-4000-8000-000000013001'),
  ('10000000-0000-4000-8000-000000013002', 'Org B 013', 'org-b-013', '00000000-0000-4000-8000-000000013004');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013001', 'owner'),
  ('10000000-0000-4000-8000-000000013002', '00000000-0000-4000-8000-000000013004', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000013001', '10000000-0000-4000-8000-000000013001', 'Client A1 013', 'client-a1-013'),
  ('20000000-0000-4000-8000-000000013002', '10000000-0000-4000-8000-000000013001', 'Client A2 013', 'client-a2-013'),
  ('20000000-0000-4000-8000-000000013003', '10000000-0000-4000-8000-000000013002', 'Client B1 013', 'client-b1-013');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013003', 'reviewer');

insert into public.content_items (id, org_id, client_id, title, status, format, caption) values
  ('35000000-0000-4000-8000-000000013001', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', 'A1 visible', 'in_review', 'post', 'Légende v1'),
  ('35000000-0000-4000-8000-000000013002', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', 'A1 masqué', 'draft', 'post', null),
  ('35000000-0000-4000-8000-000000013003', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013002', 'A2 visible', 'in_review', 'post', null),
  ('35000000-0000-4000-8000-000000013004', '10000000-0000-4000-8000-000000013002', '20000000-0000-4000-8000-000000013003', 'B1 visible', 'in_review', 'post', null),
  -- pour approval_stale : contenu approuvé avec une approbation
  ('35000000-0000-4000-8000-000000013005', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', 'A1 approuvé', 'approved', 'post', 'Texte approuvé');

-- Commentaires : client (visible reviewer) + internal (jamais reviewer) sur A1
-- visible ; client sur A1 draft (masqué) ; client sur A2 (autre client).
insert into public.content_comments (id, org_id, client_id, content_item_id, author_user_id, author_name, author_role, visibility, body) values
  ('50000000-0000-4000-8000-000000013001', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013001', 'Owner A', 'owner', 'client', 'Retour client visible'),
  ('50000000-0000-4000-8000-000000013002', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013001', 'Owner A', 'owner', 'internal', 'NOTE INTERNE secrète'),
  ('50000000-0000-4000-8000-000000013003', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013002', '00000000-0000-4000-8000-000000013001', 'Owner A', 'owner', 'client', 'Commentaire sur brouillon'),
  ('50000000-0000-4000-8000-000000013004', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013002', '35000000-0000-4000-8000-000000013003', '00000000-0000-4000-8000-000000013001', 'Owner A', 'owner', 'client', 'Commentaire client A2');

insert into public.approvals (id, org_id, client_id, content_item_id, decided_by, decided_by_display_name, decided_by_role, decision) values
  ('51000000-0000-4000-8000-000000013001', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013003', 'Reviewer UR', 'reviewer', 'approved'),
  ('51000000-0000-4000-8000-000000013002', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013002', '35000000-0000-4000-8000-000000013003', '00000000-0000-4000-8000-000000013001', 'Owner A', 'owner', 'approved'),
  -- approbation du contenu A1 approuvé (pour approval_stale)
  ('51000000-0000-4000-8000-000000013005', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013005', '00000000-0000-4000-8000-000000013003', 'Reviewer UR', 'reviewer', 'approved');

insert into public.content_activity (org_id, client_id, content_item_id, kind, actor_name) values
  ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', 'created', 'Owner A');

insert into public.content_targets (id, org_id, client_id, content_item_id, platform, status) values
  ('52000000-0000-4000-8000-000000013001', '10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', 'instagram', 'pending');

-- ===========================================================================
-- 1. Compteur de commentaires client (trigger) : 1 client + 1 internal = 1.
-- ===========================================================================

select is(
  (select client_comments_count from public.content_items where id = '35000000-0000-4000-8000-000000013001'),
  1,
  'client_comments_count ne compte que les commentaires client non supprimés');

-- ===========================================================================
-- 2. approval_stale (trigger) : modifier la légende d'un contenu approuvé.
-- ===========================================================================

update public.content_items set caption = 'Texte modifié après approbation'
where id = '35000000-0000-4000-8000-000000013005';

select ok(
  (select approval_stale from public.content_items where id = '35000000-0000-4000-8000-000000013005'),
  'approval_stale passe à true quand la légende change après une approbation');

-- ===========================================================================
-- 3. Contraintes content_comments
-- ===========================================================================

select throws_ok(
  $$insert into public.content_comments (org_id, client_id, content_item_id, author_role, visibility, body, annotation_content_media_id)
    values ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', 'owner', 'internal', 'x', gen_random_uuid())$$,
  '23514', null,
  'une note interne ne peut pas porter d annotation (anti-fuite)');

-- ===========================================================================
-- 4. RLS reviewer (UR) : le rempart RGPD
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000013003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000013003","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.content_comments where visibility = 'internal'$$,
  $$values (0)$$,
  '(a) reviewer ne lit AUCUNE note interne');

select results_eq(
  $$select count(*)::int from public.content_comments where content_item_id = '35000000-0000-4000-8000-000000013001'$$,
  $$values (1)$$,
  'reviewer lit le commentaire CLIENT d un contenu visible (pas l interne)');

select results_eq(
  $$select count(*)::int from public.content_comments where content_item_id = '35000000-0000-4000-8000-000000013002'$$,
  $$values (0)$$,
  '(b) reviewer ne lit pas les commentaires d un contenu draft');

select results_eq(
  $$select count(*)::int from public.content_comments where client_id = '20000000-0000-4000-8000-000000013002'$$,
  $$values (0)$$,
  '(e) reviewer client 1 ne lit AUCUN commentaire du client 2');

select results_eq(
  $$select count(*)::int from public.content_activity$$,
  $$values (0)$$,
  '(b bis) reviewer ne lit AUCUNE ligne du journal d activité (org-only)');

select results_eq(
  $$select count(*)::int from public.approvals where content_item_id = '35000000-0000-4000-8000-000000013001'$$,
  $$values (1)$$,
  'reviewer lit l approbation d un contenu visible');

select results_eq(
  $$select count(*)::int from public.approvals where client_id = '20000000-0000-4000-8000-000000013002'$$,
  $$values (0)$$,
  '(e) reviewer ne lit AUCUNE approbation du client 2');

select results_eq(
  $$select count(*)::int from public.content_versions$$,
  $$values (0)$$,
  'reviewer ne lit AUCUNE version (org-only, D5)');

-- INSERT reviewer : uniquement client, sous son identité, sur contenu visible.
select throws_ok(
  $$insert into public.content_comments (org_id, client_id, content_item_id, author_user_id, author_role, visibility, body)
    values ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013003', 'reviewer', 'internal', 'Forge interne')$$,
  '42501', null,
  '(c) reviewer ne peut PAS insérer une note interne');

select throws_ok(
  $$insert into public.content_comments (org_id, client_id, content_item_id, author_user_id, author_role, visibility, body)
    values ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013001', 'reviewer', 'client', 'Usurpation auteur')$$,
  '42501', null,
  '(c) reviewer ne peut PAS insérer sous l identité d un autre');

select throws_ok(
  $$insert into public.content_comments (org_id, client_id, content_item_id, author_user_id, author_role, visibility, body)
    values ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013002', '00000000-0000-4000-8000-000000013003', 'reviewer', 'client', 'Sur un brouillon')$$,
  '42501', null,
  '(c) reviewer ne peut PAS commenter un contenu draft');

select lives_ok(
  $$insert into public.content_comments (org_id, client_id, content_item_id, author_user_id, author_name, author_role, visibility, body)
    values ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', '35000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013003', 'Reviewer UR', 'reviewer', 'client', 'Retour légitime du reviewer')$$,
  'reviewer PEUT insérer un commentaire client sous son identité sur un contenu visible');

-- (d) le reviewer ne peut PAS changer le statut par PostgREST (RLS org-only :
--     l UPDATE n affecte aucune ligne, le statut reste in_review).
update public.content_items set status = 'approved' where id = '35000000-0000-4000-8000-000000013001';

reset role;

select is(
  (select status::text from public.content_items where id = '35000000-0000-4000-8000-000000013001'),
  'in_review',
  '(d) l UPDATE direct du statut par le reviewer est un no-op (RLS org-only)');

-- ===========================================================================
-- 5. RPC submit_review_decision : le SEUL chemin de décision du reviewer.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000013003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000013003","role":"authenticated"}';

select lives_ok(
  $$select public.submit_review_decision('35000000-0000-4000-8000-000000013001', 'approved', 'Parfait pour moi')$$,
  'submit_review_decision : le reviewer approuve via la RPC');

-- Sur un contenu NON en revue (draft) : refusé.
select throws_ok(
  $$select public.submit_review_decision('35000000-0000-4000-8000-000000013002', 'approved', null)$$,
  '22023', null,
  'submit_review_decision refuse un contenu qui n est pas in_review');

reset role;

select is(
  (select status::text from public.content_items where id = '35000000-0000-4000-8000-000000013001'),
  'approved',
  'submit_review_decision : le statut passe à approved (via la garde 008)');

select is(
  (select count(*)::int from public.approvals
   where content_item_id = '35000000-0000-4000-8000-000000013001' and decided_by_role = 'reviewer'),
  2,
  'submit_review_decision : une ligne approvals reviewer a été insérée');

select is(
  (select count(*)::int from public.content_activity
   where content_item_id = '35000000-0000-4000-8000-000000013001' and kind = 'approved'),
  1,
  'submit_review_decision : le journal d activité a une entrée approved');

-- ===========================================================================
-- 6. Garde de transition content_targets (analogue 008)
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000013001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000013001","role":"authenticated"}';

select throws_ok(
  $$update public.content_targets set status = 'published'
    where id = '52000000-0000-4000-8000-000000013001'$$,
  '42501', null,
  '(f) un is_org_member ne peut PAS poser content_targets.status = published (garde)');

reset role;

-- Le worker = connexion directe SANS claims JWT : on remet le GUC à vide
-- (set local le laissait sur les claims de l owner → la garde ne bypasserait pas).
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

select lives_ok(
  $$update public.content_targets set status = 'published'
    where id = '52000000-0000-4000-8000-000000013001'$$,
  'le worker (sans claims JWT) peut poser status = published');

-- ===========================================================================
-- 7. emit_notification : refuse un destinataire hors tenant
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000013001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000013001","role":"authenticated"}';

select throws_ok(
  $$select public.emit_notification(
      '00000000-0000-4000-8000-000000013004', '10000000-0000-4000-8000-000000013001', null,
      'review_requested', 'Titre', '/x', 'owner')$$,
  '42501', null,
  'emit_notification refuse un destinataire d une autre org');

select lives_ok(
  $$select public.emit_notification(
      '00000000-0000-4000-8000-000000013003', '10000000-0000-4000-8000-000000013001',
      '20000000-0000-4000-8000-000000013001', 'review_requested', 'À valider', '/portal', 'reviewer')$$,
  'emit_notification accepte un destinataire du même tenant (reviewer du client)');

reset role;

-- ===========================================================================
-- 8. Invitations + recipients FK + GUARD-05
-- ===========================================================================

select throws_ok(
  $$insert into public.review_request_recipients (org_id, client_id, review_request_id, recipient_user_id)
    values ('10000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000013001', gen_random_uuid(), '00000000-0000-4000-8000-000000013004')$$,
  '23503', null,
  'un destinataire de lot doit être membre du client (FK composite vers client_members)');

select results_eq(
  $$select count(*)::int from (values
      ('public.content_versions'), ('public.approvals'), ('public.content_comments'),
      ('public.content_activity'), ('public.review_requests'), ('public.review_request_items'),
      ('public.review_request_recipients'), ('public.client_invitations')
    ) as t(name)
    where has_table_privilege('authenticated', t.name, 'TRUNCATE')$$,
  $$values (0)$$,
  'GUARD-05 : aucune table 013 ne laisse TRUNCATE à authenticated');

select is(
  has_column_privilege('authenticated', 'public.client_invitations', 'token_hash', 'SELECT'),
  false,
  'le token_hash d invitation n est jamais lisible par authenticated');

select * from finish();

rollback;
