import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { test } from "node:test"

import {
  type AcceptDeps,
  acceptInvitation,
  hashInvitationToken,
  type InvitationRecord,
} from "./accept"

// Ticket P7-1 — prise de contrôle de compte sur /api/invitations/accept.
//
// Ce que ces tests prouvent : le jeton d'invitation ne suffit JAMAIS à créer une
// adhésion, et RIEN dans ce flux ne fabrique de session. Le scénario d'attaque
// réel tenait en trois gestes, tous à la portée d'un compte quelconque :
//   1. `create_organization` (accordée à `authenticated`) + un client ;
//   2. `inviteReviewer({ email: "victime@…" })` — qui RETOURNE le jeton en clair ;
//   3. ouvrir /api/invitations/accept?token=… dans son propre navigateur.
// L'ancienne route retrouvait alors le compte de la victime PAR EMAIL et
// redirigeait vers un `generateLink` : session de la victime, chez l'attaquant.

const VICTIME = "owner@victime.tld"
const ATTAQUANT = "attaquant@jetable.tld"

function invitationPour(email: string, overrides: Partial<InvitationRecord> = {}) {
  const token = randomBytes(32).toString("base64url")
  const invitation: InvitationRecord = {
    id: "inv-1",
    org_id: "org-attaquant",
    client_id: "client-attaquant",
    email,
    role: "reviewer",
    accepted_at: null,
    revoked_at: null,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  }
  return { token, invitation }
}

type Identity = { userId: string; email: string } | null

/**
 * Dépendances instrumentées : on observe tout ce que la décision TENTE de faire.
 * La base ne connaît que le hash — `findInvitation` ne répond donc qu'au hash du
 * vrai jeton, exactement comme l'index unique `client_invitations_token_idx`.
 */
function harnais(invitation: InvitationRecord | null, jeton: string, identity: Identity) {
  const journal = {
    adhesionsCreees: [] as Array<{ clientId: string; userId: string }>,
    emailsEnvoyes: [] as string[],
  }
  const deps: AcceptDeps = {
    findInvitation: async (hash) =>
      invitation && hash === hashInvitationToken(jeton) ? invitation : null,
    currentIdentity: async () => identity,
    bindMembership: async (inv, userId) => {
      journal.adhesionsCreees.push({ clientId: inv.client_id, userId })
      return true
    },
    sendProofOfPossession: async (email) => {
      journal.emailsEnvoyes.push(email)
      return true
    },
    now: () => Date.now(),
  }
  return { journal, deps }
}

test("ATO : jeton valide SANS session => aucune adhesion, aucune session, le secret part vers la boite de l invite", async () => {
  const { token, invitation } = invitationPour(VICTIME)
  const h = harnais(invitation, token, null)

  const outcome = await acceptInvitation(token, h.deps)

  // Le coeur de la faille : l'attaquant ne doit RIEN obtenir.
  assert.equal(outcome.kind, "proof_required")
  assert.deepEqual(h.journal.adhesionsCreees, [], "aucune adhesion ne doit etre creee sans session")

  // Le secret part vers la victime, jamais vers l'appelant.
  assert.deepEqual(h.journal.emailsEnvoyes, [VICTIME])

  // Et surtout : l'issue ne peut PAS transporter de lien de session. Si un jour
  // quelqu'un rajoute un `action_link` / `redirect` a AcceptOutcome, ce test
  // tombe — c'est exactement la primitive de la faille.
  assert.ok(
    !("actionLink" in outcome) && !("redirect" in outcome) && !("session" in outcome),
    "AcceptOutcome ne doit jamais transporter de lien ou de session"
  )
})

test("ATO : jeton valide avec la session de L ATTAQUANT => refus, rien n est lie", async () => {
  const { token, invitation } = invitationPour(VICTIME)
  const h = harnais(invitation, token, { userId: "user-attaquant", email: ATTAQUANT })

  const outcome = await acceptInvitation(token, h.deps)

  assert.equal(outcome.kind, "wrong_account")
  assert.deepEqual(
    h.journal.adhesionsCreees,
    [],
    "une session pour une AUTRE adresse ne doit jamais lier l adhesion"
  )
  assert.deepEqual(
    h.journal.emailsEnvoyes,
    [],
    "aucun email : la session existe, elle est juste mauvaise"
  )
})

test("le destinataire authentifie sur SON adresse obtient l adhesion", async () => {
  const { token, invitation } = invitationPour(VICTIME)
  const h = harnais(invitation, token, { userId: "user-victime", email: VICTIME })

  const outcome = await acceptInvitation(token, h.deps)

  assert.equal(outcome.kind, "accepted")
  assert.deepEqual(h.journal.adhesionsCreees, [
    { clientId: "client-attaquant", userId: "user-victime" },
  ])
})

test("la comparaison d adresses ignore casse et espaces (et rien d autre)", async () => {
  const { token, invitation } = invitationPour(VICTIME)
  const h = harnais(invitation, token, {
    userId: "user-victime",
    email: `  ${VICTIME.toUpperCase()} `,
  })

  assert.equal((await acceptInvitation(token, h.deps)).kind, "accepted")

  // Une adresse qui CONTIENT celle de l'invite ne doit pas passer.
  const h2 = harnais(invitation, token, { userId: "u", email: `x${VICTIME}` })
  assert.equal((await acceptInvitation(token, h2.deps)).kind, "wrong_account")
})

test("jeton absent, inconnu, expire, revoque ou deja consomme => invalid_token, indistinctement", async () => {
  const { token, invitation } = invitationPour(VICTIME)
  const identite = { userId: "user-victime", email: VICTIME }

  const vide = harnais(invitation, token, identite)
  assert.equal((await acceptInvitation(null, vide.deps)).kind, "invalid_token")
  assert.deepEqual(vide.journal.adhesionsCreees, [])

  const inconnu = harnais(invitation, token, identite)
  assert.equal(
    (await acceptInvitation("jeton-qui-n-existe-pas", inconnu.deps)).kind,
    "invalid_token"
  )

  for (const [nom, patch] of [
    ["expire", { expires_at: new Date(Date.now() - 1000).toISOString() }],
    ["revoque", { revoked_at: new Date().toISOString() }],
    ["deja accepte", { accepted_at: new Date().toISOString() }],
  ] as const) {
    const { token: t, invitation: inv } = invitationPour(VICTIME, patch)
    const h = harnais(inv, t, identite)
    const outcome = await acceptInvitation(t, h.deps)
    assert.equal(outcome.kind, "invalid_token", `invitation ${nom}`)
    assert.deepEqual(h.journal.adhesionsCreees, [], `invitation ${nom} : rien ne doit etre lie`)
  }
})

test("un jeton non consomme reste rejouable tant qu aucune session ne l a accepte (P7-2)", async () => {
  const { token, invitation } = invitationPour(VICTIME)

  // Premier passage sans session : le jeton ne doit PAS etre brule.
  const sansSession = harnais(invitation, token, null)
  assert.equal((await acceptInvitation(token, sansSession.deps)).kind, "proof_required")

  // L'invite revient, cette fois authentifie : le meme jeton doit encore marcher.
  const avecSession = harnais(invitation, token, { userId: "user-victime", email: VICTIME })
  assert.equal((await acceptInvitation(token, avecSession.deps)).kind, "accepted")
})
