-- Migration 031 — Une date de programmation ne se pose plus dans le passé (P4-5).
--
-- POURQUOI
-- --------
-- `scheduled_at` est une colonne `timestamptz` nullable sans la moindre borne
-- serveur. Le composer vérifie la date côté client ; le reste ne vérifie rien —
-- action en lot du board, glisser-déposer du calendrier, appel direct de la
-- Server Action.
--
-- Une date passée de moins de deux heures tombe DANS la fenêtre de grâce
-- (`WORKER_GRACE_MS`) : le worker la réclame au tick suivant et publie
-- immédiatement. Programmer « hier 9 h » sur un contenu approuvé la veille
-- publie donc sur-le-champ, sans confirmation, sans avertissement — l'exact
-- contraire de ce que « programmer » veut dire.
--
-- Au-delà de deux heures, ce n'est pas mieux : le job naît déjà hors fenêtre de
-- grâce et part directement en `dead_letter`. Silencieusement, jusqu'à ce qu'on
-- regarde la cible.
--
-- POURQUOI UN TRIGGER ET PAS UN CHECK
-- -----------------------------------
-- `check (scheduled_at >= now())` est impossible : `now()` n'est pas immutable,
-- Postgres refuse la contrainte. Et il serait faux de toute façon — une
-- contrainte de table est réévaluée à chaque UPDATE, donc un contenu
-- légitimement en retard (programmé hier, jamais parti) deviendrait
-- immodifiable.
--
-- La règle exacte est donc : on refuse de POSER une date dans le passé, pas d'en
-- AVOIR une. Un `scheduled_at` inchangé passe toujours.
--
-- La tolérance de 2 minutes absorbe l'aller-retour navigateur→serveur et la
-- dérive d'horloge du client. Elle est volontairement plus petite que le tick du
-- worker n'a d'importance : ce qui compte est qu'elle soit très inférieure à la
-- fenêtre de grâce, pour qu'aucune date acceptée ne puisse déclencher une
-- publication immédiate non voulue.

create or replace function private.content_items_guard_scheduled_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Bypass worker / service_role — même ancre d'autorité que 008 / 013 / 023.
  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return new;
  end if;

  if new.scheduled_at is null then
    return new;
  end if;

  -- INSERT : toute date posée est une date nouvelle.
  -- UPDATE : seule une date qui CHANGE est contrôlée — un contenu en retard doit
  -- rester modifiable (on ne veut pas rendre immodifiable ce qui est déjà raté).
  if tg_op = 'UPDATE' and new.scheduled_at is not distinct from old.scheduled_at then
    return new;
  end if;

  if new.scheduled_at < now() - interval '2 minutes' then
    raise exception
      'content_items: date de programmation dans le passe (%) — publierait immediatement', new.scheduled_at
      using errcode = '22007';
  end if;

  return new;
end;
$$;

revoke all on function private.content_items_guard_scheduled_at() from public;

create trigger content_items_guard_scheduled_at
before insert or update of scheduled_at on public.content_items
for each row execute function private.content_items_guard_scheduled_at();

comment on function private.content_items_guard_scheduled_at() is
  'Refuse de POSER une date de programmation dans le passe (tolerance 2 min). Une date inchangee, meme depassee, reste acceptee.';
