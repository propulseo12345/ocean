import type { SVGProps } from "react"
import type { CalendarProvider } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

// Glyphes calendrier neutres (lucide a retiré les logos de marque) —
// trait simple héritant currentColor, jamais de hex en dur.
function CalendarGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  )
}

const LABEL: Record<CalendarProvider, string> = {
  google: "Google Agenda",
  microsoft: "Microsoft Outlook",
}

export function CalendarProviderIcon({
  provider,
  className,
}: {
  provider: CalendarProvider
  className?: string
}) {
  return <CalendarGlyph className={cn("size-4", className)} aria-label={LABEL[provider]} />
}

export const calendarProviderLabel = LABEL
