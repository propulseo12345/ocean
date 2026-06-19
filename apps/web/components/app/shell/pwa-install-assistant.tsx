"use client"

import { BellRing, Share, Smartphone, SquarePlus, X } from "lucide-react"
import { useEffect, useState } from "react"
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
import { type MessageKey, useT } from "@/lib/i18n"
import { useShell } from "./shell-provider"

// Assistant d'installation PWA iOS (P0) : bannière mobile dismissable +
// guide pas-à-pas illustré CSS. En preview, la détection iOS est simulée ;
// le guide reste accessible via le menu utilisateur (« Installer l'app »).

const DISMISS_KEY = "ocean_pwa_banner_dismissed"

const STEPS: { icon: typeof Share; titleKey: MessageKey; detailKey: MessageKey }[] = [
  { icon: Share, titleKey: "nav.pwa.step1Title", detailKey: "nav.pwa.step1Detail" },
  { icon: SquarePlus, titleKey: "nav.pwa.step2Title", detailKey: "nav.pwa.step2Detail" },
  { icon: BellRing, titleKey: "nav.pwa.step3Title", detailKey: "nav.pwa.step3Detail" },
]

export function PwaInstallAssistant() {
  const t = useT()
  const { pwaGuideOpen, setPwaGuideOpen } = useShell()
  // Bannière cachée avant montage (pas de flash) ; état persisté en localStorage.
  const [bannerVisible, setBannerVisible] = useState(false)

  useEffect(() => {
    setBannerVisible(window.localStorage.getItem(DISMISS_KEY) !== "1")
  }, [])

  function dismissBanner() {
    window.localStorage.setItem(DISMISS_KEY, "1")
    setBannerVisible(false)
  }

  function markInstalled() {
    toast.success(t("nav.pwa.installedToast"), {
      description: t("nav.pwa.installedToastDesc"),
    })
    setPwaGuideOpen(false)
    dismissBanner()
  }

  return (
    <>
      {bannerVisible ? (
        <div className="flex items-center gap-2.5 border-b bg-primary/5 px-3 py-2 md:hidden">
          <Smartphone className="size-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-xs leading-snug">
            <span className="font-medium">{t("nav.pwa.bannerTitle")}</span>{" "}
            <span className="text-muted-foreground">{t("nav.pwa.bannerSubtitle")}</span>
          </p>
          <Button size="xs" variant="outline" onClick={() => setPwaGuideOpen(true)}>
            {t("nav.pwa.seeHow")}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t("nav.pwa.bannerDismissAria")}
            onClick={dismissBanner}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <Dialog open={pwaGuideOpen} onOpenChange={setPwaGuideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("nav.pwa.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("nav.pwa.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <ol className="space-y-2">
            {STEPS.map((step, index) => (
              <li key={step.titleKey} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-4.5" />
                  <span className="absolute -top-1.5 -left-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t(step.titleKey)}</span>
                  <span className="block text-xs text-muted-foreground">{t(step.detailKey)}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium">{t("nav.pwa.whyTitle")}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              <li>{t("nav.pwa.why1")}</li>
              <li>{t("nav.pwa.why2")}</li>
              <li>{t("nav.pwa.why3")}</li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwaGuideOpen(false)}>
              {t("nav.pwa.later")}
            </Button>
            <Button onClick={markInstalled}>{t("nav.pwa.markInstalled")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
