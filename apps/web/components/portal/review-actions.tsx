"use client"

import { Check, MessageSquarePlus, Send } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function ReviewActions({ contentTitle }: { contentTitle: string }) {
  const [mode, setMode] = useState<"idle" | "changes">("idle")
  const [message, setMessage] = useState("")

  const recorded = (label: string) => {
    toast.success("Décision enregistrée", {
      description: `${label} — « ${contentTitle} » (action simulée, preview).`,
    })
    setMode("idle")
    setMessage("")
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          size="lg"
          className="bg-success text-white hover:bg-success/90"
          onClick={() => recorded("Contenu approuvé")}
        >
          <Check />
          Approuver
        </Button>
        <Button
          size="lg"
          variant={mode === "changes" ? "secondary" : "outline"}
          onClick={() => setMode(mode === "changes" ? "idle" : "changes")}
        >
          <MessageSquarePlus />
          Demander des modifications
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-all",
          mode === "changes" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-1">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Expliquez ce qui doit être ajusté (texte, visuel, date…)"
              rows={3}
              aria-label="Message de demande de modifications"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("idle")}>
                Annuler
              </Button>
              <Button
                onClick={() => recorded("Modifications demandées")}
                disabled={message.trim().length === 0}
              >
                <Send />
                Envoyer la demande
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Votre décision est enregistrée et votre agence en est informée immédiatement.
      </p>
    </div>
  )
}
