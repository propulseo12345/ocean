"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useShell } from "./shell-provider"

// Loupe du header (mobile) : ouvre la palette de commandes ⌘K.

export function HeaderSearchButton() {
  const t = useT()
  const { setPaletteOpen } = useShell()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("nav.searchAria")}
      className="md:hidden"
      onClick={() => setPaletteOpen(true)}
    >
      <Search className="size-4" />
    </Button>
  )
}
