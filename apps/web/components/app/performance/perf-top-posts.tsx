import { ArrowDownRight, ArrowUpRight, ExternalLink, Pencil } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { FormatIcon } from "@/components/shared/format-icon"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLocale, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PostRow } from "./perf-data"
import { compactNumber, percent } from "./perf-utils"

function PostLine({ post, rank }: { post: PostRow; rank: number }) {
  const t = useT()
  const { locale } = useLocale()
  const title = post.title
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
      <span className="w-4 shrink-0 text-center font-heading text-sm font-semibold text-muted-foreground tabular-nums">
        {rank}
      </span>
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {post.thumbUrl ? (
          <Image src={post.thumbUrl} alt={title} fill sizes="48px" className="object-cover" />
        ) : null}
        <span className="absolute right-0.5 bottom-0.5 rounded bg-black/55 p-0.5 text-white backdrop-blur-sm">
          <FormatIcon format={post.format} className="size-2.5" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
          <span>
            {t("performance.posts.reachSuffix", { value: compactNumber(post.stats.reach, locale) })}
          </span>
          <span>
            {t("performance.posts.engagementSuffix", {
              value: compactNumber(post.engagement, locale),
            })}
          </span>
          <span>{percent(post.engagementRate, locale)}</span>
          <span className="inline-flex items-center gap-1">
            {post.platforms.slice(0, 3).map((p) => (
              <PlatformIcon key={p} platform={p} className="size-3" />
            ))}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {post.href ? (
          <Link
            href={post.href}
            aria-label={t("performance.posts.openInStudio", { title })}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </Link>
        ) : null}
        {post.permalink ? (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            aria-label={t("performance.posts.viewOnInstagram", { title })}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </li>
  )
}

function PostBlock({
  title,
  icon: Icon,
  tone,
  posts,
  startRank,
}: {
  title: string
  icon: typeof ArrowUpRight
  tone: "success" | "danger"
  posts: PostRow[]
  startRank: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon
            className={cn("size-4", tone === "success" ? "text-success" : "text-destructive")}
          />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {posts.map((p, i) => (
            <PostLine key={p.refId} post={p} rank={startRank + i} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

const TOP_COUNT = 4
const FLOP_COUNT = 3

export function PerfTopPosts({ posts }: { posts: PostRow[] }) {
  const t = useT()
  const byEngagement = [...posts].sort((a, b) => b.engagement - a.engagement)
  const tops = byEngagement.slice(0, TOP_COUNT)
  // Borne le flop pour exclure les tops : aucun post n'apparaît dans les deux
  // colonnes, même avec ≤ 6 publications mesurées.
  const flops = byEngagement.slice(Math.max(TOP_COUNT, byEngagement.length - FLOP_COUNT)).reverse()
  return (
    <div className={cn("grid gap-4", flops.length > 0 && "lg:grid-cols-2")}>
      <PostBlock
        title={t("performance.posts.topTitle")}
        icon={ArrowUpRight}
        tone="success"
        posts={tops}
        startRank={1}
      />
      {flops.length > 0 ? (
        <PostBlock
          title={t("performance.posts.flopTitle")}
          icon={ArrowDownRight}
          tone="danger"
          posts={flops}
          startRank={1}
        />
      ) : null}
    </div>
  )
}
