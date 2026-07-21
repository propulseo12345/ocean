import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { FormatLabel } from "@/components/shared/format-icon"
import { MediaThumb } from "@/components/shared/media-thumb"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getFormat, getT } from "@/lib/i18n/server"
import type { Translator } from "@/lib/i18n/translator"
import { contentStatusMeta } from "@/lib/mocks/labels"
import type { ContentItem, ContentStatus } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"

// Le client ne doit jamais voir les états techniques (PRD §5.F) : on les
// présente sous un libellé neutre « Programmé » ou « Publié ».
const NEUTRAL_STATUS: Partial<Record<ContentStatus, ContentStatus>> = {
  publishing: "scheduled",
  failed: "scheduled",
  partially_published: "published",
}

export function clientFacingStatus(status: ContentStatus): ContentStatus {
  return NEUTRAL_STATUS[status] ?? status
}

export async function PortalCard({
  content,
  timezone,
  emphasis = false,
}: {
  content: ContentItem
  timezone: string
  emphasis?: boolean
}) {
  const t = await getT()
  const f = await getFormat()
  const cover = content.media[0]
  const status = clientFacingStatus(content.status)
  const title = content.title
  const caption = content.caption.trim()

  return (
    <Card
      className={cn("transition-colors hover:ring-foreground/20", emphasis && "ring-primary/30")}
    >
      <div className="flex gap-3 px-(--card-spacing)">
        {cover ? (
          <MediaThumb
            media={cover}
            alt={title}
            count={content.media.length}
            className="size-20 shrink-0 rounded-lg sm:size-24"
            sizes="96px"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground sm:size-24">
            {t("portal.card.textOnly")}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading line-clamp-1 font-medium leading-snug">{title}</p>
            <ContentStatusBadge status={status} className="shrink-0" />
          </div>

          {caption ? <p className="line-clamp-2 text-sm text-muted-foreground">{caption}</p> : null}

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
            <FormatLabel format={content.format} />
            {content.scheduledAt ? (
              <span className="tabular-nums">{f.dateTime(content.scheduledAt, timezone)}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex justify-end px-(--card-spacing)">
        <Button
          variant={emphasis ? "default" : "outline"}
          size="sm"
          render={<Link href={routes.portalContent(content.id)} />}
        >
          {emphasis ? t("portal.card.reviewAndApprove") : t("portal.card.review")}
          <ChevronRight />
        </Button>
      </div>
    </Card>
  )
}

// Libellé client du statut (états techniques masqués). Prend un Translator
// (server: await getT(), ou client: useT()) car les libellés de statut sont i18n.
export function statusBadgeLabel(status: ContentStatus, t: Translator): string {
  return t(contentStatusMeta[clientFacingStatus(status)].labelKey)
}
