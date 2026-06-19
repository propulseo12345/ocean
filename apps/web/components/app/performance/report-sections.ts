// Sections incluables du rapport client (toggle « Personnaliser »).
// L'en-tête, la synthèse et le pied de page sont toujours présents.

export type ReportSectionKey = "kpis" | "highlights" | "mix" | "note"

export const SECTION_LABELS: Record<ReportSectionKey, string> = {
  kpis: "Chiffres clés",
  highlights: "Meilleures publications",
  mix: "Mix de contenu",
  note: "Mot du community manager",
}

export type ReportSections = Record<ReportSectionKey, boolean>

export const DEFAULT_SECTIONS: ReportSections = {
  kpis: true,
  highlights: true,
  mix: true,
  note: true,
}
