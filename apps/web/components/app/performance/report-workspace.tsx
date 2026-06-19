"use client"

import { Quote } from "lucide-react"
import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { ReportActions } from "./report-actions"
import type { ReportData } from "./report-data"
import { ReportHeader } from "./report-header"
import { ReportContentMix, ReportHighlights } from "./report-highlights"
import { ReportKpis } from "./report-kpis"
import "./report-print.css"
import { DEFAULT_SECTIONS, type ReportSectionKey } from "./report-sections"

const DEFAULT_NOTE =
  "Un mois régulier et fidèle à votre ligne éditoriale. On capitalise le mois prochain sur les " +
  "formats qui ont le mieux résonné auprès de votre communauté, et on garde ce rythme de publication."

export function ReportWorkspace({ data }: { data: ReportData }) {
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [note, setNote] = useState(DEFAULT_NOTE)

  function toggle(key: ReportSectionKey, value: boolean) {
    setSections((s) => ({ ...s, [key]: value }))
  }

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
            periodLabel={data.periodLabel}
            accentColor={data.accentColor}
            igFollowers={data.igFollowers}
          />
        </div>

        <section data-report-section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">En un coup d'œil</h2>
          <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            {data.summaryLines.map((line) => (
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
              Le mot du mois
            </h2>
            <Textarea
              data-no-print
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              aria-label="Mot de synthèse du community manager"
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
            {data.client.name} · {data.periodLabel}
          </span>
          <span>Généré par Ocean</span>
        </footer>
      </article>

      <p data-no-print className="text-center text-xs text-muted-foreground">
        Aperçu fidèle à l'impression — utilisez « Exporter en PDF » pour le livrable client.
      </p>
    </div>
  )
}
