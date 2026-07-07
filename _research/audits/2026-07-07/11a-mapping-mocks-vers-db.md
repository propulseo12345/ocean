# 11a — Mapping mocks → schéma DB + migrations SQL (2026-07-07)

> Document opérationnel du câblage. Pour chaque type mock, la table cible, les colonnes, les types SQL, les enums, l'`org_id`/`client_id`, les FK composites, et ce qui manque/diverge. Termine par la **liste ordonnée des migrations** à écrire au Lot 0-1.
> Source : `apps/web/lib/mocks/types/{core,collab,pro,library}.ts` (lus intégralement) + PRD §6 + CLAUDE.md §2. **READ-ONLY — SQL proposé, non appliqué.**

## Conventions transverses (toutes les tables)

- `id uuid primary key default gen_random_uuid()`
- `org_id uuid not null references organizations(id)` — **dénormalisé, sur TOUTE table métier**
- `client_id uuid not null references clients(id)` — sur toute table **fille de Client**
- **FK composites anti-fuite** : `UNIQUE(id, org_id)` sur les tables org-level ; `UNIQUE(id, client_id)` sur les filles de Client ; les FK des enfants pointent la paire `(parent_id, client_id)` → une ligne ne peut PHYSIQUEMENT pas changer de tenant.
- `created_at timestamptz not null default now()`, `updated_at timestamptz` (trigger)
- **RLS activée + policies écrites dans la même migration** (helpers `private.*`, wrap `(select …)`, `TO authenticated`).
- Enums Postgres (`create type … as enum`) pour tous les statuts fermés.

## Enums à créer (depuis `core.ts` / `collab.ts`)

```sql
create type platform as enum ('instagram','facebook','tiktok','newsletter','custom');
create type content_format as enum ('post','carousel','reel','story');
create type media_type as enum ('image','video');
create type content_status as enum ('idea','draft','in_review','changes_requested',
  'approved','scheduled','publishing','published','partially_published','failed','canceled');
create type target_status as enum ('pending','queued','publishing','awaiting_manual',
  'published','pushed_to_platform','failed','skipped','canceled');
create type account_status as enum ('connected','needs_reauth');   -- mock 'expired' fusionné
create type calendar_provider as enum ('google','microsoft');
create type approval_mode as enum ('required','optional','auto');
create type org_role as enum ('owner','admin');          -- organization_members
create type client_role as enum ('reviewer','editor');   -- client_members (séparé !)
create type approval_decision as enum ('approved','changes_requested');
create type notification_channel as enum ('in_app','push','email');
create type notification_audience as enum ('owner','reviewer','ops');
create type publish_job_status as enum ('scheduled','claimed','awaiting_media',
  'retrying','succeeded','failed','dead_letter','canceled');
```

> **Divergence à acter** : `MemberRole = "owner"|"reviewer"` (mock `core.ts:47`) est **remplacé par 2 enums** (`org_role` + `client_role`) — le PRD §6 sépare `organization_members` (owner/admin) et `client_members` (reviewer/editor). Le mock devra être scindé au Pré-0.

## Mapping table par table

### `organizations` ← `Organization` (core.ts:53)
| colonne | type | source mock | note |
|---|---|---|---|
| id, name | uuid, text | id, name | + `created_at` |

### `profiles` + `organization_members` ← `User` (core.ts:58)
- `profiles` (1:1 auth.users, **sans org_id ni rôle** — §6) : `id uuid pk references auth.users`, `name text`, `email text`, `initials text`, `timezone text`.
- `organization_members` : `org_id`, `user_id`, `role org_role`, `unique(org_id,user_id)`.
- Trigger `handle_new_user` → insère **uniquement** dans `profiles` (§2 règle 9).

### `clients` ← `Client` (core.ts:66)
| colonne | type | source | note |
|---|---|---|---|
| id, org_id | uuid | — | **org_id ajouté** (absent du mock) |
| name, handle | text | name, handle | proper nouns → `text` |
| brand_color | text | brandColor | valeur oklch |
| timezone | text | timezone | |
| archived_at | timestamptz null | archivedAt | soft-delete |
| bio, category | text null | bio, category | **dé-`L<string>`** (narratif → text simple) |
| notes | text null | notes | dé-`L<string>` |
| following | int | following | |
| approval_mode | approval_mode | approvalMode | |
| ~~theme~~ | — | theme | **RETIRÉ** (couplage `keyof typeof IMAGES`, artefact démo) |
- FK composite : `unique(id, org_id)`.

### `social_accounts` (+ `social_account_secrets`) ← `SocialAccount` (core.ts:84)
- `social_accounts` : `id, org_id, client_id`, `platform`, `username`, `display_name`, `status account_status`, `followers int`, `unique(id, client_id)`.
- `social_account_secrets` : `social_account_id`, tokens chiffrés — **RLS deny-all, zéro policy** (§2 règle 11).

### `imported_posts` ← `ImportedPost` (core.ts:102)
| colonne | type | note |
|---|---|---|
| id, org_id, client_id | uuid | |
| external_id | text | **AJOUTÉ** — clé de dédup du feed IG (absent du mock, §6) |
| thumb_url, permalink | text | |
| published_at | timestamptz | |
| media_type | media_type | |
| pinned | bool | |
| metrics | jsonb null | EngagementStats |
- `unique(client_id, external_id)` (dédup sync feed).

### `media_assets` ← `MediaAsset` (core.ts:115)
| colonne | type | note |
|---|---|---|
| id, org_id, client_id, content_item_id | uuid | fille de content_item |
| type | media_type | |
| **storage_path, thumb_path** | text | **AJOUTÉS** — cycle storage (chemin `{org}/{client}/{content}/{asset}/…`) |
| width, height, duration_sec | int | |
| position | int | |
| alt_text | text null | dé-`L<string>` |
| file_size_mb, mime_type | numeric, text | |
| **expires_at, original_deleted_at** | timestamptz null | **AJOUTÉS** — purge J+7 (§13.13) |

### `content_items` ← `ContentItem` (core.ts:144)
| colonne | type | note |
|---|---|---|
| id, org_id, client_id | uuid | `unique(id, client_id)` |
| title, caption | text | **dé-`L<string>`** |
| hashtags | text[] | |
| format | content_format | |
| status | content_status | |
| scheduled_at | timestamptz null | UTC |
| newsletter_subject, internal_notes, last_error, first_comment | text null | dé-`L<string>` |
| pillar_id | uuid null | → content_pillars |
| pinned, exclude_from_grid | bool | |
| cover_url | text null | |
| archived_at, deleted_at | timestamptz null | soft-delete + corbeille |
| labels | (voir §2.2 plan) | table ou text[] selon cardinalité |
| created_by | uuid | |

### `content_targets` ← `ContentTarget` (core.ts:132)
| colonne | type | note |
|---|---|---|
| id, org_id, client_id, content_item_id | uuid | **client_id+org_id AJOUTÉS** (absents du mock — invariant anti-fuite) |
| platform | platform | |
| social_account_id | uuid null | |
| status | target_status | |
| external_post_id, permalink | text null | |
| published_at | timestamptz null | |
| **deleted_externally** | bool | **AJOUTÉ** (§6, sync feed) |
| caption_override | text null | dé-`L<string>` (V2) |

### `publish_jobs` (worker — pas de miroir mock, PRD §6)
`id, org_id, client_id, content_item_id, content_target_id`, `run_at`, `status publish_job_status`, `step text`, `attempts int`, `lease_expires_at`, `worker_id`, `ig_container_id`, `publish_started_at`, `external_post_id`, `last_error`, `error_history jsonb`.
- **Index unique partiel anti-doublon** : `unique(content_item_id, social_account_id) where status in ('scheduled','claimed','awaiting_media','retrying')`.

### `comments` ← `Comment` + `Annotation` (collab.ts:28,35)
| colonne | type | note |
|---|---|---|
| id, org_id, client_id, content_item_id | uuid | |
| author_name, role | text, client_role | |
| body | text | dé-`L<string>` |
| annotation | jsonb null | `{media_asset_id, x, y}` — **`slideIndex` RETIRÉ** (§6) |

### `approvals` ← `Approval` (collab.ts:18) — **INSERT-ONLY**
`id, org_id, client_id, content_item_id, reviewer_id`, `decision approval_decision`, `message text null`, `version_snapshot jsonb` (**remplace `versionLabel: string`** — piste d'audit), `created_at`.
- Policies : **INSERT + SELECT uniquement**, zéro UPDATE/DELETE (§6 invariant).

### `review_requests` + `review_request_items` ← `ReviewRequest` (collab.ts:47)
- `review_requests` : `id, org_id, client_id`, `reviewer_ids uuid[]` (ou table), `message text null`, `sent_at`, `state`.
- `review_request_items` : jointure `(review_request_id, content_item_id)`.

### `notifications` ← `AppNotification` (collab.ts:60)
| colonne | type | note |
|---|---|---|
| id, org_id | uuid | |
| recipient_id | uuid | |
| type | **enum fermé** | **était `string` libre** — 10 types pilotent icône/tonalité |
| title, body | text | dé-`L<string>` |
| channels | notification_channel[] | |
| audience | notification_audience | |
| read | bool | |
| href | text | **généré via routes.ts**, pas codé en dur |

### `push_subscriptions` (PRD §6, RLS user)
`id, org_id, user_id, endpoint, keys jsonb`.

### `calendar_accounts` + `calendar_calendars` + `calendar_events` ← `CalendarAccount` + `CalendarEvent` (core.ts:179,187)
- `calendar_accounts` : `id, org_id, user_id`, `provider calendar_provider`, `provider_account_id text` (**sub/oid, jamais l'email**), `scopes text[]`, `status account_status`, secrets via Vault.
- `calendar_calendars` : **niveau AJOUTÉ** — `id, org_id, account_id`, `provider_calendar_id`, `name`, `color_var`, `is_enabled bool`. (Le mock aplatit ce niveau sur l'event.)
- `calendar_events` : `id, org_id, calendar_id`, `external_id`, `title text`, `starts_at/ends_at timestamptz` (ou date si all_day), `all_day bool`, `location text null`, `series_master_id`, `last_sync_run_id`.

### Entités mock SANS table PRD §6 — à créer (décision D-1 actée §08 T-3)
| table | ← type | colonnes clés |
|---|---|---|
| `content_pillars` | `ContentPillar` (pro.ts:8) | org_id, client_id, name text, color_var, target_share int |
| `client_events` | `ClientEvent` (pro.ts:21) | org_id, client_id, date timestamptz, title text, kind |
| `recurring_slots` | `RecurringSlot` (pro.ts:31) | org_id, client_id, weekday int, time text, platforms platform[], pillar_id |
| `brand_kits` | `BrandKit` (pro.ts:43) | org_id, client_id, palette text[], tone text, do_list text[], dont_list text[], banned_words text[] |
| `saved_views` | `SavedView` (pro.ts:66) | org_id, client_id, name text, filters jsonb (**labels = IDs stables, pas libellés FR**) |
| `library_assets` | `LibraryAsset` (library.ts:10) | org_id, client_id, type, storage_path, thumb_path, source, used_in_content_ids uuid[], alt_text text |
| `hashtag_groups` | `HashtagGroup` (library.ts:31) | org_id, client_id, name text, tags text[] |
| `content_versions` | `ContentVersion` (collab.ts:73) | org_id, client_id, content_item_id, label, caption text, note text (D-4 : table ou snapshot) |
| `activity_log` | `ActivityEntry` (collab.ts:98) | org_id, client_id, content_item_id, at, actor_name, kind, detail text |

## Liste ordonnée des migrations (Lot 0 → Lot 1/2)

Chaque migration = table(s) + index + RLS + FK composites, **dans le même fichier**, + un leak test pgTAP associé + `get_advisors` après application.

| # | Fichier | Contenu | Lot |
|---|---|---|---|
| 001 | `001_extensions_and_helpers.sql` | extensions, schéma `private`, helpers `private.is_org_member(org_id)` / `private.is_client_member(client_id)` SECURITY DEFINER (lisent organization_members / client_members) | 0 |
| 002 | `002_enums.sql` | tous les `create type … enum` ci-dessus | 0 |
| 003 | `003_orgs_profiles_members.sql` | organizations, profiles, organization_members, client_members + trigger `handle_new_user` (profiles only) + RLS | 0 |
| 004 | `004_clients.sql` | clients (+ archived_at) + RLS org-level + `unique(id, org_id)` | 0 |
| 005 | `005_content_items_targets.sql` | content_items + content_targets + RLS client-level + FK composites + index | 0 |
| 006 | `006_notifications_push.sql` | notifications + push_subscriptions + RLS | 0 |
| 007 | `007_social_accounts_secrets.sql` | social_accounts + social_account_secrets (**deny-all**) + platform_connections(+secrets) | 1 |
| 008 | `008_media_assets.sql` | media_assets + buckets storage + policies `storage.foldername()` | 1 |
| 009 | `009_pillars_slots_events_brandkit_views.sql` | content_pillars, recurring_slots, client_events, brand_kits, saved_views + RLS | 1 |
| 010 | `010_library_hashtags.sql` | library_assets, hashtag_groups + RLS | 1 |
| 011 | `011_imported_posts.sql` | imported_posts (+ external_id, dédup) + RLS | 1/2 |
| 012 | `012_review_comments_approvals.sql` | review_requests(+items), comments (annotation jsonb), approvals (**insert-only**), content_versions, activity_log + RLS | 3 |
| 013 | `013_publish_jobs.sql` | publish_jobs + index unique partiel anti-doublon | 2 |
| 014 | `014_calendar.sql` | calendar_accounts, calendar_calendars, calendar_events + vue `unified_agenda` (security_invoker) | 4 |

> À chaque migration : `get_advisors` doit être clean, et le leak test pgTAP correspondant vert (user A ≠ voit data org B ; reviewer client 1 ≠ voit client 2). Détail des policies dans **11c**.
