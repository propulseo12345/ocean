import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import type { Client } from "@/lib/domain/core"
import { createClient } from "@/lib/supabase/server"
import { verifySession } from "./dal"

const ACTIVE_ORG_COOKIE = "active_org_id"

type DbClientRow = {
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

/**
 * Pont ligne DB -> type front `Client` pour le contexte Reviewer. Le contenu
 * est monolingue (D1). `following` n'existe pas sur la table clients (défaut 0 ;
 * la vraie valeur vient du compte Instagram, cf. mapClient dans lib/data/clients).
 */
function dbClientToClient(row: DbClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle ?? "",
    brandColor: row.brand_color ?? "oklch(0.62 0.19 250)",
    timezone: row.timezone,
    archivedAt: row.archived_at,
    bio: row.bio ?? "",
    category: row.category ?? "",
    following: 0,
    approvalMode: row.approval_mode as Client["approvalMode"],
    notes: row.notes ?? undefined,
  }
}

function initialsFrom(fullName: string | null, email: string): string {
  const source = (fullName ?? email).trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

/**
 * Contexte de l'organisation active (freelance authentifié).
 *
 * Redirige vers /login si pas de session, et vers /onboarding si l'utilisateur
 * n'appartient à aucune org (il doit amorcer la sienne via create_organization).
 * Ne renvoie donc JAMAIS null aux appelants — les 19 pages peuvent lire
 * `ctx.org.id` sans garde. C'est la DAL au sens Next 16.
 *
 * L'org active vient du cookie httpOnly `active_org_id` (jamais du client
 * untrusted), validée contre organization_members. Fallback : 1re appartenance.
 */
export const getActiveOrg = cache(async () => {
  const user = await verifySession()
  if (!user) redirect("/login")

  const supabase = await createClient()
  const cookieStore = await cookies()
  const wantedOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id, role, organizations(id, name)")
    .eq("user_id", user.id)

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding")
  }

  const active = memberships.find((m) => m.org_id === wantedOrgId) ?? memberships[0]

  const organization = active.organizations as unknown as {
    id: string
    name: string
  } | null
  if (!organization) redirect("/onboarding")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, initials, timezone")
    .eq("id", user.id)
    .single()

  const email = profile?.email ?? user.email ?? ""
  const fullName = profile?.full_name ?? null

  return {
    org: { id: organization.id, name: organization.name, org_id: organization.id },
    role: active.role as "owner" | "admin",
    user: {
      id: user.id,
      name: fullName ?? email,
      email,
      initials: profile?.initials ?? initialsFrom(fullName, email),
      timezone: profile?.timezone ?? "Europe/Paris",
    },
  }
})

/**
 * Contexte Reviewer (portail). Le Reviewer n'a PAS d'org active : il est scopé
 * par ses lignes client_members. Câblage complet en Phase 3 (collaboration).
 */
export const getReviewerContext = cache(async () => {
  const user = await verifySession()
  if (!user) redirect("/login")

  const supabase = await createClient()

  const { data: rows } = await supabase
    .from("client_members")
    .select(
      "org_id, client_id, clients(id, name, handle, brand_color, timezone, approval_mode, bio, category, notes, archived_at)"
    )
    .eq("user_id", user.id)

  const memberships = rows ?? []
  const clients = memberships
    .map((m) => m.clients as unknown as DbClientRow | null)
    .filter((c): c is DbClientRow => c !== null)
    .map(dbClientToClient)

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, initials")
    .eq("id", user.id)
    .single()

  const email = profile?.email ?? user.email ?? ""

  return {
    orgId: memberships[0]?.org_id ?? "",
    reviewer: memberships.length
      ? {
          id: user.id,
          clientId: memberships[0].client_id,
          name: profile?.full_name ?? email,
          email,
          initials: profile?.initials ?? initialsFrom(profile?.full_name ?? null, email),
          lastActiveAt: new Date().toISOString(),
        }
      : null,
    clients,
    clientIds: memberships.map((m) => m.client_id),
  }
})

export type ActiveOrgContext = Awaited<ReturnType<typeof getActiveOrg>>
export type ReviewerContext = Awaited<ReturnType<typeof getReviewerContext>>
