"use client"

import { Check, Copy, Inbox, Mail } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/lib/i18n"
import { buildDepositUrl } from "./library-utils"

// Lien de dépôt client (P1 audit §4) : le client envoie ses médias via un
// lien sécurisé reçu par email — ils arrivent dans « Reçus du client ».

const VALIDITY_OPTIONS = [7, 30, 90] as const
const COPY_FEEDBACK_MS = 2000

export function DepositLinkDialog({
  open,
  onOpenChange,
  clientName,
  clientHandle,
  receivedCount,
  onShowReceived,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string
  clientHandle: string
  receivedCount: number
  onShowReceived: () => void
}) {
  const t = useT()
  const [validity, setValidity] = useState<number>(30)
  const [copied, setCopied] = useState(false)
  const url = buildDepositUrl(clientHandle, validity)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t("library.deposit.copied"))
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
    } catch {
      toast.error(t("library.deposit.copyError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("library.deposit.title")}</DialogTitle>
          <DialogDescription>
            {t("library.deposit.description", { name: clientName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="deposit-url">{t("library.deposit.urlLabel")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="deposit-url"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label={t("library.deposit.copyAria")}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deposit-validity">{t("library.deposit.validityLabel")}</Label>
            <Select value={String(validity)} onValueChange={(value) => setValidity(Number(value))}>
              <SelectTrigger id="deposit-validity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALIDITY_OPTIONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {t("library.deposit.validityDays", { count: days })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("library.deposit.validityHint")}</p>
          </div>

          {receivedCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                onShowReceived()
                onOpenChange(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-info/30 bg-info/[0.04] px-3 py-2 text-left text-sm transition-colors hover:border-info/50"
            >
              <Inbox className="size-4 shrink-0 text-info" aria-hidden />
              <span>
                {t("library.deposit.received", { count: receivedCount })} —{" "}
                <span className="font-medium text-info">{t("library.deposit.seeInLibrary")}</span>
              </span>
            </button>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              toast.info(t("library.deposit.emailToastTitle"), {
                description: t("library.deposit.emailToastDesc", { count: validity }),
              })
            }
          >
            <Mail />
            {t("library.deposit.sendEmail")}
          </Button>
          <Button onClick={copy}>
            <Copy />
            {t("library.deposit.copyLink")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
