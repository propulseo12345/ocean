// Garde anti-CSRF pour les écritures déclenchées par le navigateur (ticket V-3).
//
// LA FAILLE QUE CE MODULE FERME
// -----------------------------
// L'acceptation d'invitation était un GET À EFFET DE BORD, sans contrôle
// d'origine ni jeton anti-CSRF, sur des cookies `SameSite=Lax` (défaut de
// `@supabase/ssr`, jamais surchargé). Une navigation top-level depuis un site
// tiers emporte donc les cookies : l'attaquant crée une org, un client, invite
// `victime@x` — `inviteReviewer` lui rend le jeton EN CLAIR — puis fait ouvrir
// le lien à la victime. La session lue est celle de la VICTIME, la garde
// `sameAddress` passe puisque l'invitation vise justement son adresse, et
// l'adhésion est écrite en service_role, hors RLS.
//
// Le gain n'est pas théorique : `private.shares_scope_with` devient vraie, donc
// `profiles_select_shared` ouvre à l'attaquant la ligne `profiles` de la
// victime (`full_name`, `initials`, `timezone`, UUID). Fuite inter-tenant en un
// clic. Aggravant : la victime ne peut pas se retirer elle-même,
// `client_members_delete` exigeant d'être membre de l'org de l'ATTAQUANT.
//
// POURQUOI LE CORRECTIF P7-1 NE LE VOYAIT PAS
// -------------------------------------------
// Son invariant — « une adhésion n'est créée QUE si la requête porte déjà une
// session dont l'email est EXACTEMENT celui de l'invitation » — est
// LITTÉRALEMENT satisfait ici : c'est la session de la victime qui le satisfait.
// Le correctif prouve la POSSESSION de l'adresse ; il ne prouve jamais
// l'INTENTION de rejoindre. Ce module apporte la seconde moitié.
//
// LA RÈGLE
// --------
// Fail-closed : on exige une preuve POSITIVE que la requête vient de nos pages.
// L'absence des deux en-têtes est un refus, pas un laissez-passer — c'est
// exactement la posture inverse d'une allowlist qui laisse passer l'inconnu.

/** En-têtes dont dépend la décision. `null` = en-tête absent. */
export type OriginHeaders = {
  /** `Origin` — posé par tout navigateur sur une requête non-GET. */
  origin: string | null
  /** `Sec-Fetch-Site` — posé par tous les navigateurs à support Fetch Metadata. */
  secFetchSite: string | null
}

export type OriginVerdict =
  | { ok: true }
  /** `raison` est destinée aux logs, jamais à l'utilisateur. */
  | { ok: false; raison: "origin_mismatch" | "cross_site" | "no_proof" }

/**
 * La requête vient-elle de nos propres pages ?
 *
 * Fonction PURE : elle ne lit aucun contexte de requête, donc elle est testable
 * sans monter de serveur — c'est précisément ce qui manquait à la suite livrée,
 * où aucun Route Handler n'était atteignable par les tests.
 *
 * @param attendue origine publique de l'app, comparée octet pour octet.
 */
export function verifierOrigine(h: OriginHeaders, attendue: string): OriginVerdict {
  // Fetch Metadata d'abord : c'est l'en-tête que le navigateur calcule
  // lui-même, et qu'une page tierce ne peut pas falsifier.
  //
  // On refuse `cross-site` ET `same-site` (un sous-domaine compromis reste un
  // attaquant), ET `none` : `none` désigne une navigation initiée par
  // l'utilisateur hors page — signet, URL tapée — ce qui pour une ÉCRITURE ne
  // correspond à aucun usage légitime de cette app.
  if (h.secFetchSite !== null && h.secFetchSite !== "same-origin") {
    return { ok: false, raison: "cross_site" }
  }

  if (h.origin !== null) {
    // Comparaison d'ORIGINES normalisées, jamais de chaînes : `startsWith`
    // laisserait passer `https://app.evil.tld` pour `https://app`.
    let recue: string
    try {
      recue = new URL(h.origin).origin
    } catch {
      return { ok: false, raison: "origin_mismatch" }
    }
    if (recue !== attendue) return { ok: false, raison: "origin_mismatch" }
    return { ok: true }
  }

  // Ni `Origin`, ni `Sec-Fetch-Site` : aucune preuve. Un navigateur pose
  // toujours `Origin` sur une soumission de formulaire ; ce cas est donc soit
  // un client non-navigateur, soit une tentative de contournement.
  if (h.secFetchSite === "same-origin") return { ok: true }
  return { ok: false, raison: "no_proof" }
}
