-- Test 036 — la valeur `disconnected` existe et reste utilisable partout où
-- `account_status` est employé.
--
-- Une migration d'enum ne « casse » rien visiblement : elle ajoute. Le risque
-- est ailleurs — que la valeur existe côté SQL mais qu'aucune colonne ne
-- l'accepte réellement (mauvais type, contrainte check oubliée), ou qu'une
-- policy filtre sur un statut en dur. On vérifie donc par ÉCRITURE réelle sur
-- les deux tables concernées, pas seulement par lecture du catalogue.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- ---------------------------------------------------------------------------
-- 1. La valeur existe, et les anciennes n'ont pas bougé
-- ---------------------------------------------------------------------------
select ok(
  'disconnected' = any (enum_range(null::public.account_status)::text[]),
  'account_status contient disconnected'
);
select ok(
  'connected' = any (enum_range(null::public.account_status)::text[])
    and 'needs_reauth' = any (enum_range(null::public.account_status)::text[]),
  'les valeurs existantes sont intactes'
);

-- ---------------------------------------------------------------------------
-- 2. Elle est réellement écrivable — c'est ce qu'une vérification de catalogue
--    ne prouverait pas.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'detach@test.local');

insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000010', 'Org detach', 'org-detach');

insert into public.organization_members (org_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner');

insert into public.clients (id, org_id, name, handle, timezone) values
  ('aaaaaaaa-0000-4000-8000-000000000020',
   'aaaaaaaa-0000-4000-8000-000000000010', 'Client detach', 'cd', 'Europe/Paris');

insert into public.platform_connections
  (id, org_id, provider, provider_account_id, status)
values
  ('aaaaaaaa-0000-4000-8000-000000000030',
   'aaaaaaaa-0000-4000-8000-000000000010', 'facebook', 'fb-1', 'disconnected');

select is(
  (select status::text from public.platform_connections
    where id = 'aaaaaaaa-0000-4000-8000-000000000030'),
  'disconnected',
  'platform_connections accepte disconnected'
);

insert into public.social_accounts
  (id, org_id, client_id, platform_connection_id, platform, provider_account_id, status)
values
  ('aaaaaaaa-0000-4000-8000-000000000040',
   'aaaaaaaa-0000-4000-8000-000000000010',
   'aaaaaaaa-0000-4000-8000-000000000020',
   'aaaaaaaa-0000-4000-8000-000000000030',
   'instagram', 'ig-1', 'connected');

update public.social_accounts
   set status = 'disconnected'
 where id = 'aaaaaaaa-0000-4000-8000-000000000040';

select is(
  (select status::text from public.social_accounts
    where id = 'aaaaaaaa-0000-4000-8000-000000000040'),
  'disconnected',
  'social_accounts accepte disconnected'
);

-- ---------------------------------------------------------------------------
-- 3. Le détachement ne réécrit pas le passé : une cible déjà publiée survit.
--
-- C'est la raison pour laquelle on pose un STATUT au lieu de supprimer la
-- ligne (`content_targets` ... on delete restrict, 006:43).
-- ---------------------------------------------------------------------------
insert into public.content_items (id, org_id, client_id, title, format, status)
values ('aaaaaaaa-0000-4000-8000-000000000050',
        'aaaaaaaa-0000-4000-8000-000000000010',
        'aaaaaaaa-0000-4000-8000-000000000020', 'Post publie', 'post', 'published');

insert into public.content_targets
  (id, org_id, client_id, content_item_id, social_account_id, platform, status, external_post_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000060',
   'aaaaaaaa-0000-4000-8000-000000000010',
   'aaaaaaaa-0000-4000-8000-000000000020',
   'aaaaaaaa-0000-4000-8000-000000000050',
   'aaaaaaaa-0000-4000-8000-000000000040',
   'instagram', 'published', 'IG_POST_123');

select is(
  (select external_post_id from public.content_targets
    where id = 'aaaaaaaa-0000-4000-8000-000000000060'),
  'IG_POST_123',
  'le post publie garde son identifiant externe apres detachement'
);

-- Et la suppression reste bien INTERDITE tant qu'une cible existe : c'est ce
-- `restrict` qui justifie l'existence du statut.
select throws_ok(
  $$delete from public.social_accounts
     where id = 'aaaaaaaa-0000-4000-8000-000000000040'$$,
  '23503',
  null,
  'supprimer un compte ayant publie reste refuse (restrict)'
);

select * from finish();
rollback;
