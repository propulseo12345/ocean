import type { MessageKey } from "@/lib/i18n"

// Sections incluables du rapport client (toggle « Personnaliser »).
// L'en-tête, la synthèse et le pied de page sont toujours présents.

export type ReportSectionKey = "kpis" | "highlights" | "mix" | "note"

// Clés i18n des libellés de sections, résolues à l'affichage via t().
export const SECTION_LABEL_KEYS: Record<ReportSectionKey, MessageKey> = {
  kpis: "report.section.kpis",
  highlights: "report.section.highlights",
  mix: "report.section.mix",
  note: "report.section.note",
}

export type ReportSections = Record<ReportSectionKey, boolean>

export const DEFAULT_SECTIONS: ReportSections = {
  kpis: true,
  highlights: true,
  mix: true,
  note: true,
}
