import { createStubPublisher } from "./stub"
import type { Publisher } from "./types"

// Facebook Pages (Meta Graph). Flux réel à brancher (actuellement STUB) :
//   - photo  : POST /{page-id}/photos (url + caption) => post_id direct
//   - reel   : API Reels en 3 temps (start -> upload -> finish) ; 30 Reels/24h/Page
//   Le « conteneur » ici est le brouillon de post ; getContainerStatus mappe l'état
//   de la publication. Quota : header X-Business-Use-Case-Usage (règle 19).
//   Token : token de la Page (jamais le token user).

export const facebookPublisher: Publisher = createStubPublisher({
  platform: "facebook",
  targetStatus: "published",
})
