-- Migration 020 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
-- Genere depuis supabase/migrations/020_publish_jobs.sql. Prerequis : 010-019.
--
-- File de publication `publish_jobs` (Lot 2, le worker). Un job = execution
-- technique d'une publication sur UNE cible API (IG/FB/TikTok). content_targets
-- garde l'etat metier. Enfilement APP-DRIVEN (RPC enqueue_publish_jobs a la
-- transition scheduled) — decision Etienne 2026-07-22.
--
-- ⚠️ A VALIDER AVANT APPLICATION (Etienne) :
--   1. NON rejouable tel quel : `create type` (enums) echoue si deja present.
--      Le begin/commit annule tout en cas de rejeu — aucun etat partiel. Pour
--      rejouer proprement, droper d'abord publish_jobs + les 2 enums.
--   2. RLS : lecture org-only, ecritures service_role/worker uniquement (aucun
--      `authenticated` n'insere/modifie un job). Les 2 RPC sont SECURITY DEFINER
--      (get_advisors les signalera : exception voulue, protegees par is_org_member).
--   3. Invariants worker dans le schema : idempotence (publish_started_at +
--      external_container_id, regle 15), anti-double-job (index unique partiel,
--      regle 16), lease+reaper (regle 17), backoff (regle 18).
--
-- Apres application : get_advisors (nouveaux warnings attendus = les 2 RPC
-- SECURITY DEFINER + eventuellement RLS-enabled-no-policy-for-write, voulu).

begin;

create type public.publish_job_status as enum (
  'scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying',
  'succeeded', 'failed', 'dead_letter', 'canceled'
);

create type public.publish_job_step as enum (
  'refresh_token', 'check_quota', 'create_container', 'publish', 'verify'
);

create table public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  content_target_id uuid not null,
  social_account_id uuid not null,
  platform public.platform not null,
  status public.publish_job_status not null default 'scheduled',
  step public.publish_job_step,
  run_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  worker_id text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  publish_started_at timestamptz,
  external_container_id text,
  external_post_id text,
  permalink text,
  next_attempt_at timestamptz,
  last_error jsonb,
  succeeded_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id)
    references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade,
  foreign key (content_target_id, client_id)
    references public.content_targets(id, client_id) on delete cascade,
  foreign key (social_account_id, client_id)
    references public.social_accounts(id, client_id) on delete restrict,
  check (attempts >= 0),
  check (max_attempts > 0)
);

create index publish_jobs_claim_idx
  on public.publish_jobs (run_at)
  where status in ('scheduled', 'retrying');
create index publish_jobs_lease_idx
  on public.publish_jobs (lease_expires_at)
  where status in ('claimed', 'awaiting_media', 'publishing');
create unique index publish_jobs_active_target_idx
  on public.publish_jobs (content_target_id)
  where status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying');
create index publish_jobs_org_idx on public.publish_jobs (org_id);
create index publish_jobs_content_item_idx on public.publish_jobs (content_item_id);

create trigger publish_jobs_set_updated_at
before update on public.publish_jobs
for each row execute function public.set_updated_at();

alter table public.publish_jobs enable row level security;

create policy publish_jobs_select on public.publish_jobs
for select to authenticated
using ((select private.is_org_member(org_id)));

revoke all on public.publish_jobs from anon, authenticated;
grant select on public.publish_jobs to authenticated;
grant select, insert, update, delete on public.publish_jobs to service_role;

create or replace function public.enqueue_publish_jobs(_content_item uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid;
  v_status public.content_status;
  v_at     timestamptz;
  v_count  integer := 0;
begin
  select org_id, status, scheduled_at
    into v_org, v_status, v_at
  from public.content_items
  where id = _content_item;

  if v_org is null then
    raise exception 'content_items introuvable' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org) then
    raise exception 'acces refuse' using errcode = '42501';
  end if;
  if v_status <> 'scheduled' or v_at is null then
    return 0;
  end if;

  insert into public.publish_jobs (
    org_id, client_id, content_item_id, content_target_id,
    social_account_id, platform, status, run_at
  )
  select
    ct.org_id, ct.client_id, ct.content_item_id, ct.id,
    ct.social_account_id, ct.platform, 'scheduled', v_at
  from public.content_targets ct
  where ct.content_item_id = _content_item
    and ct.social_account_id is not null
    and ct.platform in ('instagram', 'facebook', 'tiktok')
    and ct.status not in ('published', 'canceled', 'skipped')
  on conflict (content_target_id)
    where status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying')
    do update set run_at = excluded.run_at, updated_at = now();

  get diagnostics v_count = row_count;

  update public.content_targets
  set status = 'queued'
  where content_item_id = _content_item
    and social_account_id is not null
    and platform in ('instagram', 'facebook', 'tiktok')
    and status = 'pending';

  return v_count;
end;
$$;

revoke all on function public.enqueue_publish_jobs(uuid) from public;
grant execute on function public.enqueue_publish_jobs(uuid) to authenticated, service_role;

create or replace function public.cancel_publish_jobs(_content_item uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_count integer := 0;
begin
  select org_id into v_org from public.content_items where id = _content_item;
  if v_org is null then
    raise exception 'content_items introuvable' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org) then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  update public.publish_jobs
  set status = 'canceled', canceled_at = now()
  where content_item_id = _content_item
    and status in ('scheduled', 'retrying')
    and publish_started_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.cancel_publish_jobs(uuid) from public;
grant execute on function public.cancel_publish_jobs(uuid) to authenticated, service_role;

commit;
