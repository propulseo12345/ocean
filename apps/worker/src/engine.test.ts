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
  async patchProgress(_id: string, patch: { externalContainerId?: string }) {
    this.events.push(`patchProgress:${patch.externalContainerId ?? ""}`)
  }
  async markPublishStarted() {
    this.events.push("markPublishStarted")
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
  const iStart = events.indexOf("markPublishStarted")
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
