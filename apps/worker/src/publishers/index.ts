import type { PublishPlatform } from "../domain"
import { facebookPublisher } from "./facebook"
import { instagramPublisher } from "./instagram"
import { tiktokPublisher } from "./tiktok"
import type { Publisher } from "./types"

// Résolution du publisher par plateforme. Actuellement 100 % STUB (déterministe,
// sans réseau) tant que les identifiants Meta/TikTok ne sont pas approuvés.

const PUBLISHERS: Record<PublishPlatform, Publisher> = {
  instagram: instagramPublisher,
  facebook: facebookPublisher,
  tiktok: tiktokPublisher,
}

export function resolvePublisher(platform: PublishPlatform): Publisher {
  return PUBLISHERS[platform]
}

/** true tant que les publishers sont en simulation (aucun POST réel). */
export const STUB_MODE = true
