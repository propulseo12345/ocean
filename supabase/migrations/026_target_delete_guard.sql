-- Migration 026 — Renforcer la garde de suppression d'une cible (ticket P3-8).
--
-- CE QUE LE TICKET DEMANDAIT, ET POURQUOI ÇA N'EST PAS FAIT TEL QUEL
-- ------------------------------------------------------------------
-- Le ticket demandait de passer la FK `publish_jobs.content_target_id` de
-- `on delete cascade` à `on delete restrict`, au motif que supprimer une cible
-- efface l'ancre de la règle 15 hors de toute RLS.
--
-- Ce motif est exact, mais il a été traité à la source par la migration 023 :
-- l'ancre ne vit plus sur la ligne de job, elle vit sur `content_targets`. La
-- supprimer n'est plus un effet de bord d'une FK, c'est une suppression directe,
-- et 023 pose déjà un `before delete` qui la refuse à `authenticated`.
--
-- Passer la FK en `restrict` aujourd'hui ne fermerait donc plus rien — mais
-- casserait un chemin normal. Vérifié dans le conteneur ocean_rev2, sur le
-- schéma réel :
--
--   `reconcileTargets` (lib/actions/content.ts:203) fait un DELETE de TOUTES les
--   cibles du contenu dès que celui-ci est en idea/draft/changes_requested.
--   Or `cancel_publish_jobs` ne supprime pas les jobs, elle les passe `canceled`
--   — la ligne survit. Avec `restrict`, ce DELETE lèverait 23503 ; et comme
--   `reconcileTargets` ne lit AUCUNE de ses erreurs (P5-3), l'INSERT suivant se
--   ferait rejeter par `content_targets_item_account_idx` et les modifications de
--   ciblage de l'utilisateur seraient perdues EN SILENCE, avec un toast de succès.
--
--   Mesure faite : org member, cible non ancrée, job `canceled` →
--   `DELETE 1`, jobs restants 0. C'est ce chemin qui casserait.
--
-- On échangerait un trou déjà bouché contre une perte de données silencieuse.
-- La FK reste donc `cascade`, et la protection est rendue PLUS PRÉCISE.
--
-- CE QUI EST FAIT ICI
-- -------------------
-- La garde de 023 refuse la suppression quand `content_targets.publish_started_at`
-- est posé. Elle est étendue au cas résiduel : un JOB ancré dont la cible ne
-- l'est pas. Le backfill de 023 rend ce cas impossible sur les données
-- existantes, et `markPublishStarted` écrit désormais les deux ancres dans une
-- seule transaction — mais la garde ne doit pas dépendre de ces deux faits pour
-- être correcte. C'est exactement la protection que `restrict` visait, sans son
-- effet de bord.
--
-- ⚠ Si Étienne préfère malgré tout la FK stricte, la bascule tient en trois
-- lignes (voir deploy/22_migration_026.sql, section commentée) — mais elle exige
-- d'avoir d'abord rendu `reconcileTargets` transactionnel et lecteur de ses
-- erreurs (ticket P5-3).

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
