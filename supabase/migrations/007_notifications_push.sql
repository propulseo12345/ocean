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
