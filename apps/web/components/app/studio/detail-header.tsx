import { ArrowLeft, CalendarOff, Clock, Pencil, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { FormatLabel } from "@/components/shared/format-icon"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getFormat, getT } from "@/lib/i18n/server"
import type { Client, ContentItem } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"

// En-tête du détail contenu : retour, statut + format, titre, créneau,
// bouton « Modifier » (composer) et bandeaux d'alerte (approbation périmée,
// échec global de publication).

export async function DetailHeader({
  client,
  content,
  canEdit,
}: {
  client: Client
  content: ContentItem
  canEdit: boolean
}) {
  const t = await getT()
  const f = await getFormat()
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link href={routes.clientContent(client.id)} />}
        >
          <ArrowLeft />
          {t("studio.detail.back")}
        </Button>
        {canEdit ? (
          <Button size="sm" render={<Link href={routes.contentEdit(client.id, content.id)} />}>
            <Pencil />
            {t("studio.detail.edit")}
          </Button>
        ) : null}
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <ContentStatusBadge status={content.status} />
          <FormatLabel format={content.format} className="text-muted-foreground" />
          {content.approvalStale ? (
            <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
              <TriangleAlert className="size-3" />
              {t("studio.detail.approvalStale")}
            </Badge>
          ) : null}
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {content.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            {content.scheduledAt ? (
              <>
                <Clock className="size-3.5" />
                {f.dateTime(content.scheduledAt, client.timezone)}
              </>
            ) : (
              <>
                <CalendarOff className="size-3.5" />
                {t("studio.detail.noDate")}
              </>
            )}
          </span>
          <span>{t("studio.detail.timezone", { tz: client.timezone })}</span>
        </div>
      </header>

      {content.approvalStale ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{t("studio.detail.approvalStaleBanner")}</p>
        </div>
      ) : null}

      {content.lastError && content.status === "failed" ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{content.lastError}</p>
        </div>
      ) : null}
    </>
  )
}
