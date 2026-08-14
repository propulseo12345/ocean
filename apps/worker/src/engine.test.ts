import assert from "node:assert/strict"
import { test } from "node:test"
import {
  NeedsReauthError,
  PermanentPublishError,
  type PublishJob,
  type PublishResult,
} from "./domain"
import { type EngineDeps, processJob } from "./engine"
import type { ContainerStatus, PublishContext, Publisher } from "./publishers/types"
import type { JobStore } from "./store"

// Tests du moteur SANS base ni réseau : store + publisher factices, log d'événements
// ordonné. Le cœur prouvé ici est la RÈGLE 15 (idempotence) : jamais de double
// publication, publish_started_at posé AVANT l'appel de publication.

const NOW = new Date("2026-07-22T12:00:00.000Z")

function makeJob(over: Partial<PublishJob> = {}): PublishJob {
  return {
    id: "job-1",
    orgId: "org-1",
    clientId: "client-1",
    contentItemId: "item-1",
    contentTargetId: "target-1",
    socialAccountId: "acct-1",
    platform: "instagram",
    status: "claimed",
    step: null,
    runAt: new Date(NOW.getTime() - 1000),
    attempts: 0,
    maxAttempts: 5,
    workerId: "w",
    claimedAt: NOW,
    leaseExpiresAt: new Date(NOW.getTime() + 120000),
    publishStartedAt: null,
    externalContainerId: null,
    targetPublishStartedAt: null,
    targetExternalContainerId: null,
    externalPostId: null,
    permalink: null,
    nextAttemptAt: null,
    lastError: null,
    ...over,
  }
}

class FakeStore implements JobStore {
  constructor(readonly events: string[]) {}
  async claim() {
    return null
  }
  async reapExpired() {
    return 0
  }
  async extendLease() {}
  async patchProgress(_job: PublishJob, patch: { externalContainerId?: string }) {
    this.events.push(`patchProgress:${patch.externalContainerId ?? ""}`)
  }
  async markPublishStarted(_job: PublishJob, containerId: string) {
    this.events.push(`markPublishStarted:${containerId}`)
  }
  async markAwaitingMedia() {
    this.events.push("markAwaitingMedia")
  }
  async succeed(_job: PublishJob, result: PublishResult) {
    this.events.push(`succeed:${result.externalPostId}`)
  }
  async retryOrFail() {
    this.events.push("retryOrFail")
  }
  async failPermanent(_job: PublishJob, _err: unknown, needsReauth: boolean) {
    this.events.push(`failPermanent:${needsReauth}`)
  }
  async deadLetter(_job: PublishJob, reason: string) {
    this.events.push(`deadLetter:${reason}`)
  }
  async deferForQuota() {
    this.events.push("deferForQuota")
  }
}

class FakePublisher implements Publisher {
  publishCalls = 0
  resolveCalls = 0
  createCalls = 0
  statusCalls = 0
  constructor(
    readonly events: string[],
    readonly containerStatus: ContainerStatus = "published"
  ) {}
  async createContainer(job: PublishJob) {
    this.createCalls++
    return { containerId: `c-${job.contentTargetId}` }
  }
  async publish(job: PublishJob): Promise<PublishResult> {
    this.publishCalls++
    this.events.push("publish")
    return { externalPostId: `p-${job.contentTargetId}`, targetStatus: "published" }
  }
  async getContainerStatus(): Promise<ContainerStatus> {
    this.statusCalls++
    return this.containerStatus
  }
  async resolvePublished(job: PublishJob): Promise<PublishResult> {
    this.resolveCalls++
    return { externalPostId: `p-${job.contentTargetId}`, targetStatus: "published" }
  }
}

function deps(store: JobStore, pub: Publisher, over: Partial<EngineDeps> = {}): EngineDeps {
  return {
    store,
    resolvePublisher: () => pub,
    prepare: async (): Promise<PublishContext> => ({ accessToken: "t" }),
    checkQuota: async () => true,
    config: { graceWindowMs: 2 * 60 * 60 * 1000, awaitMediaDelayMs: 60000 },
    now: NOW,
    random: () => 0,
    ...over,
  }
}

test("job frais : publish_started_at posé AVANT publish, succès, publish 1 fois", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "published")
  await processJob(makeJob(), deps(store, pub))

  assert.equal(pub.publishCalls, 1, "publish appelé exactement une fois")
  assert.equal(pub.createCalls, 1, "conteneur créé une fois")
  const iStart = events.findIndex((e) => e.startsWith("markPublishStarted:"))
  const iPub = events.indexOf("publish")
  assert.ok(iStart >= 0 && iPub >= 0, "les deux étapes ont eu lieu")
  assert.ok(iStart < iPub, "RÈGLE 15 : publish_started_at AVANT publish")
  assert.ok(
    events.some((e) => e.startsWith("succeed:")),
    "succès enregistré"
  )
})

test("RÈGLE 15 : reprise d'un job DÉJÀ publié => JAMAIS republier", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "published")
  const job = makeJob({
    publishStartedAt: new Date(NOW.getTime() - 5000),
    externalContainerId: "c-target-1",
    status: "publishing",
  })
  await processJob(job, deps(store, pub))

  assert.equal(pub.publishCalls, 0, "AUCUNE republication (déjà PUBLISHED)")
  assert.equal(pub.resolveCalls, 1, "on résout le post existant")
  assert.ok(
    events.some((e) => e.startsWith("succeed:")),
    "marqué succeeded"
  )
})

test("reprise d'un job non publié (conteneur en erreur) => republier une fois", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "error")
  const job = makeJob({
    publishStartedAt: new Date(NOW.getTime() - 5000),
    externalContainerId: "c-target-1",
    status: "publishing",
  })
  await processJob(job, deps(store, pub))

  assert.equal(pub.publishCalls, 1, "republication sûre : le conteneur n'avait PAS publié")
  assert.ok(events.some((e) => e.startsWith("succeed:")))
})

test("reprise, média encore en cours (in_progress) => awaiting_media, pas de publish", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "in_progress")
  const job = makeJob({
    publishStartedAt: new Date(NOW.getTime() - 5000),
    externalContainerId: "c-target-1",
  })
  await processJob(job, deps(store, pub))

  assert.equal(pub.publishCalls, 0)
  assert.ok(events.includes("markAwaitingMedia"))
})

test("fenêtre de grâce dépassée (>2h de retard) => dead_letter, aucune publication", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events)
  const job = makeJob({ runAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000) })
  await processJob(job, deps(store, pub))

  assert.equal(pub.publishCalls, 0)
  assert.equal(pub.createCalls, 0)
  assert.ok(events.some((e) => e.startsWith("deadLetter:")))
})

// ── CHEMIN DE DOUBLE PUBLICATION n°2 ────────────────────────────────────────
// Le job précédent est terminal (ou supprimé) : `enqueue_publish_jobs` en
// fabrique un neuf, `publish_started_at` à NULL sur la ligne. Avant la migration
// 023, ce job repartait en `publishFresh` et republiait un post déjà en ligne.
// L'ancre de la CIBLE est ce qui l'en empêche.
test("RÈGLE 15 : job NEUF (ancre de job nulle) sur cible ANCRÉE => jamais republier", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "published")
  const job = makeJob({
    // La ligne de job est vierge : c'est bien un job fraîchement enfilé.
    publishStartedAt: null,
    externalContainerId: null,
    // Mais la cible porte la marque d'une publication partie.
    targetPublishStartedAt: new Date(NOW.getTime() - 3 * 60 * 1000),
    targetExternalContainerId: "c-target-1",
    status: "claimed",
  })
  await processJob(job, deps(store, pub))

  assert.equal(pub.createCalls, 0, "aucun conteneur recréé")
  assert.equal(pub.publishCalls, 0, "AUCUNE republication")
  assert.equal(pub.statusCalls, 1, "le conteneur de la cible est interrogé")
  assert.equal(pub.resolveCalls, 1, "le post existant est résolu")
})

test("conteneur porté par la cible seule (crash avant la marque) => réutilisé, pas recréé", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "published")
  const job = makeJob({
    publishStartedAt: null,
    externalContainerId: null,
    // Conteneur créé par une tentative précédente, marque JAMAIS posée : rien
    // n'est parti, mais le conteneur est réutilisable.
    targetPublishStartedAt: null,
    targetExternalContainerId: "c-recycle",
  })
  await processJob(job, deps(store, pub))

  assert.equal(pub.createCalls, 0, "conteneur existant réutilisé")
  assert.equal(pub.publishCalls, 1, "publication normale : rien n'était parti")
  assert.ok(
    events.includes("markPublishStarted:c-recycle"),
    "l'ancre est posée avec le conteneur réutilisé"
  )
})

// ── CHEMIN DE DOUBLE PUBLICATION n°1 ────────────────────────────────────────
// Worker tué pendant media_publish, VPS down 3 h. Au retour, le job est en
// retard de plus que la fenêtre de grâce. Avant P3-1 il partait en dead_letter
// sans qu'on demande jamais à Meta si le post existait : cible « failed » sur un
// post en ligne, l'admin reprogramme, doublon.
test("grâce dépassée MAIS job démarré => on interroge le conteneur d'abord (jamais dead_letter à l'aveugle)", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "published")
  const job = makeJob({
    runAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000),
    publishStartedAt: new Date(NOW.getTime() - 4 * 60 * 60 * 1000),
    externalContainerId: "c-target-1",
    status: "publishing",
  })
  await processJob(job, deps(store, pub))

  assert.equal(pub.statusCalls, 1, "le conteneur EST interrogé malgré le retard")
  assert.equal(pub.publishCalls, 0, "aucune republication")
  assert.ok(
    !events.some((e) => e.startsWith("deadLetter:")),
    "PAS de dead_letter : le post est en ligne"
  )
  assert.ok(
    events.some((e) => e.startsWith("succeed:")),
    "la cible reflète la réalité : publiée"
  )
})

test("grâce dépassée + job démarré + conteneur en erreur => dead_letter APRÈS vérification", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "error")
  const job = makeJob({
    runAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000),
    publishStartedAt: new Date(NOW.getTime() - 4 * 60 * 60 * 1000),
    externalContainerId: "c-target-1",
    status: "publishing",
  })
  await processJob(job, deps(store, pub))

  assert.equal(pub.statusCalls, 1, "vérification faite")
  assert.equal(pub.publishCalls, 0, "on ne publie pas un contenu daté avec 5 h de retard")
  assert.ok(
    events.some((e) => e.startsWith("deadLetter:")),
    "abandon légitime : la plateforme confirme que rien n'est parti"
  )
})

test("job démarré : le quota n'est jamais consulté (interroger un conteneur ne publie rien)", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events, "published")
  let quotaCalls = 0
  await processJob(
    makeJob({
      publishStartedAt: new Date(NOW.getTime() - 5000),
      externalContainerId: "c-target-1",
      status: "publishing",
    }),
    deps(store, pub, {
      checkQuota: async () => {
        quotaCalls++
        return false
      },
    })
  )

  assert.equal(quotaCalls, 0, "quota non consulté sur un job démarré")
  assert.ok(!events.includes("deferForQuota"), "un job démarré n'est jamais reporté")
  assert.ok(events.some((e) => e.startsWith("succeed:")))
})

test("token perdu (NeedsReauth) => failed permanent, aucune publication", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events)
  await processJob(
    makeJob(),
    deps(store, pub, {
      prepare: async () => {
        throw new NeedsReauthError()
      },
    })
  )

  assert.equal(pub.publishCalls, 0)
  assert.ok(events.includes("failPermanent:true"))
})

test("erreur permanente (média invalide) au publish => failed, pas de retry", async () => {
  const events: string[] = []
  const store = new FakeStore(events)
  const pub = new FakePublisher(events)
  pub.publish = async () => {
    throw new PermanentPublishError("média invalide")
  }
  await processJob(makeJob(), deps(store, pub))

  assert.ok(events.includes("failPermanent:false"))
  assert.ok(!events.some((e) => e === "retryOrFail"), "pas de retry sur erreur permanente")
})
