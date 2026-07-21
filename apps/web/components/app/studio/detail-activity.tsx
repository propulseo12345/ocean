import {
  CalendarClock,
  Check,
  ChevronDown,
  CircleCheck,
  History,
  type LucideIcon,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  TriangleAlert,
  Undo2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { type Format, type Labels, type Locale, type Translator } from "@/lib/i18n"
import { getFormat, getLabels, getLocale, getT } from "@/lib/i18n/server"
import { activityKindMeta, type StatusTone } from "@/lib/mocks/labels"
import type { ActivityEntry, ActivityKind } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Journal d'activité du contenu : qui a fait quoi, quand — la preuve en cas
// de litige (« vous avez approuvé ce post le 12 à 14 h 32 »). Repliable.

const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  created: Plus,
  updated: Pencil,
  sent_for_review: Send,
  commented: MessageSquare,
  approved: Check,
  changes_requested: Undo2,
  scheduled: CalendarClock,
  rescheduled: History,
  published: CircleCheck,
  failed: TriangleAlert,
  retried: RotateCcw,
}

const TONE_BUBBLE: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-primary/10 text-primary",
}

export async function DetailActivity({
  entries,
  timezone,
}: {
  entries: ActivityEntry[]
  timezone: string
}) {
  if (entries.length === 0) return null
  const t = await getT()
  const lbl = await getLabels()
  const f = await getFormat()
  const locale = await getLocale()

  return (
    <Card className="py-0">
      <Collapsible>
        <CollapsibleTrigger className="group/log flex w-full items-center justify-between gap-2 p-4 text-left">
          <span className="flex items-center gap-1.5 font-heading text-sm font-semibold">
            <History className="size-4 text-muted-foreground" />
            {t("studio.activity.heading", { count: entries.length })}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/log:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pt-0 pb-4">
            <ol className="space-y-0">
              {entries.map((entry, index) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  timezone={timezone}
                  isLast={index === entries.length - 1}
                  t={t}
                  lbl={lbl}
                  f={f}
                  locale={locale}
                />
              ))}
            </ol>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function ActivityRow({
  entry,
  timezone,
  isLast,
  t,
  lbl,
  f,
  locale,
}: {
  entry: ActivityEntry
  timezone: string
  isLast: boolean
  t: Translator
  lbl: Labels
  f: Format
  locale: Locale
}) {
  const meta = activityKindMeta[entry.kind]
  const Icon = KIND_ICONS[entry.kind]

  return (
    <li className="relative flex gap-2.5 pb-4 last:pb-0">
      {!isLast ? (
        <span className="absolute top-6 left-3 h-full w-px bg-border" aria-hidden />
      ) : null}
      <span
        className={cn(
          "z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
          TONE_BUBBLE[meta.tone]
        )}
      >
        <Icon className="size-3" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs">
          <span className="font-medium">{entry.actorName}</span>{" "}
          <span className="text-muted-foreground">
            {t("studio.activity.actorAction", {
              action: lbl.activityKind(entry.kind).toLowerCase(),
            })}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-foreground/85">{entry.detail}</p>
        <p
          className="mt-0.5 text-[11px] text-muted-foreground/70 tabular-nums"
          title={f.dateTime(entry.at, timezone)}
        >
          {f.relative(entry.at)}
        </p>
      </div>
    </li>
  )
}
