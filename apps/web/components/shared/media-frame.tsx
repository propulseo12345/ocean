"use client"

import Image from "next/image"

import type { MediaType } from "@/lib/domain"
import { cn } from "@/lib/utils"

/**
 * Le strict nécessaire pour afficher un média en grand.
 *
 * Volontairement plus étroit que `MediaAsset` : les appelants passent aussi des
 * `LibraryAsset` et des `ComposerMedia`, qui n'ont pas de `position`. Exiger le
 * type complet obligerait à fabriquer des champs dont ce composant ne fait rien.
 */
export type FramedMedia = {
  id: string
  type: MediaType
  fullUrl: string
  thumbUrl: string
}

// Ticket P5-11 — il n'existait AUCUN `<video>` dans `apps/web`.
//
// Les cinq surfaces qui affichent un média en grand rendaient toutes un
// `<Image src={fullUrl}>`, y compris quand `type === "video"`. Or `fullUrl`
// pointe alors un MP4 : `next/image` ne sait pas le décoder, le cadre reste
// vide, et le seul indice est un badge « Vidéo » posé par-dessus.
//
// Conséquence : **le client approuve un Reel qu'il n'a jamais vu.** C'est le
// format que le produit met en avant, et le geste que le portail existe pour
// rendre possible.
//
// La vignette (`MediaThumb`) reste une image : c'est correct, une tuile de
// grille n'a pas à charger une vidéo. Seul l'affichage plein cadre change.

export function MediaFrame({
  media,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 640px",
  priority = false,
}: {
  media: FramedMedia
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
}) {
  if (media.type === "video") {
    return (
      // `controls` : le client doit pouvoir revenir en arrière sur un détail —
      // c'est la raison d'être de l'écran. `playsInline` évite le passage en
      // plein écran forcé sur iPhone, qui est la cible prioritaire du produit.
      // `preload="metadata"` charge la durée et la première image sans tirer
      // tout le fichier : un Reel pèse jusqu'à 300 Mo.
      // biome-ignore lint/a11y/useMediaCaption: média client, aucune piste de sous-titres n'existe à ce stade
      <video
        key={media.id}
        src={media.fullUrl}
        poster={media.thumbUrl || undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
        className={cn("size-full bg-black object-contain", className)}
      />
    )
  }

  return (
    <Image
      key={media.id}
      src={media.fullUrl}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  )
}
