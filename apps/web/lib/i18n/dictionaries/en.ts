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
}
