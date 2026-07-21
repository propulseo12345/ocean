import { Check, History, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type Format, type Locale, type Translator } from "@/lib/i18n"
import { getFormat, getLocale, getT } from "@/lib/i18n/server"
import type { Approval, ContentVersion } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { diffWords } from "./detail-diff"

// Historique des versions envoyées en validation (v1, v2…) avec diff lisible
// des légendes : mots ajoutés surlignés, mots supprimés barrés. Chaque version
// rappelle la décision client correspondante (approbation / corrections).

export async function DetailVersions({
  versions,
  approvals,
}: {
  versions: ContentVersion[]
  approvals: Approval[]
}) {
  if (versions.length === 0) return null
  const t = await getT()
  const f = await getFormat()
  const locale = await getLocale()

  return (
    <Card id="versions" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <History className="size-4 text-muted-foreground" />
          {t("studio.versions.heading", { count: versions.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-success/60" />
            {t("studio.versions.added")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-destructive/50" />
            {t("studio.versions.removed")}
          </span>
        </p>

        <ol className="space-y-4">
          {versions.map((version, index) => (
            <VersionRow
              key={version.id}
              version={version}
              previous={index > 0 ? versions[index - 1] : null}
              approval={approvals.find((a) => a.versionLabel === version.label)}
              t={t}
              f={f}
              locale={locale}
            />
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function VersionRow({
  version,
  previous,
  approval,
  t,
  f,
  locale,
}: {
  version: ContentVersion
  previous: ContentVersion | null
  approval?: Approval
  t: Translator
  f: Format
  locale: Locale
}) {
  return (
    <li className="space-y-1.5 border-l-2 border-border pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-mono text-[10px]">
          {version.label}
        </Badge>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {f.relative(version.createdAt)}
        </span>
        {approval ? <ApprovalChip approved={approval.decision === "approved"} t={t} /> : null}
      </div>

      <p className="text-xs text-muted-foreground">{version.note}</p>

      {previous ? (
        <CaptionDiff
          before={previous.caption}
          after={version.caption}
        />
      ) : (
        <p className="rounded-md bg-muted/40 p-2 text-xs leading-relaxed whitespace-pre-wrap">
          {version.caption}
        </p>
      )}
    </li>
  )
}

/** Décision client liée à la version — visible aussi dans Validation client. */
function ApprovalChip({ approved, t }: { approved: boolean; t: Translator }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        approved ? "border-success/40 text-success" : "border-warning/40 text-warning"
      )}
    >
      {approved ? <Check className="size-3" /> : <X className="size-3" />}
      {approved ? t("studio.versions.approvedByClient") : t("studio.versions.changesRequested")}
    </span>
  )
}

function CaptionDiff({ before, after }: { before: string; after: string }) {
  const segments = diffWords(before, after)
  let offset = 0

  return (
    <p className="rounded-md bg-muted/40 p-2 text-xs leading-relaxed whitespace-pre-wrap">
      {segments.map((segment) => {
        const key = `${segment.kind}:${offset}`
        offset += segment.text.length
        if (segment.kind === "added") {
          return (
            <span key={key} className="rounded-sm bg-success/15 px-0.5 text-success">
              {segment.text}
            </span>
          )
        }
        if (segment.kind === "removed") {
          return (
            <span
              key={key}
              className="rounded-sm bg-destructive/10 px-0.5 text-destructive line-through"
            >
              {segment.text}
            </span>
          )
        }
        return <span key={key}>{segment.text}</span>
      })}
    </p>
  )
}
