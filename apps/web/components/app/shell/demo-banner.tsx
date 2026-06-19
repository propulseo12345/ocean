"use client"

import { Waves, X } from "lucide-react"
import { useEffect, useState } from "react"

// Bandeau « mode démo » : rappelle que l'app est une preview à données fictives.
// Masquable (mémorisé en local). SSR-safe : visible au 1er rendu serveur+client,
// l'effet ne fait que masquer après coup si déjà fermé (aucun mismatch).

const DISMISS_KEY = "ocean-demo-banner-dismissed"

export function DemoBanner() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") setHidden(true)
  }, [])

  if (hidden) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground">
      <Waves className="size-3.5 shrink-0" aria-hidden />
      <span>Mode démo — données fictives, aucune action n'est réellement enregistrée.</span>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1")
          setHidden(true)
        }}
        className="ml-1 rounded p-0.5 transition-colors hover:bg-primary-foreground/15"
        aria-label="Masquer le bandeau de démo"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
