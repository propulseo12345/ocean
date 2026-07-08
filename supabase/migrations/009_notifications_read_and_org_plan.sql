-- GUARD-10 -- notifications.read_at etait inatteignable.
--
-- `grant select` seul + zero policy write : marquer une notification comme lue
-- etait impossible depuis le client. Fonctionnalite morte au premier cablage.
--
-- Une policy UPDATE ouvrirait TOUTES les colonnes (title, href, payload,
-- recipient_user_id...). Une RPC SECURITY DEFINER ne touche que read_at, et
-- reste scopee au destinataire.

create or replace function public.mark_notification_read(_notification uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications
  set read_at = now()
  where id = _notification
    and recipient_user_id = (select auth.uid())
    and read_at is null;

  get diagnostics v_count = row_count;

  -- false = deja lue, inexistante, ou adressee a quelqu'un d'autre.
  -- On ne distingue pas : ne pas transformer la RPC en oracle d'existence.
  return v_count > 0;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;

-- Toutes les notifications non lues du destinataire, en un appel.
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with updated as (
    update public.notifications
    set read_at = now()
    where recipient_user_id = (select auth.uid())
      and read_at is null
    returning 1
  )
  select count(*)::integer into v_count from updated;

  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- GUARD-14 -- preparer le billing sans le construire.
--
-- Stripe = V2 (PRD section 11). On ne cable RIEN aujourd'hui : ni table
-- subscriptions, ni webhook, ni feature flag par plan. Les quotas d'usage
-- (posts programmes, comptes sociaux, runs IA) se comptent par count(*) scope
-- org_id le jour venu.
--
-- Coût aujourd'hui : deux colonnes sur la table racine. Coût si on attend :
-- une migration sur la table la plus referencee du schema.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column plan text not null default 'solo',
  add column seats integer;

alter table public.organizations
  add constraint organizations_plan_known
    check (plan in ('solo', 'team', 'agency')),
  add constraint organizations_seats_positive
    check (seats is null or seats > 0);

comment on column public.organizations.plan is
  'Plan de facturation. Aucune logique attachee au Lot 0 : Stripe est en V2 (PRD 11).';
comment on column public.organizations.seats is
  'Nombre de sieges payes. NULL = non applicable (plan solo).';
