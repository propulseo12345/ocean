"use client"

import { BadgeCheck, Crop, Film, ImagePlus, Trash2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { SpecIssues } from "@/components/shared/spec-issues"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useFormat, useT } from "@/lib/i18n"
import type { LibraryAsset } from "@/lib/mocks/types"
import { routes } from "@/lib/routes"
import type { SpecIssue } from "@/lib/specs"
import { AssetDetails } from "./asset-details"
import type { UsageRef } from "./library-types"
import { assetFileName, formatDuration, sourceMeta } from "./library-utils"

// Fiche asset en panneau latéral : grand aperçu, specs, métadonnées,
// alt text, contenus liés et actions (créer, recadrer, supprimer — aperçu).

export function AssetSheet({
  asset,
  issues,
  usages,
  clientId,
  tz,
  onClose,
  onSaveAlt,
  onDelete,
}: {
  asset: LibraryAsset | null
  issues: SpecIssue[]
  usages: UsageRef[]
  clientId: string
  tz: string
  onClose: () => void
  onSaveAlt: (id: string, altText: string) => void
  onDelete: (asset: LibraryAsset) => void
}) {
  const t = useT()
  const f = useFormat()
  return (
    <Sheet open={asset !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {asset ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="truncate">{assetFileName(asset)}</SheetTitle>
              <SheetDescription>
                {t(sourceMeta[asset.source].labelKey)} ·{" "}
                {t(sourceMeta[asset.source].verbKey).toLowerCase()}{" "}
                {f.dayMonth(asset.uploadedAt, tz)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-4">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
                <Image
                  src={asset.fullUrl}
                  alt={asset.altText ? asset.altText : assetFileName(asset)}
                  fill
                  sizes="(max-width: 640px) 100vw, 420px"
                  className="object-contain"
                />
                {asset.type === "video" ? (
                  <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Film className="size-3.5" aria-hidden />
                    {asset.durationSec !== undefined
                      ? formatDuration(asset.durationSec)
                      : t("library.unit.video")}
                  </span>
                ) : null}
              </div>

              {issues.length > 0 ? (
                <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                  <SpecIssues issues={issues} />
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t("library.sheet.conform")}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Button render={<Link href={`${routes.contentNew(clientId)}?media=${asset.id}`} />}>
                  <ImagePlus />
                  {t("library.sheet.createContent")}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.info(t("library.sheet.cropToastTitle"), {
                        description: t("library.sheet.cropToastDesc"),
                      })
                    }
                  >
                    <Crop />
                    {t("library.sheet.crop")}
                  </Button>
                  <Button variant="destructive" onClick={() => onDelete(asset)}>
                    <Trash2 />
                    {t("library.sheet.delete")}
                  </Button>
                </div>
              </div>

              <AssetDetails asset={asset} usages={usages} tz={tz} onSaveAlt={onSaveAlt} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
