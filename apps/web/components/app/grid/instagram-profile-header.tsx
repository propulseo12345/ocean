import { Clapperboard, Grid3x3, UserSquare } from "lucide-react"
import Image from "next/image"
import type { ReactNode } from "react"
import { formatFollowers } from "@/lib/format"
import { cn } from "@/lib/utils"

// Anneau « story » Instagram — chrome de marque (dégradé officiel).
const IG_RING = "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)"

export type ProfileTab = "posts" | "reels"

export interface InstagramProfileData {
  name: string
  handle: string
  category: string
  bio: string
  avatarUrl: string
  postCount: number
  followers: number
  following: number
  highlights: { label: string; cover: string }[]
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="font-heading text-base font-semibold tabular-nums sm:text-lg">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// Boutons Suivre / Message : chrome décoratif de la simulation de profil
// (signalé comme tel — audit §1.2), volontairement non interactif.
function ChromeButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return (
    <span
      aria-hidden
      title="Aperçu du profil — élément décoratif"
      className={cn(
        "inline-flex h-8 flex-1 cursor-default items-center justify-center rounded-lg text-sm font-medium select-none",
        primary ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      )}
    >
      {children}
    </span>
  )
}

export function InstagramProfileHeader({
  profile,
  activeTab = "posts",
  onTabChange,
  reelsCount = 0,
}: {
  profile: InstagramProfileData
  activeTab?: ProfileTab
  onTabChange?: (tab: ProfileTab) => void
  reelsCount?: number
}) {
  return (
    <header className="overflow-hidden rounded-xl border bg-card">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-4 sm:gap-7">
          <div className="shrink-0 rounded-full p-[3px]" style={{ background: IG_RING }}>
            <div className="rounded-full border-2 border-card">
              <div className="relative size-16 overflow-hidden rounded-full bg-muted sm:size-20">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={profile.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-around sm:justify-start sm:gap-9">
            <Stat value={profile.postCount} label="publications" />
            <Stat value={formatFollowers(profile.followers)} label="abonnés" />
            <Stat value={profile.following.toLocaleString("fr-FR")} label="abonnements" />
          </div>
        </div>

        <div className="mt-4 space-y-0.5 text-sm">
          <p className="font-semibold">{profile.name}</p>
          <p className="text-xs text-muted-foreground">{profile.category}</p>
          <p className="leading-snug whitespace-pre-line text-foreground/90">{profile.bio}</p>
          <p className="font-medium text-info">@{profile.handle}</p>
        </div>

        <div className="mt-3 flex gap-1.5">
          <ChromeButton primary>Suivre</ChromeButton>
          <ChromeButton>Message</ChromeButton>
        </div>

        {profile.highlights.length > 0 ? (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
            {profile.highlights.map((h) => (
              <div key={h.label} className="flex w-16 shrink-0 flex-col items-center gap-1">
                <div className="relative size-14 overflow-hidden rounded-full border bg-muted">
                  <Image src={h.cover} alt={h.label} fill sizes="56px" className="object-cover" />
                </div>
                <span className="w-full truncate text-center text-[11px]">{h.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 border-t text-muted-foreground" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "posts"}
          onClick={() => onTabChange?.("posts")}
          className={cn(
            "-mt-px flex items-center justify-center gap-1.5 border-t-2 py-2.5 text-[11px] font-semibold tracking-wide transition-colors",
            activeTab === "posts"
              ? "border-foreground text-foreground"
              : "border-transparent hover:text-foreground"
          )}
        >
          <Grid3x3 className="size-4" />
          PUBLICATIONS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "reels"}
          onClick={() => onTabChange?.("reels")}
          className={cn(
            "-mt-px flex items-center justify-center gap-1.5 border-t-2 py-2.5 text-[11px] font-semibold tracking-wide transition-colors",
            activeTab === "reels"
              ? "border-foreground text-foreground"
              : "border-transparent hover:text-foreground"
          )}
        >
          <Clapperboard className="size-4" />
          REELS
          {reelsCount > 0 ? <span className="tabular-nums">({reelsCount})</span> : null}
        </button>
        <span
          aria-hidden
          title="Aperçu du profil — onglet décoratif"
          className="flex items-center justify-center py-2.5"
        >
          <UserSquare className="size-4" />
        </span>
      </div>
    </header>
  )
}
