begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000601', 'lot0-006-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000602', 'lot0-006-owner-b@example.test'),
  ('00000000-0000-4000-8000-000000000603', 'lot0-006-reviewer@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000601', 'Ocean Org 006 A', 'ocean-006-a', '00000000-0000-4000-8000-000000000601'),
  ('10000000-0000-4000-8000-000000000602', 'Ocean Org 006 B', 'ocean-006-b', '00000000-0000-4000-8000-000000000602');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000601', 'owner'),
  ('10000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000602', 'owner');

insert into public.clients (id, org_id, name, handle)
values
  ('20000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', 'Client 006 A1', 'client-006-a1'),
  ('20000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000601', 'Client 006 A2', 'client-006-a2'),
  ('20000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000602', 'Client 006 B1', 'client-006-b1');

insert into public.client_members (org_id, client_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000601',
  '20000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000603',
  'reviewer'
);

insert into public.platform_connections (id, org_id, provider, connected_by, provider_account_id)
values
  ('30000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', 'instagram', '00000000-0000-4000-8000-000000000601', 'ig-platform-006-a'),
  ('30000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000602', 'instagram', '00000000-0000-4000-8000-000000000602', 'ig-platform-006-b');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values
  ('40000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000601', '30000000-0000-4000-8000-000000000601', 'instagram', 'ig-social-006-a1', 'client006a1'),
  ('40000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000602', '30000000-0000-4000-8000-000000000601', 'instagram', 'ig-social-006-a2', 'client006a2'),
  ('40000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000602', '20000000-0000-4000-8000-000000000603', '30000000-0000-4000-8000-000000000602', 'instagram', 'ig-social-006-b1', 'client006b1');

insert into public.social_account_secrets (social_account_id, org_id, client_id, vault_access_token_secret_id)
values (
  '40000000-0000-4000-8000-000000000601',
  '10000000-0000-4000-8000-000000000601',
  '20000000-0000-4000-8000-000000000601',
  '90000000-0000-4000-8000-000000000601'
);

-- Le statut est explicite : la policy content_items_select masque au reviewer
-- la corbeille et les statuts internes (idea, draft, publishing, failed...).
-- Un fixture muet sur le statut retomberait sur le defaut 'idea', invisible.
insert into public.content_items (id, org_id, client_id, title, caption, status, created_by)
values
  ('50000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000601', 'Content 006 A1', 'Caption A1', 'in_review', '00000000-0000-4000-8000-000000000601'),
  ('50000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000602', 'Content 006 A2', 'Caption A2', 'in_review', '00000000-0000-4000-8000-000000000601'),
  ('50000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000602', '20000000-0000-4000-8000-000000000603', 'Content 006 B1', 'Caption B1', 'in_review', '00000000-0000-4000-8000-000000000602'),
  -- brouillon du client 1 : le reviewer ne doit PAS le voir (GUARD-04)
  ('50000000-0000-4000-8000-000000000604', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000601', 'Draft A1', 'Draft caption', 'draft', '00000000-0000-4000-8000-000000000601'),
  -- contenu du client 1 en corbeille : invisible au reviewer, visible a l'owner
  ('50000000-0000-4000-8000-000000000605', '10000000-0000-4000-8000-000000000601', '20000000-0000-4000-8000-000000000601', 'Trashed A1', 'Trashed caption', 'approved', '00000000-0000-4000-8000-000000000601');

update public.content_items
set deleted_at = now()
where id = '50000000-0000-4000-8000-000000000605';

-- Cible attachee au DRAFT du client 1. Sans elle, l'assertion "reviewer ne lit
-- pas les content_targets d'un draft" passerait trivialement (0 = 0).
insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform)
values (
  'c0000000-0000-4000-8000-000000000604',
  '10000000-0000-4000-8000-000000000601',
  '20000000-0000-4000-8000-000000000601',
  '50000000-0000-4000-8000-000000000604',
  '40000000-0000-4000-8000-000000000601',
  'instagram'
);

grant select on public.social_account_secrets to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000602';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.content_items where org_id = '10000000-0000-4000-8000-000000000601'::uuid$$,
  $$values (0::bigint)$$,
  'org B cannot read org A content'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000603';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000603","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.content_items where client_id = '20000000-0000-4000-8000-000000000601'::uuid$$,
  $$values (1::bigint)$$,
  'reviewer client 1 can read own client content'
);

select results_eq(
  $$select count(*)::bigint from public.content_items where client_id = '20000000-0000-4000-8000-000000000602'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer client 1 cannot read client 2 content'
);

-- GUARD-04 : le front filtre deja (REVIEWER_VISIBLE, deletedAt), mais le
-- portail interroge PostgREST. Sans policy, le reviewer lit draft et corbeille.
select results_eq(
  $$select count(*)::bigint from public.content_items
    where id = '50000000-0000-4000-8000-000000000604'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer cannot read a draft of their own client'
);

select results_eq(
  $$select count(*)::bigint from public.content_items
    where id = '50000000-0000-4000-8000-000000000605'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer cannot read a soft-deleted item of their own client'
);

-- La fuite passerait aussi par la table fille : sans filtre, le reviewer lirait
-- platform / external_post_id / permalink / metadata des cibles d'un draft.
select results_eq(
  $$select count(*)::bigint from public.content_targets
    where content_item_id = '50000000-0000-4000-8000-000000000604'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer cannot read content_targets of a draft'
);

select results_eq(
  $$with updated as (
      update public.content_items
      set title = 'Hacked by reviewer'
      where id = '50000000-0000-4000-8000-000000000601'::uuid
      returning id
    )
    select count(*)::bigint from updated$$,
  $$values (0::bigint)$$,
  'reviewer cannot update content_items'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated"}';

select throws_ok(
  $$insert into public.content_targets (
      org_id,
      client_id,
      content_item_id,
      social_account_id,
      platform
    )
    values (
      '10000000-0000-4000-8000-000000000601',
      '20000000-0000-4000-8000-000000000601',
      '50000000-0000-4000-8000-000000000601',
      '40000000-0000-4000-8000-000000000602',
      'instagram'
    )$$,
  '23503',
  null,
  'cross-client content_target insert fails by FK composite'
);

-- GUARD-01 : sans cet index unique partiel, deux cibles identiques produiraient
-- deux publish_jobs legitimes -- chacun unique de son point de vue, chacun
-- publiant. C'est LE chemin structurel vers la double publication.
select throws_ok(
  $$insert into public.content_targets (
      org_id,
      client_id,
      content_item_id,
      social_account_id,
      platform
    )
    values (
      '10000000-0000-4000-8000-000000000601',
      '20000000-0000-4000-8000-000000000601',
      '50000000-0000-4000-8000-000000000604',
      '40000000-0000-4000-8000-000000000601',
      'instagram'
    )$$,
  '23505',
  null,
  'duplicate content_target on (content_item, social_account) is rejected'
);

-- Contrepartie de GUARD-04 : l'owner voit tout, y compris draft et corbeille.
-- Un test qui ne prouve que le refus ne prouve rien sur l'autorisation.
select results_eq(
  $$select count(*)::bigint from public.content_items
    where client_id = '20000000-0000-4000-8000-000000000601'::uuid$$,
  $$values (3::bigint)$$,
  'owner reads all their content, including draft and trashed'
);

select results_eq(
  $$select count(*)::bigint from public.content_targets
    where content_item_id = '50000000-0000-4000-8000-000000000604'::uuid$$,
  $$values (1::bigint)$$,
  'owner reads content_targets of a draft'
);

select results_eq(
  $$select count(*)::bigint from public.social_account_secrets$$,
  $$values (0::bigint)$$,
  'authenticated cannot read social_account_secrets'
);

reset role;
select * from finish();

rollback;
