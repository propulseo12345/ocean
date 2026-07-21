"use client"

import { ArrowLeft, CalendarClock, CalendarOff, Check, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Client } from "@/lib/domain"
import { useFormat, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

// En-tête du composer : retour studio, titre, rappel de programmation
// (fuseau du client) et actions Programmer / Enregistrer.

export function ComposerHeader({
  client,
  mode,
  scheduledAt,
  blocked,
  saving,
  onSave,
  onOpenSchedule,
}: {
  client: Client
  mode: "create" | "edit"
  scheduledAt: string | null
  /** Pré-flight bloquant : signalé sur le bouton Programmer. */
  blocked: boolean
  /** Écriture en cours : désactive Enregistrer pour éviter un double envoi. */
  saving: boolean
  onSave: () => void
  onOpenSchedule: () => void
}) {
  const t = useT()
  const f = useFormat()
  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        render={<Link href={routes.clientContent(client.id)} />}
      >
        <ArrowLeft />
        {t("composer.header.back")}
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {mode === "create" ? t("composer.header.titleCreate") : t("composer.header.titleEdit")}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{client.name}</span>
            <span aria-hidden>·</span>
            {scheduledAt ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarClock className="size-3.5" />
                {f.dateTime(scheduledAt, client.timezone)}
                <span className="text-muted-foreground/70">
                  {t("composer.header.tzHint", { tz: client.timezone })}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 italic">
                <CalendarOff className="size-3.5" />
                {t("composer.header.noDate")}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={onOpenSchedule}>
            {blocked ? <TriangleAlert className="text-warning" /> : <CalendarClock />}
            {scheduledAt ? t("composer.header.reschedule") : t("composer.header.schedule")}
          </Button>
          <Button onClick={onSave} disabled={saving}>
            <Check />
            {t("composer.header.save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
