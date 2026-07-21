import { findBannedWords, getCaptionStats, getHashtagStats, IG_TRUNCATE_AT } from "@/lib/caption"
import { now } from "@/lib/clock"
import { formatDateTime } from "@/lib/format"
import { type Labels, type Locale, makeLabels, type Translator } from "@/lib/i18n"
import type { Client, Platform, SocialAccount } from "@/lib/mocks/types"
import { type SpecIssue, validateCarousel, validateMedia } from "@/lib/specs"
import type { ComposerDraft } from "./composer-types"
import { effectiveCaption, MIN_LEAD_MS, targetedApiPlatforms } from "./composer-utils"

// Pré-flight de programmation : checklist verte / orange / rouge calculée en
// continu sur le brouillon. Les erreurs bloquent (visuellement) le « Programmer ».
// Les libellés sont résolus via un Translator (bilingue FR/EN).

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
  /** Traducteur de la locale active. */
  t: Translator
  /** Locale active (formatage des dates). */
  locale: Locale
}

function worst(issues: SpecIssue[]): PreflightSeverity {
  if (issues.some((i) => i.severity === "error")) return "error"
  if (issues.length > 0) return "warning"
  return "ok"
}

function targetsItem(
  draft: ComposerDraft,
  accounts: SocialAccount[],
  t: Translator,
  lbl: Labels
): PreflightItem {
  const count = draft.accountIds.length + draft.manualPlatforms.length
  if (count === 0) {
    return {
      id: "targets",
      severity: "error",
      label: t("composer.preflight.targetsNone"),
      detail: t("composer.preflight.targetsNoneDetail"),
    }
  }
  const targeted = accounts.filter((a) => draft.accountIds.includes(a.id))
  const names = [...targeted.map((a) => lbl.platform(a.platform))]
  names.push(...draft.manualPlatforms.map((p) => lbl.platform(p)))
  return {
    id: "targets",
    severity: "ok",
    label: t("composer.preflight.targetsCount", { count }),
    detail: names.join(" · "),
  }
}

function accountsItem(
  draft: ComposerDraft,
  accounts: SocialAccount[],
  t: Translator,
  lbl: Labels
): PreflightItem | null {
  const targeted = accounts.filter((a) => draft.accountIds.includes(a.id))
  if (targeted.length === 0) return null
  const broken = targeted.filter((a) => a.status !== "connected")
  if (broken.length > 0) {
    return {
      id: "accounts",
      severity: "error",
      label: t("composer.preflight.accountsBroken"),
      detail: broken.map((a) => `${lbl.platform(a.platform)} @${a.username}`).join(" · "),
    }
  }
  return { id: "accounts", severity: "ok", label: t("composer.preflight.accountsOk") }
}

function mediaItem(draft: ComposerDraft, platforms: Platform[], t: Translator): PreflightItem {
  const apiOnly = draft.accountIds.length > 0
  if (draft.media.length === 0) {
    if (!apiOnly)
      return { id: "media", severity: "ok", label: t("composer.preflight.mediaNoneManual") }
    return {
      id: "media",
      severity: "error",
      label: t("composer.preflight.mediaNone"),
      detail: t("composer.preflight.mediaNoneDetail"),
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
    return { id: "media", severity, label: t("composer.preflight.mediaOk") }
  }
  const parts: string[] = []
  if (errors > 0) parts.push(t("composer.preflight.mediaErrors", { count: errors }))
  if (warnings > 0) parts.push(t("composer.preflight.mediaWarnings", { count: warnings }))
  return {
    id: "media",
    severity,
    label:
      severity === "error"
        ? t("composer.preflight.mediaOutOfSpec")
        : t("composer.preflight.mediaToCheck"),
    detail: t("composer.preflight.mediaIssuesDetail", { parts: parts.join(" · ") }),
  }
}

function captionItem(
  draft: ComposerDraft,
  platforms: Platform[],
  t: Translator,
  lbl: Labels
): PreflightItem {
  const over = platforms.filter((p) => getCaptionStats(effectiveCaption(draft, p), p).overLimit)
  if (over.length > 0) {
    return {
      id: "caption",
      severity: "error",
      label: t("composer.preflight.captionTooLong"),
      detail: over.map((p) => lbl.platform(p)).join(" · "),
    }
  }
  const igStats = platforms.includes("instagram")
    ? getCaptionStats(effectiveCaption(draft, "instagram"), "instagram")
    : null
  if (igStats?.truncatesInFeed) {
    return {
      id: "caption",
      severity: "warning",
      label: t("composer.preflight.captionTruncated", { count: IG_TRUNCATE_AT }),
      detail: t("composer.preflight.captionTruncatedDetail"),
    }
  }
  return { id: "caption", severity: "ok", label: t("composer.preflight.captionOk") }
}

function hashtagsItem(
  draft: ComposerDraft,
  platforms: Platform[],
  t: Translator
): PreflightItem | null {
  if (!platforms.includes("instagram")) return null
  const stats = getHashtagStats(effectiveCaption(draft, "instagram"), draft.firstComment)
  if (stats.overLimit) {
    return {
      id: "hashtags",
      severity: "error",
      label: t("composer.preflight.hashtagsOver", { total: stats.total }),
      detail: t("composer.preflight.hashtagsOverDetail"),
    }
  }
  if (stats.duplicates.length > 0) {
    return {
      id: "hashtags",
      severity: "warning",
      label: t("composer.preflight.hashtagsDup"),
      detail: stats.duplicates.join(" "),
    }
  }
  return {
    id: "hashtags",
    severity: "ok",
    label: t("composer.preflight.hashtagsOk", { total: stats.total }),
  }
}

function bannedItem(
  input: PreflightInput,
  platforms: Platform[],
  t: Translator
): PreflightItem | null {
  if (input.bannedWords.length === 0) return null
  const texts = [
    input.draft.caption,
    ...platforms.map((p) => input.draft.captionOverrides[p] ?? ""),
    input.draft.firstComment,
  ]
  const hits = new Set(
    texts.flatMap((text) => findBannedWords(text, input.bannedWords)).map((h) => h.word)
  )
  if (hits.size > 0) {
    const quote = (w: string) => (input.locale === "fr" ? `« ${w} »` : `"${w}"`)
    return {
      id: "banned",
      severity: "warning",
      label: t("composer.preflight.bannedHit"),
      detail: [...hits].map(quote).join(" · "),
    }
  }
  return { id: "banned", severity: "ok", label: t("composer.preflight.bannedOk") }
}

function approvalItem(client: Client, t: Translator): PreflightItem {
  switch (client.approvalMode) {
    case "required":
      return {
        id: "approval",
        severity: "warning",
        label: t("composer.preflight.approvalRequired"),
        detail: t("composer.preflight.approvalRequiredDetail"),
      }
    case "optional":
      return { id: "approval", severity: "ok", label: t("composer.preflight.approvalOptional") }
    default:
      return { id: "approval", severity: "ok", label: t("composer.preflight.approvalAuto") }
  }
}

function dateItem(
  draft: ComposerDraft,
  client: Client,
  t: Translator,
  locale: Locale
): PreflightItem {
  if (!draft.scheduledAt) {
    return {
      id: "date",
      severity: "warning",
      label: t("composer.preflight.dateNone"),
      detail: t("composer.preflight.dateNoneDetail"),
    }
  }
  const time = new Date(draft.scheduledAt).getTime()
  if (time < now().getTime() + MIN_LEAD_MS) {
    return {
      id: "date",
      severity: "error",
      label: t("composer.preflight.datePast"),
      detail: t("composer.preflight.datePastDetail"),
    }
  }
  return {
    id: "date",
    severity: "ok",
    label: t("composer.preflight.dateOk", {
      date: formatDateTime(draft.scheduledAt, client.timezone, locale),
    }),
    detail: t("composer.preflight.dateOkDetail", { tz: client.timezone }),
  }
}

function altTextItem(draft: ComposerDraft, t: Translator): PreflightItem | null {
  const images = draft.media.filter((m) => m.type === "image")
  if (images.length === 0) return null
  const missing = images.filter((m) => m.altText.trim().length === 0).length
  if (missing > 0) {
    return {
      id: "alt",
      severity: "warning",
      label: t("composer.preflight.altMissing", { count: missing }),
      detail: t("composer.preflight.altMissingDetail"),
    }
  }
  return { id: "alt", severity: "ok", label: t("composer.preflight.altOk") }
}

export function computePreflight(input: PreflightInput): PreflightItem[] {
  const { t, locale } = input
  const lbl = makeLabels(t)
  const platforms = targetedApiPlatforms(input.draft, input.accounts)
  const items: Array<PreflightItem | null> = [
    targetsItem(input.draft, input.accounts, t, lbl),
    accountsItem(input.draft, input.accounts, t, lbl),
    mediaItem(input.draft, platforms, t),
    captionItem(input.draft, platforms, t, lbl),
    hashtagsItem(input.draft, platforms, t),
    bannedItem(input, platforms, t),
    approvalItem(input.client, t),
    dateItem(input.draft, input.client, t, locale),
    altTextItem(input.draft, t),
  ]
  return items.filter((i): i is PreflightItem => i !== null)
}

export function hasBlocking(items: PreflightItem[]): boolean {
  return items.some((i) => i.severity === "error")
}
