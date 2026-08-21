"use client"

import { AlertTriangle, Check, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { type MessageKey, useT } from "@/lib/i18n"
import { REEL_MAX_MB } from "@/lib/specs"
import { cn } from "@/lib/utils"
import type { UploadItem } from "./use-media-upload"

// Liste de progression. Chaque cause d'échec a SA phrase : « échec » tout court
// oblige l'utilisateur à deviner s'il doit réessayer, changer de fichier, ou se
// reconnecter — et c'est précisément le message générique que le ticket V-4
// avait reproché aux écrans d'invitation.

const MESSAGES_ERREUR: Record<string, MessageKey> = {
  type_non_supporte: "library.upload.errType",
  image_trop_grosse: "library.upload.errImageTooBig",
  video_trop_grosse: "library.upload.errVideoTooBig",
  encore_trop_gros: "library.upload.errStillTooBig",
  decodage: "library.upload.errDecode",
  canvas: "library.upload.errDecode",
  session_expiree: "library.upload.errSession",
  thumb_refusee: "library.upload.errThumb",
  invalid_path: "library.upload.errPath",
  forbidden: "library.upload.errPath",
}

const PHASES: Record<UploadItem["phase"], MessageKey> = {
  preparation: "library.upload.phasePreparation",
  transfert: "library.upload.phaseTransfert",
  vignette: "library.upload.phaseVignette",
  enregistrement: "library.upload.phaseEnregistrement",
}

export function UploadQueue({
  items,
  onCancel,
  onDismiss,
}: {
  items: UploadItem[]
  onCancel: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const t = useT()
  if (items.length === 0) return null

  return (
    <ul className="space-y-2" aria-live="polite">
      {items.map((item) => {
        const pourcent = item.total > 0 ? Math.round((item.sent / item.total) * 100) : 0
        const enCours = item.state === "en_cours" || item.state === "attente"
        return (
          <li key={item.id} className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              {item.state === "termine" ? (
                <Check className="size-3.5 shrink-0 text-success" aria-hidden />
              ) : item.state === "echec" ? (
                <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden />
              ) : item.state === "en_cours" ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              ) : null}

              <span className="min-w-0 flex-1 truncate font-medium">{item.fileName}</span>

              <span className="shrink-0 text-muted-foreground tabular-nums">
                {item.state === "attente"
                  ? t("library.upload.queued")
                  : item.state === "en_cours"
                    ? t(PHASES[item.phase], { percent: pourcent })
                    : item.state === "termine"
                      ? t("library.upload.stateDone")
                      : item.state === "annule"
                        ? t("library.upload.stateCanceled")
                        : null}
              </span>

              <Button
                variant="ghost"
                size="xs"
                aria-label={enCours ? t("library.upload.cancel") : t("library.upload.dismiss")}
                onClick={() => (enCours ? onCancel(item.id) : onDismiss(item.id))}
              >
                <X />
              </Button>
            </div>

            {item.state === "en_cours" && item.phase === "transfert" ? (
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${pourcent}%` }}
                />
              </div>
            ) : null}

            {item.state === "echec" ? (
              <p className={cn("mt-1 text-destructive")}>
                {t(MESSAGES_ERREUR[item.error ?? ""] ?? "library.upload.errUpload", {
                  max: REEL_MAX_MB,
                })}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
