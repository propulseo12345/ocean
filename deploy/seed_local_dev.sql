-- Jeu de données MINIMAL pour vérifier un téléversement réel en LOCAL.
--
-- ⚠ NE JAMAIS EXÉCUTER AILLEURS QUE SUR LE STACK LOCAL (ports 544xx).
--    Le garde-fou ci-dessous refuse la transaction si la base n'est pas locale :
--    ce fichier crée un compte avec un mot de passe connu.
--
-- Ce n'est PAS une réintroduction de données mockées : rien ici n'alimente une
-- surface produit. C'est le strict nécessaire pour qu'un navigateur puisse
-- ouvrir une session et atteindre `/clients/{id}/library` — un compte, une
-- organisation, une adhésion, un client. Aucun média, aucun contenu : ce sont
-- précisément les objets que le test doit produire lui-même.
--
-- Usage :
--   docker exec -i supabase_db_ocean-local psql -U postgres -d postgres \
--     -f - < deploy/seed_local_dev.sql

do $$
begin
  if current_setting('port') <> '5432'
     or current_database() <> 'postgres'
     or not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    raise exception 'Ce script est réservé au stack Supabase local.';
  end if;
end $$;

begin;

-- 1. Compte Supabase Auth (mot de passe : ocean-local-2026)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token,
  recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'etienne@ocean.local',
  crypt('ocean-local-2026', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Étienne (local)"}'::jsonb,
  '', '', '', ''
)
on conflict (id) do update set encrypted_password = excluded.encrypted_password;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"etienne@ocean.local","email_verified":true}'::jsonb,
  'email', now(), now(), now()
)
on conflict (provider, provider_id) do nothing;

-- 2. Organisation + adhésion owner (le trigger handle_new_user n'a créé que le profil)
insert into public.organizations (id, name, slug)
values ('22222222-2222-4222-8222-222222222222', 'Propul''SEO (local)', 'propulseo-local')
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'owner'
)
on conflict (org_id, user_id) do nothing;

-- 3. Un client, cible du téléversement
insert into public.clients (id, org_id, name, handle, timezone)
values (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'Client de test', 'client-test', 'Europe/Paris'
)
on conflict (id) do nothing;

commit;

select
  (select count(*) from auth.users where email = 'etienne@ocean.local') as comptes,
  (select count(*) from public.organization_members
     where user_id = '11111111-1111-4111-8111-111111111111') as adhesions,
  (select count(*) from public.clients
     where id = '33333333-3333-4333-8333-333333333333') as clients;
