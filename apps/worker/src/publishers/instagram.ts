import { createStubPublisher } from "./stub"
import type { Publisher } from "./types"

// Instagram (Meta Graph, Standard Access). Flux réel à brancher quand les creds
// Meta seront approuvés (actuellement STUB) :
//   1. createContainer : POST /{ig-user-id}/media
//        image  -> image_url (JPEG signé 48h), caption
//        reel   -> media_type=REELS, video_url, caption  => renvoie {id} (creation_id)
//   2. (reel) attendre status_code=FINISHED : GET /{creation_id}?fields=status_code
//   3. markPublishStarted (règle 15) puis POST /{ig-user-id}/media_publish?creation_id=…
//   4. getContainerStatus (reprise) : GET /{creation_id}?fields=status_code
//        PUBLISHED => déjà publié ; IN_PROGRESS => attendre ; ERROR/EXPIRED => republier
//   Quota : GET /content_publishing_limit AVANT chaque post (règle 19).
//   Token : token de la PAGE parente (social_account_secrets), pas le token user.

export const instagramPublisher: Publisher = createStubPublisher({
  platform: "instagram",
  targetStatus: "published",
})
