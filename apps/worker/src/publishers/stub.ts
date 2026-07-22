import type { PublishJob, TerminalTargetStatus } from "../domain"
import type { ContainerStatus, PublishContext, Publisher } from "./types"

// Publisher de simulation DÉTERMINISTE (aucun réseau). En place tant que les
// identifiants Meta/TikTok réels ne sont pas approuvés (décision Étienne : « schéma
// + boucle, publishers en stub »). Il exerce la machine à états et l'idempotence
// (règle 15) de bout en bout sans jamais publier chez un vrai client.
//
// Les IDs dérivent de content_target_id => rejouer le même job produit le même
// conteneur/post (idempotence testable). getContainerStatus renvoie « published »
// par défaut : le chemin de reprise (publish_started_at non nul) résout proprement.

export interface StubOptions {
  platform: PublishJob["platform"]
  targetStatus: TerminalTargetStatus
  /** Permet aux tests de forcer un état de conteneur pour couvrir la reprise. */
  containerStatus?: ContainerStatus
}

export function createStubPublisher(opts: StubOptions): Publisher {
  const post = (job: PublishJob) => ({
    externalPostId: `stub-${opts.platform}-post-${job.contentTargetId}`,
    permalink: `https://stub.local/${opts.platform}/${job.contentTargetId}`,
    targetStatus: opts.targetStatus,
  })

  return {
    async createContainer(job: PublishJob, _ctx: PublishContext) {
      return { containerId: `stub-${opts.platform}-container-${job.contentTargetId}` }
    },
    async publish(job: PublishJob, _containerId: string, _ctx: PublishContext) {
      return post(job)
    },
    async getContainerStatus(): Promise<ContainerStatus> {
      return opts.containerStatus ?? "published"
    },
    async resolvePublished(job: PublishJob) {
      return post(job)
    },
  }
}
