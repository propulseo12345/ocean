-- Garde de transition sur content_items.status.
--
-- Pourquoi : `grant insert, update, delete on public.content_items to authenticated`
-- (006) sans garde signifie qu'un `PATCH /rest/v1/content_items {"status":"published"}`
-- passe RLS (l'admin est bien is_org_member) et saute l'approbation client, la
-- programmation et le worker. La validation client -- la proposition de valeur du
-- produit -- serait contournable en une requete.
--
-- Ce trigger n'est PAS une policy : get_advisors ne le verra jamais.
-- Le test pgTAP 008 est son seul filet. Ne pas le supprimer.
--
-- Matrice : docs/PRD.md section 5.B.

create or replace function private.content_items_guard_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed public.content_status[];
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Bypass worker / migrations.
  --
  -- L'ancre est `request.jwt.claims` : ce GUC est pose par PostgREST, et par lui
  -- seul. Un appel utilisateur ou API le porte toujours ; une connexion serveur
  -- directe (le worker, Supavisor SESSION port 5432, regle 17) ne l'a jamais.
  --
  --   (a) GUC absent ou vide  -> worker / migration -> bypass.
  --   (b) role = service_role -> Edge Function en service key -> bypass.
  --
  -- Pourquoi PAS session_user (l'implementation precedente) :
  --   PostgREST se connecte en `authenticator` puis fait SET ROLE authenticated.
  --   SET ROLE ne change QUE current_user -- session_user reste le role de
  --   connexion. La garde dependait donc du nom du role de connexion, non
  --   teste, et invisible depuis pgTAP (ou session_user vaut 'postgres', ce qui
  --   ouvrait le bypass et rendait la garde intestable).
  --   Accessoirement `pg_catalog.session_user` ne compile pas : session_user est
  --   un mot-cle SQL, pas une fonction schema-qualifiable.
  --
  -- Pourquoi PAS current_user : sous SECURITY DEFINER il vaut le PROPRIETAIRE
  -- de la fonction. La garde s'ouvrirait pour tout le monde.
  --
  -- Pourquoi `coalesce(..., '') = ''` et non `IS NULL` : set_config(guc, null, true)
  -- ne remet pas le GUC a NULL, il le laisse a chaine vide. Un `IS NULL` seul
  -- refermerait la garde sur le worker des qu'un claim a ete pose puis reinitialise
  -- dans la meme session (exactement ce que fait le test pgTAP).
  --
  -- Limite documentee : si un jour le worker passe par les routes API applicatives
  -- ou par le client Supabase avec un JWT, il portera des claims et ce bypass ne
  -- s'appliquera plus. Il devra alors s'authentifier en service_role (branche b).
  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return new;
  end if;

  -- Les statuts d'execution appartiennent au worker. Un admin ne pousse jamais
  -- un contenu en published : c'est ce qui rend la validation non contournable.
  if new.status in (
    'publishing',
    'published',
    'partially_published',
    'failed'
  ) then
    raise exception
      'content_items: le statut % est pose par le worker uniquement', new.status
      using errcode = '42501';
  end if;

  -- `case` PL/pgSQL en INSTRUCTION (pas en expression) : `raise` n'est pas
  -- autorise dans un `case ... end` expression, et un `case` expression sans
  -- branche `else` renvoie NULL en silence -- ce qui ouvrirait la garde.
  case old.status
    when 'idea'                then v_allowed := array['draft','scheduled','canceled'];
    when 'draft'               then v_allowed := array['in_review','approved','scheduled','canceled'];
    when 'in_review'           then v_allowed := array['changes_requested','approved','draft','canceled'];
    when 'changes_requested'   then v_allowed := array['draft','approved','canceled'];
    when 'approved'            then v_allowed := array['scheduled','draft','canceled'];
    when 'scheduled'           then v_allowed := array['approved','draft','canceled'];
    when 'publishing'          then v_allowed := array[]::public.content_status[];
    when 'published'           then v_allowed := array[]::public.content_status[];
    -- retry cible des cibles failed / abandon des cibles failed
    when 'partially_published' then v_allowed := array['scheduled','canceled'];
    when 'failed'              then v_allowed := array['scheduled','draft','canceled'];
    when 'canceled'            then v_allowed := array['draft'];
    else
      -- Un `case` INSTRUCTION sans `else` leve CASE_NOT_FOUND (20000), mais on
      -- veut un 42501 explicite : ajouter une valeur a content_status sans
      -- toucher a ce trigger doit echouer bruyamment, jamais passer en silence.
      raise exception
        'content_items: statut source non couvert par la garde: %', old.status
        using errcode = '42501';
  end case;

  if not (new.status = any (v_allowed)) then
    raise exception
      'content_items: transition % -> % interdite', old.status, new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.content_items_guard_status_transition() from public;

-- `of status` : le trigger ne se declenche pas sur une edition de legende.
-- Nom choisi pour trier avant content_items_set_updated_at (g < s) : la garde
-- s'execute d'abord, elle ne voit donc pas l'updated_at reecrit.
create trigger content_items_guard_status_transition
before update of status on public.content_items
for each row execute function private.content_items_guard_status_transition();
