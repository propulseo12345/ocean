import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Callback d'authentification email (récupération de mot de passe, confirmation).
// Le lien de l'email arrive ici avec soit un `code` (PKCE), soit un `token_hash`
// + `type` (vérification OTP). On établit la session puis on redirige vers `next`.
// Chemin public (préfixe /auth du proxy) — la sécurité vient du code/token signé.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const nextParam = searchParams.get("next")
  // On n'accepte qu'un chemin relatif interne (jamais une URL absolue → open redirect).
  const next = nextParam?.startsWith("/") ? nextParam : "/dashboard"

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
