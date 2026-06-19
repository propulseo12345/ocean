import type { settingsFr } from "./settings.fr"

// Namespace i18n « settings » (EN) — doit refléter les clés de settingsFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const settingsEn: Widen<typeof settingsFr> = {
  settings: {
    tabs: {
      social: "Social accounts",
      calendars: "Calendars",
      profile: "Profile",
    },
    accounts: {
      emptyTitle: "No social account connected",
      emptyDescription:
        "Connect an Instagram, Facebook or TikTok account from a client workspace to start publishing.",
      needsAttention:
        "{count, plural, one {# account needs reconnecting} other {# accounts need reconnecting}}",
      healthDescription:
        "Access health is monitored continuously: an expired connection is caught before publishing time. Reconnect the flagged accounts to avoid any failure.",
      followers: "{count} followers",
      reconnect: "Reconnect",
      reconnectToast: "Reconnecting {platform}",
      reconnectToastDescription: "Simulated action (preview) — authentication will open here.",
    },
    calendars: {
      readOnlyTitle: "Read-only connection",
      readOnlyDescription:
        "Ocean reads your events to build the unified agenda (Google + Outlook) in your timezone. No event is created or changed on your calendars.",
      connect: "Connect a calendar",
      connectToast: "Connecting {provider}",
      connectToastDescription: "Simulated action (preview) — authorization will open here.",
      reconnect: "Reconnect",
      reconnectToast: "Reconnecting {provider}",
      reconnectToastDescription: "Simulated action (preview) — authorization will open here.",
      providerGoogle: "Google Calendar",
      providerMicrosoft: "Microsoft Outlook",
    },
    profile: {
      title: "Profile",
      description: "Your account information. Editing will land in a future version.",
      name: "Name",
      email: "Email address",
      timezone: "Timezone",
      timezoneHint: "Used to display your unified agenda.",
    },
  },
}
