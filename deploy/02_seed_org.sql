-- Ocean/Socean — bootstrap de l'organisation pour le premier compte.
--
-- PREREQUIS 1 : deploy_001-009.sql a ete execute (schema en place).
-- PREREQUIS 2 : le compte auth linda@socean.com existe DEJA.
--   Cree-le dans le Dashboard : Authentication > Users > "Add user"
--     email    : linda@socean.com
--     password : Password        (+ cocher "Auto Confirm User")
--   Passer par le Dashboard plutot que par un INSERT SQL dans auth.users :
--   GoTrue gere le hash bcrypt ET la ligne auth.identities, dont le schema
--   change selon les versions. Un INSERT manuel casse au premier upgrade.
--
-- RAPPEL : l'app se connecte en magic link / OTP (CLAUDE.md section 1).
-- Le mot de passe ne sert que si tu actives le provider Email+Password dans
--   Dashboard > Authentication > Sign In / Providers > Email.
--
-- Ce script est IDEMPOTENT : le relancer ne cree pas de doublon.

begin;

-- Garde-fou : echoue tout de suite et clairement si le compte n'existe pas.
do $$
begin
  if not exists (select 1 from auth.users where email = 'linda@socean.com') then
    raise exception
      'Compte auth introuvable. Cree linda@socean.com dans Dashboard > Authentication > Users, puis relance.';
  end if;
end $$;

-- 1) Profil — normalement pose par le trigger handle_new_user.
--    Filet au cas ou le compte precede l'installation du trigger.
insert into public.profiles (id, email, full_name)
select u.id, u.email, 'Linda'
from auth.users u
where u.email = 'linda@socean.com'
on conflict (id) do nothing;

-- 2) Organisation.
--    `organizations` n'a AUCUNE policy INSERT pour authenticated (par design) :
--    l'amorcage passe forcement par le serveur / SQL Editor.
insert into public.organizations (name, slug, created_by)
select 'Socean', 'socean', u.id
from auth.users u
where u.email = 'linda@socean.com'
  and not exists (select 1 from public.organizations where slug = 'socean');

-- 3) Appartenance owner.
--    owner (pas admin) : seul un owner peut gerer les membres (migration 003).
insert into public.organization_members (org_id, user_id, role)
select o.id, u.id, 'owner'
from public.organizations o
cross join auth.users u
where o.slug = 'socean'
  and u.email = 'linda@socean.com'
  and not exists (
    select 1 from public.organization_members m
    where m.org_id = o.id and m.user_id = u.id
  );

-- 4) Un premier client, pour que le back office ne s'ouvre pas sur du vide.
insert into public.clients (org_id, name, handle, timezone, approval_mode)
select o.id, 'Client de demo', 'client-demo', 'Europe/Paris', 'optional'
from public.organizations o
where o.slug = 'socean'
  and not exists (
    select 1 from public.clients c
    where c.org_id = o.id and c.handle = 'client-demo'
  );

commit;

-- Verification : doit renvoyer exactement 1 ligne.
select
  u.email,
  p.full_name,
  o.name   as org,
  o.slug,
  m.role,
  (select count(*) from public.clients c where c.org_id = o.id) as clients
from auth.users u
join public.profiles p             on p.id = u.id
join public.organization_members m on m.user_id = u.id
join public.organizations o        on o.id = m.org_id
where u.email = 'linda@socean.com';
