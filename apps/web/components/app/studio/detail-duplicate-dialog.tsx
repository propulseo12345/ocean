"use client"

import { TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { duplicateContent } from "@/lib/actions/content"
import type { Client } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

// Duplication d'un contenu : copie pour le même client, ou vers un autre
// client avec adaptation des hashtags. Les médias ne traversent JAMAIS d'un
// client à l'autre (étanchéité par tenant) — re-sélection en médiathèque.
// Le titre arrive déjà résolu (string).

export function DetailDuplicateDialog({
  open,
  onOpenChange,
  clients,
  currentClientId,
  contentId,
  contentTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  currentClientId: string
  contentId: string
  contentTitle: string
}) {
  const t = useT()
  const router = useRouter()
  const [targetId, setTargetId] = useState(currentClientId)
  const [adaptHashtags, setAdaptHashtags] = useState(true)
  const [saving, setSaving] = useState(false)

  const target = clients.find((c) => c.id === targetId)
  const crossClient = targetId !== currentClientId

  async function confirm() {
    if (!target || saving) return
    setSaving(true)
    const res = await duplicateContent({
      sourceClientId: currentClientId,
      contentId,
      targetClientId: targetId,
      adaptHashtags,
    })
    setSaving(false)
    if (!res.ok || !res.data) {
      toast.error(t("studio.duplicate.error"))
      return
    }
    toast.success(t("studio.duplicate.done", { name: target.name }), {
      description: crossClient
        ? t("studio.duplicate.doneCross", {
            adapted: adaptHashtags ? t("studio.duplicate.doneCrossAdapted") : "",
          })
        : t("studio.duplicate.doneSame"),
    })
    onOpenChange(false)
    // On ouvre la copie (brouillon) dans le composer pour finaliser.
    router.push(routes.contentEdit(res.data.clientId, res.data.id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("studio.duplicate.title")}</DialogTitle>
          <DialogDescription className="truncate">{contentTitle}</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={targetId}
          onValueChange={(v) => setTargetId(String(v))}
          aria-label={t("studio.duplicate.destinationAria")}
          className="gap-1.5"
        >
          {clients.map((client) => (
            <Label
              key={client.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 font-normal has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
            >
              <RadioGroupItem value={client.id} />
              <ClientAvatar client={client} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {client.name}
                  {client.id === currentClientId ? t("studio.duplicate.thisClient") : ""}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{client.handle}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        <Label className="flex items-start gap-2 font-normal">
          <Checkbox
            checked={adaptHashtags}
            onCheckedChange={(checked) => setAdaptHashtags(checked === true)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm">{t("studio.duplicate.adaptHashtags")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("studio.duplicate.adaptHashtagsDesc")}
            </span>
          </span>
        </Label>

        {crossClient && target ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {t("studio.duplicate.crossClientWarning", { name: target.name })}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirm} disabled={saving}>
            {t("studio.duplicate.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
