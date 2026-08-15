-- Test 035 — Lecture et révocation d'un secret d'intégration (Vault).
--
-- Même nature de risque qu'en 019, et il est plus aigu : `read_integration_secret`
-- rend un token OAuth EN CLAIR. Si un rôle `authenticated` pouvait l'appeler, il
-- suffirait de connaître (ou de deviner) un uuid pour extraire le token d'un
-- autre tenant — le deny-all des tables *_secrets serait contourné par le bas.
-- La seule barrière est le GRANT : on le prouve par exécution.
--
-- On n'APPELLE pas les fonctions (le conteneur local n'a pas le schéma `vault`,
-- extension hébergée) : on teste existence + privilèges, comme le test 019.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- ---------------------------------------------------------------------------
-- Existence
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'read_integration_secret', array['uuid'],
  'read_integration_secret(uuid) existe'
);
select has_function(
  'public', 'revoke_integration_secret', array['uuid'],
  'revoke_integration_secret(uuid) existe'
);

-- ---------------------------------------------------------------------------
-- service_role : SEUL rôle autorisé
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.read_integration_secret(uuid)', 'execute'),
  'service_role peut exécuter read_integration_secret'
);
select ok(
  has_function_privilege('service_role', 'public.revoke_integration_secret(uuid)', 'execute'),
  'service_role peut exécuter revoke_integration_secret'
);

-- ---------------------------------------------------------------------------
-- anon / authenticated : refusés
--
-- Les default privileges Supabase accordent EXECUTE à anon et authenticated :
-- `revoke from public` seul ne suffit PAS (leçon de la migration 021). C'est
-- exactement ce que ces quatre assertions vérifient.
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.read_integration_secret(uuid)', 'execute'),
  'authenticated NE PEUT PAS lire un secret'
);
select ok(
  not has_function_privilege('anon', 'public.read_integration_secret(uuid)', 'execute'),
  'anon NE PEUT PAS lire un secret'
);
select ok(
  not has_function_privilege('authenticated', 'public.revoke_integration_secret(uuid)', 'execute'),
  'authenticated NE PEUT PAS révoquer un secret'
);
select ok(
  not has_function_privilege('anon', 'public.revoke_integration_secret(uuid)', 'execute'),
  'anon NE PEUT PAS révoquer un secret'
);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER avec search_path figé
--
-- Un definer sans `search_path` vide est détournable : l'appelant place son
-- propre schéma en tête et fait exécuter SON `vault.decrypted_secrets`. La règle
-- du projet est « jamais de definer sans search_path figé » — on la vérifie.
-- ---------------------------------------------------------------------------
-- ⚠ Postgres rend le réglage `set search_path = ''` sous la forme
-- `search_path=""` (guillemets inclus), pas `search_path=`. La première version
-- de ce test comparait à la seconde forme et a échoué — c'est le test qui a
-- attrapé l'erreur du test, ce qui est exactement son rôle. Les deux formes sont
-- acceptées ici pour ne pas dépendre du rendu d'une version de Postgres.
select ok(
  (select p.prosecdef
       and exists (
         select 1 from unnest(p.proconfig) c where c in ('search_path=""', 'search_path=')
       )
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'read_integration_secret'),
  'read_integration_secret est SECURITY DEFINER avec search_path figé'
);
select ok(
  (select p.prosecdef
       and exists (
         select 1 from unnest(p.proconfig) c where c in ('search_path=""', 'search_path=')
       )
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'revoke_integration_secret'),
  'revoke_integration_secret est SECURITY DEFINER avec search_path figé'
);

select * from finish();
rollback;
