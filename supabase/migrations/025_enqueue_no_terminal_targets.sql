-- Migration 025 — `enqueue_publish_jobs` cesse de ré-enfiler les cibles finies.
--
-- POURQUOI (ticket P3-4)
-- ---------------------
-- 020 n'excluait que `('published', 'canceled', 'skipped')`. Deux trous :
--
--   `failed` — le commentaire de l'index unique partiel (020:113) assumait
--   explicitement « une cible peut être republiée après un échec définitif ».
--   C'était vrai tant que `failed` ne voulait dire qu'une chose. Depuis 024, une
--   cible peut être `failed` alors qu'un POST est parti (avant P3-3, elle
--   l'était systématiquement dans ce cas). Le chemin opérateur est ouvert et
--   câblé : `failed → scheduled` est légal (016:78) et exposé par le kanban.
--
--   `pushed_to_platform` — le brouillon TikTok EXISTE déjà dans le compte du
--   créateur. Réenfiler en pousse un second et brûle un des 5 brouillons/24 h
--   (CLAUDE.md §6), pour un doublon que le client devra supprimer à la main.
--
-- CE QUI RESTE POSSIBLE, ET POURQUOI
-- ----------------------------------
-- Exclure `failed` en bloc serait une régression : la majorité des échecs réels
-- (conteneur refusé, média invalide, token perdu AVANT la pose de l'ancre) n'ont
-- rien envoyé, et les relancer est le geste normal — le seul, tant que
-- `request_target_retry` reste un cul-de-sac.
--
-- Le critère n'est donc pas le statut mais L'ANCRE (migration 023) :
--   * `failed` SANS ancre → rien n'est parti → ré-enfilable, sans risque ;
--   * `failed` AVEC ancre → un POST est peut-être parti → jamais automatiquement.
--
-- `needs_verification` est exclu en toutes circonstances : c'est sa définition.
--
-- Il reste que le worker, lui, sait quoi faire d'une cible ancrée : `recoverStartedJob`
-- interroge le conteneur. Un job ré-enfilé sur une cible ancrée ne republierait
-- donc pas à l'aveugle (023). Ce filtre est la SECONDE ligne de défense — on ne
-- fait pas dépendre « ne pas publier deux fois » d'un seul mécanisme.

create or replace function public.enqueue_publish_jobs(_content_item uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid;
  v_status public.content_status;
  v_at     timestamptz;
  v_count  integer := 0;
begin
  select org_id, status, scheduled_at
    into v_org, v_status, v_at
  from public.content_items
  where id = _content_item;

  if v_org is null then
    raise exception 'content_items introuvable' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org) then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  -- N'enfile que ce qui est réellement programmé (statut ET date).
  if v_status <> 'scheduled' or v_at is null then
    return 0;
  end if;

  insert into public.publish_jobs (
    org_id, client_id, content_item_id, content_target_id,
    social_account_id, platform, status, run_at
  )
  select
    ct.org_id, ct.client_id, ct.content_item_id, ct.id,
    ct.social_account_id, ct.platform, 'scheduled', v_at
  from public.content_targets ct
  where ct.content_item_id = _content_item
    and ct.social_account_id is not null
    and ct.platform in ('instagram', 'facebook', 'tiktok')
    -- 025 : + 'pushed_to_platform' (le brouillon TikTok existe deja) et
    -- + 'needs_verification' (issue inconnue : jamais d'automatisme).
    and ct.status not in (
      'published', 'canceled', 'skipped', 'pushed_to_platform', 'needs_verification'
    )
    -- 025, RÈGLE 15 : une cible ANCRÉE n'est jamais ré-enfilée automatiquement,
    -- quel que soit son statut. C'est le critere qui compte — pas le statut.
    and ct.publish_started_at is null
  on conflict (content_target_id)
    where status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying')
    do update set run_at = excluded.run_at, updated_at = now();

  get diagnostics v_count = row_count;

  update public.content_targets
  set status = 'queued'
  where content_item_id = _content_item
    and social_account_id is not null
    and platform in ('instagram', 'facebook', 'tiktok')
    and status = 'pending'
    -- Symetrique du filtre ci-dessus : ne jamais annoncer « en file » une cible
    -- qu'on vient justement de refuser d'enfiler.
    and publish_started_at is null;

  return v_count;
end;
$$;

revoke all on function public.enqueue_publish_jobs(uuid) from public, anon;
grant execute on function public.enqueue_publish_jobs(uuid) to authenticated, service_role;

comment on function public.enqueue_publish_jobs(uuid) is
  'Enfile un job par cible API d un contenu programme (idempotent, app-driven). N enfile JAMAIS une cible ancree (regle 15), un brouillon TikTok deja pousse, ni une issue inconnue.';
