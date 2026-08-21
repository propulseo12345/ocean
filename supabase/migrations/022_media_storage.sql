-- Migration 022 (partie Storage de 012) — buckets + policies storage.objects.
--
-- ⚠️ RENUMÉROTÉE 012 -> 022 (ticket P0-2). Deux fichiers partageaient le préfixe
-- `012` : le CLI Supabase dérive la version des chiffres de tête et l'insère en
-- clé primaire de supabase_migrations.schema_migrations, donc `supabase start`
-- mourait sur `duplicate key ... Key (version)=(012)`. Le job `db` de la CI n'a
-- jamais tourné une seule fois à cause de ça (7 runs, 7 échecs).
--
-- ⚠️ CONSÉQUENCE DE LA RENUMÉROTATION : ce fichier s'applique désormais APRÈS la
-- migration 017, qui supprime volontairement la policy `media_thumbs_select_public`
-- (advisor 0025 public_bucket_allows_listing : elle permettait de LISTER toutes les
-- vignettes, contenu client non publié inclus). La recréer ici annulerait ce
-- durcissement à chaque rejeu depuis zéro — elle a donc été retirée de ce fichier
-- (section 2, ex-`media_thumbs_select_public`). L'état final d'un `db reset` est
-- identique à l'état réellement appliqué en ligne. La lecture publique des
-- vignettes ne passe PAS par une policy SELECT : le bucket est public et l'app
-- utilise getPublicUrl (aucun `.list()`).
--
-- ⚠️ Le conteneur pgTAP local a un schéma storage ancien (storage.buckets sans les
-- colonnes public/file_size_limit/allowed_mime_types) ; le runner run-pgtap.sh
-- saute les fichiers *_storage.sql (le suffixe est préservé par le renommage).
-- Le stack local du CLI Supabase, lui, l'applique : c'est le job `db` de la CI qui
-- est le seul endroit où ces policies peuvent être testées.
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

-- ---- media-thumbs (public) : lecture publique par URL (getPublicUrl, sans policy
--      SELECT — cf. en-tête et migration 017), écriture org members (vignettes
--      générées côté client et uploadées).
--
--      PAS de policy SELECT ici : `media_thumbs_select_public` a été créée par la
--      version 012 de ce fichier puis supprimée par la migration 017 (advisor 0025).
--      Ce fichier s'appliquant maintenant après 017, la recréer ferait resurgir la
--      fuite de listing à chaque `db reset`. Ne pas la rajouter.

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
