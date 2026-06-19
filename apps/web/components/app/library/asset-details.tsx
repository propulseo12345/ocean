"use client"

import { ArchiveRestore, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ContentStatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
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
  const [draft, setDraft] = useState(asset.altText ?? "")
  useEffect(() => setDraft(asset.altText ?? ""), [asset])
  const dirty = draft !== (asset.altText ?? "")

  const publishedUse = usages.some(
    (u) => u.status === "published" || u.status === "partially_published"
  )

  return (
    <div className="space-y-4">
      <dl className="divide-y rounded-lg border px-3 py-1">
        <MetaRow label="Type" value={asset.type === "video" ? "Vidéo" : "Image"} />
        <MetaRow label="Format" value={mimeLabel(asset)} />
        <MetaRow label="Dimensions" value={`${asset.width}×${asset.height} px`} />
        <MetaRow label="Ratio" value={ratioLabel(asset.width, asset.height)} />
        {asset.fileSizeMb !== undefined ? (
          <MetaRow label="Poids" value={formatMb(asset.fileSizeMb)} />
        ) : null}
        {asset.durationSec !== undefined ? (
          <MetaRow label="Durée" value={formatDuration(asset.durationSec)} />
        ) : null}
        <MetaRow label="Source" value={sourceMeta[asset.source].label} />
        <MetaRow label={sourceMeta[asset.source].verb} value={formatDate(asset.uploadedAt, tz)} />
      </dl>

      <div className="space-y-1.5">
        <Label htmlFor="asset-alt">Texte alternatif</Label>
        <Textarea
          id="asset-alt"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Décris le visuel pour l'accessibilité et le SEO social…"
          className="min-h-20"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Envoyé à Instagram et Facebook si la plateforme le supporte.
          </p>
          <Button size="sm" disabled={!dirty} onClick={() => onSaveAlt(asset.id, draft)}>
            Enregistrer (aperçu)
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <h4 className="text-sm font-medium">
          {usages.length > 0
            ? `Utilisé dans ${usages.length} contenu${usages.length > 1 ? "s" : ""}`
            : "Jamais utilisé"}
        </h4>
        {usages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Média inédit — idéal pour le prochain batch de contenu.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {usages.map((u) => (
              <li key={u.id}>
                <Link
                  href={u.href}
                  className="group flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{u.title}</span>
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
            En réel, l'original est purgé 7 jours après publication : seule la miniature reste et
            réutiliser ce média demandera un re-téléversement.
          </p>
        ) : null}
      </div>
    </div>
  )
}
