"use client"

import { CloudUpload } from "lucide-react"
import { useId, useState } from "react"

import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// La vraie zone de dépôt — celle d'avant était un `<button>` qui jetait
// `e.dataTransfer` sans jamais le lire, et il n'existait aucun
// `<input type="file">` dans les 425 fichiers de `apps/web`.
//
// POURQUOI UN `<label>` ET PAS UN `<button>`
// -------------------------------------------
// Un `<button>` ne peut pas ouvrir le sélecteur de fichiers sans JavaScript, et
// surtout il n'est pas la cible d'accessibilité de l'input. Un `<label>` lié à
// un `<input type="file">` visuellement masqué donne les deux gratuitement : le
// clic ouvre le sélecteur, le focus clavier arrive sur l'input, et les lecteurs
// d'écran annoncent « bouton Parcourir, champ fichier ».

/** Types acceptés par le bucket `media-originals` (022_media_storage.sql). */
export const ACCEPT_MEDIA = "image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime"

export function MediaDropzone({
  onFiles,
  multiple = true,
  disabled = false,
  compact = false,
  className,
}: {
  onFiles: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  /** Variante réduite, pour le composer où la place est comptée. */
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  function déposer(liste: FileList | null) {
    setDragging(false)
    if (disabled || !liste || liste.length === 0) return
    const fichiers = Array.from(liste)
    onFiles(multiple ? fichiers : fichiers.slice(0, 1))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        // C'est ICI que `e.dataTransfer` est enfin lu.
        déposer(e.dataTransfer.files)
      }}
      className={className}
    >
      <input
        id={inputId}
        type="file"
        accept={ACCEPT_MEDIA}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          déposer(e.target.files)
          // Remis à zéro : sans ça, redéposer le MÊME fichier après un échec
          // n'émet aucun `change` et l'écran paraît figé.
          e.target.value = ""
        }}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors focus-within:ring-2 focus-within:ring-ring",
          compact ? "px-4 py-6" : "px-6 py-10",
          disabled && "pointer-events-none opacity-50",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/40"
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <span className="text-sm font-medium">{t("library.upload.dropTitle")}</span>
        <span className="text-xs text-muted-foreground">{t("library.upload.dropHint")}</span>
      </label>
    </div>
  )
}
