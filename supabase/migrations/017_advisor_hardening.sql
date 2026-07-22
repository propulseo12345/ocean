-- Migration 017 — Durcissement suite à get_advisors (2026-07-22).
--
-- Aucun DDL de table. Trois axes, tous issus des WARN de l'advisor sécurité :
--
--   1. `set_updated_at` : search_path figé (lint 0011 function_search_path_mutable).
--      La fonction ne touche que NEW.updated_at = now() ; now() vit dans pg_catalog
--      (toujours implicitement dans le search_path), donc `set search_path = ''`
--      est sans effet fonctionnel et supprime le vecteur de détournement.
--
--   2. Exécution REST des RPC SECURITY DEFINER (lints 0028 anon / 0029 authenticated).
--      - `handle_new_user` (trigger) et `emit_notification` (helper appelé UNIQUEMENT
--        par d'autres fonctions SECURITY DEFINER) ne sont JAMAIS appelées via
--        `supabase.rpc(...)` par l'app (vérifié) : accès anon ET authenticated retiré.
--        Le trigger n'a pas besoin du privilège EXECUTE ; les appels internes
--        s'exécutent sous le propriétaire (postgres). service_role conservé pour
--        le worker à venir (émission de notifications côté serveur).
--      - Les RPC réellement appelées par des utilisateurs connectés
--        (create_organization, submit_review_decision, mark_target_published_manually,
--        request_target_retry, touch_client_member_seen, mark_notification_read,
--        mark_all_notifications_read) : `anon` retiré, `authenticated` conservé.
--
--   3. Bucket public `media-thumbs` (lint 0025 public_bucket_allows_listing).
--      L'accès par URL publique ne passe PAS par une policy SELECT sur
--      storage.objects ; la policy large permettait de LISTER toutes les vignettes
--      (contenu client non publié inclus). L'app lit les vignettes via getPublicUrl
--      (aucun `.list()`), donc on retire la policy sans rien casser.
--
-- Les 3 tables `*_secrets` en `rls_enabled_no_policy` (INFO) sont VOULUES (deny-all,
-- règle 11) : rien à corriger là-dessus.
-- Reste hors SQL : activer « Leaked Password Protection » (Auth > dashboard).

alter function public.set_updated_at() set search_path = '';

-- 2a. Fonctions purement internes : accès REST totalement retiré.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.emit_notification(uuid, uuid, uuid, public.notification_type, text, text, public.notification_audience, text, public.notification_channel[], jsonb) from public, anon, authenticated;
grant execute on function public.emit_notification(uuid, uuid, uuid, public.notification_type, text, text, public.notification_audience, text, public.notification_channel[], jsonb) to service_role;

-- 2b. RPC utilisateurs connectés : anon retiré, authenticated conservé.
revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

revoke execute on function public.submit_review_decision(uuid, public.approval_decision, text) from public, anon;
grant execute on function public.submit_review_decision(uuid, public.approval_decision, text) to authenticated;

revoke execute on function public.mark_target_published_manually(uuid, text, text) from public, anon;
grant execute on function public.mark_target_published_manually(uuid, text, text) to authenticated;

revoke execute on function public.request_target_retry(uuid) from public, anon;
grant execute on function public.request_target_retry(uuid) to authenticated;

revoke execute on function public.touch_client_member_seen(uuid) from public, anon;
grant execute on function public.touch_client_member_seen(uuid) to authenticated;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- 3. Retrait de la policy de listing du bucket public media-thumbs.
drop policy if exists media_thumbs_select_public on storage.objects;
