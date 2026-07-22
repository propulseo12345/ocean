import { createHash } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

// Acceptation d'une invitation reviewer (D8/D9). Route PUBLIQUE (préfixe
// /api/invitations du proxy) : le reviewer n'a pas encore de session. Le TOKEN
// (256 bits, usage unique, hashé en base) fait autorité.
//
// Flux (service_role, jamais côté client) :
//   1. valider client_invitations par token_hash (non acceptée, non révoquée, non expirée)
//   2. trouver/créer l'utilisateur auth par email (le trigger handle_new_user crée profiles)
//   3. adhésion client_members (idempotent) + marquer l'invitation acceptée
//   4. connexion sans mot de passe : admin.generateLink(magiclink) → redirection
//      directe vers le lien d'action Supabase (aucun email requis) → /portal
//
// SCAFFOLDING Tier D : fonctionnel dès que SUPABASE_SERVICE_ROLE_KEY est présent
// (déjà en runtime). Sans lui, createAdminClient échoue et on renvoie vers /login.

function fail(origin: string): NextResponse {
  return NextResponse.redirect(`${origin}/login?error=invite`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) return fail(origin)

  const tokenHash = createHash("sha256").update(token).digest("hex")

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return fail(origin)
  }

  // 1. Invitation valide ?
  const { data: invite } = await admin
    .from("client_invitations")
    .select("id, org_id, client_id, email, role, accepted_at, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()
  if (
    !invite ||
    invite.accepted_at ||
    invite.revoked_at ||
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    return fail(origin)
  }

  // 2. Utilisateur reviewer (créer si absent ; le trigger amorce profiles).
  let userId: string | null = null
  const created = await admin.auth.admin.createUser({
    email: invite.email,
    email_confirm: true,
  })
  if (created.data.user) {
    userId = created.data.user.id
  } else {
    // Existe déjà : le retrouver (pas de filtre email direct dans l'API admin).
    const { data: list } = await admin.auth.admin.listUsers()
    userId =
      list?.users.find((u) => u.email?.toLowerCase() === invite.email.toLowerCase())?.id ?? null
  }
  if (!userId) return fail(origin)

  // 3. Adhésion (idempotent) + invitation marquée acceptée.
  const { error: memberError } = await admin.from("client_members").upsert(
    {
      org_id: invite.org_id,
      client_id: invite.client_id,
      user_id: userId,
      role: invite.role,
    },
    { onConflict: "client_id,user_id" }
  )
  if (memberError) return fail(origin)

  await admin
    .from("client_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: userId,
    })
    .eq("id", invite.id)

  // 4. Connexion sans mot de passe : lien d'action magiclink (non envoyé par
  //    email — on redirige directement dessus), retour vers le portail.
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: invite.email,
    options: { redirectTo: `${origin}/portal` },
  })
  const actionLink = link?.properties?.action_link
  if (actionLink) return NextResponse.redirect(actionLink)

  // Repli : pas de lien (SMTP/redirect non configuré) → login manuel vers portail.
  return NextResponse.redirect(`${origin}/login?next=/portal`)
}
