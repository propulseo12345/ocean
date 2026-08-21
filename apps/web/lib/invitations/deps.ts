import "server-only"

import { routes } from "@/lib/routes"
import { siteOrigin } from "@/lib/site-url"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

import { type AcceptDeps, hashInvitationToken, type InvitationRecord } from "./accept"

// Câblage des dépendances d'`acceptInvitation`, partagé par la page de
// confirmation et la Server Action qui la valide (ticket V-3).
//
// Ce module ne DÉCIDE rien : toute la logique de sécurité vit dans `accept.ts`,
// qui est testée et validée par mutation (P7-1 — prise de contrôle de compte).
// En particulier, et c'est le correctif d'origine : aucun appel à
// `admin.auth.admin.generateLink`, aucune redirection vers un lien d'action
// Supabase. C'était la primitive de la faille.

/** Ce que la page de confirmation a le droit de montrer avant toute écriture. */
export type InvitationApercu =
  | { etat: "invalide" }
  | { etat: "utilisable"; clientId: string; clientNom: string; email: string }

/**
 * Décrit une invitation SANS aucun effet de bord — la page qui l'affiche est un
 * GET, et un GET ne doit rien écrire ni rien envoyer. C'est la moitié du
 * correctif V-3 : l'ancienne route envoyait un e-mail et créait une adhésion
 * depuis un GET, donc depuis une simple navigation top-level.
 */
export async function decrireInvitation(token: string | null): Promise<InvitationApercu> {
  if (!token) return { etat: "invalide" }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { etat: "invalide" }
  }

  const { data } = await admin
    .from("client_invitations")
    .select("id, org_id, client_id, email, role, accepted_at, revoked_at, expires_at")
    .eq("token_hash", hashInvitationToken(token))
    .maybeSingle()

  const invitation = data as InvitationRecord | null
  if (!invitation) return { etat: "invalide" }

  // Mêmes critères qu'`accept.ts`, et refus tout aussi indistinct : ne jamais
  // dire à l'appelant CE QUI a échoué (révoquée ? expirée ? déjà consommée ?).
  if (invitation.accepted_at || invitation.revoked_at) return { etat: "invalide" }
  const peremption = new Date(invitation.expires_at).getTime()
  if (!Number.isFinite(peremption) || peremption < Date.now()) return { etat: "invalide" }

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", invitation.client_id)
    .maybeSingle()

  return {
    etat: "utilisable",
    clientId: invitation.client_id,
    clientNom: (client as { name: string } | null)?.name ?? "",
    email: invitation.email,
  }
}

/** Identité prouvée par la session courante, ou `null`. */
export async function identiteCourante(): Promise<{ userId: string; email: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  return { userId: user.id, email: user.email }
}

/**
 * Construit les dépendances d'`acceptInvitation` pour un jeton donné.
 *
 * ⚠️ L'appelant DOIT avoir vérifié l'origine de la requête avant d'appeler
 * `acceptInvitation` avec ces dépendances : elles écrivent en service_role,
 * donc hors RLS.
 */
export async function construireDeps(token: string | null): Promise<AcceptDeps> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const origin = await siteOrigin()

  return {
    async findInvitation(tokenHash) {
      const { data } = await admin
        .from("client_invitations")
        .select("id, org_id, client_id, email, role, accepted_at, revoked_at, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle()
      return (data as InvitationRecord | null) ?? null
    },

    // L'identité vient de la SESSION de la requête, jamais de l'invitation.
    currentIdentity: identiteCourante,

    async bindMembership(invitation, userId) {
      const { error } = await admin.from("client_members").upsert(
        {
          org_id: invitation.org_id,
          client_id: invitation.client_id,
          user_id: userId,
          role: invitation.role as "reviewer" | "editor",
        },
        { onConflict: "client_id,user_id" }
      )
      if (error) return false

      // Le jeton n'est consommé qu'ICI : une fois l'adhésion réellement créée.
      // L'ancienne route le brûlait avant même qu'une session existe, rendant
      // l'invitation non rejouable pour son destinataire légitime (P7-2).
      //
      // `.is("revoked_at", null)` ferme la fenêtre TOCTOU entre la lecture de
      // l'invitation et sa consommation, et l'erreur n'est plus jetée : la route
      // annonçait « accepted » alors que le jeton pouvait rester vivant 14 jours.
      const { error: consommation } = await admin
        .from("client_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_user_id: userId,
        })
        .eq("id", invitation.id)
        .is("revoked_at", null)
        .is("accepted_at", null)
      if (consommation) return false

      return true
    },

    /**
     * Le secret part vers la BOÎTE AUX LETTRES de l'invité — jamais vers
     * l'appelant. C'est la preuve de possession de l'adresse, et c'est ce qui
     * remplace le `generateLink` renvoyé au navigateur.
     *
     * `redirectTo` est la destination FINALE, transmise au gabarit d'e-mail par
     * `{{ .RedirectTo }}` ; c'est le gabarit qui ouvre la session, via
     * `/auth/callback?token_hash=…`. Voir `deploy/GABARITS-EMAIL-supabase.md`.
     */
    async sendProofOfPossession(email) {
      const destination = `${origin}${routes.acceptInvite(token ?? "")}`

      const invited = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: destination,
      })
      if (!invited.error) return true

      // Compte déjà existant : Supabase refuse l'invitation. On envoie alors un
      // lien de définition de mot de passe — même canal, même preuve. `next` est
      // encodé UNE SEULE FOIS : le hop /auth/callback est porté par le gabarit.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password?next=${encodeURIComponent(
          routes.acceptInvite(token ?? "")
        )}`,
      })
      return !error
    },

    now: () => Date.now(),
  }
}
