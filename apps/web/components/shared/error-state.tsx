import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function RetryButton({
  onClick,
  label = "Reessayer",
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {label}
    </Button>
  )
}
