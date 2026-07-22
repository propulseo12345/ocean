-- Migration 017 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
-- Genere depuis supabase/migrations/017_advisor_hardening.sql. Prerequis : 010-016.
--
-- Durcissement suite a get_advisors (2026-07-22). Aucun DDL de table, rejouable :
--   - search_path fige sur set_updated_at (lint 0011)
--   - acces REST des RPC SECURITY DEFINER verrouille (lints 0028/0029) :
--     handle_new_user + emit_notification = internes (anon+authenticated retires,
--     service_role conserve pour emit) ; les autres = anon retire, authenticated garde
--   - policy de listing du bucket public media-thumbs retiree (lint 0025)
--
-- NB : les 3 *_secrets en rls_enabled_no_policy (INFO) sont VOULUES (deny-all).
-- A faire hors SQL : activer Leaked Password Protection dans Auth (dashboard).

begin;

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.emit_notification(uuid, uuid, uuid, public.notification_type, text, text, public.notification_audience, text, public.notification_channel[], jsonb) from public, anon, authenticated;
grant execute on function public.emit_notification(uuid, uuid, uuid, public.notification_type, text, text, public.notification_audience, text, public.notification_channel[], jsonb) to service_role;

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

drop policy if exists media_thumbs_select_public on storage.objects;

commit;
