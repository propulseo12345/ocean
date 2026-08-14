import type { PublishPlatform } from "../domain"
import { facebookPublisher } from "./facebook"
import { instagramPublisher } from "./instagram"
import { tiktokPublisher } from "./tiktok"
import type { Publisher } from "./types"

// Résolution du publisher par plateforme. Les trois implémentations sont
// aujourd'hui des simulations déterministes (voir ./stub.ts) tant que les
// identifiants Meta/TikTok ne sont pas approuvés.
//
// Le mode d'exécution n'est PLUS une constante de compilation : il vient de
// PUBLISHERS_MODE (env.ts). Une constante n'est pas observable à l'exploitation —
// rien, ni dans les logs ni dans l'UI, ne disait que le worker en production
// était un simulateur.

const PUBLISHERS: Record<PublishPlatform, Publisher> = {
  instagram: instagramPublisher,
  facebook: facebookPublisher,
  tiktok: tiktokPublisher,
}

export function resolvePublisher(platform: PublishPlatform): Publisher {
  return PUBLISHERS[platform]
}

/**
 * Plateformes dont le publisher est encore une simulation. Phase 6 : retirer une
 * plateforme de cette liste EN MÊME TEMPS que l'on branche son publisher réel —
 * c'est la seule chose qui autorise `PUBLISHERS_MODE=live`.
 */
export const SIMULATED_PLATFORMS: readonly PublishPlatform[] = ["instagram", "facebook", "tiktok"]

/**
 * Garde de démarrage du mode `live`. Sans elle, `PUBLISHERS_MODE=live` ferait
 * tourner les simulations en croyant publier : `content_targets` passerait en
 * 'published' avec un permalink https://stub.local/… sur de vrais contenus, et
 * la cible ne serait plus ré-enfilable. Refus de démarrer, message explicite.
 */
export function assertLivePublishersAvailable(): void {
  if (SIMULATED_PLATFORMS.length === 0) return
  throw new Error(
    `PUBLISHERS_MODE=live refusé : ${SIMULATED_PLATFORMS.join(", ")} ` +
      "sont encore des publishers de simulation (apps/worker/src/publishers/stub.ts). " +
      "Les brancher en réel (phase 6) et vider SIMULATED_PLATFORMS avant d'activer live. " +
      "En attendant : dry-run en production, stub en local."
  )
}
