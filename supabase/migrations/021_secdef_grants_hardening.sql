-- Migration 021 — Durcissement des grants SECURITY DEFINER (CORRECTIF SÉCURITÉ).
--
-- FAILLE constatée par get_advisors après 019/020 : les *default privileges*
-- Supabase accordent EXECUTE à anon/authenticated sur TOUTE fonction créée dans
-- public. Un `revoke ... from public` (19/20) NE retire PAS ces grants explicites
-- => anon pouvait appeler via PostgREST :
--   - store_integration_secret / update_integration_secret  → ÉCRITURE Vault (règle
--     12 : réservé worker/serveur). Un anonyme créait/écrasait des secrets.
--   - enqueue_publish_jobs / cancel_publish_jobs             → inoffensif (bloqué par
--     is_org_member) mais à fermer côté anon.
--
-- Le conteneur pgTAP local n'a pas ces default privileges : seul get_advisors sur
-- le vrai Supabase révèle la fuite (comme GUARD-05 pour les tables). Correctif =
-- revoke EXPLICITE depuis anon (+ authenticated pour les helpers Vault). Idempotent
-- (revoke d'un grant absent = no-op). Rejouable.

begin;

-- Helpers Vault : service_role UNIQUEMENT (aucun navigateur ne touche Vault).
revoke execute on function public.store_integration_secret(text, text) from anon, authenticated;
revoke execute on function public.update_integration_secret(uuid, text) from anon, authenticated;

-- File de publication : l'app (authenticated, protégée par is_org_member) enfile ;
-- anon jamais.
revoke execute on function public.enqueue_publish_jobs(uuid) from anon;
revoke execute on function public.cancel_publish_jobs(uuid) from anon;

commit;
