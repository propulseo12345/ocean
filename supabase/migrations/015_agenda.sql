-- Migration 015 — Agenda unifié & calendriers connectés (Phase 5 du câblage).
--
-- DÉCISION STRUCTURANTE : les agendas sont scopés par UTILISATEUR, pas par org.
-- Le calendrier « Perso » (yoga, déjeuner famille) fuirait à tous les admins de
-- l'org avec une policy is_org_member seule (PRD:445). Les 4 tables portent donc
-- org_id (règle 1) ET user_id, avec des policies user_id = auth.uid() AND
-- is_org_member(org_id), et des FK composites doublées (id, user_id) en plus de
-- (id, org_id) : l'isolation par personne devient PHYSIQUE, pas déclarative.
--
-- Ordre imposé (règle 11) : calendar_accounts ET calendar_account_secrets dans
-- la MÊME migration — jamais une table de comptes OAuth sans sa sœur deny-all.
--
-- Corrections plan §4 : calendar_events ne référence QUE calendar_calendars
-- (drop du calendar_account_id dénormalisé jamais lu), provider_color et le
-- last_sync_error dupliqué supprimés, external_calendar_id = identité stable
-- (remplace calendarKey(name.fr) qui casse au renommage Google).

-- ===========================================================================
-- 1. calendar_accounts (user-scopé) + secrets deny-all
-- ===========================================================================

create table public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  provider public.integration_provider not null,
  provider_account_id text not null,
  -- not null : rendu sans garde par agenda-sidebar.
  email text not null,
  label text,
  status public.account_status not null default 'connected',
  scopes text[] not null default '{}',
  needs_reauth_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rien ne garantirait sinon que le user est membre de l'org.
  foreign key (org_id, user_id)
    references public.organization_members(org_id, user_id) on delete cascade,
  -- Ancres des FK composites filles (tenant ET personne).
  unique (id, org_id),
  unique (id, user_id),
  unique (org_id, user_id, provider, provider_account_id),
  -- Les comptes d'agenda sont Google/Microsoft uniquement (les réseaux sociaux
  -- vivent dans platform_connections, org-visible).
  check (provider in ('google', 'microsoft'))
);

create index calendar_accounts_user_status_idx on public.calendar_accounts (user_id, status);
create index calendar_accounts_org_status_idx on public.calendar_accounts (org_id, status);

create table public.calendar_account_secrets (
  calendar_account_id uuid primary key,
  org_id uuid not null,
  user_id uuid not null,
  vault_access_token_secret_id uuid,
  vault_refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  -- Microsoft fait tourner le refresh token à chaque échange (null côté Google).
  refresh_token_expires_at timestamptz,
  last_refresh_at timestamptz,
  refresh_failure_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (calendar_account_id, org_id)
    references public.calendar_accounts(id, org_id) on delete cascade,
  foreign key (calendar_account_id, user_id)
    references public.calendar_accounts(id, user_id) on delete cascade
);

-- ===========================================================================
-- 2. calendar_calendars — le niveau que le mock aplatit (couleur + toggle)
-- ===========================================================================

create table public.calendar_calendars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  calendar_account_id uuid not null,
  -- Identité STABLE (remplace calendarKey(name.fr) : renommer chez Google ne
  -- doit pas casser le filtre, deux homonymes ne doivent pas fusionner).
  external_calendar_id text not null,
  name text not null,
  -- Slot de thème 1..5 -> var(--chart-N) côté UI (règle 25, jamais un hex).
  color_slot smallint,
  is_enabled boolean not null default true,
  is_primary boolean not null default false,
  time_zone text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (calendar_account_id, org_id)
    references public.calendar_accounts(id, org_id) on delete cascade,
  foreign key (calendar_account_id, user_id)
    references public.calendar_accounts(id, user_id) on delete cascade,
  unique (id, org_id),
  unique (id, user_id),
  unique (calendar_account_id, external_calendar_id),
  check (color_slot is null or color_slot between 1 and 5)
);

create index calendar_calendars_user_enabled_idx
  on public.calendar_calendars (user_id, is_enabled);

-- ===========================================================================
-- 3. calendar_events — cache fenêtré, lecture seule pour l'humain
--
-- all-day = start_date/end_date (DATE, jamais converti en UTC : un timestamptz
-- décalerait l'événement d'un jour selon le fuseau du lecteur) ;
-- timé = starts_at/ends_at (timestamptz). Un CHECK interdit de mélanger.
-- ===========================================================================

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  -- Dénormalisé : une policy avec jointure est interdite (règle 3).
  user_id uuid not null,
  calendar_id uuid not null,
  external_id text not null,
  series_master_id text,
  title text,
  location text,
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  -- Sweep de sync : delete where calendar_id = $1 and last_sync_run_id <> $run.
  last_sync_run_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (calendar_id, org_id)
    references public.calendar_calendars(id, org_id) on delete cascade,
  foreign key (calendar_id, user_id)
    references public.calendar_calendars(id, user_id) on delete cascade,
  unique (calendar_id, external_id),
  check (
    (all_day and start_date is not null and starts_at is null and ends_at is null)
    or (not all_day and starts_at is not null and ends_at is not null and start_date is null)
  ),
  check (ends_at is null or ends_at >= starts_at),
  check (end_date is null or end_date >= start_date)
);

create index calendar_events_user_starts_idx on public.calendar_events (user_id, starts_at);
create index calendar_events_user_date_idx on public.calendar_events (user_id, start_date);
create index calendar_events_sweep_idx on public.calendar_events (calendar_id, last_sync_run_id);

-- ===========================================================================
-- 4. ALTER content_items — index de la branche « publication » (org-wide fenêtré)
-- ===========================================================================

create index content_items_org_scheduled_idx
  on public.content_items (org_id, scheduled_at)
  where deleted_at is null and scheduled_at is not null;

-- ===========================================================================
-- 5. updated_at
-- ===========================================================================

create trigger calendar_accounts_set_updated_at
before update on public.calendar_accounts
for each row execute function public.set_updated_at();

create trigger calendar_account_secrets_set_updated_at
before update on public.calendar_account_secrets
for each row execute function public.set_updated_at();

create trigger calendar_calendars_set_updated_at
before update on public.calendar_calendars
for each row execute function public.set_updated_at();

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

-- ===========================================================================
-- 6. RLS — user_id = auth.uid() ET membre de l'org (defense in depth : sortir
-- de l'org coupe l'accès même si la ligne subsiste).
-- ===========================================================================

alter table public.calendar_accounts enable row level security;
alter table public.calendar_account_secrets enable row level security; -- DENY-ALL
alter table public.calendar_calendars enable row level security;
alter table public.calendar_events enable row level security;

create policy calendar_accounts_select on public.calendar_accounts
for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_org_member(org_id)));

create policy calendar_accounts_insert on public.calendar_accounts
for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_org_member(org_id)));

create policy calendar_accounts_update on public.calendar_accounts
for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_org_member(org_id)))
with check (user_id = (select auth.uid()) and (select private.is_org_member(org_id)));

create policy calendar_accounts_delete on public.calendar_accounts
for delete to authenticated
using (user_id = (select auth.uid()) and (select private.is_org_member(org_id)));

create policy calendar_calendars_select on public.calendar_calendars
for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_org_member(org_id)));

-- Seul le TOGGLE est écrivable par l'humain (les calendriers viennent du
-- provider) : la restriction de colonne passe par le grant, pas par la policy.
create policy calendar_calendars_update on public.calendar_calendars
for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_org_member(org_id)))
with check (user_id = (select auth.uid()) and (select private.is_org_member(org_id)));

create policy calendar_events_select on public.calendar_events
for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_org_member(org_id)));

-- calendar_account_secrets : ZÉRO policy (deny-all).

-- ===========================================================================
-- 7. Grants — revoke all d'abord (GUARD-05 : TRUNCATE n'est pas soumis à la RLS)
-- ===========================================================================

revoke all on public.calendar_accounts from anon, authenticated;
revoke all on public.calendar_account_secrets from anon, authenticated;
revoke all on public.calendar_calendars from anon, authenticated;
revoke all on public.calendar_events from anon, authenticated;

grant select, insert, update, delete on public.calendar_accounts to authenticated;
-- Le revoke ci-dessus rend ce grant colonne effectif (sans lui, un grant update
-- table-level préexistant le rendrait no-op).
grant select on public.calendar_calendars to authenticated;
grant update (is_enabled) on public.calendar_calendars to authenticated;
grant select on public.calendar_events to authenticated;

grant select, insert, update, delete on public.calendar_accounts to service_role;
grant select, insert, update, delete on public.calendar_account_secrets to service_role;
grant select, insert, update, delete on public.calendar_calendars to service_role;
grant select, insert, update, delete on public.calendar_events to service_role;

-- ===========================================================================
-- 8. Vue unified_agenda — tuple MINCE et homogène, security_invoker.
--
-- security_invoker = true IMPÉRATIF : sinon la vue s'exécute avec les droits du
-- créateur et court-circuite toute l'isolation.
--
-- Bug corrigé (plan §4) : content_items n'a PAS de user_id. La vue expose
-- owner_user_id NULLABLE et filtre par branche — un `.eq('user_id', …)` défensif
-- côté appelant ferait sinon disparaître TOUTES les publications.
-- Le filtre is_enabled vit DANS la vue (serveur), pas dans un useState client.
-- ===========================================================================

create view public.unified_agenda
with (security_invoker = true)
as
  select
    'event'::text            as kind,
    e.id                     as source_id,
    e.org_id                 as org_id,
    e.user_id                as owner_user_id,
    null::uuid               as client_id,
    e.calendar_id            as calendar_id,
    e.title                  as title,
    e.all_day                as all_day,
    e.starts_at              as starts_at,
    e.ends_at                as ends_at,
    e.start_date             as start_date,
    e.end_date               as end_date
  from public.calendar_events e
  join public.calendar_calendars c on c.id = e.calendar_id
  where c.is_enabled

  union all

  select
    'publication'::text      as kind,
    ci.id                    as source_id,
    ci.org_id                as org_id,
    null::uuid               as owner_user_id, -- content_items n'a pas de user_id
    ci.client_id             as client_id,
    null::uuid               as calendar_id,
    ci.title                 as title,
    false                    as all_day,
    ci.scheduled_at          as starts_at,
    ci.scheduled_at          as ends_at,
    null::date               as start_date,
    null::date               as end_date
  from public.content_items ci
  where ci.deleted_at is null
    and ci.scheduled_at is not null
    and ci.status in ('scheduled', 'approved', 'publishing');

grant select on public.unified_agenda to authenticated, service_role;
