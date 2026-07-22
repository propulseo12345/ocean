import { type NextRequest, NextResponse } from "next/server"

import { exchangeCode, isOAuthProviderKey, OAUTH_PROVIDERS } from "@/lib/oauth"
import { verifyState } from "@/lib/oauth/state"
import { persistConnection } from "@/lib/oauth/tokens"

// Callback OAuth : vérifie le state signé AVANT tout échange, échange le code
// contre des tokens, puis persiste la connexion. La persistance des tokens passe
// par Vault (règle 12) — point bloquant documenté (persistConnection lève tant
// que le helper Vault n'est pas posé). Le reste du flux est complet.

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

    // Persistance (Vault) — LÈVE tant que le helper Vault n'existe pas (Tier D).
    await persistConnection(
      config,
      {
        orgId: state.orgId,
        clientId: state.clientId,
        // L'identité de compte réelle se résout via l'API provider (me/pages…) :
        // à compléter au câblage. Placeholder inerte ici.
        providerAccountId: (tokens.raw.open_id as string) ?? "pending",
        scopes: config.scopes,
      },
      tokens
    )

    return NextResponse.redirect(`${origin}${SETTINGS}?connected=${provider}`)
  } catch {
    return NextResponse.redirect(`${origin}${SETTINGS}?error=oauth_pending`)
  }
}
