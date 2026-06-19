import type { portalFr } from "./portal.fr"

// Namespace i18n « portal » (EN) — doit refléter les clés de portalFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const portalEn: Widen<typeof portalFr> = {
  portal: {
    layout: {
      reviewSpace: "Review space",
      reviewSecuredSpace: "Ocean — review space",
      connectedAs: "Signed in as {name} · Ocean — secure space",
    },
    home: {
      metaTitle: "Review space",
      greeting: "Hello{name},",
      toValidateHeading: "You have {count, plural, one {# post} other {# posts}} to review",
      upToDate: "You're all caught up",
      toValidateLead: "Review each post, leave your comments if needed, then approve in one click.",
      upToDateLead: "As soon as a new post is ready, you'll find it here.",
      sectionToValidate: "To review",
      sectionHistory: "History",
      emptyValidatedTitle: "Everything is approved",
      emptyValidatedDescription: "No post is awaiting your review right now.",
    },
    detail: {
      metaTitle: "Review",
      backToReviewSpace: "Back to the review space",
      yourDecision: "Your decision",
      nothingToDo: "Post {status} — nothing for you to do.",
      decisionHistory: "Decision history",
      approved: "Approved",
      changesRequested: "Changes requested",
    },
    card: {
      textOnly: "Text",
      reviewAndApprove: "Review and approve",
      review: "Review",
    },
    annotation: {
      pinHint: "Tap a marker on the visual to see the related comment.",
      pinLabel: "Marker {label}",
      noThread: "No conversation yet.",
      client: "Client",
      yourAgency: "Your agency",
    },
    carousel: {
      altSlide: "{alt} — visual {index}",
      video: "Video",
      previous: "Previous visual",
      next: "Next visual",
      viewSlide: "View visual {index}",
    },
    review: {
      decisionRecorded: "Decision recorded",
      decisionDetail: "{label} — “{title}” (simulated action, preview).",
      approved: "Content approved",
      changesRequested: "Changes requested",
      approve: "Approve",
      requestChanges: "Request changes",
      changesPlaceholder: "Explain what should be adjusted (copy, visual, date…)",
      changesAriaLabel: "Change request message",
      sendRequest: "Send request",
      footnote: "Your decision is recorded and your agency is notified right away.",
    },
    shared: {
      reconnectSimulated: "{platform} reconnection simulated (preview)",
      reconnectSimulatedDetail: "No account is actually reconnected during the preview.",
      accountStatusTitle: "{platform} — {status}",
      reconnectImpact: "The @{username} account must be reconnected to keep publishing.",
      reconnect: "Reconnect",
      inlineTitle: "@{username} — {status}",
      selectionActions: "Selection actions",
      selectionCount: "{count} {item}",
      clearSelection: "Clear selection",
      itemSelected: "{count, plural, one {selected} other {selected}}",
    },
  },
}
