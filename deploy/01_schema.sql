-- Ocean/Socean — bootstrap schema Lot 0 (migrations 001->009 + fix *_secrets)
-- Genere depuis fix/lot-0-guardrails @ b84a180
-- A coller dans le SQL Editor Supabase (projet hgdeopkmkwyoumsfggrm), base VIERGE.
-- Transactionnel : tout ou rien.

begin;

-- ============================================================
-- supabase/migrations/001_extensions_schema_utils.sql
-- ============================================================
create extension if not exists pgcrypto;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- supabase/migrations/002_enums.sql
-- ============================================================
create type public.platform as enum (
  'instagram',
  'facebook',
  'tiktok',
  'newsletter',
  'custom'
);

create type public.content_format as enum (
  'post',
  'carousel',
  'reel',
  'story'
);

create type public.media_type as enum (
  'image',
  'video'
);

create type public.content_status as enum (
  'idea',
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'partially_published',
  'failed',
  'canceled'
);

create type public.target_status as enum (
  'pending',
  'queued',
  'publishing',
  'awaiting_manual',
  'published',
  'pushed_to_platform',
  'failed',
  'skipped',
  'canceled'
);

create type public.account_status as enum (
  'connected',
  'needs_reauth'
);

create type public.integration_provider as enum (
  'instagram',
  'facebook',
  'tiktok',
  'google',
  'microsoft'
);

create type public.approval_mode as enum (
  'required',
  'optional',
  'auto'
);

create type public.org_role as enum (
  'owner',
  'admin'
);

create type public.client_role as enum (
  'reviewer',
  'editor'
);

create type public.notification_channel as enum (
  'in_app',
  'push',
  'email'
);

create type public.notification_audience as enum (
  'owner',
  'reviewer',
  'ops'
);

create type public.notification_type as enum (
  'publish_failed',
  'publish_succeeded',
  'publish_delayed',
  'tiktok_draft_pushed',
  'review_due',
  'review_overdue',
  'changes_requested',
  'content_approved',
  'review_comment',
  'reviewer_invitation',
  'review_requested',
  'reschedule_required',
  'manual_due',
  'tiktok_draft_reminder',
  'approved_date_changed',
  'media_purge_warning',
  'token_reauth_needed',
  'watchdog_alert'
);

grant usage on type public.platform to authenticated, service_role;
grant usage on type public.content_format to authenticated, service_role;
grant usage on type public.media_type to authenticated, service_role;
grant usage on type public.content_status to authenticated, service_role;
grant usage on type public.target_status to authenticated, service_role;
grant usage on type public.account_status to authenticated, service_role;
grant usage on type public.integration_provider to authenticated, service_role;
grant usage on type public.approval_mode to authenticated, service_role;
grant usage on type public.org_role to authenticated, service_role;
grant usage on type public.client_role to authenticated, service_role;
grant usage on type public.notification_channel to authenticated, service_role;
grant usage on type public.notification_audience to authenticated, service_role;
grant usage on type public.notification_type to authenticated, service_role;

-- ============================================================
-- supabase/migrations/003_identity_orgs.sql
-- ============================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) > 0),
  check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  initials text,
  timezone text not null default 'Europe/Paris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(timezone)) > 0)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_role not null,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_org_id_role_idx on public.organization_members (org_id, role);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, initials)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'initials', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      initials = coalesce(public.profiles.initials, excluded.initials);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function private.is_org_member(_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = _org
      and om.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;

-- Les enums org_role / client_role existaient sans qu'aucune policy ne les lise :
-- un admin pouvait s'auto-promouvoir owner, ou supprimer l'owner. Le controle de
-- role vivait uniquement cote applicatif (CLAUDE.md section 3) -- defense en
-- profondeur incomplete : la DB doit tenir seule.
create or replace function private.is_org_owner(_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = _org
      and om.user_id = (select auth.uid())
      and om.role = 'owner'
  );
$$;

revoke all on function private.is_org_owner(uuid) from public;
grant execute on function private.is_org_owner(uuid) to authenticated, service_role;

create policy organizations_select on public.organizations
for select to authenticated
using ((select private.is_org_member(id)));

create policy organizations_update on public.organizations
for update to authenticated
using ((select private.is_org_member(id)))
with check ((select private.is_org_member(id)));

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organization_members_select on public.organization_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_org_member(org_id))
);

-- Seul un owner gere les membres de l'org. Un admin qui pourrait ecrire ici
-- s'auto-promouvrait owner, ou supprimerait l'owner.
-- Le tout premier owner est insere par service_role : `organizations` n'a
-- aucune policy INSERT pour authenticated, l'amorcage passe donc par le serveur.
create policy organization_members_insert on public.organization_members
for insert to authenticated
with check ((select private.is_org_owner(org_id)));

create policy organization_members_update on public.organization_members
for update to authenticated
using ((select private.is_org_owner(org_id)))
with check ((select private.is_org_owner(org_id)));

create policy organization_members_delete on public.organization_members
for delete to authenticated
using ((select private.is_org_owner(org_id)));

grant select, update on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.organization_members to service_role;

-- ============================================================
-- supabase/migrations/004_clients_members.sql
-- ============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  handle text,
  brand_color text,
  timezone text not null default 'Europe/Paris',
  approval_mode public.approval_mode not null default 'optional',
  bio text,
  category text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, handle),
  check (length(trim(name)) > 0),
  check (handle is null or handle = lower(handle)),
  check (length(trim(timezone)) > 0)
);

create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.client_role not null,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  unique (client_id, user_id)
);

create index clients_org_id_archived_at_idx on public.clients (org_id, archived_at);
create index client_members_user_id_idx on public.client_members (user_id);
create index client_members_org_id_idx on public.client_members (org_id);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger client_members_set_updated_at
before update on public.client_members
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.client_members enable row level security;

create or replace function private.is_client_member(_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_members cm
    where cm.client_id = _client
      and cm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_client_member(uuid) from public;
grant execute on function private.is_client_member(uuid) to authenticated, service_role;

create policy clients_select on public.clients
for select to authenticated
using ((select private.is_org_member(org_id)) or (select private.is_client_member(id)));

create policy clients_insert on public.clients
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy clients_update on public.clients
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy clients_delete on public.clients
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy client_members_select on public.client_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_org_member(org_id))
);

create policy client_members_insert on public.client_members
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy client_members_update on public.client_members
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy client_members_delete on public.client_members
for delete to authenticated
using ((select private.is_org_member(org_id)));

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.client_members to authenticated;
grant select, insert, update, delete on public.clients to service_role;
grant select, insert, update, delete on public.client_members to service_role;

-- ============================================================
-- supabase/migrations/005_accounts_shell.sql
-- ============================================================
create table public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider public.integration_provider not null,
  connected_by uuid references public.profiles(id) on delete set null,
  provider_account_id text not null,
  provider_account_name text,
  status public.account_status not null default 'connected',
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_health_checked_at timestamptz,
  needs_reauth_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, provider, provider_account_id)
);

create table public.platform_connection_secrets (
  platform_connection_id uuid primary key,
  org_id uuid not null,
  vault_access_token_secret_id uuid,
  vault_refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (platform_connection_id, org_id)
    references public.platform_connections(id, org_id) on delete cascade
);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  platform_connection_id uuid not null,
  platform public.platform not null,
  provider_account_id text not null,
  username text,
  display_name text,
  status public.account_status not null default 'connected',
  followers_count integer,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (platform_connection_id, org_id)
    references public.platform_connections(id, org_id) on delete cascade,
  unique (id, client_id),
  unique (client_id, platform, provider_account_id),
  check (followers_count is null or followers_count >= 0)
);

create table public.social_account_secrets (
  social_account_id uuid primary key,
  org_id uuid not null,
  client_id uuid not null,
  vault_access_token_secret_id uuid,
  vault_refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (social_account_id, client_id)
    references public.social_accounts(id, client_id) on delete cascade,
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade
);

create index platform_connections_org_id_status_idx
on public.platform_connections (org_id, status);

create index social_accounts_client_id_platform_idx
on public.social_accounts (client_id, platform);

create index social_accounts_org_id_status_idx
on public.social_accounts (org_id, status);

create trigger platform_connections_set_updated_at
before update on public.platform_connections
for each row execute function public.set_updated_at();

create trigger platform_connection_secrets_set_updated_at
before update on public.platform_connection_secrets
for each row execute function public.set_updated_at();

create trigger social_accounts_set_updated_at
before update on public.social_accounts
for each row execute function public.set_updated_at();

create trigger social_account_secrets_set_updated_at
before update on public.social_account_secrets
for each row execute function public.set_updated_at();

alter table public.platform_connections enable row level security;
alter table public.platform_connection_secrets enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_account_secrets enable row level security;

create policy platform_connections_select on public.platform_connections
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy platform_connections_insert on public.platform_connections
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy platform_connections_update on public.platform_connections
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy platform_connections_delete on public.platform_connections
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy social_accounts_select on public.social_accounts
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (select private.is_client_member(client_id))
);

create policy social_accounts_insert on public.social_accounts
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy social_accounts_update on public.social_accounts
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy social_accounts_delete on public.social_accounts
for delete to authenticated
using ((select private.is_org_member(org_id)));

grant select, insert, update, delete on public.platform_connections to authenticated;
grant select, insert, update, delete on public.social_accounts to authenticated;
grant select, insert, update, delete on public.platform_connections to service_role;
grant select, insert, update, delete on public.platform_connection_secrets to service_role;
grant select, insert, update, delete on public.social_accounts to service_role;
grant select, insert, update, delete on public.social_account_secrets to service_role;

-- DENY-ALL sur les *_secrets (regle 11), au sens strict : zero grant a
-- authenticated / anon, pas seulement zero policy.
--
-- Supabase applique des ALTER DEFAULT PRIVILEGES qui accordent TRUNCATE /
-- REFERENCES / TRIGGER a authenticated sur TOUTE table creee dans public --
-- y compris ces deux-la. La RLS deny-all bloque SELECT/INSERT/UPDATE/DELETE,
-- mais TRUNCATE N'EST PAS soumis a la RLS : sans ce revoke, n'importe quel
-- utilisateur authentifie (n'importe quel tenant) pourrait TRUNCATE la table
-- et detruire les references de tokens OAuth de TOUS les clients. TRIGGER
-- permettrait d'attacher un trigger aux ecritures service_role.
--
-- Invisible sur un Postgres nu (pas de default privileges) ; c'est la CI
-- Supabase reelle (GUARD-05) qui l'a leve. Le revoke est le seul filet.
revoke all on public.platform_connection_secrets from anon, authenticated;
revoke all on public.social_account_secrets from anon, authenticated;

-- ============================================================
-- supabase/migrations/006_content_core.sql
-- ============================================================
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  title text,
  caption text,
  hashtags text[] not null default '{}',
  format public.content_format not null default 'post',
  status public.content_status not null default 'idea',
  scheduled_at timestamptz,
  newsletter_subject text,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  approval_stale boolean not null default false,
  last_error jsonb,
  deleted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  unique (id, client_id)
);

create table public.content_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  social_account_id uuid,
  platform public.platform not null,
  status public.target_status not null default 'pending',
  external_post_id text,
  permalink text,
  published_at timestamptz,
  deleted_external_at timestamptz,
  caption_override text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade,
  foreign key (social_account_id, client_id)
    references public.social_accounts(id, client_id) on delete restrict,
  -- Cible des FK composites de publish_jobs (Lot 2). Sans elle, publish_jobs
  -- ne peut referencer une cible que par FK simple, et perd la protection
  -- structurelle cross-client.
  unique (id, client_id)
);

create table public.content_labels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  name text not null,
  color_token text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  unique (id, client_id),
  check (length(trim(name)) > 0)
);

create table public.content_item_labels (
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  content_label_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (content_item_id, content_label_id),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade,
  foreign key (content_label_id, client_id)
    references public.content_labels(id, client_id) on delete cascade
);

create index content_items_client_status_scheduled_idx
on public.content_items (client_id, status, scheduled_at);

create index content_items_org_status_idx
on public.content_items (org_id, status);

create index content_targets_content_item_id_idx
on public.content_targets (content_item_id);

create index content_targets_social_account_id_idx
on public.content_targets (social_account_id)
where social_account_id is not null;

create index content_targets_client_status_idx
on public.content_targets (client_id, status);

-- Anti-double-publication, niveau CIBLE (le pendant de la regle 16, qui couvre
-- le niveau JOB). Sans elle, deux content_targets identiques produiraient deux
-- publish_jobs legitimes -- chacun unique de son point de vue, chacun publiant.
-- Partiel : social_account_id est nullable (canaux manuels : newsletter, sur
-- mesure), et un index unique non partiel laisserait passer N lignes NULL.
create unique index content_targets_item_account_idx
on public.content_targets (content_item_id, social_account_id)
where social_account_id is not null;

create unique index content_labels_client_name_idx
on public.content_labels (client_id, lower(name));

create trigger content_items_set_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

create trigger content_targets_set_updated_at
before update on public.content_targets
for each row execute function public.set_updated_at();

create trigger content_labels_set_updated_at
before update on public.content_labels
for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;
alter table public.content_targets enable row level security;
alter table public.content_labels enable row level security;
alter table public.content_item_labels enable row level security;

-- Visibilite d'un content_item pour un reviewer : ni corbeille, ni statuts internes.
-- SECURITY DEFINER + search_path fige : la fonction lit content_items sans
-- redeclencher la RLS de content_items (pas de recursion), et sans jointure
-- tenant dans la policy (regle 3) -- le scoping tenant reste porte par
-- is_client_member(client_id) cote appelant.
create or replace function private.is_reviewer_visible_content(_content_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.content_items ci
    where ci.id = _content_item
      and ci.deleted_at is null
      and ci.status in (
        'in_review',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'partially_published'
      )
  );
$$;

revoke all on function private.is_reviewer_visible_content(uuid) from public;
grant execute on function private.is_reviewer_visible_content(uuid) to authenticated, service_role;

-- Le reviewer ne voit ni la corbeille, ni les statuts internes.
-- Le front filtre deja (REVIEWER_VISIBLE, deletedAt), mais le portail interroge
-- PostgREST : un reviewer avec son JWT lirait draft et deleted_at directement.
-- L'owner garde l'acces integral (il doit voir sa corbeille pour restaurer).
create policy content_items_select on public.content_items
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (
    (select private.is_client_member(client_id))
    and (select private.is_reviewer_visible_content(id))
  )
);

-- Le trigger de garde (008) est `before update of status` : il ne voit pas les
-- INSERT. Sans cette restriction, un `POST {"status":"published"}` creerait un
-- contenu publie sans jamais passer par l'approbation ni par le worker.
-- Un contenu naît toujours dans un statut de redaction.
create policy content_items_insert on public.content_items
for insert to authenticated
with check (
  (select private.is_org_member(org_id))
  and status in ('idea', 'draft')
);

create policy content_items_update on public.content_items
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy content_items_delete on public.content_items
for delete to authenticated
using ((select private.is_org_member(org_id)));

-- Sans le filtre de visibilite, un reviewer lirait les cibles d'un draft
-- (platform, external_post_id, permalink, metadata) alors que le content_item
-- parent lui est masque : la fuite passerait par la table fille.
create policy content_targets_select on public.content_targets
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (
    (select private.is_client_member(client_id))
    and (select private.is_reviewer_visible_content(content_item_id))
  )
);

create policy content_targets_insert on public.content_targets
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy content_targets_update on public.content_targets
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy content_targets_delete on public.content_targets
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy content_labels_select on public.content_labels
for select to authenticated
using ((select private.is_org_member(org_id)) or (select private.is_client_member(client_id)));

create policy content_labels_insert on public.content_labels
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy content_labels_update on public.content_labels
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy content_labels_delete on public.content_labels
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy content_item_labels_select on public.content_item_labels
for select to authenticated
using ((select private.is_org_member(org_id)) or (select private.is_client_member(client_id)));

create policy content_item_labels_insert on public.content_item_labels
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy content_item_labels_delete on public.content_item_labels
for delete to authenticated
using ((select private.is_org_member(org_id)));

grant select, insert, update, delete on public.content_items to authenticated;
grant select, insert, update, delete on public.content_targets to authenticated;
grant select, insert, update, delete on public.content_labels to authenticated;
grant select, insert, delete on public.content_item_labels to authenticated;
grant select, insert, update, delete on public.content_items to service_role;
grant select, insert, update, delete on public.content_targets to service_role;
grant select, insert, update, delete on public.content_labels to service_role;
grant select, insert, update, delete on public.content_item_labels to service_role;

-- ============================================================
-- supabase/migrations/007_notifications_push.sql
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  channels public.notification_channel[] not null default '{in_app}',
  audience public.notification_audience not null,
  href text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  check (length(trim(title)) > 0),
  check (length(trim(href)) > 0)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_name text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint),
  check (length(trim(endpoint)) > 0),
  check (length(trim(p256dh)) > 0),
  check (length(trim(auth)) > 0)
);

create index notifications_recipient_created_idx
on public.notifications (recipient_user_id, created_at desc);

create index notifications_org_created_idx
on public.notifications (org_id, created_at desc);

create index push_subscriptions_user_id_idx
on public.push_subscriptions (user_id);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create or replace function private.has_org_access(_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = _org
      and om.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.client_members cm
    where cm.org_id = _org
      and cm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.has_org_access(uuid) from public;
grant execute on function private.has_org_access(uuid) to authenticated, service_role;

-- Isolation a deux niveaux (regle 8) :
--   * org-level (client_id is null) : appartenance a l'org suffit.
--   * client-level (client_id renseigne) : exiger l'appartenance AU CLIENT.
-- has_org_access() matche client_members sur org_id : un reviewer du client 1
-- passerait le predicat pour une notification du client 2 de la meme org.
create policy notifications_select_own on public.notifications
for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  and (select private.has_org_access(org_id))
  and (
    client_id is null
    or (select private.is_org_member(org_id))
    or (select private.is_client_member(client_id))
  )
);

create policy push_subscriptions_select_own on public.push_subscriptions
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_org_access(org_id))
);

create policy push_subscriptions_insert_own on public.push_subscriptions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_org_access(org_id))
);

create policy push_subscriptions_update_own on public.push_subscriptions
for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_org_access(org_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.has_org_access(org_id))
);

create policy push_subscriptions_delete_own on public.push_subscriptions
for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_org_access(org_id))
);

grant select on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;

-- ============================================================
-- supabase/migrations/008_content_status_guard.sql
-- ============================================================
-- Garde de transition sur content_items.status.
--
-- Pourquoi : `grant insert, update, delete on public.content_items to authenticated`
-- (006) sans garde signifie qu'un `PATCH /rest/v1/content_items {"status":"published"}`
-- passe RLS (l'admin est bien is_org_member) et saute l'approbation client, la
-- programmation et le worker. La validation client -- la proposition de valeur du
-- produit -- serait contournable en une requete.
--
-- Ce trigger n'est PAS une policy : get_advisors ne le verra jamais.
-- Le test pgTAP 008 est son seul filet. Ne pas le supprimer.
--
-- Matrice : docs/PRD.md section 5.B.

create or replace function private.content_items_guard_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed public.content_status[];
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Bypass worker / migrations.
  --
  -- L'ancre est `request.jwt.claims` : ce GUC est pose par PostgREST, et par lui
  -- seul. Un appel utilisateur ou API le porte toujours ; une connexion serveur
  -- directe (le worker, Supavisor SESSION port 5432, regle 17) ne l'a jamais.
  --
  --   (a) GUC absent ou vide  -> worker / migration -> bypass.
  --   (b) role = service_role -> Edge Function en service key -> bypass.
  --
  -- Pourquoi PAS session_user (l'implementation precedente) :
  --   PostgREST se connecte en `authenticator` puis fait SET ROLE authenticated.
  --   SET ROLE ne change QUE current_user -- session_user reste le role de
  --   connexion. La garde dependait donc du nom du role de connexion, non
  --   teste, et invisible depuis pgTAP (ou session_user vaut 'postgres', ce qui
  --   ouvrait le bypass et rendait la garde intestable).
  --   Accessoirement `pg_catalog.session_user` ne compile pas : session_user est
  --   un mot-cle SQL, pas une fonction schema-qualifiable.
  --
  -- Pourquoi PAS current_user : sous SECURITY DEFINER il vaut le PROPRIETAIRE
  -- de la fonction. La garde s'ouvrirait pour tout le monde.
  --
  -- Pourquoi `coalesce(..., '') = ''` et non `IS NULL` : set_config(guc, null, true)
  -- ne remet pas le GUC a NULL, il le laisse a chaine vide. Un `IS NULL` seul
  -- refermerait la garde sur le worker des qu'un claim a ete pose puis reinitialise
  -- dans la meme session (exactement ce que fait le test pgTAP).
  --
  -- Limite documentee : si un jour le worker passe par les routes API applicatives
  -- ou par le client Supabase avec un JWT, il portera des claims et ce bypass ne
  -- s'appliquera plus. Il devra alors s'authentifier en service_role (branche b).
  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return new;
  end if;

  -- Les statuts d'execution appartiennent au worker. Un admin ne pousse jamais
  -- un contenu en published : c'est ce qui rend la validation non contournable.
  if new.status in (
    'publishing',
    'published',
    'partially_published',
    'failed'
  ) then
    raise exception
      'content_items: le statut % est pose par le worker uniquement', new.status
      using errcode = '42501';
  end if;

  -- `case` PL/pgSQL en INSTRUCTION (pas en expression) : `raise` n'est pas
  -- autorise dans un `case ... end` expression, et un `case` expression sans
  -- branche `else` renvoie NULL en silence -- ce qui ouvrirait la garde.
  case old.status
    when 'idea'                then v_allowed := array['draft','scheduled','canceled'];
    when 'draft'               then v_allowed := array['in_review','approved','scheduled','canceled'];
    when 'in_review'           then v_allowed := array['changes_requested','approved','draft','canceled'];
    when 'changes_requested'   then v_allowed := array['draft','approved','canceled'];
    when 'approved'            then v_allowed := array['scheduled','draft','canceled'];
    when 'scheduled'           then v_allowed := array['approved','draft','canceled'];
    when 'publishing'          then v_allowed := array[]::public.content_status[];
    when 'published'           then v_allowed := array[]::public.content_status[];
    -- retry cible des cibles failed / abandon des cibles failed
    when 'partially_published' then v_allowed := array['scheduled','canceled'];
    when 'failed'              then v_allowed := array['scheduled','draft','canceled'];
    when 'canceled'            then v_allowed := array['draft'];
    else
      -- Un `case` INSTRUCTION sans `else` leve CASE_NOT_FOUND (20000), mais on
      -- veut un 42501 explicite : ajouter une valeur a content_status sans
      -- toucher a ce trigger doit echouer bruyamment, jamais passer en silence.
      raise exception
        'content_items: statut source non couvert par la garde: %', old.status
        using errcode = '42501';
  end case;

  if not (new.status = any (v_allowed)) then
    raise exception
      'content_items: transition % -> % interdite', old.status, new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.content_items_guard_status_transition() from public;

-- `of status` : le trigger ne se declenche pas sur une edition de legende.
-- Nom choisi pour trier avant content_items_set_updated_at (g < s) : la garde
-- s'execute d'abord, elle ne voit donc pas l'updated_at reecrit.
create trigger content_items_guard_status_transition
before update of status on public.content_items
for each row execute function private.content_items_guard_status_transition();

-- ============================================================
-- supabase/migrations/009_notifications_read_and_org_plan.sql
-- ============================================================
-- GUARD-10 -- notifications.read_at etait inatteignable.
--
-- `grant select` seul + zero policy write : marquer une notification comme lue
-- etait impossible depuis le client. Fonctionnalite morte au premier cablage.
--
-- Une policy UPDATE ouvrirait TOUTES les colonnes (title, href, payload,
-- recipient_user_id...). Une RPC SECURITY DEFINER ne touche que read_at, et
-- reste scopee au destinataire.

create or replace function public.mark_notification_read(_notification uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications
  set read_at = now()
  where id = _notification
    and recipient_user_id = (select auth.uid())
    and read_at is null;

  get diagnostics v_count = row_count;

  -- false = deja lue, inexistante, ou adressee a quelqu'un d'autre.
  -- On ne distingue pas : ne pas transformer la RPC en oracle d'existence.
  return v_count > 0;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;

-- Toutes les notifications non lues du destinataire, en un appel.
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with updated as (
    update public.notifications
    set read_at = now()
    where recipient_user_id = (select auth.uid())
      and read_at is null
    returning 1
  )
  select count(*)::integer into v_count from updated;

  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- GUARD-14 -- preparer le billing sans le construire.
--
-- Stripe = V2 (PRD section 11). On ne cable RIEN aujourd'hui : ni table
-- subscriptions, ni webhook, ni feature flag par plan. Les quotas d'usage
-- (posts programmes, comptes sociaux, runs IA) se comptent par count(*) scope
-- org_id le jour venu.
--
-- Coût aujourd'hui : deux colonnes sur la table racine. Coût si on attend :
-- une migration sur la table la plus referencee du schema.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column plan text not null default 'solo',
  add column seats integer;

alter table public.organizations
  add constraint organizations_plan_known
    check (plan in ('solo', 'team', 'agency')),
  add constraint organizations_seats_positive
    check (seats is null or seats > 0);

comment on column public.organizations.plan is
  'Plan de facturation. Aucune logique attachee au Lot 0 : Stripe est en V2 (PRD 11).';
comment on column public.organizations.seats is
  'Nombre de sieges payes. NULL = non applicable (plan solo).';

commit;
