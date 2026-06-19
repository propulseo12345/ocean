import { getSocialAccounts } from "@/lib/mocks"
import type { SocialAccount } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

// Navigation contextuelle entre clients : en passant de Verde à Nove depuis
// /clients/X/calendar, on atterrit sur /clients/Y/calendar (sous-page conservée).

const CLIENT_SUBPAGES = [
  "grid",
  "calendar",
  "content",
  "library",
  "ideas",
  "performance",
  "settings",
] as const

/** Id du client actif d'après l'URL (undefined hors espace client). */
export function activeClientIdFromPath(pathname: string): string | undefined {
  const id = pathname.match(/^\/clients\/([^/?#]+)/)?.[1]
  return id === "new" ? undefined : id
}

/** Lien vers `clientId` en conservant la sous-page courante (sinon la grille). */
export function clientSwitchHref(pathname: string, clientId: string): string {
  const sub = pathname.match(/^\/clients\/[^/]+\/([^/?#]+)/)?.[1]
  if (sub && (CLIENT_SUBPAGES as readonly string[]).includes(sub)) {
    return `${routes.client(clientId)}/${sub}`
  }
  return routes.clientGrid(clientId)
}

/** Comptes sociaux du client nécessitant une reconnexion (needs_reauth / expired). */
export function clientAccountIssues(clientId: string): SocialAccount[] {
  return getSocialAccounts(clientId).filter((a) => a.status !== "connected")
}
