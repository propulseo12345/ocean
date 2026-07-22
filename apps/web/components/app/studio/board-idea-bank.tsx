"use client"

import { ArrowLeft, Lightbulb, PenLine, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveContentItem } from "@/lib/actions/content"
import type { Client, ContentItem, ContentPillar } from "@/lib/domain"
import { useFormat, useT } from "@/lib/i18n"
import { routes } from "@/lib/routes"

// Banque d'idées du client : capture rapide (contenu réel status='idea'), tri
// par pilier éditorial et transformation d'une idée en brouillon via le composer.

const NO_PILLAR = "none"

interface IdeaEntry {
  id: string
  title: string
  caption: string
  pillarId?: string
  createdAt: string
  /** Lien vers le détail studio (toute idée est un content_item persisté). */
  contentId: string
}

function IdeaCard({ idea, client }: { idea: IdeaEntry; client: Client }) {
  const t = useT()
  const f = useFormat()
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <div className="min-w-0 flex-1 space-y-1">
        {idea.contentId ? (
          <Link
            href={routes.content(client.id, idea.contentId)}
            className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
          >
            {idea.title}
          </Link>
        ) : (
          <p className="line-clamp-2 text-sm font-medium leading-snug">{idea.title}</p>
        )}
        {idea.caption ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{idea.caption}</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {t("studio.ideaBank.noted", { ago: f.relative(idea.createdAt) })}
        </span>
        <Button
          variant="outline"
          size="xs"
          render={<Link href={routes.contentEdit(client.id, idea.contentId)} />}
        >
          <PenLine />
          {t("studio.ideaBank.transform")}
        </Button>
      </div>
    </div>
  )
}

export function BoardIdeaBank({
  client,
  ideas,
  pillars,
}: {
  client: Client
  ideas: ContentItem[]
  pillars: ContentPillar[]
}) {
  const t = useT()
  const router = useRouter()
  const [draft, setDraft] = useState("")
  const [pillarId, setPillarId] = useState<string>(NO_PILLAR)
  const [saving, setSaving] = useState(false)

  const entries: IdeaEntry[] = ideas.map((it) => ({
    id: it.id,
    title: it.title,
    caption: it.caption,
    pillarId: it.pillarId,
    createdAt: it.createdAt,
    contentId: it.id,
  }))

  // Capture réelle : crée un content_item status='idea' (saveContentItem). Pas
  // d'optimiste local — on rafraîchit pour lire la ligne canonique (l'idée
  // réapparaît dans `ideas`, filtré status='idea' côté serveur).
  async function capture() {
    const title = draft.trim()
    if (title.length === 0 || saving) return
    setSaving(true)
    const res = await saveContentItem({
      clientId: client.id,
      title,
      format: "post",
      state: "idea",
      caption: "",
      pillarId: pillarId === NO_PILLAR ? null : pillarId,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(t("studio.ideaBank.captureError"))
      return
    }
    setDraft("")
    setPillarId(NO_PILLAR)
    toast.success(t("studio.ideaBank.captured"), {
      description: t("studio.ideaBank.capturedDesc"),
    })
    router.refresh()
  }

  const known = new Set(pillars.map((p) => p.id))
  const sections: { pillar: ContentPillar | null; items: IdeaEntry[] }[] = [
    ...pillars.map((pillar) => ({
      pillar: pillar as ContentPillar | null,
      items: entries.filter((e) => e.pillarId === pillar.id),
    })),
    { pillar: null, items: entries.filter((e) => !e.pillarId || !known.has(e.pillarId)) },
  ].filter((s) => s.items.length > 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Lightbulb className="size-5 text-warning" />
            {t("studio.ideaBank.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.ideaBank.subtitle", { count: entries.length })}
          </p>
        </div>
        <Button variant="ghost" render={<Link href={routes.clientContent(client.id)} />}>
          <ArrowLeft />
          {t("studio.ideaBank.back")}
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-card/40 p-3 sm:flex-row sm:items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
          placeholder={t("studio.ideaBank.capturePlaceholder")}
          aria-label={t("studio.ideaBank.captureAria")}
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Select value={pillarId} onValueChange={(v) => setPillarId(String(v))}>
            <SelectTrigger size="sm" className="w-44" aria-label={t("studio.ideaBank.pillarAria")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PILLAR}>{t("studio.ideaBank.noPillar")}</SelectItem>
              {pillars.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={capture} disabled={draft.trim().length === 0 || saving}>
            <Plus />
            {t("studio.ideaBank.capture")}
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={t("studio.ideaBank.emptyTitle")}
          description={t("studio.ideaBank.emptyDescription")}
        />
      ) : (
        sections.map(({ pillar, items }) => (
          <section key={pillar?.id ?? NO_PILLAR} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: pillar?.colorVar ?? "var(--muted-foreground)" }}
              />
              {pillar ? pillar.name : t("studio.ideaBank.noPillar")}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {items.length}
              </span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} client={client} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
