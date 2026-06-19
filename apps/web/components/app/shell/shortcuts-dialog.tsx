"use client"

import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type MessageKey, useT } from "@/lib/i18n"
import { useShell } from "./shell-provider"

// Aide « Raccourcis clavier » (touche ?) : référence des raccourcis de l'app.

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

// Une « touche » est soit un symbole littéral (⌘, ←, T…), soit une clé i18n
// pour les libellés textuels (Échap, Sélectionner…), résolue à l'affichage.
interface ShortcutRow {
  keys: (string | { key: MessageKey })[]
  labelKey: MessageKey
}

const SECTIONS: { titleKey: MessageKey; rows: ShortcutRow[] }[] = [
  {
    titleKey: "nav.shortcuts.sectionGeneral",
    rows: [
      { keys: ["⌘", "K"], labelKey: "nav.shortcuts.globalSearch" },
      { keys: ["?"], labelKey: "nav.shortcuts.showHelp" },
      { keys: [{ key: "nav.shortcuts.keyEsc" }], labelKey: "nav.shortcuts.closePanel" },
    ],
  },
  {
    titleKey: "nav.shortcuts.sectionCalendar",
    rows: [
      { keys: ["←", "→"], labelKey: "nav.shortcuts.prevNextPeriod" },
      { keys: ["T"], labelKey: "nav.shortcuts.backToToday" },
      { keys: ["M"], labelKey: "nav.shortcuts.monthView" },
      { keys: ["S"], labelKey: "nav.shortcuts.weekView" },
    ],
  },
  {
    titleKey: "nav.shortcuts.sectionGrid",
    rows: [
      { keys: [{ key: "nav.shortcuts.keySelect" }], labelKey: "nav.shortcuts.selectMode" },
      { keys: [{ key: "nav.shortcuts.keyDrag" }], labelKey: "nav.shortcuts.reorderGrid" },
      { keys: [{ key: "nav.shortcuts.keyLongPress" }], labelKey: "nav.shortcuts.moveTile" },
    ],
  },
]

export function ShortcutsDialog() {
  const t = useT()
  const { shortcutsOpen, setShortcutsOpen } = useShell()

  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("nav.shortcuts.title")}</DialogTitle>
          <DialogDescription>
            {t("nav.shortcuts.replaceCmd")} <Kbd>⌘</Kbd> {t("nav.shortcuts.replaceCmdBy")}{" "}
            <Kbd>Ctrl</Kbd>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.titleKey} aria-label={t(section.titleKey)}>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t(section.titleKey)}
              </h3>
              <ul className="divide-y rounded-lg border">
                {section.rows.map((row) => (
                  <li
                    key={row.labelKey}
                    className="flex items-center justify-between gap-3 px-3 py-1.5"
                  >
                    <span className="text-sm">{t(row.labelKey)}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {row.keys.map((key) => {
                        const text = typeof key === "string" ? key : t(key.key)
                        return <Kbd key={text}>{text}</Kbd>
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
