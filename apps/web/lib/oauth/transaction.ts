import "server-only"

import { cookies } from "next/headers"

import { STATE_TTL_MS } from "./state-rule"

// La moitié « navigateur » d'un flux OAuth : un cookie httpOnly qui porte le
// nonce et le vérifieur PKCE, posé à l'aller et CONSOMMÉ au retour.
//
// POURQUOI UN COOKIE, ET PAS LE STATE
// ------------------------------------
// Le state voyage dans l'URL de redirection, à côté du code d'autorisation :
// historique du navigateur, en-tête Referer, journaux du fournisseur. Tout ce
// qui doit rester secret ne peut donc PAS y vivre — c'est tout le ticket P8-5.
// Le cookie, lui, ne quitte jamais le couple navigateur ↔ serveur.
//
// CE QUE LE COUPLE PROUVE
// ------------------------
// Ni l'un ni l'autre ne suffit, et c'est le point :
//   · le state seul est signé (intègre) mais rejouable par quiconque l'a vu ;
//   · le cookie seul est falsifiable par son propre porteur.
// Exiger que le nonce du cookie soit CELUI du state signé prouve que le
// navigateur qui revient est celui qui est parti, et qu'il est parti de chez
// nous. Un attaquant qui force un cookie chez la victime ne peut pas fabriquer
// le state assorti ; un attaquant qui rejoue un state capté n'a pas le cookie.

const COOKIE = "oauth_tx"

export interface OAuthTransaction {
  nonce: string
  /** Vérifieur PKCE. Ne doit exister QUE ici. */
  codeVerifier?: string
}

/**
 * Pose le cookie de transaction.
 *
 * ⚠ `sameSite: "lax"` est obligatoire et n'est pas un relâchement. Le retour du
 * fournisseur est une navigation de premier niveau **cross-site** : en `strict`,
 * le navigateur n'enverrait pas le cookie, la transaction serait introuvable, et
 * AUCUNE connexion OAuth ne pourrait aboutir. `lax` envoie le cookie sur cette
 * navigation GET et sur rien d'autre — exactement le besoin.
 */
export async function openTransaction(tx: OAuthTransaction, secure: boolean): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE, Buffer.from(JSON.stringify(tx)).toString("base64url"), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    // Borné au chemin des callbacks : le cookie n'est pas envoyé au reste du site.
    path: "/api/oauth",
    maxAge: Math.floor(STATE_TTL_MS / 1000),
  })
}

/**
 * Lit la transaction ET la supprime — usage unique.
 *
 * La suppression est faite AVANT toute décision, y compris en cas de contenu
 * illisible : un cookie qu'on garderait après une tentative ratée rendrait le
 * nonce rejouable, ce qui est précisément ce que le nonce empêche.
 */
export async function consumeTransaction(): Promise<OAuthTransaction | null> {
  const jar = await cookies()
  const brut = jar.get(COOKIE)?.value
  jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/api/oauth", maxAge: 0 })
  if (!brut) return null
  try {
    const objet = JSON.parse(Buffer.from(brut, "base64url").toString("utf8")) as unknown
    if (typeof objet !== "object" || objet === null) return null
    const tx = objet as Record<string, unknown>
    if (typeof tx.nonce !== "string" || tx.nonce === "") return null
    if (tx.codeVerifier !== undefined && typeof tx.codeVerifier !== "string") return null
    return { nonce: tx.nonce, codeVerifier: tx.codeVerifier as string | undefined }
  } catch {
    return null
  }
}
