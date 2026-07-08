begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000901', 'lot0-009-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000902', 'lot0-009-owner-b@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000901', 'Ocean Org 009 A', 'ocean-009-a', '00000000-0000-4000-8000-000000000901'),
  ('10000000-0000-4000-8000-000000000902', 'Ocean Org 009 B', 'ocean-009-b', '00000000-0000-4000-8000-000000000902');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000901', 'owner'),
  ('10000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000902', 'owner');

insert into public.notifications (id, org_id, recipient_user_id, type, title, audience, href)
values
  ('60000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000901', 'publish_succeeded', 'Mine',            'owner', '/n/901'),
  ('60000000-0000-4000-8000-000000000902', '10000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000901', 'publish_failed',    'Mine too',        'owner', '/n/902'),
  ('60000000-0000-4000-8000-000000000903', '10000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000902', 'watchdog_alert',    'Not mine',        'ops',   '/n/903');

-- GUARD-14 : la colonne existe, avec le defaut attendu.
-- `o.plan` qualifie : `plan` est aussi le nom de la fonction pgTAP plan(N).
select results_eq(
  $$select o.plan from public.organizations o
    where o.id = '10000000-0000-4000-8000-000000000901'::uuid$$,
  $$values ('solo'::text)$$,
  'organizations.plan defaults to solo'
);

select throws_ok(
  $$update public.organizations set plan = 'enterprise'
    where id = '10000000-0000-4000-8000-000000000901'::uuid$$,
  '23514',
  'organizations.plan rejects an unknown plan'
);

-- ---------------------------------------------------------------------------
-- GUARD-10 : la RPC est le SEUL chemin d'ecriture de read_at.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}';

-- Pas de policy UPDATE : l'UPDATE direct n'affecte aucune ligne.
select results_eq(
  $$with updated as (
      update public.notifications set read_at = now()
      where id = '60000000-0000-4000-8000-000000000901'::uuid
      returning id
    )
    select count(*)::bigint from updated$$,
  $$values (0::bigint)$$,
  'authenticated cannot UPDATE notifications directly (no write policy)'
);

select results_eq(
  $$select public.mark_notification_read('60000000-0000-4000-8000-000000000901'::uuid)$$,
  $$values (true)$$,
  'recipient marks their own notification as read via RPC'
);

-- La RPC est SECURITY DEFINER : elle contourne la RLS. Son seul garde-fou est
-- `recipient_user_id = auth.uid()`. Sans lui, on lirait/ecrirait cross-user.
select results_eq(
  $$select public.mark_notification_read('60000000-0000-4000-8000-000000000903'::uuid)$$,
  $$values (false)$$,
  'RPC refuses a notification addressed to another user'
);

-- Une seule reste non lue (la 902) : la 901 vient d'etre marquee, la 903 n'est
-- pas la sienne.
select results_eq(
  $$select public.mark_all_notifications_read()$$,
  $$values (1)$$,
  'mark_all only affects the caller unread notifications'
);

reset role;
select * from finish();

rollback;
