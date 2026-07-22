import "server-only"

// Brevo — emails transactionnels (CLAUDE.md §10). SCAFFOLDING Tier D : le code
// est complet mais INERTE sans secrets. Il exige BREVO_API_KEY + les identifiants
// de template Brevo (BREVO_TEMPLATE_*). Sans BREVO_API_KEY, sendTransactional
// lève une erreur claire — les appelants (best-effort) l'attrapent sans casser le
// flux métier (une invitation créée reste valide même si l'email n'est pas parti).
//
// Décision actée : Brevo, jamais Resend. SMTP custom Supabase pointé sur Brevo
// pour les emails d'auth (magic link/OTP). Ici : API transactionnelle Brevo.

/** Templates V1 (CLAUDE.md §10). Le nom est stable ; l'ID vit en env. */
export type BrevoTemplate =
  | "reviewer-invitation"
  | "review-requested"
  | "changes-requested"
  | "content-approved"
  | "publish-failed"
  | "publish-delayed"
  | "needs-reauth"
  | "tiktok-draft-ready"
  | "watchdog-alert"

const TEMPLATE_ENV: Record<BrevoTemplate, string> = {
  "reviewer-invitation": "BREVO_TEMPLATE_REVIEWER_INVITATION",
  "review-requested": "BREVO_TEMPLATE_REVIEW_REQUESTED",
  "changes-requested": "BREVO_TEMPLATE_CHANGES_REQUESTED",
  "content-approved": "BREVO_TEMPLATE_CONTENT_APPROVED",
  "publish-failed": "BREVO_TEMPLATE_PUBLISH_FAILED",
  "publish-delayed": "BREVO_TEMPLATE_PUBLISH_DELAYED",
  "needs-reauth": "BREVO_TEMPLATE_NEEDS_REAUTH",
  "tiktok-draft-ready": "BREVO_TEMPLATE_TIKTOK_DRAFT_READY",
  "watchdog-alert": "BREVO_TEMPLATE_WATCHDOG_ALERT",
}

/** Résout l'ID numérique d'un template depuis l'env (0 = non configuré). */
function templateId(template: BrevoTemplate): number {
  const raw = process.env[TEMPLATE_ENV[template]]
  const id = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(id) ? id : 0
}

export interface TransactionalOptions {
  template: BrevoTemplate
  to: string | string[]
  params?: Record<string, unknown>
  tags?: string[]
  /** Expéditeur explicite (sinon BREVO_SENDER_EMAIL / BREVO_SENDER_NAME). */
  sender?: { email: string; name?: string }
}

/**
 * Envoie un email transactionnel via l'API Brevo (CLAUDE.md §10). Lève sur
 * secret manquant ou réponse non-2xx — jamais de token ni de contenu loggé.
 */
export async function sendTransactional(opts: TransactionalOptions): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error("BREVO_API_KEY missing (Tier D non configuré)")

  const id = templateId(opts.template)
  if (!id) throw new Error(`Brevo template non configuré: ${opts.template}`)

  const sender = opts.sender ?? {
    email: process.env.BREVO_SENDER_EMAIL ?? "",
    name: process.env.BREVO_SENDER_NAME,
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId: id,
      to: (Array.isArray(opts.to) ? opts.to : [opts.to]).map((email) => ({ email })),
      sender: sender.email ? sender : undefined,
      params: opts.params,
      tags: opts.tags,
    }),
  })
  if (!res.ok) {
    // Ne jamais logguer le corps (peut contenir des données destinataires).
    throw new Error(`Brevo ${res.status} pour ${opts.template}`)
  }
}
