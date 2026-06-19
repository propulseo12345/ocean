"use client"

import { ArrowLeft, CalendarClock, CalendarOff, Check, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import type { Client } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

// En-tête du composer : retour studio, titre, rappel de programmation
// (fuseau du client) et actions Programmer / Enregistrer.

export function ComposerHeader({
  client,
  mode,
  scheduledAt,
  blocked,
  onSave,
  onOpenSchedule,
}: {
  client: Client
  mode: "create" | "edit"
  scheduledAt: string | null
  /** Pré-flight bloquant : signalé sur le bouton Programmer. */
  blocked: boolean
  onSave: () => void
  onOpenSchedule: () => void
}) {
  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        render={<Link href={routes.clientContent(client.id)} />}
      >
        <ArrowLeft />
        Retour au studio
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {mode === "create" ? "Nouveau contenu" : "Modifier le contenu"}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{client.name}</span>
            <span aria-hidden>·</span>
            {scheduledAt ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarClock className="size-3.5" />
                {formatDateTime(scheduledAt, client.timezone)}
                <span className="text-muted-foreground/70">(fuseau {client.timezone})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 italic">
                <CalendarOff className="size-3.5" />
                Sans date
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={onOpenSchedule}>
            {blocked ? <TriangleAlert className="text-warning" /> : <CalendarClock />}
            {scheduledAt ? "Reprogrammer…" : "Programmer…"}
          </Button>
          <Button onClick={onSave}>
            <Check />
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  )
}
