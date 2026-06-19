"use client"

import { ImageOff, KeyRound, RotateCcw, SkipForward, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { routes } from "@/lib/routes"

// Encart d'échec d'une cible : message, classification de l'erreur et
// actions de reprise ciblées. Une cible déjà publiée n'est JAMAIS republiée
// (idempotence) — seule la cible en échec est relancée.

type ErrorKind = "reauth" | "media" | "generic"

interface Classification {
  kind: ErrorKind
  cause: string
  action: string
}

function classify(message: string | undefined): Classification {
  const text = (message ?? "").toLowerCase()
  if (text.includes("token") || text.includes("reconnect") || text.includes("jeton")) {
    return {
      kind: "reauth",
      cause: "Jeton d'accès expiré — erreur permanente, pas de relance automatique",
      action: "reconnecter le compte",
    }
  }
  if (
    text.includes("média") ||
    text.includes("media") ||
    text.includes("ratio") ||
    text.includes("refus")
  ) {
    return {
      kind: "media",
      cause: "Média refusé par la plateforme — erreur permanente, pas de relance automatique",
      action: "corriger le média",
    }
  }
  return {
    kind: "generic",
    cause: "Erreur de publication",
    action: "relancer la cible",
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
  const { kind, cause, action } = classify(message)

  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
      <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
        <TriangleAlert className="mt-px size-3.5 shrink-0" />
        {message ?? "Échec de publication sur cette cible."}
      </p>
      <p className="text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">{cause}.</span> Action recommandée :{" "}
        {action}.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="xs" onClick={onRetry}>
          <RotateCcw />
          Relancer cette cible (aperçu)
        </Button>
        {kind === "reauth" ? (
          <Button size="xs" variant="outline" render={<Link href={routes.settings} />}>
            <KeyRound />
            Reconnecter le compte
          </Button>
        ) : null}
        {kind === "media" ? (
          <Button size="xs" variant="outline" render={<Link href={editHref} />}>
            <ImageOff />
            Corriger le média
          </Button>
        ) : null}
        <Button size="xs" variant="ghost" onClick={onSkip}>
          <SkipForward />
          Ignorer
        </Button>
      </div>
    </div>
  )
}
