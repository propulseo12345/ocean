"use client"

import { ArrowLeft, Link2, Printer, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { routes } from "@/lib/routes"
import type { ReportSectionKey, ReportSections } from "./report-sections"
import { SECTION_LABELS } from "./report-sections"

// Barre d'actions du rapport (sticky, masquée à l'impression) : copie de lien
// d'aperçu mock, export PDF via window.print(), personnalisation des sections.

export function ReportActions({
  clientId,
  handle,
  sections,
  onToggleSection,
}: {
  clientId: string
  handle: string
  sections: ReportSections
  onToggleSection: (key: ReportSectionKey, value: boolean) => void
}) {
  async function copyLink() {
    const url = `${routes.clientReport(clientId)}?share=apercu-${handle}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Lien d'aperçu copié (aperçu)", {
        description: "En production : lien figé à jeton révocable, sans compte requis.",
      })
    } catch {
      toast.info("Lien d'aperçu prêt (aperçu)", { description: url })
    }
  }

  function exportPdf() {
    toast.info("Ouverture de l'impression…", {
      description: "Choisissez « Enregistrer en PDF » dans la boîte de dialogue.",
    })
    window.setTimeout(() => window.print(), 150)
  }

  return (
    <div
      data-no-print
      className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border bg-background/80 px-2 py-2 backdrop-blur supports-backdrop-filter:bg-background/60"
    >
      <Button variant="ghost" size="sm" render={<Link href={routes.clientPerformance(clientId)} />}>
        <ArrowLeft />
        Performance
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <SlidersHorizontal />
            Personnaliser
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="mb-2 text-sm font-medium">Sections du rapport</p>
            <ul className="space-y-2.5">
              {(Object.keys(SECTION_LABELS) as ReportSectionKey[]).map((key) => (
                <li key={key} className="flex items-center justify-between gap-3">
                  <label htmlFor={`sec-${key}`} className="text-sm">
                    {SECTION_LABELS[key]}
                  </label>
                  <Switch
                    id={`sec-${key}`}
                    checked={sections[key]}
                    onCheckedChange={(v) => onToggleSection(key, v)}
                  />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Link2 />
          Copier le lien
        </Button>
        <Button size="sm" onClick={exportPdf}>
          <Printer />
          Exporter en PDF
        </Button>
      </div>
    </div>
  )
}
