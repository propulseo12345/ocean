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

create policy content_items_insert on public.content_items
for insert to authenticated
with check ((select private.is_org_member(org_id)));

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
