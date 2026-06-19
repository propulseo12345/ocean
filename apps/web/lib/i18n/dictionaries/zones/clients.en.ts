import type { clientsFr } from "./clients.fr"

// Namespace i18n « clients » (EN) — doit refléter les clés de clientsFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const clientsEn: Widen<typeof clientsFr> = {
  clients: {
    // Client list
    listTitle: "Clients",
    listDescription: "Your workspaces. Each client is isolated: content, accounts, approvals.",
    newClient: "New client",
    statScheduled: "Scheduled",
    statReview: "In review",
    statPublished: "Published",
    archivedTitle: "Archived",
    archivedCollab: "Collaboration archived",
    accountToReconnect: "An account needs reconnecting",
    // Create a client
    newClientTitle: "New client",
    newClientDescription:
      "Create an isolated workspace: identity, accounts, brand and strategy in a few steps.",
    // Client workspace (layout + tabs)
    newContent: "New content",
    // Metadata titles (browser tab)
    metaGrid: "Feed grid",
    metaCalendar: "Editorial calendar",
    metaContentBoard: "Content studio",
    metaContentDetail: "Content",
    metaContentNew: "New content",
    metaContentEdit: "Edit content",
    metaIdeas: "Idea bank",
    metaLibrary: "Media library",
    metaPerformance: "Performance",
    metaSettings: "Settings",
    metaReport: "Client report",
    // Feed grid — Instagram profile
    importedPostTitle: "Post from {date}",
    highlightNouveautes: "What's new",
    highlightCoulisses: "Behind the scenes",
    highlightAvis: "Reviews",
    highlightEquipe: "Team",
    // Content detail
    backToContent: "Back to content",
    tabMedia: "Media",
    tabNativePreview: "Native preview",
    fieldNewsletterSubject: "Newsletter subject",
    fieldCaption: "Caption",
    fieldFirstComment: "First Instagram comment",
    cardActions: "Actions",
    cardClientReview: "Client review",
    cardTargets: "Targets ({count})",
    noteContentLabel: "Content note",
    // Edit — read-only lock
    readOnlyTitle: "Content is read-only",
    readOnlyDescription:
      "Publishing has started: “{title}” can no longer be edited. Duplicate the content from its page to start a fresh version.",
    // Account settings (global workspace)
    settingsTitle: "Settings",
    settingsDescription: "Social accounts, connected calendars and profile.",
  },
}
