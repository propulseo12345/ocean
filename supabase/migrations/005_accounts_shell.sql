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
