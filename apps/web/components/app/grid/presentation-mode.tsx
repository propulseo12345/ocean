"use client"

import { X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { INTL_LOCALE, useFormat, useLocale, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { GridRatio, GridTileData } from "./grid-types"
import { RATIO_CLASS } from "./grid-types"
import type { InstagramProfileData } from "./instagram-profile-header"

// Mode présentation : le feed final dans un cadre iPhone épuré (CSS pur),
// sans chrome Ocean — pour montrer « comme vos abonnés le verront ».

function PhoneTile({ tile, ratio }: { tile: GridTileData; ratio: GridRatio }) {
  const src = tile.coverUrl ?? tile.media?.thumbUrl
  if (!src) return null
  return (
    <div className={cn("relative overflow-hidden bg-muted", RATIO_CLASS[ratio])}>
      <Image src={src} alt={tile.title} fill sizes="120px" className="object-cover" />
    </div>
  )
}

export function PresentationMode({
  open,
  onOpenChange,
  profile,
  tiles,
  ratio,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: InstagramProfileData
  tiles: GridTileData[]
  ratio: GridRatio
}) {
  const t = useT()
  const f = useFormat()
  const { locale } = useLocale()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{t("grid.presentation.title")}</DialogTitle>

        <div className="flex flex-col items-center gap-3">
          {/* Cadre iPhone (CSS pur) */}
          <div className="relative h-[min(78dvh,760px)] aspect-[9/19] overflow-hidden rounded-[2.8rem] border-[6px] border-foreground bg-background shadow-2xl">
            {/* Encoche */}
            <div className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground" />

            <div className="h-full overflow-y-auto pt-10 pb-8">
              <div className="px-4 pb-3">
                <div className="flex items-center gap-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt={profile.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 items-center justify-around text-center">
                    <Stat value={String(profile.postCount)} label={t("grid.presentation.posts")} />
                    <Stat
                      value={f.followers(profile.followers)}
                      label={t("grid.presentation.followers")}
                    />
                    <Stat
                      value={profile.following.toLocaleString(INTL_LOCALE[locale])}
                      label={t("grid.presentation.following")}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold">{profile.name}</p>
                <p className="text-[11px] leading-snug whitespace-pre-line text-muted-foreground">
                  {profile.bio}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-px">
                {tiles.map((tile) => (
                  <PhoneTile key={tile.id} tile={tile} ratio={ratio} />
                ))}
              </div>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            <X />
            {t("grid.presentation.quit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <span className="block text-sm font-semibold tabular-nums">{value}</span>
      <span className="block text-[10px] text-muted-foreground">{label}</span>
    </span>
  )
}
