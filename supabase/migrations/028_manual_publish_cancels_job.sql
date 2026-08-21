-- Migration 028 — Déclarer une cible publiée à la main annule SON job (P4-1).
--
-- POURQUOI
-- --------
-- `mark_target_published_manually` posait `status = 'published'` sur la cible et
-- s'arrêtait là. Le job vivant de cette même cible, lui, restait en file avec sa
-- `run_at` inchangée : à l'heure dite, le worker publiait — par-dessus la
-- publication manuelle. Double post chez le client, dont un qu'Ocean croyait être
-- le seul.
--
-- Le cas n'a rien d'exotique : c'est le geste NORMAL du parcours TikTok. Le
-- worker pousse un brouillon, Étienne le finalise dans l'app TikTok, puis déclare
-- « publié » dans Ocean. Idem pour une newsletter envoyée à la main.
--
-- POURQUOI ICI ET PAS DANS `syncPublishQueue`
-- -------------------------------------------
-- Le helper applicatif ne peut pas faire ce geste : `cancel_publish_jobs` est
-- scopée au CONTENU, et un contenu multi-plateformes a plusieurs cibles. L'appeler
-- après une publication manuelle sur Instagram annulerait aussi les jobs Facebook
-- et TikTok du même contenu — on remplacerait un doublon par des publications
-- manquantes.
--
-- L'annulation doit donc être scopée à LA cible, et le seul endroit qui la
-- connaît est cette RPC. Elle y est atomique, en prime : la déclaration humaine
-- et l'annulation du job ne peuvent pas diverger.
--
-- RÈGLE 15, comme partout : un job DÉMARRÉ n'est pas annulé. S'il a déjà posé son
-- ancre, la publication API est peut-être partie elle aussi — c'est au worker de
-- conclure en interrogeant le conteneur, pas à l'app de décider à sa place.

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
  if v_status not in (
    'pending', 'queued', 'awaiting_manual', 'pushed_to_platform', 'failed', 'needs_verification'
  ) then
    raise exception
      'content_targets: publication manuelle impossible depuis le statut %', v_status
      using errcode = '42501';
  end if;

  v_actor := (select auth.uid());

  -- 028 : le job de CETTE cible n'a plus lieu d'être — la publication vient
  -- d'avoir lieu, à la main. Scopé au `content_target_id`, jamais au contenu :
  -- les autres plateformes du même contenu doivent partir normalement.
  -- RÈGLE 15 : jamais un job démarré (les DEUX ancres sont testées).
  update public.publish_jobs j
  set status = 'canceled', canceled_at = now(),
      worker_id = null, claimed_at = null, lease_expires_at = null
  where j.content_target_id = _target
    and j.status in ('scheduled', 'retrying', 'claimed', 'awaiting_media')
    and j.publish_started_at is null
    and not exists (
      select 1 from public.content_targets ct2
      where ct2.id = _target and ct2.publish_started_at is not null
    );

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

  -- L'issue inconnue DOMINE l'agrégat (024).
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

comment on function public.mark_target_published_manually(uuid, text, text) is
  'Declaration humaine de publication. Annule le job NON DEMARRE de cette cible (jamais ceux des autres cibles du contenu), trace manual_published_by/at et recalcule le statut agrege.';
