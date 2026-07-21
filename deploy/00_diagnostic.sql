-- DIAGNOSTIC — à exécuter EN PREMIER dans le SQL Editor.
-- Dit exactement ce qui est déjà en place en ligne, pour ne rien appliquer à
-- l'aveugle. Ne modifie RIEN (lecture seule).

-- 1. Quelles migrations sont déjà passées ? (présence des tables clés)
select
  'migration 010' as lot,
  to_regtype('public.media_source') is not null                as enums_ok,
  to_regprocedure('private.shares_scope_with(uuid)') is not null as helper_ok,
  to_regprocedure('public.create_organization(text,text)') is not null as rpc_ok,
  exists (select 1 from pg_policies
          where schemaname='public' and tablename='profiles'
            and policyname='profiles_select_shared')          as policy_ok
union all
select 'migration 011', to_regclass('public.content_pillars') is not null,
       to_regclass('public.client_settings') is not null,
       to_regclass('public.saved_views') is not null, null
union all
select 'migration 012', to_regclass('public.media_assets') is not null,
       to_regclass('public.content_media') is not null, null, null
union all
select 'migration 013', to_regclass('public.content_comments') is not null,
       to_regclass('public.approvals') is not null,
       to_regclass('public.content_activity') is not null, null
union all
select 'migration 014', to_regclass('public.imported_posts') is not null,
       to_regclass('public.post_metrics') is not null, null, null
union all
select 'migration 015', to_regclass('public.calendar_accounts') is not null,
       to_regclass('public.calendar_events') is not null, null, null;

-- 2. LE POINT CRITIQUE : les valeurs de l'enum activity_kind en ligne.
--    Attendu (aligné sur le type front ActivityKind) :
--      created, updated, sent_for_review, commented, approved,
--      changes_requested, scheduled, rescheduled, published, failed, retried
--    Si on voit 'edited', 'status_changed' ou 'review_requested', l'enum est
--    l'ANCIENNE version et doit être réparé (script 03b).
select string_agg(enumlabel, ', ' order by enumsortorder) as activity_kind_en_ligne
from pg_enum
where enumtypid = 'public.activity_kind'::regtype;

-- 3. L'enum activity_kind est-il déjà utilisé par une colonne ?
--    (s'il ne l'est pas, on peut le recréer proprement)
select count(*) as colonnes_utilisant_activity_kind
from pg_attribute a
join pg_class c on c.oid = a.attrelid
where a.atttypid = 'public.activity_kind'::regtype
  and a.attisdropped = false
  and c.relkind = 'r';

-- 4. account_status contient-il bien 'expired' ?
select string_agg(enumlabel, ', ' order by enumsortorder) as account_status_en_ligne
from pg_enum
where enumtypid = 'public.account_status'::regtype;

-- 5. Ajustements 010 sur les tables existantes.
select
  exists (select 1 from pg_constraint
          where conname = 'platform_connections_provider_social') as check_provider_ok,
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='content_labels'
            and column_name='system_key')                        as system_key_ok;
