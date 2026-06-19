"use client"

import { UserRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

// Bandeau du mode démo prospect : rappelle que l'identité affichée est fictive.
export function DemoBanner({ onQuit }: { onQuit: () => void }) {
  const t = useT()
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm"
    >
      <UserRound className="size-4 shrink-0 text-info" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">{t("grid.demoBanner.title")}</span>
        <span className="text-muted-foreground">{t("grid.demoBanner.description")}</span>
      </p>
      <Button variant="ghost" size="xs" onClick={onQuit}>
        <X />
        {t("grid.demoBanner.quit")}
      </Button>
    </div>
  )
}
