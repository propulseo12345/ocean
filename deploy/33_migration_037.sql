-- Migration 037 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor). Prerequis :
-- 020 (publish_jobs), 001 (schema private).
--
-- ⚠ CORRECTION DU 15/08/2026 : l'en-tete affirmait « extension pg_net deja
-- installee ». C'ETAIT FAUX — verifie au pre-vol, `pg_net` n'etait installee ni
-- en ligne ni en local. La migration l'installe desormais elle-meme (voir le
-- bloc des extensions plus bas).
--
-- ⚠ NON APPLIQUEE. Copie de rejeu, generee depuis
-- supabase/migrations/037_watchdog_publish_jobs.sql — la SOURCE CANONIQUE est
-- ce fichier-la. Differer les deux avant toute execution : `deploy/31` avait
-- ete trouve corrompu le 15/08 alors que ses 10 tests pgTAP passaient (ils
-- mesurent supabase/migrations/, jamais deploy/).
--
-- PRE-VOL, dans cet ordre :
--   1. `select * from pg_available_extensions where name = 'pg_cron';` — sur le
--      projet en ligne, l'extension doit etre ACTIVABLE. Si `create extension`
--      echoue, tout le reste du fichier echoue avec lui : l'executer seul
--      d'abord.
--   2. Baseline `anon` relevee AVANT : elle ne doit PAS monter apres. Les
--      default privileges Supabase accordent EXECUTE a anon sur toute fonction
--      creee dans `public`, et `revoke from public` seul NE SUFFIT PAS — c'est
--      exactement d'ou venait la faille Vault de la 021. Le fichier fait le
--      revoke explicite ; le verifier quand meme.
--   3. Apres application : `select jobname, schedule, active from cron.job;`
--      doit montrer `ocean-watchdog-publish-jobs` toutes les 5 minutes.
--   4. Ledger : insert into supabase_migrations.schema_migrations
--      (version, name) values ('037','watchdog_publish_jobs');
--
-- APRES LA MIGRATION, DEUX GESTES HORS SQL, sans lesquels le watchdog detecte
-- sans prevenir personne :
--   a. deployer l'Edge Function : `supabase functions deploy watchdog-notify` ;
--   b. poser les deux secrets Vault que lit la fonction :
--        select vault.create_secret(
--          'https://hgdeopkmkwyoumsfggrm.supabase.co/functions/v1/watchdog-notify',
--          'watchdog_edge_url', 'URL de l Edge Function watchdog');
--        select vault.create_secret('<service_role_key>',
--          'watchdog_service_role_key', 'Cle de service pour appeler le watchdog');
--      Tant qu'ils manquent, `watchdog_publish_jobs()` marque les jobs, emet un
--      NOTICE et rend le compte — sans appeler personne. C'est voulu : un
--      watchdog non configure doit rester silencieux et vert, pas faire echouer
--      le cron toutes les 5 minutes.
--
-- Migration 037 — Le watchdog : le SEUL filet indépendant du worker.
--
-- POURQUOI IL MANQUAIT, ET CE QUE SON ABSENCE COÛTAIT
-- ----------------------------------------------------
-- Tous les filets existants vivent DANS le worker : le reaper, le heartbeat,
-- le compteur d'échecs de tick. Ils supposent tous que le worker tourne. Un
-- worker mort, un conteneur qui ne redémarre pas, une `DATABASE_URL` révoquée —
-- et plus personne ne regarde la file. Les jobs restent `scheduled`, l'heure
-- passe, et le premier à s'en apercevoir est le client qui ne voit pas son post.
-- Trois commentaires du dépôt renvoyaient déjà « au watchdog pg_cron », qui
-- n'existait pas (P3-7, P4-4).
--
-- pg_cron est trop fragile pour PUBLIER (pas de lease, pas de reprise, pas
-- d'idempotence — anti-pattern CLAUDE.md §8). Il est parfait pour SURVEILLER :
-- il tourne dans Postgres, donc il survit exactement à ce que le worker ne
-- survit pas.
--
-- CE QUE CETTE MIGRATION CONTIENT
--   1. `publish_jobs.watchdog_alerted_at` — sans elle, l'alerte repart toutes
--      les 5 minutes sur le même job, indéfiniment, et devient du bruit qu'on
--      apprend à ignorer. Un watchdog qu'on ignore ne sert à rien.
--   2. `private.late_publish_jobs()` — la DÉCISION, en SQL pur, donc testable
--      par pgTAP sans réseau ni cron.
--   3. `public.watchdog_publish_jobs()` — l'EFFET : marque et appelle l'Edge
--      Function. Dégradation propre si elle n'est pas configurée.
--   4. La planification pg_cron, toutes les 5 minutes.
--
-- ⚠ CE QUI N'EST PAS ICI : l'envoi de l'e-mail lui-même. Il vit dans l'Edge
-- Function `watchdog-notify` et attend `BREVO_API_KEY`. Le chemin SQL est
-- complet et vérifiable dès maintenant ; le dernier maillon attend un compte.

-- ⚠ LES DEUX EXTENSIONS, PAS UNE. Corrigé le 15/08/2026 au pré-vol : `pg_net`
-- n'était PAS installée sur hgdeopkmkwyoumsfggrm, alors que
-- `watchdog_publish_jobs()` appelle `net.http_post`. Invisible partout — plpgsql
-- ne résout pas `net.*` à la création, la fonction sort avant l'appel tant que
-- les secrets Vault manquent, et les tests pgTAP n'atteignent jamais le réseau.
-- La panne serait tombée au geste (b) ci-dessus, au moment exact où l'on croit
-- finir l'installation.
-- ⚠ `with schema extensions` : sans lui, l'avis Supabase `extension_in_public`
-- se declenche (constate en ligne le 15/08/2026). Les fonctions vont dans le
-- schema `net` dans les deux cas — c'est le schema d'ENREGISTREMENT qui change.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ===========================================================================
-- 1. Anti-répétition
-- ===========================================================================

alter table public.publish_jobs
  add column if not exists watchdog_alerted_at timestamptz;

comment on column public.publish_jobs.watchdog_alerted_at is
  'Dernière alerte watchdog émise pour ce job. Ré-alerte au plus une fois par '
  'heure : sans ce garde-fou, un job bloqué produirait 288 e-mails par jour.';

-- ===========================================================================
-- 2. La décision — SQL pur, testable
-- ===========================================================================

-- Un job est EN RETARD quand il est dû depuis plus de deux minutes et que
-- PERSONNE ne l'a réclamé. Le seuil est volontairement supérieur à l'intervalle
-- de tick (5 s) et au temps de traitement normal : en deçà, on alerterait sur
-- un worker parfaitement sain qui vide simplement son lot.
--
-- Les statuts `claimed` et `publishing` sont EXCLUS à dessein : un job réclamé
-- est entre les mains d'un worker vivant, et son cas est celui du reaper (lease
-- expiré), pas celui du watchdog. Les inclure ferait alerter sur chaque
-- publication un peu longue — un Reel de 200 Mo, typiquement.
create or replace function private.late_publish_jobs(
  _late_after interval default interval '2 minutes',
  _realert_after interval default interval '1 hour'
)
returns table (
  id uuid,
  org_id uuid,
  client_id uuid,
  content_item_id uuid,
  platform public.platform,
  status public.publish_job_status,
  run_at timestamptz,
  late_by_seconds integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id,
         j.org_id,
         j.client_id,
         j.content_item_id,
         j.platform,
         j.status,
         j.run_at,
         (extract(epoch from (now() - j.run_at)))::integer as late_by_seconds
  from public.publish_jobs j
  where j.status in ('scheduled', 'retrying', 'awaiting_media')
    and j.run_at < now() - _late_after
    -- `next_attempt_at` dans le futur = backoff NORMAL après un échec, pas un
    -- retard. Sans cette clause, chaque retry légitime déclencherait une alerte.
    and (j.next_attempt_at is null or j.next_attempt_at <= now())
    and (j.watchdog_alerted_at is null or j.watchdog_alerted_at < now() - _realert_after)
  order by j.run_at
  limit 100
$$;

revoke all on function private.late_publish_jobs(interval, interval) from public;

-- ===========================================================================
-- 3. L'effet — marquer, puis appeler l'Edge Function
-- ===========================================================================

-- La configuration vient de Vault, PAS d'une table : l'URL de la fonction et la
-- clé de service sont des secrets (règle 12). Absentes, la fonction ne fait
-- rien et le dit — un watchdog non configuré doit rester silencieux et vert,
-- surtout pas faire échouer le cron toutes les 5 minutes.
create or replace function public.watchdog_publish_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jobs jsonb;
  v_count integer;
  v_url text;
  v_key text;
begin
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb), count(*)
    into v_jobs, v_count
  from private.late_publish_jobs() t;

  if v_count = 0 then
    return 0;
  end if;

  -- On MARQUE avant d'appeler. Si l'appel échoue, la ré-alerte est reportée
  -- d'une heure : mieux qu'une boucle d'échecs qui ré-émettrait à chaque tick.
  update public.publish_jobs
     set watchdog_alerted_at = now()
   where id in (select (x ->> 'id')::uuid from jsonb_array_elements(v_jobs) x);

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'watchdog_edge_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'watchdog_service_role_key';

  if v_url is null or v_key is null then
    raise notice 'watchdog: % job(s) en retard, mais aucune destination configuree '
                 '(secrets Vault watchdog_edge_url / watchdog_service_role_key)', v_count;
    return v_count;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object('late_jobs', v_jobs, 'count', v_count),
    timeout_milliseconds := 10000
  );
  return v_count;
end;
$$;

-- Baseline de sécurité : `anon` ne doit avoir EXECUTE sur AUCUNE nouvelle
-- fonction SECURITY DEFINER. Les default privileges Supabase l'accordent
-- pourtant à anon/authenticated sur toute fonction créée dans `public` — un
-- `revoke from public` seul ne suffit PAS (c'est exactement d'où venait la
-- faille Vault de la migration 021).
revoke execute on function public.watchdog_publish_jobs() from public, anon, authenticated;
grant execute on function public.watchdog_publish_jobs() to service_role;

comment on function public.watchdog_publish_jobs() is
  'Watchdog pg_cron : detecte les jobs dus non reclames et notifie. '
  'Le seul filet independant du worker. Ne publie JAMAIS (anti-pattern §8).';

-- ===========================================================================
-- 4. Planification
-- ===========================================================================

-- `cron.schedule` remplace la tâche portant le même nom (pg_cron >= 1.4) : la
-- migration est donc rejouable sans erreur de doublon.
select cron.schedule(
  'ocean-watchdog-publish-jobs',
  '*/5 * * * *',
  $cron$select public.watchdog_publish_jobs()$cron$
);
