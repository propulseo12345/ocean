-- Migration 033 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 012 + 022.
-- Genere depuis supabase/migrations/033_reviewer_media_read.sql.
--
-- OBJET : le Reviewer ne pouvait pas obtenir d'URL signee sur media-originals.
-- Toutes les policies du bucket sont gardees par `can_write_client_media`, dont
-- la premiere condition est `is_org_member` — et un Reviewer n'est PAS membre de
-- l'org (regle 6). Il validait donc sur la vignette de 400 px.
--
-- ⚠ CE FICHIER TOUCHE storage.objects (la policy SELECT de media-originals).
-- Le DDL storage est isole en fin de fichier, garde par un `if exists` / un
-- `to_regclass`. INSERT et UPDATE ne changent PAS : un Reviewer ne depose ni ne
-- modifie jamais rien.
--
-- Idempotent (create or replace + drop/create de la policy). Rejouable.
--
-- Apres application : get_advisors. Attendu : aucun nouveau lint — les 2
-- fonctions ajoutees sont dans le schema `private`, non expose.

-- ===========================================================================
-- 1. Cast défensif d'un segment de chemin
--    `(storage.foldername(name))[4]::uuid` lève si le segment existe mais n'est
--    pas un uuid. Un objet au chemin inattendu ferait alors échouer l'ÉVALUATION
--    de la policy — donc une erreur, pas un refus propre.
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

create or replace function private.can_read_client_media(
  _org uuid,
  _client uuid,
  _media uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Voie agence : strictement le prédicat d'écriture, inchangé.
  select (select private.can_write_client_media(_org, _client))
    -- Voie reviewer : miroir exact de la policy media_assets_select (012:312).
    -- `is_client_member` seul ne suffirait pas — il ouvrirait TOUS les médias du
    -- client, y compris ceux d'un contenu que ce reviewer n'a pas à voir.
    or (
      _media is not null
      and (select private.is_client_member(_client))
      and (select private.is_reviewer_visible_media(_media))
    );
$$;

revoke all on function private.can_read_client_media(uuid, uuid, uuid) from public;
grant execute on function private.can_read_client_media(uuid, uuid, uuid)
  to authenticated, service_role;

comment on function private.can_read_client_media(uuid, uuid, uuid) is
  'Droit de LECTURE d un media : membre de l org, OU membre du client ET media visible par ce reviewer (miroir de media_assets_select). Distinct du droit d ecriture.';

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
            private.safe_uuid((storage.foldername(name))[4])))
    );
  end if;
end
$$;
