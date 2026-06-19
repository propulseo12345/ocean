"use client"

import { usePathname } from "next/navigation"
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

// État partagé de la coquille applicative : palette ⌘K, aide raccourcis « ? »,
// capture rapide mobile, guide d'installation PWA et clients récents.

const RECENTS_MAX = 4

type OpenSetter = Dispatch<SetStateAction<boolean>>

interface ShellState {
  paletteOpen: boolean
  setPaletteOpen: OpenSetter
  shortcutsOpen: boolean
  setShortcutsOpen: OpenSetter
  captureOpen: boolean
  setCaptureOpen: OpenSetter
  pwaGuideOpen: boolean
  setPwaGuideOpen: OpenSetter
  /** Ids des clients visités récemment (le plus récent en premier). */
  recentClientIds: string[]
}

const ShellContext = createContext<ShellState | null>(null)

export function useShell(): ShellState {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error("useShell doit être utilisé sous <ShellProvider>")
  return ctx
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [pwaGuideOpen, setPwaGuideOpen] = useState(false)
  const [recentClientIds, setRecentClientIds] = useState<string[]>([])

  // Clients récents, suivis depuis l'URL (état local de session).
  useEffect(() => {
    const id = pathname.match(/^\/clients\/([^/?#]+)/)?.[1]
    if (!id || id === "new") return
    setRecentClientIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, RECENTS_MAX))
  }, [pathname])

  // Raccourcis globaux : ⌘K / Ctrl+K (palette) et « ? » (aide raccourcis).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !isEditableTarget(e.target)) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const value = useMemo<ShellState>(
    () => ({
      paletteOpen,
      setPaletteOpen,
      shortcutsOpen,
      setShortcutsOpen,
      captureOpen,
      setCaptureOpen,
      pwaGuideOpen,
      setPwaGuideOpen,
      recentClientIds,
    }),
    [paletteOpen, shortcutsOpen, captureOpen, pwaGuideOpen, recentClientIds]
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}
