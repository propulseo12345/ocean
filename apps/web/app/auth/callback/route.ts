import type { EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { safeNextFromRedirectTo } from "@/lib/auth/safe-next"
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
  // On n'accepte qu'un chemin relatif interne. `startsWith("/")` ne suffisait
  // pas : `//evil.tld` le satisfait et pointe vers un autre hôte (P7-8).
  //
  // Les gabarits d'e-mail passent `next={{ .RedirectTo }}`, qui est l'URL
  // ABSOLUE remise à GoTrue. `safeNext` la refusait et retombait sur
  // `/dashboard` : le jeton d'invitation mourait exactement ici (V-2). La
  // variante tolère l'absolue à condition que son origine soit octet pour octet
  // la nôtre, puis délègue le chemin à `safeNext`, seul juge.
  const next = safeNextFromRedirectTo(searchParams.get("next"), origin)

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
