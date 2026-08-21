import type { Metadata } from "next"
import Link from "next/link"

import { signOut } from "@/app/(auth)/actions"
import { InvitationConfirm } from "@/components/auth/invitation-confirm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getT } from "@/lib/i18n/server"
import { decrireInvitation, identiteCourante } from "@/lib/invitations/deps"
import { routes } from "@/lib/routes"

// Page de confirmation d'une invitation reviewer (ticket V-3).
//
// ⚠️ CETTE PAGE EST UN GET, ET UN GET N'ÉCRIT RIEN.
//
// C'est tout l'objet du correctif. L'acceptation vivait dans un GET à effet de
// bord : il créait l'adhésion et envoyait des e-mails. Deux conséquences, toutes
// deux exploitées :
//
//   * CSRF — une navigation top-level depuis un site tiers emportait les cookies
//     `SameSite=Lax` de la victime et créait une adhésion dans le client de
//     l'attaquant, avec à la clé la lecture de la ligne `profiles` de la victime
//     via `profiles_select_shared`. Fuite inter-tenant en un clic.
//   * Émetteur d'e-mails non authentifié — chaque rejeu du lien déclenchait un
//     envoi (invitation, puis réinitialisation de mot de passe) vers une adresse
//     choisie par l'attaquant, sans compteur ni plafond.
//
// Ici on se contente de DÉCRIRE l'invitation et de proposer un bouton. Toute
// écriture passe par la Server Action, en POST, avec vérification d'origine.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t("auth.invitation.metaTitle"),
    // Un lien d'invitation porte un secret : il n'a rien à faire dans un index.
    robots: { index: false, follow: false },
  }
}

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const t = await getT()
  const token = (await searchParams).token ?? null

  const apercu = await decrireInvitation(token)

  // Refus indistinct : on ne dit jamais CE QUI a échoué (inconnue ? révoquée ?
  // expirée ? déjà consommée ?), sous peine d'en faire un oracle.
  if (apercu.etat === "invalide" || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("auth.invitation.invalidTitle")}</CardTitle>
          <CardDescription>{t("auth.invitation.invalidDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" render={<Link href={routes.login} />}>
            {t("auth.invitation.backToLogin")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const identite = await identiteCourante()
  const memeAdresse =
    identite !== null && identite.email.trim().toLowerCase() === apercu.email.trim().toLowerCase()

  // Session ouverte sur une AUTRE adresse. Aucune bascule de compte n'est
  // proposée : ce serait rouvrir la faille P7-1 par la porte de l'ergonomie.
  if (identite && !memeAdresse) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("auth.invitation.wrongAccountTitle")}</CardTitle>
          <CardDescription>
            {t("auth.invitation.wrongAccountDescription", { courant: identite.email })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Un simple lien vers /login ne suffirait pas : le proxy intercepte
              /login dès qu'une session existe et renvoie sur /auth/landing.
              Il faut réellement fermer la session. */}
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              {t("auth.invitation.signOut")}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  const mode = memeAdresse ? "join" : "proof"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {mode === "join"
            ? t("auth.invitation.joinTitle", { client: apercu.clientNom })
            : t("auth.invitation.proofTitle")}
        </CardTitle>
        <CardDescription>
          {mode === "join"
            ? t("auth.invitation.joinDescription", { client: apercu.clientNom })
            : t("auth.invitation.proofDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InvitationConfirm token={token} mode={mode} clientNom={apercu.clientNom} />
      </CardContent>
    </Card>
  )
}
