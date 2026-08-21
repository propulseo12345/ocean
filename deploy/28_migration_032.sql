-- Migration 032 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 013.
-- Genere depuis supabase/migrations/032_invitation_lifecycle.sql.
--
-- OBJET : une invitation ratee etait DEFINITIVE. L'index unique partiel
-- `client_invitations_pending_idx` ignore `expires_at`, `revoked_at` n'etait
-- ecrit nulle part, et aucun retrait de `client_members` n'existait — alors que
-- la regle 4 exige qu'une revocation soit effective IMMEDIATEMENT.
--
-- Contenu : 3 RPC SECURITY DEFINER dans le schema `public`.
--   revoke_client_invitation(uuid)                        -> boolean
--   invite_client_reviewer(uuid, text, text, timestamptz) -> uuid
--   remove_client_member(uuid, uuid)                      -> boolean
--
-- ⚠ L'index unique partiel n'est PAS modifie, deliberement : un predicat d'index
-- doit etre IMMUTABLE et `now()` ne l'est pas. Surtout, l'unicite « une seule
-- invitation vivante par (client, adresse) » est un invariant qu'on veut garder
-- dur. La re-invitation devient possible parce que la RPC RETIRE explicitement
-- l'ancienne ligne avant d'inserer, dans la meme transaction.
--
-- ⚠ get_advisors ajoutera 3 WARN 0029 (SECURITY DEFINER executables par
-- `authenticated`). C'est ATTENDU et conforme : les trois verifient
-- `private.is_org_member` en interne avant toute ecriture — c'est prouve par les
-- tests 13 et 14 de supabase/tests/032_invitation_lifecycle.test.sql.
--
-- Idempotent (create or replace seul). Rejouable sans risque.

-- ===========================================================================
-- 1. Révocation explicite d'une invitation
-- ===========================================================================

create or replace function public.revoke_client_invitation(_invitation uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_accepted timestamptz;
begin
  select org_id, accepted_at into v_org, v_accepted
  from public.client_invitations
  where id = _invitation
  for update;

  if v_org is null then
    raise exception 'client_invitations: invitation introuvable' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org) then
    raise exception 'client_invitations: acces refuse' using errcode = '42501';
  end if;

  -- Une invitation déjà acceptée n'est plus une invitation : c'est une
  -- adhésion. La révoquer ici ne retirerait RIEN (la ligne client_members
  -- vivrait toujours) et donnerait l'illusion inverse. Le geste correct est
  -- `remove_client_member`, ci-dessous.
  if v_accepted is not null then
    raise exception
      'client_invitations: invitation deja acceptee — utiliser remove_client_member'
      using errcode = '42501';
  end if;

  update public.client_invitations
  set revoked_at = coalesce(revoked_at, now()),
      status     = 'revoked'
  where id = _invitation
    and revoked_at is null;

  return found;
end;
$$;

revoke all on function public.revoke_client_invitation(uuid) from public, anon;
grant execute on function public.revoke_client_invitation(uuid) to authenticated, service_role;

comment on function public.revoke_client_invitation(uuid) is
  'Revoque une invitation non acceptee (pose revoked_at + status). Libere l index unique partiel, donc autorise une nouvelle invitation pour la meme adresse.';

-- ===========================================================================
-- 2. Invitation — supersède l'existante au lieu d'échouer
--    Le jeton en clair est fabriqué par l'app ; seul son hash arrive ici.
-- ===========================================================================

create or replace function public.invite_client_reviewer(
  _client uuid,
  _email text,
  _token_hash text,
  _expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_email text := lower(trim(_email));
  v_id    uuid;
begin
  select org_id into v_org from public.clients where id = _client;
  if v_org is null then
    raise exception 'clients: client introuvable' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org) then
    raise exception 'clients: acces refuse' using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'client_invitations: adresse invalide' using errcode = '22023';
  end if;

  -- Déjà membre : il n'y a rien à inviter. Le dire, plutôt que de créer une
  -- invitation qui ne servira jamais et bloquera l'index.
  if exists (
    select 1
    from public.client_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.client_id = _client and lower(p.email) = v_email
  ) then
    raise exception 'client_invitations: cette adresse est deja membre du client'
      using errcode = '23505';
  end if;

  -- Ré-invitation : toute invitation vivante pour cette adresse est retirée.
  -- Conséquence VOULUE — l'ancien jeton meurt à l'instant. Deux jetons vivants
  -- pour une même adresse, c'est une surface d'attaque sans contrepartie.
  update public.client_invitations
  set revoked_at = now(),
      -- Cast explicite : `case` rend du text, la colonne est un enum.
      status     = (case when expires_at <= now() then 'expired' else 'revoked' end)
                     ::public.invitation_status
  where client_id = _client
    and lower(email) = v_email
    and accepted_at is null
    and revoked_at is null;

  insert into public.client_invitations (
    org_id, client_id, email, role, token_hash, expires_at, invited_by
  )
  values (
    v_org, _client, v_email, 'reviewer', _token_hash, _expires_at, (select auth.uid())
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.invite_client_reviewer(uuid, text, text, timestamptz)
  from public, anon;
grant execute on function public.invite_client_reviewer(uuid, text, text, timestamptz)
  to authenticated, service_role;

comment on function public.invite_client_reviewer(uuid, text, text, timestamptz) is
  'Cree une invitation reviewer en retirant d abord toute invitation vivante pour la meme adresse (l ancien jeton meurt). Refuse si l adresse est deja membre.';

-- ===========================================================================
-- 3. Retrait d'un membre — la révocation de la règle 4
-- ===========================================================================

create or replace function public.remove_client_member(_client uuid, _user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_email text;
begin
  select org_id into v_org from public.clients where id = _client;
  if v_org is null then
    raise exception 'clients: client introuvable' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org) then
    raise exception 'clients: acces refuse' using errcode = '42501';
  end if;

  select lower(email) into v_email from public.profiles where id = _user;

  delete from public.client_members
  where client_id = _client and user_id = _user;

  if not found then
    return false;
  end if;

  -- Toute invitation encore vivante pour cette adresse est retirée AUSSI.
  -- Sans cela, on retire quelqu'un d'un côté pendant qu'un jeton non consommé
  -- lui permet de revenir de l'autre — une révocation qui ne révoque pas.
  -- (Les invitations DÉJÀ acceptées portent `accepted_at` : la route
  -- d'acceptation les refuse, elles ne sont pas rejouables.)
  if v_email is not null then
    update public.client_invitations
    set revoked_at = now(), status = 'revoked'
    where client_id = _client
      and lower(email) = v_email
      and accepted_at is null
      and revoked_at is null;
  end if;

  return true;
end;
$$;

revoke all on function public.remove_client_member(uuid, uuid) from public, anon;
grant execute on function public.remove_client_member(uuid, uuid) to authenticated, service_role;

comment on function public.remove_client_member(uuid, uuid) is
  'Retire un membre d un client (regle 4 : revocation immediate) et revoque au passage toute invitation vivante pour la meme adresse.';
