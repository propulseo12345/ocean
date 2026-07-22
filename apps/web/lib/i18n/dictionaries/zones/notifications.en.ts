import type { notificationsFr } from "./notifications.fr"

// Namespace i18n « notifications » (EN) — doit refléter les clés de notificationsFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const notificationsEn: Widen<typeof notificationsFr> = {
  notifications: {
    // Page header (notifications/page.tsx)
    metaTitle: "Notifications",
    pageTitle: "Notifications",
    pageDescriptionUnread:
      "{count, plural, one {# unread} other {# unread}} — posts, approvals and accounts to keep an eye on.",
    pageDescription: "Posts, approvals and accounts to keep an eye on.",
    filterAll: "All",
    filterUnread: "Unread",
    markAllRead: "Mark all as read",
    noneUnreadToast: "No unread notifications.",
    markedReadToast:
      "{count, plural, one {# notification marked as read} other {# notifications marked as read}}",
    markedReadToastDescription: "They will no longer show as unread.",
    markAllError: "Could not mark all as read. Try again.",
    emptyUnreadTitle: "No unread notifications",
    emptyTitle: "No notifications",
    emptyUnreadDescription: "You're all caught up — nothing needs your attention right now.",
    emptyDescription: "Publishing, review and reconnection alerts will appear here.",
    unreadDot: "Unread",
    channelInApp: "In-app",
    channelPush: "Push",
    channelEmail: "Email",
  },
}
