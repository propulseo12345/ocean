import type { libraryFr } from "./library.fr"
// Namespace i18n « library » (EN) — doit refléter les clés de libraryFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const libraryEn: Widen<typeof libraryFr> = {
  library: {
    // Header / workspace
    title: "Media library",
    subtitle: "{name}'s media bank — the composer pulls from it without re-uploading.",
    select: "Select",
    depositLink: "Client upload link",
    addMedia: "Add media",
    // Sort
    sort: {
      recent: "Most recent",
      weight: "Largest",
      usage: "Most used",
      ariaLabel: "Sort media",
    },
    // Asset sources
    source: {
      upload: "Upload",
      uploadVerb: "Added on",
      depositClient: "Submitted by client",
      depositVerb: "Received on",
      import: "Imported",
      importVerb: "Imported on",
    },
    // MIME types (fallback label)
    mime: {
      video: "Video",
      image: "Image",
    },
    // Units
    unit: {
      mb: "{value} MB",
      video: "Video",
    },
    // Asset card
    card: {
      fallbackLabel: "Media {id}",
      selectAria: "Select {label}",
      openAria: "Open details for {label}",
      usedCount: "Used ×{count}",
      unused: "Unused",
      offSpec: "Off Instagram specs",
      specWarning: "Spec warning",
    },
    // Grid
    grid: {
      emptyFilteredTitle: "No media matches",
      emptyTitle: "Empty media library",
      emptyFilteredDesc: "Adjust the search or filters to find your media.",
      emptyDesc: "Add media or send an upload link to your client to get started.",
      depositSection: "From the client",
      depositCount:
        "{count, plural, one {# file submitted via the upload link} other {# files submitted via the upload link}}",
      allMedia: "All media",
    },
    // Header stats (chips)
    stats: {
      total: "{count, plural, one {item} other {items}}",
      unused: "{count, plural, one {unused} other {unused}}",
      deposit: "{count, plural, one {from the client} other {from the client}}",
      offSpec: "off-spec",
    },
    // Toolbar / filters
    toolbar: {
      searchPlaceholder: "Search (alt text, file name)…",
      searchAria: "Search media",
      filtersLabel: "Media library filters",
      typeImage: "Images",
      typeVideo: "Videos",
      usageUsed: "Used",
      usageUnused: "Unused",
      offSpecIg: "Off IG specs",
      clear: "Clear",
    },
    // Asset sheet
    sheet: {
      conform: "Meets Instagram specs.",
      createContent: "Create content with this media",
      crop: "Crop (preview)",
      cropToastTitle: "Crop simulated (preview)",
      cropToastDesc: "The 4:5 · 1:1 · 9:16 crop editor will open here in the live app.",
      delete: "Delete (preview)",
    },
    // Asset details
    details: {
      type: "Type",
      format: "Format",
      dimensions: "Dimensions",
      ratio: "Ratio",
      weight: "Size",
      duration: "Duration",
      source: "Source",
      altLabel: "Alt text",
      altPlaceholder: "Describe the visual for accessibility and social SEO…",
      altHint: "Sent to Instagram and Facebook when the platform supports it.",
      save: "Save (preview)",
      usedIn: "{count, plural, one {Used in # piece of content} other {Used in # pieces of content}}",
      neverUsed: "Never used",
      unusedHint: "Unused media — perfect for your next content batch.",
      purgeNote:
        "In the live app, the original is purged 7 days after publishing: only the thumbnail remains, and reusing this media will require a re-upload.",
    },
    // Delete dialog
    deleteDialog: {
      title: "Delete this media?",
      description:
        "{name} is used in {count, plural, one {# piece of content} other {# pieces of content}}:",
      andMore: "{count, plural, one {and # more…} other {and # more…}}",
      warning:
        "In the live app, this content would lose this visual and revert to draft. In preview, deletion is purely visual.",
      confirm: "Delete anyway (preview)",
    },
    // Selection bar (batch)
    selection: {
      itemLabel: "selected",
      download: "Download (preview)",
      tag: "Tag",
      delete: "Delete",
    },
    // Client upload link
    deposit: {
      title: "Client upload link",
      description:
        "{name} uploads their photos and videos through this secure email link — no password to remember. Everything lands straight in “From the client”, and you're notified on every upload.",
      urlLabel: "Upload link",
      copyAria: "Copy the upload link",
      validityLabel: "Validity period",
      validityDays: "{count} days",
      validityHint: "After that, the link expires — you can generate a new one here.",
      received:
        "{count, plural, one {# file already received from the client} other {# files already received from the client}}",
      seeInLibrary: "view in the media library",
      sendEmail: "Send by email (preview)",
      copyLink: "Copy link",
      copied: "Link copied to clipboard",
      copyError: "Couldn't copy — select the link manually.",
      emailToastTitle: "Upload email sent (preview)",
      emailToastDesc: "Your client will get the link valid for {count} days, with the format guidelines.",
    },
    // Upload dialog
    upload: {
      title: "Add media",
      description: "No file is actually uploaded during the preview — clicking simulates the upload.",
      dropTitle: "Drop your photos and videos here",
      dropHint: "or click to browse (upload simulation)",
      specImage: "Instagram images: JPEG ≤ {max} MB, ratio 4:5 to 1.91:1 — PNGs converted automatically.",
      specHeic: "iPhone HEIC: converted to JPEG on import, nothing for you to do.",
      specReel: "Reels: MP4 or MOV, 3 s to 15 min, ≤ {max} MB.",
    },
    // Toasts (workspace)
    toast: {
      deleted: "Media deleted (preview)",
      noneDeletedTitle: "No media deleted",
      noneDeletedDesc: "All selected media are used in content.",
      batchDeleted:
        "{count, plural, one {# media deleted (preview)} other {# media deleted (preview)}}",
      batchKept:
        "{count, plural, one {# kept: used in content.} other {# kept: used in content.}}",
      downloading:
        "{count, plural, one {# media downloading (preview)} other {# media downloading (preview)}}",
      tagTitle: "Tags (preview)",
      tagDesc:
        "{count, plural, one {Free tags will appear here for # media.} other {Free tags will appear here for # media.}}",
      altSaved: "Alt text saved (preview)",
      added: "{count, plural, one {# media added (preview)} other {# media added (preview)}}",
      addedDesc: "No file uploaded — mock assets to validate the flow.",
    },
  },
}
