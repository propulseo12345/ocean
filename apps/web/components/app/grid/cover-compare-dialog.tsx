"use client"

import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { GridTileData } from "./grid-types"

// Comparateur de covers de Reel EN CONTEXTE : chaque candidate est montrée
// entre ses tuiles voisines pour juger l'harmonie du feed (audit §1, P1).

export interface CoverCompareTarget {
  tile: GridTileData
  current: string
  alternative: string
  /** Vignettes voisines dans la grille (contexte). */
  prevThumb: string | null
  nextThumb: string | null
}

function ContextStrip({
  candidate,
  prevThumb,
  nextThumb,
  title,
}: {
  candidate: string
  prevThumb: string | null
  nextThumb: string | null
  title: string
}) {
  const t = useT()
  const cell = "relative aspect-[3/4] overflow-hidden rounded-sm bg-muted"
  return (
    <div className="grid grid-cols-3 gap-0.5">
      <div className={cell}>
        {prevThumb ? (
          <Image src={prevThumb} alt="" fill sizes="80px" className="object-cover" />
        ) : null}
      </div>
      <div className={cn(cell, "ring-2 ring-primary")}>
        <Image
          src={candidate}
          alt={t("grid.cover.candidateAlt", { title })}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
      <div className={cell}>
        {nextThumb ? (
          <Image src={nextThumb} alt="" fill sizes="80px" className="object-cover" />
        ) : null}
      </div>
    </div>
  )
}

function CoverOption({
  label,
  url,
  target,
  actionLabel,
  primary,
  onSelect,
}: {
  label: string
  url: string
  target: CoverCompareTarget
  actionLabel: string
  primary?: boolean
  onSelect: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative mx-auto aspect-[9/16] w-28 overflow-hidden rounded-md bg-muted">
        <Image
          src={url}
          alt={`${label} — ${target.tile.title}`}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>
      <ContextStrip
        candidate={url}
        prevThumb={target.prevThumb}
        nextThumb={target.nextThumb}
        title={target.tile.title}
      />
      <Button
        variant={primary ? "default" : "outline"}
        size="sm"
        className="w-full"
        onClick={onSelect}
      >
        {actionLabel}
      </Button>
    </div>
  )
}

export function CoverCompareDialog({
  target,
  onClose,
  onPick,
}: {
  target: CoverCompareTarget | null
  onClose: () => void
  onPick: (tileId: string, url: string) => void
}) {
  const t = useT()

  function pick(url: string, kept: boolean) {
    if (!target) return
    if (!kept) onPick(target.tile.id, url)
    onClose()
    toast.success(kept ? t("grid.cover.keptToast") : t("grid.cover.appliedToast"), {
      description: t("grid.cover.toastDescription"),
    })
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("grid.cover.title")}</DialogTitle>
          <DialogDescription>
            {target ? t("grid.cover.description", { title: target.tile.title }) : null}
          </DialogDescription>
        </DialogHeader>
        {target ? (
          <div className="grid grid-cols-2 gap-4">
            <CoverOption
              label={t("grid.cover.current")}
              url={target.current}
              target={target}
              actionLabel={t("grid.cover.keepThis")}
              onSelect={() => pick(target.current, true)}
            />
            <CoverOption
              label={t("grid.cover.alternative")}
              url={target.alternative}
              target={target}
              actionLabel={t("grid.cover.pickThis")}
              primary
              onSelect={() => pick(target.alternative, false)}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
