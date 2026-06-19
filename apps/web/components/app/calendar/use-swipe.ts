"use client"

import { useCallback, useRef } from "react"
import { SWIPE_THRESHOLD_PX } from "./calendar-types"

// Geste swipe horizontal (mobile) pour changer de période. Volontairement
// simple : delta X au relâchement, ignoré si le geste est surtout vertical.

export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const from = start.current
      start.current = null
      if (!from) return
      const t = e.changedTouches[0]
      const dx = t.clientX - from.x
      const dy = t.clientY - from.y
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
      if (dx < 0) onLeft()
      else onRight()
    },
    [onLeft, onRight]
  )

  return { onTouchStart, onTouchEnd }
}
