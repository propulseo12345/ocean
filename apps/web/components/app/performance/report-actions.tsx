"use client"

import { ArrowLeft, Link2, Printer, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"
import { createReportShare } from "./report-share-actions"
import type { ReportSectionKey, ReportSections } from "./report-sections"
import { SECTION_LABEL_KEYS } from "./report-sections"

// Barre d'actions du rapport (sticky, masquée à l'impression) : génération d'un
// lien de partage public (snapshot), export PDF via window.print(),
// personnalisation des sections.

export function ReportActions({
  clientId,
  sections,
  onToggleSection,
}: {
  clientId: string
  sections: ReportSections
  onToggleSection: (key: ReportSectionKey, value: boolean) => void
}) {
  const t = useT()
  const [sharing, setSharing] = useState(false)

  // Crée un partage réel (report_shares) puis copie l'URL publique /r/{token}.
  async function copyLink() {
    if (sharing) return
    setSharing(true)
    const res = await createReportShare({ clientId })
    setSharing(false)
    if (!res.ok || !res.data) {
      toast.error(t("report.actions.shareError"))
      return
    }
    const url = `${window.location.origin}/r/${res.data.token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t("report.actions.copiedTitle"), {
        description: t("report.actions.copiedDescription"),
      })
    } catch {
      toast.info(t("report.actions.readyTitle"), { description: url })
    }
  }

  function exportPdf() {
    toast.info(t("report.actions.printTitle"), {
      description: t("report.actions.printDescription"),
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
        {t("report.actions.backToPerformance")}
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <SlidersHorizontal />
            {t("report.actions.customize")}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="mb-2 text-sm font-medium">{t("report.actions.sectionsTitle")}</p>
            <ul className="space-y-2.5">
              {(Object.keys(SECTION_LABEL_KEYS) as ReportSectionKey[]).map((key) => (
                <li key={key} className="flex items-center justify-between gap-3">
                  <label htmlFor={`sec-${key}`} className="text-sm">
                    {t(SECTION_LABEL_KEYS[key])}
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
        <Button variant="outline" size="sm" onClick={copyLink} disabled={sharing}>
          <Link2 />
          {t("report.actions.copyLink")}
        </Button>
        <Button size="sm" onClick={exportPdf}>
          <Printer />
          {t("report.actions.exportPdf")}
        </Button>
      </div>
    </div>
  )
}
