import { isPast, isSameDay } from "@/lib/format"
import { routes } from "@/lib/routes"
import { CALENDAR_EVENTS } from "./agenda"
import {
  CALENDAR_ACCOUNTS,
  CLIENTS,
  CURRENT_USER,
  ORG,
  REVIEWERS,
  SOCIAL_ACCOUNTS,
} from "./clients"
import { CONTENT_ITEMS } from "./content"
import { IMPORTED_POSTS } from "./imported"
import { APPROVALS, COMMENTS, REVIEW_REQUESTS } from "./interactions"
import { platformMeta } from "./labels"
import { NOTIFICATIONS } from "./notifications"
import type { AgendaItem, Client, ContentItem, DashboardTask, NotificationAudience } from "./types"

export { CALENDAR_EVENTS } from "./agenda"
export * from "./brand"
export { CONTENT_ITEMS } from "./content"
export * from "./hashtags"
export * from "./history"
export { IMPORTED_POSTS } from "./imported"
export { APPROVALS, COMMENTS, REVIEW_REQUESTS } from "./interactions"
export * from "./library"
export * from "./metrics"
export { NOTIFICATIONS } from "./notifications"
export * from "./pillars"
export * from "./planning"
export * from "./quotas"
export * from "./types"
export * from "./views"
export { CALENDAR_ACCOUNTS, CLIENTS, CURRENT_USER, ORG, REVIEWERS, SOCIAL_ACCOUNTS }

// Client de démonstration « actif » + reviewer de démonstration (portail).
export const DEMO_REVIEWER_CLIENT_ID = "cl_brulerie"

export function getClients(includeArchived = false): Client[] {
  return CLIENTS.filter((c) => includeArchived || !c.archivedAt)
}

export function getClient(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id)
}

export function getActiveClient(): Client {
  return getClients()[0]
}

// Contenus actifs (la corbeille est exclue — voir getTrashedContent).
export function getContentItems(clientId?: string): ContentItem[] {
  return CONTENT_ITEMS.filter(
    (c) => !c.deletedAt && (clientId === undefined || c.clientId === clientId)
  )
}

export function getContentItem(id: string): ContentItem | undefined {
  return CONTENT_ITEMS.find((c) => c.id === id)
}

// Corbeille : contenus supprimés, restaurables pendant le délai de grâce.
export function getTrashedContent(clientId?: string): ContentItem[] {
  return CONTENT_ITEMS.filter(
    (c) => Boolean(c.deletedAt) && (clientId === undefined || c.clientId === clientId)
  )
}

export function getImportedPosts(clientId: string) {
  return IMPORTED_POSTS.filter((p) => p.clientId === clientId)
}

export function getImportedPost(id: string) {
  return IMPORTED_POSTS.find((p) => p.id === id)
}

export function getSocialAccounts(clientId?: string) {
  return clientId ? SOCIAL_ACCOUNTS.filter((a) => a.clientId === clientId) : SOCIAL_ACCOUNTS
}

export function getReviewer(clientId: string) {
  return REVIEWERS.find((r) => r.clientId === clientId)
}

export function getComments(contentId: string) {
  return COMMENTS.filter((c) => c.contentId === contentId)
}

export function getApprovals(contentId: string) {
  return APPROVALS.filter((a) => a.contentId === contentId)
}

export function getReviewRequest(clientId: string) {
  return REVIEW_REQUESTS.find((r) => r.clientId === clientId)
}

export function getNotifications(audience: NotificationAudience = "owner") {
  return [...NOTIFICATIONS]
    .filter((n) => n.audience === audience)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getUnreadCount(audience: NotificationAudience = "owner") {
  return getNotifications(audience).filter((n) => !n.read).length
}

export function getCalendarEvents() {
  return CALENDAR_EVENTS
}

const AGENDA_PUBLISH: ContentItem["status"][] = ["scheduled", "approved", "publishing"]

export function getUnifiedAgenda(): AgendaItem[] {
  const events: AgendaItem[] = CALENDAR_EVENTS.filter((e) => e.enabled).map((event) => ({
    kind: "event",
    id: event.id,
    event,
  }))
  const pubs: AgendaItem[] = CONTENT_ITEMS.filter(
    (c) => !c.deletedAt && c.scheduledAt && AGENDA_PUBLISH.includes(c.status)
  ).map((content) => ({
    kind: "publication",
    id: `pub_${content.id}`,
    content,
    client: getClient(content.clientId) as Client,
    startsAt: content.scheduledAt as string,
  }))
  return [...events, ...pubs].sort((a, b) => agendaStart(a).localeCompare(agendaStart(b)))
}

function agendaStart(item: AgendaItem): string {
  return item.kind === "event" ? item.event.startsAt : item.startsAt
}

// Contenus visibles par le reviewer de démonstration (portail).
const REVIEWER_VISIBLE: ContentItem["status"][] = [
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "partially_published",
]

export function getPortalContent(clientId = DEMO_REVIEWER_CLIENT_ID) {
  return getContentItems(clientId).filter((c) => REVIEWER_VISIBLE.includes(c.status))
}

function platformsLabel(c: ContentItem): string {
  return c.targets.map((t) => platformMeta[t.platform].short).join(" · ")
}

export function getDashboardTasks(): DashboardTask[] {
  const tasks: DashboardTask[] = []
  const name = (id: string) => getClient(id)?.name ?? ""

  for (const c of CONTENT_ITEMS) {
    if (c.deletedAt) continue
    if (c.status === "scheduled" && c.scheduledAt && isSameDay(c.scheduledAt)) {
      tasks.push({
        id: `t_pub_${c.id}`,
        kind: "publish_today",
        title: c.title,
        detail: `${name(c.clientId)} · ${platformsLabel(c)}`,
        clientId: c.clientId,
        href: routes.content(c.clientId, c.id),
        at: c.scheduledAt,
        tone: "info",
      })
    }
  }
  for (const c of CONTENT_ITEMS) {
    if (c.deletedAt) continue
    if (c.status === "failed" || c.status === "partially_published") {
      tasks.push({
        id: `t_fail_${c.id}`,
        kind: "failed",
        title: c.title,
        detail: `${name(c.clientId)} · ${c.lastError ?? "Échec de publication"}`,
        clientId: c.clientId,
        href: routes.content(c.clientId, c.id),
        tone: "danger",
      })
    }
  }
  for (const c of CONTENT_ITEMS) {
    if (c.deletedAt) continue
    if (c.targets.some((t) => t.status === "pushed_to_platform")) {
      tasks.push({
        id: `t_tt_${c.id}`,
        kind: "tiktok_draft",
        title: c.title,
        detail: `${name(c.clientId)} · brouillon TikTok à finaliser`,
        clientId: c.clientId,
        href: routes.content(c.clientId, c.id),
        tone: "warning",
      })
    }
  }
  for (const c of CONTENT_ITEMS) {
    if (c.deletedAt) continue
    if (c.status === "in_review") {
      tasks.push({
        id: `t_rev_${c.id}`,
        kind: "review_pending",
        title: c.title,
        detail: `${name(c.clientId)} · en attente de validation`,
        clientId: c.clientId,
        href: routes.content(c.clientId, c.id),
        tone: "neutral",
      })
    }
  }
  for (const a of SOCIAL_ACCOUNTS) {
    if (a.status !== "connected") {
      tasks.push({
        id: `t_acc_${a.id}`,
        kind: "reconnect",
        title: `Reconnecter ${platformMeta[a.platform].label}`,
        detail: `${name(a.clientId)} · accès expiré`,
        clientId: a.clientId,
        href: routes.settings,
        tone: "warning",
      })
    }
  }
  return tasks
}

export { isPast }
