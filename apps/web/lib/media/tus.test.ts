import assert from "node:assert/strict"
import test from "node:test"

import { TUS_CHUNK_SIZE, TusAbortError, TusError, uploadResumable } from "./tus"

// Serveur TUS factice — il STOCKE les octets et compte les tranches. Le but
// n'est pas de vérifier qu'on a appelé fetch, mais que le fichier reconstitué
// côté serveur est OCTET POUR OCTET celui qu'on a donné, y compris après une
// coupure. Un test qui se contenterait de compter les appels laisserait passer
// un décalage d'offset — le défaut exact que la reprise doit empêcher.

const MIO = 1024 * 1024

interface UploadEnCours {
  reçu: number[]
  taille: number
  taillesDeTranches: number[]
  métadonnées: string
}

interface ServeurOptions {
  /** Coupe la connexion après ce nombre d'octets cumulés (simule une panne). */
  couperAprès?: number
  /** Nombre d'octets réellement conservés de la tranche qui coupe. */
  gardéAvantCoupure?: number
}

function serveurTus(options: ServeurOptions = {}) {
  const uploads = new Map<string, UploadEnCours>()
  let compteur = 0
  let coupé = false
  const journal: string[] = []

  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const href = String(url)
    const méthode = init?.method ?? "GET"
    journal.push(`${méthode} ${href}`)

    if (méthode === "POST") {
      const id = `up-${++compteur}`
      const entêtes = new Headers(init?.headers)
      uploads.set(id, {
        reçu: [],
        taille: Number(entêtes.get("Upload-Length")),
        taillesDeTranches: [],
        métadonnées: entêtes.get("Upload-Metadata") ?? "",
      })
      return new Response(null, {
        status: 201,
        headers: { Location: `https://exemple.test/upload/${id}` },
      })
    }

    const id = href.split("/").pop() ?? ""
    const état = uploads.get(id)
    if (!état) return new Response("gone", { status: 404 })

    if (méthode === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "Upload-Offset": String(état.reçu.length) },
      })
    }

    if (méthode === "PATCH") {
      const entêtes = new Headers(init?.headers)
      const offsetAnnoncé = Number(entêtes.get("Upload-Offset"))
      if (offsetAnnoncé !== état.reçu.length) {
        return new Response("conflict", { status: 409 })
      }
      const octets = new Uint8Array(await (init?.body as Blob).arrayBuffer())
      état.taillesDeTranches.push(octets.length)

      if (!coupé && options.couperAprès !== undefined && état.reçu.length >= options.couperAprès) {
        coupé = true
        // Le serveur garde ce qu'il a eu le temps de lire, puis la connexion
        // meurt : c'est le cas qui rend la reprise non triviale.
        const gardé = options.gardéAvantCoupure ?? 0
        for (let i = 0; i < gardé; i++) état.reçu.push(octets[i])
        throw new TypeError("network error")
      }

      for (const o of octets) état.reçu.push(o)
      return new Response(null, {
        status: 204,
        headers: { "Upload-Offset": String(état.reçu.length) },
      })
    }

    return new Response("méthode inattendue", { status: 400 })
  }) as unknown as typeof fetch

  return { fetchImpl, uploads, journal }
}

function motif(taille: number): Uint8Array<ArrayBuffer> {
  const u = new Uint8Array(new ArrayBuffer(taille))
  for (let i = 0; i < taille; i++) u[i] = (i * 31 + (i >> 8)) & 0xff
  return u
}

function baseInput(blob: Blob, fetchImpl: typeof fetch) {
  return {
    endpoint: "https://exemple.test/storage/v1/upload/resumable",
    bucket: "media-originals",
    objectName: "org/client/clé/photo.jpg",
    blob,
    contentType: "image/jpeg",
    accessToken: "jeton-utilisateur",
    apiKey: "anon",
    fetchImpl,
  }
}

test("13 Mio partent en tranches de 6 Mio exactement, et le fichier est identique", async () => {
  const source = motif(13 * MIO)
  const { fetchImpl, uploads } = serveurTus()

  const res = await uploadResumable(baseInput(new Blob([source]), fetchImpl))

  const état = [...uploads.values()][0]
  assert.equal(res.bytesSent, source.length)
  assert.deepEqual(état.taillesDeTranches, [TUS_CHUNK_SIZE, TUS_CHUNK_SIZE, 1 * MIO])
  // Propriété, pas énumération : TOUTE tranche sauf la dernière fait 6 Mio.
  for (const taille of état.taillesDeTranches.slice(0, -1)) {
    assert.equal(taille, TUS_CHUNK_SIZE)
  }
  assert.equal(Buffer.compare(Buffer.from(état.reçu), Buffer.from(source)), 0)
})

test("reprise après coupure : repart de l'offset du SERVEUR, sans trou ni doublon", async () => {
  const source = motif(13 * MIO)
  // Le serveur meurt pendant la 2e tranche, après en avoir gardé 2 Mio.
  const { fetchImpl, uploads } = serveurTus({
    couperAprès: TUS_CHUNK_SIZE,
    gardéAvantCoupure: 2 * MIO,
  })

  const res = await uploadResumable(baseInput(new Blob([source]), fetchImpl))

  const état = [...uploads.values()][0]
  assert.equal(res.bytesSent, source.length)
  // Un seul upload créé : on a REPRIS, pas recommencé.
  assert.equal(uploads.size, 1)
  // La preuve qui compte : les octets, pas le nombre d'appels. Si on était
  // reparti de `offset + 6 Mio` au lieu de l'offset serveur, le fichier
  // porterait un trou de 4 Mio et cette comparaison tomberait.
  assert.equal(Buffer.compare(Buffer.from(état.reçu), Buffer.from(source)), 0)
})

test("l'offset annoncé par le serveur fait autorité, même s'il contredit le client", async () => {
  const source = motif(2 * MIO)
  let patchs = 0
  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
    const méthode = init?.method ?? "GET"
    if (méthode === "POST") {
      return new Response(null, {
        status: 201,
        headers: { Location: "https://exemple.test/upload/x" },
      })
    }
    patchs++
    // Le serveur déclare n'avoir rien retenu au 1er PATCH : le client doit
    // renvoyer depuis 0, pas conclure que c'est fini.
    const offset = patchs === 1 ? 0 : source.length
    return new Response(null, { status: 204, headers: { "Upload-Offset": String(offset) } })
  }) as unknown as typeof fetch

  const res = await uploadResumable(baseInput(new Blob([source]), fetchImpl))
  assert.equal(patchs, 2)
  assert.equal(res.bytesSent, source.length)
})

test("annulation : la tranche suivante n'est jamais envoyée", async () => {
  const source = motif(13 * MIO)
  const contrôleur = new AbortController()
  const { fetchImpl, uploads } = serveurTus()

  const input = {
    ...baseInput(new Blob([source]), fetchImpl),
    signal: contrôleur.signal,
    onProgress: (envoyés: number) => {
      if (envoyés >= TUS_CHUNK_SIZE) contrôleur.abort()
    },
  }

  await assert.rejects(() => uploadResumable(input), TusAbortError)
  const état = [...uploads.values()][0]
  assert.equal(état.reçu.length, TUS_CHUNK_SIZE)
  assert.equal(état.taillesDeTranches.length, 1)
})

test("reprise sur un upload disparu : on en recrée un et on repart de zéro", async () => {
  const source = motif(1 * MIO)
  const { fetchImpl, uploads } = serveurTus()

  const res = await uploadResumable({
    ...baseInput(new Blob([source]), fetchImpl),
    resumeUrl: "https://exemple.test/upload/inexistant",
  })

  assert.equal(res.bytesSent, source.length)
  assert.equal(uploads.size, 1)
  assert.equal(Buffer.compare(Buffer.from([...uploads.values()][0].reçu), Buffer.from(source)), 0)
})

test("409 : on resynchronise sur le serveur au lieu d'insister", async () => {
  const source = motif(1 * MIO)
  let conflitsRendus = 0
  let reçu = 0
  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
    const méthode = init?.method ?? "GET"
    if (méthode === "POST") {
      return new Response(null, {
        status: 201,
        headers: { Location: "https://exemple.test/upload/x" },
      })
    }
    if (méthode === "HEAD") {
      return new Response(null, { status: 200, headers: { "Upload-Offset": String(reçu) } })
    }
    if (conflitsRendus++ === 0) return new Response("conflict", { status: 409 })
    reçu = source.length
    return new Response(null, { status: 204, headers: { "Upload-Offset": String(reçu) } })
  }) as unknown as typeof fetch

  const res = await uploadResumable(baseInput(new Blob([source]), fetchImpl))
  assert.equal(res.bytesSent, source.length)
})

test("la progression est monotone et se termine exactement sur la taille du fichier", async () => {
  const source = motif(13 * MIO)
  const { fetchImpl } = serveurTus()
  const étapes: number[] = []

  await uploadResumable({
    ...baseInput(new Blob([source]), fetchImpl),
    onProgress: (envoyés, total) => {
      assert.equal(total, source.length)
      étapes.push(envoyés)
    },
  })

  assert.ok(étapes.length >= 3)
  for (let i = 1; i < étapes.length; i++) assert.ok(étapes[i] >= étapes[i - 1])
  assert.equal(étapes.at(-1), source.length)
})

test("les métadonnées sont en base64 UTF-8 (un nom accentué ne casse pas l'en-tête)", async () => {
  const { fetchImpl, uploads } = serveurTus()
  await uploadResumable({
    ...baseInput(new Blob([motif(16)]), fetchImpl),
    objectName: "org/client/clé/été à Paris.jpg",
  })

  const { métadonnées } = [...uploads.values()][0]
  const paires = Object.fromEntries(
    métadonnées.split(",").map((p) => {
      const [clé, valeur] = p.split(" ")
      return [clé, Buffer.from(valeur, "base64").toString("utf8")]
    })
  )
  assert.equal(paires.objectName, "org/client/clé/été à Paris.jpg")
  assert.equal(paires.bucketName, "media-originals")
  assert.equal(paires.contentType, "image/jpeg")
})

test("une création refusée remonte le statut, elle ne se retente pas en silence", async () => {
  const fetchImpl = (async () =>
    new Response("row-level security", { status: 403 })) as unknown as typeof fetch

  await assert.rejects(
    () => uploadResumable(baseInput(new Blob([motif(16)]), fetchImpl)),
    (err: unknown) => err instanceof TusError && err.status === 403
  )
})
