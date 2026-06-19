"use client"

import { useEffect, useMemo } from "react"
import type { ContentItem } from "@/lib/mocks/types"
import {
  accountIssueContentIds,
  cadenceGaps,
  igDensityByDay,
  nextWeekIsEmpty,
  pillarMix,
  waitingDaysByContent,
} from "./calendar-insights"
import type { CalendarData } from "./calendar-types"
import type { CalendarState } from "./use-calendar-state"

// Données dérivées du calendrier (insights) + raccourcis clavier, extraits de
// l'orchestrateur pour rester sous la barre des 250 lignes par fichier.

const EVERGREEN_LABEL = "Evergreen"
const HIDDEN_FROM_UPCOMING: ContentItem["status"][] = ["published", "canceled", "failed"]

export function useCalendarDerived(s: CalendarState, props: CalendarData) {
  const gaps = useMemo(() => cadenceGaps(s.inMonthDays, s.allByDay), [s.inMonthDays, s.allByDay])
  const density = useMemo(() => igDensityByDay(s.allByDay), [s.allByDay])
  const accountIssues = useMemo(
    () => accountIssueContentIds(s.effectiveItems, props.accounts),
    [s.effectiveItems, props.accounts]
  )
  const waiting = useMemo(
    () => waitingDaysByContent(s.effectiveItems, props.reviewSentAt),
    [s.effectiveItems, props.reviewSentAt]
  )
  const mixRows = useMemo(
    () => pillarMix(s.monthItems, props.pillars),
    [s.monthItems, props.pillars]
  )
  const weekEmpty = useMemo(() => nextWeekIsEmpty(s.datedItems, s.tz), [s.datedItems, s.tz])
  const pillarById = useMemo(() => new Map(props.pillars.map((p) => [p.id, p])), [props.pillars])
  const evergreenItems = useMemo(
    // Les labels sont du contenu bilingue ; « Evergreen » est un tag identique FR/EN.
    () => s.effectiveItems.filter((it) => it.labels?.some((l) => l.fr === EVERGREEN_LABEL)),
    [s.effectiveItems]
  )
  const upcomingByAccount = useMemo(() => {
    const out = new Map<string, number>()
    for (const it of s.datedItems) {
      if (HIDDEN_FROM_UPCOMING.includes(it.status)) continue
      for (const t of it.targets) {
        if (t.socialAccountId) out.set(t.socialAccountId, (out.get(t.socialAccountId) ?? 0) + 1)
      }
    }
    return out
  }, [s.datedItems])

  return {
    gaps,
    density,
    accountIssues,
    waiting,
    mixRows,
    weekEmpty,
    pillarById,
    evergreenItems,
    upcomingByAccount,
  }
}

/** Raccourcis clavier : ← → période · T aujourd'hui · M/S vue. */
export function useCalendarShortcuts(s: CalendarState) {
  const { goPrev, goNext, goToday, setView } = s
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return
      if (e.key === "ArrowLeft") goPrev()
      else if (e.key === "ArrowRight") goNext()
      else if (e.key === "t" || e.key === "T") goToday()
      else if (e.key === "m" || e.key === "M") setView("month")
      else if (e.key === "s" || e.key === "S") setView("week")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goPrev, goNext, goToday, setView])
}
