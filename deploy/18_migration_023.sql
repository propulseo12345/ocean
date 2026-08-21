-- Migration 023 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
-- Genere depuis supabase/migrations/023_target_publish_anchor.sql. Prerequis : 020.
--
-- OBJET : l'ancre d'idempotence de la regle 15 passe de la ligne de job (jetable)
-- a content_targets (durable). Sans elle, quatre chemins normaux fabriquent un job
-- neuf avec l'ancre a zero et republient un post deja en ligne.
--
-- Contenu : 2 colonnes sur content_targets, un backfill depuis publish_jobs, et
-- 2 triggers qui interdisent a `authenticated` de poser/deplacer/effacer l'ancre
-- ou de supprimer une cible ancree.
--
-- NON idempotent (add column sans if not exists) : a n'appliquer qu'une fois.
-- A appliquer AVANT de deployer le worker correspondant — un worker a jour sur une
-- base sans ces colonnes echoue au claim (la jointure lit ct.publish_started_at).
--
-- Apres application : get_advisors (attendu : aucun nouveau lint — les 2 fonctions
-- sont dans le schema `private`, non expose).

-- ===========================================================================
-- 1. Colonnes
-- ===========================================================================

alter table public.content_targets
  -- Règle 15 : posé par le worker AVANT media_publish, COMMITÉ avant l'appel.
  -- Non nul => « une publication est peut-être partie » => ne jamais republier
  -- sans avoir interrogé le conteneur d'abord.
  add column publish_started_at timestamptz,
  -- Le conteneur qui permet de POSER la question à la plateforme.
  add column external_container_id text;

comment on column public.content_targets.publish_started_at is
  'Regle 15 : ancre d idempotence DURABLE de la cible (survit a la ligne de job). Non nul => ne jamais republier sans interroger le conteneur.';
comment on column public.content_targets.external_container_id is
  'Conteneur de publication associe a l ancre. Permet d interroger la plateforme au lieu de republier a l aveugle.';

-- ===========================================================================
-- 2. Reprise de l'existant
--    La PREMIÈRE marque posée fait foi : c'est elle qui date le moment où la
--    publication est devenue irréversible pour cette cible.
-- ===========================================================================

update public.content_targets ct
set publish_started_at    = j.publish_started_at,
    external_container_id = coalesce(ct.external_container_id, j.external_container_id)
from (
  select distinct on (content_target_id)
         content_target_id, publish_started_at, external_container_id
  from public.publish_jobs
  where publish_started_at is not null
  order by content_target_id, publish_started_at asc
) j
where ct.id = j.content_target_id
  and ct.publish_started_at is null;

-- ===========================================================================
-- 3. Garde UPDATE — l'ancre appartient au worker
--    Même ancre d'autorité que les gardes 008 / 013 : `request.jwt.claims` est
--    posé par PostgREST et par lui seul. Vide (worker en direct) ou
--    `service_role` => passage libre. Les RPC SECURITY DEFINER qui auraient un
--    jour besoin de trancher une issue inconnue neutralisent les claims le
--    temps de leur UPDATE, exactement comme mark_target_published_manually
--    (016:167) — la porte n'est pas soudée, elle est étroite.
-- ===========================================================================

create or replace function private.content_targets_guard_publish_anchor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Bypass worker / service_role.
  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return new;
  end if;

  if new.publish_started_at is distinct from old.publish_started_at then
    raise exception
      'content_targets: publish_started_at est pose par le worker uniquement (regle 15)'
      using errcode = '42501';
  end if;

  if new.external_container_id is distinct from old.external_container_id then
    raise exception
      'content_targets: external_container_id est pose par le worker uniquement (regle 15)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.content_targets_guard_publish_anchor() from public;

-- `of publish_started_at, external_container_id` : le trigger ne se déclenche
-- que si l'UPDATE mentionne l'une des deux colonnes — un PATCH ordinaire
-- (caption_override, metadata…) ne paie rien.
create trigger content_targets_guard_publish_anchor
before update of publish_started_at, external_container_id on public.content_targets
for each row execute function private.content_targets_guard_publish_anchor();

-- ===========================================================================
-- 4. Garde DELETE — supprimer la cible effacerait l'ancre
--    C'est le chemin le plus court vers un doublon, et il est ATTEIGNABLE
--    depuis l'app : `reconcileTargets` (lib/actions/content.ts) fait un
--    delete-all + insert dès que le contenu repasse en draft, et
--    `failed → draft` est une transition légale (016:78). L'ancre partirait
--    avec la ligne, hors de toute RLS.
-- ===========================================================================

create or replace function private.content_targets_guard_anchor_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.publish_started_at is null then
    return old;
  end if;

  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return old;
  end if;

  raise exception
    'content_targets: cible % non supprimable — une publication a peut-etre eu lieu (regle 15)', old.id
    using errcode = '42501';
end;
$$;

revoke all on function private.content_targets_guard_anchor_delete() from public;

create trigger content_targets_guard_anchor_delete
before delete on public.content_targets
for each row execute function private.content_targets_guard_anchor_delete();

comment on function private.content_targets_guard_publish_anchor() is
  'Regle 15 : interdit a authenticated de poser, deplacer ou effacer l ancre d idempotence d une cible.';
comment on function private.content_targets_guard_anchor_delete() is
  'Regle 15 : interdit a authenticated de supprimer une cible dont une publication a peut-etre eu lieu.';
