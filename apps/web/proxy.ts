import { type NextRequest, NextResponse } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

// Next 16 : Middleware s'appelle desormais Proxy (node_modules/next/dist/docs).
// La doc Next EXCLUT explicitement le proxy comme solution de session/autorisation
// (Partial Rendering, prefetch). Ici : refresh de session + check OPTIMISTE de
// presence d'un user. La vraie verification vit dans la DAL (lib/auth/dal.ts),
// appelee par chaque fonction de donnees.

// Routes accessibles sans session.
const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  // Page de confirmation d'invitation (V-3) : un invité au compte encore
  // inexistant doit pouvoir l'atteindre pour demander son lien de connexion.
  // Elle n'écrit rien — l'écriture est une Server Action, en POST, avec
  // vérification d'origine.
  "/invitations",
  "/api/health",
  "/manifest.webmanifest",
])
// /r = liens publics de rapport (partage lecture seule, token signé).
const PUBLIC_PREFIXES = ["/api/oauth", "/api/invitations", "/auth", "/r"]

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  )
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  // Toujours rafraichir la session (meme sur les routes publiques : sinon un
  // token expirant n'est jamais renouvele).
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Un user connecte sur /login repart vers l'app. On ne DEVINE plus la
  // destination ici — le proxy n'a pas le droit d'interroger la base (Partial
  // Rendering, prefetch) et `/dashboard` en dur envoyait tout Reviewer sur un
  // 404. On delegue au point unique de resolution de role (P7-5), en preservant
  // `next` au lieu de l'effacer.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/landing"
    const next = request.nextUrl.searchParams.get("next")
    url.search = next ? `?next=${encodeURIComponent(next)}` : ""
    return NextResponse.redirect(url)
  }

  if (isPublic(pathname)) {
    return response
  }

  // FAIL-CLOSED : toute route non publique exige une session. Contrairement a
  // l'ancienne allowlist qui laissait passer tout chemin non liste.
  if (!user) {
    return redirectToLogin(request)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
