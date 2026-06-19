"use client"

import { CoverCompareDialog, type CoverCompareTarget } from "./cover-compare-dialog"
import type { GridTileData } from "./grid-types"
import type { InstagramProfileData } from "./instagram-profile-header"
import { PresentationMode } from "./presentation-mode"
import type { GridViewState } from "./use-grid-view"
import { ValidateGridDialog } from "./validate-grid-dialog"

// Les trois dialogs de la grille : validation entière, comparateur de covers,
// mode présentation (cadre iPhone).
export function GridDialogs({
  view,
  validateOpen,
  onValidateOpenChange,
  plannedCount,
  reviewerName,
  coverTarget,
  onCloseCover,
  profile,
  presentationTiles,
}: {
  view: GridViewState
  validateOpen: boolean
  onValidateOpenChange: (open: boolean) => void
  plannedCount: number
  reviewerName: string | null
  coverTarget: CoverCompareTarget | null
  onCloseCover: () => void
  profile: InstagramProfileData
  presentationTiles: GridTileData[]
}) {
  return (
    <>
      <ValidateGridDialog
        open={validateOpen}
        onOpenChange={onValidateOpenChange}
        plannedCount={plannedCount}
        reviewerName={reviewerName}
        onConfirm={() => view.setValidationSent(true)}
      />
      <CoverCompareDialog target={coverTarget} onClose={onCloseCover} onPick={view.setCover} />
      <PresentationMode
        open={view.presentationOpen}
        onOpenChange={view.setPresentationOpen}
        profile={profile}
        tiles={presentationTiles}
        ratio={view.ratio}
      />
    </>
  )
}
