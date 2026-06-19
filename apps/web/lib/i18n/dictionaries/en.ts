import type { Dictionary } from "./fr"

// ENGLISH dictionary — must mirror exactly the keys of fr.ts.
// The `Dictionary` type enforces structural parity at build time.

export const en: Dictionary = {
  common: {
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    confirm: "Confirm",
    close: "Close",
    back: "Back",
    next: "Next",
    previous: "Previous",
    edit: "Edit",
    duplicate: "Duplicate",
    search: "Search",
    loading: "Loading…",
    today: "Today",
    all: "All",
    none: "None",
    seeDetail: "View details",
    skipToContent: "Skip to content",
    previewSuffix: "(preview)",
  },
  locale: {
    toggleLabel: "Change language",
    switchTo: "Switch to {lang}",
  },
  meta: {
    appTitleDefault: "Ocean — the freelance communication command center",
    appDescription:
      "Scheduling, feed preview, editorial calendar, client approval and unified agenda — an agency's entire workflow in a single tool.",
  },
  status: {
    content: {
      idea: "Idea",
      draft: "Draft",
      in_review: "In review",
      changes_requested: "Changes requested",
      approved: "Approved",
      scheduled: "Scheduled",
      publishing: "Publishing…",
      published: "Published",
      partially_published: "Partially published",
      failed: "Failed",
      canceled: "Canceled",
    },
    target: {
      pending: "Pending",
      queued: "Queued",
      publishing: "Publishing…",
      awaiting_manual: "Publish manually",
      published: "Published",
      pushed_to_platform: "Draft pushed",
      failed: "Failed",
      skipped: "Skipped",
      canceled: "Canceled",
    },
    account: {
      connected: "Connected",
      needs_reauth: "Reconnection required",
      expired: "Expired",
    },
    review: {
      pending: "Pending",
      partial: "Partially handled",
      done: "Handled",
    },
    approval: {
      required: "Approval required",
      optional: "Approval optional",
      auto: "Direct publishing",
    },
    activity: {
      created: "Created",
      updated: "Updated",
      sent_for_review: "Sent for review",
      commented: "Commented",
      approved: "Approved",
      changes_requested: "Changes requested",
      scheduled: "Scheduled",
      rescheduled: "Rescheduled",
      published: "Published",
      failed: "Failed",
      retried: "Retried",
    },
  },
  format: {
    post: "Post",
    carousel: "Carousel",
    reel: "Reel",
    story: "Story",
  },
  platform: {
    custom: "Custom",
  },
  marronnier: {
    kind: {
      ferie: "Public holiday",
      fete: "Celebration",
      soldes: "Sales",
      marketing: "Key date",
    },
  },
  quota: {
    label: "Quota:",
    window: {
      ig: "posts · 24h",
      fb: "Reels · 24h",
      tt: "drafts · 24h",
    },
  },
  specs: {
    errorPrefix: "Error:",
    warningPrefix: "Warning:",
    crop916:
      "9:16 crop recommended for {target, select, reel {a Reel} story {a story} other {this format}} (currently: {current}).",
    igRatioOut: "{ratio} ratio outside Instagram bounds (4:5 to 1.91:1) — crop the visual.",
    igImageTooBig: "{size} MB image — Instagram accepts {max} MB max in JPEG.",
    notJpeg: "Non-JPEG format: automatic conversion before publishing.",
    videoRequired: "A video is required for this format on {platform}.",
    videoFormat: "Unsupported video format — MP4 or MOV expected.",
    videoTooShort: "Video too short: {min}s minimum on {platform}.",
    videoTooLong: "Video too long: {max} maximum on {platform}.",
    videoTooBig: "{size} MB video — {max} MB maximum.",
    storyTooLong: "Video story limited to {max}s.",
    feedVideoAsReel: "Feed videos are published as Reels by Instagram.",
    carouselMax: "Maximum {max} visuals per carousel (Meta API limit).",
    carouselMin: "A carousel contains at least {min} visuals.",
  },
}
