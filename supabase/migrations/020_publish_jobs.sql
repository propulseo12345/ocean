-- Migration 020 — File de publication `publish_jobs` (Lot 2, le worker).
--
-- publish_jobs porte l'EXÉCUTION TECHNIQUE d'une publication ; content_targets
-- porte l'ÉTAT MÉTIER par plateforme (statut, id externe, permalink). Un job
-- n'existe QUE pour une cible publiable par API (compte social non nul,
-- plateforme instagram/facebook/tiktok) — les canaux manuels (newsletter, sur
-- mesure) n'ont pas de job.
--
-- Modèle d'enfilement (décision Étienne 2026-07-22) : APP-DRIVEN. L'app appelle
-- `enqueue_publish_jobs(content_item)` à la transition « scheduled » (pas de scan
-- worker). RPC idempotente (reprogrammer = maj de run_at, jamais de doublon).
--
-- Sécurité : org_id + client_id dénormalisés (règle 1), FK composites (règle 3),
-- RLS lecture org-only, écritures service_role/worker exclusivement (aucun
-- `authenticated` n'insère/modifie un job — les RPC SECURITY DEFINER le font).
--
-- Invariants worker portés par le schéma :
--   règle 15 (idempotence) : publish_started_at + external_container_id — un job
--     retrouvé avec publish_started_at non nul ne republie JAMAIS à l'aveugle.
--   règle 16 (anti-double-job) : index unique partiel sur content_target_id pour
--     les statuts ACTIFS — une cible ne peut avoir qu'un job vivant.
--   règle 17 (lease) : claimed_at / lease_expires_at / worker_id + reaper.
--   règle 18 (backoff) : attempts / max_attempts / next_attempt_at.

-- ===========================================================================
-- 1. Enums
-- ===========================================================================

create type public.publish_job_status as enum (
  'scheduled',       -- en attente de run_at
  'claimed',         -- pris par un worker (lease actif)
  'awaiting_media',  -- conteneur créé, média en cours de traitement côté plateforme
  'publishing',      -- publish déclenché
  'retrying',        -- échec transitoire, ré-essai programmé (next_attempt_at)
  'succeeded',       -- terminal
  'failed',          -- terminal (max tentatives ou erreur permanente)
  'dead_letter',     -- terminal (fenêtre de grâce dépassée, intervention humaine)
  'canceled'         -- terminal (contenu déprogrammé/annulé avant démarrage)
);

create type public.publish_job_step as enum (
  'refresh_token',
  'check_quota',
  'create_container',
  'publish',
  'verify'
);

-- ===========================================================================
-- 2. Table
-- ===========================================================================

create table public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  content_target_id uuid not null,
  -- NOT NULL : un job n'existe que pour une cible API (jamais un canal manuel).
  social_account_id uuid not null,
  platform public.platform not null,
  status public.publish_job_status not null default 'scheduled',
  step public.publish_job_step,
  -- Éligibilité : recopié de content_items.scheduled_at à l'enfilement.
  run_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  -- Claim / lease (règle 17).
  worker_id text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  -- Idempotence (règle 15) : posé AVANT media_publish. Non nul => ne jamais
  -- republier sans interroger le conteneur d'abord.
  publish_started_at timestamptz,
  external_container_id text,
  external_post_id text,
  permalink text,
  -- Backoff (règle 18).
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
  -- restrict : on ne supprime pas un compte social tant qu'un job y pointe.
  foreign key (social_account_id, client_id)
    references public.social_accounts(id, client_id) on delete restrict,
  check (attempts >= 0),
  check (max_attempts > 0)
);

-- ===========================================================================
-- 3. Index
-- ===========================================================================

-- Claim : jobs prêts (scheduled/retrying) triés par échéance.
create index publish_jobs_claim_idx
  on public.publish_jobs (run_at)
  where status in ('scheduled', 'retrying');

-- Reaper : leases expirés d'un job en cours.
create index publish_jobs_lease_idx
  on public.publish_jobs (lease_expires_at)
  where status in ('claimed', 'awaiting_media', 'publishing');

-- Règle 16 : un SEUL job actif par cible. Partiel (les jobs terminaux ne comptent
-- pas : une cible peut être republiée après un échec définitif si l'admin relance).
create unique index publish_jobs_active_target_idx
  on public.publish_jobs (content_target_id)
  where status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying');

create index publish_jobs_org_idx on public.publish_jobs (org_id);
create index publish_jobs_content_item_idx on public.publish_jobs (content_item_id);

create trigger publish_jobs_set_updated_at
before update on public.publish_jobs
for each row execute function public.set_updated_at();

-- ===========================================================================
-- 4. RLS — lecture org-only (observabilité), écritures worker/service_role.
-- ===========================================================================

alter table public.publish_jobs enable row level security;

-- L'owner peut LIRE l'état d'exécution de ses jobs (debug/observabilité). Aucun
-- reviewer (pas de policy client_members) : un job n'est pas un livrable client.
create policy publish_jobs_select on public.publish_jobs
for select to authenticated
using ((select private.is_org_member(org_id)));

-- Aucune policy insert/update/delete : `authenticated` ne peut PAS écrire un job.
-- Le worker (service_role) bypasse la RLS ; l'app enfile via les RPC ci-dessous.

-- GUARD-05 : TRUNCATE n'est pas soumis à la RLS. Revoke d'abord (retire aussi
-- TRUNCATE/REFERENCES/TRIGGER accordés par défaut à authenticated dans public).
revoke all on public.publish_jobs from anon, authenticated;
grant select on public.publish_jobs to authenticated;
grant select, insert, update, delete on public.publish_jobs to service_role;

-- ===========================================================================
-- 5. Enfilement app-driven — enqueue_publish_jobs(content_item)
--    Idempotent : reprogrammer met à jour run_at, ne crée jamais de doublon
--    (règle 16 via l'index partiel). Appelé après une transition « scheduled ».
-- ===========================================================================

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

  -- N'enfile que ce qui est réellement programmé (statut ET date).
  if v_status <> 'scheduled' or v_at is null then
    return 0;
  end if;

  -- Un job par cible API. on conflict sur l'index partiel actif : si un job vit
  -- déjà pour la cible, on ne fait que réaligner run_at (reprogrammation).
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

  -- État métier : les cibles en attente passent « en file ». 'queued' est
  -- autorisé à authenticated par la garde 013 (pas un statut d'exécution).
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

-- ===========================================================================
-- 6. Déprogrammation — cancel_publish_jobs(content_item)
--    RÈGLE 15 : n'annule QUE les jobs non démarrés. Un job avec
--    publish_started_at non nul appartient au worker (jamais interrompu à
--    l'aveugle : la publication a peut-être déjà eu lieu côté plateforme).
-- ===========================================================================

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

comment on table public.publish_jobs is
  'File de publication (Lot 2). Execution technique ; content_targets porte l etat metier. Ecritures worker/service_role uniquement.';
comment on function public.enqueue_publish_jobs(uuid) is
  'Enfile un job par cible API d un contenu programme (idempotent, app-driven).';
comment on function public.cancel_publish_jobs(uuid) is
  'Annule les jobs non demarres d un contenu (regle 15 : jamais un job publish_started_at non nul).';
