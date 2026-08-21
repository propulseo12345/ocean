-- Migration 035 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 019.
-- Genere depuis supabase/migrations/035_read_and_revoke_integration_secret.sql.
--
-- ✅ APPLIQUEE EN LIGNE le 15/08/2026 (session de pilotage, MCP `execute_sql`),
-- ledger passe de 34 a 35 lignes (`035` / `read_and_revoke_integration_secret`).
--
-- ⚠ CE FICHIER ETAIT CORROMPU JUSQU'AU 15/08/2026, et il n'aurait pas pu
-- s'executer : il portait, AVANT la section 1, un fragment orphelin — un corps
-- de fonction (`returns text` … `$$;` puis ses `revoke`/`grant`) prive de son
-- en-tete `create or replace function`. Postgres s'arretait en erreur de
-- syntaxe des la premiere ligne de SQL. La 035 a donc ete appliquee depuis la
-- source canonique `supabase/migrations/`, et ce fichier a ete regenere.
-- Lecon : les 10 tests pgTAP de la 035 mesuraient `supabase/migrations/`,
-- jamais `deploy/` — une preuve qui ne porte pas sur le referentiel livre.
--
-- OBJET : la migration 019 avait ouvert l'ECRITURE dans Vault (store_, update_).
-- Les deux autres moities du cycle de vie manquaient, et chacune bloque un
-- ticket de la phase 8 :
--   · read_integration_secret   -> P8-1 (rattacher une Page choisie exige de
--     relire le token utilisateur de la connexion ; PostgREST n'expose pas le
--     schema `vault`, donc le web n'avait aucune voie de lecture) ;
--   · revoke_integration_secret -> P8-2 (detacher un compte ne supprimait RIEN :
--     le token restait chiffre dans Vault indefiniment, pour un compte que le
--     client croit deconnecte — passif RGPD).
--
-- ⚠ CE QUE CELA AUGMENTE : jusqu'ici seul le worker (connexion Postgres directe)
-- pouvait LIRE un token. Cette migration donne la capacite a tout code detenant
-- la cle service_role, donc au serveur web. Extension reelle du rayon
-- d'explosion, assumee : sans elle P8-1 est impossible, et P8-1 ferme une fuite
-- bien plus large (aujourd'hui connecter Meta pour un client rattache TOUTES les
-- Pages du compte, avec leurs tokens, a ce client-la).
--
-- Contreparties, identiques a 019 et strictes : schema `public` obligatoire
-- (PostgREST n'appelle que l'expose) mais `revoke execute from public, anon,
-- authenticated` -> service_role SEUL ; security definer + search_path fige ;
-- aucune enumeration (il faut connaitre l'uuid).
--
-- VERIFICATION APRES APPLICATION (doit rendre 0 ligne) :
--   select p.proname, r.rolname
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     cross join (values ('anon'),('authenticated')) as r(rolname)
--    where n.nspname = 'public'
--      and p.proname in ('read_integration_secret','revoke_integration_secret')
--      and has_function_privilege(r.rolname, p.oid, 'execute');
--   -- Rendu : 0 ligne le 15/08/2026.

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
