-- Migration 010 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
--
-- VERSION IDEMPOTENTE : rejouable sans erreur meme si 010 a deja ete appliquee
-- (partiellement ou totalement). Chaque objet n'est cree que s'il manque.
--
-- Elle REPARE aussi l'enum activity_kind : la premiere version de 010 avait des
-- valeurs ('edited', 'status_changed', 'review_requested') qui NE correspondent
-- PAS au type front ActivityKind (collab.ts). Les composants UI en font des
-- Record<ActivityKind, ...> exhaustifs (activityKindMeta, KIND_ICONS) : une
-- valeur DB non mappee casserait ces Record au premier evenement journalise.
-- Le bloc 1bis recree l'enum avec les bonnes valeurs SI et SEULEMENT SI aucune
-- colonne ne l'utilise encore (le cas tant que la migration 013 n'est pas passee).
--
-- NB : ALTER TYPE ... ADD VALUE est laisse hors begin/commit par prudence.
--
-- Migration 010 — Fondations du cablage : enums transverses, lecture des profils
-- partages, bootstrap d'organisation, ajustements de tables existantes.

-- ===========================================================================
-- 1. Enums transverses (crees seulement s'ils manquent)
-- ===========================================================================

do $$
begin
  if to_regtype('public.media_source') is null then
    create type public.media_source as enum ('upload', 'depot_client', 'import');
  end if;
  if to_regtype('public.comment_visibility') is null then
    create type public.comment_visibility as enum ('client', 'internal');
  end if;
  if to_regtype('public.comment_author_role') is null then
    create type public.comment_author_role as enum ('owner', 'reviewer');
  end if;
  if to_regtype('public.approval_decision') is null then
    create type public.approval_decision as enum ('approved', 'changes_requested');
  end if;
  if to_regtype('public.client_event_kind') is null then
    create type public.client_event_kind as enum ('note', 'event');
  end if;
  if to_regtype('public.invitation_status') is null then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
  if to_regtype('public.quota_kind') is null then
    create type public.quota_kind as enum
      ('ig_publish', 'ig_container', 'fb_buc', 'fb_reels', 'tt_draft');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1bis. activity_kind — creation OU reparation (alignement sur le front).
-- ---------------------------------------------------------------------------

do $$
declare
  v_expected text[] := array[
    'created', 'updated', 'sent_for_review', 'commented', 'approved',
    'changes_requested', 'scheduled', 'rescheduled', 'published', 'failed', 'retried'
  ];
  v_current  text[];
  v_used     integer;
  v_sql      text;
begin
  v_sql := 'create type public.activity_kind as enum ('
        || (select string_agg(quote_literal(v), ', ') from unnest(v_expected) v)
        || ')';

  if to_regtype('public.activity_kind') is null then
    execute v_sql;
    raise notice 'activity_kind cree (valeurs alignees sur le front).';
    return;
  end if;

  select array_agg(enumlabel::text order by enumsortorder)
    into v_current
  from pg_enum
  where enumtypid = 'public.activity_kind'::regtype;

  if v_current is not distinct from v_expected then
    raise notice 'activity_kind deja aligne sur le front, rien a faire.';
    return;
  end if;

  -- L'enum diverge. Postgres ne sait pas retirer une valeur d'un enum : il faut
  -- le recreer. Possible uniquement si aucune colonne ne l'utilise encore.
  select count(*) into v_used
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  where a.atttypid = 'public.activity_kind'::regtype
    and a.attisdropped = false
    and c.relkind = 'r';

  if v_used > 0 then
    raise exception
      'activity_kind diverge du front MAIS % colonne(s) l''utilisent deja. '
      'Intervention manuelle requise (migrer les donnees avant de recreer le type). '
      'Actuel: % / Attendu: %', v_used, v_current, v_expected;
  end if;

  drop type public.activity_kind;
  execute v_sql;
  raise notice 'activity_kind RECREE. Ancien: % / Nouveau: %', v_current, v_expected;
end $$;

-- Grants (idempotents).
grant usage on type public.media_source        to authenticated, service_role;
grant usage on type public.comment_visibility  to authenticated, service_role;
grant usage on type public.comment_author_role to authenticated, service_role;
grant usage on type public.approval_decision   to authenticated, service_role;
grant usage on type public.client_event_kind   to authenticated, service_role;
grant usage on type public.invitation_status   to authenticated, service_role;
grant usage on type public.activity_kind       to authenticated, service_role;
grant usage on type public.quota_kind          to authenticated, service_role;

-- Enum existant elargi : le front teste account_status === 'expired'
-- (client-health-banner.tsx, labels.ts) — branche morte sans cette valeur.
alter type public.account_status add value if not exists 'expired';

-- ===========================================================================
-- 2. Lecture des profils partages — helper bidirectionnel
--
-- Sans cette policy, le nom/email/initiales d'un reviewer ou d'un coequipier
-- sont VIDES partout (panneau d'approbation, portail, thread, activite) : un
-- blocage fonctionnel silencieux, aucune erreur. profiles_select_own (003) ne
-- laisse chacun lire QUE sa propre ligne.
--
-- Le sens reviewer -> agence est le plus facile a rater : le reviewer n'est
-- membre d'AUCUNE org, il ne passe donc aucun predicat org-level.
-- ===========================================================================

create or replace function private.shares_scope_with(_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- (1) meme organisation : agence <-> agence
    exists (
      select 1
      from public.organization_members a
      join public.organization_members b on a.org_id = b.org_id
      where a.user_id = (select auth.uid())
        and b.user_id = _other
    )
    -- (2) _other est membre d'un client auquel l'appelant est rattache :
    --     agence -> reviewer, reviewer -> reviewer du meme client.
    or exists (
      select 1
      from public.client_members cm
      join public.clients c on c.id = cm.client_id
      where cm.user_id = _other
        and (
          exists (
            select 1 from public.client_members self
            where self.user_id = (select auth.uid())
              and self.client_id = cm.client_id
          )
          or exists (
            select 1 from public.organization_members om
            where om.user_id = (select auth.uid())
              and om.org_id = c.org_id
          )
        )
    )
    -- (3) SYMETRIQUE de (2) : l'appelant est reviewer d'un client, _other est
    --     membre de l'org de ce client (reviewer -> agence) ou du meme client.
    --     Sans cette branche, un reviewer ne lirait jamais le profil de l'owner.
    or exists (
      select 1
      from public.client_members cm
      join public.clients c on c.id = cm.client_id
      where cm.user_id = (select auth.uid())
        and (
          exists (
            select 1 from public.organization_members om
            where om.user_id = _other
              and om.org_id = c.org_id
          )
          or exists (
            select 1 from public.client_members other
            where other.user_id = _other
              and other.client_id = cm.client_id
          )
        )
    );
$$;

revoke all on function private.shares_scope_with(uuid) from public;
grant execute on function private.shares_scope_with(uuid) to authenticated, service_role;

drop policy if exists profiles_select_shared on public.profiles;
create policy profiles_select_shared on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_scope_with(id))
);

-- ===========================================================================
-- 3. Bootstrap d'organisation
--
-- 003 n'a AUCUNE policy INSERT sur organizations, et handle_new_user n'ecrit que
-- profiles. Un user password fraichement inscrit n'a donc ni org ni membership
-- -> getActiveOrg() = null -> 18 pages plantent.
-- ===========================================================================

create or replace function public.create_organization(_name text, _slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org public.organizations;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if _name is null or length(trim(_name)) = 0 then
    raise exception 'name is required' using errcode = '22004';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(_name), lower(trim(_slug)), v_uid)
  returning * into v_org;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org.id, v_uid, 'owner');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated, service_role;

-- ===========================================================================
-- 4. Ajustements de tables existantes (idempotents)
-- ===========================================================================

-- platform_connections ne porte QUE les comptes sociaux publiables. Les comptes
-- d'agenda (google, microsoft) vivent dans calendar_accounts (lot 015), sinon un
-- compte Google d'agenda serait visible dans une table org-level.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'platform_connections_provider_social'
  ) then
    alter table public.platform_connections
      add constraint platform_connections_provider_social
        check (provider in ('instagram', 'facebook', 'tiktok'));
  end if;
end $$;

-- content_labels : cle systeme stable pour les libelles "evergreen".
alter table public.content_labels add column if not exists system_key text;

create unique index if not exists content_labels_client_system_key_idx
  on public.content_labels (client_id, system_key)
  where system_key is not null;
