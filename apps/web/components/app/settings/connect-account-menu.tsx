"use client"

import { Plus } from "lucide-react"
import { PlatformIcon } from "@/components/shared/platform-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Platform } from "@/lib/domain"
import { useT } from "@/lib/i18n"

// Démarre une connexion OAuth pour un client. Instagram + Facebook passent par
// Meta (Facebook Login) ; TikTok a son propre provider. Le lien est une
// navigation pleine page vers le Route Handler /api/oauth/<provider> (qui 302 vers
// le fournisseur) — surtout PAS un <Link> client (l'API renvoie une redirection).

const CHOICES: { platform: Platform; provider: "meta" | "tiktok" }[] = [
  { platform: "instagram", provider: "meta" },
  { platform: "facebook", provider: "meta" },
  { platform: "tiktok", provider: "tiktok" },
]

export function ConnectAccountMenu({ clientId }: { clientId: string }) {
  const t = useT()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Plus />
        {t("settings.accounts.connect")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {CHOICES.map(({ platform, provider }) => (
          <DropdownMenuItem
            key={platform}
            render={<a href={`/api/oauth/${provider}?clientId=${clientId}`} />}
          >
            <PlatformIcon platform={platform} className="size-4" />
            {t("settings.accounts.connectPlatform", { platform: platformName(platform) })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function platformName(platform: Platform): string {
  switch (platform) {
    case "instagram":
      return "Instagram"
    case "facebook":
      return "Facebook"
    case "tiktok":
      return "TikTok"
    default:
      return platform
  }
}
