"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { type ActionResult, requireClientInOrg } from "./_helpers"

const brandKitSchema = z.object({
  clientId: z.string().uuid(),
  palette: z.array(z.string().max(64)).max(12),
  tone: z.string().max(2000),
  doList: z.array(z.string().trim().min(1).max(500)).max(20),
  dontList: z.array(z.string().trim().min(1).max(500)).max(20),
  bannedWords: z.array(z.string().trim().min(1).max(120)).max(100),
})

/** Met à jour (ou crée) le brand kit d'un client. 1-1, upsert sur client_id. */
export async function updateBrandKit(input: unknown): Promise<ActionResult> {
  const parsed = brandKitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { clientId, palette, tone, doList, dontList, bannedWords } = parsed.data

  try {
    const { orgId, supabase } = await requireClientInOrg(clientId)
    const { error } = await supabase.from("brand_kits").upsert(
      {
        client_id: clientId,
        org_id: orgId,
        palette,
        tone: tone.trim() ? tone.trim() : null,
        do_list: doList,
        dont_list: dontList,
        banned_words: bannedWords,
      },
      { onConflict: "client_id" }
    )
    if (error) return { ok: false, error: "db_error" }
  } catch {
    return { ok: false, error: "forbidden" }
  }

  revalidatePath(`/clients/${clientId}/settings`)
  return { ok: true }
}
