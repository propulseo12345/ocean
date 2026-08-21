-- ============================================================================
-- Rattrapage du ledger de migrations distant — ticket P0-2
--
-- ✅ APPLIQUÉ le 14/08/2026 sur `hgdeopkmkwyoumsfggrm`, sur décision explicite
--    d'Étienne (autorisation d'écriture MCP accordée en séance).
--    Contrôle après application :
--      22 lignes, `001`…`022`, aucune version intruse.
--      `get_advisors` (security) : aucun nouveau lint — 3 INFO `*_secrets`
--      deny-all (voulus) + les WARN SECURITY DEFINER préexistants +
--      auth_leaked_password_protection (à activer dans Auth > Password).
--    Rejouable tel quel (`on conflict do nothing`) : le relancer est sans effet.
--
--    Note : `apply_migration` inscrit une ligne de bookkeeping horodatée pour
--    chacun de ses appels. Les deux lignes ainsi créées (le rattrapage lui-même
--    et son nettoyage) ont été retirées par `execute_sql` — elles ne
--    correspondaient à aucun fichier de `supabase/migrations/`. Même effet qu'un
--    `supabase migration repair --status reverted`. Si tu réappliques ce fichier
--    via un outil qui journalise, pense à refaire ce ménage :
--      delete from supabase_migrations.schema_migrations
--      where version !~ '^0[0-2][0-9]$';
--
-- ---------------------------------------------------------------------------
-- POURQUOI
-- ---------------------------------------------------------------------------
-- 1. Le fichier `supabase/migrations/012_media_storage.sql` a été renuméroté en
--    `022_media_storage.sql` : il partageait le préfixe `012` avec
--    `012_media.sql`, et le CLI Supabase dérive la version des chiffres de tête
--    pour l'insérer en clé primaire. `supabase start` mourait donc sur
--    « duplicate key value violates unique constraint schema_migrations_pkey,
--    Key (version)=(012) already exists », et le job `db` de la CI (leak tests
--    pgTAP, advisors, garde *_secrets) n'a jamais tourné une seule fois.
--
-- 2. Le schéma en ligne a été construit à la main, fichier `deploy/*.sql` par
--    fichier `deploy/*.sql`, collés dans le SQL Editor. Aucun de ces fichiers
--    n'écrit dans `supabase_migrations.schema_migrations`.
--    Vérifié le 14/08/2026 par lecture seule (MCP `list_migrations` sur
--    `hgdeopkmkwyoumsfggrm`) : **le ledger distant est VIDE**.
--
--    Conséquence, et c'est le vrai danger : le jour où quelqu'un fait
--    `supabase link` puis `supabase db push` sur ce projet, le CLI considère
--    qu'AUCUNE migration n'est appliquée et rejoue les 22 fichiers sur la base
--    de PRODUCTION. Les `create type` / `create table` / `create policy` ne sont
--    pas rejouables : au mieux ça échoue à mi-chemin, au pire ça détruit.
--
--    Ce script déclare au CLI ce qui est réellement appliqué, pour qu'un futur
--    `db push` soit un no-op. C'est le prérequis pour, un jour, faire porter les
--    migrations par un canal unique et ordonné au lieu du copier-coller.
--
-- ---------------------------------------------------------------------------
-- CE QUE CE SCRIPT NE FAIT PAS
-- ---------------------------------------------------------------------------
-- Il ne touche à AUCUN objet métier : ni table, ni policy, ni fonction, ni
-- donnée. Il n'écrit que dans le schéma de service `supabase_migrations`, qui
-- n'est lu que par le CLI. Il est rejouable (`on conflict do nothing`).
--
-- ---------------------------------------------------------------------------
-- LA MANŒUVRE, DANS L'ORDRE  (étapes 1-2 : FAITES le 14/08/2026)
-- ---------------------------------------------------------------------------
--   1. Snapshot / backup du projet AVANT (Dashboard > Database > Backups).
--   2. Coller ce fichier dans le SQL Editor, l'exécuter, lire le SELECT final :
--      il doit lister 22 lignes, de 001 à 022.
--   3. RESTE À FAIRE. NE PAS lancer `supabase db push` dans la foulée. Le vérifier d'abord à
--      vide : `supabase link --project-ref hgdeopkmkwyoumsfggrm` puis
--      `supabase migration list` — les 22 versions doivent apparaître des DEUX
--      côtés (Local | Remote). Si une seule ligne n'a pas son pendant distant,
--      s'arrêter et comprendre pourquoi avant d'aller plus loin.
--   4. Toute migration future : d'abord verte dans le job `db` de la CI
--      (`supabase db reset` depuis zéro + pgTAP), ensuite seulement en ligne.
--
-- ---------------------------------------------------------------------------
-- CORRESPONDANCE VERSION <-> CE QUI A ÉTÉ RÉELLEMENT COLLÉ EN LIGNE
-- ---------------------------------------------------------------------------
--   001..009  -> deploy/01_schema.sql (bootstrap Lot 0)
--   010       -> deploy/03_migration_010.sql
--   011       -> deploy/04_migration_011.sql
--   012 + 022 -> deploy/05_migration_012.sql  (ce fichier contenait DÉJÀ les deux
--                parties : les tables média ET les buckets + policies storage ;
--                c'est exactement la raison d'être des deux fichiers 012_media.sql
--                et 012_media_storage.sql côté dépôt)
--   013..021  -> deploy/06_migration_013.sql .. deploy/16_migration_021.sql
--
-- Note sur la policy `media_thumbs_select_public` : créée par la partie storage,
-- puis supprimée par la migration 017 (advisor 0025, listing des vignettes de
-- contenu non publié). Comme `022_media_storage.sql` s'applique désormais APRÈS
-- 017, sa création a été retirée du fichier — sans quoi chaque `db reset` ferait
-- resurgir la fuite. L'état final d'un rejeu depuis zéro est donc identique à
-- l'état en ligne : aucune action supplémentaire ici.
-- ============================================================================

begin;

-- Le schéma/table de service existe dès qu'un projet a été lié une fois ; ici il
-- ne l'a jamais été. On le crée avec la forme attendue par le CLI.
create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key
);

-- Colonnes ajoutées par les versions successives du CLI : idempotent.
alter table supabase_migrations.schema_migrations
  add column if not exists statements text[];
alter table supabase_migrations.schema_migrations
  add column if not exists name text;

insert into supabase_migrations.schema_migrations (version, name) values
  ('001', 'extensions_schema_utils'),
  ('002', 'enums'),
  ('003', 'identity_orgs'),
  ('004', 'clients_members'),
  ('005', 'accounts_shell'),
  ('006', 'content_core'),
  ('007', 'notifications_push'),
  ('008', 'content_status_guard'),
  ('009', 'notifications_read_and_org_plan'),
  ('010', 'cablage_foundations'),
  ('011', 'editorial_config'),
  ('012', 'media'),
  ('013', 'collaboration'),
  ('014', 'feed_performance'),
  ('015', 'agenda'),
  ('016', 'transitions'),
  ('017', 'advisor_hardening'),
  ('018', 'report_shares'),
  ('019', 'integration_secrets'),
  ('020', 'publish_jobs'),
  ('021', 'secdef_grants_hardening'),
  ('022', 'media_storage')
on conflict (version) do nothing;

commit;

-- Contrôle : 22 lignes attendues, de 001 à 022, sans trou.
select version, name
from supabase_migrations.schema_migrations
order by version;
