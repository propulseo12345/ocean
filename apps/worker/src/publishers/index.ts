import type { PublishPlatform } from "../domain"
import type { FetchLike } from "../http"
import { facebookPublisher } from "./facebook"
import { createInstagramPublisher } from "./instagram"
import { createStubPublisher } from "./stub"
import { tiktokPublisher } from "./tiktok"
import type { Publisher } from "./types"

// Résolution du publisher par plateforme.
//
// Le mode d'exécution n'est PAS une constante de compilation : il vient de
// PUBLISHERS_MODE (env.ts). Une constante n'est pas observable à l'exploitation —
// rien, ni dans les logs ni dans l'UI, ne disait que le worker en production
// était un simulateur.
//
// Le transport HTTP est un paramètre, pas une importation : c'est ce qui rend
// les publishers réels vérifiables contre un faux Graph API.

export type PublisherResolver = (platform: PublishPlatform) => Publisher

/** Simulations déterministes (voir ./stub.ts). Mode `stub`, base locale. */
export function createStubResolver(): PublisherResolver {
  const map: Record<PublishPlatform, Publisher> = {
    instagram: createStubPublisher({ platform: "instagram", targetStatus: "published" }),
    facebook: createStubPublisher({ platform: "facebook", targetStatus: "published" }),
    tiktok: createStubPublisher({ platform: "tiktok", targetStatus: "pushed_to_platform" }),
  }
  return (platform) => map[platform]
}

/** Publishers réels. Ceux qui ne le sont pas encore restent des simulations. */
export function createLiveResolver(fetchImpl: FetchLike): PublisherResolver {
  const map: Record<PublishPlatform, Publisher> = {
    instagram: createInstagramPublisher({ fetch: fetchImpl }),
    facebook: facebookPublisher,
    tiktok: tiktokPublisher,
  }
  return (platform) => map[platform]
}

/**
 * Plateformes dont le publisher est encore une simulation. Retirer une
 * plateforme de cette liste EN MÊME TEMPS que l'on branche son publisher réel —
 * c'est ce que lit la garde de démarrage du mode `live`.
 */
export const SIMULATED_PLATFORMS: readonly PublishPlatform[] = ["facebook", "tiktok"]

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
