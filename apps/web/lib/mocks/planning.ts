import { dayAt } from "./time"
import type { ClientEvent, RecurringSlot } from "./types"

// Événements et notes client (calendrier éditorial) — jours relatifs au
// 11/06/2026 (MOCK_NOW), affichés dans le fuseau du client.
type EventSpec = [
  short: string,
  clientId: string,
  day: number,
  kind: ClientEvent["kind"],
  title: string,
]

const EVENT_SPECS: EventSpec[] = [
  ["bru", "cl_brulerie", 4, "note", "Réassort Éthiopie Yirgacheffe attendu"],
  ["bru", "cl_brulerie", 9, "event", "Atelier dégustation — 6 places"],
  ["bru", "cl_brulerie", 15, "event", "Lancement cold brew en bouteille"],
  ["bru", "cl_brulerie", 32, "note", "Fermeture estivale du 13 au 20 juillet"],
  ["ver", "cl_verde", 7, "event", "Soirée accords mets & vins nature"],
  ["ver", "cl_verde", 12, "event", "Nouveau menu d'été en salle"],
  ["ver", "cl_verde", 18, "note", "Chef absent du 29 juin au 3 juillet"],
  ["nov", "cl_nove", 8, "event", "Drop capsule lin — mise en ligne 12 h"],
  ["nov", "cl_nove", 13, "event", "Début des soldes d'été en boutique"],
  ["nov", "cl_nove", 19, "note", "Shooting lookbook automne à l'atelier"],
  ["ris", "cl_rise", 5, "note", "Inès reprend les cours du soir"],
  ["ris", "cl_rise", 10, "event", "Journée internationale du yoga — cours gratuit"],
  ["ris", "cl_rise", 16, "event", "Départ retraite de printemps (2 jours)"],
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
