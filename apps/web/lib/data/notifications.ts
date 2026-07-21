import "server-only"

import { cache } from "react"

import type { AppNotification, NotificationAudience, NotificationChannel } from "@/lib/mocks/types"
import { createClient } from "@/lib/supabase/server"

// Notifications in-app. La RLS scope déjà sur le destinataire ; on répète
// `recipient_user_id` explicitement (règle 7) — une notification d'un autre
// membre de l'org ne doit jamais atterrir dans la cloche.

export const getNotifications = cache(
  async (orgId: string, audience: NotificationAudience = "owner"): Promise<AppNotification[]> => {
    if (!orgId) return []
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, channels, audience, href, read_at, created_at")
      .eq("org_id", orgId)
      .eq("recipient_user_id", user.id)
      .eq("audience", audience)
      .order("created_at", { ascending: false })

    return (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body ?? "",
      channels: row.channels as NotificationChannel[],
      audience: row.audience as NotificationAudience,
      read: row.read_at !== null,
      createdAt: row.created_at,
      href: row.href,
    }))
  }
)

export const getUnreadCount = cache(
  async (orgId: string, audience: NotificationAudience = "owner"): Promise<number> => {
    if (!orgId) return 0
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0

    // `head: true` : on ne rapatrie aucune ligne, seulement le compte.
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("recipient_user_id", user.id)
      .eq("audience", audience)
      .is("read_at", null)

    return count ?? 0
  }
)
