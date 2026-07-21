"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

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

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
