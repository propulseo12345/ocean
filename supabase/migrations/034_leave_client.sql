-- Migration 034 — Un membre peut se retirer LUI-MÊME d'un client (ticket V-3).
--
-- LE DÉFAUT
-- ---------
-- Il n'existait aucune sortie. `client_members_delete` (004:101-103) exige
-- `is_org_member(org_id)` : pour quitter un client, il fallait être membre de
-- l'ORGANISATION qui le possède. Or un Reviewer n'appartient par construction à
-- aucune organisation (règle 6) — il ne peut donc PHYSIQUEMENT pas se retirer.
-- Seule l'agence qui l'a inscrit pouvait le faire.
--
-- Ce n'est pas qu'un manque d'ergonomie. C'était l'aggravant de la CSRF V-3 :
-- une adhésion créée à l'insu de la victime, dans le client d'un ATTAQUANT,
-- était irrévocable par la victime — il fallait demander à l'attaquant de bien
-- vouloir la retirer. La CSRF est fermée côté application ; cette sortie est le
-- filet qui rend l'état réparable par la personne concernée, quelle que soit la
-- manière dont l'adhésion a été créée.
--
-- LA DÉCISION
-- -----------
-- SECURITY DEFINER, parce que la policy de suppression ne peut pas exprimer ce
-- cas sans être élargie : lui ajouter « ou user_id = auth.uid() » ouvrirait un
-- DELETE direct par PostgREST sur une table où l'on veut, à terme, un journal.
-- La RPC est le seul chemin, elle est nominative, et son périmètre est réduit à
-- la ligne de l'appelant.
--
-- Note de conception : l'adresse est résolue sur `auth.users`, PAS sur
-- `public.profiles`. `profiles.email` est réinscriptible par son propre sujet
-- (le grant `003:165` est table-level, sans liste de colonnes), donc l'indexer
-- pour une révocation revient à laisser le sujet choisir la cible de sa propre
-- révocation. `auth.users.email` est hors de sa portée. Les RPC de la 032
-- portent encore ce défaut — il est traité séparément.

create or replace function public.leave_client(_client uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'client_members: session requise' using errcode = '42501';
  end if;

  -- Aucune vérification d'appartenance à l'org : c'est tout l'objet de la
  -- fonction. Le périmètre est borné par `user_id = v_user`, qui ne vient pas
  -- d'un paramètre mais du JWT — l'appelant ne peut retirer que lui-même.
  delete from public.client_members
  where client_id = _client and user_id = v_user;

  if not found then
    return false;
  end if;

  select lower(email) into v_email from auth.users where id = v_user;

  -- Toute invitation encore vivante vers ce client pour cette personne est
  -- retirée AUSSI. Sans cela, on sort d'un côté pendant qu'un jeton non consommé
  -- permet de rentrer de l'autre — et dans le scénario CSRF, c'est l'attaquant
  -- qui détient ce jeton en clair.
  update public.client_invitations
  set revoked_at = now(), status = 'revoked'
  where client_id = _client
    and accepted_at is null
    and revoked_at is null
    and (lower(email) = v_email or accepted_user_id = v_user);

  return true;
end;
$$;

revoke all on function public.leave_client(uuid) from public, anon;
grant execute on function public.leave_client(uuid) to authenticated, service_role;

comment on function public.leave_client(uuid) is
  'Retire l appelant lui-meme d un client (regle 4, et sortie de secours du scenario CSRF V-3) et revoque au passage toute invitation vivante le concernant sur ce client.';
