import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "./types"

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers.
 * Lit/écrit la session via les cookies (Next 16 : `cookies()` est async).
 *
 * Le bloc try/catch sur setAll couvre le cas Server Component : y écrire un
 * cookie lève, mais le refresh de session est alors géré par le proxy — on
 * ignore l'erreur silencieusement, comme recommandé par @supabase/ssr.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Appelé depuis un Server Component : le proxy rafraîchira la session.
          }
        },
      },
    },
  )
}
