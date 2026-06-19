import { dayAt } from "./time"
import type { CalendarEvent } from "./types"

const GOOGLE = "ca_google"
const MS = "ca_ms"

// Calendriers (avec leur couleur de thème) → pour la vue agenda unifié.
const STUDIO = { name: "Studio Marea", color: "var(--chart-1)", acc: GOOGLE }
const PERSO = { name: "Perso", color: "var(--chart-3)", acc: GOOGLE }
const FERIES = { name: "Jours fériés", color: "var(--chart-5)", acc: GOOGLE }
const CLIENTS_CAL = { name: "Clients", color: "var(--chart-2)", acc: MS }

interface Spec {
  cal: typeof STUDIO
  title: string
  day: number
  start: number
  end: number
  min?: number
  endMin?: number
  allDay?: boolean
  location?: string
  enabled?: boolean
}

const SPECS: Spec[] = [
  {
    cal: STUDIO,
    title: "Tournage Reel — Maison Verde",
    day: -1,
    start: 12,
    end: 14,
    location: "Restaurant Maison Verde",
  },
  { cal: PERSO, title: "Cours de yoga", day: 0, start: 6, end: 6, endMin: 45 },
  { cal: STUDIO, title: "Appel découverte — prospect", day: 0, start: 9, end: 9, endMin: 30 },
  {
    cal: CLIENTS_CAL,
    title: "Déjeuner Léa — Atelier Nove",
    day: 0,
    start: 11,
    end: 12,
    location: "Le Récamier",
  },
  {
    cal: STUDIO,
    title: "Shooting produit — Brûlerie",
    day: 0,
    start: 14,
    end: 15,
    location: "Brûlerie Lacaze",
  },
  { cal: FERIES, title: "Fête locale", day: 1, start: 0, end: 23, allDay: true, enabled: false },
  { cal: CLIENTS_CAL, title: "Brief contenu — Studio Rise", day: 1, start: 13, end: 14 },
  { cal: STUDIO, title: "Atelier photo mensuel", day: 2, start: 16, end: 17, endMin: 30 },
  { cal: CLIENTS_CAL, title: "Point mensuel — Maison Verde", day: 3, start: 9, end: 9, endMin: 45 },
  { cal: STUDIO, title: "Standup hebdo", day: 4, start: 6, end: 6, endMin: 30 },
  { cal: PERSO, title: "Déjeuner famille", day: 5, start: 11, end: 12 },
  { cal: STUDIO, title: "Salon du café", day: 6, start: 0, end: 23, allDay: true },
  { cal: STUDIO, title: "Formation Meta Ads", day: 7, start: 8, end: 10 },
]

export const CALENDAR_EVENTS: CalendarEvent[] = SPECS.map((s, i) => ({
  id: `ev_${i}`,
  accountId: s.cal.acc,
  calendarName: s.cal.name,
  colorVar: s.cal.color,
  title: s.title,
  startsAt: dayAt(s.day, s.start, s.min ?? 0),
  endsAt: dayAt(s.day, s.end, s.endMin ?? 0),
  allDay: s.allDay ?? false,
  location: s.location,
  enabled: s.enabled ?? true,
}))
