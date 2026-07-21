# Lot 0 DB Dictionary - Ocean

## Status

Draft for Etienne review. No migration has been executed.

This document is the Lot 0 database contract for the next tickets. It is documentation only: no SQL, no Supabase scaffold, no remote project link, no migration execution.

Count note: ticket `LOT0-01` labels the expected Lot 0 list as 16 tables, but the explicit list contains 15 table names. This dictionary keeps the explicit ticket list and records the count mismatch under Open Decisions instead of inventing a table.

## Corrections to Claude Code Plan

- Helpers `private.is_org_member()` and `private.is_client_member()` are created after their membership tables exist.
- `client_members` is created after `clients`, carries `org_id`, and references `clients(id, org_id)`.
- `platform_connections` and `social_accounts` are moved before `content_targets` so target FKs can be created in one pass.
- `publish_jobs` includes `social_account_id` because the active-job unique index requires it.
- `review_requests` uses reviewer join tables instead of `reviewer_ids uuid[]`.
- `comments` does not store `client_role` directly because owners can comment too.
- `imported_posts` deduplicates on `(social_account_id, external_id)`.
- Labels use stable IDs: `content_labels` and `content_item_labels`.
- `profiles` has no `org_id` and no role; `handle_new_user` inserts only into `profiles`.
- `*_secrets` tables are deny-all: RLS enabled, zero authenticated policies, service role only.

## Lot 0 Tables

Lot 0 freezes the identity, tenant, client, account shell, content core, notification, push, and label contracts. Every business table has denormalized `org_id uuid not null`; every Client child table also has `client_id uuid not null`; Client child FKs use composite constraints to prevent cross-tenant or cross-client leaks.

### `organizations`

Tenant root. Stores the organization identity. `organizations` is the parent for denormalized `org_id` on business tables and carries `unique(id)` plus the composite targets needed by children through membership/client tables.

### `profiles`

One row per `auth.users` user. Contains profile display fields such as name, email, initials, and timezone. It must not contain `org_id`, `role`, or any membership shortcut.

### `organization_members`

Org-level membership table. Contains `org_id`, `user_id`, and `role org_role` with roles `owner` and `admin`. It is the source table used by `private.is_org_member(_org uuid)`.

### `clients`

Client workspace table. Contains `org_id`, name/handle, brand color, timezone, archived timestamp, approval mode, and descriptive fields. It must expose `unique(id, org_id)` so child tables can reference the client in its tenant.

### `client_members`

Client-scoped membership table for reviewers and future editors. Contains `org_id`, `client_id`, `user_id`, and `role client_role`, with FK `(client_id, org_id)` to `clients(id, org_id)`. It is created after `clients` and is the source table used by `private.is_client_member(_client uuid)`.

### `platform_connections`

Org-level connection shell for external providers before account selection. Contains `org_id`, provider, owning/connecting user, provider account identity, status, scopes metadata, and timestamps. It must exist before `social_accounts`.

### `platform_connection_secrets`

Sister secret table for `platform_connections`. Deny-all RLS, zero authenticated policies. Stores Vault secret references, encrypted token metadata, or both depending on the open decision below. Tokens never reach the browser.

### `social_accounts`

Client child table for the actual publishable social accounts. Contains `org_id`, `client_id`, `platform_connection_id`, platform, provider account/page IDs, username/display name, status `connected|needs_reauth`, follower count, and `unique(id, client_id)`.

### `social_account_secrets`

Sister secret table for per-social-account credentials or Vault references. Deny-all RLS, zero authenticated policies. Worker/server service role only.

### `content_items`

Client child table for the global content item. Contains `org_id`, `client_id`, title, caption, hashtags, format, global status, scheduled UTC timestamp, newsletter subject, internal notes, created_by, soft-delete/archive timestamps, and `unique(id, client_id)`.

### `content_targets`

Client child table for per-platform business state. Contains `org_id`, `client_id`, `content_item_id`, platform, nullable `social_account_id`, target status, external post ID, permalink, published timestamp, deleted-external flag, and optional caption override. FKs include `(content_item_id, client_id)` to `content_items(id, client_id)` and `(social_account_id, client_id)` to `social_accounts(id, client_id)`.

### `notifications`

Org-level notification table for in-app events. Contains `org_id`, recipient user, notification type, title/body, channels, audience, read timestamp/state, payload or href, and created timestamp. Critical events remain server-created; client tokens must not write arbitrary notifications.

### `push_subscriptions`

User-scoped push subscription table. Contains `org_id`, `user_id`, endpoint, keys JSON, user agent/device metadata, and timestamps. RLS is scoped to `user_id = auth.uid()` for read/write.

### `content_labels`

Stable label catalog for content. Contains `org_id`, `client_id`, label name, color/token metadata, and sort/display fields. Labels use stable IDs instead of localized free-text values.

### `content_item_labels`

Join table between content items and labels. Contains `org_id`, `client_id`, `content_item_id`, and `content_label_id`, with composite FKs to both parent tables in the same client scope.

## Deferred Tables

- Lot 1: `media_assets`, storage buckets/policies, `content_pillars`, `recurring_slots`, `client_events`, `brand_kits`, `saved_views`, `library_assets`, `hashtag_groups`, `imported_posts`.
- Lot 2: `publish_jobs`. It must include `social_account_id` so the active-job unique index can cover `(content_item_id, social_account_id)`.
- Lot 3: `review_requests`, `review_request_items`, `review_request_reviewers`, `comments`, `approvals`, `content_versions`, `activity_log`.
- Lot 4: `calendar_accounts`, `calendar_account_secrets` or Vault references, `calendar_calendars`, `calendar_events`, `unified_agenda`.

Deferred table notes:

- `review_requests` uses join tables for contents and reviewers; no `reviewer_ids uuid[]`.
- `comments` must support owners and reviewers, so it cannot store only `client_role`.
- `approvals` are insert-only and versioned for proof.
- `imported_posts` deduplicates on `(social_account_id, external_id)`.
- `unified_agenda` is a Lot 4 view and must be `security_invoker = true`.

## Open Decisions

- Confirm the Lot 0 table count mismatch: the ticket says 16, but names 15 explicit tables. Either accept the 15-table list or name the missing table before SQL drafting.
- Decide whether `platform_connection_secrets` stores Vault secret IDs only, encrypted token metadata, or both.
- Decide whether `social_account_secrets` remains separate from `platform_connection_secrets` for provider-specific per-account credentials, or only stores references derived from the platform connection.
- Decide whether `notifications.href` remains stored text or becomes derived from notification type plus payload.
- Decide whether `brand_color` allows raw OKLCH text or a constrained token format.
- Decide whether `content_labels` are client-scoped only, org-scoped reusable, or both through an optional `client_id`.
