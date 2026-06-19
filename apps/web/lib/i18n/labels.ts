import {
  accountStatusMeta,
  activityKindMeta,
  approvalModeMeta,
  contentStatusMeta,
  customPlatformLabelKey,
  formatLabelKey,
  platformMeta,
  reviewStateMeta,
  targetStatusMeta,
} from "@/lib/mocks/labels"
import type {
  AccountStatus,
  ActivityKind,
  ApprovalMode,
  ContentFormat,
  ContentStatus,
  Platform,
  ReviewRequestState,
  TargetStatus,
} from "@/lib/mocks/types"
import type { Translator } from "./translator"

// Résolveurs de libellés localisés à partir d'un Translator (server ou client).
// tone/colorVar/short restent lus directement sur les *Meta de mocks/labels.

export function makeLabels(t: Translator) {
  return {
    contentStatus: (s: ContentStatus) => t(contentStatusMeta[s].labelKey),
    targetStatus: (s: TargetStatus) => t(targetStatusMeta[s].labelKey),
    accountStatus: (s: AccountStatus) => t(accountStatusMeta[s].labelKey),
    reviewState: (s: ReviewRequestState) => t(reviewStateMeta[s].labelKey),
    approvalMode: (m: ApprovalMode) => t(approvalModeMeta[m].labelKey),
    activityKind: (k: ActivityKind) => t(activityKindMeta[k].labelKey),
    format: (f: ContentFormat) => t(formatLabelKey[f]),
    // Nom propre des plateformes non traduit, sauf « custom ».
    platform: (p: Platform) => (p === "custom" ? t(customPlatformLabelKey) : platformMeta[p].label),
    platformShort: (p: Platform) => platformMeta[p].short,
  }
}

export type Labels = ReturnType<typeof makeLabels>
