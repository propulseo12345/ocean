import Image from "next/image"
import { FormatIcon } from "@/components/shared/format-icon"
import { useLocale, useT } from "@/lib/i18n"
import type { PillarSlice, PostRow } from "./perf-data"
import { compactNumber, percent } from "./perf-utils"

function TopCard({ post, rank }: { post: PostRow; rank: number }) {
  const t = useT()
  const { locale } = useLocale()
  const title = post.title
  return (
    <figure className="overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-square bg-muted">
        {post.thumbUrl ? (
          <Image
            src={post.thumbUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            className="object-cover"
          />
        ) : null}
        <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/65 text-xs font-semibold text-white backdrop-blur-sm">
          {rank}
        </span>
        <span className="absolute right-2 top-2 rounded-md bg-black/55 p-1 text-white backdrop-blur-sm">
          <FormatIcon format={post.format} className="size-3" />
        </span>
      </div>
      <figcaption className="space-y-1 p-2.5">
        <p className="truncate text-xs font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {t("report.highlights.stats", {
            reach: compactNumber(post.stats.reach, locale),
            engagement: compactNumber(post.engagement, locale),
          })}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {percent(post.engagementRate, locale)}
        </p>
      </figcaption>
    </figure>
  )
}

export function ReportHighlights({ posts }: { posts: PostRow[] }) {
  const t = useT()
  const top3 = [...posts].sort((a, b) => b.engagement - a.engagement).slice(0, 3)
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-base font-semibold">{t("report.highlights.title")}</h2>
      <div className="grid grid-cols-3 gap-3">
        {top3.map((p, i) => (
          <TopCard key={p.refId} post={p} rank={i + 1} />
        ))}
      </div>
    </section>
  )
}

export function ReportContentMix({ pillars }: { pillars: PillarSlice[] }) {
  const t = useT()
  const { locale } = useLocale()
  const active = pillars.filter((p) => p.engagementShare > 0)
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-base font-semibold">{t("report.mix.title")}</h2>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {active.map((p) => (
          <span
            key={p.id}
            style={{ width: `${p.engagementShare}%`, backgroundColor: p.colorVar }}
            title={t("report.mix.pillarTitle", {
              name: p.name,
              share: percent(p.engagementShare, locale, 0),
            })}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        {active.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: p.colorVar }}
              aria-hidden
            />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {percent(p.engagementShare, locale, 0)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
