-- Migration 025 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 023 + 024.
-- Genere depuis supabase/migrations/025_enqueue_no_terminal_targets.sql.
--
-- OBJET : `enqueue_publish_jobs` n'excluait que ('published','canceled','skipped').
-- Une cible `failed` sur laquelle un POST etait peut-etre parti restait
-- re-enfilable — et `failed -> scheduled` est un simple glisser-deposer dans le
-- kanban. Un brouillon TikTok deja pousse l'etait aussi, ce qui en poussait un
-- second et brulait un des 5 brouillons / 24 h.
--
-- Le critere n'est PAS le statut mais l'ANCRE de la migration 023 : un echec
-- ordinaire (rien n'est parti) reste relancable, ce qui evite de transformer le
-- correctif en regression.
--
-- Idempotent (create or replace seul). Rejouable sans risque.

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
