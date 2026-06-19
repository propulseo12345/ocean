import { initials } from "@/lib/format"
import type { Client } from "@/lib/mocks/types"
import { cn } from "@/lib/utils"

export function ClientAvatar({
  client,
  size = 36,
  className,
}: {
  client: Client
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-heading font-semibold text-white",
        className
      )}
      style={{
        backgroundColor: client.brandColor,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden
    >
      {initials(client.name)}
    </span>
  )
}
