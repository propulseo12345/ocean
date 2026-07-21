import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "./types"

/**
 * Rafraîchit la session Supabase et renvoie l'utilisateur + la réponse porteuse
 * des cookies mis à jour. Appelé par le proxy sur chaque requête.
 *
 * getUser() (et non getSession()) revalide le JWT côté serveur Supabase : c'est
 * ce qui rend la vérification fiable et rafraîchit le token expirant. Sans ce
 * refresh dans le proxy, la PWA se déconnecte en boucle (anti-pattern CLAUDE.md).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
