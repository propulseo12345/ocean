import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"

/**
 * Client service_role — BYPASSE la RLS. Serveur exclusivement.
 *
 * `import "server-only"` fait échouer le build si ce module est importé depuis un
 * composant client (anti-pattern CLAUDE.md : service role dans le bundle =
 * compromission totale). N'utiliser que pour l'amorçage, le worker, les Route
 * Handlers de confiance — jamais pour servir une requête utilisateur sans
 * revalider l'appartenance au tenant en amont.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
