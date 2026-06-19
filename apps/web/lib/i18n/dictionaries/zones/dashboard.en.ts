import type { dashboardFr } from "./dashboard.fr"

// Namespace i18n « dashboard » (EN) — doit refléter les clés de dashboardFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const dashboardEn: Widen<typeof dashboardFr> = {
  dashboard: {
    metaTitle: "Dashboard",
    greeting: "Hi {name}",
    yourDay: "Here's your day — {date}.",
    seeClients: "View clients",
    kpiPublishToday: "To publish today",
    kpiReviewPending: "Awaiting approval",
    kpiFailed: "Failures to handle",
    kpiReconnect: "Accounts to reconnect",
    tasksTitle: "Today's tasks",
    tasksTotal: "{count} total",
    today: "Today",
    agenda: "Agenda",
    recentActivity: "Recent activity",
    allClear: "All caught up",
    allClearHint: "No pending tasks for today.",
    freeDay: "Free day",
    freeDayHint: "No meetings or posts today.",
    allDay: "Day",
    group: {
      failed: "Failures to handle",
      publish_today: "To publish today",
      tiktok_draft: "TikTok drafts to finalize",
      manual_due: "To publish manually",
      reschedule: "To reschedule",
      review_pending: "Awaiting client approval",
      reconnect: "Accounts to reconnect",
    },
    task: {
      publishFailed: "Publishing failed",
      tiktokDraft: "TikTok draft to finalize",
      awaitingReview: "awaiting approval",
      reconnect: "Reconnect {platform}",
      accessExpired: "access expired",
    },
  },
}
