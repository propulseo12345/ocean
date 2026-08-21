-- Test 093 — `social_account_quota_usage` accepte réellement `source = 'api'`.
--
-- POURQUOI CE TEST EXISTE PLUTÔT QU'UNE MIGRATION
-- ------------------------------------------------
-- Le LOT 4 (quota distant, phase 6) écrit le relevé de la plateforme avec
-- `source = 'api'`. Le brief demandait de vérifier que cette valeur est bien
-- admise « dans l'enum ou la colonne concernée », et d'écrire une migration
-- 037 sinon. Lecture faite : `source text not null default 'api'` avec
-- `check (source in ('api', 'local'))` (014:112 et 014:123). AUCUNE migration
-- n'est nécessaire.
--
-- Mais lire une ligne de SQL et affirmer « ça marche » est exactement la forme
-- des faux positifs que ce dépôt a payés cette semaine. Ce test l'ÉCRIT :
-- l'insertion réelle passe, et une troisième valeur est bien refusée — sans
-- quoi la contrainte ne prouverait rien.
--
-- Il couvre aussi `quota_kind = 'fb_buc'`, que le LOT 4 utilise pour la
-- première fois : le BUC Facebook n'avait jamais eu d'écrivain.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- ---------------------------------------------------------------------------
-- Fixture minimale : org -> client -> connexion -> compte social
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'quota@test.local');

insert into public.organizations (id, name, slug) values
  ('bbbbbbbb-0000-4000-8000-000000000010', 'Org quota', 'org-quota');

insert into public.organization_members (org_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000001', 'owner');

insert into public.clients (id, org_id, name, handle, timezone) values
  ('bbbbbbbb-0000-4000-8000-000000000020',
   'bbbbbbbb-0000-4000-8000-000000000010', 'Client quota', 'cq', 'Europe/Paris');

insert into public.platform_connections (id, org_id, provider, provider_account_id) values
  ('bbbbbbbb-0000-4000-8000-000000000030',
   'bbbbbbbb-0000-4000-8000-000000000010', 'facebook', 'fb-quota');

insert into public.social_accounts
  (id, org_id, client_id, platform_connection_id, platform, provider_account_id)
values
  ('bbbbbbbb-0000-4000-8000-000000000040',
   'bbbbbbbb-0000-4000-8000-000000000010',
   'bbbbbbbb-0000-4000-8000-000000000020',
   'bbbbbbbb-0000-4000-8000-000000000030',
   'instagram', 'ig-quota');

-- ---------------------------------------------------------------------------
-- 1. `source = 'api'` s'écrit — c'est ce que fait `saveRemoteQuota`
-- ---------------------------------------------------------------------------
insert into public.social_account_quota_usage
  (social_account_id, quota_kind, org_id, client_id, platform,
   used, quota_limit, window_seconds, window_resets_at, source, raw)
values
  ('bbbbbbbb-0000-4000-8000-000000000040', 'ig_publish',
   'bbbbbbbb-0000-4000-8000-000000000010',
   'bbbbbbbb-0000-4000-8000-000000000020', 'instagram',
   37, 100, 86400, now() + interval '24 hours', 'api',
   '{"quota_usage": 37}'::jsonb);

select is(
  (select source from public.social_account_quota_usage
    where social_account_id = 'bbbbbbbb-0000-4000-8000-000000000040'
      and quota_kind = 'ig_publish'),
  'api',
  'social_account_quota_usage accepte source = api (aucune migration 037 requise)'
);

select is(
  (select raw ->> 'quota_usage' from public.social_account_quota_usage
    where social_account_id = 'bbbbbbbb-0000-4000-8000-000000000040'
      and quota_kind = 'ig_publish'),
  '37',
  'la reponse brute de la plateforme est conservee pour le diagnostic'
);

-- ---------------------------------------------------------------------------
-- 2. `fb_buc` : le quota Facebook a enfin un ecrivain (LOT 4)
-- ---------------------------------------------------------------------------
insert into public.social_account_quota_usage
  (social_account_id, quota_kind, org_id, client_id, platform,
   used, quota_limit, window_seconds, window_resets_at, source)
values
  ('bbbbbbbb-0000-4000-8000-000000000040', 'fb_buc',
   'bbbbbbbb-0000-4000-8000-000000000010',
   'bbbbbbbb-0000-4000-8000-000000000020', 'facebook',
   28, 100, 86400, now() + interval '24 hours', 'api');

select is(
  (select used from public.social_account_quota_usage
    where social_account_id = 'bbbbbbbb-0000-4000-8000-000000000040'
      and quota_kind = 'fb_buc'),
  28,
  'fb_buc est une valeur reelle de quota_kind, et 28 est un POURCENTAGE de BUC'
);

-- ---------------------------------------------------------------------------
-- 3. La contrainte n'est pas décorative : une troisième valeur est refusée.
--    Sans ce test, le précédent prouverait seulement que la colonne existe.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.social_account_quota_usage
      (social_account_id, quota_kind, org_id, client_id, platform, used, source)
    values
      ('bbbbbbbb-0000-4000-8000-000000000040', 'ig_container',
       'bbbbbbbb-0000-4000-8000-000000000010',
       'bbbbbbbb-0000-4000-8000-000000000020', 'instagram', 1, 'devine')$$,
  '23514',
  null,
  'une source inventee est refusee par la contrainte check'
);

-- ---------------------------------------------------------------------------
-- 4. La table reste en RLS deny-by-default pour authenticated : le relevé
--    distant est écrit par le worker (service_role), jamais par le navigateur.
-- ---------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.social_account_quota_usage'::regclass),
  'RLS active sur social_account_quota_usage'
);

select * from finish();
rollback;
