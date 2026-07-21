import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "./types"

/**
 * Client Supabase navigateur (composants 'use client').
 * N'a accès qu'à la clé anon — la RLS reste la barrière. Aucun secret ici.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
