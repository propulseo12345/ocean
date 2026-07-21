import "server-only"

import { cache } from "react"

import { isSameDay } from "@/lib/format"
import { type Labels, type Locale, makeLabels, pick, type Translator } from "@/lib/i18n"
import type { AgendaItem, Client, ContentItem, DashboardTask } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { getClients, getCurrentUser, getSocialAccounts } from "./clients"
import { getContentItems } from "./content"
import { getNotifications, getUnreadCount } from "./notifications"
import { getCalendarEvents } from "./pro"

// Lectures dérivées : tâches du dashboard, agenda unifié, snapshot du shell.
// Elles ne parlent pas à Supabase directement — elles composent les lectures
// cœur, qui portent déjà le filtrage org_id et la RLS.

function platformsLabel(item: ContentItem, labels: Labels): string {
  return item.targets.map((target) => labels.platformShort(target.platform)).join(" · ")
}

/**
 * Tâches actionnables du jour. Même dérivation que la preview, mais sur les
 * données réelles : publications du jour, échecs, brouillons TikTok à
 * finaliser, contenus en attente de validation, comptes à reconnecter.
 */
export const getDashboardTasks = cache(
  async (orgId: string, t: Translator, locale: Locale): Promise<DashboardTask[]> => {
    if (!orgId) return []
    const [items, accounts, clients] = await Promise.all([
      getContentItems(orgId),
      getSocialAccounts(orgId),
      getClients(orgId, true),
    ])

    const nameById = new Map(clients.map((client) => [client.id, client.name]))
    const name = (id: string) => nameById.get(id) ?? ""
    const labels = makeLabels(t)
    const title = (item: ContentItem) => pick(item.title, locale)
    const tasks: DashboardTask[] = []

    for (const item of items) {
      if (item.status === "scheduled" && item.scheduledAt && isSameDay(item.scheduledAt)) {
        tasks.push({
          id: `t_pub_${item.id}`,
          kind: "publish_today",
          title: title(item),
          detail: `${name(item.clientId)} · ${platformsLabel(item, labels)}`,
          clientId: item.clientId,
          href: routes.content(item.clientId, item.id),
          at: item.scheduledAt,
          tone: "info",
        })
      }
    }
    for (const item of items) {
      if (item.status === "failed" || item.status === "partially_published") {
        const err = item.lastError
          ? pick(item.lastError, locale)
          : t("dashboard.task.publishFailed")
        tasks.push({
          id: `t_fail_${item.id}`,
          kind: "failed",
          title: title(item),
          detail: `${name(item.clientId)} · ${err}`,
          clientId: item.clientId,
          href: routes.content(item.clientId, item.id),
          tone: "danger",
        })
      }
    }
    for (const item of items) {
      if (item.targets.some((target) => target.status === "pushed_to_platform")) {
        tasks.push({
          id: `t_tt_${item.id}`,
          kind: "tiktok_draft",
          title: title(item),
          detail: `${name(item.clientId)} · ${t("dashboard.task.tiktokDraft")}`,
          clientId: item.clientId,
          href: routes.content(item.clientId, item.id),
          tone: "warning",
        })
      }
    }
    for (const item of items) {
      if (item.status === "in_review") {
        tasks.push({
          id: `t_rev_${item.id}`,
          kind: "review_pending",
          title: title(item),
          detail: `${name(item.clientId)} · ${t("dashboard.task.awaitingReview")}`,
          clientId: item.clientId,
          href: routes.content(item.clientId, item.id),
          tone: "neutral",
        })
      }
    }
    for (const account of accounts) {
      if (account.status !== "connected") {
        tasks.push({
          id: `t_acc_${account.id}`,
          kind: "reconnect",
          title: t("dashboard.task.reconnect", { platform: labels.platform(account.platform) }),
          detail: `${name(account.clientId)} · ${t("dashboard.task.accessExpired")}`,
          clientId: account.clientId,
          href: routes.settings,
          tone: "warning",
        })
      }
    }
    return tasks
  }
)

/** Statuts d'un contenu qui méritent une place dans l'agenda du freelance. */
const AGENDA_PUBLISH_STATUSES: ContentItem["status"][] = ["scheduled", "approved", "publishing"]

function agendaStart(item: AgendaItem): string {
  return item.kind === "event" ? item.event.startsAt : item.startsAt
}

/**
 * Agenda unifié : événements des calendriers connectés (scopés utilisateur) +
 * publications programmées de l'org. La vue SQL `unified_agenda` sert le
 * worker ; côté UI on compose, parce que la branche « publication » exige le
 * ContentItem ET le Client complets.
 */
export const getUnifiedAgenda = cache(async (orgId: string): Promise<AgendaItem[]> => {
  if (!orgId) return []
  const [events, items, clients] = await Promise.all([
    getCalendarEvents(orgId),
    getContentItems(orgId),
    getClients(orgId, true),
  ])

  const clientById = new Map<string, Client>(clients.map((client) => [client.id, client]))

  const eventItems: AgendaItem[] = events
    .filter((event) => event.enabled)
    .map((event) => ({ kind: "event", id: event.id, event }))

  const publications: AgendaItem[] = items.flatMap((content) => {
    if (!content.scheduledAt || !AGENDA_PUBLISH_STATUSES.includes(content.status)) return []
    const client = clientById.get(content.clientId)
    // Un contenu sans client résoluble ne doit pas faire planter l'agenda.
    if (!client) return []
    return [
      {
        kind: "publication",
        id: `pub_${content.id}`,
        content,
        client,
        startsAt: content.scheduledAt,
      },
    ]
  })

  return [...eventItems, ...publications].sort((a, b) =>
    agendaStart(a).localeCompare(agendaStart(b))
  )
})

/** Données du shell applicatif (sidebar, cloche, palette de commandes). */
export const getShellSnapshot = cache(async (orgId: string) => {
  const [clients, currentUser, notifications, unreadCount, contentItems, socialAccounts] =
    await Promise.all([
      getClients(orgId),
      getCurrentUser(),
      getNotifications(orgId, "owner"),
      getUnreadCount(orgId, "owner"),
      getContentItems(orgId),
      getSocialAccounts(orgId),
    ])
  return { clients, currentUser, notifications, unreadCount, contentItems, socialAccounts }
})
