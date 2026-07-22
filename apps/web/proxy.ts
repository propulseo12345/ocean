import { NextResponse, type NextRequest } from "next/server"

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
  "/forgot-password",
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

  // Un user connecte sur /login repart vers l'app.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
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
