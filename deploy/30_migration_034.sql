-- Migration 034 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 004 + 013 + 032.
-- Genere depuis supabase/migrations/034_leave_client.sql.
--
-- ⚠ NON APPLIQUEE A CE JOUR. La session du 16/08 n'avait AUCUNE autorisation
-- d'ecriture en ligne : l'autorisation precedente etait bornee aux migrations
-- 032 et 033. Ledger attendu avant application : 33 lignes (001->033).
-- Apres application, penser a inserer la ligne 034 dans
-- supabase_migrations.schema_migrations, comme pour les precedentes.
--
-- OBJET : il n'existait AUCUNE sortie. `client_members_delete` (004:101-103)
-- exige `is_org_member(org_id)` — or un Reviewer n'appartient par construction a
-- aucune organisation (regle 6), il ne pouvait donc PHYSIQUEMENT pas se retirer
-- d'un client. Seule l'agence qui l'avait inscrit pouvait le faire.
--
-- Ce n'est pas qu'un manque d'ergonomie : c'etait l'aggravant de la CSRF V-3.
-- Une adhesion creee a l'insu de la victime, dans le client d'un ATTAQUANT,
-- n'etait revocable que par l'attaquant lui-meme. La CSRF est fermee cote
-- application (page de confirmation + POST + verification d'origine) ; cette
-- sortie est le filet qui rend l'etat reparable par la personne concernee,
-- quelle que soit la maniere dont l'adhesion a ete creee.
--
-- N'AJOUTE AUCUN GRANT D'ECRITURE DIRECTE : la RPC est le seul chemin, son
-- perimetre est borne par `user_id = auth.uid()`, qui vient du JWT et non d'un
-- parametre. L'appelant ne peut retirer que lui-meme.
--
-- Idempotent (create or replace + revoke/grant).
--
-- Test : supabase/tests/034_leave_client.test.sql (10 assertions, dont la
-- revocation du jeton vivant verifiee PAR MUTATION : retirer le bloc
-- `update client_invitations` fait tomber le test 6).
--
-- Apres application : get_advisors. Attendu : aucun nouveau lint (fonction
-- SECURITY DEFINER avec search_path fige, comme celles de la 032).


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
