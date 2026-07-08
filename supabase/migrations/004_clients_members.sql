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
