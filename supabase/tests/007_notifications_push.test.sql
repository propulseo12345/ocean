begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000701', 'lot0-007-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000000702', 'lot0-007-owner-b@example.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000701', 'Ocean Org 007 A', 'ocean-007-a', '00000000-0000-4000-8000-000000000701'),
  ('10000000-0000-4000-8000-000000000702', 'Ocean Org 007 B', 'ocean-007-b', '00000000-0000-4000-8000-000000000702');

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000701', 'owner'),
  ('10000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000702', 'owner');

insert into public.notifications (id, org_id, recipient_user_id, type, title, audience, href)
values
  ('60000000-0000-4000-8000-000000000701', '10000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000701', 'publish_succeeded', 'Publish succeeded', 'owner', '/notifications/701'),
  ('60000000-0000-4000-8000-000000000702', '10000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000702', 'watchdog_alert', 'Cross org should not leak', 'ops', '/notifications/702');

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

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000702';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000702","role":"authenticated"}';

select results_eq(
  $$select count(*)::bigint from public.notifications where id = '60000000-0000-4000-8000-000000000702'::uuid$$,
  $$values (0::bigint)$$,
  'org B cannot read org A notification even when addressed cross-org'
);

reset role;
select * from finish();

rollback;
