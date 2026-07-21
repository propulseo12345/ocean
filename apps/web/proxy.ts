import { type NextRequest, NextResponse } from "next/server"

const PUBLIC_EXACT = new Set(["/", "/login", "/otp", "/api/health", "/manifest.webmanifest"])
const PUBLIC_PREFIXES = ["/api/oauth", "/_next", "/favicon.ico"]
const APP_PREFIXES = ["/dashboard", "/agenda", "/clients", "/settings", "/notifications"]

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  )
}

function hasSession(req: NextRequest): boolean {
  return req.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  url.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`)
  return NextResponse.redirect(url)
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  if (pathname.startsWith("/portal")) {
    return hasSession(req) ? NextResponse.next() : redirectToLogin(req)
  }

  if (APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return hasSession(req) ? NextResponse.next() : redirectToLogin(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
