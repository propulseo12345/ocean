import { type NextRequest, NextResponse } from "next/server"

import { type AcceptDeps, acceptInvitation, type InvitationRecord } from "@/lib/invitations/accept"
import { routes } from "@/lib/routes"
import { siteOrigin } from "@/lib/site-url"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// Acceptation d'une invitation reviewer. Route PUBLIQUE (préfixe /api/invitations
// du proxy) : l'invité n'a pas forcément encore de session.
//
// ⚠️ Ce handler ne décide RIEN — toute la logique de sécurité vit dans
// `lib/invitations/accept.ts`, qui est testée (ticket P7-1 : prise de contrôle de
// compte). Ici on ne fait que câbler les dépendances et traduire l'issue en
// réponse HTTP. En particulier, et c'est le correctif : **aucun appel à
// `admin.auth.admin.generateLink`, et aucune redirection vers un lien d'action
// Supabase**. C'était la primitive de la faille — présenter un jeton suffisait à
// obtenir la session de l'adresse invitée.

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token")
  const origin = await siteOrigin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.redirect(`${origin}/login?error=invite`)
  }
  const supabase = await createClient()

  const deps: AcceptDeps = {
    async findInvitation(tokenHash) {
      const { data } = await admin
        .from("client_invitations")
        .select("id, org_id, client_id, email, role, accepted_at, revoked_at, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle()
      return (data as InvitationRecord | null) ?? null
    },

    // L'identité vient de la SESSION de la requête, jamais de l'invitation.
    async currentIdentity() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) return null
      return { userId: user.id, email: user.email }
    },

    async bindMembership(invitation, userId) {
      const { error } = await admin.from("client_members").upsert(
        {
          org_id: invitation.org_id,
          client_id: invitation.client_id,
          user_id: userId,
          role: invitation.role as "reviewer" | "editor",
        },
        { onConflict: "client_id,user_id" }
      )
      if (error) return false

      // Le jeton n'est consommé qu'ICI : une fois l'adhésion réellement créée.
      // L'ancienne route le brûlait avant même qu'une session existe, rendant
      // l'invitation non rejouable pour son destinataire légitime (P7-2).
      await admin
        .from("client_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_user_id: userId,
        })
        .eq("id", invitation.id)
      return true
    },

    /**
     * Le secret part vers la BOÎTE AUX LETTRES de l'invité — jamais vers
     * l'appelant. C'est la preuve de possession de l'adresse, et c'est ce qui
     * remplace le `generateLink` renvoyé au navigateur.
     *
     * COMMENT LA SESSION S'OUVRE RÉELLEMENT (V-2)
     * -------------------------------------------
     * Les deux branches étaient des culs-de-sac. `redirectTo` n'est PAS l'URL du
     * lien cliqué : c'est la destination FINALE, transmise au gabarit d'e-mail
     * par `{{ .RedirectTo }}`. C'est le gabarit qui décide comment la session
     * s'ouvre, et il doit pointer sur notre callback avec un `token_hash` :
     *
     *   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}
     *                               &type=invite&next={{ .RedirectTo }}
     *
     * `/auth/callback` fait alors `verifyOtp` — côté serveur, sur les cookies de
     * CE navigateur — puis redirige vers `next`. Sans ce gabarit, GoTrue
     * redirige lui-même vers `redirectTo` en déposant les jetons dans le
     * FRAGMENT (flux implicite : une invitation admin n'ouvre aucun `flow_state`
     * PKCE) ; or aucun client navigateur n'est monté dans cette app
     * (`lib/supabase/client.ts` n'a aucun importeur), donc `detectSessionInUrl`
     * ne tourne jamais et le fragment n'est lu par personne. Aucune session
     * n'était posée, la route reconcluait `proof_required` et renvoyait un
     * e-mail : boucle infinie.
     *
     * ⚠️ Le réglage des gabarits est du tableau de bord Supabase, pas du code.
     * Voir `deploy/GABARITS-EMAIL-supabase.md`.
     */
    async sendProofOfPossession(email) {
      // Destination finale commune : la page de confirmation, où l'invité voit
      // ce qu'il rejoint et le confirme explicitement.
      const destination = `${origin}${routes.acceptInvite(token ?? "")}`

      const invited = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: destination,
      })
      if (!invited.error) return true

      // Compte déjà existant : Supabase refuse l'invitation. On envoie alors un
      // lien de définition de mot de passe — même canal, même preuve. Le
      // passage par /auth/callback n'est plus encodé ici : c'est le gabarit
      // `recovery` qui s'en charge, exactement comme pour l'invitation. On
      // encode donc `next` UNE SEULE FOIS.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password?next=${encodeURIComponent(
          routes.acceptInvite(token ?? "")
        )}`,
      })
      return !error
    },

    now: () => Date.now(),
  }

  const outcome = await acceptInvitation(token, deps)

  switch (outcome.kind) {
    case "accepted":
      return NextResponse.redirect(`${origin}/portal`)

    // Le secret est parti par email. On ne dit PAS si le compte existait : la
    // page est la même dans les deux cas.
    case "proof_required":
      return NextResponse.redirect(`${origin}/login?invite=sent`)

    // Session ouverte sur une autre adresse : l'utilisateur doit se déconnecter.
    // Surtout pas de bascule automatique — ce serait rouvrir la faille.
    case "wrong_account":
      return NextResponse.redirect(`${origin}/login?error=invite_other_account`)

    default:
      return NextResponse.redirect(`${origin}/login?error=invite`)
  }
}
