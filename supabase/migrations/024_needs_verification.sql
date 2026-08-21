-- Migration 024 — Statut terminal `needs_verification` : « on ne sait pas ».
--
-- POURQUOI (ticket P3-3)
-- ---------------------
-- Aujourd'hui, `failed` porte DEUX faits que rien ne distingue :
--   * « la publication n'est jamais partie »  → relancer est sûr ;
--   * « la publication est peut-être partie » → relancer publie deux fois.
--
-- Le second cas est produit par des chemins ordinaires : token perdu après la
-- pose de l'ancre, erreur permanente au `media_publish`, réseau coupé pendant
-- l'interrogation du conteneur. L'UI affiche « Échec », l'admin reprogramme —
-- et le client reçoit le même post une seconde fois.
--
-- `needs_verification` sépare les deux. C'est un statut TERMINAL et une
-- DEMANDE : un humain doit aller regarder le compte, puis trancher.
--
-- MODÉLISATION RETENUE
-- --------------------
-- Le statut est ajouté aux TROIS enums, parce que le mensonge existe aux trois
-- niveaux : `publish_jobs.status` (exécution), `content_targets.status` (vérité
-- par plateforme, c'est celui qui compte), `content_items.status` (agrégat lu
-- par le dashboard, le calendrier et le portail client).
--
-- Sur l'agrégat, l'issue inconnue DOMINE : une seule cible en
-- `needs_verification` suffit à mettre le contenu en `needs_verification`, même
-- si les autres cibles ont réussi. « Publié » sur un contenu dont une plateforme
-- est incertaine serait le mensonge que ce ticket existe pour supprimer.
--
-- QUI LE POSE, QUI EN SORT
-- ------------------------
-- Posé par le WORKER seul (gardes 008 et 013 étendues ci-dessous). Aucune
-- transition n'en sort côté `authenticated` : ni `scheduled` (le doublon), ni
-- `draft` (qui y ramène). La sortie est un geste HUMAIN par cible :
-- `mark_target_published_manually`, dont la liste de statuts sources accepte
-- désormais `needs_verification` — « j'ai regardé, c'est bien en ligne ».
--
-- La direction inverse — « j'ai regardé, rien n'est parti, republie » — exige
-- d'EFFACER l'ancre de la règle 15. C'est la fonction la plus dangereuse que ce
-- schéma puisse porter ; elle n'est PAS écrite ici, délibérément. En attendant,
-- l'issue est : republier depuis un contenu neuf.

-- ===========================================================================
-- 1. Enums
--    ⚠ `alter type ... add value` doit être COMMITÉ avant que la valeur soit
--    ÉVALUÉE. Les fonctions ci-dessous ne font que la mentionner (corps plpgsql
--    analysé à l'exécution), donc un seul script suffit ici — mais le fichier
--    deploy/ est scindé en deux étapes, l'éditeur SQL Supabase enveloppant tout
--    dans une transaction unique.
-- ===========================================================================

alter type public.target_status add value if not exists 'needs_verification';
alter type public.content_status add value if not exists 'needs_verification';
alter type public.publish_job_status add value if not exists 'needs_verification';

-- ===========================================================================
-- 2. Garde 008/016 — `needs_verification` est posé par le worker, et rien n'en
--    sort côté app. Fonction réécrite à l'identique hors ces deux points.
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
    -- 024 : une issue inconnue est un CONSTAT du worker, jamais une déclaration
    -- de l'app.
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
    -- 024 : AUCUNE sortie côté app. `scheduled` republierait, `draft` y ramène.
    -- La sortie passe par la résolution HUMAINE de chaque cible, après quoi
    -- l'agrégat est recalculé par le chemin worker/definer.
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

  return new;
end;
$$;

revoke all on function private.content_items_guard_status_transition() from public;

-- ===========================================================================
-- 3. Garde 013 sur content_targets — même ajout.
-- ===========================================================================

create or replace function private.content_targets_guard_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return new;
  end if;

  -- Statuts d'exécution : posés par le worker uniquement.
  if new.status in ('publishing', 'published', 'pushed_to_platform', 'needs_verification') then
    raise exception
      'content_targets: le statut % est pose par le worker uniquement', new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.content_targets_guard_status_transition() from public;

-- ===========================================================================
-- 4. La SORTIE humaine — « j'ai regardé, c'est bien en ligne »
--    `mark_target_published_manually` (016) accepte `needs_verification` en
--    statut source. Réécrite à l'identique hors cette liste : sans elle, une
--    cible en issue inconnue serait un cul-de-sac définitif.
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
  v_unknown    integer;
  v_new_status public.content_status;
  v_actor      uuid;
  v_claims     text;
begin
  select ct.org_id, ct.client_id, ct.content_item_id, ct.status, ct.platform
    into v_org, v_client, v_item, v_status, v_platform
  from public.content_targets ct
  where ct.id = _target
  for update;

  if v_org is null then
    raise exception 'content_targets: cible introuvable' using errcode = 'P0002';
  end if;

  if not private.is_org_member(v_org) then
    raise exception 'content_targets: acces refuse' using errcode = '42501';
  end if;

  if v_status = 'published' then
    return v_status;
  end if;
  -- 024 : + 'needs_verification'. C'est LA sortie d'une issue inconnue.
  if v_status not in (
    'pending', 'queued', 'awaiting_manual', 'pushed_to_platform', 'failed', 'needs_verification'
  ) then
    raise exception
      'content_targets: publication manuelle impossible depuis le statut %', v_status
      using errcode = '42501';
  end if;

  v_actor := (select auth.uid());

  -- Emprunt délibéré, étroit et restauré de l'autorité du worker (voir 016).
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

  select count(*),
         count(*) filter (where status = 'published'),
         count(*) filter (where status in ('failed', 'skipped', 'canceled')),
         count(*) filter (where status = 'needs_verification')
    into v_total, v_published, v_failed, v_unknown
  from public.content_targets
  where content_item_id = v_item;

  -- 024 : l'issue inconnue DOMINE l'agrégat. Tant qu'une cible reste
  -- incertaine, le contenu ne peut pas s'annoncer publié.
  if v_unknown > 0 then
    v_new_status := 'needs_verification';
  elsif v_published = v_total then
    v_new_status := 'published';
  elsif v_published > 0 and (v_published + v_failed) = v_total then
    v_new_status := 'partially_published';
  else
    v_new_status := null;
  end if;

  if v_new_status is not null then
    update public.content_items
    set status = v_new_status
    where id = v_item;
  end if;

  perform pg_catalog.set_config('request.jwt.claims', v_claims, true);

  perform private.log_content_activity(
    v_item, 'published'::public.activity_kind, v_actor, null,
    jsonb_build_object('platform', v_platform, 'manual', true)
  );

  return 'published'::public.target_status;
end;
$$;

revoke all on function public.mark_target_published_manually(uuid, text, text) from public, anon;
grant execute on function public.mark_target_published_manually(uuid, text, text)
  to authenticated, service_role;

-- `request_target_retry` n'est PAS élargie : elle exige toujours `failed`. Une
-- relance sur une issue inconnue est exactement la double publication que ce
-- statut existe pour empêcher.

comment on type public.target_status is
  'Statut metier par plateforme. needs_verification (024) = issue INCONNUE : un POST est peut-etre parti, un humain doit verifier avant toute relance.';
