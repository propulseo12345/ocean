import { findBannedWords, getCaptionStats, getHashtagStats, IG_TRUNCATE_AT } from "@/lib/caption"
import { formatDateTime } from "@/lib/format"
import { platformMeta } from "@/lib/mocks/labels"
import { MOCK_NOW } from "@/lib/mocks/time"
import type { Client, Platform, SocialAccount } from "@/lib/mocks/types"
import { type SpecIssue, validateCarousel, validateMedia } from "@/lib/specs"
import type { ComposerDraft } from "./composer-types"
import { effectiveCaption, MIN_LEAD_MS, targetedApiPlatforms } from "./composer-utils"

// Pré-flight de programmation : checklist verte / orange / rouge calculée en
// continu sur le brouillon. Les erreurs bloquent (visuellement) le « Programmer ».

export type PreflightSeverity = "ok" | "warning" | "error"

export interface PreflightItem {
  id: string
  severity: PreflightSeverity
  label: string
  detail?: string
}

export interface PreflightInput {
  draft: ComposerDraft
  client: Client
  accounts: SocialAccount[]
  bannedWords: string[]
}

function worst(issues: SpecIssue[]): PreflightSeverity {
  if (issues.some((i) => i.severity === "error")) return "error"
  if (issues.length > 0) return "warning"
  return "ok"
}

function targetsItem(draft: ComposerDraft, accounts: SocialAccount[]): PreflightItem {
  const count = draft.accountIds.length + draft.manualPlatforms.length
  if (count === 0) {
    return {
      id: "targets",
      severity: "error",
      label: "Aucune plateforme ciblée",
      detail: "Active au moins un compte ou un canal manuel.",
    }
  }
  const targeted = accounts.filter((a) => draft.accountIds.includes(a.id))
  const names = [...targeted.map((a) => platformMeta[a.platform].label)]
  names.push(...draft.manualPlatforms.map((p) => platformMeta[p].label))
  const label = `${count} cible${count > 1 ? "s" : ""}`
  return { id: "targets", severity: "ok", label, detail: names.join(" · ") }
}

function accountsItem(draft: ComposerDraft, accounts: SocialAccount[]): PreflightItem | null {
  const targeted = accounts.filter((a) => draft.accountIds.includes(a.id))
  if (targeted.length === 0) return null
  const broken = targeted.filter((a) => a.status !== "connected")
  if (broken.length > 0) {
    return {
      id: "accounts",
      severity: "error",
      label: "Compte à reconnecter",
      detail: broken.map((a) => `${platformMeta[a.platform].label} @${a.username}`).join(" · "),
    }
  }
  return { id: "accounts", severity: "ok", label: "Comptes connectés" }
}

function mediaItem(draft: ComposerDraft, platforms: Platform[]): PreflightItem {
  const apiOnly = draft.accountIds.length > 0
  if (draft.media.length === 0) {
    if (!apiOnly) return { id: "media", severity: "ok", label: "Sans média (canal manuel)" }
    return {
      id: "media",
      severity: "error",
      label: "Aucun média",
      detail: "Ajoute au moins un visuel depuis la médiathèque.",
    }
  }

  const issues: SpecIssue[] = []
  for (const platform of platforms) {
    for (const media of draft.media) {
      issues.push(...validateMedia(media, platform, draft.format))
    }
  }
  if (draft.format === "carousel") issues.push(...validateCarousel(draft.media.length))

  const severity = worst(issues)
  const errors = issues.filter((i) => i.severity === "error").length
  const warnings = issues.length - errors
  if (severity === "ok") {
    return { id: "media", severity, label: "Médias conformes aux specs" }
  }
  const parts: string[] = []
  if (errors > 0) parts.push(`${errors} bloquant${errors > 1 ? "s" : ""}`)
  if (warnings > 0) parts.push(`${warnings} avertissement${warnings > 1 ? "s" : ""}`)
  return {
    id: "media",
    severity,
    label: severity === "error" ? "Médias hors specs" : "Médias à vérifier",
    detail: `${parts.join(" · ")} — voir la section Médias.`,
  }
}

function captionItem(draft: ComposerDraft, platforms: Platform[]): PreflightItem {
  const over = platforms.filter((p) => getCaptionStats(effectiveCaption(draft, p), p).overLimit)
  if (over.length > 0) {
    return {
      id: "caption",
      severity: "error",
      label: "Légende trop longue",
      detail: over.map((p) => platformMeta[p].label).join(" · "),
    }
  }
  const igStats = platforms.includes("instagram")
    ? getCaptionStats(effectiveCaption(draft, "instagram"), "instagram")
    : null
  if (igStats?.truncatesInFeed) {
    return {
      id: "caption",
      severity: "warning",
      label: `Coupée après ${IG_TRUNCATE_AT} caractères sur Instagram`,
      detail: "Place le message clé avant le « … plus » (voir l'aperçu).",
    }
  }
  return { id: "caption", severity: "ok", label: "Légende dans les limites" }
}

function hashtagsItem(draft: ComposerDraft, platforms: Platform[]): PreflightItem | null {
  if (!platforms.includes("instagram")) return null
  const stats = getHashtagStats(effectiveCaption(draft, "instagram"), draft.firstComment)
  if (stats.overLimit) {
    return {
      id: "hashtags",
      severity: "error",
      label: `${stats.total} hashtags — Instagram en accepte 30`,
      detail: "Cumul légende + premier commentaire.",
    }
  }
  if (stats.duplicates.length > 0) {
    return {
      id: "hashtags",
      severity: "warning",
      label: "Hashtags en doublon",
      detail: stats.duplicates.join(" "),
    }
  }
  return { id: "hashtags", severity: "ok", label: `${stats.total}/30 hashtags Instagram` }
}

function bannedItem(input: PreflightInput, platforms: Platform[]): PreflightItem | null {
  if (input.bannedWords.length === 0) return null
  const texts = [
    input.draft.caption,
    ...platforms.map((p) => input.draft.captionOverrides[p] ?? ""),
    input.draft.firstComment,
  ]
  const hits = new Set(
    texts.flatMap((t) => findBannedWords(t, input.bannedWords)).map((h) => h.word)
  )
  if (hits.size > 0) {
    return {
      id: "banned",
      severity: "warning",
      label: "Mots à éviter (brand kit)",
      detail: [...hits].map((w) => `« ${w} »`).join(" · "),
    }
  }
  return { id: "banned", severity: "ok", label: "Aucun mot interdit détecté" }
}

function approvalItem(client: Client): PreflightItem {
  switch (client.approvalMode) {
    case "required":
      return {
        id: "approval",
        severity: "warning",
        label: "Validation client obligatoire",
        detail: "Envoie en revue avant la publication — ce client valide tout.",
      }
    case "optional":
      return { id: "approval", severity: "ok", label: "Validation client optionnelle" }
    default:
      return { id: "approval", severity: "ok", label: "Publication directe (sans validation)" }
  }
}

function dateItem(draft: ComposerDraft, client: Client): PreflightItem {
  if (!draft.scheduledAt) {
    return {
      id: "date",
      severity: "warning",
      label: "Aucune date de publication",
      detail: "Le contenu restera dans l'étagère « À planifier ».",
    }
  }
  const time = new Date(draft.scheduledAt).getTime()
  if (time < MOCK_NOW.getTime() + MIN_LEAD_MS) {
    return {
      id: "date",
      severity: "error",
      label: "Date dans le passé",
      detail: "Choisis « dès que possible » ou une date ≥ maintenant + 15 min.",
    }
  }
  return {
    id: "date",
    severity: "ok",
    label: `Programmé le ${formatDateTime(draft.scheduledAt, client.timezone)}`,
    detail: `Fuseau du client (${client.timezone}).`,
  }
}

function altTextItem(draft: ComposerDraft): PreflightItem | null {
  const images = draft.media.filter((m) => m.type === "image")
  if (images.length === 0) return null
  const missing = images.filter((m) => m.altText.trim().length === 0).length
  if (missing > 0) {
    return {
      id: "alt",
      severity: "warning",
      label: `Texte alternatif manquant (${missing} visuel${missing > 1 ? "s" : ""})`,
      detail: "Accessibilité + SEO social — envoyé si la plateforme le supporte.",
    }
  }
  return { id: "alt", severity: "ok", label: "Textes alternatifs renseignés" }
}

export function computePreflight(input: PreflightInput): PreflightItem[] {
  const platforms = targetedApiPlatforms(input.draft, input.accounts)
  const items: Array<PreflightItem | null> = [
    targetsItem(input.draft, input.accounts),
    accountsItem(input.draft, input.accounts),
    mediaItem(input.draft, platforms),
    captionItem(input.draft, platforms),
    hashtagsItem(input.draft, platforms),
    bannedItem(input, platforms),
    approvalItem(input.client),
    dateItem(input.draft, input.client),
    altTextItem(input.draft),
  ]
  return items.filter((i): i is PreflightItem => i !== null)
}

export function hasBlocking(items: PreflightItem[]): boolean {
  return items.some((i) => i.severity === "error")
}
