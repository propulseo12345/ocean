import { Mail, Megaphone } from "lucide-react"
import type { ComponentType, SVGProps } from "react"
import { platformMeta } from "@/lib/mocks/labels"
import type { Platform } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"
import { FacebookIcon, InstagramIcon, TiktokIcon } from "./brand-icons"

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

const ICONS: Record<Platform, IconComp> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TiktokIcon,
  newsletter: Mail,
  custom: Megaphone,
}

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = ICONS[platform]
  return (
    <Icon
      className={cn("size-4", className)}
      style={{ color: platformMeta[platform].colorVar }}
      aria-label={platformMeta[platform].label}
    />
  )
}

export function PlatformDot({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full", className)}
      style={{ backgroundColor: platformMeta[platform].colorVar }}
    />
  )
}

export function PlatformBadge({
  platform,
  showLabel = true,
  className,
}: {
  platform: Platform
  showLabel?: boolean
  className?: string
}) {
  const m = platformMeta[platform]
  const Icon = ICONS[platform]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      <Icon className="size-3" style={{ color: m.colorVar }} />
      {showLabel ? m.label : null}
    </span>
  )
}

export function PlatformIcons({
  platforms,
  className,
}: {
  platforms: Platform[]
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {platforms.map((p) => (
        <PlatformIcon key={p} platform={p} className="size-3.5" />
      ))}
    </span>
  )
}
