create type public.platform as enum (
  'instagram',
  'facebook',
  'tiktok',
  'newsletter',
  'custom'
);

create type public.content_format as enum (
  'post',
  'carousel',
  'reel',
  'story'
);

create type public.media_type as enum (
  'image',
  'video'
);

create type public.content_status as enum (
  'idea',
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'partially_published',
  'failed',
  'canceled'
);

create type public.target_status as enum (
  'pending',
  'queued',
  'publishing',
  'awaiting_manual',
  'published',
  'pushed_to_platform',
  'failed',
  'skipped',
  'canceled'
);

create type public.account_status as enum (
  'connected',
  'needs_reauth'
);

create type public.integration_provider as enum (
  'instagram',
  'facebook',
  'tiktok',
  'google',
  'microsoft'
);

create type public.approval_mode as enum (
  'required',
  'optional',
  'auto'
);

create type public.org_role as enum (
  'owner',
  'admin'
);

create type public.client_role as enum (
  'reviewer',
  'editor'
);

create type public.notification_channel as enum (
  'in_app',
  'push',
  'email'
);

create type public.notification_audience as enum (
  'owner',
  'reviewer',
  'ops'
);

create type public.notification_type as enum (
  'publish_failed',
  'publish_succeeded',
  'publish_delayed',
  'tiktok_draft_pushed',
  'review_due',
  'review_overdue',
  'changes_requested',
  'content_approved',
  'review_comment',
  'reviewer_invitation',
  'review_requested',
  'reschedule_required',
  'manual_due',
  'tiktok_draft_reminder',
  'approved_date_changed',
  'media_purge_warning',
  'token_reauth_needed',
  'watchdog_alert'
);

grant usage on type public.platform to authenticated, service_role;
grant usage on type public.content_format to authenticated, service_role;
grant usage on type public.media_type to authenticated, service_role;
grant usage on type public.content_status to authenticated, service_role;
grant usage on type public.target_status to authenticated, service_role;
grant usage on type public.account_status to authenticated, service_role;
grant usage on type public.integration_provider to authenticated, service_role;
grant usage on type public.approval_mode to authenticated, service_role;
grant usage on type public.org_role to authenticated, service_role;
grant usage on type public.client_role to authenticated, service_role;
grant usage on type public.notification_channel to authenticated, service_role;
grant usage on type public.notification_audience to authenticated, service_role;
grant usage on type public.notification_type to authenticated, service_role;
