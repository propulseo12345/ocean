"use server"

import { createHash, randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { type ActionResult, requireClientInOrg } from "@/lib/actions/_helpers"
import { routes } from "@/lib/routes"
import type { Json } from "@/lib/supabase/types"
import { getReportData } from "./report-data"

// Partage public d'un rapport client (migration 018). Modèle SNAPSHOT : on fige
// le rapport calculé (l'owner y a accès via RLS) dans report_shares.payload. Le
// viewer anonyme ne lira que ce payload via la RPC get_report_share. Anti-fuite :
// on retire les notes internes du client avant de figer.

const shareSchema = z.object({ clientId: z.string().uuid() })

/** Crée un lien de partage et renvoie le token EN CLAIR (une seule fois). */
export async function createReportShare(
  input: z.infer<typeof shareSchema>
): Promise<ActionResult<{ token: string }>> {
  const parsed = shareSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId } = parsed.data

  const { orgId, userId, supabase } = await requireClientInOrg(clientId)

  const data = await getReportData(orgId, clientId)
  if (!data) return { ok: false, error: "NOT_FOUND" }

  // Anti-fuite : les notes internes du client ne partent JAMAIS dans un lien public.
  const { notes: _notes, ...clientSafe } = data.client
  const payload = { ...data, client: clientSafe }

  const token = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")

  const { error } = await supabase.from("report_shares").insert({
    org_id: orgId,
    client_id: clientId,
    token_hash: tokenHash,
    payload: payload as unknown as Json,
    created_by: userId,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath(routes.clientReport(clientId))
  return { ok: true, data: { token } }
}
