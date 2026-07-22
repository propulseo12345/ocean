-- Migration 018 — partage public d'un rapport client (lien en lecture seule).
--
-- Modèle SNAPSHOT : à la création, l'owner (accès RLS) calcule le rapport et le
-- fige dans `payload` (jsonb). Un rapport mensuel est un livrable daté — le geler
-- est plus correct qu'un lien « live », et surtout BEAUCOUP plus sûr : le viewer
-- anonyme ne touche JAMAIS les tables métier, seulement le payload figé de SON
-- partage. Anti-fuite : la Server Action retire les notes internes du payload.
--
-- Le viewer lit via la RPC SECURITY DEFINER get_report_share(token_hash), seule
-- surface exposée à anon. Le token (256 bits) n'est jamais stocké en clair : seul
-- son sha256 vit en base. Pas d'énumération possible.

create table if not exists public.report_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null,
  token_hash text not null unique,
  payload jsonb not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- FK composite : un partage ne peut pointer que vers un client de son org.
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade
);

create index if not exists report_shares_client_idx
  on public.report_shares (client_id, created_at desc);
create index if not exists report_shares_org_id_idx on public.report_shares (org_id);

alter table public.report_shares enable row level security;

-- Owner de l'org : gère les partages de ses propres clients (jamais anon).
create policy report_shares_select on public.report_shares
for select to authenticated
using ((select private.is_org_member(org_id)));

create policy report_shares_insert on public.report_shares
for insert to authenticated
with check (
  (select private.is_org_member(org_id)) and created_by = (select auth.uid())
);

create policy report_shares_update on public.report_shares
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));

create policy report_shares_delete on public.report_shares
for delete to authenticated
using ((select private.is_org_member(org_id)));

revoke all on public.report_shares from anon, authenticated;
grant select, insert, update, delete on public.report_shares to authenticated;
grant select, insert, update, delete on public.report_shares to service_role;

-- RPC anon : renvoie le payload d'un partage valide (non révoqué, non expiré).
-- SECURITY DEFINER contourne la RLS À DESSEIN : c'est un lien public. La sûreté
-- vient (1) du token 256 bits inguessable, (2) du payload pré-assaini figé pour
-- CE client uniquement, (3) de l'absence de tout autre accès pour anon.
--
-- ⚠️ get_advisors signalera cette fonction (SECURITY DEFINER exposée à anon,
-- lints 0028/0029) : c'est une EXCEPTION VOULUE, contrairement aux autres RPC
-- verrouillées en 017. Ne PAS « corriger » en retirant anon — ce serait casser
-- le partage public. search_path figé + tables entièrement qualifiées.
create or replace function public.get_report_share(_token_hash text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select rs.payload
  from public.report_shares rs
  where rs.token_hash = _token_hash
    and rs.revoked_at is null
    and (rs.expires_at is null or rs.expires_at > now())
$$;

revoke execute on function public.get_report_share(text) from public;
grant execute on function public.get_report_share(text) to anon, authenticated;
