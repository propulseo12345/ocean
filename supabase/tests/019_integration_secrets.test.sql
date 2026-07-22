-- Test 019 — Helpers Vault des secrets d'intégration OAuth.
--
-- Aucune table nouvelle (règle « leak test sur toute table » sans objet ici) : la
-- migration 019 n'ajoute que deux fonctions SECURITY DEFINER. Le risque à couvrir
-- est donc le PRIVILÈGE : store/update_integration_secret sont l'unique surface
-- d'écriture de Vault et NE DOIVENT être exécutables que par service_role. Un
-- `authenticated` (n'importe quel tenant) qui pourrait les appeler contournerait
-- le deny-all des *_secrets. On prouve ici que le grant est verrouillé.
--
-- On n'APPELLE pas les fonctions : le conteneur local n'a pas le schéma vault
-- (extension hébergée Supabase). On teste existence + privilèges (statique).

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select has_function(
  'public', 'store_integration_secret', array['text', 'text'],
  'store_integration_secret(text, text) existe'
);
select has_function(
  'public', 'update_integration_secret', array['uuid', 'text'],
  'update_integration_secret(uuid, text) existe'
);

-- service_role : SEUL rôle autorisé.
select ok(
  has_function_privilege('service_role', 'public.store_integration_secret(text, text)', 'execute'),
  'service_role peut exécuter store_integration_secret'
);
select ok(
  has_function_privilege('service_role', 'public.update_integration_secret(uuid, text)', 'execute'),
  'service_role peut exécuter update_integration_secret'
);

-- authenticated / anon : refusés (revoke execute from public → aucun grant hérité).
select ok(
  not has_function_privilege('authenticated', 'public.store_integration_secret(text, text)', 'execute'),
  'authenticated NE PEUT PAS exécuter store_integration_secret'
);
select ok(
  not has_function_privilege('anon', 'public.update_integration_secret(uuid, text)', 'execute'),
  'anon NE PEUT PAS exécuter update_integration_secret'
);

select * from finish();

rollback;
