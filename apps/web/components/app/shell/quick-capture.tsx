"use client"

import { ChevronRight, ImagePlus, Lightbulb, Plus, SquarePen } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ClientAvatar } from "@/components/shared/client-avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { getClients } from "@/lib/mocks"
import { routes } from "@/lib/routes"
import { useShell } from "./shell-provider"

// Capture rapide : FAB mobile (au-dessus de la safe-area iOS) → sheet
// « Noter une idée » (client cible + note) ou « Créer un contenu » (composer).

export function QuickCapture() {
  const t = useT()
  const { captureOpen, setCaptureOpen } = useShell()
  const clients = getClients()
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [note, setNote] = useState("")

  const targetClient = clients.find((c) => c.id === clientId)

  function saveIdea() {
    if (!note.trim() || !targetClient) return
    toast.success(t("nav.capture.ideaSaved", { client: targetClient.name }), {
      description: t("nav.capture.ideaSavedDesc"),
    })
    setNote("")
    setCaptureOpen(false)
  }

  function mockPhotoPicker() {
    toast.info(t("nav.capture.photoPicker"), {
      description: t("nav.capture.photoPickerDesc"),
    })
  }

  return (
    <>
      <Button
        size="icon-lg"
        aria-label={t("nav.capture.fabAria")}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] z-40 size-13 rounded-full shadow-lg md:hidden"
        onClick={() => setCaptureOpen(true)}
      >
        <Plus className="size-6" />
      </Button>

      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-2xl pb-[max(env(safe-area-inset-bottom,0px),1rem)]"
        >
          <SheetHeader className="pb-2">
            <SheetTitle>{t("nav.capture.title")}</SheetTitle>
            <SheetDescription>{t("nav.capture.description")}</SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="idea" className="px-4">
            <TabsList className="w-full">
              <TabsTrigger value="idea" className="flex-1 gap-1.5">
                <Lightbulb className="size-3.5" />
                {t("nav.capture.tabIdea")}
              </TabsTrigger>
              <TabsTrigger value="create" className="flex-1 gap-1.5">
                <SquarePen className="size-3.5" />
                {t("nav.capture.tabCreate")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="idea" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="capture-client">{t("nav.capture.targetClient")}</Label>
                <Select value={clientId} onValueChange={(value) => setClientId(String(value))}>
                  <SelectTrigger id="capture-client" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capture-note">{t("nav.capture.ideaLabel")}</Label>
                <Textarea
                  id="capture-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("nav.capture.ideaPlaceholder")}
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={mockPhotoPicker}>
                  <ImagePlus className="size-3.5" />
                  {t("nav.capture.addPhoto")}
                </Button>
                <Button size="sm" className="flex-1" disabled={!note.trim()} onClick={saveIdea}>
                  {t("nav.capture.saveIdea")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="create" className="pt-3">
              <ul className="divide-y rounded-lg border">
                {clients.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={routes.contentNew(c.id)}
                      onClick={() => setCaptureOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/60"
                    >
                      <ClientAvatar client={c} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t("nav.capture.newContent", { handle: c.handle })}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  )
}
