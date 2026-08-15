"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { safeNext } from "@/lib/auth/safe-next"
import { slugCandidates } from "@/lib/auth/slug"
import { siteOrigin } from "@/lib/site-url"
import { createClient } from "@/lib/supabase/server"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Origine publique de l'app (redirect des emails de confirmation et de
// réinitialisation) : SITE_URL au runtime, sinon les en-têtes du proxy.
// L'ancienne implémentation lisait NEXT_PUBLIC_SITE_URL, que Next inline au
// build : dans le bundle compilé, cette fonction était littéralement
// `return "http://localhost:3000".replace(...)`.

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1).max(120),
})

export type AuthResult = { error: string } | undefined

/** Connexion par mot de passe (décision : password only, pas d'OTP). */
export async function signInWithPassword(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: "invalid_credentials_format" }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: "invalid_credentials" }

  // `startsWith("/")` laissait passer `//evil.tld` — redirection hors domaine
  // depuis une origine authentique, juste après la saisie du mot de passe (P7-8).
  // Sans `next` explicite, c'est le point unique de P7-5 qui tranche : un
  // reviewer n'a rien à faire sur /dashboard.
  revalidatePath("/", "layout")
  redirect(safeNext(formData.get("next"), "/auth/landing"))
}

/**
 * Inscription : crée le compte, puis l'organisation via la RPC create_organization
 * (owner). Si la confirmation d'email est activée sans SMTP, le compte reste en
 * attente — l'org sera amorcée à la première connexion confirmée.
 */
export async function signUpWithPassword(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  })
  if (!parsed.success) return { error: "invalid_signup_format" }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  })
  if (error) return { error: "signup_failed" }

  // Session immédiate (confirmation désactivée) : amorcer l'org. En cas d'échec
  // on ne bloque PAS l'inscription — le compte existe, il est simplement sans
  // organisation, et `/onboarding` (P7-3) le prend en charge. C'est exactement
  // ce que l'ancien code croyait faire, sauf qu'il redirigeait vers /dashboard
  // et que /onboarding n'existait pas : 404 au bout d'une inscription réussie.
  if (data.session) {
    await createOrganizationFor(supabase, parsed.data.fullName)
    revalidatePath("/", "layout")
    redirect("/auth/landing")
  }

  // Confirmation d'email requise.
  redirect("/login?pending=1")
}

/** Code d'erreur Postgres d'une violation de contrainte unique. */
const UNIQUE_VIOLATION = "23505"

/**
 * Crée l'organisation de l'utilisateur courant en absorbant les collisions de
 * slug (P7-4).
 *
 * L'ancien appel jetait le retour de la RPC : deux « Marie Dupont » produisaient
 * le même slug, la seconde recevait un 23505 silencieux et se retrouvait avec un
 * compte sans organisation. On essaie donc les candidats successifs, et on ne
 * retente QUE sur une collision — toute autre erreur est réelle et doit remonter.
 */
async function createOrganizationFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nom: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const slug of slugCandidates(nom)) {
    const { error } = await supabase.rpc("create_organization", { _name: nom, _slug: slug })
    if (!error) return { ok: true }
    if (error.code !== UNIQUE_VIOLATION) return { ok: false, error: "org_creation_failed" }
  }
  // Tous les candidats pris : très improbable, mais on le dit au lieu de
  // prétendre que tout va bien.
  return { ok: false, error: "org_slug_exhausted" }
}

const orgSchema = z.object({ name: z.string().trim().min(1).max(120) })

/**
 * Crée l'organisation depuis `/onboarding` (compte déjà authentifié, sans org).
 */
export async function createOrganization(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const parsed = orgSchema.safeParse({ name: formData.get("name") })
  if (!parsed.success) return { error: "invalid_org_name" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "no_session" }

  const result = await createOrganizationFor(supabase, parsed.data.name)
  if (!result.ok) return { error: result.error }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

const resetRequestSchema = z.object({ email: z.string().email() })

/**
 * Demande un email de réinitialisation de mot de passe. Le lien pointe vers
 * /auth/callback qui établit une session de récupération puis redirige vers
 * /reset-password. Anti-énumération : on renvoie TOUJOURS un succès générique
 * (on ne révèle jamais si l'adresse a un compte). L'envoi effectif dépend du
 * SMTP configuré côté Supabase (Brevo — Tier D ; le service par défaut Supabase
 * fonctionne en attendant, quota limité).
 */
export async function requestPasswordReset(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { error: "invalid_email" }

  const supabase = await createClient()
  const origin = await siteOrigin()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })
  // Succès générique quoi qu'il arrive (pas de fuite d'existence de compte).
  return undefined
}

const newPasswordSchema = z.object({ password: z.string().min(8) })

/**
 * Fixe un nouveau mot de passe. Exige une session active (session de
 * récupération établie par /auth/callback, ou utilisateur déjà connecté).
 */
export async function updatePassword(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password") })
  if (!parsed.success) return { error: "weak_password" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "no_session" }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: "update_failed" }

  // Un reviewer qui vient de definir son mot de passe n a rien a faire sur
  // /dashboard : le point unique de P7-5 tranche a sa place. `next` permet de
  // revenir a l invitation en cours.
  revalidatePath("/", "layout")
  redirect(safeNext(formData.get("next"), "/auth/landing"))
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
