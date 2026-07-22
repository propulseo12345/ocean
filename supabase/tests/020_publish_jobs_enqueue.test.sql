-- Test 020b — enqueue_publish_jobs / cancel_publish_jobs (app-driven, idempotent).
--
-- Prouve : (1) l'enfilement cree un job par cible API ; (2) rappeler l'enfilement
-- ne duplique PAS (regle 16, index unique partiel) ; (3) l'annulation retire les
-- jobs non demarres. Appele en contexte owner (authenticated) : les fonctions
-- SECURITY DEFINER inserent malgre le deny-all d'ecriture, apres is_org_member.

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-0000000020b1', 'lot2-020b-owner@example.test');

insert into public.organizations (id, name, slug, created_by)
values ('10000000-0000-4000-8000-0000000020b1', 'Ocean Org 020b', 'ocean-020b', '00000000-0000-4000-8000-0000000020b1');

insert into public.organization_members (org_id, user_id, role)
values ('10000000-0000-4000-8000-0000000020b1', '00000000-0000-4000-8000-0000000020b1', 'owner');

insert into public.clients (id, org_id, name, handle)
values ('20000000-0000-4000-8000-0000000020b1', '10000000-0000-4000-8000-0000000020b1', 'Client 020b', 'client-020b');

insert into public.platform_connections (id, org_id, provider, provider_account_id)
values ('30000000-0000-4000-8000-0000000020b1', '10000000-0000-4000-8000-0000000020b1', 'instagram', 'ig-conn-020b');

insert into public.social_accounts (id, org_id, client_id, platform_connection_id, platform, provider_account_id, username)
values ('40000000-0000-4000-8000-0000000020b1', '10000000-0000-4000-8000-0000000020b1', '20000000-0000-4000-8000-0000000020b1', '30000000-0000-4000-8000-0000000020b1', 'instagram', 'ig-acct-020b', 'client020b');

insert into public.content_items (id, org_id, client_id, status, scheduled_at)
values ('50000000-0000-4000-8000-0000000020b1', '10000000-0000-4000-8000-0000000020b1', '20000000-0000-4000-8000-0000000020b1', 'scheduled', now() + interval '2 hours');

-- Cible API en attente (statut 'pending' : enqueue doit la passer 'queued').
insert into public.content_targets (id, org_id, client_id, content_item_id, social_account_id, platform, status)
values ('60000000-0000-4000-8000-0000000020b1', '10000000-0000-4000-8000-0000000020b1', '20000000-0000-4000-8000-0000000020b1', '50000000-0000-4000-8000-0000000020b1', '40000000-0000-4000-8000-0000000020b1', 'instagram', 'pending');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000020b1';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-0000000020b1","role":"authenticated"}';

-- 1) Premier enfilement : 1 cible -> 1 job.
select is(
  (select public.enqueue_publish_jobs('50000000-0000-4000-8000-0000000020b1')),
  1,
  'enqueue cree 1 job pour la cible API'
);

-- 2) Un seul job actif pour le contenu.
select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_item_id = '50000000-0000-4000-8000-0000000020b1'::uuid
      and status in ('scheduled','claimed','awaiting_media','publishing','retrying')$$,
  $$values (1::bigint)$$,
  'un seul job actif apres enfilement'
);

-- 3) Rappeler l'enfilement (reprogrammation) ne duplique PAS (regle 16).
select public.enqueue_publish_jobs('50000000-0000-4000-8000-0000000020b1');
select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_item_id = '50000000-0000-4000-8000-0000000020b1'::uuid
      and status in ('scheduled','claimed','awaiting_media','publishing','retrying')$$,
  $$values (1::bigint)$$,
  'rappeler enqueue ne duplique pas le job (idempotent)'
);

-- 4) Annulation : le job non demarre passe canceled.
select public.cancel_publish_jobs('50000000-0000-4000-8000-0000000020b1');
select results_eq(
  $$select count(*)::bigint from public.publish_jobs
    where content_item_id = '50000000-0000-4000-8000-0000000020b1'::uuid
      and status in ('scheduled','claimed','awaiting_media','publishing','retrying')$$,
  $$values (0::bigint)$$,
  'cancel retire le job non demarre'
);

reset role;
select * from finish();

rollback;
