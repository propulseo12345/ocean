-- Migration 033 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 012 + 022.
-- Genere depuis supabase/migrations/033_reviewer_media_read.sql.
--
-- OBJET : le Reviewer ne pouvait pas obtenir d'URL signee sur media-originals.
-- Toutes les policies du bucket sont gardees par `can_write_client_media`, dont
-- la premiere condition est `is_org_member` — et un Reviewer n'est PAS membre de
-- l'org (regle 6). Il validait donc sur la vignette de 400 px.
--
-- La voie reviewer NE DEVINE PAS l'asset depuis un segment de chemin : le
-- media_asset_id est genere par l'INSERT, donc le navigateur ne peut pas le
-- connaitre au moment ou il televerse. On resout l'objet par
-- `media_assets.storage_path`, qui porte un index UNIQUE (012:65).
--
-- ⚠ CE FICHIER TOUCHE storage.objects (la policy SELECT de media-originals).
-- Le DDL storage est isole en fin de fichier, garde par un `if exists` / un
-- `to_regclass`. INSERT et UPDATE ne changent PAS : un Reviewer ne depose ni ne
-- modifie jamais rien.
--
-- Idempotent (drop function + create or replace + drop/create de la policy).
--
-- Apres application : get_advisors. Attendu : aucun nouveau lint — les 2
-- fonctions ajoutees sont dans le schema `private`, non expose.

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
