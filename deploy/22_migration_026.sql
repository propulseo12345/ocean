-- Migration 026 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis : 023.
-- Genere depuis supabase/migrations/026_target_delete_guard.sql.
--
-- OBJET : etendre la garde de suppression de 023 au cas ou l'ancre de la regle 15
-- n'existe que sur un JOB (donnee heritee d'un worker anterieur a 023).
--
-- ⚠ LIRE L'EN-TETE DE LA MIGRATION : le ticket P3-8 demandait de passer la FK
-- publish_jobs.content_target_id en `on delete restrict`. Ce n'est PAS fait, et
-- c'est deliberе — 023 a traite le motif a la source, et `restrict` casserait
-- `reconcileTargets` (perte silencieuse des modifications de ciblage). La bascule
-- est ci-dessous, EN COMMENTAIRE, si tu preferes malgre tout.
--
-- Idempotent (create or replace seul). Rejouable sans risque.

create or replace function private.content_targets_guard_anchor_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchored boolean;
begin
  -- Bypass worker / service_role — même ancre d'autorité que 008 / 013 / 023.
  if coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') = ''
     or coalesce(
          pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
          ''
        ) = 'service_role'
  then
    return old;
  end if;

  -- Ancre de la cible (023), OU ancre résiduelle portée par un job. La seconde
  -- ne devrait jamais exister seule ; la garde n'a pas à le parier.
  v_anchored := old.publish_started_at is not null
    or exists (
      select 1 from public.publish_jobs j
      where j.content_target_id = old.id
        and j.publish_started_at is not null
    );

  if not v_anchored then
    return old;
  end if;

  raise exception
    'content_targets: cible % non supprimable — une publication a peut-etre eu lieu (regle 15)', old.id
    using errcode = '42501';
end;
$$;

revoke all on function private.content_targets_guard_anchor_delete() from public;

comment on function private.content_targets_guard_anchor_delete() is
  'Regle 15 : interdit a authenticated de supprimer une cible dont une publication a peut-etre eu lieu (ancre sur la cible OU sur un de ses jobs).';

-- ---------------------------------------------------------------------------
-- OPTION, NON APPLIQUEE — FK stricte, telle que le ticket P3-8 la demandait.
-- A n'executer QU'APRES avoir rendu reconcileTargets transactionnel et lecteur
-- de ses erreurs (ticket P5-3). En l'etat, ces trois lignes font perdre en
-- silence les modifications de ciblage de tout contenu repasse en brouillon.
--
--   alter table public.publish_jobs
--     drop constraint publish_jobs_content_target_id_client_id_fkey,
--     add foreign key (content_target_id, client_id)
--       references public.content_targets(id, client_id) on delete restrict;
-- ---------------------------------------------------------------------------
