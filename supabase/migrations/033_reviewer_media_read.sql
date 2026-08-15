-- Migration 033 — Le Reviewer peut enfin voir le média qu'il valide (P5-10).
--
-- LE DÉFAUT
-- ---------
-- Les policies de `storage.objects` sur `media-originals` sont toutes gardées
-- par `private.can_write_client_media`, dont la première condition est
-- `is_org_member` (012:185). Un Reviewer n'est PAS membre de l'org — il ne
-- possède qu'une ligne `client_members`, c'est même toute la construction de la
-- règle 6. Il ne passe donc pas la policy SELECT, `createSignedUrls` ne lui rend
-- aucune URL, et `fullUrl` retombe en silence sur la vignette.
--
-- Conséquence concrète : **le client valide sur une image de 400 px de large**.
-- Il approuve une publication dont il ne peut pas lire le texte incrusté, ni
-- juger le cadrage, ni voir un défaut. C'est le geste central du produit.
--
-- LA CORRECTION
-- -------------
-- Le défaut de fond est qu'un SEUL prédicat servait à autoriser la LECTURE et
-- l'ÉCRITURE. Ce sont deux questions différentes :
--
--   * écrire  → membre de l'org, et le client appartient à cette org ;
--   * lire    → ça, OU être membre du client ET que ce média précis fasse
--               partie de ce que ce reviewer a le droit de voir.
--
-- La seconde branche n'est pas inventée ici : c'est **exactement** le prédicat
-- que la policy `media_assets_select` (012:312) applique déjà au niveau table.
-- Storage était simplement plus restrictif que la table qu'il illustre, ce qui
-- est l'incohérence qu'on corrige.
--
-- Seule la policy SELECT de `media-originals` change. INSERT et UPDATE gardent
-- `can_write_client_media` : un Reviewer ne dépose ni ne modifie jamais rien.

-- ===========================================================================
-- 1. Cast défensif d'un segment de chemin
--    `(storage.foldername(name))[1]::uuid` lève si le segment existe mais n'est
--    pas un uuid. Un objet rangé hors convention ferait alors échouer
--    l'ÉVALUATION de la policy — donc une erreur, pas un refus propre.
-- ===========================================================================

create or replace function private.safe_uuid(_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return _value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function private.safe_uuid(text) from public;
grant execute on function private.safe_uuid(text) to authenticated, service_role;

comment on function private.safe_uuid(text) is
  'Cast text -> uuid qui rend null au lieu de lever. Utilise sur les segments de chemin storage, ou un objet mal range ne doit pas casser l evaluation d une policy.';

-- ===========================================================================
-- 2. Droit de LECTURE d'un média — distinct du droit d'écriture
-- ===========================================================================

-- L'ancienne signature (uuid, uuid, uuid) dérivait le média d'un segment de
-- chemin. `create or replace` créerait une SURCHARGE au lieu de la remplacer, et
-- la policy resterait ambiguë : on la retire explicitement.
drop function if exists private.can_read_client_media(uuid, uuid, uuid);

create or replace function private.can_read_client_media(
  _org uuid,
  _client uuid,
  _object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Voie agence : strictement le prédicat d'écriture, inchangé. Les deux
  -- premiers segments du chemin portent l'isolation de tenant.
  select (select private.can_write_client_media(_org, _client))
    -- Voie reviewer. On ne DEVINE pas l'asset depuis un segment de chemin : le
    -- media_asset_id est généré par l'INSERT, donc le navigateur ne peut pas le
    -- connaître au moment où il téléverse — un chemin qui le contiendrait serait
    -- un vœu pieux. On RÉSOUT donc l'objet par la table, via
    -- `media_assets_storage_path_idx` qui est UNIQUE (012:65) : un objet, un
    -- asset, une sonde d'index.
    --
    -- La condition qui suit est le miroir exact de `media_assets_select`
    -- (012:312). `is_client_member` seul ouvrirait TOUS les médias du client,
    -- brouillons internes compris.
    or exists (
      select 1
      from public.media_assets ma
      where ma.storage_path = _object_name
        and (select private.is_client_member(ma.client_id))
        and (select private.is_reviewer_visible_media(ma.id))
    );
$$;

revoke all on function private.can_read_client_media(uuid, uuid, text) from public;
grant execute on function private.can_read_client_media(uuid, uuid, text)
  to authenticated, service_role;

comment on function private.can_read_client_media(uuid, uuid, text) is
  'Droit de LECTURE d un media : membre de l org, OU membre du client ET media visible par ce reviewer (resolu par storage_path, index unique). Distinct du droit d ecriture.';

-- ===========================================================================
-- 3. La policy SELECT de media-originals
--    ⚠ Ce bloc touche storage.objects : il n'est rejouable que sur un projet
--    dont le schéma storage est à jour. Le runner pgTAP local saute les
--    fichiers *_storage.sql pour cette raison ; ici on garde le DDL storage
--    isolé en fin de fichier et gardé par un `if exists`.
-- ===========================================================================

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'media_originals_select'
  ) then
    drop policy media_originals_select on storage.objects;
  end if;

  if to_regclass('storage.objects') is not null then
    create policy media_originals_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'media-originals'
      and (select private.can_read_client_media(
            private.safe_uuid((storage.foldername(name))[1]),
            private.safe_uuid((storage.foldername(name))[2]),
            name))
    );
  end if;
end
$$;
