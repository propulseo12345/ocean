import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

/**
 * Data Access Layer — point unique de vérification de session.
 *
 * La doc Next 16 (guide authentication) impose de vérifier l'auth AU PLUS PRÈS
 * de la donnée, jamais dans un layout (Partial Rendering : un layout ne re-rend
 * pas à la navigation). Chaque fonction de données passe donc par verifySession.
 *
 * getUser() revalide le JWT côté Supabase — contrairement à getSession() qui lit
 * un cookie non vérifié.
 */
export const verifySession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
