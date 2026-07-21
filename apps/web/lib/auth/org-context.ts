import "server-only"

import { cache } from "react"
import { CLIENTS, CURRENT_USER, ORG, REVIEWERS } from "@/lib/mocks"

export const getActiveOrg = cache(async () => ({
  org: { ...ORG, org_id: ORG.id },
  role: "owner" as const,
  user: CURRENT_USER,
}))

export const getReviewerContext = cache(async () => {
  const reviewer = REVIEWERS[0] ?? null
  const clients = reviewer ? CLIENTS.filter((client) => client.id === reviewer.clientId) : []
  return {
    orgId: ORG.id,
    reviewer,
    clients,
    clientIds: clients.map((client) => client.id),
  }
})

export type ActiveOrgContext = Awaited<ReturnType<typeof getActiveOrg>>
export type ReviewerContext = Awaited<ReturnType<typeof getReviewerContext>>
