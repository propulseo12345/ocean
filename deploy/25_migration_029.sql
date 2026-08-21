-- Migration 029 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 023.
-- Genere depuis supabase/migrations/029_publish_queue_safety_net.sql.
--
-- OBJET : filet de securite. L'invariant « un contenu a des jobs vivants si et
-- seulement si il est scheduled, date et non supprime » ne depend plus de la
-- discipline de chaque appelant applicatif.
--
-- ⚠ CE QU'IL NE FAIT PAS : il n'enfile JAMAIS. Il ferme la direction dangereuse
-- (un job de trop, ou a la mauvaise heure), pas la direction visible (aucun job).
--
-- ⚠ Le trigger n'annule PAS sur les statuts d'execution (publishing, published,
-- failed, needs_verification) : `markPublishStarted` passe le contenu en
-- `publishing`, et annuler la ferait disparaitre les cibles voisines d'un contenu
-- multi-plateformes au moment meme ou la premiere publie.
--
-- Idempotent SAUF le `create trigger` final : si tu le rejoues, precede-le d'un
-- `drop trigger if exists content_items_sync_publish_queue on public.content_items;`.

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
