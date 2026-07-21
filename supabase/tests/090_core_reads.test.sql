-- Leak test des LECTURES CŒUR (lib/data/{clients,content,content-media,
-- notifications}.ts). Ce n'est pas le test d'une migration : c'est le test des
-- REQUÊTES que l'app émet réellement.
--
-- Ce qu'il verrouille précisément : l'hydratation d'un ContentItem (cibles,
-- médias, étiquettes) filtre sur `client_id`, PAS sur `org_id` — parce qu'un
-- Reviewer n'a pas d'org active et peut être invité par deux freelances. Ce
-- choix n'est sûr que si `client_id` est au moins aussi contraignant que
-- `org_id` (UNIQUE(id, org_id) + FK composites). On le prouve ici plutôt que
-- de le supposer : un membre de l'org B ne doit RIEN lire de l'org A, et un
-- reviewer du client A1 ne doit RIEN lire du client A2 de la MÊME org.

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- ===========================================================================
-- Seed. org A {owner UA, reviewer UR sur client A1}, org B {owner UB}.
-- A1 : 1 contenu visible reviewer (in_review) + 1 draft masqué.
-- A2 : 1 contenu in_review (même org, autre client) — le piège du portail.
-- B1 : 1 contenu in_review (autre org).
-- Chaque contenu porte cible + média + étiquette : les 3 tables filles que
-- l'hydratation interroge.
-- ===========================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000090001', 'ua@090.test'),
  ('00000000-0000-4000-8000-000000090002', 'ur@090.test'),
  ('00000000-0000-4000-8000-000000090003', 'ub@090.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000090001', 'Org A 090', 'org-a-090', '00000000-0000-4000-8000-000000090001'),
  ('10000000-0000-4000-8000-000000090002', 'Org B 090', 'org-b-090', '00000000-0000-4000-8000-000000090003');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000090001', '00000000-0000-4000-8000-000000090001', 'owner'),
  ('10000000-0000-4000-8000-000000090002', '00000000-0000-4000-8000-000000090003', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000090001', '10000000-0000-4000-8000-000000090001', 'Client A1 090', 'client-a1-090'),
  ('20000000-0000-4000-8000-000000090002', '10000000-0000-4000-8000-000000090001', 'Client A2 090', 'client-a2-090'),
  ('20000000-0000-4000-8000-000000090003', '10000000-0000-4000-8000-000000090002', 'Client B1 090', 'client-b1-090');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', '00000000-0000-4000-8000-000000090002', 'reviewer');

insert into public.content_items (id, org_id, client_id, title, status, format) values
  ('35000000-0000-4000-8000-000000090001', '10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', 'A1 visible', 'in_review', 'post'),
  ('35000000-0000-4000-8000-000000090002', '10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', 'A1 brouillon', 'draft', 'post'),
  ('35000000-0000-4000-8000-000000090003', '10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090002', 'A2 visible', 'in_review', 'post'),
  ('35000000-0000-4000-8000-000000090004', '10000000-0000-4000-8000-000000090002', '20000000-0000-4000-8000-000000090003', 'B1 visible', 'in_review', 'post');

insert into public.content_targets (org_id, client_id, content_item_id, platform, status) values
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', '35000000-0000-4000-8000-000000090001', 'instagram', 'pending'),
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', '35000000-0000-4000-8000-000000090002', 'instagram', 'pending'),
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090002', '35000000-0000-4000-8000-000000090003', 'instagram', 'pending'),
  ('10000000-0000-4000-8000-000000090002', '20000000-0000-4000-8000-000000090003', '35000000-0000-4000-8000-000000090004', 'instagram', 'pending');

insert into public.media_assets (id, org_id, client_id, type, storage_path, thumb_path) values
  ('40000000-0000-4000-8000-000000090001', '10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', 'image', 'a/a1/1.jpg', 'a/a1/1.webp'),
  ('40000000-0000-4000-8000-000000090002', '10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090002', 'image', 'a/a2/1.jpg', 'a/a2/1.webp'),
  ('40000000-0000-4000-8000-000000090003', '10000000-0000-4000-8000-000000090002', '20000000-0000-4000-8000-000000090003', 'image', 'b/b1/1.jpg', 'b/b1/1.webp');

insert into public.content_media (org_id, client_id, content_item_id, media_asset_id, position) values
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', '35000000-0000-4000-8000-000000090001', '40000000-0000-4000-8000-000000090001', 0),
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', '35000000-0000-4000-8000-000000090002', '40000000-0000-4000-8000-000000090001', 0),
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090002', '35000000-0000-4000-8000-000000090003', '40000000-0000-4000-8000-000000090002', 0),
  ('10000000-0000-4000-8000-000000090002', '20000000-0000-4000-8000-000000090003', '35000000-0000-4000-8000-000000090004', '40000000-0000-4000-8000-000000090003', 0);

insert into public.content_labels (id, org_id, client_id, name) values
  ('45000000-0000-4000-8000-000000090001', '10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', 'Promo A1'),
  ('45000000-0000-4000-8000-000000090002', '10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090002', 'Promo A2'),
  ('45000000-0000-4000-8000-000000090003', '10000000-0000-4000-8000-000000090002', '20000000-0000-4000-8000-000000090003', 'Promo B1');

insert into public.content_item_labels (org_id, client_id, content_item_id, content_label_id) values
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', '35000000-0000-4000-8000-000000090001', '45000000-0000-4000-8000-000000090001'),
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090002', '35000000-0000-4000-8000-000000090003', '45000000-0000-4000-8000-000000090002'),
  ('10000000-0000-4000-8000-000000090002', '20000000-0000-4000-8000-000000090003', '35000000-0000-4000-8000-000000090004', '45000000-0000-4000-8000-000000090003');

insert into public.notifications (org_id, client_id, recipient_user_id, type, title, audience, href) values
  ('10000000-0000-4000-8000-000000090001', '20000000-0000-4000-8000-000000090001', '00000000-0000-4000-8000-000000090001', 'publish_failed', 'Echec A', 'owner', '/dashboard'),
  ('10000000-0000-4000-8000-000000090002', '20000000-0000-4000-8000-000000090003', '00000000-0000-4000-8000-000000090003', 'publish_failed', 'Echec B', 'owner', '/dashboard');

-- ===========================================================================
-- 1. Owner de l'org B : ne lit RIEN de l'org A, sur les 7 tables lues par les
--    lectures cœur. C'est le test d'isolation inter-tenant classique.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000090003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000090003","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.clients where org_id = '10000000-0000-4000-8000-000000090001'$$,
  $$values (0)$$,
  'org B ne lit aucun client de org A (getClients)');

select results_eq(
  $$select count(*)::int from public.content_items where client_id in
      ('20000000-0000-4000-8000-000000090001','20000000-0000-4000-8000-000000090002')$$,
  $$values (0)$$,
  'org B ne lit aucun contenu de org A (getContentItems)');

select results_eq(
  $$select count(*)::int from public.content_targets where client_id in
      ('20000000-0000-4000-8000-000000090001','20000000-0000-4000-8000-000000090002')$$,
  $$values (0)$$,
  'org B ne lit aucune cible de org A (loadTargets, filtre client_id seul)');

select results_eq(
  $$select count(*)::int from public.content_media where client_id in
      ('20000000-0000-4000-8000-000000090001','20000000-0000-4000-8000-000000090002')$$,
  $$values (0)$$,
  'org B ne lit aucune liaison média de org A (loadContentMedia)');

select results_eq(
  $$select count(*)::int from public.media_assets where client_id in
      ('20000000-0000-4000-8000-000000090001','20000000-0000-4000-8000-000000090002')$$,
  $$values (0)$$,
  'org B ne lit aucun media_asset de org A (chemins Storage inclus)');

select results_eq(
  $$select count(*)::int from public.content_labels where client_id in
      ('20000000-0000-4000-8000-000000090001','20000000-0000-4000-8000-000000090002')$$,
  $$values (0)$$,
  'org B ne lit aucune étiquette de org A (loadLabels)');

select results_eq(
  $$select count(*)::int from public.notifications where org_id = '10000000-0000-4000-8000-000000090001'$$,
  $$values (0)$$,
  'org B ne lit aucune notification de org A (getNotifications)');

reset role;

-- ===========================================================================
-- 2. Reviewer du client A1 : le rempart du portail. Il ne doit RIEN voir du
--    client A2 — MÊME ORG. C'est exactement le cas qu'un filtre `org_id`
--    aurait laissé passer si la RLS n'était pas la source de vérité.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000090002';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000090002","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.content_items where client_id = '20000000-0000-4000-8000-000000090002'$$,
  $$values (0)$$,
  'reviewer A1 ne lit AUCUN contenu du client A2 de la même org (getPortalContent)');

select results_eq(
  $$select count(*)::int from public.content_targets where client_id = '20000000-0000-4000-8000-000000090002'$$,
  $$values (0)$$,
  'reviewer A1 ne lit aucune cible du client A2 (fuite par table fille)');

select results_eq(
  $$select count(*)::int from public.content_media where client_id = '20000000-0000-4000-8000-000000090002'$$,
  $$values (0)$$,
  'reviewer A1 ne lit aucune liaison média du client A2');

select results_eq(
  $$select count(*)::int from public.media_assets where client_id = '20000000-0000-4000-8000-000000090002'$$,
  $$values (0)$$,
  'reviewer A1 ne lit aucun media_asset du client A2');

select results_eq(
  $$select count(*)::int from public.content_item_labels where client_id = '20000000-0000-4000-8000-000000090002'$$,
  $$values (0)$$,
  'reviewer A1 ne lit aucune liaison étiquette du client A2');

-- Sur SON client, il voit le contenu visible et PAS le brouillon.
select results_eq(
  $$select count(*)::int from public.content_items where client_id = '20000000-0000-4000-8000-000000090001'$$,
  $$values (1)$$,
  'reviewer A1 lit le contenu in_review de A1, et pas le brouillon (D7)');

select results_eq(
  $$select count(*)::int from public.content_targets where client_id = '20000000-0000-4000-8000-000000090001'$$,
  $$values (1)$$,
  'reviewer A1 ne lit que la cible du contenu VISIBLE (pas celle du brouillon)');

select results_eq(
  $$select count(*)::int from public.content_media where client_id = '20000000-0000-4000-8000-000000090001'$$,
  $$values (1)$$,
  'reviewer A1 ne lit que le média du contenu VISIBLE (pas celui du brouillon)');

-- La cloche du freelance n'est pas celle du reviewer.
select results_eq(
  $$select count(*)::int from public.notifications$$,
  $$values (0)$$,
  'reviewer ne lit AUCUNE notification (getNotifications est org+destinataire)');

reset role;

select * from finish();

rollback;
