-- Migration 013 — Collaboration, validation, invitations (Phase 3 du câblage).
-- LA migration la plus sensible : les policies RLS de ce lot sont le rempart
-- RGPD du produit (un reviewer ne doit JAMAIS lire les notes internes de
-- l'agence ni le journal d'activité de son propre contenu).
--
-- Ordre imposé par les FK : content_versions → approvals ; content_comments
-- (annotation → content_media, donc après 012) ; review_requests → items +
-- recipients ; client_invitations. Enums (approval_decision, comment_visibility,
-- comment_author_role, activity_kind) déjà posés en 010.
--
-- Décisions actées : D5 (content_versions org-only + approvals.version_label
-- dénormalisé), D7 (is_reviewer_visible_content += publishing, failed),
-- RGPD (author/decided_by/actor ON DELETE SET NULL + snapshot du nom).

-- ===========================================================================
-- 0. D7 — is_reviewer_visible_content : ajouter 'publishing' et 'failed'.
--
-- portal-card.tsx neutralise publishing/failed en 'scheduled' pour le client ;
-- sans ces statuts ici, le contenu DISPARAÎT du portail en publication (la liste
-- du client rétrécit sans explication). On les ajoute + le masquage UI reste.
-- create or replace : la fonction existe déjà (006).
-- ===========================================================================

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
        'publishing',
        'published',
        'partially_published',
        'failed'
      )
  );
$$;

-- ===========================================================================
-- 1. content_versions — snapshot de légende par envoi (org-only, D5)
-- ===========================================================================

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  -- Entier (trie au-delà de v10) ; le libellé "v1" est dérivé à l'affichage.
  version_number smallint not null,
  caption text,
  -- Motif INTERNE (« suite au retour de Camille ») — jamais exposé au portail.
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade,
  unique (id, client_id),
  unique (content_item_id, version_number),
  check (version_number >= 1)
);

create index content_versions_item_idx
  on public.content_versions (content_item_id, version_number);
create index content_versions_org_id_idx on public.content_versions (org_id);

-- ===========================================================================
-- 2. approvals — décision de validation, IMMUABLE (preuve en cas de litige)
-- ===========================================================================

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  content_version_id uuid,
  -- Libellé dénormalisé (D5) : le portail affiche "v2" sans lire content_versions.
  version_label text,
  -- RGPD : set null + snapshot du nom (permet la suppression d'un compte).
  decided_by uuid references public.profiles(id) on delete set null,
  decided_by_display_name text,
  decided_by_role public.comment_author_role not null,
  decision public.approval_decision not null,
  message text,
  created_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade,
  foreign key (content_version_id, client_id)
    references public.content_versions(id, client_id) on delete set null
);

create index approvals_item_idx on public.approvals (content_item_id, created_at desc);
create index approvals_client_idx on public.approvals (client_id, created_at desc);
create index approvals_org_id_idx on public.approvals (org_id);

-- ===========================================================================
-- 3. content_comments — fil 2 couches (client/internal) + annotation
--
-- L'annotation ancre sur content_media (id stable au réordonnancement), PAS sur
-- media_asset+slide (le slide dérive de content_media.position). x/y = fraction
-- 0..1 du cadre de rendu.
-- ===========================================================================

create table public.content_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  -- RGPD : set null + snapshot (un reviewer révoqué garde son nom sur ses retours).
  author_user_id uuid references public.profiles(id) on delete set null,
  author_name text,
  author_role public.comment_author_role not null,
  visibility public.comment_visibility not null default 'client',
  body text not null,
  -- Annotation → content_media (cascade : détacher le média retire le pin).
  annotation_content_media_id uuid,
  annotation_x real,
  annotation_y real,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade,
  foreign key (annotation_content_media_id, client_id)
    references public.content_media(id, client_id) on delete cascade,
  check (length(trim(body)) > 0),
  -- tout-ou-rien sur l'annotation.
  check (
    (annotation_content_media_id is null and annotation_x is null and annotation_y is null)
    or (annotation_content_media_id is not null and annotation_x is not null and annotation_y is not null)
  ),
  check (annotation_x is null or (annotation_x >= 0 and annotation_x <= 1)),
  check (annotation_y is null or (annotation_y >= 0 and annotation_y <= 1)),
  -- anti-fuite : une note interne ne s'épingle pas sur un média rendu côté portail.
  check (visibility = 'client' or annotation_content_media_id is null)
);

create index content_comments_item_idx
  on public.content_comments (content_item_id, created_at)
  where deleted_at is null;
create index content_comments_client_vis_idx
  on public.content_comments (client_id, visibility, created_at desc)
  where deleted_at is null;
create index content_comments_org_id_idx on public.content_comments (org_id);

-- ===========================================================================
-- 4. content_activity — journal append-only (org-only, écrit par triggers/RPC)
-- ===========================================================================

create table public.content_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  at timestamptz not null default now(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  kind public.activity_kind not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade
);

create index content_activity_item_idx on public.content_activity (content_item_id, at desc);
create index content_activity_org_idx on public.content_activity (org_id, at desc);

-- Helper d'écriture (SECURITY DEFINER) : appelé par les RPC/triggers, jamais par
-- authenticated en direct (le journal est une preuve — nul ne le forge).
create or replace function private.log_content_activity(
  _content_item uuid,
  _kind public.activity_kind,
  _actor_user_id uuid,
  _actor_name text,
  _payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_client uuid;
begin
  select org_id, client_id into v_org, v_client
  from public.content_items where id = _content_item;
  if v_org is null then
    return;
  end if;
  insert into public.content_activity (org_id, client_id, content_item_id, kind, actor_user_id, actor_name, payload)
  values (v_org, v_client, _content_item, _kind, _actor_user_id, _actor_name, coalesce(_payload, '{}'::jsonb));
end;
$$;

revoke all on function private.log_content_activity(uuid, public.activity_kind, uuid, text, jsonb) from public;
grant execute on function private.log_content_activity(uuid, public.activity_kind, uuid, text, jsonb) to service_role;

-- ===========================================================================
-- 5. review_requests (+ items + recipients)
--    PAS d'index unique partiel (casse le 2e envoi, board-state) ; state dérivé.
-- ===========================================================================

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  message text,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles(id) on delete set null,
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  unique (id, client_id)
);

create index review_requests_client_sent_idx on public.review_requests (client_id, sent_at desc);
create index review_requests_org_id_idx on public.review_requests (org_id);

create table public.review_request_items (
  org_id uuid not null,
  client_id uuid not null,
  review_request_id uuid not null,
  content_item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_request_id, content_item_id),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (review_request_id, client_id)
    references public.review_requests(id, client_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade
);

create index review_request_items_content_idx on public.review_request_items (content_item_id);

create table public.review_request_recipients (
  org_id uuid not null,
  client_id uuid not null,
  review_request_id uuid not null,
  recipient_user_id uuid not null,
  notified_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (review_request_id, recipient_user_id),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (review_request_id, client_id)
    references public.review_requests(id, client_id) on delete cascade,
  -- Structurellement, un destinataire est membre du client (unique(client_id,
  -- user_id) existe en 004) — impossible d'adresser à un non-membre.
  foreign key (client_id, recipient_user_id)
    references public.client_members(client_id, user_id) on delete cascade
);

create index review_request_recipients_user_idx
  on public.review_request_recipients (recipient_user_id);

-- ===========================================================================
-- 6. client_invitations — invitation reviewer (P0 pour tout reviewer réel)
-- ===========================================================================

create table public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  email text not null,
  role public.client_role not null default 'reviewer',
  token_hash text not null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  check (email = lower(email)),
  check (expires_at > created_at)
);

create unique index client_invitations_token_idx on public.client_invitations (token_hash);
create unique index client_invitations_pending_idx
  on public.client_invitations (client_id, lower(email))
  where accepted_at is null and revoked_at is null;
create index client_invitations_org_id_idx on public.client_invitations (org_id);

-- ===========================================================================
-- 7. ALTER — client_members, content_items, content_targets
-- ===========================================================================

alter table public.client_members add column last_active_at timestamptz;

alter table public.content_items
  -- Compteur client-only (un count naïf révélerait le volume interne au reviewer).
  add column client_comments_count integer not null default 0;

alter table public.content_targets
  -- Erreur PAR PLATEFORME (pas sur content_items).
  add column last_error jsonb,
  add column manual_published_by uuid references public.profiles(id) on delete set null,
  add column manual_published_at timestamptz,
  add column retry_requested_at timestamptz,
  add column skipped_reason text;

-- ===========================================================================
-- 8. Triggers : compteur de commentaires client + approval_stale
-- ===========================================================================

-- Recompte les commentaires visibility='client' non supprimés d'un contenu.
create or replace function private.refresh_client_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.content_item_id, old.content_item_id);
begin
  update public.content_items ci
  set client_comments_count = (
    select count(*)
    from public.content_comments cc
    where cc.content_item_id = v_item
      and cc.visibility = 'client'
      and cc.deleted_at is null
  )
  where ci.id = v_item;
  return null;
end;
$$;

create trigger content_comments_count_refresh
after insert or update or delete on public.content_comments
for each row execute function private.refresh_client_comments_count();

-- Marque approval_stale quand la légende/hashtags/format change alors qu'une
-- approbation existe. `of` : ne se déclenche pas sur les autres colonnes.
create or replace function private.mark_approval_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' or old.status = 'approved'
     or exists (
       select 1 from public.approvals a
       where a.content_item_id = new.id and a.decision = 'approved'
     )
  then
    if new.caption is distinct from old.caption
       or new.hashtags is distinct from old.hashtags
       or new.format is distinct from old.format
       or new.first_comment is distinct from old.first_comment
    then
      new.approval_stale := true;
    end if;
  end if;
  return new;
end;
$$;

-- Nommé pour s'ordonner AVANT set_updated_at (tri alpha) et la garde de statut.
create trigger content_items_approval_stale
before update of caption, hashtags, format, first_comment on public.content_items
for each row execute function private.mark_approval_stale();

-- ===========================================================================
-- 9. Garde de transition sur content_targets.status (analogue 008)
--
-- content_targets_update est org-level : sans garde, tout is_org_member peut
-- fabriquer status='published' + permalink → publication fantôme. Les statuts
-- d'exécution appartiennent au worker (bypass via GUC absent / service_role).
-- ===========================================================================

create or replace function private.content_targets_guard_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Bypass worker / service_role (même ancre que 008 : request.jwt.claims).
  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return new;
  end if;

  -- Statuts d'exécution : posés par le worker uniquement.
  if new.status in ('publishing', 'published', 'pushed_to_platform') then
    raise exception
      'content_targets: le statut % est posé par le worker uniquement', new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.content_targets_guard_status_transition() from public;

create trigger content_targets_guard_status_transition
before update of status on public.content_targets
for each row execute function private.content_targets_guard_status_transition();

-- ===========================================================================
-- 10. updated_at
-- ===========================================================================

create trigger content_comments_set_updated_at
before update on public.content_comments
for each row execute function public.set_updated_at();

create trigger review_requests_set_updated_at
before update on public.review_requests
for each row execute function public.set_updated_at();

create trigger client_invitations_set_updated_at
before update on public.client_invitations
for each row execute function public.set_updated_at();

-- ===========================================================================
-- 11. RLS
-- ===========================================================================

alter table public.content_versions enable row level security;
alter table public.approvals enable row level security;
alter table public.content_comments enable row level security;
alter table public.content_activity enable row level security;
alter table public.review_requests enable row level security;
alter table public.review_request_items enable row level security;
alter table public.review_request_recipients enable row level security;
alter table public.client_invitations enable row level security;

-- content_versions : org-only (D5 — note interne).
create policy content_versions_select on public.content_versions
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy content_versions_insert on public.content_versions
for insert to authenticated
with check ((select private.is_org_member(org_id)));

-- approvals : lecture org OU reviewer visible. Écriture : owner auto-validation
-- seulement (le reviewer passe par la RPC submit_review_decision).
create policy approvals_select on public.approvals
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (
    (select private.is_client_member(client_id))
    and (select private.is_reviewer_visible_content(content_item_id))
  )
);

create policy approvals_insert_owner on public.approvals
for insert to authenticated
with check (
  (select private.is_org_member(org_id))
  and decided_by = (select auth.uid())
  and decided_by_role = 'owner'
);

-- content_comments : LA policy critique. Reviewer = client-visibles seulement.
create policy content_comments_select on public.content_comments
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (
    (select private.is_client_member(client_id))
    and (select private.is_reviewer_visible_content(content_item_id))
    and visibility = 'client'
    and deleted_at is null
  )
);

create policy content_comments_insert on public.content_comments
for insert to authenticated
with check (
  (
    (select private.is_org_member(org_id))
    and author_user_id = (select auth.uid())
  )
  or (
    (select private.is_client_member(client_id))
    and author_user_id = (select auth.uid())
    and visibility = 'client'
    and (select private.is_reviewer_visible_content(content_item_id))
  )
);

-- UPDATE : org member uniquement (résolution / soft-delete). La restriction de
-- colonnes passe par le grant (grant update (resolved_at, resolved_by, deleted_at)).
create policy content_comments_update on public.content_comments
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

-- content_activity : org-only en lecture. Aucune écriture authenticated.
create policy content_activity_select on public.content_activity
for select to authenticated
using ((select private.is_org_member(org_id)));

-- review_requests : le reviewer lit le message du lot qui lui est adressé.
create policy review_requests_select on public.review_requests
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (select private.is_client_member(client_id))
);

create policy review_requests_insert on public.review_requests
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy review_requests_update on public.review_requests
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy review_requests_delete on public.review_requests
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy review_request_items_select on public.review_request_items
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (
    (select private.is_client_member(client_id))
    and (select private.is_reviewer_visible_content(content_item_id))
  )
);

create policy review_request_items_insert on public.review_request_items
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy review_request_items_delete on public.review_request_items
for delete to authenticated
using ((select private.is_org_member(org_id)));

-- recipients : un reviewer voit SA ligne, jamais celle d'un autre destinataire.
create policy review_request_recipients_select on public.review_request_recipients
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or recipient_user_id = (select auth.uid())
);

create policy review_request_recipients_insert on public.review_request_recipients
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy review_request_recipients_delete on public.review_request_recipients
for delete to authenticated
using ((select private.is_org_member(org_id)));

-- client_invitations : org-only, toutes opérations. Le token_hash ne fuit jamais
-- (revoke select colonne ci-dessous). L'acceptation passe par un Route Handler
-- service_role, jamais par PostgREST.
create policy client_invitations_select on public.client_invitations
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy client_invitations_insert on public.client_invitations
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy client_invitations_update on public.client_invitations
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy client_invitations_delete on public.client_invitations
for delete to authenticated
using ((select private.is_org_member(org_id)));

-- ===========================================================================
-- 12. Grants (revoke all d'abord — GUARD-05)
-- ===========================================================================

revoke all on public.content_versions from anon, authenticated;
revoke all on public.approvals from anon, authenticated;
revoke all on public.content_comments from anon, authenticated;
revoke all on public.content_activity from anon, authenticated;
revoke all on public.review_requests from anon, authenticated;
revoke all on public.review_request_items from anon, authenticated;
revoke all on public.review_request_recipients from anon, authenticated;
revoke all on public.client_invitations from anon, authenticated;

grant select, insert on public.content_versions to authenticated;
grant select, insert on public.approvals to authenticated;
grant select, insert on public.content_comments to authenticated;
-- content_comments : seules ces colonnes sont éditables (l'owner ne réécrit pas
-- le body d'un retour client). L'INSERT reste plein (grant insert ci-dessus).
grant update (resolved_at, resolved_by, deleted_at) on public.content_comments to authenticated;
grant select on public.content_activity to authenticated;
grant select, insert, update, delete on public.review_requests to authenticated;
grant select, insert, delete on public.review_request_items to authenticated;
grant select, insert, update, delete on public.review_request_recipients to authenticated;
-- SELECT en COLONNES explicites — token_hash EXCLU : un grant table-level
-- couvrirait toutes les colonnes (has_column_privilege resterait vrai malgré un
-- revoke colonne). Le token_hash ne part donc jamais vers le navigateur.
grant select (
  id, org_id, client_id, email, role, status, expires_at, accepted_at,
  accepted_user_id, revoked_at, invited_by, created_at, updated_at
) on public.client_invitations to authenticated;
grant insert, update, delete on public.client_invitations to authenticated;

grant select, insert, update, delete on public.content_versions to service_role;
grant select, insert, update, delete on public.approvals to service_role;
grant select, insert, update, delete on public.content_comments to service_role;
grant select, insert, update, delete on public.content_activity to service_role;
grant select, insert, update, delete on public.review_requests to service_role;
grant select, insert, update, delete on public.review_request_items to service_role;
grant select, insert, update, delete on public.review_request_recipients to service_role;
grant select, insert, update, delete on public.client_invitations to service_role;

-- ===========================================================================
-- 13. RPC submit_review_decision — la décision de validation du reviewer.
--
-- Motif B1 : content_items_update est org-only, le reviewer ne peut PAS changer
-- le statut par PostgREST. Cette RPC (security definer) valide is_client_member
-- + statut in_review, insère approvals, met à jour le statut (la garde 008
-- s'applique car appelée sous le JWT du reviewer), journalise, émet la notif.
-- ===========================================================================

create or replace function public.submit_review_decision(
  _content_item uuid,
  _decision public.approval_decision,
  _message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_client uuid;
  v_status public.content_status;
  v_name text;
  v_new_status public.content_status;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select ci.org_id, ci.client_id, ci.status
    into v_org, v_client, v_status
  from public.content_items ci
  where ci.id = _content_item;

  if v_org is null then
    raise exception 'content introuvable' using errcode = 'P0002';
  end if;

  -- Le reviewer doit être membre du client ET le contenu doit être en revue.
  if not (select private.is_client_member(v_client)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_status <> 'in_review' then
    raise exception 'le contenu n''est pas en attente de validation' using errcode = '22023';
  end if;

  select full_name into v_name from public.profiles where id = v_uid;

  insert into public.approvals (
    org_id, client_id, content_item_id, decided_by, decided_by_display_name,
    decided_by_role, decision, message
  )
  values (v_org, v_client, _content_item, v_uid, v_name, 'reviewer', _decision, _message);

  v_new_status := case _decision
    when 'approved' then 'approved'::public.content_status
    else 'changes_requested'::public.content_status
  end;

  update public.content_items set status = v_new_status where id = _content_item;

  if _message is not null and length(trim(_message)) > 0 then
    insert into public.content_comments (
      org_id, client_id, content_item_id, author_user_id, author_name,
      author_role, visibility, body
    )
    values (v_org, v_client, _content_item, v_uid, v_name, 'reviewer', 'client', _message);
  end if;

  perform private.log_content_activity(
    _content_item,
    case _decision when 'approved' then 'approved'::public.activity_kind
                   else 'changes_requested'::public.activity_kind end,
    v_uid, v_name, jsonb_build_object('decision', _decision)
  );
end;
$$;

revoke all on function public.submit_review_decision(uuid, public.approval_decision, text) from public;
grant execute on function public.submit_review_decision(uuid, public.approval_decision, text) to authenticated, service_role;

-- ===========================================================================
-- 14. RPC touch_client_member_seen — pose last_active_at (borné à >5 min).
-- Une policy UPDATE sur client_members ouvrirait l'écriture de `role`.
-- ===========================================================================

create or replace function public.touch_client_member_seen(_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;
  update public.client_members
  set last_active_at = now()
  where client_id = _client
    and user_id = v_uid
    and (last_active_at is null or last_active_at < now() - interval '5 minutes');
end;
$$;

revoke all on function public.touch_client_member_seen(uuid) from public;
grant execute on function public.touch_client_member_seen(uuid) to authenticated, service_role;

-- ===========================================================================
-- 15. RPC emit_notification — insertion contrôlée (notifications n'a AUCUNE
-- policy INSERT authenticated). Motif B2 : une policy ouverte laisserait forger
-- un destinataire. La RPC vérifie que le destinataire partage le tenant.
-- ===========================================================================

create or replace function public.emit_notification(
  _recipient uuid,
  _org uuid,
  _client uuid,
  _type public.notification_type,
  _title text,
  _href text,
  _audience public.notification_audience,
  _body text default null,
  _channels public.notification_channel[] default array['in_app']::public.notification_channel[],
  _payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  -- L'appelant doit partager le tenant du destinataire (bidirectionnel).
  if not (select private.shares_scope_with(_recipient)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.notifications (
    org_id, client_id, recipient_user_id, type, title, body, channels, audience, href, payload
  )
  values (
    _org, _client, _recipient, _type, _title, _body,
    coalesce(_channels, array['in_app']::public.notification_channel[]),
    _audience, _href, coalesce(_payload, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.emit_notification(uuid, uuid, uuid, public.notification_type, text, text, public.notification_audience, text, public.notification_channel[], jsonb) from public;
grant execute on function public.emit_notification(uuid, uuid, uuid, public.notification_type, text, text, public.notification_audience, text, public.notification_channel[], jsonb) to authenticated, service_role;
