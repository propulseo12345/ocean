-- Migration 018 a appliquer sur hgdeopkmkwyoumsfggrm (SQL Editor).
-- Genere depuis supabase/migrations/018_report_shares.sql. Prerequis : 010-017.
--
-- Partage public d'un rapport client (lien lecture seule, modele SNAPSHOT).
-- Table report_shares + RPC anon get_report_share(token_hash).
--
-- ⚠️ A VALIDER AVANT APPLICATION (Etienne) :
--   1. La RPC get_report_share est SECURITY DEFINER exposee a anon A DESSEIN
--      (c'est un lien public). get_advisors la signalera (lints 0028/0029) :
--      c'est une exception VOULUE, ne pas la « corriger ». La surete vient du
--      token 256 bits + payload fige pre-assaini (aucune note interne).
--   2. Rejouable : table `if not exists`, indexes `if not exists`, fonction
--      `create or replace`. Les policies NON — si la table preexiste, retirer le
--      bloc `create policy` ou droper d'abord. Sur une base neuve, jouer tel quel.
--
-- Apres application : lancer get_advisors (le seul nouveau warning attendu est
-- get_report_share exposee a anon, cf. ci-dessus).

begin;

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
  foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade
);

create index if not exists report_shares_client_idx
  on public.report_shares (client_id, created_at desc);
create index if not exists report_shares_org_id_idx on public.report_shares (org_id);

alter table public.report_shares enable row level security;

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

commit;
