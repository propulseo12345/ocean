-- Migration 023 — L'ancre d'idempotence (règle 15) déménage sur content_targets.
--
-- POURQUOI (le défaut de fond de la file, ticket P3-2)
-- ----------------------------------------------------
-- `publish_jobs.publish_started_at` protège un risque qui n'appartient pas au
-- job : « un POST est peut-être déjà parti chez Meta pour CETTE CIBLE ». Ce fait
-- est définitif et appartient à la CIBLE. Or la ligne de job est jetable —
-- quatre chemins normaux fabriquent une ligne neuve avec l'ancre à zéro :
--
--   1. `enqueue_publish_jobs` sur une cible dont le job précédent est terminal
--      (l'index unique partiel ne couvre que les statuts ACTIFS, 020:115) ;
--   2. `failed → scheduled` depuis le kanban après un abandon ;
--   3. la suppression de la ligne de job (FK `on delete cascade`, 020:90) ;
--   4. toute future RPC de relance qui réenfile.
--
-- Dans chacun, `publishFresh` recrée un conteneur et republie : double
-- publication chez un vrai client.
--
-- MODÉLISATION RETENUE
-- --------------------
-- L'ancre est DÉDOUBLÉE, pas déplacée :
--   * `publish_jobs.publish_started_at`  reste la TRACE D'EXÉCUTION de cette
--     tentative-là (quand ce job précis a rendu la publication irréversible) —
--     c'est ce qu'on lit pour un post-mortem ;
--   * `content_targets.publish_started_at` devient l'ANCRE DE DÉCISION, celle
--     que le moteur consulte. Elle survit à la mort de la ligne de job.
--
-- Le moteur lit l'ancre EFFECTIVE = `coalesce(cible, job)` (domain.ts,
-- `effectiveAnchor`). `external_container_id` suit le même chemin : sans lui,
-- une ancre posée sans conteneur ne serait pas vérifiable — on saurait qu'un
-- POST est peut-être parti sans pouvoir demander à la plateforme.
--
-- Alternative écartée : une table `target_publish_attempts` en journal. Plus
-- expressive, mais elle déplace la décision de la règle 15 vers une agrégation
-- (« existe-t-il une tentative démarrée ? ») là où deux colonnes NOT NULL-ables
-- sur la ligne que le worker verrouille déjà donnent la même garantie sans
-- jointure. Le journal reste possible plus tard sans casser cette ancre.
--
-- PROTECTION
-- ----------
-- `content_targets` est UPDATE/DELETE-able par tout `is_org_member` (006:206 et
-- 006:211). Sans garde, l'ancre serait effaçable depuis le navigateur — donc
-- inutile. Deux triggers ci-dessous : `authenticated` ne pose, ne modifie et
-- n'efface JAMAIS l'ancre, et ne supprime jamais une cible ancrée.

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
