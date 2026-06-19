"use client"

import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useShell } from "./shell-provider"

// Aide « Raccourcis clavier » (touche ?) : référence des raccourcis de l'app.

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

interface ShortcutRow {
  keys: string[]
  label: string
}

const SECTIONS: { title: string; rows: ShortcutRow[] }[] = [
  {
    title: "Général",
    rows: [
      { keys: ["⌘", "K"], label: "Recherche globale et palette de commandes" },
      { keys: ["?"], label: "Afficher cette aide" },
      { keys: ["Échap"], label: "Fermer le panneau ou la fenêtre en cours" },
    ],
  },
  {
    title: "Calendrier éditorial",
    rows: [
      { keys: ["←", "→"], label: "Période précédente / suivante" },
      { keys: ["T"], label: "Revenir à aujourd'hui" },
      { keys: ["M"], label: "Vue mois" },
      { keys: ["S"], label: "Vue semaine" },
    ],
  },
  {
    title: "Grille et listes",
    rows: [
      { keys: ["Sélectionner"], label: "Mode sélection pour les actions par lot" },
      { keys: ["Glisser"], label: "Réordonner la grille ou replanifier une date" },
      { keys: ["Appui long"], label: "Déplacer une tuile sur mobile" },
    ],
  },
]

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useShell()

  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier</DialogTitle>
          <DialogDescription>
            Sur Windows et Linux, remplace <Kbd>⌘</Kbd> par <Kbd>Ctrl</Kbd>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title} aria-label={section.title}>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{section.title}</h3>
              <ul className="divide-y rounded-lg border">
                {section.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3 px-3 py-1.5"
                  >
                    <span className="text-sm">{row.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {row.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
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
