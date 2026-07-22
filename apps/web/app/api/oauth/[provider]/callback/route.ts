import { type NextRequest, NextResponse } from "next/server"

import { exchangeCode, isOAuthProviderKey, OAUTH_PROVIDERS } from "@/lib/oauth"
import { resolveIdentity } from "@/lib/oauth/identity"
import { verifyState } from "@/lib/oauth/state"
import { persistConnection } from "@/lib/oauth/tokens"

// Callback OAuth : vérifie le state signé AVANT tout échange, échange le code
// contre des tokens, résout l'identité de compte via l'API provider (me/pages…),
// puis persiste la connexion. Les tokens sont chiffrés dans Vault (règle 12) et
// ne transitent jamais vers le navigateur.

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

  const code = searchParams.get("code")
  const stateToken = searchParams.get("state")
  const providerError = searchParams.get("error")
  if (providerError) return NextResponse.redirect(`${origin}${SETTINGS}?error=denied`)
  if (!code || !stateToken) return NextResponse.redirect(`${origin}${SETTINGS}?error=missing`)

  // Anti-CSRF : le state doit être signé par nous et concerner ce provider.
  const state = verifyState(stateToken)
  if (!state || state.provider !== provider) {
    return NextResponse.redirect(`${origin}${SETTINGS}?error=state`)
  }

  const redirectUri = `${origin}/api/oauth/${provider}/callback`

  try {
    const tokens = await exchangeCode(config, {
      code,
      redirectUri,
      codeVerifier: state.codeVerifier,
    })

    // Identité de compte réelle (titulaire du token + comptes publiables).
    const resolved = await resolveIdentity(config, tokens)

    // Persistance : connexion + tokens chiffrés dans Vault, tables *_secrets
    // deny-all. userId vient du state signé (jamais du client untrusted).
    await persistConnection(
      config,
      { orgId: state.orgId, userId: state.userId, clientId: state.clientId },
      resolved,
      tokens
    )

    return NextResponse.redirect(`${origin}${SETTINGS}?connected=${provider}`)
  } catch {
    // Échange/identité/persistance échoués — pas d'écriture partielle de token en
    // clair, on redirige avec une erreur générique (jamais de détail token).
    return NextResponse.redirect(`${origin}${SETTINGS}?error=oauth_failed`)
  }
}
