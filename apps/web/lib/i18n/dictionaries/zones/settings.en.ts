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
      emptyTitle: "No client workspace",
      emptyDescription:
        "Create a client workspace to connect an Instagram, Facebook or TikTok account to it.",
      needsAttention:
        "{count, plural, one {# account needs reconnecting} other {# accounts need reconnecting}}",
      healthDescription:
        "Access health is monitored continuously: an expired connection is caught before publishing time. Reconnect the flagged accounts to avoid any failure.",
      followers: "{count} followers",
      noAccountForClient: "No account connected for this client.",
      connect: "Connect an account",
      connectPlatform: "Connect {platform}",
      reconnect: "Reconnect",
      connectedToast: "{provider} account connected",
      connectErrorTitle: "Connection failed",
      errorUnconfigured: "This integration isn't configured yet (missing credentials).",
      errorDenied: "Authorization was denied on the platform.",
      errorGeneric: "The connection failed. Please try again in a moment.",
    },
    calendars: {
      readOnlyTitle: "Read-only connection",
      readOnlyDescription:
        "Ocean reads your events to build the unified agenda (Google + Outlook) in your timezone. No event is created or changed on your calendars.",
      connect: "Connect a calendar",
      reconnect: "Reconnect",
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
