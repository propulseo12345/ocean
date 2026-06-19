import type { composerFr } from "./composer.fr"

// Namespace i18n « composer » (EN) — doit refléter les clés de composerFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const composerEn: Widen<typeof composerFr> = {
  composer: {
    // Header
    header: {
      back: "Back to studio",
      titleCreate: "New content",
      titleEdit: "Edit content",
      tzHint: "({tz} time)",
      noDate: "No date",
      reschedule: "Reschedule…",
      schedule: "Schedule…",
      save: "Save",
    },

    // Content section
    basics: {
      title: "Content",
      internalTitle: "Internal title",
      internalTitlePlaceholder: "e.g. New Ethiopia single origin",
      format: "Format",
      state: "Status",
      stateIdea: "Idea",
      stateDraft: "Draft",
      pillar: "Editorial pillar",
      noPillar: "No pillar",
      labels: "Labels",
      removeLabel: "Remove label {label}",
      addLabelPlaceholder: "Add (Enter)…",
      internalNotes: "Internal notes",
      internalNotesPlaceholder: "Never visible to the client — brief, reminders, links…",
    },

    // Caption section
    caption: {
      title: "Caption",
      commonTab: "Shared",
      commonPlaceholder: "Write the caption shared across all platforms…",
      commonAria: "Shared caption",
      destinationCaption: "the caption",
      customized: "Customized",
      inherited: "Inherited from the shared caption",
      backToCommon: "Revert to shared",
      customizeFor: "Customize for {platform}",
      captionFor: "{platform} caption",
      commonEmpty: "Shared caption is empty.",
      firstComment: "First comment (Instagram)",
      firstCommentPlaceholder:
        "Hashtags outside the caption, link in bio… posted right after publishing.",
      destinationFirstComment: "the first comment",
    },

    // Caption tools (counters, banned words, hashtags)
    tools: {
      over: "over limit",
      truncateAfter: "“… more” after {count}",
      truncateTitle: "Instagram cuts the caption after ~{count} characters in the feed",
      bannedTitle: "Words to avoid (brand kit):",
      bannedSuffix: "— fix or accept before sending for approval.",
      hashtagStats:
        "{total}/{limit} Instagram hashtags (caption {inCaption} · first comment {inFirstComment})",
      hashtagOver: " — limit exceeded",
      hashtagDuplicates: "Caption / comment duplicates: {words}",
    },

    // Media section
    media: {
      title: "Media",
      slidesCount: "{count}/{max} slides (Meta API limit)",
      libraryButton: "Library",
      emptyChoose: "Choose a visual from the library",
      emptyHint: "Real file upload in Phase 1 — the preview pulls from mocked media.",
      slidesAria: "Content slides",
      carouselReorder: "Drag the thumbnails to reorder — the 1st slide is the carousel cover.",
      sizeMb: "{size} MB",
      duration: "{count}s",
      cropped: "cropped {preset}",
      crop: "Crop",
      remove: "Remove",
      altLabel: "Alt text (accessibility)",
      altPlaceholder: "Describe the visual for screen readers…",
      altHint: "Sent to Instagram and Facebook if the platform supports it.",
      noMediaSelected: "No media selected",
      specsTitle: "Platform spec validation",
    },

    // Media picker
    picker: {
      title: "Client library",
      descMultiple:
        "Select up to {max, plural, one {# visual} other {# visuals}} — real upload arrives in Phase 1.",
      descSingle: "Select a visual — real upload arrives in Phase 1.",
      assetAlt: "Library media",
      used: "Used",
      unused: "Unused",
      add: "Add",
      addCount: "Add ({count})",
    },

    // Crop
    crop: {
      square: "Square (feed)",
      portrait: "Portrait (IG recommended)",
      vertical: "Vertical (Reel, story)",
      title: "Crop the visual",
      currentRatio: "Current ratio: {ratio}",
      currentRatioSize: "Current ratio: {ratio} · {size} MB",
      previewAlt: "Visual to crop",
      exportHint:
        "Export as JPEG ≤ 8 MB — automatic conversion and compression before publishing (Instagram specs).",
      apply: "Apply crop",
      toastApplied: "{preset} crop applied (preview)",
      toastDesc: "No real image processing during the preview.",
    },

    // Slide thumbnail
    slide: {
      ariaSlide: "Slide {index}",
      ariaSlideSelected: "Slide {index} (selected)",
      slideAlt: "Slide {index}",
      cover: "Cover",
      removeSlide: "Remove slide {index}",
    },

    // Distribution section
    targets: {
      title: "Distribution",
      followers: "{count} followers",
      targetAria: "Target {platform} @{username}",
      manualChannels: "Manual channels",
      newsletter: "Newsletter",
      newsletterDesc: "Assisted manual publishing at the scheduled time.",
      newsletterAria: "Target the newsletter",
      newsletterSubject: "Newsletter subject",
      newsletterSubjectPlaceholder: "e.g. Cold brew comes in bottles ☀️",
      custom: "Custom",
      customDesc: "Free channel (signage, print, story with stickers…) — manual checklist.",
      customAria: "Target the custom channel",
    },

    // Advanced options
    advanced: {
      title: "Advanced per-platform options",
      igLocation: "Location (geotag)",
      igLocationPlaceholder: "e.g. Lille, France",
      igHint: "Account tagging and collab posts unavailable at MVP (Instagram Login API variant).",
      fbLink: "Outbound link",
      fbHint: "Shown as a link preview under the Facebook post.",
      tiktokHint:
        "Draft publishing: privacy, duet/stitch and comments are set in the TikTok app on finalization. You'll get a notification at the scheduled time with the caption to paste.",
    },

    // Preview
    preview: {
      title: "Preview",
      mediaAlt: "Media preview",
      prevSlide: "Previous slide",
      nextSlide: "Next slide",
      noMedia: "No media selected",
      noTargets: "No platform targeted — Instagram preview by default.",
      emptyCaption: "Caption empty for now…",
      morePlus: "… more",
      moreTitle: "Instagram cuts off here in the feed (~{count} characters)",
    },

    // Preflight panel
    preflight: {
      title: "Scheduling preflight",
      srBlocking: "Blocking: ",
      srWarning: "Warning: ",
      srOk: "OK: ",
      summaryBlocking:
        "{count, plural, one {# blocking issue} other {# blocking issues}} — fix before scheduling.",
      summaryWarnings:
        "Ready to schedule, with {count, plural, one {# warning} other {# warnings}}.",
      summaryReady: "Ready to schedule.",
      // Items
      targetsNone: "No platform targeted",
      targetsNoneDetail: "Enable at least one account or a manual channel.",
      targetsCount: "{count, plural, one {# target} other {# targets}}",
      accountsBroken: "Account to reconnect",
      accountsOk: "Accounts connected",
      mediaNoneManual: "No media (manual channel)",
      mediaNone: "No media",
      mediaNoneDetail: "Add at least one visual from the library.",
      mediaOk: "Media meets specs",
      mediaErrors: "{count, plural, one {# blocking} other {# blocking}}",
      mediaWarnings: "{count, plural, one {# warning} other {# warnings}}",
      mediaOutOfSpec: "Media out of spec",
      mediaToCheck: "Media to review",
      mediaIssuesDetail: "{parts} — see the Media section.",
      captionTooLong: "Caption too long",
      captionTruncated: "Cut off after {count} characters on Instagram",
      captionTruncatedDetail: "Put the key message before the “… more” (see the preview).",
      captionOk: "Caption within limits",
      hashtagsOver: "{total} hashtags — Instagram allows 30",
      hashtagsOverDetail: "Caption + first comment combined.",
      hashtagsDup: "Duplicate hashtags",
      hashtagsOk: "{total}/30 Instagram hashtags",
      bannedHit: "Words to avoid (brand kit)",
      bannedOk: "No banned word detected",
      approvalRequired: "Client approval required",
      approvalRequiredDetail:
        "Send for review before publishing — this client approves everything.",
      approvalOptional: "Client approval optional",
      approvalAuto: "Direct publishing (no approval)",
      dateNone: "No publish date",
      dateNoneDetail: "The content will stay in the “To plan” shelf.",
      datePast: "Date in the past",
      datePastDetail: "Choose “as soon as possible” or a date ≥ now + 15 min.",
      dateOk: "Scheduled for {date}",
      dateOkDetail: "Client time zone ({tz}).",
      altMissing: "Missing alt text ({count, plural, one {# visual} other {# visuals}})",
      altMissingDetail: "Accessibility + social SEO — sent if the platform supports it.",
      altOk: "Alt texts filled in",
    },

    // Scheduling dialog
    schedule: {
      shortcutTomorrow: "Tomorrow 9 AM",
      shortcutSaturday: "Saturday 11 AM",
      shortcutNextSlot: "Next slot ({time})",
      title: "Schedule the post",
      tzNote: "Date and time entered in the client's time zone: {tz}.",
      hour: "Time ({tz})",
      publishAt: "Publishing: {date}",
      tzClient: "(client time zone)",
      inYourTz: "That's {date} in your time zone ({tz}).",
      latePast: "This slot is already past (or less than 15 min away).",
      asap: "Publish as soon as possible",
      asapDetail:
        "Immediate catch-up — beyond {hours} h late, content fails and must be rescheduled.",
      repick: "Pick another date",
      repickDetail: "Select a future slot (≥ now + 15 min).",
      blocked:
        "Blocking preflight: {count, plural, one {# issue to fix} other {# issues to fix}} before scheduling (see the Preflight panel).",
      removeDate: "Remove date",
      confirm: "Schedule",
      toastAsap: "Publishing as soon as possible (preview)",
      toastScheduled: "Scheduling saved (preview)",
      toastScheduledDesc: "{date} — client time zone ({tz}).",
      toastRemoved: "Date removed (preview)",
      toastRemovedDesc: "The content goes back to the “To plan” shelf.",
    },

    // Hashtag popover
    hashtags: {
      groups: "Hashtag groups",
      groupsTitle: "Client groups",
      insertHint: "One click inserts the group into {destination}.",
      tagCount: "{count, plural, one {# tag} other {# tags}}",
    },

    // Main screen (alerts, toasts)
    screen: {
      inReviewTitle: "Content under client review",
      inReviewDesc:
        "In production, saving removes it from review (PRD editability rule) — the client will be notified.",
      scheduledTitle: "Content scheduled",
      scheduledDesc:
        "In production, only the date stays editable without canceling the schedule (PRD rule §5.B).",
      extraMediaRemoved: "Extra visuals removed",
      extraMediaRemovedDesc: "The {format} format only accepts a single media item (preview).",
      savedScheduled: "Content scheduled (preview)",
      savedDraft: "Draft saved (preview)",
      savedDesc: "No data is actually written during the preview.",
    },
  },
}
