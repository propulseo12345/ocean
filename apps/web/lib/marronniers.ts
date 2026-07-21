import { nowIso } from "@/lib/clock"
import { loc } from "@/lib/i18n"

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
  { date: "2026-01-01", label: loc("Jour de l'an", "New Year's Day"), kind: "ferie" },
  {
    date: "2026-01-06",
    label: loc("Épiphanie — galette des rois", "Epiphany — king cake"),
    kind: "fete",
  },
  {
    date: "2026-01-07",
    label: loc("Début des soldes d'hiver", "Winter sales begin"),
    kind: "soldes",
  },
  { date: "2026-02-02", label: loc("Chandeleur", "Candlemas (crêpe day)"), kind: "fete" },
  { date: "2026-02-14", label: loc("Saint-Valentin", "Valentine's Day"), kind: "marketing" },
  { date: "2026-02-17", label: loc("Mardi gras", "Mardi Gras"), kind: "fete" },
  { date: "2026-03-01", label: loc("Fête des grands-mères", "Grandmothers' Day"), kind: "fete" },
  {
    date: "2026-03-08",
    label: loc("Journée internationale des droits des femmes", "International Women's Rights Day"),
    kind: "marketing",
  },
  {
    date: "2026-03-20",
    label: loc("Arrivée du printemps", "First day of spring"),
    kind: "marketing",
  },
  { date: "2026-04-01", label: loc("Poisson d'avril", "April Fools' Day"), kind: "fete" },
  { date: "2026-04-05", label: loc("Pâques", "Easter"), kind: "fete" },
  { date: "2026-04-06", label: loc("Lundi de Pâques", "Easter Monday"), kind: "ferie" },
  { date: "2026-05-01", label: loc("Fête du Travail", "Labour Day"), kind: "ferie" },
  { date: "2026-05-08", label: loc("Victoire 1945", "VE Day 1945"), kind: "ferie" },
  { date: "2026-05-14", label: loc("Ascension", "Ascension Day"), kind: "ferie" },
  { date: "2026-05-25", label: loc("Lundi de Pentecôte", "Whit Monday"), kind: "ferie" },
  { date: "2026-05-31", label: loc("Fête des mères", "Mother's Day"), kind: "fete" },
  {
    date: "2026-06-05",
    label: loc("Journée mondiale de l'environnement", "World Environment Day"),
    kind: "marketing",
  },
  {
    date: "2026-06-08",
    label: loc("Journée mondiale de l'océan", "World Oceans Day"),
    kind: "marketing",
  },
  {
    date: "2026-06-13",
    label: loc("Journée mondiale du bien-être", "Global Wellness Day"),
    kind: "marketing",
  },
  { date: "2026-06-21", label: loc("Fête de la musique", "Make Music Day"), kind: "fete" },
  { date: "2026-06-21", label: loc("Fête des pères", "Father's Day"), kind: "fete" },
  {
    date: "2026-06-21",
    label: loc("Journée internationale du yoga", "International Yoga Day"),
    kind: "marketing",
  },
  {
    date: "2026-06-24",
    label: loc("Début des soldes d'été", "Summer sales begin"),
    kind: "soldes",
  },
  { date: "2026-07-14", label: loc("Fête nationale", "Bastille Day"), kind: "ferie" },
  { date: "2026-08-15", label: loc("Assomption", "Assumption Day"), kind: "ferie" },
  { date: "2026-09-01", label: loc("Rentrée scolaire", "Back to school"), kind: "marketing" },
  {
    date: "2026-10-01",
    label: loc("Journée internationale du café", "International Coffee Day"),
    kind: "marketing",
  },
  {
    date: "2026-10-12",
    label: loc("Semaine du goût (début)", "Taste Week (start)"),
    kind: "marketing",
  },
  { date: "2026-10-31", label: loc("Halloween", "Halloween"), kind: "fete" },
  { date: "2026-11-01", label: loc("Toussaint", "All Saints' Day"), kind: "ferie" },
  { date: "2026-11-11", label: loc("Armistice 1918", "Armistice Day 1918"), kind: "ferie" },
  { date: "2026-11-27", label: loc("Black Friday", "Black Friday"), kind: "soldes" },
  { date: "2026-11-30", label: loc("Cyber Monday", "Cyber Monday"), kind: "soldes" },
  { date: "2026-12-06", label: loc("Saint-Nicolas", "Saint Nicholas Day"), kind: "fete" },
  { date: "2026-12-25", label: loc("Noël", "Christmas"), kind: "ferie" },
  { date: "2026-12-31", label: loc("Saint-Sylvestre", "New Year's Eve"), kind: "fete" },
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
