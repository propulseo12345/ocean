import type { agendaFr } from "./agenda.fr"

// Namespace i18n « agenda » (EN) — doit refléter les clés de agendaFr.
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export const agendaEn: Widen<typeof agendaFr> = {
  agenda: {
    // Page header (agenda/page.tsx)
    metaTitle: "Unified agenda",
    pageTitle: "Unified agenda",
    pageDescription:
      "Your Google and Outlook meetings layered over every client's posts — in your time zone.",
    // Week navigation
    prevWeek: "Previous week",
    nextWeek: "Next week",
    today: "Today",
    filters: "Filters",
    calendarsAndFilters: "Calendars & filters",
    // Empty states
    freeWeek: "Free week",
    freeWeekHint: "No meetings or posts this week.",
    // Grid / blocks
    allDayShort: "Day",
    allDay: "All day",
    // Sidebar
    connectedAccounts: "Connected accounts",
    calendars: "Calendars",
    showCalendar: "Show the {name} calendar",
    legend: "Legend",
    legendEvent: "Calendar event",
    legendPublication: "Scheduled post",
    // Short weekday labels (Mon → Sun)
    weekday: {
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
      sun: "Sun",
    },
  },
}
