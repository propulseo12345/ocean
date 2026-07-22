import { type NextRequest, NextResponse } from "next/server"

import { getActiveOrg } from "@/lib/auth/org-context"
import { buildAuthorizeUrl, isOAuthProviderKey, OAUTH_PROVIDERS } from "@/lib/oauth"
import { codeChallengeOf, createCodeVerifier, signState } from "@/lib/oauth/state"

// Démarrage OAuth custom (CLAUDE.md règle 13). Route PUBLIQUE au niveau du proxy
// (préfixe /api/oauth) MAIS protégée ici : getActiveOrg exige une session owner
// et redirige sinon. Le state est signé (anti-CSRF) et porte l'org active + le
// client cible + le vérifieur PKCE.
//
// SCAFFOLDING Tier D : inerte tant que OAUTH_<PROVIDER>_CLIENT_ID / _SECRET et
// OAUTH_STATE_SECRET ne sont pas en env — auquel cas on redirige avec une erreur.

const SETTINGS = "/settings/accounts"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const { searchParams, origin } = new URL(request.url)

  if (!isOAuthProviderKey(provider)) {
    return NextResponse.redirect(`${origin}${SETTINGS}?error=provider`)
  }
  const config = OAUTH_PROVIDERS[provider]

  // Exige une session owner (redirige vers /login / /onboarding sinon).
  const ctx = await getActiveOrg()

  const clientId = searchParams.get("clientId") ?? undefined
  const redirectUri = `${origin}/api/oauth/${provider}/callback`

  try {
    const codeVerifier = config.usePkce ? createCodeVerifier() : undefined
    const state = signState({ provider, orgId: ctx.org.id, clientId, codeVerifier })
    const authorizeUrl = buildAuthorizeUrl(config, {
      state,
      redirectUri,
      codeChallenge: codeVerifier ? codeChallengeOf(codeVerifier) : undefined,
    })
    return NextResponse.redirect(authorizeUrl)
  } catch {
    // Provider / state secret non configurés → scaffold inerte.
    return NextResponse.redirect(`${origin}${SETTINGS}?error=oauth_unconfigured`)
  }
}
