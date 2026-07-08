# Lot 0 Supabase Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Ocean Lot 0 Supabase from the Claude Code plan, with a corrected DB dictionary and migration order, without executing any migration.

**Architecture:** Lot 0 starts by freezing the database contract before code wiring. The repo currently has no `supabase/` or `packages/shared`, so the first deliverable is scaffold plus reviewed SQL files and pgTAP drafts, not a live database push.

**Tech Stack:** Supabase Postgres + RLS, pgTAP, TypeScript strict, pnpm workspaces, Biome, Next.js 16 App Router.

## Global Constraints

- Current phase: prepare Lot 0 Supabase, do not run `supabase db push`, `supabase migration up`, or any remote migration.
- Every business table has denormalized `org_id uuid not null`; every Client child table also has `client_id`.
- RLS enabled on 100% of tables in the same migration that creates them.
- RLS policies use `private.*` SECURITY DEFINER helpers, wrap calls with `(select fn())`, and specify `TO authenticated`.
- `profiles` has no `org_id` and no role; `handle_new_user` inserts only into `profiles`.
- OAuth/token tables named `*_secrets` are deny-all: RLS enabled, zero client policies.
- FK composites are mandatory for anti-leak constraints.
- Validate SQL with Etienne before execution.
- Existing dirty worktree belongs to the user; do not revert unrelated changes.

---

## File Structure

- Create `docs/architecture/lot-0-db-dictionary.md`: corrected source of truth for Lot 0 schema decisions and open decisions.
- Create `supabase/config.toml`: local Supabase project config only; no remote linking.
- Create `supabase/migrations/*.sql`: migration drafts, ordered so every FK/helper dependency exists before use.
- Create `supabase/tests/*.sql`: pgTAP leak-test drafts paired with migrations.
- Create `packages/shared/package.json`: shared workspace package scaffold.
- Create `packages/shared/src/types/domain.ts`: UI/domain enums aligned with DB names.
- Create `packages/shared/src/schemas/*.ts`: strict Zod schemas used later by Server Actions.
- Modify root workspace config only if needed to include `packages/*`.

---

### Task 1: Freeze Corrected DB Dictionary

**Files:**
- Create: `docs/architecture/lot-0-db-dictionary.md`

**Interfaces:**
- Consumes: `docs/PRD.md`, `docs/ANALYSE-LANCEMENT.md`, `_research/audits/2026-07-07/11*.md`, `apps/web/lib/mocks/types/*.ts`.
- Produces: a reviewed dictionary used by SQL migrations.

- [ ] **Step 1: Write the dictionary document**

Create `docs/architecture/lot-0-db-dictionary.md` with these sections:

```markdown
# Lot 0 DB Dictionary - Ocean

## Status

Draft for review. No migration has been executed.

## Corrections to Claude Code Plan

- Helpers `private.is_org_member()` and `private.is_client_member()` are created after their membership tables exist.
- `client_members` is created after `clients`, carries `org_id`, and references `clients(id, org_id)`.
- `platform_connections` and `social_accounts` are moved before `content_targets` so target FKs can be created in one pass.
- `publish_jobs` includes `social_account_id` because the active-job unique index requires it.
- `review_requests` uses reviewer join tables instead of `reviewer_ids uuid[]`.
- `comments` does not store `client_role` directly because owners can comment too.
- `imported_posts` deduplicates on `(social_account_id, external_id)`.
- Labels use stable IDs: `content_labels` and `content_item_labels`.

## Lot 0 Tables

- organizations
- profiles
- organization_members
- clients
- client_members
- platform_connections
- platform_connection_secrets
- social_accounts
- social_account_secrets
- content_items
- content_targets
- notifications
- push_subscriptions
- content_labels
- content_item_labels

## Deferred Tables

- Lot 1: media_assets, storage buckets/policies, content_pillars, recurring_slots, client_events, brand_kits, saved_views, library_assets, hashtag_groups, imported_posts.
- Lot 2: publish_jobs.
- Lot 3: review_requests, review_request_items, review_request_reviewers, comments, approvals, content_versions, activity_log.
- Lot 4: calendar_accounts, calendar_account_secrets or Vault references, calendar_calendars, calendar_events, unified_agenda.

## Open Decisions

- Whether `platform_connection_secrets` stores Vault secret IDs only, encrypted token metadata, or both.
- Whether `notifications.href` remains stored text or becomes derived by notification type plus payload.
- Whether `brand_color` allows raw OKLCH text or a constrained token format.
```

- [ ] **Step 2: Review for missing PRD tables**

Run:

```powershell
Select-String -Path 'docs\PRD.md' -Pattern 'platform_connections|content_targets|push_subscriptions|publish_jobs|unified_agenda' -Context 1,1
```

Expected: every PRD Lot 0 table is represented in the dictionary, and deferred tables have their future lot.

- [ ] **Step 3: Stop for Etienne validation**

Do not write SQL until Etienne confirms the corrected dictionary and open decisions.

---

### Task 2: Scaffold Supabase and Shared Package

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/.gitkeep`
- Create: `supabase/tests/.gitkeep`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types/domain.ts`
- Create: `packages/shared/src/schemas/index.ts`
- Modify: `pnpm-workspace.yaml` if it does not already include `packages/*`

**Interfaces:**
- Consumes: corrected DB dictionary from Task 1.
- Produces: folders needed for migration drafts and shared contracts.

- [ ] **Step 1: Inspect workspace config**

Run:

```powershell
Get-Content -LiteralPath 'pnpm-workspace.yaml'
```

Expected: if `packages/*` is absent, add it in Step 3.

- [ ] **Step 2: Create scaffold files**

Create:

```text
supabase/config.toml
supabase/migrations/.gitkeep
supabase/tests/.gitkeep
packages/shared/package.json
packages/shared/src/types/domain.ts
packages/shared/src/schemas/index.ts
```

- [ ] **Step 3: Add shared workspace only if missing**

Ensure `pnpm-workspace.yaml` contains:

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 4: Add minimal shared package**

`packages/shared/package.json`:

```json
{
  "name": "@ocean/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./types/domain": "./src/types/domain.ts",
    "./schemas": "./src/schemas/index.ts"
  }
}
```

- [ ] **Step 5: Add first enum contracts**

`packages/shared/src/types/domain.ts`:

```ts
export type Platform = "instagram" | "facebook" | "tiktok" | "newsletter" | "custom"
export type ContentFormat = "post" | "carousel" | "reel" | "story"
export type MediaType = "image" | "video"
export type AccountStatus = "connected" | "needs_reauth"
export type OrgRole = "owner" | "admin"
export type ClientRole = "reviewer" | "editor"
```

- [ ] **Step 6: Verify without installing dependencies**

Run:

```powershell
pnpm -C apps/web build
```

Expected: build behavior unchanged. If dependency resolution fails because workspace package is not referenced yet, document it and do not add network dependencies in this task.

---

### Task 3: Write Migration 001-002 Drafts

**Files:**
- Create: `supabase/migrations/001_extensions_schema_utils.sql`
- Create: `supabase/migrations/002_enums.sql`

**Interfaces:**
- Consumes: Task 1 dictionary.
- Produces: dependency-free migration foundations.

- [ ] **Step 1: Draft extension/schema migration**

`001_extensions_schema_utils.sql` must include:

```sql
create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

- [ ] **Step 2: Draft enum migration**

`002_enums.sql` must include enums for:

```text
platform, content_format, media_type, content_status, target_status,
account_status, integration_provider, approval_mode, org_role, client_role,
notification_channel, notification_audience, notification_type
```

- [ ] **Step 3: Static sanity check**

Run:

```powershell
Select-String -Path 'supabase\migrations\002_enums.sql' -Pattern 'expired|MemberRole'
```

Expected: no matches. `expired` and `MemberRole` are mock-only divergence points.

---

### Task 4: Write Identity, Organizations, Clients, and Memberships Drafts

**Files:**
- Create: `supabase/migrations/003_identity_orgs.sql`
- Create: `supabase/migrations/004_clients_members.sql`
- Create: `supabase/tests/003_identity_orgs.test.sql`
- Create: `supabase/tests/004_clients_members.test.sql`

**Interfaces:**
- Consumes: migrations 001-002.
- Produces: membership tables and helpers used by later RLS.

- [ ] **Step 1: Draft `003_identity_orgs.sql`**

Include `organizations`, `profiles`, `organization_members`, `handle_new_user`, then `private.is_org_member(_org uuid)`.

- [ ] **Step 2: Draft `004_clients_members.sql`**

Include `clients`, `client_members`, `unique(id, org_id)` on `clients`, `unique(client_id, user_id)` on `client_members`, then `private.is_client_member(_client uuid)`.

- [ ] **Step 3: Add RLS policies**

Policies must use this shape:

```sql
create policy clients_select on public.clients
for select to authenticated
using ((select private.is_org_member(org_id)));
```

- [ ] **Step 4: Draft leak tests**

Tests must cover:

```text
org member can see own clients
org B cannot see org A clients
reviewer can see own client through client_members
reviewer cannot see another client in same org
```

- [ ] **Step 5: Stop for SQL review**

Do not apply migrations. Send the SQL diff to Etienne for review.

---

### Task 5: Write Lot 0 Accounts and Content Core Drafts

**Files:**
- Create: `supabase/migrations/005_accounts_shell.sql`
- Create: `supabase/migrations/006_content_core.sql`
- Create: `supabase/tests/005_accounts_shell.test.sql`
- Create: `supabase/tests/006_content_core.test.sql`

**Interfaces:**
- Consumes: migrations 003-004 helpers and membership tables.
- Produces: content tables needed by dashboard/client UI.

- [ ] **Step 1: Draft accounts shell**

Create `platform_connections`, `platform_connection_secrets`, `social_accounts`, `social_account_secrets`.

Required invariant:

```sql
alter table public.social_account_secrets enable row level security;
-- no policy for authenticated users
```

- [ ] **Step 2: Draft content core**

Create `content_items`, `content_targets`, `content_labels`, `content_item_labels`.

Required FK direction:

```text
content_targets(content_item_id, client_id) references content_items(id, client_id)
content_targets(social_account_id, client_id) references social_accounts(id, client_id)
```

- [ ] **Step 3: Add content RLS**

Reader access:

```sql
using ((select private.is_org_member(org_id)) or (select private.is_client_member(client_id)))
```

Writer access:

```sql
with check ((select private.is_org_member(org_id)))
```

- [ ] **Step 4: Draft anti-leak tests**

Tests must cover:

```text
org B cannot read org A content
reviewer client 1 cannot read client 2 content
reviewer cannot update content_items
cross-client content_target insert fails by FK composite
authenticated cannot read social_account_secrets
```

---

### Task 6: Write Notifications and Push Drafts

**Files:**
- Create: `supabase/migrations/007_notifications_push.sql`
- Create: `supabase/tests/007_notifications_push.test.sql`

**Interfaces:**
- Consumes: identity and org helpers.
- Produces: notification tables for first real dashboard wiring.

- [ ] **Step 1: Draft tables**

Create `notifications` and `push_subscriptions`.

- [ ] **Step 2: Add user-scoped RLS for push subscriptions**

Use:

```sql
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()))
```

- [ ] **Step 3: Add notification RLS**

Recipients can read their own notifications; org members can create owner/ops notifications server-side later through service role. No client token may write arbitrary notifications.

- [ ] **Step 4: Draft tests**

Tests must cover:

```text
user cannot read another user's push subscription
recipient can read own notification
org B cannot read org A notification
```

---

### Task 7: Validate Drafts Without Applying

**Files:**
- Read: `supabase/migrations/*.sql`
- Read: `supabase/tests/*.sql`

**Interfaces:**
- Consumes: all draft SQL.
- Produces: a review report for Etienne.

- [ ] **Step 1: Search for forbidden patterns**

Run:

```powershell
rg "disable row level security|delete from storage.objects|NEXT_PUBLIC.*SERVICE|expired|MemberRole|linkIdentity|6543" supabase packages apps/web
```

Expected: no dangerous match in new SQL/contracts.

- [ ] **Step 2: Check migration order names**

Run:

```powershell
Get-ChildItem -LiteralPath 'supabase\migrations' | Sort-Object Name | Select-Object Name
```

Expected:

```text
001_extensions_schema_utils.sql
002_enums.sql
003_identity_orgs.sql
004_clients_members.sql
005_accounts_shell.sql
006_content_core.sql
007_notifications_push.sql
```

- [ ] **Step 3: Produce review summary**

Report:

```text
Created files
Tables covered
Known deferred tables
Open decisions
Exact commands not run: supabase db push, migration up, remote link
```

- [ ] **Step 4: Stop**

Wait for Etienne's explicit approval before any migration execution or Supabase remote connection.

---

## Self-Review

- Spec coverage: Lot 0 PRD tables are covered; Lot 1-4 tables are explicitly deferred.
- Placeholder scan: this plan contains no TBD/TODO placeholders.
- Type consistency: names use DB snake_case in SQL and TypeScript domain enums for shared contracts.
