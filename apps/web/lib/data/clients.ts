import "server-only"

import { cache } from "react"

import { getActiveOrg } from "@/lib/auth/org-context"
import { loc } from "@/lib/i18n"
import type { AccountStatus, Client, Platform, SocialAccount, User } from "@/lib/mocks/types"
import { createClient } from "@/lib/supabase/server"

// Câblage Supabase des lectures CŒUR « identité » : clients, comptes sociaux,
// utilisateur courant. Comme partout dans lib/data, on filtre explicitement sur
// org_id en plus de la RLS (défense en profondeur, règle 7).

export const CLIENT_COLUMNS =
  "id, name, handle, brand_color, timezone, approval_mode, bio, category, notes, archived_at"

export interface DbClientRow {
  id: string
  name: string
  handle: string | null
  brand_color: string | null
  timezone: string
  approval_mode: string
  bio: string | null
  category: string | null
  notes: string | null
  archived_at: string | null
}

const DEFAULT_BRAND_COLOR = "oklch(0.62 0.19 250)"

// `theme` n'existe PAS en base : c'est un artefact de la preview (pools d'images
// Pexels de lib/mocks/images). On le dérive de l'id pour rester déterministe
// tant que `useLibraryAssets.addMockAssets` en dépend — à retirer en Phase 8
// avec les mocks, en même temps que le champ du type `Client`.
const PREVIEW_THEMES = ["coffee", "food", "fashion", "yoga"] as const

function themeFor(id: string): Client["theme"] {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PREVIEW_THEMES[hash % PREVIEW_THEMES.length]
}

/**
 * Ligne DB -> type front `Client`. Les champs narratifs sont dupliqués fr=en :
 * le contenu est monolingue (D1), le `string` disparaît en Phase 7.
 * `following` vient du compte Instagram du client (social_accounts), pas de
 * la table clients — 0 si aucun compte connecté.
 */
export function mapClient(row: DbClientRow, following = 0): Client {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle ?? "",
    brandColor: row.brand_color ?? DEFAULT_BRAND_COLOR,
    timezone: row.timezone,
    archivedAt: row.archived_at,
    theme: themeFor(row.id),
    bio: loc(row.bio ?? "", row.bio ?? ""),
    category: loc(row.category ?? "", row.category ?? ""),
    following,
    approvalMode: row.approval_mode as Client["approvalMode"],
    notes: row.notes ? loc(row.notes, row.notes) : undefined,
  }
}

/** `following` par client, lu sur le compte Instagram (une seule requête). */
async function followingByClient(orgId: string): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("social_accounts")
    .select("client_id, following_count")
    .eq("org_id", orgId)
    .eq("platform", "instagram")

  const out = new Map<string, number>()
  for (const row of data ?? []) {
    if (row.following_count != null) out.set(row.client_id, row.following_count)
  }
  return out
}

export const getClients = cache(
  async (orgId: string, includeArchived = false): Promise<Client[]> => {
    if (!orgId) return []
    const supabase = await createClient()

    let query = supabase.from("clients").select(CLIENT_COLUMNS).eq("org_id", orgId)
    if (!includeArchived) query = query.is("archived_at", null)
    const { data } = await query.order("name", { ascending: true })

    const rows = (data ?? []) as DbClientRow[]
    if (rows.length === 0) return []

    const following = await followingByClient(orgId)
    return rows.map((row) => mapClient(row, following.get(row.id) ?? 0))
  }
)

export const getClient = cache(async (orgId: string, clientId: string): Promise<Client | null> => {
  if (!orgId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", clientId)
    .maybeSingle()

  if (!data) return null

  const { data: account } = await supabase
    .from("social_accounts")
    .select("following_count")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("platform", "instagram")
    .maybeSingle()

  return mapClient(data as DbClientRow, account?.following_count ?? 0)
})

export const getSocialAccounts = cache(
  async (orgId: string, clientId?: string): Promise<SocialAccount[]> => {
    if (!orgId) return []
    const supabase = await createClient()

    let query = supabase
      .from("social_accounts")
      .select("id, client_id, platform, username, display_name, status, followers_count")
      .eq("org_id", orgId)
    if (clientId) query = query.eq("client_id", clientId)
    const { data } = await query.order("created_at", { ascending: true })

    return (data ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      platform: row.platform as Platform,
      username: row.username ?? "",
      displayName: row.display_name ?? row.username ?? "",
      status: row.status as AccountStatus,
      followers: row.followers_count ?? 0,
    }))
  }
)

/**
 * Utilisateur courant. Dérivé du contexte d'org (une seule résolution de
 * session par requête grâce à `cache()`), jamais d'une lecture client.
 */
export const getCurrentUser = cache(async (): Promise<User> => {
  const ctx = await getActiveOrg()
  return ctx.user
})
