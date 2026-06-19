import { Circle, Film, Image as ImageIcon, Images, type LucideIcon } from "lucide-react"
import { formatMeta } from "@/lib/mocks/labels"
import type { ContentFormat } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

const ICONS: Record<ContentFormat, LucideIcon> = {
  post: ImageIcon,
  carousel: Images,
  reel: Film,
  story: Circle,
}

export function FormatIcon({ format, className }: { format: ContentFormat; className?: string }) {
  const Icon = ICONS[format]
  return <Icon className={cn("size-4", className)} aria-label={formatMeta[format].label} />
}

export function FormatLabel({ format, className }: { format: ContentFormat; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <FormatIcon format={format} className="size-3.5" />
      {formatMeta[format].label}
    </span>
  )
}
