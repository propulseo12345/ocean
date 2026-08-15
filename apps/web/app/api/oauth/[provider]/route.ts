import { type NextRequest, NextResponse } from "next/server"

import { getActiveOrg } from "@/lib/auth/org-context"
import { buildAuthorizeUrl, isOAuthProviderKey, OAUTH_PROVIDERS } from "@/lib/oauth"
import { codeChallengeOf, createCodeVerifier, createNonce, signState } from "@/lib/oauth/state"
import { openTransaction } from "@/lib/oauth/transaction"
import { requireSiteOrigin } from "@/lib/site-url"

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
  const { searchParams } = new URL(request.url)

  // ⚠️ JAMAIS `new URL(request.url).origin` ici. En conteneur derrière le proxy
  // Coolify, cette origine est celle vue par le process (http, host interne), pas
  // l'URL publique : le redirect_uri ne correspondrait à aucune des URIs déclarées
  // chez le fournisseur, et AUCUNE connexion sociale ne pourrait aboutir. Elle est
  // en plus dérivée d'un en-tête que le client contrôle.
  let origin: string
  try {
    origin = requireSiteOrigin()
  } catch {
    return NextResponse.redirect(new URL(`${SETTINGS}?error=site_url_unconfigured`, request.url))
  }

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
    const nonce = createNonce()

    // Le state porte l'identité du flux (signée, publique) ; le cookie porte ce
    // qui doit rester secret ou prouver le navigateur (nonce, vérifieur PKCE).
    // Séparés délibérément : le state voyage dans l'URL, à côté du code.
    const state = signState({ provider, orgId: ctx.org.id, userId: ctx.user.id, clientId }, nonce)
    await openTransaction({ nonce, codeVerifier }, origin.startsWith("https://"))

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
