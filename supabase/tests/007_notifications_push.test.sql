begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000701', 'lot0-007-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000702', 'lot0-007-owner-b@example.test'),
  ('00000000-0000-4000-8000-000000000703', 'lot0-007-reviewer-c1@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000701', 'Ocean Org 007 A', 'ocean-007-a', '00000000-0000-4000-8000-000000000701'),
  ('10000000-0000-4000-8000-000000000702', 'Ocean Org 007 B', 'ocean-007-b', '00000000-0000-4000-8000-000000000702');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000701', 'owner'),
  ('10000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000702', 'owner');

-- Deux clients dans la MEME org A. Le reviewer n'appartient qu'au client 1.
insert into public.clients (id, org_id, name, handle)
values
  ('20000000-0000-4000-8000-000000000701', '10000000-0000-4000-8000-000000000701', 'Client 007 A1', 'client-007-a1'),
  ('20000000-0000-4000-8000-000000000702', '10000000-0000-4000-8000-000000000701', 'Client 007 A2', 'client-007-a2');

insert into public.client_members (org_id, client_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000701',
  '20000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000703',
  'reviewer'
);

insert into public.notifications (id, org_id, client_id, recipient_user_id, type, title, audience, href)
values
  -- org-level, destinee a l'owner A
  ('60000000-0000-4000-8000-000000000701', '10000000-0000-4000-8000-000000000701', null, '00000000-0000-4000-8000-000000000701', 'publish_succeeded', 'Publish succeeded', 'owner', '/notifications/701'),
  -- org A, mal adressee a un user d'org B (fuite cross-org)
  ('60000000-0000-4000-8000-000000000702', '10000000-0000-4000-8000-000000000701', null, '00000000-0000-4000-8000-000000000702', 'watchdog_alert', 'Cross org should not leak', 'ops', '/notifications/702'),
  -- client 1, destinee a son reviewer : chemin nominal
  ('60000000-0000-4000-8000-000000000703', '10000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000703', 'review_requested', 'Review requested C1', 'reviewer', '/portal/703'),
  -- client 2, mal adressee au reviewer du client 1 : fuite CROSS-CLIENT (regle 8)
  ('60000000-0000-4000-8000-000000000704', '10000000-0000-4000-8000-000000000701', '20000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000703', 'review_comment', 'Cross client should not leak', 'reviewer', '/portal/704');

insert into public.push_subscriptions (id, org_id, user_id, endpoint, p256dh, auth)
values
  ('70000000-0000-4000-8000-000000000701', '10000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000701', 'https://push.example.test/701', 'p256dh-701', 'auth-701'),
  ('70000000-0000-4000-8000-000000000702', '10000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000702', 'https://push.example.test/702', 'p256dh-702', 'auth-702');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000701';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000701","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.push_subscriptions where user_id = '00000000-0000-4000-8000-000000000701'::uuid$$,
  $$values (1::bigint)$$,
  'user can read own push subscription'
);

select results_eq(
  $$select count(*)::bigint from public.push_subscriptions where user_id = '00000000-0000-4000-8000-000000000702'::uuid$$,
  $$values (0::bigint)$$,
  'user cannot read another user push subscription'
);

select lives_ok(
  $$insert into public.push_subscriptions (
      org_id,
      user_id,
      endpoint,
      p256dh,
      auth
    )
    values (
      '10000000-0000-4000-8000-000000000701',
      '00000000-0000-4000-8000-000000000701',
      'https://push.example.test/701-new',
      'p256dh-701-new',
      'auth-701-new'
    )$$,
  'user can create a push subscription for an accessible org'
);

select throws_ok(
  $$insert into public.push_subscriptions (
      org_id,
      user_id,
      endpoint,
      p256dh,
      auth
    )
    values (
      '10000000-0000-4000-8000-000000000702',
      '00000000-0000-4000-8000-000000000701',
      'https://push.example.test/701-usurped-org',
      'p256dh-701-usurped-org',
      'auth-701-usurped-org'
    )$$,
  '42501',
  'user cannot create a push subscription under an inaccessible org'
);

select results_eq(
  $$select count(*)::bigint from public.notifications where id = '60000000-0000-4000-8000-000000000701'::uuid$$,
  $$values (1::bigint)$$,
  'recipient can read own notification'
);

select results_eq(
  $$select count(*)::bigint from public.notifications where client_id is null$$,
  $$values (1::bigint)$$,
  'owner reads org-level notifications addressed to them'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000702';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000702","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.notifications where id = '60000000-0000-4000-8000-000000000702'::uuid$$,
  $$values (0::bigint)$$,
  'org B cannot read org A notification even when addressed cross-org'
);

-- Le reviewer du client 1. Il appartient a l'org A via client_members,
-- donc has_org_access(org A) est vrai pour lui : c'est exactement le trou.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000703';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000703","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.notifications where id = '60000000-0000-4000-8000-000000000703'::uuid$$,
  $$values (1::bigint)$$,
  'reviewer reads a notification scoped to their own client'
);

select results_eq(
  $$select count(*)::bigint from public.notifications where id = '60000000-0000-4000-8000-000000000704'::uuid$$,
  $$values (0::bigint)$$,
  'reviewer of client 1 cannot read a notification scoped to client 2 of the SAME org'
);

reset role;
select * from finish();

rollback;
