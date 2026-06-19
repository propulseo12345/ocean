import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

// En-tête de section uniforme pour les réglages client (titre + icône + aide).

export function SectionCard({
  icon: Icon,
  title,
  description,
  action,
  children,
  contentClassName,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  contentClassName?: string
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

// Pied de section « état non enregistré » + bouton d'aperçu, factorisé.
export function SaveBar({
  dirty,
  onSave,
  className,
}: {
  dirty: boolean
  onSave: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground",
        className
      )}
    >
      <span>{dirty ? "Modifications non enregistrées." : "Tout est à jour."}</span>
      <Button size="sm" disabled={!dirty} onClick={onSave}>
        Enregistrer (aperçu)
      </Button>
    </div>
  )
}
