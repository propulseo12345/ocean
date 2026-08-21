// Edge Function `watchdog-notify` — le dernier maillon du seul filet
// indépendant du worker (migration 037).
//
// Appelée par pg_cron via pg_net, toutes les 5 minutes, UNIQUEMENT quand des
// jobs sont réellement en retard. Elle n'a aucune décision à prendre : la
// décision est en SQL (`private.late_publish_jobs`), testée par pgTAP. Ici, on
// met en forme et on envoie.
//
// POURQUOI UNE EDGE FUNCTION ET PAS UN APPEL DIRECT DEPUIS POSTGRES
// -------------------------------------------------------------------
// `net.http_post` sait appeler Brevo directement — et il faudrait alors mettre
// la clé Brevo dans le SQL, la maintenir dans Vault, et composer le corps de
// l'e-mail en plpgsql. L'Edge Function garde le secret côté plateforme, permet
// de faire évoluer le message sans migration, et reste dans le périmètre que
// CLAUDE.md §8 autorise aux Edge Functions : cleanup et watchdog, jamais la
// publication.
//
// ⚠ CE QUI N'EST PAS VÉRIFIÉ : aucun e-mail n'a jamais été envoyé. `BREVO_API_KEY`
// n'existe pas encore. Sans elle, la fonction répond 200 avec `sent: false` et
// journalise — un watchdog qui plante sur sa propre configuration est pire que
// pas de watchdog, parce qu'il fait échouer le cron sans rien dire à personne.

interface LateJob {
  id: string
  org_id: string
  client_id: string
  content_item_id: string
  platform: string
  status: string
  run_at: string
  late_by_seconds: number
}

interface Payload {
  late_jobs?: LateJob[]
  count?: number
}

/** Destinataire de l'alerte : l'exploitant, pas le client (CLAUDE.md §10). */
const FALLBACK_RECIPIENT = "etienne.guimbard@propulseo-site.com"

/** Id du gabarit Brevo `watchdog-alert`. Absent => envoi texte brut. */
const TEMPLATE_ENV = "BREVO_TEMPLATE_WATCHDOG_ALERT"

function minutes(seconds: number): string {
  return `${Math.floor(seconds / 60)} min`
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json({ error: "POST attendu" }, 405)
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: "corps illisible" }, 400)
  }

  const jobs = payload.late_jobs ?? []
  if (jobs.length === 0) {
    // pg_cron n'appelle que s'il y a des jobs ; un corps vide est une anomalie
    // d'appel, pas une erreur — on ne réveille personne pour ça.
    return json({ sent: false, reason: "aucun job en retard dans la charge" })
  }

  const apiKey = Deno.env.get("BREVO_API_KEY")
  const recipient = Deno.env.get("WATCHDOG_ALERT_TO") ?? FALLBACK_RECIPIENT
  const siteUrl = Deno.env.get("SITE_URL") ?? ""

  // Le résumé est calculé même sans clé : il part dans les logs, qui restent la
  // seule trace tant que Brevo n'est pas configuré.
  const worst = jobs.reduce((a, b) => (a.late_by_seconds > b.late_by_seconds ? a : b))
  const summary = {
    count: jobs.length,
    worstLateBy: minutes(worst.late_by_seconds),
    platforms: [...new Set(jobs.map((j) => j.platform))],
    // Aucun contenu client, aucun token : des identifiants et des durées.
    jobIds: jobs.slice(0, 20).map((j) => j.id),
  }
  console.log(JSON.stringify({ level: "error", message: "watchdog: jobs en retard", ...summary }))

  if (!apiKey) {
    return json({ sent: false, reason: "BREVO_API_KEY absente", ...summary })
  }

  const templateId = Number.parseInt(Deno.env.get(TEMPLATE_ENV) ?? "", 10)
  const body: Record<string, unknown> = {
    to: [{ email: recipient }],
    tags: ["watchdog-alert"],
  }
  if (Number.isFinite(templateId) && templateId > 0) {
    body.templateId = templateId
    body.params = {
      count: summary.count,
      worst_late_by: summary.worstLateBy,
      platforms: summary.platforms.join(", "),
      dashboard_url: siteUrl ? `${siteUrl}/app/dashboard` : "",
    }
  } else {
    // Repli assumé : mieux vaut un e-mail brut qu'aucun e-mail. Le gabarit
    // `watchdog-alert` (CLAUDE.md §10) le remplacera.
    body.sender = { email: recipient, name: "Ocean watchdog" }
    body.subject = `Ocean — ${summary.count} publication(s) en retard`
    body.textContent =
      `${summary.count} job(s) de publication sont dus et n'ont ete reclames par aucun worker.\n` +
      `Le plus ancien accuse ${summary.worstLateBy} de retard.\n` +
      `Plateformes : ${summary.platforms.join(", ")}\n\n` +
      `Verifier que l'app worker tourne (Coolify) avant l'heure de publication suivante.`
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // On rend 200 : renvoyer une erreur ferait retenter pg_net toutes les
    // 5 minutes sur une panne Brevo, et le job est deja marque `alerted`.
    console.error(`brevo ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return json({ sent: false, reason: `brevo ${res.status}`, ...summary })
  }
  return json({ sent: true, ...summary })
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })
}
