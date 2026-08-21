-- Migration 032 — Cycle de vie d'une invitation reviewer (ticket P7-7).
--
-- POURQUOI
-- --------
-- Une invitation ratée était DÉFINITIVE. Quatre défauts qui se renforcent :
--
--   1. L'index unique partiel `client_invitations_pending_idx` porte sur
--      `(client_id, lower(email)) where accepted_at is null and revoked_at is
--      null`. Il **ignore `expires_at`** : une invitation périmée depuis six
--      mois bloque toujours la suivante, pour toujours.
--   2. `revoked_at` n'est écrit NULLE PART dans le dépôt. La seule sortie de
--      l'index était donc l'acceptation — c'est-à-dire le cas où tout va bien.
--   3. Aucune ré-invitation : une adresse mal saisie, un e-mail perdu dans les
--      spams, et le seul recours était un UPDATE SQL à la main.
--   4. Aucun retrait de `client_members`. La règle 4 exige qu'une révocation
--      soit effective IMMÉDIATEMENT (c'est même la raison pour laquelle ce
--      projet refuse les claims JWT d'autorisation) — et il n'existait aucun
--      bouton pour la prononcer.
--
-- CE QU'ON NE FAIT PAS, ET POURQUOI
-- ---------------------------------
-- On ne « corrige » PAS l'index en y ajoutant `expires_at > now()` : un prédicat
-- d'index doit être IMMUTABLE, et `now()` ne l'est pas (Postgres refuserait).
-- Surtout, ce serait la mauvaise réponse — l'unicité « une seule invitation
-- vivante par (client, adresse) » est un invariant qu'on VEUT garder dur.
--
-- On le garde donc intact, et on rend la ré-invitation possible en **retirant
-- explicitement** l'ancienne ligne avant d'insérer la nouvelle, dans la même
-- transaction. C'est ce que fait `invite_client_reviewer`.

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
