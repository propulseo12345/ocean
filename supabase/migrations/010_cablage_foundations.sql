-- Migration 010 — Fondations du câblage : enums transverses, lecture des profils
-- partagés, bootstrap d'organisation, ajustements de tables existantes.
--
-- Débloque l'auth (un user password sans org tombait sur getActiveOrg()=null) et
-- prépare les lots 011+. Aucune table métier ici ; helpers, policy, RPC, enums.
--
-- Décisions actées : D1 (text monolingue), D4 (client_settings org-only, lot 011),
-- auth mot de passe uniquement.

-- ===========================================================================
-- 1. Enums transverses (consommés par les lots 011->016)
-- ===========================================================================

create type public.media_source as enum ('upload', 'depot_client', 'import');
create type public.comment_visibility as enum ('client', 'internal');
create type public.comment_author_role as enum ('owner', 'reviewer');
create type public.approval_decision as enum ('approved', 'changes_requested');
create type public.client_event_kind as enum ('note', 'event');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create type public.activity_kind as enum (
  'created', 'edited', 'status_changed', 'scheduled', 'rescheduled',
  'review_requested', 'approved', 'changes_requested', 'commented',
  'published', 'failed'
);

-- Compteurs de quota par plateforme (CLAUDE.md §6 : IG a 2 compteurs, FB 2, TT 1).
create type public.quota_kind as enum (
  'ig_publish', 'ig_container', 'fb_buc', 'fb_reels', 'tt_draft'
);

grant usage on type public.media_source        to authenticated, service_role;
grant usage on type public.comment_visibility  to authenticated, service_role;
grant usage on type public.comment_author_role to authenticated, service_role;
grant usage on type public.approval_decision   to authenticated, service_role;
grant usage on type public.client_event_kind   to authenticated, service_role;
grant usage on type public.invitation_status   to authenticated, service_role;
grant usage on type public.activity_kind       to authenticated, service_role;
grant usage on type public.quota_kind          to authenticated, service_role;

-- Enum existant élargi : le front teste account_status === 'expired'
-- (client-health-banner.tsx, labels.ts) — branche morte sans cette valeur.
-- ADD VALUE hors de toute utilisation dans la même migration (contrainte PG).
alter type public.account_status add value if not exists 'expired';

-- ===========================================================================
-- 2. Lecture des profils partagés — helper bidirectionnel
--
-- Sans cette policy, le nom/email/initiales d'un reviewer ou d'un coéquipier
-- sont VIDES partout (panneau d'approbation, portail, thread, activité) : un
-- blocage fonctionnel silencieux, aucune erreur. profiles_select_own (003) ne
-- laisse chacun lire QUE sa propre ligne.
--
-- Le sens reviewer -> agence est le plus facile à rater : le reviewer n'est
-- membre d'AUCUNE org, il ne passe donc aucun prédicat org-level. Le helper
-- couvre les deux sens via client_members.
-- ===========================================================================

create or replace function private.shares_scope_with(_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- (1) même organisation : agence <-> agence
    exists (
      select 1
      from public.organization_members a
      join public.organization_members b on a.org_id = b.org_id
      where a.user_id = (select auth.uid())
        and b.user_id = _other
    )
    -- (2) _other est membre d'un client auquel l'appelant est rattaché :
    --     agence -> reviewer, reviewer -> reviewer du même client.
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
    -- (3) SYMÉTRIQUE de (2) : l'appelant est reviewer d'un client, _other est
    --     membre de l'org de ce client (reviewer -> agence) ou du même client.
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

create policy profiles_select_shared on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_scope_with(id))
);

-- ===========================================================================
-- 3. Bootstrap d'organisation
--
-- 003 n'a AUCUNE policy INSERT sur organizations (l'amorçage est serveur), et
-- handle_new_user n'écrit que profiles. Un user password fraîchement inscrit
-- n'a donc ni org ni membership -> getActiveOrg() = null -> 18 pages plantent.
-- Cette RPC crée l'org et pose l'appelant comme owner, en une transaction.
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
-- 4. Ajustements de tables existantes
-- ===========================================================================

-- platform_connections ne porte QUE les comptes sociaux publiables. Les comptes
-- d'agenda (google, microsoft) vivent dans calendar_accounts (lot 015), sinon un
-- compte Google d'agenda serait visible dans une table org-level et pourrait
-- devenir une cible de publication.
alter table public.platform_connections
  add constraint platform_connections_provider_social
    check (provider in ('instagram', 'facebook', 'tiktok'));

-- content_labels : clé système stable pour les libellés "evergreen" que
-- use-calendar-derived filtre par convention (aujourd'hui par nom, fragile).
alter table public.content_labels
  add column system_key text;

create unique index content_labels_client_system_key_idx
  on public.content_labels (client_id, system_key)
  where system_key is not null;
