"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { routes } from "@/lib/routes"
import { type ActionResult, requireClientInOrg } from "./_helpers"

// Étiquettes libres transverses (content_labels + content_item_labels, migration
// 006). Écritures par NOM (comme reconcileLabels du composer) : on résout/crée
// l'étiquette par son nom dans le scope du client, puis on reconstruit les liens.
// Aucune migration — les tables existent.

type Db = Awaited<ReturnType<typeof requireClientInOrg>>["supabase"]

const labelName = z.string().trim().min(1).max(60)

/** Résout (créant au besoin) les ids d'étiquettes par nom, scopées au client. */
async function resolveLabelIds(
  supabase: Db,
  orgId: string,
  clientId: string,
  names: string[]
): Promise<Map<string, string>> {
  const wanted = [...new Set(names)]
  const idByName = new Map<string, string>()
  if (wanted.length === 0) return idByName

  const { data: existing } = await supabase
    .from("content_labels")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .in("name", wanted)
  for (const l of existing ?? []) idByName.set(l.name, l.id)

  const toCreate = wanted.filter((name) => !idByName.has(name))
  if (toCreate.length) {
    const { data: created } = await supabase
      .from("content_labels")
      .insert(toCreate.map((name) => ({ org_id: orgId, client_id: clientId, name })))
      .select("id, name")
    for (const l of created ?? []) idByName.set(l.name, l.id)
  }
  return idByName
}

const setSchema = z.object({
  clientId: z.string().uuid(),
  contentId: z.string().uuid(),
  labels: z.array(labelName).max(30),
})

/** Remplace l'ensemble des étiquettes d'un contenu (éditeur d'une carte). */
export async function setContentLabels(input: z.infer<typeof setSchema>): Promise<ActionResult> {
  const parsed = setSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentId, labels } = parsed.data

  const { orgId, supabase } = await requireClientInOrg(clientId)

  await supabase
    .from("content_item_labels")
    .delete()
    .eq("org_id", orgId)
    .eq("content_item_id", contentId)

  const idByName = await resolveLabelIds(supabase, orgId, clientId, labels)
  const links = [...new Set(labels)]
    .map((name) => idByName.get(name))
    .filter((id): id is string => id !== undefined)
    .map((content_label_id) => ({
      org_id: orgId,
      client_id: clientId,
      content_item_id: contentId,
      content_label_id,
    }))
  if (links.length) {
    const { error } = await supabase.from("content_item_labels").insert(links)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(routes.clientContent(clientId))
  revalidatePath(routes.content(clientId, contentId))
  return { ok: true }
}

const batchSchema = z.object({
  clientId: z.string().uuid(),
  contentIds: z.array(z.string().uuid()).min(1).max(200),
  labels: z.array(labelName).min(1).max(30),
})

/**
 * Ajoute (union) des étiquettes à plusieurs contenus — étiquetage en lot. Les
 * liens déjà présents sont ignorés (PK content_item_id+content_label_id).
 */
export async function addLabelsToContents(
  input: z.infer<typeof batchSchema>
): Promise<ActionResult> {
  const parsed = batchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" }
  const { clientId, contentIds, labels } = parsed.data

  const { orgId, supabase } = await requireClientInOrg(clientId)

  // Les contenus ciblés doivent appartenir au client (défense en profondeur).
  const { data: owned } = await supabase
    .from("content_items")
    .select("id")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .in("id", contentIds)
  const validIds = (owned ?? []).map((c) => c.id)
  if (validIds.length === 0) return { ok: false, error: "NOT_FOUND" }

  const idByName = await resolveLabelIds(supabase, orgId, clientId, labels)
  const labelIds = [...idByName.values()]
  if (labelIds.length === 0) return { ok: true }

  const rows = validIds.flatMap((contentId) =>
    labelIds.map((content_label_id) => ({
      org_id: orgId,
      client_id: clientId,
      content_item_id: contentId,
      content_label_id,
    }))
  )
  // upsert ignore-duplicates : ne recrée pas un lien déjà posé.
  const { error } = await supabase
    .from("content_item_labels")
    .upsert(rows, { onConflict: "content_item_id,content_label_id", ignoreDuplicates: true })
  if (error) return { ok: false, error: error.message }

  revalidatePath(routes.clientContent(clientId))
  return { ok: true }
}
