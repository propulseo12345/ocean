"use client"

import { BellRing, Share, Smartphone, SquarePlus, X } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
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
import { useShell } from "./shell-provider"

// Assistant d'installation PWA iOS (P0) : bannière mobile dismissable +
// guide pas-à-pas illustré CSS. En preview, la détection iOS est simulée ;
// le guide reste accessible via le menu utilisateur (« Installer l'app »).

const DISMISS_KEY = "ocean_pwa_banner_dismissed"

const STEPS: { icon: typeof Share; title: string; detail: ReactNode }[] = [
  {
    icon: Share,
    title: "Touche « Partager » dans Safari",
    detail: "Le carré avec la flèche vers le haut, au centre de la barre d'outils.",
  },
  {
    icon: SquarePlus,
    title: "« Sur l'écran d'accueil »",
    detail: "Fais défiler la liste, puis confirme avec « Ajouter ». Ocean s'ouvre en plein écran.",
  },
  {
    icon: BellRing,
    title: "Active les notifications push",
    detail: "Au premier lancement, autorise les notifications (iOS 18.4 ou plus récent).",
  },
]

export function PwaInstallAssistant() {
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
    toast.success("Installation marquée comme faite (aperçu)", {
      description: "En production, Ocean détectera le mode plein écran automatiquement.",
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
            <span className="font-medium">Installe Ocean sur ton iPhone</span>{" "}
            <span className="text-muted-foreground">
              — alertes d'échec de publication en temps réel.
            </span>
          </p>
          <Button size="xs" variant="outline" onClick={() => setPwaGuideOpen(true)}>
            Voir comment
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Masquer la bannière d'installation"
            onClick={dismissBanner}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <Dialog open={pwaGuideOpen} onOpenChange={setPwaGuideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Installer Ocean sur ton iPhone</DialogTitle>
            <DialogDescription>
              Trois étapes dans Safari, sans App Store. Déjà installée ? Ouvre Ocean depuis ton
              écran d'accueil.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-2">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-4.5" />
                  <span className="absolute -top-1.5 -left-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="block text-xs text-muted-foreground">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium">Pourquoi installer l'app ?</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              <li>Alerte immédiate si une publication échoue chez un client.</li>
              <li>Notification quand un contenu est approuvé ou commenté.</li>
              <li>Rappel des brouillons TikTok à finaliser à l'heure planifiée.</li>
            </ul>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwaGuideOpen(false)}>
              Plus tard
            </Button>
            <Button onClick={markInstalled}>J'ai installé l'app (aperçu)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
