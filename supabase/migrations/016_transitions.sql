-- Migration 016 — Complétude des transitions (Phase 6 du câblage).
--
-- Trois choses, toutes motivées par un écart CONSTATÉ entre ce que l'UI propose
-- et ce que la garde 008 autorise :
--
--   1. `draft -> idea` ajouté à la matrice 008 (conflit C3). L'UI a une colonne
--      « Idées » et un toast dédié `onlyDraftToIdea` : la capacité existe et est
--      découvrable. Elle ne crée AUCUN chemin de contournement — `idea` autorise
--      déjà `scheduled`, donc repasser par `idea` n'ouvre rien de neuf. Retirer
--      le bouton aurait coûté une fonctionnalité pour un risque nul.
--
--   2. RPC `mark_target_published_manually` — une publication MANUELLE (TikTok
--      finalisé dans l'app, newsletter envoyée à la main) est une DÉCLARATION
--      HUMAINE. `status='published'` est interdit à authenticated par la garde
--      de 013, et doit le rester : sans cette RPC, l'UI n'a pas d'autre issue
--      que d'ouvrir la garde, ce qui rouvrirait la publication fantôme.
--      La RPC trace QUI a déclaré et QUAND (manual_published_by/at), et
--      recalcule le statut agrégé du contenu parent.
--
--   3. RPC `request_target_retry` — pose `retry_requested_at` SANS toucher au
--      statut. RÈGLE 15 : c'est le WORKER qui décide s'il republie, après avoir
--      interrogé le container quand `publish_started_at` est non nul. Une UI qui
--      remettrait elle-même la cible en 'queued' court-circuiterait ce contrôle
--      et produirait une double publication chez un client.

-- ===========================================================================
-- 1. Matrice 008 — ajout de draft -> idea
--    Fonction réécrite À L'IDENTIQUE hors cette ligne (le trigger reste en
--    place, `create or replace` suffit).
-- ===========================================================================

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

  -- Bypass worker / service_role — ancre `request.jwt.claims`, posé par
  -- PostgREST et par lui seul (voir 008 pour le raisonnement complet).
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
    'failed'
  ) then
    raise exception
      'content_items: le statut % est pose par le worker uniquement', new.status
      using errcode = '42501';
  end if;

  case old.status
    when 'idea'                then v_allowed := array['draft','scheduled','canceled'];
    -- 016 : + 'idea' (C3) — renvoyer un brouillon sur l'étagère à idées.
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

  return new;
end;
$$;

revoke all on function private.content_items_guard_status_transition() from public;

-- ===========================================================================
-- 2. Publication manuelle déclarée par un membre de l'org
-- ===========================================================================

create or replace function public.mark_target_published_manually(
  _target uuid,
  _external_post_id text default null,
  _permalink text default null
)
returns public.target_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org        uuid;
  v_client     uuid;
  v_item       uuid;
  v_status     public.target_status;
  v_platform   public.platform;
  v_total      integer;
  v_published  integer;
  v_failed     integer;
  v_new_status public.content_status;
  v_actor      uuid;
  v_claims     text;
begin
  select ct.org_id, ct.client_id, ct.content_item_id, ct.status, ct.platform
    into v_org, v_client, v_item, v_status, v_platform
  from public.content_targets ct
  where ct.id = _target
  -- FOR UPDATE : deux clics simultanés sur « j'ai publié » ne doivent pas
  -- produire deux recalculs concurrents du statut agrégé.
  for update;

  if v_org is null then
    raise exception 'content_targets: cible introuvable' using errcode = 'P0002';
  end if;

  -- Autorisation : membre de l'org UNIQUEMENT. Un reviewer ne déclare jamais
  -- une publication (il valide, il ne publie pas).
  if not private.is_org_member(v_org) then
    raise exception 'content_targets: acces refuse' using errcode = '42501';
  end if;

  -- Déclarer « publié » n'a de sens que depuis un état d'attente humaine.
  -- Depuis 'published' : no-op idempotent (double clic), pas une erreur.
  if v_status = 'published' then
    return v_status;
  end if;
  if v_status not in ('pending', 'queued', 'awaiting_manual', 'pushed_to_platform', 'failed') then
    raise exception
      'content_targets: publication manuelle impossible depuis le statut %', v_status
      using errcode = '42501';
  end if;

  -- L'acteur est capturé AVANT la neutralisation des claims ci-dessous.
  v_actor := (select auth.uid());

  -- Les gardes de 008 et 013 refusent les statuts d'exécution à `authenticated`,
  -- et c'est exactement ce qui empêche la publication fantôme par PATCH direct.
  -- Elles s'ancrent sur `request.jwt.claims`, PAS sur SECURITY DEFINER : sans
  -- la neutralisation ci-dessous, cette RPC se ferait refuser par sa propre
  -- garde. On emprunte donc l'autorité du worker de façon DÉLIBÉRÉE, ÉTROITE et
  -- RESTAURÉE : uniquement après avoir vérifié is_org_member et la légalité du
  -- statut source, uniquement le temps des deux UPDATE, et la trace reste dans
  -- manual_published_by/at. `is_local := true` borne l'effet à la transaction ;
  -- la restauration explicite le borne aux deux instructions.
  v_claims := coalesce(pg_catalog.current_setting('request.jwt.claims', true), '');
  perform pg_catalog.set_config('request.jwt.claims', '', true);

  update public.content_targets
  set status              = 'published',
      external_post_id    = coalesce(_external_post_id, external_post_id),
      permalink           = coalesce(_permalink, permalink),
      published_at        = coalesce(published_at, now()),
      manual_published_by = v_actor,
      manual_published_at = now(),
      last_error          = null
  where id = _target;

  -- Statut agrégé du parent : published seulement si TOUTES les cibles le sont.
  select count(*),
         count(*) filter (where status = 'published'),
         count(*) filter (where status in ('failed', 'skipped', 'canceled'))
    into v_total, v_published, v_failed
  from public.content_targets
  where content_item_id = v_item;

  if v_published = v_total then
    v_new_status := 'published';
  elsif v_published > 0 and (v_published + v_failed) = v_total then
    v_new_status := 'partially_published';
  else
    -- Des cibles sont encore en attente : le parent ne bouge pas.
    v_new_status := null;
  end if;

  if v_new_status is not null then
    update public.content_items
    set status = v_new_status
    where id = v_item;
  end if;

  -- Restauration immédiate : tout ce qui suit dans la transaction retrouve les
  -- claims de l'appelant, donc les gardes.
  perform pg_catalog.set_config('request.jwt.claims', v_claims, true);

  perform private.log_content_activity(
    v_item, 'published'::public.activity_kind, v_actor, null,
    jsonb_build_object('platform', v_platform, 'manual', true)
  );

  return 'published'::public.target_status;
end;
$$;

revoke all on function public.mark_target_published_manually(uuid, text, text) from public;
grant execute on function public.mark_target_published_manually(uuid, text, text)
  to authenticated, service_role;

-- ===========================================================================
-- 3. Demande de retry — RÈGLE 15 : on ne republie JAMAIS soi-même
-- ===========================================================================

create or replace function public.request_target_retry(_target uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid;
  v_status public.target_status;
  v_at     timestamptz;
begin
  select ct.org_id, ct.status into v_org, v_status
  from public.content_targets ct
  where ct.id = _target
  for update;

  if v_org is null then
    raise exception 'content_targets: cible introuvable' using errcode = 'P0002';
  end if;

  if not private.is_org_member(v_org) then
    raise exception 'content_targets: acces refuse' using errcode = '42501';
  end if;

  -- Seule une cible en échec se relance. Relancer une cible 'publishing'
  -- reviendrait à demander une seconde publication de la même chose.
  if v_status <> 'failed' then
    raise exception
      'content_targets: retry impossible depuis le statut %', v_status
      using errcode = '42501';
  end if;

  v_at := now();

  -- On pose UNIQUEMENT l'intention. Le statut reste 'failed' : c'est le worker
  -- qui reprend la cible, et lui seul sait interroger le container quand
  -- publish_started_at est non nul (règle 15 — un retry aveugle = double post).
  update public.content_targets
  set retry_requested_at = v_at
  where id = _target;

  return v_at;
end;
$$;

revoke all on function public.request_target_retry(uuid) from public;
grant execute on function public.request_target_retry(uuid) to authenticated, service_role;

comment on function public.mark_target_published_manually(uuid, text, text) is
  'Declaration humaine de publication (TikTok finalise, newsletter envoyee). Trace manual_published_by/at et recalcule le statut agrege du contenu.';
comment on function public.request_target_retry(uuid) is
  'Pose retry_requested_at sur une cible failed. Ne change PAS le statut : la republication appartient au worker (regle 15).';
