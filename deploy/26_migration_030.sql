-- Migration 030 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 024.
-- Genere depuis supabase/migrations/030_approval_mode_gate.sql.
--
-- OBJET : `clients.approval_mode` existe depuis 004 et n'est lu NULLE PART qui
-- puisse dire non — ni policy, ni trigger. Un glisser-deposer du kanban vers
-- « Programme » suffit a programmer, puis publier, un contenu que le client n'a
-- jamais vu. C'est la promesse produit n 1, et rien ne l'appliquait.
--
-- ⚠ CHANGEMENT DE COMPORTEMENT VISIBLE : chez un client en `required`, faire
-- glisser une carte de « Brouillon » vers « Programme » levera desormais 42501.
-- C'est voulu. Le defaut de la colonne est 'optional' (004:8), donc les clients
-- existants ne sont PAS bloques tant que tu n'en passes pas un en `required`.
--
-- Idempotent (create or replace seul). Rejouable sans risque.

create or replace function private.content_items_guard_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed       public.content_status[];
  v_approval_mode public.approval_mode;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Bypass worker / service_role — ancre `request.jwt.claims` (voir 008).
  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return new;
  end if;

  if new.status in (
    'publishing',
    'published',
    'partially_published',
    'failed',
    'needs_verification'
  ) then
    raise exception
      'content_items: le statut % est pose par le worker uniquement', new.status
      using errcode = '42501';
  end if;

  case old.status
    when 'idea'                then v_allowed := array['draft','scheduled','canceled'];
    when 'draft'               then v_allowed := array['idea','in_review','approved','scheduled','canceled'];
    when 'in_review'           then v_allowed := array['changes_requested','approved','draft','canceled'];
    when 'changes_requested'   then v_allowed := array['draft','approved','canceled'];
    when 'approved'            then v_allowed := array['scheduled','draft','canceled'];
    when 'scheduled'           then v_allowed := array['approved','draft','canceled'];
    when 'publishing'          then v_allowed := array[]::public.content_status[];
    when 'published'           then v_allowed := array[]::public.content_status[];
    when 'partially_published' then v_allowed := array['scheduled','canceled'];
    when 'failed'              then v_allowed := array['scheduled','draft','canceled'];
    when 'canceled'            then v_allowed := array['draft'];
    when 'needs_verification'  then v_allowed := array[]::public.content_status[];
    else
      raise exception
        'content_items: statut source non couvert par la garde: %', old.status
        using errcode = '42501';
  end case;

  if not (new.status = any (v_allowed)) then
    raise exception
      'content_items: transition % -> % interdite', old.status, new.status
      using errcode = '42501';
  end if;

  -- ==========================================================================
  -- 030 — La promesse produit : pas de programmation sans validation client
  --       quand le client l'a exigée. Testé APRÈS la matrice, parce qu'une
  --       transition illégale doit d'abord être refusée comme telle.
  -- ==========================================================================
  if new.status = 'scheduled' then
    select c.approval_mode into v_approval_mode
    from public.clients c
    where c.id = new.client_id;

    if v_approval_mode = 'required' then
      if not exists (
        select 1
        from public.approvals a
        where a.content_item_id = new.id
          and a.decision = 'approved'
          -- Le rôle est le cœur du contrôle : sans lui, l'auto-approbation de
          -- l'agence satisferait une garde censée protéger le client d'elle.
          and a.decided_by_role = 'reviewer'
      ) then
        raise exception
          'content_items: ce client exige une validation client avant programmation'
          using errcode = '42501';
      end if;

      -- Une approbation portant sur un texte modifié depuis n'est pas une
      -- approbation. Le drapeau existait (013) et n'était lu par personne.
      if new.approval_stale then
        raise exception
          'content_items: le contenu a change depuis la validation client — a refaire valider'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.content_items_guard_status_transition() from public;

comment on function private.content_items_guard_status_transition() is
  'Matrice de transition 008/016/024 + garde d approbation 030 : un client en approval_mode=required exige une approbation reviewer non perimee avant scheduled.';
