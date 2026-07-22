"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

/** Origine publique de l'app (redirect d'email). Env prioritaire, sinon en-têtes. */
async function siteOrigin(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, "")
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1).max(120),
})

export type AuthResult = { error: string } | undefined

/** Connexion par mot de passe (décision : password only, pas d'OTP). */
export async function signInWithPassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: "invalid_credentials_format" }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: "invalid_credentials" }

  const next = formData.get("next")
  const target = typeof next === "string" && next.startsWith("/") ? next : "/dashboard"
  revalidatePath("/", "layout")
  redirect(target)
}

/**
 * Inscription : crée le compte, puis l'organisation via la RPC create_organization
 * (owner). Si la confirmation d'email est activée sans SMTP, le compte reste en
 * attente — l'org sera amorcée à la première connexion confirmée.
 */
export async function signUpWithPassword(
  _prev: AuthResult,
  formData: FormData,
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

  // Session immédiate (confirmation désactivée) : amorcer l'org.
  if (data.session) {
    const slug = parsed.data.fullName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "mon-organisation"
    await supabase.rpc("create_organization", {
      _name: parsed.data.fullName,
      _slug: slug,
    })
    revalidatePath("/", "layout")
    redirect("/dashboard")
  }

  // Confirmation d'email requise.
  redirect("/login?pending=1")
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
  formData: FormData,
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
export async function updatePassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password") })
  if (!parsed.success) return { error: "weak_password" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "no_session" }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: "update_failed" }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
