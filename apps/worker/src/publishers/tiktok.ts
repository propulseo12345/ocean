import { createStubPublisher } from "./stub"
import type { Publisher } from "./types"

// TikTok = BROUILLON (scope video.upload). Flux réel à brancher (actuellement STUB) :
//   1. createContainer : POST /v2/post/publish/inbox/video/init/ (source=FILE_UPLOAD,
//      chunké depuis le worker — JAMAIS PULL_FROM_URL sur *.supabase.co) => publish_id
//   2. upload des chunks vidéo
//   3. le contenu arrive en BROUILLON dans l'app TikTok du créateur (pas publié) :
//      statut métier « pushed_to_platform » + notification « à finaliser ».
//   Limite : 5 brouillons/24h/créateur (règle 19, compteur local).
//   Reprise (règle 15) : GET /v2/post/publish/status/fetch/ ; le refresh token
//   TOURNE à chaque échange (rotation sous advisory lock, règle 14).

export const tiktokPublisher: Publisher = createStubPublisher({
  platform: "tiktok",
  targetStatus: "pushed_to_platform",
})
