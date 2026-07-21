import { nowIso } from "@/lib/clock"

// Marronniers FR 2026 : jours fériés, fêtes, soldes et temps forts marketing.
// Overlay du calendrier éditorial + suggestions d'idées de contenu.
// Les labels sont du contenu démo bilingue (résolu via pick()) ; la clé `kind`
// est traduite via le dictionnaire (marronnier.kind.*).

export type MarronnierKind = "ferie" | "fete" | "soldes" | "marketing"

export interface Marronnier {
  /** Date au format "AAAA-MM-JJ" (jour entier, fuseau FR implicite). */
  date: string
  label: string
  kind: MarronnierKind
}

export const MARRONNIERS: Marronnier[] = [
  { date: "2026-01-01", label: "Jour de l'an", kind: "ferie" },
  {
    date: "2026-01-06",
    label: "Épiphanie — galette des rois",
    kind: "fete",
  },
  {
    date: "2026-01-07",
    label: "Début des soldes d'hiver",
    kind: "soldes",
  },
  { date: "2026-02-02", label: "Chandeleur", kind: "fete" },
  { date: "2026-02-14", label: "Saint-Valentin", kind: "marketing" },
  { date: "2026-02-17", label: "Mardi gras", kind: "fete" },
  { date: "2026-03-01", label: "Fête des grands-mères", kind: "fete" },
  {
    date: "2026-03-08",
    label: "Journée internationale des droits des femmes",
    kind: "marketing",
  },
  {
    date: "2026-03-20",
    label: "Arrivée du printemps",
    kind: "marketing",
  },
  { date: "2026-04-01", label: "Poisson d'avril", kind: "fete" },
  { date: "2026-04-05", label: "Pâques", kind: "fete" },
  { date: "2026-04-06", label: "Lundi de Pâques", kind: "ferie" },
  { date: "2026-05-01", label: "Fête du Travail", kind: "ferie" },
  { date: "2026-05-08", label: "Victoire 1945", kind: "ferie" },
  { date: "2026-05-14", label: "Ascension", kind: "ferie" },
  { date: "2026-05-25", label: "Lundi de Pentecôte", kind: "ferie" },
  { date: "2026-05-31", label: "Fête des mères", kind: "fete" },
  {
    date: "2026-06-05",
    label: "Journée mondiale de l'environnement",
    kind: "marketing",
  },
  {
    date: "2026-06-08",
    label: "Journée mondiale de l'océan",
    kind: "marketing",
  },
  {
    date: "2026-06-13",
    label: "Journée mondiale du bien-être",
    kind: "marketing",
  },
  { date: "2026-06-21", label: "Fête de la musique", kind: "fete" },
  { date: "2026-06-21", label: "Fête des pères", kind: "fete" },
  {
    date: "2026-06-21",
    label: "Journée internationale du yoga",
    kind: "marketing",
  },
  {
    date: "2026-06-24",
    label: "Début des soldes d'été",
    kind: "soldes",
  },
  { date: "2026-07-14", label: "Fête nationale", kind: "ferie" },
  { date: "2026-08-15", label: "Assomption", kind: "ferie" },
  { date: "2026-09-01", label: "Rentrée scolaire", kind: "marketing" },
  {
    date: "2026-10-01",
    label: "Journée internationale du café",
    kind: "marketing",
  },
  {
    date: "2026-10-12",
    label: "Semaine du goût (début)",
    kind: "marketing",
  },
  { date: "2026-10-31", label: "Halloween", kind: "fete" },
  { date: "2026-11-01", label: "Toussaint", kind: "ferie" },
  { date: "2026-11-11", label: "Armistice 1918", kind: "ferie" },
  { date: "2026-11-27", label: "Black Friday", kind: "soldes" },
  { date: "2026-11-30", label: "Cyber Monday", kind: "soldes" },
  { date: "2026-12-06", label: "Saint-Nicolas", kind: "fete" },
  { date: "2026-12-25", label: "Noël", kind: "ferie" },
  { date: "2026-12-31", label: "Saint-Sylvestre", kind: "fete" },
]

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Marronniers entre deux dates incluses (ISO complet ou "AAAA-MM-JJ"). */
export function getMarronniersBetween(fromIso: string, toIso: string): Marronnier[] {
  const from = dateKey(fromIso)
  const to = dateKey(toIso)
  return MARRONNIERS.filter((m) => m.date >= from && m.date <= to)
}

/** Marronniers d'un jour donné (overlay des cases du calendrier). */
export function getMarronniersOn(dayIso: string): Marronnier[] {
  const key = dateKey(dayIso)
  return MARRONNIERS.filter((m) => m.date === key)
}

/** Prochains marronniers à partir d'« aujourd'hui » mocké (11/06/2026). */
export function getUpcomingMarronniers(limit = 6): Marronnier[] {
  const today = dateKey(nowIso())
  return MARRONNIERS.filter((m) => m.date >= today).slice(0, limit)
}
