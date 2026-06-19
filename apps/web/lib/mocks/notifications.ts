import { loc } from "@/lib/i18n"
import { dayAt } from "./time"
import type { AppNotification } from "./types"

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "nt_1",
    type: "publish_failed",
    title: loc("Échec de publication", "Publishing failed"),
    body: loc(
      "Brûlerie Lacaze — le Reel n'a pas pu être publié sur Instagram (token expiré).",
      "Brûlerie Lacaze — the Reel couldn't be published to Instagram (token expired)."
    ),
    channels: ["in_app", "push", "email"],
    audience: "owner",
    read: false,
    createdAt: dayAt(-1, 19),
    href: "/clients/cl_brulerie/content/ct_cl_brulerie_5",
  },
  {
    id: "nt_2",
    type: "token_reauth_needed",
    title: loc("Compte à reconnecter", "Account needs reconnecting"),
    body: loc(
      "Le compte Instagram de Brûlerie Lacaze doit être reconnecté.",
      "Brûlerie Lacaze's Instagram account needs to be reconnected."
    ),
    channels: ["in_app", "email"],
    audience: "owner",
    read: false,
    createdAt: dayAt(-1, 8),
    href: "/settings/accounts",
  },
  {
    id: "nt_3",
    type: "tiktok_draft_pushed",
    title: loc("Brouillon TikTok prêt", "TikTok draft ready"),
    body: loc(
      "Maison Verde — ton brouillon est dans l'inbox TikTok, ouvre l'app pour finaliser.",
      "Maison Verde — your draft is in the TikTok inbox, open the app to finish it."
    ),
    channels: ["in_app", "push"],
    audience: "owner",
    read: false,
    createdAt: dayAt(0, 6),
    href: "/clients/cl_verde/content/ct_cl_verde_6",
  },
  {
    id: "nt_4",
    type: "changes_requested",
    title: loc("Modifications demandées", "Changes requested"),
    body: loc(
      "Camille (Brûlerie Lacaze) a demandé des modifications sur un contenu.",
      "Camille (Brûlerie Lacaze) requested changes on a piece of content."
    ),
    channels: ["in_app", "push"],
    audience: "owner",
    read: false,
    createdAt: dayAt(-1, 14),
    href: "/clients/cl_brulerie/content/ct_cl_brulerie_13",
  },
  {
    id: "nt_5",
    type: "content_approved",
    title: loc("Contenu approuvé", "Content approved"),
    body: loc(
      "Sofia (Maison Verde) a approuvé une publication.",
      "Sofia (Maison Verde) approved a post."
    ),
    channels: ["in_app", "push"],
    audience: "owner",
    read: true,
    createdAt: dayAt(-2, 10),
    href: "/clients/cl_verde/content/ct_cl_verde_10",
  },
  {
    id: "nt_6",
    type: "publish_succeeded",
    title: loc("Publication réussie", "Published successfully"),
    body: loc(
      "Atelier Nove — post publié sur Instagram et Facebook.",
      "Atelier Nove — post published to Instagram and Facebook."
    ),
    channels: ["in_app"],
    audience: "owner",
    read: true,
    createdAt: dayAt(-4, 10),
    href: "/clients/cl_nove/grid",
  },
  {
    id: "nt_7",
    type: "publish_delayed",
    title: loc("Publication reportée (quota)", "Post rescheduled (quota)"),
    body: loc(
      "Maison Verde — quota Instagram atteint, publication reportée à 14:00.",
      "Maison Verde — Instagram quota reached, post pushed back to 2:00 PM."
    ),
    channels: ["in_app", "push", "email"],
    audience: "owner",
    read: true,
    createdAt: dayAt(0, 7),
    href: "/clients/cl_verde/calendar",
  },
  {
    id: "nt_8",
    type: "review_comment",
    title: loc("Nouveau commentaire", "New comment"),
    body: loc(
      "Léa (Atelier Nove) a laissé un commentaire sur un contenu en revue.",
      "Léa (Atelier Nove) left a comment on a piece of content under review."
    ),
    channels: ["in_app", "push"],
    audience: "owner",
    read: true,
    createdAt: dayAt(-1, 16),
    href: "/clients/cl_nove/content/ct_cl_nove_12",
  },
  {
    id: "nt_9",
    type: "manual_due",
    title: loc("Newsletter à envoyer", "Newsletter to send"),
    body: loc(
      "Brûlerie Lacaze — la newsletter est prête à être envoyée manuellement.",
      "Brûlerie Lacaze — the newsletter is ready to be sent manually."
    ),
    channels: ["in_app", "push"],
    audience: "owner",
    read: true,
    createdAt: dayAt(-1, 9),
    href: "/clients/cl_brulerie/content/ct_cl_brulerie_14",
  },
  {
    id: "nt_10",
    type: "watchdog",
    title: loc("Worker — alerte technique", "Worker — technical alert"),
    body: loc(
      "1 job en retard détecté par le watchdog indépendant.",
      "1 overdue job detected by the independent watchdog."
    ),
    channels: ["email"],
    audience: "ops",
    read: true,
    createdAt: dayAt(-3, 3),
    href: "/settings/accounts",
  },
]
