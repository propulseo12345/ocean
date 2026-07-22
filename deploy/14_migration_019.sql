-- Migration 019 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
-- Genere depuis supabase/migrations/019_integration_secrets.sql. Prerequis : 010-018.
--
-- Helpers Vault pour les secrets d'integration OAuth (regle 12 : aucun token en
-- clair en base). persistConnection (web, service_role) chiffre chaque token via
-- Vault et ne stocke que l'uuid du secret dans les tables *_secrets (deny-all).
--
-- PREREQUIS : l'extension supabase_vault doit etre active (Database > Extensions).
-- Verifie en ligne le 2026-07-22 : vault.create_secret / vault.update_secret
-- existent deja sur ce projet.
--
-- ⚠️ A VALIDER AVANT APPLICATION (Etienne) :
--   1. Les deux fonctions sont SECURITY DEFINER a dessein, EXECUTABLES PAR
--      service_role UNIQUEMENT (revoke public + grant service_role). get_advisors
--      les signalera (SECURITY DEFINER) : exception VOULUE, ne pas « corriger ».
--      Contrairement a get_report_share, elles ne sont PAS exposees a anon.
--   2. Rejouable : `create or replace function` (aucune table, aucune policy).
--      Rejouer est sans effet de bord.
--
-- Apres application : lancer get_advisors (les 2 seuls nouveaux warnings attendus
-- sont ces fonctions SECURITY DEFINER, cf. ci-dessus).

begin;

create or replace function public.store_integration_secret(
  _secret text,
  _description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if _secret is null or length(_secret) = 0 then
    raise exception 'store_integration_secret: secret vide';
  end if;
  select vault.create_secret(_secret, null, _description) into v_id;
  return v_id;
end;
$$;

revoke execute on function public.store_integration_secret(text, text) from public;
grant execute on function public.store_integration_secret(text, text) to service_role;

create or replace function public.update_integration_secret(
  _secret_id uuid,
  _secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _secret_id is null then
    raise exception 'update_integration_secret: id null';
  end if;
  if _secret is null or length(_secret) = 0 then
    raise exception 'update_integration_secret: secret vide';
  end if;
  perform vault.update_secret(_secret_id, _secret);
end;
$$;

revoke execute on function public.update_integration_secret(uuid, text) from public;
grant execute on function public.update_integration_secret(uuid, text) to service_role;

commit;
