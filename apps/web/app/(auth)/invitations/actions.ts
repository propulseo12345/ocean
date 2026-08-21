"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { verifierOrigine } from "@/lib/auth/same-origin"
import { acceptInvitation } from "@/lib/invitations/accept"
import { construireDeps } from "@/lib/invitations/deps"
import { siteOrigin } from "@/lib/site-url"

// Acceptation d'une invitation — le seul chemin qui ÉCRIT (ticket V-3).
//
// CE QUI A CHANGÉ ET POURQUOI
// ---------------------------
// L'acceptation était un GET à effet de bord (`/api/invitations/accept`), sans
// contrôle d'origine, sans jeton anti-CSRF, sur des cookies `SameSite=Lax`. Une
// navigation top-level depuis un site tiers suffisait donc à créer une adhésion
// dans le client de l'ATTAQUANT avec la session légitime de la VICTIME.
//
// Le correctif P7-1 ne pouvait pas voir ce chemin : son invariant — « une
// adhésion n'est créée QUE si la requête porte déjà une session dont l'email est
// EXACTEMENT celui de l'invitation » — est littéralement satisfait par la
// session de la victime. Il prouve la POSSESSION de l'adresse ; il ne prouve
// jamais l'INTENTION de rejoindre.
//
// L'intention est désormais établie par trois choses, dans cet ordre :
//   1. l'écriture ne part que d'un POST (une Server Action), jamais d'un GET ;
//   2. ce POST n'est émis que par un bouton d'une page de confirmation qui
//      nomme explicitement le client à rejoindre ;
//   3. l'origine de la requête est vérifiée, fail-closed.
//
// Le point 3 est explicite et testé plutôt que délégué à la protection intégrée
// des Server Actions de Next : une propriété de sécurité qui n'est écrite nulle
// part est une propriété qu'on « simplifie » sans le savoir — c'est exactement
// ce qui est arrivé à la concaténation d'origine de `/auth/callback`.

export type ReponseInvitation =
  /** Aucune session : le secret est parti vers la boîte de l'invité. */
  | { etat: "preuve_envoyee" }
  /** Session ouverte sur une AUTRE adresse. Surtout pas de bascule automatique. */
  | { etat: "mauvais_compte" }
  /** Jeton absent, inconnu, révoqué, expiré ou déjà consommé — refus indistinct. */
  | { etat: "invalide" }
  /** La requête ne vient pas de nos pages. */
  | { etat: "refus_cross_site" }
  /** Dépendance indisponible (service role absent, écriture refusée). */
  | { etat: "indisponible" }
  | undefined

export async function repondreInvitation(
  _prev: ReponseInvitation,
  formData: FormData
): Promise<ReponseInvitation> {
  const token = formData.get("token")
  if (typeof token !== "string" || token.length === 0) return { etat: "invalide" }

  // AVANT toute écriture, et avant même de toucher la base : d'où vient cette
  // requête ? `construireDeps` écrit en service_role, donc hors RLS.
  const h = await headers()
  const verdict = verifierOrigine(
    { origin: h.get("origin"), secFetchSite: h.get("sec-fetch-site") },
    await siteOrigin()
  )
  if (!verdict.ok) return { etat: "refus_cross_site" }

  const outcome = await acceptInvitation(token, await construireDeps(token))

  switch (outcome.kind) {
    case "accepted":
      break
    case "proof_required":
      return { etat: "preuve_envoyee" }
    case "wrong_account":
      return { etat: "mauvais_compte" }
    case "unavailable":
      return { etat: "indisponible" }
    default:
      return { etat: "invalide" }
  }

  // Hors du `switch` : `redirect` lève NEXT_REDIRECT, il ne doit jamais se
  // trouver sous un `try` ni voir son exception avalée.
  revalidatePath("/", "layout")
  redirect("/auth/landing")
}
