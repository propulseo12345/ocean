import { loc } from "@/lib/i18n"
import { dayAt } from "./time"
import type { CalendarAccount, Client, Organization, Reviewer, SocialAccount, User } from "./types"

export const ORG: Organization = { id: "org_marea", name: "Studio Marea" }

export const CURRENT_USER: User = {
  id: "usr_etienne",
  name: "Étienne Mercier",
  email: "etienne@studiomarea.fr",
  initials: "ÉM",
  timezone: "Europe/Paris",
}

export const CLIENTS: Client[] = [
  {
    id: "cl_brulerie",
    name: "Brûlerie Lacaze",
    handle: "brulerielacaze",
    brandColor: "oklch(0.46 0.09 62)",
    timezone: "Europe/Paris",
    archivedAt: null,
    theme: "coffee",
    category: loc("Café · Torréfaction artisanale", "Coffee · Artisan roastery"),
    bio: loc(
      "Torréfacteur de spécialité à Lille ☕️\nSingle origin & mélanges maison\nClick & collect — du mardi au samedi",
      "Specialty coffee roaster in Lille ☕️\nSingle origin & house blends\nClick & collect — Tuesday to Saturday"
    ),
    following: 312,
    approvalMode: "required",
    notes: loc(
      "Forfait 12 posts/mois. Camille valide tout — prévoir 48 h de délai avant chaque publication.",
      "12 posts/month plan. Camille approves everything — allow 48 h lead time before each publish."
    ),
  },
  {
    id: "cl_verde",
    name: "Maison Verde",
    handle: "maison.verde",
    brandColor: "oklch(0.53 0.12 150)",
    timezone: "Europe/Paris",
    archivedAt: null,
    theme: "food",
    category: loc("Restaurant", "Restaurant"),
    bio: loc(
      "Cuisine de saison & produits du marché 🌿\nDéjeuner du mardi au samedi\nRéservations en ligne 👇",
      "Seasonal cooking & market-fresh produce 🌿\nLunch from Tuesday to Saturday\nBook online 👇"
    ),
    following: 540,
    approvalMode: "optional",
    notes: loc(
      "Sofia est réactive. Priorité au brunch du dimanche et au menu du marché — vouvoiement exigé.",
      "Sofia is responsive. Prioritize Sunday brunch and the market menu — keep a formal tone."
    ),
  },
  {
    id: "cl_nove",
    name: "Atelier Nove",
    handle: "atelier.nove",
    brandColor: "oklch(0.58 0.16 352)",
    timezone: "Europe/Paris",
    archivedAt: null,
    theme: "fashion",
    category: loc("Boutique de mode", "Fashion boutique"),
    bio: loc(
      "Mode responsable, fabriquée en France 🇫🇷\nNouvelle collection printemps en ligne\nLivraison offerte dès 80 €",
      "Sustainable fashion, made in France 🇫🇷\nNew spring collection online\nFree shipping from €80"
    ),
    following: 421,
    approvalMode: "auto",
    notes: loc(
      "Léa laisse carte blanche (publication directe). Les drops sortent toujours le vendredi à midi.",
      "Léa gives full freedom (direct publishing). Drops always go live Friday at noon."
    ),
  },
  {
    id: "cl_rise",
    name: "Studio Rise",
    handle: "studiorise.yoga",
    brandColor: "oklch(0.56 0.13 292)",
    timezone: "America/Montreal",
    archivedAt: null,
    theme: "yoga",
    category: loc("Studio de yoga & bien-être", "Yoga & wellness studio"),
    bio: loc(
      "Yoga, respiration & méditation 🧘\nCours en studio et en ligne\nRetraites et ateliers tout l'année",
      "Yoga, breathwork & meditation 🧘\nIn-studio and online classes\nRetreats and workshops all year round"
    ),
    following: 287,
    approvalMode: "required",
    notes: loc(
      "Marc n'a jamais ouvert le portail — relancer par email avant chaque échéance. Jamais de promesse santé.",
      "Marc has never opened the portal — follow up by email before each deadline. Never make health claims."
    ),
  },
  {
    id: "cl_lompret",
    name: "Café Lompret",
    handle: "cafelompret",
    brandColor: "oklch(0.5 0.07 48)",
    timezone: "Europe/Paris",
    archivedAt: dayAt(-48, 9),
    theme: "coffee",
    category: loc("Café de quartier", "Neighborhood café"),
    bio: loc("Petit café de quartier à Lompret ☕️", "Cozy neighborhood café in Lompret ☕️"),
    following: 198,
    approvalMode: "optional",
  },
]

export const REVIEWERS: Reviewer[] = [
  {
    id: "rv_camille",
    clientId: "cl_brulerie",
    name: "Camille Lacaze",
    email: "camille@brulerielacaze.fr",
    initials: "CL",
    lastActiveAt: dayAt(-1, 16),
  },
  {
    id: "rv_sofia",
    clientId: "cl_verde",
    name: "Sofia René",
    email: "sofia@maisonverde.fr",
    initials: "SR",
    lastActiveAt: dayAt(0, 7),
  },
  {
    id: "rv_lea",
    clientId: "cl_nove",
    name: "Léa Nove",
    email: "lea@ateliernove.com",
    initials: "LN",
    lastActiveAt: dayAt(-3, 11),
  },
  {
    id: "rv_marc",
    clientId: "cl_rise",
    name: "Marc Aubin",
    email: "marc@studiorise.ca",
    initials: "MA",
    lastActiveAt: null,
  },
]

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  // Brûlerie Lacaze
  {
    id: "sa_bru_ig",
    clientId: "cl_brulerie",
    platform: "instagram",
    username: "brulerielacaze",
    displayName: "Brûlerie Lacaze",
    status: "needs_reauth",
    followers: 8420,
  },
  {
    id: "sa_bru_fb",
    clientId: "cl_brulerie",
    platform: "facebook",
    username: "BrulerieLacaze",
    displayName: "Brûlerie Lacaze",
    status: "connected",
    followers: 3110,
  },
  // Maison Verde
  {
    id: "sa_ver_ig",
    clientId: "cl_verde",
    platform: "instagram",
    username: "maison.verde",
    displayName: "Maison Verde",
    status: "connected",
    followers: 15240,
  },
  {
    id: "sa_ver_fb",
    clientId: "cl_verde",
    platform: "facebook",
    username: "MaisonVerde",
    displayName: "Maison Verde",
    status: "connected",
    followers: 6890,
  },
  {
    id: "sa_ver_tt",
    clientId: "cl_verde",
    platform: "tiktok",
    username: "maison.verde",
    displayName: "Maison Verde",
    status: "connected",
    followers: 22100,
  },
  // Atelier Nove
  {
    id: "sa_nov_ig",
    clientId: "cl_nove",
    platform: "instagram",
    username: "atelier.nove",
    displayName: "Atelier Nove",
    status: "connected",
    followers: 11870,
  },
  {
    id: "sa_nov_tt",
    clientId: "cl_nove",
    platform: "tiktok",
    username: "atelier.nove",
    displayName: "Atelier Nove",
    status: "connected",
    followers: 9430,
  },
  // Studio Rise
  {
    id: "sa_ris_ig",
    clientId: "cl_rise",
    platform: "instagram",
    username: "studiorise.yoga",
    displayName: "Studio Rise",
    status: "connected",
    followers: 5260,
  },
  {
    id: "sa_ris_fb",
    clientId: "cl_rise",
    platform: "facebook",
    username: "StudioRise",
    displayName: "Studio Rise",
    status: "connected",
    followers: 2040,
  },
]

export const CALENDAR_ACCOUNTS: CalendarAccount[] = [
  {
    id: "ca_google",
    provider: "google",
    label: loc("Google — perso", "Google — personal"),
    email: "etienne@studiomarea.fr",
    status: "connected",
  },
  {
    id: "ca_ms",
    provider: "microsoft",
    label: loc("Outlook — clients", "Outlook — clients"),
    email: "etienne@outlook.com",
    status: "needs_reauth",
  },
]
