import { createHash } from "node:crypto"

// Acceptation d'une invitation reviewer — LOGIQUE DE DÉCISION (ticket P7-1).
//
// LA FAILLE QUE CE MODULE FERME
// -----------------------------
// L'ancienne route résolvait le compte destinataire PAR EMAIL, puis redirigeait
// le navigateur appelant vers un `admin.generateLink({type:'magiclink'})`. Elle
// fabriquait donc une session pour l'adresse écrite dans l'invitation, au profit
// de QUICONQUE présentait le jeton. Or le jeton n'est pas détenu par
// l'invité : `inviteReviewer` (collaboration.ts:379) le rend EN CLAIR à son
// appelant, et `create_organization` est accordée à tout `authenticated`
// (confirmé par get_advisors). Le chemin complet tenait en trois gestes :
// créer une org, inviter `owner@victime`, ouvrir le lien d'acceptation — et on
// obtenait la session de la victime. Prise de contrôle de compte, sur une
// application déployée.
//
// LA DÉCISION DE CONCEPTION
// -------------------------
// Un jeton d'invitation dit QUEL client rejoindre. Il ne dit RIEN sur QUI le
// présente. Ces deux faits sont distincts et doivent être prouvés séparément :
//
//   * le jeton prouve « cette invitation existe et vise cette adresse » ;
//   * seule une SESSION prouve « je suis cette adresse ».
//
// D'où l'invariant, qui est la propriété de sécurité testée :
//
//   >  Une adhésion n'est créée QUE si la requête porte déjà une session dont
//   >  l'email est EXACTEMENT celui de l'invitation. Aucun autre chemin ne
//   >  crée d'adhésion, et AUCUN chemin ne fabrique de session.
//
// La preuve de possession de l'adresse n'est donc plus déduite du jeton : elle
// vient d'un secret livré à la BOÎTE AUX LETTRES (lien d'invitation ou de
// définition de mot de passe envoyé par Supabase), ou du mot de passe de la
// personne. Ce module ne peut structurellement plus émettre de lien de session :
// `AcceptOutcome` n'a aucun membre qui le permette, et `AcceptDeps` n'expose
// aucune capacité de ce type. La primitive de la faille est absente du type.
//
// Effet de bord voulu (ticket P7-2) : le jeton n'est plus BRÛLÉ avant que la
// session existe. L'ancienne route marquait l'invitation `accepted` puis
// redirigeait vers un lien qui déposait ses jetons dans le FRAGMENT de l'URL,
// que rien côté serveur ne lit — l'invitation était donc consommée sans qu'une
// session soit jamais ouverte, et elle n'était pas rejouable.

/** Ligne `client_invitations`, réduite aux colonnes dont la décision dépend. */
export type InvitationRecord = {
  id: string
  org_id: string
  client_id: string
  email: string
  role: string
  accepted_at: string | null
  revoked_at: string | null
  expires_at: string
}

/** Identité prouvée par la requête courante. `null` = aucune session. */
export type SessionIdentity = { userId: string; email: string }

export type AcceptOutcome =
  /** Jeton absent, inconnu, révoqué, expiré ou déjà consommé. Réponse unique et
   *  volontairement indistincte : ne jamais dire à l'appelant CE QUI a échoué. */
  | { kind: "invalid_token" }
  /** Aucune session : le secret part vers la boîte de l'invité. Rien n'est lié,
   *  le jeton reste valide. `delivered` ne fuit pas l'existence du compte. */
  | { kind: "proof_required"; email: string; delivered: boolean }
  /** Session présente mais pour une AUTRE adresse : refus net. Rien n'est lié. */
  | { kind: "wrong_account"; invited: string; current: string }
  /** Preuve établie : adhésion créée, invitation consommée. */
  | { kind: "accepted"; clientId: string }
  /** Dépendance indisponible (service role absent, écriture refusée). */
  | { kind: "unavailable" }

export type AcceptDeps = {
  /** Recherche par HASH — le jeton en clair ne touche jamais la base. */
  findInvitation(tokenHash: string): Promise<InvitationRecord | null>
  /** Identité de la requête courante, lue depuis les cookies de session. */
  currentIdentity(): Promise<SessionIdentity | null>
  /** Crée l'adhésion (idempotent) puis consomme l'invitation. `false` = échec. */
  bindMembership(invitation: InvitationRecord, userId: string): Promise<boolean>
  /**
   * Envoie à l'ADRESSE INVITÉE de quoi ouvrir une session (lien d'invitation
   * Supabase, ou définition de mot de passe si le compte existe déjà). Le secret
   * part vers la boîte aux lettres — il n'est JAMAIS rendu à l'appelant. C'est
   * précisément ce qui distingue ce flux de la faille.
   */
  sendProofOfPossession(email: string): Promise<boolean>
  /** Injectée pour rendre l'expiration testable. */
  now(): number
}

/** Comparaison d'adresses : la casse ne fait pas l'identité, les espaces non plus. */
function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function isUsable(invitation: InvitationRecord, now: number): boolean {
  if (invitation.accepted_at || invitation.revoked_at) return false
  const expiry = new Date(invitation.expires_at).getTime()
  return Number.isFinite(expiry) && expiry >= now
}

/**
 * Décide du sort d'une acceptation d'invitation.
 *
 * Aucune branche ne résout un compte par email, et aucune ne produit de lien de
 * session : c'est la faille P7-1 et elle est retirée, pas contournée.
 */
export async function acceptInvitation(
  token: string | null | undefined,
  deps: AcceptDeps
): Promise<AcceptOutcome> {
  if (!token) return { kind: "invalid_token" }

  const invitation = await deps.findInvitation(hashInvitationToken(token))
  if (!invitation || !isUsable(invitation, deps.now())) {
    return { kind: "invalid_token" }
  }

  const identity = await deps.currentIdentity()

  // Pas de session : on ne sait pas qui demande. Le seul geste sûr est
  // d'envoyer de quoi se connecter à l'adresse INVITÉE. L'appelant qui n'a pas
  // accès à cette boîte n'obtient rien — ni session, ni adhésion, ni
  // confirmation que le compte existe.
  if (!identity) {
    const delivered = await deps.sendProofOfPossession(invitation.email)
    return { kind: "proof_required", email: invitation.email, delivered }
  }

  // Session pour une autre adresse : refus. Lier ici rattacherait la victime au
  // client de l'attaquant — ou l'attaquant au client d'un tiers.
  if (!sameAddress(identity.email, invitation.email)) {
    return { kind: "wrong_account", invited: invitation.email, current: identity.email }
  }

  // Ici, et ici seulement : la personne a prouvé qu'elle contrôle l'adresse
  // (elle est authentifiée dessus) ET détient le jeton.
  const bound = await deps.bindMembership(invitation, identity.userId)
  if (!bound) return { kind: "unavailable" }

  return { kind: "accepted", clientId: invitation.client_id }
}
