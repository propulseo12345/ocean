"use client"

import { ArchiveRestore, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useFormat, useLocale, useT } from "@/lib/i18n"
import { pick } from "@/lib/i18n/localized"
import type { LibraryAsset } from "@/lib/mocks/types"
import { ratioLabel } from "@/lib/specs"
import type { UsageRef } from "./library-types"
import { formatDuration, formatMb, mimeLabel, sourceMeta } from "./library-utils"

// Métadonnées complètes, alt text éditable (état local) et liste des
// contenus utilisant l'asset, avec liens vers le studio.

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-xs font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function AssetDetails({
  asset,
  usages,
  tz,
  onSaveAlt,
}: {
  asset: LibraryAsset
  usages: UsageRef[]
  tz: string
  onSaveAlt: (id: string, altText: string) => void
}) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  const initialAlt = asset.altText ? pick(asset.altText, locale) : ""
  const [draft, setDraft] = useState(initialAlt)
  useEffect(() => setDraft(asset.altText ? pick(asset.altText, locale) : ""), [asset, locale])
  const dirty = draft !== initialAlt

  const publishedUse = usages.some(
    (u) => u.status === "published" || u.status === "partially_published"
  )

  return (
    <div className="space-y-4">
      <dl className="divide-y rounded-lg border px-3 py-1">
        <MetaRow
          label={t("library.details.type")}
          value={asset.type === "video" ? t("library.mime.video") : t("library.mime.image")}
        />
        <MetaRow label={t("library.details.format")} value={mimeLabel(asset, t)} />
        <MetaRow
          label={t("library.details.dimensions")}
          value={`${asset.width}×${asset.height} px`}
        />
        <MetaRow label={t("library.details.ratio")} value={ratioLabel(asset.width, asset.height)} />
        {asset.fileSizeMb !== undefined ? (
          <MetaRow
            label={t("library.details.weight")}
            value={formatMb(asset.fileSizeMb, locale, t)}
          />
        ) : null}
        {asset.durationSec !== undefined ? (
          <MetaRow
            label={t("library.details.duration")}
            value={formatDuration(asset.durationSec)}
          />
        ) : null}
        <MetaRow label={t("library.details.source")} value={t(sourceMeta[asset.source].labelKey)} />
        <MetaRow label={t(sourceMeta[asset.source].verbKey)} value={f.date(asset.uploadedAt, tz)} />
      </dl>

      <div className="space-y-1.5">
        <Label htmlFor="asset-alt">{t("library.details.altLabel")}</Label>
        <Textarea
          id="asset-alt"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("library.details.altPlaceholder")}
          className="min-h-20"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("library.details.altHint")}</p>
          <Button size="sm" disabled={!dirty} onClick={() => onSaveAlt(asset.id, draft)}>
            {t("library.details.save")}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <h4 className="text-sm font-medium">
          {usages.length > 0
            ? t("library.details.usedIn", { count: usages.length })
            : t("library.details.neverUsed")}
        </h4>
        {usages.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("library.details.unusedHint")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {usages.map((u) => (
              <li key={u.id}>
                <Link
                  href={u.href}
                  className="group flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{pick(u.title, locale)}</span>
                  <ContentStatusBadge status={u.status} />
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {publishedUse ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ArchiveRestore className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("library.details.purgeNote")}
          </p>
        ) : null}
      </div>
    </div>
  )
}
