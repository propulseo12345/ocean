import assert from "node:assert/strict"
import { test } from "node:test"

import {
  fileExtension,
  originalPath,
  pathBelongsTo,
  sanitizeFileName,
  tenantOf,
  thumbPath,
  withExtension,
} from "./paths"

// Le chemin de stockage EST le mecanisme d'isolation (regle 21) : les policies
// storage.objects lisent foldername()[1] et [2] comme l'org et le client. Ces
// tests figent la convention dont depend la migration 033.

const ORG = "11111111-1111-4111-8111-111111111111"
const CLIENT = "22222222-2222-4222-8222-222222222222"
const KEY = "33333333-3333-4333-8333-333333333333"

test("le chemin place org et client aux segments 1 et 2 — l isolation en depend", () => {
  const p = originalPath({ orgId: ORG, clientId: CLIENT, uploadKey: KEY, fileName: "photo.jpg" })
  assert.equal(p, `${ORG}/${CLIENT}/${KEY}/photo.jpg`)

  const segments = p.split("/")
  assert.equal(segments[0], ORG, "foldername()[1] doit etre l org")
  assert.equal(segments[1], CLIENT, "foldername()[2] doit etre le client")
})

test("un nom de fichier ne peut PAS injecter de segment supplementaire", () => {
  // C'est le cas dangereux : un `/` dans le nom decalerait foldername()[1] et
  // [2], donc l'isolation de tenant elle-meme.
  const p = originalPath({
    orgId: ORG,
    clientId: CLIENT,
    uploadKey: KEY,
    fileName: "../../autre-org/vol.jpg",
  })
  assert.equal(p.split("/").length, 4, `un segment de trop : ${p}`)
  assert.equal(p.split("/")[0], ORG)
  assert.equal(p.split("/")[1], CLIENT)
  assert.ok(!p.includes(".."), p)
})

test("sanitizeFileName depouille sans casser le nom", () => {
  assert.equal(sanitizeFileName("Été à Paris.JPG"), "Ete-a-Paris.JPG")
  assert.equal(sanitizeFileName("photo (1).png"), "photo-1-.png")
  assert.equal(sanitizeFileName("mon fichier.jpeg"), "mon-fichier.jpeg")
  // Jamais de nom vide : le chemin doit rester a 4 segments.
  for (const vide of ["", "   ", "///", "...", "???"]) {
    assert.equal(sanitizeFileName(vide), "fichier", JSON.stringify(vide))
  }
})

test("le nom assaini ne commence ni ne finit par un separateur", () => {
  for (const nom of ["--photo--.jpg", "...photo...", "  photo  ", "-.-.-"]) {
    const s = sanitizeFileName(nom)
    assert.ok(!/^[-.]/.test(s), `${nom} -> ${s}`)
    assert.ok(!/[-.]$/.test(s), `${nom} -> ${s}`)
    assert.ok(s.length > 0, nom)
  }
})

test("la vignette porte le meme prefixe d isolation et finit toujours en .webp", () => {
  const parts = { orgId: ORG, clientId: CLIENT, uploadKey: KEY, fileName: "photo.HEIC" }
  const t = thumbPath(parts)
  assert.equal(t, `${ORG}/${CLIENT}/${KEY}/photo.webp`)

  // Meme prefixe que l'original : meme isolation, et les deux objets d'un meme
  // media restent voisins pour la purge.
  const o = originalPath(parts)
  assert.equal(t.split("/").slice(0, 3).join("/"), o.split("/").slice(0, 3).join("/"))
})

test("extension : lecture et remplacement", () => {
  assert.equal(fileExtension("photo.JPG"), "jpg")
  assert.equal(fileExtension("archive.tar.gz"), "gz")
  assert.equal(fileExtension("sans-extension"), "")
  assert.equal(withExtension("photo.heic", "jpg"), "photo.jpg")
  assert.equal(withExtension("sans-extension", "webp"), "sans-extension.webp")
})

test("deux envois du meme nom ne se marchent pas dessus", () => {
  // `media_assets.storage_path` porte un index UNIQUE (012:65) : sans cle
  // distincte, le second enregistrement echouerait APRES un televersement deja
  // paye.
  const a = originalPath({ orgId: ORG, clientId: CLIENT, uploadKey: KEY, fileName: "photo.jpg" })
  const b = originalPath({
    orgId: ORG,
    clientId: CLIENT,
    uploadKey: "44444444-4444-4444-8444-444444444444",
    fileName: "photo.jpg",
  })
  assert.notEqual(a, b)
})

test("tenantOf relit les deux segments d isolation, et refuse un chemin trop court", () => {
  assert.deepEqual(tenantOf(`${ORG}/${CLIENT}/${KEY}/photo.jpg`), {
    orgId: ORG,
    clientId: CLIENT,
  })
  assert.equal(tenantOf(`${ORG}/${CLIENT}/photo.jpg`), null, "3 segments : pas notre convention")
  assert.equal(tenantOf("photo.jpg"), null)
  assert.equal(tenantOf(""), null)
})

// --- pathBelongsTo : le recoupement chemin/tenant (LOT 1) --------------------
//
// `recordUploadedAsset` insérait `storage_path` tel quel, alors que le chemin
// vient du NAVIGATEUR et qu'aucune contrainte en base ne le relie à
// org_id/client_id. Une ligne `media_assets` pouvait donc désigner le préfixe
// d'un AUTRE tenant — ce que la voie reviewer de la 033 résout justement par
// `storage_path`, sans reconfronter le chemin à la ligne.

const AUTRE_ORG = "99999999-9999-4999-8999-999999999999"
const AUTRE_CLIENT = "88888888-8888-4888-8888-888888888888"

test("un chemin bien range est accepte", () => {
  assert.equal(pathBelongsTo(`${ORG}/${CLIENT}/cle/photo.jpg`, ORG, CLIENT), true)
  assert.equal(pathBelongsTo(`${ORG}/${CLIENT}/cle/sous/photo.jpg`, ORG, CLIENT), true)
})

test("PROPRIETE : aucun chemin visant un autre tenant n est accepte", () => {
  const hostiles = [
    `${AUTRE_ORG}/${CLIENT}/cle/f.jpg`,
    `${ORG}/${AUTRE_CLIENT}/cle/f.jpg`,
    `${AUTRE_ORG}/${AUTRE_CLIENT}/cle/f.jpg`,
    // Le piège du startsWith : commence bien par l'org, ne lui appartient pas.
    `${ORG}extra/${CLIENT}/cle/f.jpg`,
    `${ORG}/${CLIENT}extra/cle/f.jpg`,
    // Remontee de chemin : `..` est un segment litteral, il ne decale rien —
    // mais le premier segment n'est alors plus le notre.
    `../${ORG}/${CLIENT}/cle/f.jpg`,
    `${AUTRE_ORG}/../${ORG}/${CLIENT}/f.jpg`,
    // Trop peu de segments : on ne devine pas, on refuse.
    `${ORG}/${CLIENT}/f.jpg`,
    `${ORG}/${CLIENT}`,
    `${ORG}`,
    "",
    "/",
    // Segment vide en tete : `/org/client/...` decale tout d'un cran.
    `/${ORG}/${CLIENT}/cle/f.jpg`,
  ]
  for (const chemin of hostiles) {
    assert.equal(pathBelongsTo(chemin, ORG, CLIENT), false, `doit etre refuse : ${chemin}`)
  }
})

test("la comparaison des segments est sensible a la casse", () => {
  // Un uuid se compare octet pour octet. (Ce cas vivait d'abord dans la liste
  // ci-dessus, ou il ne prouvait RIEN : les uuid de test n'ont que des
  // chiffres, `toUpperCase()` y est sans effet et la chaine restait le chemin
  // legitime. C'est le test qui avait tort, et c'est l'execution qui l'a dit.)
  const orgAvecLettres = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  assert.equal(pathBelongsTo(`${orgAvecLettres}/${CLIENT}/cle/f.jpg`, orgAvecLettres, CLIENT), true)
  assert.equal(
    pathBelongsTo(`${orgAvecLettres.toUpperCase()}/${CLIENT}/cle/f.jpg`, orgAvecLettres, CLIENT),
    false
  )
})

test("les chemins que construit l app sont acceptes par leur propre tenant", () => {
  // La garde ne doit pas refuser ce que le module fabrique lui-meme : sans ce
  // test, un durcissement casserait l'upload legitime sans que rien ne le dise.
  const parts = { orgId: ORG, clientId: CLIENT, uploadKey: "abc123", fileName: "Photo Été.HEIC" }
  assert.equal(pathBelongsTo(originalPath(parts), ORG, CLIENT), true, originalPath(parts))
  assert.equal(pathBelongsTo(thumbPath(parts), ORG, CLIENT), true, thumbPath(parts))
})
