import { type NextRequest, NextResponse } from "next/server"

import {
  exchangeCode,
  exchangeForLongLivedToken,
  isOAuthProviderKey,
  OAUTH_PROVIDERS,
} from "@/lib/oauth"
import { decideCallback } from "@/lib/oauth/callback-rule"
import { resolveIdentity } from "@/lib/oauth/identity"
import { requireStateSecret } from "@/lib/oauth/state"
import { persistConnection } from "@/lib/oauth/tokens"
import { consumeTransaction } from "@/lib/oauth/transaction"
import { requireSiteOrigin } from "@/lib/site-url"
import { createClient as createServerClient } from "@/lib/supabase/server"

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
  const { searchParams } = new URL(request.url)

  // Même contrainte qu'à l'aller : le redirect_uri renvoyé au token endpoint doit
  // être IDENTIQUE à celui de la requête d'autorisation (les quatre fournisseurs
  // le vérifient). Il vient donc de SITE_URL, jamais de l'origine de la requête.
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

  // La transaction est consommée AVANT toute décision : quel que soit le
  // verdict, le nonce ne doit pas rester rejouable.
  const tx = await consumeTransaction()

  // La session est revalidée auprès de Supabase — `getUser()` et pas
  // `getSession()`, seul le premier vérifie le jeton au lieu de le décoder.
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Les QUATRE gardes vivent dans `callback-rule.ts`, exécutable par les tests :
  // signature + fraîcheur + provider, nonce du cookie, session initiatrice, et
  // usage unique (assuré par la consommation ci-dessus). Les laisser ici les
  // aurait rendues vraies « par lecture » seulement.
  let secret: string
  try {
    secret = requireStateSecret()
  } catch {
    return NextResponse.redirect(`${origin}${SETTINGS}?error=oauth_unconfigured`)
  }

  const decision = decideCallback({
    provider,
    code: searchParams.get("code"),
    providerError: searchParams.get("error"),
    stateToken: searchParams.get("state"),
    transaction: tx,
    sessionUserId: user?.id ?? null,
    secret,
    nowMs: Date.now(),
  })
  if (!decision.ok) {
    return NextResponse.redirect(`${origin}${SETTINGS}?error=${decision.error}`)
  }
  const { state } = decision

  const redirectUri = `${origin}/api/oauth/${provider}/callback`

  try {
    const court = await exchangeCode(config, {
      code: decision.code,
      redirectUri,
      // Le vérifieur vient du COOKIE, jamais du state (P8-5).
      codeVerifier: decision.codeVerifier,
    })

    // P8-3 — L'ÉCHANGE LONG-LIVED PRÉCÈDE LA RÉSOLUTION D'IDENTITÉ, ET C'EST
    // TOUT LE TICKET. Les tokens de PAGE héritent de la durée de vie du token
    // utilisateur qui les demande : résoudre l'identité avec le token court
    // donnerait des tokens de page courts — ceux-là mêmes qui publient. La
    // connexion afficherait 60 jours et mourrait dans l'heure.
    const tokens = await exchangeForLongLivedToken(config, court)

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
