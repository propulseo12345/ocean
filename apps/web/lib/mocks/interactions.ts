import { CLIENTS, REVIEWERS } from "./clients"
import { CONTENT_ITEMS } from "./content"
import { dayAt } from "./time"
import type { Approval, Comment, ContentItem, ReviewRequest } from "./types"

function reviewerFor(clientId: string) {
  return REVIEWERS.find((r) => r.clientId === clientId)
}

const REVIEW_TARGETS = CONTENT_ITEMS.filter(
  (c) => c.status === "in_review" || c.status === "changes_requested"
)

export const COMMENTS: Comment[] = REVIEW_TARGETS.flatMap((c, i) => {
  const reviewer = reviewerFor(c.clientId)
  const rName = reviewer?.name ?? "Client"
  const out: Comment[] = []
  if (c.status === "changes_requested") {
    out.push({
      id: `cm_${c.id}_1`,
      contentId: c.id,
      authorName: rName,
      role: "reviewer",
      body: "On peut éclaircir un peu la photo ici ? Et « weekend » → « week-end ».",
      createdAt: dayAt(-1, 14),
      annotation: c.media[0]
        ? { mediaAssetId: c.media[0].id, slideIndex: 0, x: 0.42, y: 0.36 }
        : undefined,
    })
    out.push({
      id: `cm_${c.id}_2`,
      contentId: c.id,
      authorName: "Étienne Mercier",
      role: "owner",
      body: "C'est noté, je renvoie une version corrigée ce soir.",
      createdAt: dayAt(-1, 15),
    })
  } else {
    out.push({
      id: `cm_${c.id}_1`,
      contentId: c.id,
      authorName: rName,
      role: "reviewer",
      body: "Super, j'adore la direction ! 👏",
      createdAt: dayAt(0, 6),
    })
    if (i % 2 === 0 && c.media[0]) {
      out.push({
        id: `cm_${c.id}_2`,
        contentId: c.id,
        authorName: rName,
        role: "reviewer",
        body: "Petit doute sur ce détail, qu'en penses-tu ?",
        createdAt: dayAt(0, 6, 12),
        annotation: { mediaAssetId: c.media[0].id, slideIndex: 0, x: 0.62, y: 0.55 },
      })
    }
  }
  return out
})

function approvalsFor(c: ContentItem): Approval[] {
  const reviewer = reviewerFor(c.clientId)
  if (!reviewer) return []
  if (c.status === "changes_requested") {
    return [
      {
        id: `ap_${c.id}`,
        contentId: c.id,
        reviewerId: reviewer.id,
        decision: "changes_requested",
        message: "Quelques retouches avant validation.",
        versionLabel: "v1",
        createdAt: dayAt(-1, 14),
      },
    ]
  }
  if (c.status === "approved" || c.status === "scheduled") {
    return [
      {
        id: `ap_${c.id}`,
        contentId: c.id,
        reviewerId: reviewer.id,
        decision: "approved",
        message: "Parfait, on valide.",
        versionLabel: "v1",
        createdAt: dayAt(-2, 10),
      },
    ]
  }
  return []
}

export const APPROVALS: Approval[] = CONTENT_ITEMS.flatMap(approvalsFor)

export const REVIEW_REQUESTS: ReviewRequest[] = CLIENTS.filter((c) => !c.archivedAt)
  .map((client): ReviewRequest | null => {
    const reviewer = reviewerFor(client.id)
    const items = CONTENT_ITEMS.filter(
      (c) =>
        c.clientId === client.id && (c.status === "in_review" || c.status === "changes_requested")
    )
    if (!reviewer || items.length === 0) return null
    return {
      id: `rr_${client.id}`,
      clientId: client.id,
      contentIds: items.map((c) => c.id),
      reviewerIds: [reviewer.id],
      message: "Voici les prochaines publications à valider, merci !",
      sentAt: dayAt(-1, 9),
      state: "partial",
    }
  })
  .filter((r): r is ReviewRequest => r !== null)
