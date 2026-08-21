import "server-only"

import { type BrevoTemplate, sendTransactional } from "@/lib/brevo/transactional"
import { siteOrigin } from "@/lib/site-url"
import { createAdminClient } from "@/lib/supabase/admin"

// Émission des notifications destinées à l'AGENCE (audience 'owner') sur
// activité du portail client : remarque, approbation, demande de modifications.
//
// Pourquoi service_role et pas une policy INSERT ?
// `notifications` n'a AUCUNE policy INSERT pour authenticated, et c'est
// délibéré (motif B2, migration 013 §15) : une policy ouverte laisserait forger
// un destinataire. Le chemin sanctionné est donc le serveur de confiance.
// CONTRAT D'APPEL : l'appelant DOIT avoir revalidé l'appartenance au tenant via
// le client RLS de l'utilisateur AVANT d'appeler ce module (cf. contentContext
// dans lib/actions/collaboration.ts) — org_id/client_id arrivent ici déjà
// prouvés, jamais depuis une entrée utilisateur.

/**
 * Origine absolue du site, pour les liens des emails.
 * Réexportée depuis lib/site-url pour ne pas casser les appelants existants :
 * `NEXT_PUBLIC_SITE_URL` était inlinée au build par Next, donc gelée dans l'image
 * (souvent sur `http://localhost:3000`).
 */
export { siteOrigin }

export interface OrgNotification {
  orgId: string
  clientId: string
  type: string
  title: string
  body: string
  /**
   * Lien in-app — sert AUSSI de clé de dédoublonnage : tant qu'une notification
   * du même type sur la même cible n'est pas lue, on n'en empile pas d'autre.
   */
  href: string
  template: BrevoTemplate
  /** Paramètres du template Brevo. `url` (absolue) est ajoutée ici. */
  params: Record<string, unknown>
  tags: string[]
}

/**
 * Notifie tous les membres de l'org : ligne in-app + email Brevo best-effort.
 *
 * Ne lève jamais — une notification qui échoue ne doit pas faire échouer le
 * retour client qui l'a déclenchée (le commentaire, lui, est déjà persisté).
 */
export async function notifyOrgMembers(input: OrgNotification): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: members } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("org_id", input.orgId)
    const memberIds = (members ?? []).map((m) => m.user_id)
    if (memberIds.length === 0) return

    // Anti-empilement : 5 repères posés d'affilée ne font ni 5 lignes dans la
    // cloche ni 5 emails. Dès que l'agence a lu, la suivante repart.
    const { data: pending } = await admin
      .from("notifications")
      .select("recipient_user_id")
      .eq("org_id", input.orgId)
      .eq("type", input.type)
      .eq("href", input.href)
      .is("read_at", null)
    const alreadyPending = new Set((pending ?? []).map((row) => row.recipient_user_id))

    const targets = memberIds.filter((id) => !alreadyPending.has(id))
    if (targets.length === 0) return

    // `channels` décrit ce qui part VRAIMENT : sans Brevo configuré (Tier D),
    // afficher un badge « Email » dans la cloche serait un mensonge d'UI.
    const emailEnabled = Boolean(process.env.BREVO_API_KEY)
    const channels = emailEnabled ? ["in_app", "email"] : ["in_app"]

    const { error } = await admin.from("notifications").insert(
      targets.map((userId) => ({
        org_id: input.orgId,
        client_id: input.clientId,
        recipient_user_id: userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channels,
        audience: "owner",
        href: input.href,
      }))
    )
    // Insert raté → on n'envoie pas l'email : pas d'email sans trace in-app.
    if (error) return

    if (emailEnabled) await sendEmails(targets, input)
  } catch {
    // best-effort de bout en bout (cf. docstring)
  }
}

/** Email transactionnel — inerte tant que Brevo n'est pas configuré (Tier D). */
async function sendEmails(targets: string[], input: OrgNotification): Promise<void> {
  const admin = createAdminClient()
  const { data: profiles } = await admin.from("profiles").select("email").in("id", targets)
  const emails = (profiles ?? [])
    .map((p) => p.email)
    .filter((email): email is string => Boolean(email))
  if (emails.length === 0) return

  try {
    await sendTransactional({
      template: input.template,
      to: emails,
      params: { ...input.params, url: `${await siteOrigin()}${input.href}` },
      tags: input.tags,
    })
  } catch {
    // Sans BREVO_API_KEY / template configuré : la notification in-app suffit.
  }
}
