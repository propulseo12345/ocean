"use client"

import { Quote } from "lucide-react"
import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { useLocale, useT } from "@/lib/i18n"
import { compactNumber } from "./perf-utils"
import { ReportActions } from "./report-actions"
import type { ReportData } from "./report-data"
import { ReportHeader } from "./report-header"
import { ReportContentMix, ReportHighlights } from "./report-highlights"
import { ReportKpis } from "./report-kpis"
import "./report-print.css"
import { DEFAULT_SECTIONS, type ReportSectionKey } from "./report-sections"

export function ReportWorkspace({ data }: { data: ReportData }) {
  const t = useT()
  const { locale } = useLocale()
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [note, setNote] = useState(() => t("report.note.default"))
  const periodLabel = t("report.periodLabel")

  function toggle(key: ReportSectionKey, value: boolean) {
    setSections((s) => ({ ...s, [key]: value }))
  }

  // Synthèse en langage clair, dérivée des valeurs RÉELLES et localisée. Sans
  // delta inventé : post_metrics est un instantané, pas de comparaison N-1 fiable.
  const { reach, engagement, count } = data.perf.kpis.current
  const summaryLines = [
    t("report.summary.line1", { count, reach: compactNumber(reach, locale) }),
    t("report.summary.line2", { engagement: compactNumber(engagement, locale) }),
    t("report.summary.line3"),
  ]

  return (
    <div className="space-y-4">
      <ReportActions
        clientId={data.client.id}
        handle={data.client.handle}
        sections={sections}
        onToggleSection={toggle}
      />

      <article
        data-report-document
        className="mx-auto max-w-3xl space-y-6 rounded-2xl border bg-background p-5 shadow-sm sm:p-7"
      >
        <div data-report-section>
          <ReportHeader
            client={data.client}
            periodLabel={periodLabel}
            accentColor={data.accentColor}
            igFollowers={data.igFollowers}
          />
        </div>

        <section data-report-section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">{t("report.summary.title")}</h2>
          <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            {summaryLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        {sections.kpis ? (
          <div data-report-section>
            <ReportKpis data={data.perf.kpis} />
          </div>
        ) : null}

        {sections.highlights ? (
          <div data-report-section>
            <ReportHighlights posts={data.perf.posts} />
          </div>
        ) : null}

        {sections.mix ? (
          <div data-report-section>
            <ReportContentMix pillars={data.perf.pillars} />
          </div>
        ) : null}

        {sections.note ? (
          <section data-report-section className="space-y-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <Quote className="size-4 text-muted-foreground" />
              {t("report.note.title")}
            </h2>
            <Textarea
              data-no-print
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              aria-label={t("report.note.ariaLabel")}
              className="resize-none text-sm"
            />
            <blockquote
              className="hidden border-l-2 pl-3 text-sm italic leading-relaxed text-muted-foreground print:block"
              style={{ borderLeftColor: data.accentColor }}
            >
              {note}
            </blockquote>
          </section>
        ) : null}

        <footer
          data-report-section
          className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground"
        >
          <span>
            {t("report.footer.separator", { name: data.client.name, period: periodLabel })}
          </span>
          <span>{t("report.footer.generatedBy")}</span>
        </footer>
      </article>

      <p data-no-print className="text-center text-xs text-muted-foreground">
        {t("report.printHint")}
      </p>
    </div>
  )
}
