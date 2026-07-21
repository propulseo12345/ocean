import type { calendarFr } from "./calendar.fr"

// Namespace i18n « calendar » (EN) — doit refléter les clés de calendarFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const calendarEn: Widen<typeof calendarFr> = {
  calendar: {
    // automation-dialog
    automation: {
      title: "Client automations",
      description:
        "Workflow rules specific to this client. Preview — they'll be active once the backend is wired.",
      ruleToggled: "Rule {state, select, on {enabled} other {disabled}} (preview)",
      rules: {
        remindEmptyWeekLabel: "Remind me if no posts are scheduled 7 days out",
        remindEmptyWeekDesc:
          "A notification warns you when the upcoming week is empty for this client.",
        remindReviewerLabel: "Nudge the client after 48 h without approval",
        remindReviewerDesc: "A reminder is sent automatically to the reviewer (email + portal).",
        quotaDeferLabel: "Auto-defer if the Instagram quota is reached",
        quotaDeferDesc:
          "Ocean's standard behavior: the post is pushed to the next available slot and you're notified of the move.",
        publishOnApprovalLabel: "Publish automatically on approval",
        publishOnApprovalDesc:
          "Only if the scheduled time is more than 15 minutes away — a late approval never publishes on its own.",
      },
    },
    // calendar-banners
    banners: {
      reconnectImpact:
        "{count, plural, one {# {platform} post is at risk} other {# {platform} posts are at risk}} of failing — reconnect the @{username} account.",
      pendingReview:
        "{count, plural, one {# item awaiting} other {# items awaiting}} client approval.",
      pendingReviewAction: "View",
      nextWeekEmpty: "Nothing is scheduled for the next 7 days for this client.",
    },
    // calendar-controls
    controls: {
      monthPosts: "{count, plural, one {# post} other {# posts}} this month",
      gapTitle: "Stretches of more than 4 days with no scheduled post",
      gaps: "{count, plural, one {# cadence gap} other {# cadence gaps}}",
      toPlan: "{count} to schedule",
      igQuotaTitle: "Account Instagram quota (rolling 24 h)",
      marronniers: "Key dates",
      marronniersToggle: "Show key dates",
      legend: "Legend",
      selection: "Select",
      monthMix: "Month mix",
      automations: "Automations",
      export: "Export",
    },
    // calendar-filters
    filters: {
      status: "Status",
      platform: "Platform",
      format: "Format",
      pillar: "Pillar",
      clear: "Clear",
      counts:
        "{count, plural, one {# shown} other {# shown}}{masked, plural, =0 {} one { · # hidden} other { · # hidden}}",
    },
    // calendar-legend
    legend: {
      statuses: "Statuses",
      platforms: "Platforms",
      markers: "Markers",
      lockedDate: "Locked date",
      manualPublish: "Manual publishing",
      tiktokDraft: "TikTok draft",
      internalNote: "Internal note",
      clientEvent: "Client event",
      marronnier: "Key date",
      cadenceGap: "Cadence gap",
    },
    // calendar-toolbar
    toolbar: {
      prevPeriod: "Previous period",
      nextPeriod: "Next period",
      today: "Today",
      todayShortcut: "Shortcut: T",
      clientTimezone: "Client time zone · {tz}",
      goToMonth: "Jump to a specific month",
      prevYear: "Previous year",
      nextYear: "Next year",
      viewMonth: "Month",
      viewWeek: "Week",
      months: {
        jan: "Jan",
        feb: "Feb",
        mar: "Mar",
        apr: "Apr",
        may: "May",
        jun: "Jun",
        jul: "Jul",
        aug: "Aug",
        sep: "Sep",
        oct: "Oct",
        nov: "Nov",
        dec: "Dec",
      },
      weekOf: "Week of {date}",
    },
    // calendar-selection-actions
    selection: {
      shiftDays: "Shift by N days",
      sendToReview: "Send for approval",
      unschedule: "Unschedule",
    },
    // day-cell
    dayCell: {
      gapTitle: "Cadence gap (more than 4 days without a post)",
      viewDay: "View details for {day}",
      densityHigh:
        "{count} Instagram posts this day — high density (the IG quota is measured over a rolling 24 h)",
      densityNormal: "{count} Instagram posts this day",
      addTo: "Add to {day}",
      posts: "{count} posts",
      createContent: "Create content (date prefilled)",
      addNote: "Add a note",
      itemsOnDay: "{count, plural, one {# item} other {# items}} on {day}",
      marronnierTitle: "{label} · {kind} — create content for this date",
      marronnierKindSr: "({kind})",
      note: "Note",
      event: "Event",
      moreOthers: "{count, plural, one {+# more} other {+# more}}",
    },
    // duplicate-dialog
    duplicate: {
      title: "Duplicate content",
      targetDate: "Target date",
      targetClient: "Destination client",
      thisClient: " (this client)",
      copyHint:
        "The copy starts as a draft, media and caption included, with its own approval flow.",
      pastDate: "The target date can't be in the past.",
      confirm: "Duplicate (preview)",
    },
    // move-dialogs (reschedule + shift)
    reschedule: {
      title: "Reschedule",
      date: "Date (client time zone)",
      time: "Time",
      pastError: "Can't reschedule into the past.",
      approvedNote:
        "The client's approval stays valid after the date change — the client is simply notified.",
      confirm: "Reschedule (preview)",
    },
    shift: {
      title: "Shift the selection",
      description:
        "{movable, plural, one {# item will be shifted} other {# items will be shifted}}{locked, plural, =0 {} one { · # skipped (locked status)} other { · # skipped (locked status)}}.",
      daysLabel: "Number of days (negative = earlier)",
      confirm: "Shift by {days, plural, one {# day} other {# days}} (preview)",
    },
    // pillar-mix-panel
    mix: {
      title: "Month mix",
      subtitle: "Actual scheduled share vs. share promised to the client.",
      driftLabel: "{points}-point gap from target",
      meterLabel:
        "{name}: {share}% scheduled (target {target}%, {count, plural, one {# item} other {# items}})",
      targetTitle: "Target: {target}%",
      footnote: "Computed on dated content for the displayed month (excluding canceled).",
    },
    // entry-markers
    markers: {
      reconnectRisk: "Account to reconnect — risk of failure",
      partiallyPublished: "Partially published",
      tiktokDraft: "TikTok draft — finalize in the app",
      manualPublish: "Manual publishing (reminder at the scheduled time)",
      waitingTitle: "Awaiting approval for {days} days",
      waitingDays: "{days}d",
      commentsTitle: "{count, plural, one {# client comment} other {# client comments}}",
      approvalStale: "Stale approval — the content changed since it was approved",
      lockedDefault: "Locked date",
      ariaLabel: "{title} — {status}",
    },
    // calendar-schedule lock reasons
    lock: {
      published: "Already published — the date can no longer change.",
      publishing: "Publishing in progress — date locked.",
      partiallyPublished: "Partially published — reopen the item to retry.",
      failed: 'Failed — use "Retry" rather than moving it.',
      canceled: "Content canceled — date locked.",
    },
    // calendar-actions toasts
    actions: {
      pastError: "Can't schedule into the past",
      persistError: "The scheduling could not be saved.",
      rescheduledApproved: "Rescheduled to {date}",
      rescheduledApprovedDesc:
        "The client's approval stays valid — the client is notified of the date change.",
      moved: "{state, select, scheduled {Scheduled} other {Rescheduled}} for {date}",
      movedDesc: "The new date has been saved.",
      reschedulePrecise: "Rescheduled to {date} at {time}",
      reschedulePreciseApprovedDesc: "The client's approval stays valid — the client is notified.",
      shifted:
        "{dir, select, advance {{count, plural, one {# item moved earlier} other {# items moved earlier}}} other {{count, plural, one {# item shifted} other {# items shifted}}}} by {days, plural, one {# day} other {# days}}",
      shiftedSkippedDesc:
        "{count, plural, one {# skipped} other {# skipped}} (locked status or past date).",
      unscheduled: "Unscheduled {count, plural, one {# item} other {# items}}",
      unscheduledSkippedDesc:
        '{count, plural, one {# skipped} other {# skipped}} (locked status or already undated). The content moves back to "To schedule".',
      unscheduledDesc: 'The content moves back to "To schedule".',
      sendToReview:
        "Approval request sent for {count, plural, one {# item} other {# items}} (preview)",
      sendToReviewDesc: "The client will get a direct link to the approval portal.",
      retry: 'Retry scheduled for "{title}" (preview)',
      retryDesc:
        "Only failed targets will be retried — a target that's already published is never re-published.",
      remind: "Reminder sent to {name} (preview)",
      remindFallbackName: "your client",
      remindDesc: "An email reminder links straight to the content awaiting approval.",
      duplicated: '"{title}" duplicated (preview)',
      duplicatedDesc:
        "Draft copy for {date}{client, select, none {} other { at {client}}} — media, caption and targeting carried over.",
    },
    // day-sheet
    daySheet: {
      itemsCount: "{count, plural, one {# item} other {# items}} · client time zone",
      marronnierKind: " · {kind}",
      createContent: "Create content",
      noContent: "No content this day.",
      notesEvents: "Notes and events",
      noNote: "No note for this day.",
      note: "Note",
      event: "Event",
      addNotePlaceholder: "Add a note (internal)…",
      noteTextLabel: "Note text",
      typeToggle: "Type: {kind, select, note {note} other {event}} — change",
      typeToggleTitle: "Toggle note / event",
      add: "Add",
      createPrefilled: "Create content — date prefilled",
      noteAdded: "{kind, select, note {Note added} other {Event added}} (preview)",
    },
    // day-sheet-row
    daySheetRow: {
      actions: "Actions — {title}",
      openStudio: "Open the studio",
      reschedule: "Reschedule",
      duplicate: "Duplicate",
      retry: "Retry",
      remindClient: "Nudge the client",
    },
    // content-quick-view
    quickView: {
      tiktokDraft: "TikTok draft — finalize in the app at reminder time.",
      manualPublish: "Manual publishing — a reminder will be sent at the scheduled time.",
      awaitingReview: "Awaiting client approval",
      awaitingReviewSince: "Awaiting client approval for {days} days",
      openStudio: "Open the studio",
      reschedule: "Reschedule",
      duplicate: "Duplicate",
      retry: "Retry",
      copyCaption: "Copy caption",
      captionCopied: "Caption copied",
      captionCopiedDesc: "Paste it into the app at reminder time.",
      remindClient: "Nudge the client",
    },
    // entry-shell
    entryShell: {
      select: "Select: {label}",
    },
    // export-dialog
    export: {
      title: "Export the schedule",
      description: 'Print preview — use "Save as PDF" in the print dialog.',
      hideTechnical: "Hide technical statuses",
      clientDeliverable: "Client deliverable (hides failures, canceled and technical statuses)",
      footer: "Schedule generated with Ocean — preview, times in the client's time zone ({tz}).",
      print: "Print / PDF",
    },
    // planning-shelf
    shelf: {
      toPlan: "To schedule",
      allPlanned: "No undated content — everything is scheduled.",
      dragHint: "Drag a card onto a calendar cell to schedule it (preview).",
      evergreenQueue: "Evergreen queue",
      evergreenEmpty: 'Tag content as "Evergreen" in the studio to feed the queue.',
      autoFill: "Auto-fill gaps (preview)",
      autoFillToggle: "Auto-fill gaps",
      autoFillOn: "Auto-fill enabled (preview)",
      autoFillOff: "Auto-fill disabled (preview)",
      autoFillOnDesc: "Ocean will suggest slots — nothing is published without your confirmation.",
      noGaps: "No upcoming cadence gaps this month — nothing to suggest.",
      proposalArrow: ' → "{title}"',
      proposalHint:
        "Suggestions only: the queue proposes slots for cadence gaps, it never publishes without confirmation.",
      noDate: "Undated",
    },
    // month-grid
    monthGrid: {
      emptyTitle: "No content scheduled this month",
      emptyDescription:
        'Schedule content from a date cell, the "To schedule" shelf, or the studio to keep the cadence.',
      createContent: "Create content",
    },
    // week-view
    week: {
      viewDay: "View details for {day}",
      newContent: "New content on {day}",
      note: "Note",
      event: "Event",
      noContent: "No content",
    },
    // weekday short labels (Monday → Sunday)
    weekdays: {
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",
    },
    // day-entry tooltip
    dayEntry: {
      tooltip: "{time} · {title}",
    },
  },
}
