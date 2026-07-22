-- Migration 021 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). URGENT (sécurité).
-- Genere depuis supabase/migrations/021_secdef_grants_hardening.sql. Prerequis : 019 + 020.
--
-- CORRECTIF get_advisors : ferme l'acces anon/authenticated aux fonctions
-- SECURITY DEFINER de 019/020. Les default privileges Supabase accordent EXECUTE a
-- anon/authenticated sur toute fonction de public ; `revoke from public` (19/20) ne
-- les retire pas. Ici on revoke EXPLICITEMENT depuis anon (+ authenticated pour les
-- helpers Vault, reserves au worker/serveur — regle 12).
--
-- Idempotent (revoke d'un grant absent = no-op). Rejouable sans risque.
--
-- Apres application : get_advisors. Attendu -> il ne reste QUE 2 warnings nouveaux
-- (0029 authenticated) sur enqueue_publish_jobs / cancel_publish_jobs (VOULUS,
-- proteges par is_org_member). store/update_integration_secret ne doivent PLUS
-- apparaitre (service_role only).

begin;

revoke execute on function public.store_integration_secret(text, text) from anon, authenticated;
revoke execute on function public.update_integration_secret(uuid, text) from anon, authenticated;
revoke execute on function public.enqueue_publish_jobs(uuid) from anon;
revoke execute on function public.cancel_publish_jobs(uuid) from anon;

commit;
