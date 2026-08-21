-- Migration 031 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : aucun.
-- Genere depuis supabase/migrations/031_scheduled_at_bounds.sql.
--
-- OBJET : `scheduled_at` n'a aucune borne serveur. Le composer verifie cote
-- client ; l'action en lot du board, le glisser-deposer du calendrier et l'appel
-- direct de la Server Action ne verifient rien. Une date passee de moins de 2 h
-- tombe DANS la fenetre de grace du worker : il publie immediatement.
--
-- ⚠ Tolerance de 2 minutes (aller-retour + derive d'horloge client). Une date
-- INCHANGEE, meme depassee, reste acceptee : un contenu en retard doit rester
-- modifiable.
--
-- Idempotent SAUF le `create trigger` final : si tu le rejoues, precede-le d'un
-- `drop trigger if exists content_items_guard_scheduled_at on public.content_items;`.

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
