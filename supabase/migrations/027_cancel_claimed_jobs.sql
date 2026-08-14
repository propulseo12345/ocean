-- Migration 027 — Déprogrammer atteint enfin un job DÉJÀ RÉCLAMÉ (ticket P3-9).
--
-- POURQUOI
-- --------
-- `cancel_publish_jobs` (020:245) ne touchait que `('scheduled', 'retrying')`.
-- Un job `claimed` — c'est-à-dire un job qu'un worker a pris et qu'il est en
-- train d'exécuter — était donc ignoré, silencieusement : la RPC renvoyait 0 et
-- l'appelant ne lit pas le compte (P4-4). L'utilisateur déprogramme, l'UI dit
-- que c'est fait, et le post part quand même.
--
-- La fenêtre n'est pas théorique : le lease dure 2 minutes, le tick 5 secondes,
-- et un job passe par `create_container` puis un upload avant de publier. Sur un
-- Reel, elle se compte en minutes — exactement le temps qu'il faut pour changer
-- d'avis.
--
-- CE QUI REND L'ANNULATION EFFECTIVE
-- ----------------------------------
-- Poser `canceled` sur la ligne n'interromprait rien tout seul : le worker est
-- déjà parti avec son objet en mémoire. C'est le FENCING de P3-5 qui referme la
-- boucle — `markPublishStarted` exige `status in ('claimed','publishing')` et
-- vérifie `rowCount`. Un job passé `canceled` fait donc échouer la dernière
-- écriture AVANT l'appel de publication : le worker lève `LeaseLostError` et
-- s'arrête sans publier. P3-5 est le prérequis dur de ce ticket.
--
-- CE QU'ON N'ANNULE TOUJOURS PAS (RÈGLE 15)
-- -----------------------------------------
-- Un job dont l'ancre est posée appartient au worker : la publication a
-- peut-être déjà eu lieu. L'annuler ne l'effacerait pas côté plateforme, et
-- laisserait Ocean croire que rien n'est parti. Le filtre teste donc les DEUX
-- ancres — celle du job ET celle de la cible (023) — parce que c'est la seconde
-- qui fait foi.

create or replace function public.cancel_publish_jobs(_content_item uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_count integer := 0;
begin
  select org_id into v_org from public.content_items where id = _content_item;
  if v_org is null then
    raise exception 'content_items introuvable' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org) then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  update public.publish_jobs j
  set status = 'canceled', canceled_at = now(),
      -- Le lease est relâché : le worker courant se fera refuser sa prochaine
      -- écriture (fencing P3-5) et le reaper n'a plus rien à reprendre.
      worker_id = null, claimed_at = null, lease_expires_at = null
  where j.content_item_id = _content_item
    -- 027 : + 'claimed' et 'awaiting_media'. Un job pris par un worker est
    -- justement celui qu'il est urgent d'arrêter.
    and j.status in ('scheduled', 'retrying', 'claimed', 'awaiting_media')
    -- RÈGLE 15 : jamais un job démarré. Les DEUX ancres comptent — celle de la
    -- cible (023) fait foi, celle du job n'est qu'une trace.
    and j.publish_started_at is null
    and not exists (
      select 1 from public.content_targets ct
      where ct.id = j.content_target_id
        and ct.publish_started_at is not null
    );

  get diagnostics v_count = row_count;

  -- État métier : une cible dont le job vient d'être annulé n'est plus « en
  -- file ». Sans ce retour à 'pending', elle restait `queued` à vie — un contenu
  -- déprogrammé continuait d'afficher « en file d'attente » sur toutes ses
  -- plateformes. 'pending' est autorisé à authenticated par la garde 013.
  update public.content_targets ct
  set status = 'pending'
  where ct.content_item_id = _content_item
    and ct.status = 'queued'
    and ct.publish_started_at is null
    and not exists (
      select 1 from public.publish_jobs j
      where j.content_target_id = ct.id
        and j.status in ('scheduled', 'claimed', 'awaiting_media', 'publishing', 'retrying')
    );

  return v_count;
end;
$$;

revoke all on function public.cancel_publish_jobs(uuid) from public, anon;
grant execute on function public.cancel_publish_jobs(uuid) to authenticated, service_role;

comment on function public.cancel_publish_jobs(uuid) is
  'Annule les jobs non demarres d un contenu, y compris un job deja reclame (regle 15 : jamais un job dont une ancre est posee). Remet les cibles concernees en pending.';
