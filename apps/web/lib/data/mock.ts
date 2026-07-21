import "server-only"

import { cache } from "react"
import type { Locale, Translator } from "@/lib/i18n"
import {
  APPROVALS,
  CALENDAR_ACCOUNTS,
  CALENDAR_EVENTS,
  CLIENTS,
  COMMENTS,
  CONTENT_ITEMS,
  CURRENT_USER,
  getActivityEntries as mockGetActivityEntries,
  getApprovals as mockGetApprovals,
  getBrandKit as mockGetBrandKit,
  getCalendarEvents as mockGetCalendarEvents,
  getClientEvents as mockGetClientEvents,
  getComments as mockGetComments,
  getContentItem as mockGetContentItem,
  getContentItems as mockGetContentItems,
  getContentVersions as mockGetContentVersions,
  getDashboardTasks as mockGetDashboardTasks,
  getHashtagGroups as mockGetHashtagGroups,
  getImportedPosts as mockGetImportedPosts,
  getLibraryAssets as mockGetLibraryAssets,
  getNotifications as mockGetNotifications,
  getPillars as mockGetPillars,
  getPortalContent as mockGetPortalContent,
  getPostMetrics as mockGetPostMetrics,
  getQuotaUsage as mockGetQuotaUsage,
  getRecurringSlots as mockGetRecurringSlots,
  getReviewer as mockGetReviewer,
  getReviewRequest as mockGetReviewRequest,
  getSavedViews as mockGetSavedViews,
  getSocialAccounts as mockGetSocialAccounts,
  getTopPosts as mockGetTopPosts,
  getTrashedContent as mockGetTrashedContent,
  getUnifiedAgenda as mockGetUnifiedAgenda,
  getUnreadCount as mockGetUnreadCount,
  REVIEWERS,
  SOCIAL_ACCOUNTS,
} from "@/lib/mocks"
import type { NotificationAudience } from "@/lib/mocks/types"

export const getCurrentUser = cache(async () => CURRENT_USER)

export const getClients = cache(async (orgId: string, includeArchived = false) =>
  orgId ? CLIENTS.filter((client) => includeArchived || !client.archivedAt) : []
)

export const getClient = cache(async (orgId: string, clientId: string) => {
  const client = orgId ? CLIENTS.find((item) => item.id === clientId) : null
  return client ?? null
})

export const getContentItems = cache(async (orgId: string, clientId?: string) =>
  orgId ? mockGetContentItems(clientId) : []
)

export const getContentItem = cache(async (orgId: string, clientId: string, id: string) => {
  const item = mockGetContentItem(id)
  return orgId && item?.clientId === clientId ? item : null
})

export const getTrashedContent = cache(async (orgId: string, clientId?: string) =>
  orgId ? mockGetTrashedContent(clientId) : []
)

export const getSocialAccounts = cache(async (orgId: string, clientId?: string) =>
  orgId ? mockGetSocialAccounts(clientId) : []
)

export const getReviewer = cache(
  async (_orgId: string, clientId: string) => mockGetReviewer(clientId) ?? null
)
export const getComments = cache(async (_orgId: string, _clientId: string, contentId: string) =>
  mockGetComments(contentId)
)
export const getApprovals = cache(async (_orgId: string, _clientId: string, contentId: string) =>
  mockGetApprovals(contentId)
)
export const getReviewRequest = cache(
  async (_orgId: string, clientId: string) => mockGetReviewRequest(clientId) ?? null
)
export const getContentVersions = cache(
  async (_orgId: string, _clientId: string, contentId: string) => mockGetContentVersions(contentId)
)
export const getActivityEntries = cache(
  async (_orgId: string, _clientId: string, contentId: string) => mockGetActivityEntries(contentId)
)
export const getImportedPosts = cache(async (_orgId: string, clientId: string) =>
  mockGetImportedPosts(clientId)
)
export const getLibraryAssets = cache(async (_orgId: string, clientId: string) =>
  mockGetLibraryAssets(clientId)
)
export const getPillars = cache(async (_orgId: string, clientId: string) =>
  mockGetPillars(clientId)
)
export const getBrandKit = cache(async (_orgId: string, clientId: string) =>
  mockGetBrandKit(clientId)
)
export const getHashtagGroups = cache(async (_orgId: string, clientId: string) =>
  mockGetHashtagGroups(clientId)
)
export const getClientEvents = cache(async (_orgId: string, clientId: string) =>
  mockGetClientEvents(clientId)
)
export const getPostMetrics = cache(async (_orgId: string, clientId: string) =>
  mockGetPostMetrics(clientId)
)
export const getTopPosts = cache(async (_orgId: string, clientId: string, limit = 3) =>
  mockGetTopPosts(clientId, limit)
)
export const getQuotaUsage = cache(async (_orgId: string, accountId: string) =>
  mockGetQuotaUsage(accountId)
)
export const getSavedViews = cache(async (_orgId: string, clientId: string) =>
  mockGetSavedViews(clientId)
)
export const getRecurringSlots = cache(async (_orgId: string, clientId: string) =>
  mockGetRecurringSlots(clientId)
)
export const getNotifications = cache(
  async (_orgId: string, audience: NotificationAudience = "owner") => mockGetNotifications(audience)
)
export const getUnreadCount = cache(
  async (_orgId: string, audience: NotificationAudience = "owner") => mockGetUnreadCount(audience)
)
export const getCalendarEvents = cache(async (_orgId: string) => mockGetCalendarEvents())
export const getUnifiedAgenda = cache(async (_orgId: string) => mockGetUnifiedAgenda())
export const getCalendarAccounts = cache(async (_orgId: string) => CALENDAR_ACCOUNTS)
export const getDashboardTasks = cache(async (_orgId: string, t: Translator, locale: Locale) =>
  mockGetDashboardTasks(t, locale)
)

export const getShellSnapshot = cache(async (orgId: string) => ({
  clients: await getClients(orgId),
  currentUser: await getCurrentUser(),
  notifications: await getNotifications(orgId, "owner"),
  unreadCount: await getUnreadCount(orgId, "owner"),
  contentItems: await getContentItems(orgId),
  socialAccounts: await getSocialAccounts(orgId),
}))

export const getPortalContent = cache(async (clientIds: string[]) =>
  clientIds.flatMap((clientId) => mockGetPortalContent(clientId))
)

export const getPortalContentItem = cache(async (clientIds: string[], contentId: string) => {
  const item = mockGetContentItem(contentId)
  return item && clientIds.includes(item.clientId) ? item : null
})

export {
  APPROVALS,
  CALENDAR_ACCOUNTS,
  CALENDAR_EVENTS,
  COMMENTS,
  CONTENT_ITEMS,
  CURRENT_USER,
  REVIEWERS,
  SOCIAL_ACCOUNTS,
}
