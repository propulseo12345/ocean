import type { PublishPlatform } from "./domain"

// Compteur de quota LOCAL par compte social (règle 19).
//
// `checkQuota` renvoyait `true` en dur dans les deux branches, y compris la
// branche « mode réel » : basculer les publishers en live n'obligeait donc pas à
// repasser ici. La table `social_account_quota_usage` (014) est correctement
// modélisée mais n'a jamais eu le moindre écrivain — la jauge de l'UI affiche
// 0/100 en permanence.
//
// Ce module tient la moitié LOCALE de la règle 19 : compter ce qu'Ocean a
// publié, et refuser d'aller au-delà de la limite connue. L'autre moitié — la
// vérité de la plateforme (`GET /content_publishing_limit` côté IG, en-tête
// `X-Business-Use-Case-Usage` côté FB) — appartient à la phase 6 et est branchée
// explicitement ci-dessous, pas laissée en TODO flottant.
//
// Les limites vivent ici et pas en base : 014:98 le documente déjà
// (« les LIMITES vivent dans packages/shared, pas en base »). Elles ne sont PAS
// dans `packages/shared` parce que ce paquet n'est dépendance d'aucune app
// aujourd'hui — l'y mettre demanderait de câbler le workspace et l'image Docker
// du worker, ce qui n'a rien à faire dans un ticket de sûreté de publication.

/** Miroir de `public.quota_kind` (migration 010). */
export type QuotaKind = "ig_publish" | "ig_container" | "fb_buc" | "fb_reels" | "tt_draft"

export interface LocalQuota {
  kind: QuotaKind
  /** Limite sur la fenêtre glissante (CLAUDE.md §6, état des API juin 2026). */
  limit: number
  /** Durée de la fenêtre. 24 h partout aujourd'hui. */
  windowSeconds: number
}

/**
 * Quota que le worker peut enforcer SEUL, sans appel distant.
 *
 * `facebook` est délibérément `null` : la limite Page est un BUC
 * (4800 × utilisateurs engagés / 24 h) qui dépend de l'engagement réel et n'est
 * PAS calculable localement. Un compteur local inventerait un plafond faux —
 * soit trop bas (on bloque des publications légitimes), soit trop haut (il ne
 * protège de rien). La seule source valable est l'en-tête renvoyé par Meta, donc
 * la phase 6. Le dire explicitement vaut mieux qu'un chiffre rassurant.
 *
 * Le sous-quota « 30 Reels API / 24 h / Page » (`fb_reels`), lui, EST un nombre
 * fixe — mais le job ne transporte pas le format du contenu, donc on ne peut pas
 * savoir si ce post est un Reel. À câbler en phase 6, en même temps que le
 * format.
 */
export const LOCAL_QUOTAS: Record<PublishPlatform, LocalQuota | null> = {
  // 100 posts API / 24 h glissantes (un carrousel compte pour 1).
  instagram: { kind: "ig_publish", limit: 100, windowSeconds: 86_400 },
  // 5 brouillons en attente / 24 h par créateur.
  tiktok: { kind: "tt_draft", limit: 5, windowSeconds: 86_400 },
  facebook: null,
}

/** Verdict rendu au moteur. Un refus dit toujours QUAND réessayer. */
export type QuotaVerdict = { ok: true } | { ok: false; retryAfterMs: number; reason: string }

export interface QuotaRow {
  used: number
  windowResetsAt: Date | null
}

/**
 * Décide à partir de la ligne de compteur. Fonction PURE : c'est ici que vit
 * toute la logique de fenêtre, donc c'est ici qu'elle se teste.
 *
 * Deux pièges que cette fonction ferme :
 *
 *   1. `window_resets_at` est nullable et n'était lu par personne. Une ligne
 *      `used = 100` sans date de reset bloquerait le compte INDÉFINIMENT. Une
 *      fenêtre échue (ou absente) remet donc le compteur à zéro.
 *   2. un refus doit dire quand réessayer. Reporter de 60 s en boucle jusqu'à
 *      épuiser la fenêtre de grâce — le comportement d'avant — transforme un
 *      quota atteint en publication perdue, à l'inverse de la décision actée
 *      (« report automatique au prochain créneau disponible »).
 */
export function decideQuota(quota: LocalQuota, row: QuotaRow | null, now: Date): QuotaVerdict {
  const windowMs = quota.windowSeconds * 1000

  // Pas encore de compteur, ou fenêtre échue : la fenêtre repart à zéro.
  if (!row || row.windowResetsAt === null || row.windowResetsAt.getTime() <= now.getTime()) {
    return { ok: true }
  }

  if (row.used < quota.limit) return { ok: true }

  // Plafond atteint : on reporte à la RÉOUVERTURE de la fenêtre, +1 min de marge
  // pour ne pas retomber pile sur la seconde de bascule.
  const retryAfterMs = Math.max(60_000, row.windowResetsAt.getTime() - now.getTime() + 60_000)
  return {
    ok: false,
    retryAfterMs: Math.min(retryAfterMs, windowMs + 60_000),
    reason: `quota ${quota.kind} atteint (${row.used}/${quota.limit})`,
  }
}
