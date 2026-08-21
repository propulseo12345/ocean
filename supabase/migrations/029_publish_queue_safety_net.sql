-- Migration 029 — Filet de sécurité : l'invariant de file ne dépend plus du code.
--
-- POURQUOI UN TRIGGER EN PLUS DU HELPER
-- -------------------------------------
-- `syncPublishQueue` (P4-1) couvre les quatre chemins connus. Le problème de
-- fond n'était pas ces quatre-là mais le fait que l'invariant reposait sur la
-- DISCIPLINE de chaque appelant : à N surfaces d'édition, la probabilité qu'une
-- oublie tend vers 1. Un trigger ne s'oublie pas.
--
-- CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS
-- --------------------------------------
-- Il ferme la direction DANGEREUSE — « un job vit alors qu'il ne devrait pas, ou
-- pas à cette heure-là ». Il ne crée jamais de job : l'absence de job est un
-- défaut visible (rien ne part) que le ticket P4-4 traite à l'appel, tandis
-- qu'un job de trop part chez un vrai client sans que personne le voie.
--
-- LE PIÈGE QU'IL FAUT ABSOLUMENT ÉVITER
-- -------------------------------------
-- « annuler dès que le statut n'est plus scheduled » serait FAUX et destructeur.
-- `markPublishStarted` bascule le contenu en `publishing` pendant que le worker
-- travaille : un contenu multi-plateformes verrait alors les jobs de ses AUTRES
-- cibles annulés au moment même où la première publie. Instagram partirait,
-- Facebook et TikTok disparaîtraient en silence.
--
-- Le trigger n'annule donc que sur les statuts qui signifient sans ambiguïté
-- « ce contenu ne part pas » — c'est-à-dire ceux que l'APP peut poser. Les
-- statuts d'exécution (publishing / published / partially_published / failed /
-- needs_verification) appartiennent au worker et ne déclenchent rien.
--
-- RÈGLE 15 partout : jamais un job dont une ancre est posée.

create or replace function private.content_items_sync_publish_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_should_cancel boolean := false;
begin
  -- 1. Mise à la corbeille. Le claim du worker ne joint jamais content_items :
  --    sans ce filet, un contenu supprimé part quand même.
  if new.deleted_at is not null and old.deleted_at is null then
    v_should_cancel := true;
  end if;

  -- 2. Date retirée : plus rien à programmer.
  if new.scheduled_at is null and old.scheduled_at is not null then
    v_should_cancel := true;
  end if;

  -- 3. Statuts qui disent « ce contenu ne part pas ». Volontairement limité aux
  --    statuts posables par l'app — voir l'en-tête : inclure `publishing` ferait
  --    disparaître les cibles voisines d'un contenu multi-plateformes.
  if new.status is distinct from old.status
     and new.status in ('idea', 'draft', 'in_review', 'changes_requested', 'approved', 'canceled')
  then
    v_should_cancel := true;
  end if;

  if v_should_cancel then
    update public.publish_jobs j
    set status = 'canceled', canceled_at = now(),
        worker_id = null, claimed_at = null, lease_expires_at = null
    where j.content_item_id = new.id
      and j.status in ('scheduled', 'retrying', 'claimed', 'awaiting_media')
      and j.publish_started_at is null
      and not exists (
        select 1 from public.content_targets ct
        where ct.id = j.content_target_id and ct.publish_started_at is not null
      );
    return new;
  end if;

  -- 4. Re-datation d'un contenu qui reste programmé : `run_at` est une COPIE
  --    faite à l'enfilement (020:64) et rien ne la resynchronise. Sans cette
  --    branche, le calendrier affiche 17 h et le worker publie à 9 h.
  if new.scheduled_at is distinct from old.scheduled_at
     and new.scheduled_at is not null
     and new.deleted_at is null
     and new.status = 'scheduled'
  then
    update public.publish_jobs j
    set run_at = new.scheduled_at,
        -- Un job en backoff doit redevenir éligible à la nouvelle heure, sinon
        -- `next_attempt_at` (dans le futur) l'emporte sur la re-datation.
        next_attempt_at = least(coalesce(j.next_attempt_at, new.scheduled_at), new.scheduled_at)
    where j.content_item_id = new.id
      and j.status in ('scheduled', 'retrying')
      and j.publish_started_at is null;
  end if;

  return new;
end;
$$;

revoke all on function private.content_items_sync_publish_queue() from public;

-- AFTER : le filet réagit à un état déjà écrit, il ne le modifie pas.
-- `of status, scheduled_at, deleted_at` : un PATCH ordinaire (légende, notes)
-- ne paie rien.
create trigger content_items_sync_publish_queue
after update of status, scheduled_at, deleted_at on public.content_items
for each row execute function private.content_items_sync_publish_queue();

comment on function private.content_items_sync_publish_queue() is
  'Filet de securite de la file : annule les jobs non demarres d un contenu corbeille/deprogramme/repasse en amont, et realigne run_at sur scheduled_at. N enfile jamais.';
