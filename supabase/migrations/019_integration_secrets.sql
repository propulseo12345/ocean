-- Migration 019 — Helpers Vault pour les secrets d'intégration OAuth.
--
-- Règle 12 : aucun token OAuth ne vit en clair en base. persistConnection (web,
-- Route Handler de callback, service_role) chiffre chaque token via Supabase
-- Vault et ne stocke que l'uuid du secret dans les tables *_secrets (deny-all,
-- règle 11). Ces deux helpers sont l'unique surface d'écriture de Vault.
--
-- POURQUOI SCHÉMA public ET PAS private : PostgREST (supabase-js) ne peut appeler
-- en RPC (`admin.rpc(...)`) que des fonctions du schéma EXPOSÉ (public). Un helper
-- dans `private` serait physiquement injoignable par le client service_role du web.
-- On obtient l'équivalent « service_role only » par les GRANTs, PAS par le schéma :
--   revoke execute from public  → retire le grant implicite à TOUT rôle
--   grant execute to service_role → seul le rôle serveur peut appeler
-- Un utilisateur `authenticated` (n'importe quel tenant) ne peut donc NI créer NI
-- réécrire un secret : la seule voie d'écriture des tokens passe par le serveur.
--
-- SECURITY DEFINER + search_path = '' : la fonction s'exécute avec les droits du
-- propriétaire (postgres, qui a accès au schéma vault) ; le search_path vide force
-- la qualification de schéma (vault.create_secret) et neutralise tout détournement
-- de search_path (règle : jamais de SECURITY DEFINER sans search_path figé).
--
-- get_advisors signalera ces deux fonctions SECURITY DEFINER : c'est VOULU et
-- documenté. Contrairement à get_report_share (exposée à anon), elles ne sont
-- exécutables que par service_role — surface d'attaque strictement serveur.

-- Crée un secret Vault et renvoie son uuid (stocké ensuite dans *_secrets).
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
  -- new_name = null : aucune contrainte d'unicité de nom à gérer (deux comptes
  -- peuvent porter le même libellé). La référence stable vit dans nos tables
  -- *_secrets via l'uuid renvoyé. La description est lisible au tableau de bord
  -- Vault (jamais le secret lui-même).
  select vault.create_secret(_secret, null, _description) into v_id;
  return v_id;
end;
$$;

revoke execute on function public.store_integration_secret(text, text) from public;
grant execute on function public.store_integration_secret(text, text) to service_role;

-- Rotation d'un secret existant (refresh token TikTok/Microsoft — règle 14 :
-- remplacement sous verrou côté worker) : réécrit le secret Vault en place, la
-- référence uuid (donc la ligne *_secrets) est inchangée.
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
