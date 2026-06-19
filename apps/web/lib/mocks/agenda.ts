import { loc } from "@/lib/i18n"
import type { L } from "@/lib/i18n"
import { dayAt } from "./time"
import type { CalendarEvent } from "./types"

const GOOGLE = "ca_google"
const MS = "ca_ms"

interface Cal {
  name: L<string>
  color: string
  acc: string
}

// Calendriers (avec leur couleur de thème) → pour la vue agenda unifié.
const STUDIO: Cal = { name: loc("Studio Marea", "Studio Marea"), color: "var(--chart-1)", acc: GOOGLE }
const PERSO: Cal = { name: loc("Perso", "Personal"), color: "var(--chart-3)", acc: GOOGLE }
const FERIES: Cal = { name: loc("Jours fériés", "Holidays"), color: "var(--chart-5)", acc: GOOGLE }
const CLIENTS_CAL: Cal = { name: loc("Clients", "Clients"), color: "var(--chart-2)", acc: MS }

interface Spec {
  cal: Cal
  title: L<string>
  day: number
  start: number
  end: number
  min?: number
  endMin?: number
  allDay?: boolean
  location?: L<string>
  enabled?: boolean
}

const SPECS: Spec[] = [
  {
    cal: STUDIO,
    title: loc("Tournage Reel — Maison Verde", "Reel shoot — Maison Verde"),
    day: -1,
    start: 12,
    end: 14,
    location: loc("Restaurant Maison Verde", "Maison Verde restaurant"),
  },
  { cal: PERSO, title: loc("Cours de yoga", "Yoga class"), day: 0, start: 6, end: 6, endMin: 45 },
  {
    cal: STUDIO,
    title: loc("Appel découverte — prospect", "Discovery call — prospect"),
    day: 0,
    start: 9,
    end: 9,
    endMin: 30,
  },
  {
    cal: CLIENTS_CAL,
    title: loc("Déjeuner Léa — Atelier Nove", "Lunch with Léa — Atelier Nove"),
    day: 0,
    start: 11,
    end: 12,
    location: loc("Le Récamier", "Le Récamier"),
  },
  {
    cal: STUDIO,
    title: loc("Shooting produit — Brûlerie", "Product shoot — Brûlerie"),
    day: 0,
    start: 14,
    end: 15,
    location: loc("Brûlerie Lacaze", "Brûlerie Lacaze"),
  },
  {
    cal: FERIES,
    title: loc("Fête locale", "Local holiday"),
    day: 1,
    start: 0,
    end: 23,
    allDay: true,
    enabled: false,
  },
  {
    cal: CLIENTS_CAL,
    title: loc("Brief contenu — Studio Rise", "Content brief — Studio Rise"),
    day: 1,
    start: 13,
    end: 14,
  },
  {
    cal: STUDIO,
    title: loc("Atelier photo mensuel", "Monthly photo workshop"),
    day: 2,
    start: 16,
    end: 17,
    endMin: 30,
  },
  {
    cal: CLIENTS_CAL,
    title: loc("Point mensuel — Maison Verde", "Monthly check-in — Maison Verde"),
    day: 3,
    start: 9,
    end: 9,
    endMin: 45,
  },
  {
    cal: STUDIO,
    title: loc("Standup hebdo", "Weekly standup"),
    day: 4,
    start: 6,
    end: 6,
    endMin: 30,
  },
  { cal: PERSO, title: loc("Déjeuner famille", "Family lunch"), day: 5, start: 11, end: 12 },
  {
    cal: STUDIO,
    title: loc("Salon du café", "Coffee trade show"),
    day: 6,
    start: 0,
    end: 23,
    allDay: true,
  },
  { cal: STUDIO, title: loc("Formation Meta Ads", "Meta Ads training"), day: 7, start: 8, end: 10 },
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
