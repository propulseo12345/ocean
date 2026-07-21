-- Migration 011 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
-- Genere depuis supabase/migrations/011_editorial_config.sql. Aucune ALTER TYPE
-- ADD VALUE ici : tout est encapsulable dans une transaction unique.

begin;

-- Migration 011 — Configuration éditoriale (Phase 1 du câblage).
--
-- Tables : content_pillars -> recurring_slots (dépend pillars) -> hashtag_groups,
-- brand_kits, client_events, saved_views, client_settings (décision D4).
-- ALTER content_items : pillar_id (FK composite, set null ciblé PG15),
-- first_comment, pinned, exclude_from_grid, platform_options, updated_by.
--
-- Décisions actées : D1 (text monolingue — aucun champ bilingue ici),
-- D4 (cadence/relance dans client_settings org-only, JAMAIS sur clients :
-- clients_select autorise is_client_member, le reviewer lirait les seuils
-- internes et le délai de relance qui le concerne).
--
-- Corrections vérificateurs intégrées (plan §2/§4) :
-- - color_token couvre chart-1..chart-5 (5 tokens de thème, MAX_PILLARS = 6) ;
-- - PAS de check lowercase sur banned_words (tag-input stocke la casse brute) ;
-- - PAS de check cardinality(palette) <= 12 (violable par 2 listes UI) ;
-- - recurring_slots.platforms : `<@` + cardinality >= 1 (array_length('{}')
--   vaut NULL et passerait un check >= 1 seul) ;
-- - PAS de unique(client_id, weekday, time_of_day) (le bouton « Ajouter » crée
--   mardi 11:30 en dur — déjà présent chez un client de démo) ;
-- - saved_views sans sort_order (spéculatif), label_ids/pillar_ids en uuid[]
--   (jamais des noms — un filtre par nom casse au changement de locale) ;
-- - FK pillar : `on delete set null (pillar_id)` — un SET NULL nu tenterait de
--   nuller client_id (not null) -> 23502 à la suppression d'un pilier.

-- ===========================================================================
-- 1. content_pillars — piliers éditoriaux (dimension d'analyse + filtre)
-- ===========================================================================

create table public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  name text not null,
  -- Token de thème ("chart-1".."chart-5"), JAMAIS "var(--chart-1)" ni une
  -- couleur littérale (règle 25). L'UI recompose var(--${color_token}).
  color_token text not null default 'chart-1',
  -- Part cible en %. Aucune contrainte de somme par client : l'édition pilier
  -- par pilier passe par des états intermédiaires ; la jauge UI (MixGauge)
  -- signale l'écart à 100, elle ne bloque pas.
  target_share smallint not null default 0,
  sort_order integer not null default 0,
  -- Suppression douce : les contenus passés gardent leur pilier, les parts
  -- historiques (performance, mix) restent stables.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  -- Cible OBLIGATOIRE des FK composites entrantes (content_items.pillar_id,
  -- recurring_slots.pillar_id) — sans elle, pas de protection cross-tenant.
  unique (id, client_id),
  check (length(trim(name)) > 0),
  check (color_token in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5')),
  check (target_share between 0 and 100)
);

create unique index content_pillars_client_name_idx
  on public.content_pillars (client_id, lower(name));
create index content_pillars_client_sort_idx
  on public.content_pillars (client_id, sort_order)
  where archived_at is null;
create index content_pillars_org_id_idx on public.content_pillars (org_id);

-- ===========================================================================
-- 2. recurring_slots — créneaux récurrents convenus avec le client
-- ===========================================================================

create table public.recurring_slots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  -- Jour ISO : 1 = lundi … 7 = dimanche (WEEKDAY_ORDER).
  weekday smallint not null,
  -- Heure MURALE du client, sans fuseau : le fuseau vit sur clients.timezone
  -- (nextSlotIso compose les deux).
  time_of_day time not null,
  platforms public.platform[] not null,
  -- Nullable : « aucun pilier » est un état légitime (NO_PILLar du slot-row).
  pillar_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  -- SET NULL ciblé (PG15) : ne nuller QUE pillar_id, jamais client_id.
  foreign key (pillar_id, client_id)
    references public.content_pillars(id, client_id) on delete set null (pillar_id),
  unique (id, client_id),
  check (weekday between 1 and 7),
  -- Créneaux = plateformes PUBLIABLES uniquement, et jamais vides. cardinality
  -- et non array_length : array_length('{}', 1) est NULL et passerait le check.
  check (
    platforms <@ array['instagram', 'facebook', 'tiktok']::public.platform[]
    and cardinality(platforms) >= 1
  )
);

create index recurring_slots_client_idx
  on public.recurring_slots (client_id, weekday, time_of_day);
create index recurring_slots_org_id_idx on public.recurring_slots (org_id);
create index recurring_slots_pillar_id_idx
  on public.recurring_slots (pillar_id)
  where pillar_id is not null;

-- ===========================================================================
-- 3. hashtag_groups — groupes de hashtags réutilisables (composer)
-- ===========================================================================

create table public.hashtag_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  name text not null,
  -- Plafond 30 = limite Instagram cumulée légende + premier commentaire.
  tags text[] not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  unique (id, client_id),
  check (length(trim(name)) > 0),
  check (cardinality(tags) between 1 and 30),
  check (array_position(tags, '') is null),
  check (array_position(tags, null) is null)
);

create unique index hashtag_groups_client_name_idx
  on public.hashtag_groups (client_id, lower(name));
create index hashtag_groups_client_sort_idx
  on public.hashtag_groups (client_id, sort_order);
create index hashtag_groups_org_id_idx on public.hashtag_groups (org_id);

-- ===========================================================================
-- 4. brand_kits — identité de marque (1-1 avec clients, PK = client_id)
-- ===========================================================================

create table public.brand_kits (
  client_id uuid primary key,
  org_id uuid not null,
  -- Valeurs oklch ORDONNÉES ; palette[1] = accent du rapport client.
  palette text[] not null default '{}',
  tone text,
  do_list text[] not null default '{}',
  dont_list text[] not null default '{}',
  -- Casse brute conservée (findBannedWords normalise à la détection).
  banned_words text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade
);

create index brand_kits_org_id_idx on public.brand_kits (org_id);

-- ===========================================================================
-- 5. client_events — notes/événements métier du calendrier éditorial
-- ===========================================================================

create table public.client_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  -- JOUR dans le fuseau du client — jamais timestamptz : l'UI ne fait que du
  -- bucketing par jour, un instant ferait glisser l'événement selon le fuseau.
  event_date date not null,
  title text not null,
  kind public.client_event_kind not null default 'note',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  unique (id, client_id),
  check (length(trim(title)) > 0)
);

create index client_events_client_date_idx
  on public.client_events (client_id, event_date);
create index client_events_org_id_idx on public.client_events (org_id);

-- ===========================================================================
-- 6. saved_views — vues filtrées du board studio (par client ET par user)
-- ===========================================================================

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  -- Une vue est une habitude de travail PERSONNELLE : un 2e admin de l'org
  -- n'hérite pas des chips d'un autre (policy owner_user_id = auth.uid()).
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  search text,
  statuses public.content_status[] not null default '{}',
  platforms public.platform[] not null default '{}',
  formats public.content_format[] not null default '{}',
  -- Des IDS, jamais des noms : un filtre par nom casse au changement de locale.
  -- uuid[] sans FK : un id orphelin après suppression ne matche juste rien.
  pillar_ids uuid[] not null default '{}',
  label_ids uuid[] not null default '{}',
  -- Remplace le hack board-state (match sur name.fr === 'À traiter').
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  unique (id, client_id),
  check (length(trim(name)) > 0)
);

create unique index saved_views_client_owner_name_idx
  on public.saved_views (client_id, owner_user_id, lower(name));
create unique index saved_views_client_owner_default_idx
  on public.saved_views (client_id, owner_user_id)
  where is_default;
create index saved_views_org_id_idx on public.saved_views (org_id);

-- ===========================================================================
-- 7. client_settings — cadence & relance (décision D4 : fille org-only)
--
-- Ces réglages NE vont PAS sur clients : clients_select autorise
-- is_client_member, le reviewer lirait les seuils de prod internes et le
-- délai de la relance automatique qui le vise.
-- ===========================================================================

create table public.client_settings (
  client_id uuid primary key,
  org_id uuid not null,
  -- Relance automatique du reviewer à J+N sans réponse (REMINDER_DELAY_BOUNDS).
  review_reminder_days smallint not null default 2,
  -- Alerter si aucun post planifié pendant N jours (GAP_BOUNDS).
  cadence_gap_days smallint not null default 7,
  -- Avertir au-delà de N posts le même jour (DENSITY_BOUNDS).
  cadence_max_per_day smallint not null default 2,
  -- Interrupteurs d'alerte par id ({"empty_week","gap","collision"}) — jsonb :
  -- un nouveau type d'alerte n'exige pas de migration.
  cadence_alerts jsonb not null
    default '{"empty_week": true, "gap": true, "collision": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  check (review_reminder_days between 1 and 7),
  check (cadence_gap_days between 2 and 21),
  check (cadence_max_per_day between 1 and 6)
);

create index client_settings_org_id_idx on public.client_settings (org_id);

-- ===========================================================================
-- 8. ALTER content_items — pilier + champs composer manquants
-- ===========================================================================

alter table public.content_items
  add column pillar_id uuid,
  add column first_comment text,
  add column pinned boolean not null default false,
  add column exclude_from_grid boolean not null default false,
  -- Options par plateforme (igLocation, fbLink…) — forme libre côté composer.
  add column platform_options jsonb not null default '{}'::jsonb,
  add column updated_by uuid references public.profiles(id) on delete set null;

alter table public.content_items
  add constraint content_items_pillar_fkey
    foreign key (pillar_id, client_id)
    references public.content_pillars(id, client_id) on delete set null (pillar_id);

create index content_items_client_pillar_idx
  on public.content_items (client_id, pillar_id)
  where pillar_id is not null;

-- ===========================================================================
-- 9. updated_at
-- ===========================================================================

create trigger content_pillars_set_updated_at
before update on public.content_pillars
for each row execute function public.set_updated_at();

create trigger recurring_slots_set_updated_at
before update on public.recurring_slots
for each row execute function public.set_updated_at();

create trigger hashtag_groups_set_updated_at
before update on public.hashtag_groups
for each row execute function public.set_updated_at();

create trigger brand_kits_set_updated_at
before update on public.brand_kits
for each row execute function public.set_updated_at();

create trigger client_events_set_updated_at
before update on public.client_events
for each row execute function public.set_updated_at();

create trigger saved_views_set_updated_at
before update on public.saved_views
for each row execute function public.set_updated_at();

create trigger client_settings_set_updated_at
before update on public.client_settings
for each row execute function public.set_updated_at();

-- ===========================================================================
-- 10. RLS — org-only sur les 7 tables (aucun consommateur portail, vérifié
-- par grep dans les audits ; défense en profondeur : ne rien ouvrir au
-- reviewer sans besoin avéré). saved_views ajoute owner_user_id = auth.uid().
-- ===========================================================================

alter table public.content_pillars enable row level security;
alter table public.recurring_slots enable row level security;
alter table public.hashtag_groups enable row level security;
alter table public.brand_kits enable row level security;
alter table public.client_events enable row level security;
alter table public.saved_views enable row level security;
alter table public.client_settings enable row level security;

create policy content_pillars_select on public.content_pillars
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy content_pillars_insert on public.content_pillars
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy content_pillars_update on public.content_pillars
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy content_pillars_delete on public.content_pillars
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy recurring_slots_select on public.recurring_slots
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy recurring_slots_insert on public.recurring_slots
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy recurring_slots_update on public.recurring_slots
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy recurring_slots_delete on public.recurring_slots
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy hashtag_groups_select on public.hashtag_groups
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy hashtag_groups_insert on public.hashtag_groups
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy hashtag_groups_update on public.hashtag_groups
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy hashtag_groups_delete on public.hashtag_groups
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy brand_kits_select on public.brand_kits
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy brand_kits_insert on public.brand_kits
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy brand_kits_update on public.brand_kits
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy brand_kits_delete on public.brand_kits
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy client_events_select on public.client_events
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy client_events_insert on public.client_events
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy client_events_update on public.client_events
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy client_events_delete on public.client_events
for delete to authenticated
using ((select private.is_org_member(org_id)));

-- saved_views : org member ET propriétaire — une vue ne se partage pas (encore).
create policy saved_views_select on public.saved_views
for select to authenticated
using (
  (select private.is_org_member(org_id))
  and owner_user_id = (select auth.uid())
);

create policy saved_views_insert on public.saved_views
for insert to authenticated
with check (
  (select private.is_org_member(org_id))
  and owner_user_id = (select auth.uid())
);

create policy saved_views_update on public.saved_views
for update to authenticated
using (
  (select private.is_org_member(org_id))
  and owner_user_id = (select auth.uid())
)
with check (
  (select private.is_org_member(org_id))
  and owner_user_id = (select auth.uid())
);

create policy saved_views_delete on public.saved_views
for delete to authenticated
using (
  (select private.is_org_member(org_id))
  and owner_user_id = (select auth.uid())
);

create policy client_settings_select on public.client_settings
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy client_settings_insert on public.client_settings
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy client_settings_update on public.client_settings
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy client_settings_delete on public.client_settings
for delete to authenticated
using ((select private.is_org_member(org_id)));

-- ===========================================================================
-- 11. Grants — revoke all d'abord : les ALTER DEFAULT PRIVILEGES Supabase
-- accordent TRUNCATE/REFERENCES/TRIGGER à authenticated, et TRUNCATE n'est
-- PAS soumis à la RLS (GUARD-05). On ne rend que le DML.
-- ===========================================================================

revoke all on public.content_pillars from anon, authenticated;
revoke all on public.recurring_slots from anon, authenticated;
revoke all on public.hashtag_groups from anon, authenticated;
revoke all on public.brand_kits from anon, authenticated;
revoke all on public.client_events from anon, authenticated;
revoke all on public.saved_views from anon, authenticated;
revoke all on public.client_settings from anon, authenticated;

grant select, insert, update, delete on public.content_pillars to authenticated;
grant select, insert, update, delete on public.recurring_slots to authenticated;
grant select, insert, update, delete on public.hashtag_groups to authenticated;
grant select, insert, update, delete on public.brand_kits to authenticated;
grant select, insert, update, delete on public.client_events to authenticated;
grant select, insert, update, delete on public.saved_views to authenticated;
grant select, insert, update, delete on public.client_settings to authenticated;

grant select, insert, update, delete on public.content_pillars to service_role;
grant select, insert, update, delete on public.recurring_slots to service_role;
grant select, insert, update, delete on public.hashtag_groups to service_role;
grant select, insert, update, delete on public.brand_kits to service_role;
grant select, insert, update, delete on public.client_events to service_role;
grant select, insert, update, delete on public.saved_views to service_role;
grant select, insert, update, delete on public.client_settings to service_role;

commit;
