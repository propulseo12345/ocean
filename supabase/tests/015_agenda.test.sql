begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

-- ===========================================================================
-- Seed : org A avec DEUX membres (UA owner, UA2 admin) — c'est le cas de
-- régression propre à ce domaine : deux membres de la MÊME org ne doivent PAS
-- voir leurs agendas respectifs. + reviewer UR + org B.
-- ===========================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000015001', 'ua@015.test'),
  ('00000000-0000-4000-8000-000000015002', 'ua2@015.test'),
  ('00000000-0000-4000-8000-000000015003', 'ur@015.test'),
  ('00000000-0000-4000-8000-000000015004', 'ub@015.test');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000015001', 'Org A 015', 'org-a-015', '00000000-0000-4000-8000-000000015001'),
  ('10000000-0000-4000-8000-000000015002', 'Org B 015', 'org-b-015', '00000000-0000-4000-8000-000000015004');

insert into public.organization_members (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', 'owner'),
  ('10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015002', 'admin'),
  ('10000000-0000-4000-8000-000000015002', '00000000-0000-4000-8000-000000015004', 'owner');

insert into public.clients (id, org_id, name, handle) values
  ('20000000-0000-4000-8000-000000015001', '10000000-0000-4000-8000-000000015001', 'Client A1 015', 'client-a1-015');

insert into public.client_members (org_id, client_id, user_id, role) values
  ('10000000-0000-4000-8000-000000015001', '20000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015003', 'reviewer');

-- Agenda de UA (avec un calendrier « Perso ») et agenda de UA2.
insert into public.calendar_accounts (id, org_id, user_id, provider, provider_account_id, email) values
  ('70000000-0000-4000-8000-000000015001', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', 'google', 'g-ua', 'ua@gmail.test'),
  ('70000000-0000-4000-8000-000000015002', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015002', 'microsoft', 'm-ua2', 'ua2@outlook.test');

insert into public.calendar_calendars (id, org_id, user_id, calendar_account_id, external_calendar_id, name, is_enabled) values
  ('71000000-0000-4000-8000-000000015001', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', '70000000-0000-4000-8000-000000015001', 'perso@group.calendar', 'Perso', true),
  ('71000000-0000-4000-8000-000000015002', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', '70000000-0000-4000-8000-000000015001', 'feries@group.calendar', 'Jours fériés', false),
  ('71000000-0000-4000-8000-000000015003', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015002', '70000000-0000-4000-8000-000000015002', 'ua2@outlook', 'Bureau UA2', true);

insert into public.calendar_events (id, org_id, user_id, calendar_id, external_id, title, all_day, starts_at, ends_at, start_date, last_sync_run_id) values
  ('72000000-0000-4000-8000-000000015001', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', '71000000-0000-4000-8000-000000015001', 'ev-yoga', 'Cours de yoga', false, '2026-07-22T18:00:00Z', '2026-07-22T19:00:00Z', null, gen_random_uuid()),
  -- all-day (start_date, jamais de timestamptz) sur un calendrier DÉSACTIVÉ :
  -- ne doit pas sortir de la vue.
  ('72000000-0000-4000-8000-000000015002', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', '71000000-0000-4000-8000-000000015002', 'ev-ferie', 'Jour férié', true, null, null, '2026-07-24', gen_random_uuid()),
  ('72000000-0000-4000-8000-000000015003', '10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015002', '71000000-0000-4000-8000-000000015003', 'ev-ua2', 'Réunion UA2', false, '2026-07-22T10:00:00Z', '2026-07-22T11:00:00Z', null, gen_random_uuid());

-- Un contenu programmé (branche « publication » de la vue).
insert into public.content_items (id, org_id, client_id, title, status, scheduled_at) values
  ('35000000-0000-4000-8000-000000015001', '10000000-0000-4000-8000-000000015001', '20000000-0000-4000-8000-000000015001', 'Post programmé', 'scheduled', '2026-07-23T09:00:00Z');

-- ===========================================================================
-- 1. Contraintes all-day / timé
-- ===========================================================================

select throws_ok(
  $$insert into public.calendar_events (org_id, user_id, calendar_id, external_id, all_day, starts_at, start_date, last_sync_run_id)
    values ('10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', '71000000-0000-4000-8000-000000015001', 'ev-mix', true, '2026-07-25T09:00:00Z', '2026-07-25', gen_random_uuid())$$,
  '23514', null,
  'calendar_events refuse de mélanger all-day (date) et timé (timestamptz)');

select throws_ok(
  $$insert into public.calendar_accounts (org_id, user_id, provider, provider_account_id, email)
    values ('10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015001', 'instagram', 'ig-x', 'x@test')$$,
  '23514', null,
  'calendar_accounts refuse un provider social (google/microsoft uniquement)');

select throws_ok(
  $$insert into public.calendar_accounts (org_id, user_id, provider, provider_account_id, email)
    values ('10000000-0000-4000-8000-000000015001', '00000000-0000-4000-8000-000000015004', 'google', 'g-ub', 'ub@test')$$,
  '23503', null,
  'calendar_accounts refuse un user non membre de l org (FK composite org_members)');

-- ===========================================================================
-- 2. LA régression du domaine : deux membres de la MÊME org sont isolés.
-- ===========================================================================

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015001';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000015001","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.calendar_accounts$$,
  $$values (1)$$,
  'UA ne voit QUE son propre compte d agenda (pas celui de UA2, même org)');

select results_eq(
  $$select count(*)::int from public.calendar_calendars where user_id = '00000000-0000-4000-8000-000000015002'$$,
  $$values (0)$$,
  'UA ne voit AUCUN calendrier de UA2 (même org)');

select results_eq(
  $$select count(*)::int from public.calendar_events where user_id = '00000000-0000-4000-8000-000000015002'$$,
  $$values (0)$$,
  'UA ne voit AUCUN événement de UA2 — le calendrier « Perso » ne fuit pas');

-- La vue : événements de UA (calendrier activé seulement) + publications de l org.
select results_eq(
  $$select count(*)::int from public.unified_agenda where kind = 'event'$$,
  $$values (1)$$,
  'unified_agenda : 1 seul événement (calendrier désactivé exclu, UA2 exclu)');

select results_eq(
  $$select count(*)::int from public.unified_agenda where kind = 'publication'$$,
  $$values (1)$$,
  'unified_agenda : la publication programmée apparaît (owner_user_id NULL, pas filtrée)');

reset role;

-- UA2 : symétrique.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015002';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000015002","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.calendar_events$$,
  $$values (1)$$,
  'UA2 ne voit que son propre événement (isolation symétrique)');

reset role;

-- Reviewer : aucune ligne (pas membre d org).
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000015003';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000015003","role":"authenticated"}';

select results_eq(
  $$select (select count(*) from public.calendar_accounts)::int
        + (select count(*) from public.calendar_calendars)::int
        + (select count(*) from public.calendar_events)::int$$,
  $$values (0)$$,
  'reviewer : 0 ligne d agenda (exclu par construction, aucune org)');

reset role;

-- ===========================================================================
-- 3. Grants : secrets deny-all, toggle colonne, TRUNCATE
-- ===========================================================================

select is(
  has_table_privilege('authenticated', 'public.calendar_account_secrets', 'SELECT'),
  false,
  'calendar_account_secrets : DENY-ALL, aucun SELECT pour authenticated');

select is(
  has_column_privilege('authenticated', 'public.calendar_calendars', 'is_enabled', 'UPDATE'),
  true,
  'le toggle is_enabled est écrivable par l utilisateur (grant colonne)');

select is(
  has_column_privilege('authenticated', 'public.calendar_calendars', 'name', 'UPDATE'),
  false,
  'le nom du calendrier N EST PAS écrivable (il vient du provider)');

select results_eq(
  $$select count(*)::int from (values
      ('public.calendar_accounts'), ('public.calendar_account_secrets'),
      ('public.calendar_calendars'), ('public.calendar_events')
    ) as t(name)
    where has_table_privilege('authenticated', t.name, 'TRUNCATE')$$,
  $$values (0)$$,
  'GUARD-05 : TRUNCATE refusé sur toutes les tables agenda');

select * from finish();

rollback;
