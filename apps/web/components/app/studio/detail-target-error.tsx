"use client"

import { ImageOff, KeyRound, RotateCcw, SkipForward, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { type MessageKey, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

// Encart d'échec d'une cible : message, classification de l'erreur et
// actions de reprise ciblées. Une cible déjà publiée n'est JAMAIS republiée
// (idempotence) — seule la cible en échec est relancée.

type ErrorKind = "reauth" | "media" | "generic"

interface Classification {
  kind: ErrorKind
  causeKey: MessageKey
  actionKey: MessageKey
}

// Détection sur mots-clés FR et EN (le message d'erreur est localisé).
function classify(message: string | undefined): Classification {
  const text = (message ?? "").toLowerCase()
  if (
    text.includes("token") ||
    text.includes("reconnect") ||
    text.includes("jeton") ||
    text.includes("reconnecter")
  ) {
    return {
      kind: "reauth",
      causeKey: "studio.targetError.reauthCause",
      actionKey: "studio.targetError.reauthAction",
    }
  }
  if (
    text.includes("média") ||
    text.includes("media") ||
    text.includes("ratio") ||
    text.includes("refus") ||
    text.includes("reject")
  ) {
    return {
      kind: "media",
      causeKey: "studio.targetError.mediaCause",
      actionKey: "studio.targetError.mediaAction",
    }
  }
  return {
    kind: "generic",
    causeKey: "studio.targetError.genericCause",
    actionKey: "studio.targetError.genericAction",
  }
}

export function DetailTargetError({
  message,
  editHref,
  onRetry,
  onSkip,
}: {
  message?: string
  editHref: string
  onRetry: () => void
  onSkip: () => void
}) {
  const t = useT()
  const { kind, causeKey, actionKey } = classify(message)

  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
      <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
        <TriangleAlert className="mt-px size-3.5 shrink-0" />
        {message ?? t("studio.targetError.fallbackMessage")}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {t("studio.targetError.causeLine", { cause: t(causeKey), action: t(actionKey) })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="xs" onClick={onRetry}>
          <RotateCcw />
          {t("studio.targetError.retry")}
        </Button>
        {kind === "reauth" ? (
          <Button size="xs" variant="outline" render={<Link href={routes.settings} />}>
            <KeyRound />
            {t("studio.targetError.reconnect")}
          </Button>
        ) : null}
        {kind === "media" ? (
          <Button size="xs" variant="outline" render={<Link href={editHref} />}>
            <ImageOff />
            {t("studio.targetError.fixMedia")}
          </Button>
        ) : null}
        <Button size="xs" variant="ghost" onClick={onSkip}>
          <SkipForward />
          {t("studio.targetError.skip")}
        </Button>
      </div>
    </div>
  )
}
