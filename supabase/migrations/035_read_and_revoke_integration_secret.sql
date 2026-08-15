-- Migration 035 — Lire et RÉVOQUER un secret d'intégration (Vault).
--
-- La migration 019 a ouvert l'écriture (`store_`, `update_`). Il manquait les
-- deux autres moitiés du cycle de vie, et chacune bloque un ticket de la phase 8 :
--
--   · `read_integration_secret`   → P8-1. Rattacher une Page à un client exige de
--     redemander à Meta le token de CETTE page, donc de relire le token
--     utilisateur de la connexion. Le worker le fait déjà, mais par une connexion
--     Postgres directe (`vault.decrypted_secrets`) : PostgREST n'expose pas le
--     schéma `vault`, donc le web n'a aujourd'hui aucune voie de lecture.
--
--   · `revoke_integration_secret` → P8-2. Détacher un compte social ne supprimait
--     RIEN : `.delete()` n'apparaît nulle part dans le code OAuth. Le token
--     restait chiffré dans Vault indéfiniment, pour un compte que le client croit
--     déconnecté. C'est un passif RGPD (droit à l'effacement) et un risque
--     concret — un token oublié reste un token valide.
--
-- ⚠ CE QUE CETTE MIGRATION AUGMENTE, ET POURQUOI C'EST ACCEPTÉ
-- --------------------------------------------------------------
-- Jusqu'ici, seul le worker (connexion Postgres directe) pouvait LIRE un token.
-- `read_integration_secret` donne cette capacité à tout code détenant la clé
-- service_role, donc au serveur web. C'est une extension réelle du rayon
-- d'explosion, assumée pour une raison précise : sans elle, la sélection des
-- sous-comptes (P8-1) est impossible, et P8-1 ferme une fuite BEAUCOUP plus
-- large — aujourd'hui, connecter Meta pour un client rattache TOUTES les Pages du
-- compte, avec leurs tokens, à ce client-là.
--
-- Les contreparties sont les mêmes qu'en 019, et elles sont strictes :
--   · schéma `public` obligatoire (PostgREST n'appelle que l'exposé), mais
--     `revoke execute from public, anon, authenticated` → service_role SEUL ;
--   · `security definer` + `set search_path = ''` (jamais de definer sans
--     search_path figé) ;
--   · aucune énumération : la fonction exige un uuid connu, elle ne liste rien.
--
-- Un `authenticated`, quel que soit son tenant, ne peut ni lire ni révoquer.
-- Le test pgTAP 035 le prouve par exécution, pas par lecture.

-- ===========================================================================
-- 1. Lecture d'un secret (service_role uniquement)
-- ===========================================================================

create or replace function public.read_integration_secret(_secret_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if _secret_id is null then
    raise exception 'read_integration_secret: id null';
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where id = _secret_id;
  -- `null` si l'uuid n'existe pas : l'appelant distingue « pas de secret » d'une
  -- erreur, sans qu'on lui dise si l'uuid a jamais existé.
  return v_secret;
end;
$$;

revoke execute on function public.read_integration_secret(uuid) from public, anon, authenticated;
grant execute on function public.read_integration_secret(uuid) to service_role;

-- ===========================================================================
-- 2. Révocation d'un secret (service_role uniquement)
-- ===========================================================================

-- Renvoie `true` si une ligne a été supprimée, `false` si l'uuid était déjà
-- absent. Le booléen n'est pas décoratif : la révocation est le geste qu'on ne
-- peut pas vérifier plus tard (le secret n'existe plus), donc l'appelant doit
-- pouvoir dire « j'ai supprimé » ou « il n'y avait rien », jamais supposer.
create or replace function public.revoke_integration_secret(_secret_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if _secret_id is null then
    raise exception 'revoke_integration_secret: id null';
  end if;
  delete from vault.secrets where id = _secret_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke execute on function public.revoke_integration_secret(uuid) from public, anon, authenticated;
grant execute on function public.revoke_integration_secret(uuid) to service_role;
