import type { PublishPlatform } from "../domain"
import type { FetchLike } from "../http"
import { createFacebookPublisher } from "./facebook"
import { createInstagramPublisher } from "./instagram"
import { createStubPublisher } from "./stub"
import { createTikTokPublisher } from "./tiktok"
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
    facebook: createFacebookPublisher({ fetch: fetchImpl }),
    tiktok: createTikTokPublisher({ fetch: fetchImpl }),
  }
  return (platform) => map[platform]
}

/**
 * Plateformes dont le publisher est encore une simulation. Retirer une
 * plateforme de cette liste EN MÊME TEMPS que l'on branche son publisher réel —
 * c'est ce que lit la garde de démarrage du mode `live`.
 */
export const SIMULATED_PLATFORMS: readonly PublishPlatform[] = []

/**
 * Variables sans lesquelles `live` ne peut pas fonctionner, et pourquoi.
 *
 * Ce ne sont pas des variables « de confort » : chacune correspond à un chemin
 * qui échouerait à l'exécution, c'est-à-dire à 7 h du matin sur le contenu d'un
 * vrai client, avec un `failed` et un e-mail à la clé.
 */
const LIVE_REQUIRED_ENV: { name: string; why: string }[] = [
  { name: "OAUTH_META_CLIENT_ID", why: "re-echange du token long-lived Meta (regle 14)" },
  { name: "OAUTH_META_CLIENT_SECRET", why: "re-echange du token long-lived Meta (regle 14)" },
  { name: "OAUTH_TIKTOK_CLIENT_KEY", why: "rotation du refresh token TikTok (regle 14)" },
  { name: "OAUTH_TIKTOK_CLIENT_SECRET", why: "rotation du refresh token TikTok (regle 14)" },
  { name: "SUPABASE_URL", why: "signature des URL de media, bucket prive (regle 20)" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", why: "signature des URL de media, bucket prive (regle 20)" },
]

/**
 * Garde de démarrage du mode `live`. Deux refus, dans cet ordre.
 *
 * ① UN PUBLISHER ENCORE SIMULÉ. Sans ce test, `live` ferait tourner une
 *    simulation en croyant publier : `content_targets` passerait en 'published'
 *    avec un permalink https://stub.local/… sur de vrais contenus, et la cible
 *    ne serait plus ré-enfilable. La liste est vide depuis que les trois
 *    publishers sont réels ; le test reste, parce que la quatrième plateforme
 *    arrivera un jour et repassera par là.
 *
 * ② DES IDENTIFIANTS MANQUANTS. C'est le refus qui compte maintenant, et il
 *    doit tomber AU DÉMARRAGE. Un worker `live` sans identifiants Meta démarre
 *    parfaitement, tourne à vide toute la nuit, et échoue sur le PREMIER job à
 *    l'heure exacte où un client attend son post — moment où l'erreur est à la
 *    fois la plus coûteuse et la plus difficile à diagnostiquer. Le message
 *    NOMME les variables absentes : un refus qui n'apprend rien oblige à
 *    fouiller le code.
 *
 * ⚠ Ce que cette garde NE prouve PAS : que les identifiants sont VALIDES, ni
 * qu'une app Meta existe, ni qu'un compte est connecté. Elle vérifie la
 * présence, pas la vérité — seule une publication réelle prouverait la
 * seconde, et elle n'a jamais eu lieu.
 */
export function assertLivePublishersAvailable(env: NodeJS.ProcessEnv = process.env): void {
  if (SIMULATED_PLATFORMS.length > 0) {
    throw new Error(
      `PUBLISHERS_MODE=live refusé : ${SIMULATED_PLATFORMS.join(", ")} ` +
        "sont encore des publishers de simulation (apps/worker/src/publishers/stub.ts). " +
        "Les brancher en réel et vider SIMULATED_PLATFORMS avant d'activer live. " +
        "En attendant : dry-run en production, stub en local."
    )
  }

  const missing = LIVE_REQUIRED_ENV.filter(({ name }) => !env[name]?.trim())
  if (missing.length === 0) return
  throw new Error(
    "PUBLISHERS_MODE=live refusé : identifiants plateforme manquants.\n" +
      missing.map(({ name, why }) => `  - ${name} — ${why}`).join("\n") +
      "\nLes poser (Coolify) avant d'activer live, ou rester en dry-run. " +
      "Refuser ici plutôt qu'au premier job : un worker qui démarre puis échoue " +
      "a 7 h du matin coute infiniment plus cher qu'un conteneur qui ne part pas."
  )
}
