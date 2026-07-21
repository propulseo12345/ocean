-- Migration 014 — Feed importé & performance (Phase 4 du câblage).
--
-- 3 tables en ÉCRITURE SERVICE_ROLE EXCLUSIVE (décision structurante) : elles
-- proviennent d'API externes (Graph, insights, content_publishing_limit). Un
-- membre d'org ne doit ni fabriquer un faux post IG, ni gonfler les métriques
-- d'un rapport client, ni remettre à zéro une jauge de quota (règle 19).
--
-- Corrections plan §2/§4 : post_metrics sans impressions/video_views/shares
-- (EngagementStats = likes/comments/reach/saves), reach nullable (un default 0
-- ferait plonger la moyenne KPI), engagement_total généré. imported_posts en
-- media_product_type (pas media_type), sans caption ni media_count. Quota en PK
-- composite (social_account_id, quota_kind) — IG a 2 compteurs, FB 2.

-- ===========================================================================
-- 1. imported_posts — publications IG déjà sur le compte (non créées par Ocean)
-- ===========================================================================

create table public.imported_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  social_account_id uuid not null,
  external_post_id text not null,
  permalink text,
  -- FEED | REELS | STORY (chaîne Graph) ; l'UI dérive image/video.
  media_product_type text not null default 'FEED',
  thumb_path text,
  thumb_url text,
  is_pinned boolean not null default false,
  published_at timestamptz not null,
  deleted_on_platform_at timestamptz,
  imported_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (social_account_id, client_id)
    references public.social_accounts(id, client_id) on delete cascade,
  -- Cible de la FK composite de post_metrics.
  unique (id, client_id),
  unique (social_account_id, external_post_id),
  check (media_product_type in ('FEED', 'REELS', 'STORY'))
);

create index imported_posts_client_published_idx
  on public.imported_posts (client_id, published_at desc);
create index imported_posts_org_id_idx on public.imported_posts (org_id);

-- ===========================================================================
-- 2. post_metrics — snapshot d'engagement (polymorphe target XOR importé)
-- ===========================================================================

create table public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  social_account_id uuid not null,
  platform public.platform not null,
  content_target_id uuid,
  imported_post_id uuid,
  -- Nullable (content_targets.external_post_id l'est en 006).
  external_post_id text,
  likes integer not null default 0,
  comments_count integer not null default 0,
  saves integer not null default 0,
  -- Nullable : un default 0 ferait plonger la moyenne d'un rapport (rateOf / reach).
  reach integer,
  engagement_total integer generated always as (likes + comments_count + saves) stored,
  raw jsonb not null default '{}'::jsonb,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (social_account_id, client_id)
    references public.social_accounts(id, client_id) on delete cascade,
  foreign key (content_target_id, client_id)
    references public.content_targets(id, client_id) on delete cascade,
  foreign key (imported_post_id, client_id)
    references public.imported_posts(id, client_id) on delete cascade,
  -- Exactement UNE des deux références.
  check ((content_target_id is not null) <> (imported_post_id is not null)),
  check (likes >= 0 and comments_count >= 0 and saves >= 0),
  check (reach is null or reach >= 0)
);

create unique index post_metrics_target_idx
  on public.post_metrics (content_target_id) where content_target_id is not null;
create unique index post_metrics_imported_idx
  on public.post_metrics (imported_post_id) where imported_post_id is not null;
create index post_metrics_client_engagement_idx
  on public.post_metrics (client_id, engagement_total desc);
create index post_metrics_client_reach_idx
  on public.post_metrics (client_id, reach desc nulls last);
create index post_metrics_org_id_idx on public.post_metrics (org_id);

-- ===========================================================================
-- 3. social_account_quota_usage — cache de consommation (PK composite)
--    Les LIMITES (100/30/5) vivent dans packages/shared, pas en base.
-- ===========================================================================

create table public.social_account_quota_usage (
  social_account_id uuid not null,
  quota_kind public.quota_kind not null,
  org_id uuid not null,
  client_id uuid not null,
  platform public.platform not null,
  used integer not null default 0,
  -- Informatif nullable (la limite autoritaire est dans packages/shared).
  quota_limit integer,
  window_seconds integer not null default 86400,
  window_resets_at timestamptz,
  source text not null default 'api',
  raw jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (social_account_id, quota_kind),
  foreign key (social_account_id, client_id)
    references public.social_accounts(id, client_id) on delete cascade,
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  check (used >= 0),
  check (quota_limit is null or quota_limit > 0),
  check (source in ('api', 'local'))
);

create index social_account_quota_usage_org_id_idx
  on public.social_account_quota_usage (org_id);

-- ===========================================================================
-- 4. ALTER social_accounts — avatar, following, état de synchro du feed
-- ===========================================================================

alter table public.social_accounts
  add column avatar_url text,
  add column following_count integer,
  add column feed_synced_at timestamptz,
  add column feed_sync_error text;

-- ===========================================================================
-- 5. updated_at
-- ===========================================================================

create trigger imported_posts_set_updated_at
before update on public.imported_posts
for each row execute function public.set_updated_at();

create trigger post_metrics_set_updated_at
before update on public.post_metrics
for each row execute function public.set_updated_at();

create trigger social_account_quota_usage_set_updated_at
before update on public.social_account_quota_usage
for each row execute function public.set_updated_at();

-- ===========================================================================
-- 6. RLS — org-only en LECTURE ; aucune écriture authenticated (service_role).
-- ===========================================================================

alter table public.imported_posts enable row level security;
alter table public.post_metrics enable row level security;
alter table public.social_account_quota_usage enable row level security;

create policy imported_posts_select on public.imported_posts
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy post_metrics_select on public.post_metrics
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy social_account_quota_usage_select on public.social_account_quota_usage
for select to authenticated
using ((select private.is_org_member(org_id)));

-- ===========================================================================
-- 7. Grants (revoke all GUARD-05 ; SELECT seul à authenticated — TRUNCATE
-- détruirait les métriques/quotas de tous les tenants, non soumis à la RLS).
-- ===========================================================================

revoke all on public.imported_posts from anon, authenticated;
revoke all on public.post_metrics from anon, authenticated;
revoke all on public.social_account_quota_usage from anon, authenticated;

grant select on public.imported_posts to authenticated;
grant select on public.post_metrics to authenticated;
grant select on public.social_account_quota_usage to authenticated;

grant select, insert, update, delete on public.imported_posts to service_role;
grant select, insert, update, delete on public.post_metrics to service_role;
grant select, insert, update, delete on public.social_account_quota_usage to service_role;
