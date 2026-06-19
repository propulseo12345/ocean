import { loc } from "@/lib/i18n"
import { dayAt } from "./time"
import type { ClientEvent, RecurringSlot } from "./types"

// Événements et notes client (calendrier éditorial) — jours relatifs au
// 11/06/2026 (MOCK_NOW), affichés dans le fuseau du client.
type EventSpec = [
  short: string,
  clientId: string,
  day: number,
  kind: ClientEvent["kind"],
  title: ClientEvent["title"],
]

const EVENT_SPECS: EventSpec[] = [
  ["bru", "cl_brulerie", 4, "note", loc("Réassort Éthiopie Yirgacheffe attendu", "Ethiopia Yirgacheffe restock expected")],
  ["bru", "cl_brulerie", 9, "event", loc("Atelier dégustation — 6 places", "Tasting workshop — 6 spots")],
  ["bru", "cl_brulerie", 15, "event", loc("Lancement cold brew en bouteille", "Bottled cold brew launch")],
  ["bru", "cl_brulerie", 32, "note", loc("Fermeture estivale du 13 au 20 juillet", "Summer closure from July 13 to 20")],
  ["ver", "cl_verde", 7, "event", loc("Soirée accords mets & vins nature", "Food & natural wine pairing evening")],
  ["ver", "cl_verde", 12, "event", loc("Nouveau menu d'été en salle", "New summer menu now serving")],
  ["ver", "cl_verde", 18, "note", loc("Chef absent du 29 juin au 3 juillet", "Chef away from June 29 to July 3")],
  ["nov", "cl_nove", 8, "event", loc("Drop capsule lin — mise en ligne 12 h", "Linen capsule drop — live at 12pm")],
  ["nov", "cl_nove", 13, "event", loc("Début des soldes d'été en boutique", "Summer sale kicks off in store")],
  ["nov", "cl_nove", 19, "note", loc("Shooting lookbook automne à l'atelier", "Fall lookbook shoot at the studio")],
  ["ris", "cl_rise", 5, "note", loc("Inès reprend les cours du soir", "Inès resumes evening classes")],
  ["ris", "cl_rise", 10, "event", loc("Journée internationale du yoga — cours gratuit", "International Yoga Day — free class")],
  ["ris", "cl_rise", 16, "event", loc("Départ retraite de printemps (2 jours)", "Spring retreat departs (2 days)")],
]

export const CLIENT_EVENTS: ClientEvent[] = EVENT_SPECS.map(
  ([short, clientId, day, kind, title], i) => ({
    id: `cev_${short}_${i}`,
    clientId,
    date: dayAt(day, 9),
    title,
    kind,
  })
)

export function getClientEvents(clientId: string): ClientEvent[] {
  return CLIENT_EVENTS.filter((e) => e.clientId === clientId)
}

// Créneaux récurrents convenus avec chaque client (weekday ISO 1 = lundi).
type SlotSpec = [
  short: string,
  clientId: string,
  weekday: number,
  time: string,
  platforms: RecurringSlot["platforms"],
  pillarId?: string,
]

const SLOT_SPECS: SlotSpec[] = [
  ["bru", "cl_brulerie", 2, "11:30", ["instagram", "facebook"], "pil_bru_produit"],
  ["bru", "cl_brulerie", 4, "17:00", ["instagram"], "pil_bru_coulisses"],
  ["bru", "cl_brulerie", 6, "09:00", ["instagram", "facebook"], "pil_bru_communaute"],
  ["ver", "cl_verde", 2, "11:30", ["instagram", "facebook", "tiktok"], "pil_ver_menu"],
  ["ver", "cl_verde", 5, "18:00", ["instagram"], "pil_ver_coulisses"],
  ["ver", "cl_verde", 7, "10:00", ["instagram"], "pil_ver_avis"],
  ["nov", "cl_nove", 1, "12:00", ["instagram"], "pil_nov_lookbook"],
  ["nov", "cl_nove", 3, "18:30", ["instagram", "tiktok"], "pil_nov_collection"],
  ["nov", "cl_nove", 5, "12:00", ["instagram"], "pil_nov_collection"],
  ["ris", "cl_rise", 1, "07:00", ["instagram", "facebook"], "pil_ris_cours"],
  ["ris", "cl_rise", 4, "18:00", ["instagram"], "pil_ris_pedagogie"],
]

export const RECURRING_SLOTS: RecurringSlot[] = SLOT_SPECS.map(
  ([short, clientId, weekday, time, platforms, pillarId], i) => ({
    id: `slot_${short}_${i}`,
    clientId,
    weekday,
    time,
    platforms,
    pillarId,
  })
)

export function getRecurringSlots(clientId: string): RecurringSlot[] {
  return RECURRING_SLOTS.filter((s) => s.clientId === clientId)
}
