-- Migration 012 — Médias & médiathèque (Phase 2 du câblage). Tables, helpers,
-- trigger de cardinalité. La configuration Storage (buckets + policies
-- storage.objects) vit dans 012_media_storage.sql — appliquée EN LIGNE
-- uniquement (le conteneur pgTAP a un schéma storage ancien incompatible).
--
-- Modèle retenu (audit médias) : media_assets = pool UNIQUE fille de CLIENT
-- (upload / dépôt / import) ; content_media = liaison N-N porteuse de la
-- position du carrousel. Le PRD §6 modélise media_assets comme fille de
-- content_items : incompatible avec la médiathèque livrée (un asset sert N
-- contenus, un asset « inédit » existe sans contenu). La position quitte
-- media_assets pour la liaison.
--
-- Décisions actées : D1 (alt_text text mono-langue). D11 (cover on delete
-- restrict — un asset servant de cover de Reel n'est pas supprimable comme
-- « inédit »). Colonnes spéculatives retirées (plan §2) : checksum,
-- derived_from_id, variant (applyCrop est un mock mémoire pur),
-- rendered_media_asset_id (le fichier publié est produit à la publication).
-- deposit_link_id + FK : différés à la migration 016 (média_deposit_links, P2).

-- ===========================================================================
-- 1. media_assets — LE pool de fichiers, fille de client
-- ===========================================================================

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  type public.media_type not null,
  -- Chemin dans media-originals (privé). NULL après purge J+7 : l'asset survit,
  -- le fichier non. NULL aussi pour un import feed sans original stocké.
  storage_path text,
  -- Chemin dans media-thumbs (public). NULLABLE : import/dépôt sans vignette.
  thumb_path text,
  -- NULLABLE : un import feed IG ne fournit ni dimensions, ni MIME, ni poids.
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  -- Vidéo uniquement (l'UI dérive m:ss ; les specs raisonnent en secondes).
  duration_ms integer,
  file_name text,
  -- Mono-langue (comme content_items.title/caption en 006) ; le L<string> du
  -- mock est un artefact i18n de la preview.
  alt_text text,
  source public.media_source not null default 'upload',
  uploaded_by uuid references public.profiles(id) on delete set null,
  -- Purge J+7 post-publication (rétention PRD) : bloque retry/duplication.
  original_deleted_at timestamptz,
  -- Purge 180j d'inactivité pour les contenus jamais publiés.
  expires_at timestamptz,
  -- Soft delete : l'UI supprime des assets utilisés dans des contenus PUBLIÉS ;
  -- un DELETE dur casserait l'historique.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  -- Cible des FK composites de content_media et content_items.cover_media_asset_id.
  unique (id, client_id),
  check (type = 'video' or duration_ms is null),
  check (width is null or width > 0),
  check (height is null or height > 0),
  check (byte_size is null or byte_size > 0)
);

create unique index media_assets_storage_path_idx
  on public.media_assets (storage_path)
  where storage_path is not null;
create index media_assets_client_created_idx
  on public.media_assets (client_id, created_at desc);
create index media_assets_client_type_idx on public.media_assets (client_id, type);
create index media_assets_org_id_idx on public.media_assets (org_id);

-- ===========================================================================
-- 2. content_media — liaison N-N, porteuse de la position du carrousel
-- ===========================================================================

create table public.content_media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  content_item_id uuid not null,
  media_asset_id uuid not null,
  -- 0-based ; position 0 = couverture du carrousel.
  position integer not null,
  -- Alt édité PAR CONTENU (initialisé depuis media_assets.alt_text).
  alt_text_override text,
  -- '1:1'|'4:5'|'9:16' (CropPreset) ; NULL = pas de recadrage.
  crop_preset text,
  created_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade,
  foreign key (content_item_id, client_id)
    references public.content_items(id, client_id) on delete cascade,
  -- restrict : on ne supprime pas un asset encore rattaché (garde-fou
  -- DeleteAssetDialog côté DB). NB : cross-child d'un même parent cascade — la
  -- suppression d'un client reste possible (cf. leak test cascade).
  foreign key (media_asset_id, client_id)
    references public.media_assets(id, client_id) on delete restrict,
  -- Cible d'annotation stable (le pin du portail ancre sur cet id, pas la slide).
  unique (id, client_id),
  check (position >= 0),
  check (crop_preset is null or crop_preset in ('1:1', '4:5', '9:16'))
);

-- deferrable : un réordonnancement drag&drop réécrit les positions en une
-- transaction et violerait un unique immédiat. Contrainte (pas index) pour
-- pouvoir la déclarer deferrable.
alter table public.content_media
  add constraint content_media_item_position_key
    unique (content_item_id, position) deferrable initially deferred;

-- PAS de unique(content_item_id, media_asset_id) : le même asset peut
-- légitimement apparaître 2× dans un carrousel (handleAdd concatène sans dédup).
-- (La contrainte unique deferrable ci-dessus indexe déjà (content_item_id,
-- position) — pas d'index explicite redondant.)
create index content_media_asset_idx on public.content_media (media_asset_id);
create index content_media_org_id_idx on public.content_media (org_id);

-- ===========================================================================
-- 3. ALTER content_items — couverture dédiée de Reel
-- ===========================================================================

alter table public.content_items
  -- Couverture dédiée (un vrai fichier → un media_asset). D11 : restrict, pour
  -- qu'un asset servant UNIQUEMENT de cover ne soit pas supprimé comme inédit.
  add column cover_media_asset_id uuid,
  -- OU une frame extraite à la seconde N (aucun fichier ; extraction à la
  -- publication). Exclusion mutuelle avec cover_media_asset_id.
  add column cover_frame_ms integer;

alter table public.content_items
  add constraint content_items_cover_fkey
    foreign key (cover_media_asset_id, client_id)
    references public.media_assets(id, client_id) on delete restrict;

alter table public.content_items
  add constraint content_items_cover_exclusive
    check (cover_media_asset_id is null or cover_frame_ms is null);

create index content_items_cover_asset_idx
  on public.content_items (cover_media_asset_id)
  where cover_media_asset_id is not null;

-- ===========================================================================
-- 4. Helpers de visibilité / d'écriture
-- ===========================================================================

-- Visibilité d'un média pour un reviewer : rattaché à ≥1 contenu visible
-- reviewer, OU dépôt propre du reviewer. Modèle exact de is_reviewer_visible_content.
create or replace function private.is_reviewer_visible_media(_media uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.content_media cm
    where cm.media_asset_id = _media
      and (select private.is_reviewer_visible_content(cm.content_item_id))
  )
  or exists (
    select 1
    from public.media_assets ma
    where ma.id = _media
      and ma.source = 'depot_client'
      and ma.uploaded_by = (select auth.uid())
  );
$$;

revoke all on function private.is_reviewer_visible_media(uuid) from public;
grant execute on function private.is_reviewer_visible_media(uuid) to authenticated, service_role;

-- Droit d'écriture d'un média pour un client : membre de l'org ET le client
-- appartient bien à cette org (utilisé par les policies storage.objects avec
-- les segments [1]=org et [2]=client — un membre de org A ne peut pas écrire
-- dans {orgA}/{clientDeOrgB}/).
create or replace function private.can_write_client_media(_org uuid, _client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_org_member(_org))
    and exists (
      select 1 from public.clients c
      where c.id = _client and c.org_id = _org
    );
$$;

revoke all on function private.can_write_client_media(uuid, uuid) from public;
grant execute on function private.can_write_client_media(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- 5. Trigger de cardinalité des médias (enforcement DB, jamais UI-only)
--
-- Immédiat AFTER INSERT/UPDATE (jamais sur DELETE) : une suppression ne peut
-- pas faire DÉPASSER un plafond, et le pattern composer est delete-puis-insert
-- (l'état intermédiaire a MOINS de lignes, jamais plus) — donc aucun échec
-- spurious au réordonnancement, et le trigger reste testable (un constraint
-- trigger deferred ne se déclenche qu'au commit, invisible à throws_ok).
--   post/story = 1 média max ; reel = 1 média ET 1er média vidéo ;
--   carousel ≤ 10 slides (limite API Meta).
-- L'unicité (content_item_id, position), elle, RESTE deferrable (swap de
-- positions dans une tx).
-- ===========================================================================

create or replace function private.enforce_content_media_cardinality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.content_item_id, old.content_item_id);
  v_format public.content_format;
  v_count integer;
  v_first_is_video boolean;
begin
  select format into v_format from public.content_items where id = v_item;
  if v_format is null then
    return null; -- content_item supprimé (cascade) : plus rien à vérifier
  end if;

  select count(*) into v_count from public.content_media where content_item_id = v_item;
  if v_count = 0 then
    return null;
  end if;

  if v_format in ('post', 'story') and v_count > 1 then
    raise exception 'un % accepte un seul média (reçu %)', v_format, v_count
      using errcode = '23514';
  end if;

  if v_format = 'reel' then
    if v_count > 1 then
      raise exception 'un reel accepte un seul média (reçu %)', v_count
        using errcode = '23514';
    end if;
    select ma.type = 'video'
      into v_first_is_video
      from public.content_media cm
      join public.media_assets ma on ma.id = cm.media_asset_id
      where cm.content_item_id = v_item
      order by cm.position
      limit 1;
    if not coalesce(v_first_is_video, false) then
      raise exception 'un reel exige un média vidéo'
        using errcode = '23514';
    end if;
  end if;

  if v_format = 'carousel' and v_count > 10 then
    raise exception 'un carrousel accepte au plus 10 slides (reçu %)', v_count
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create trigger content_media_cardinality
after insert or update on public.content_media
for each row execute function private.enforce_content_media_cardinality();

-- RPC de réordonnancement : pose position = rang dans _ordered_media_ids, en UNE
-- transaction (la contrainte unique(content_item_id, position) est deferrable,
-- les collisions transitoires sont donc tolérées). SECURITY INVOKER : la RLS de
-- content_media autorise (org member uniquement). Le client JS ne peut pas faire
-- de delete+insert atomique — d'où cette RPC.
create or replace function public.reorder_content_media(
  _content_item uuid,
  _ordered_media_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.content_media cm
  set position = ord.rn - 1
  from (
    select id, row_number() over () as rn
    from unnest(_ordered_media_ids) with ordinality as t(id, rn)
  ) ord
  where cm.id = ord.id
    and cm.content_item_id = _content_item;
end;
$$;

revoke all on function public.reorder_content_media(uuid, uuid[]) from public;
grant execute on function public.reorder_content_media(uuid, uuid[]) to authenticated, service_role;

-- ===========================================================================
-- 6. updated_at
-- ===========================================================================

create trigger media_assets_set_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

-- ===========================================================================
-- 7. RLS — reviewer voit UNIQUEMENT via le prédicat de visibilité (jamais
-- is_client_member nu : sinon la médiathèque entière du client fuit).
-- ===========================================================================

alter table public.media_assets enable row level security;
alter table public.content_media enable row level security;

create policy media_assets_select on public.media_assets
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (
    (select private.is_client_member(client_id))
    and (select private.is_reviewer_visible_media(id))
  )
);

create policy media_assets_insert on public.media_assets
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy media_assets_update on public.media_assets
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy media_assets_delete on public.media_assets
for delete to authenticated
using ((select private.is_org_member(org_id)));

create policy content_media_select on public.content_media
for select to authenticated
using (
  (select private.is_org_member(org_id))
  or (
    (select private.is_client_member(client_id))
    and (select private.is_reviewer_visible_content(content_item_id))
  )
);

create policy content_media_insert on public.content_media
for insert to authenticated
with check ((select private.is_org_member(org_id)));

create policy content_media_update on public.content_media
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy content_media_delete on public.content_media
for delete to authenticated
using ((select private.is_org_member(org_id)));

-- ===========================================================================
-- 8. Grants (revoke all d'abord — GUARD-05)
-- ===========================================================================

revoke all on public.media_assets from anon, authenticated;
revoke all on public.content_media from anon, authenticated;

grant select, insert, update, delete on public.media_assets to authenticated;
grant select, insert, update, delete on public.content_media to authenticated;
grant select, insert, update, delete on public.media_assets to service_role;
grant select, insert, update, delete on public.content_media to service_role;
