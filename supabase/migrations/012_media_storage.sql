-- Migration 012 (partie Storage) — buckets + policies storage.objects.
--
-- ⚠️ APPLIQUÉE EN LIGNE UNIQUEMENT. Le conteneur pgTAP local a un schéma
-- storage ancien (storage.buckets sans les colonnes public/file_size_limit/
-- allowed_mime_types) ; le runner run-pgtap.sh saute les fichiers *_storage.sql.
--
-- ⚠️ DÉCISIONS À RECONFIRMER PAR ÉTIENNE avant application :
--   D2 — chemin Storage SANS segment content_item_id (contredit la règle 21 du
--        CLAUDE.md). Motif : un asset de médiathèque n'a pas de content_item_id
--        à l'upload et en a N ensuite ; recopier le fichier à chaque attachement
--        casserait la dédup et les URLs de vignettes déjà servies. Les 2 premiers
--        segments (org_id, client_id) restent le mécanisme d'isolation exigé.
--        Chemins : media-originals = {org}/{client}/{media_asset_id}/original.{ext}
--                  media-thumbs    = {org}/{client}/{media_asset_id}/thumb.webp
--   D3 — media-thumbs PUBLIC (vignette d'un contenu non publié lisible par qui
--        obtient l'URL — 3 UUID non énumérables, permanente). Acté PRD L409.
--        Alternative : thumbs privé + URL signée 15 min, au prix du cache CDN.
--
-- Le portail reviewer NE reçoit AUCUNE policy directe sur media-originals : le
-- Server Component lit content_media sous RLS puis génère des URL signées 1h
-- (la RLS de la table autorise, l'URL signée ne fait que le transport).

-- ===========================================================================
-- 1. Buckets
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'media-originals', 'media-originals', false,
    314572800, -- 300 Mo (REEL_MAX_MB de lib/specs.ts)
    array['image/jpeg', 'image/png', 'image/heic', 'video/mp4', 'video/quicktime']
  ),
  (
    'media-thumbs', 'media-thumbs', true,
    1048576, -- 1 Mo
    array['image/webp']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ===========================================================================
-- 2. Policies storage.objects
--
-- can_write_client_media([1]=org, [2]=client) couple les DEUX segments : un
-- membre de l'org A ne peut PAS écrire dans {orgA}/{clientDeOrgB}/ (le simple
-- is_org_member((foldername)[1]) ne le garantirait pas).
-- ===========================================================================

-- ---- media-originals (privé) : org members uniquement, pas de DELETE (purge
--      via Edge Function service_role — règle 23, aucun DELETE SQL applicatif).
create policy media_originals_select on storage.objects
for select to authenticated
using (
  bucket_id = 'media-originals'
  and (select private.can_write_client_media(
        (storage.foldername(name))[1]::uuid,
        (storage.foldername(name))[2]::uuid))
);

create policy media_originals_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'media-originals'
  and (select private.can_write_client_media(
        (storage.foldername(name))[1]::uuid,
        (storage.foldername(name))[2]::uuid))
);

create policy media_originals_update on storage.objects
for update to authenticated
using (
  bucket_id = 'media-originals'
  and (select private.can_write_client_media(
        (storage.foldername(name))[1]::uuid,
        (storage.foldername(name))[2]::uuid))
)
with check (
  bucket_id = 'media-originals'
  and (select private.can_write_client_media(
        (storage.foldername(name))[1]::uuid,
        (storage.foldername(name))[2]::uuid))
);

-- ---- media-thumbs (public) : lecture publique (bucket public), écriture org
--      members (vignettes générées côté client et uploadées).
create policy media_thumbs_select_public on storage.objects
for select to anon, authenticated
using (bucket_id = 'media-thumbs');

create policy media_thumbs_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'media-thumbs'
  and (select private.can_write_client_media(
        (storage.foldername(name))[1]::uuid,
        (storage.foldername(name))[2]::uuid))
);

create policy media_thumbs_update on storage.objects
for update to authenticated
using (
  bucket_id = 'media-thumbs'
  and (select private.can_write_client_media(
        (storage.foldername(name))[1]::uuid,
        (storage.foldername(name))[2]::uuid))
)
with check (
  bucket_id = 'media-thumbs'
  and (select private.can_write_client_media(
        (storage.foldername(name))[1]::uuid,
        (storage.foldername(name))[2]::uuid))
);
