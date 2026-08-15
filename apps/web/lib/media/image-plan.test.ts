import assert from "node:assert/strict"
import test from "node:test"

import { IG_IMAGE_RATIO } from "@/lib/specs"
import {
  CROP_RATIOS,
  centerCropRect,
  classifyUpload,
  cropPlan,
  ENCODE_ATTEMPTS,
  IMAGE_SOURCE_MAX_BYTES,
  isHeic,
  isVideoFile,
  needsJpegTranscode,
  ratioWithinInstagram,
  scaledSize,
  THUMB_MAX_PX,
  thumbDimensions,
  VIDEO_MAX_BYTES,
} from "./image-plan"

// Ces tests portent sur des PROPRIÉTÉS, pas sur des listes de cas. Une liste de
// cas ne se déclenche que sur ce qu'on a pensé à y mettre : c'est ce qui a
// laissé passer l'open redirect (8 tests verts, aucun dot-segment dans la
// liste). Ici, chaque règle est vérifiée sur un balayage de dimensions.

/** Balayage de formes réelles : téléphone, appareil photo, captures, extrêmes. */
const FORMES: Array<[number, number]> = [
  [4032, 3024], // iPhone 4:3 paysage
  [3024, 4032], // iPhone 4:3 portrait
  [1080, 1080],
  [1080, 1350],
  [1080, 1920],
  [1920, 1080],
  [5000, 1000], // panorama extrême
  [1000, 5000], // bande verticale extrême
  [7, 3],
  [3, 7],
  [1, 1],
  [640, 480],
]

test("isHeic : le type MIME ne suffit pas, l'extension rattrape les cas iPhone", () => {
  assert.equal(isHeic("image/heic", "IMG_0001.HEIC"), true)
  assert.equal(isHeic("image/heif", "photo.heif"), true)
  // Le cas qui compte : iOS livre parfois un type VIDE.
  assert.equal(isHeic("", "IMG_0001.HEIC"), true)
  assert.equal(isHeic("", "img_0001.heic"), true)
  assert.equal(isHeic("application/octet-stream", "IMG_0001.heic"), true)
  // Et l'inverse : un JPEG reste un JPEG même si son nom ment.
  assert.equal(isHeic("image/jpeg", "photo.jpg"), false)
  assert.equal(isHeic("image/png", "capture.png"), false)
  assert.equal(isHeic("image/jpeg", "trompeur.heic"), false)
})

test("isVideoFile : type MIME ou extension", () => {
  assert.equal(isVideoFile("video/quicktime", "IMG_0002.MOV"), true)
  assert.equal(isVideoFile("", "reel.mp4"), true)
  assert.equal(isVideoFile("image/jpeg", "photo.jpg"), false)
})

test("tout ce qui n'est pas déjà du JPEG est transcodé — la vidéo, jamais", () => {
  assert.equal(needsJpegTranscode("image/png", "a.png"), true)
  assert.equal(needsJpegTranscode("image/heic", "a.heic"), true)
  assert.equal(needsJpegTranscode("", "a.heic"), true)
  assert.equal(needsJpegTranscode("image/jpeg", "a.jpg"), false)
  // Un MOV de 300 Mo ne passe pas par un canvas : c'est le worker qui traite.
  assert.equal(needsJpegTranscode("video/quicktime", "a.mov"), false)
  assert.equal(needsJpegTranscode("video/mp4", "a.mp4"), false)
})

test("PROPRIÉTÉ : la vignette tient dans 400 px, garde son ratio, et n'agrandit jamais", () => {
  for (const [w, h] of FORMES) {
    const t = thumbDimensions(w, h)
    assert.ok(Math.max(t.width, t.height) <= THUMB_MAX_PX, `${w}x${h} déborde de 400 px`)
    assert.ok(t.width >= 1 && t.height >= 1, `${w}x${h} produit une dimension nulle`)
    // Jamais plus grand que l'original.
    assert.ok(t.width <= w && t.height <= h, `${w}x${h} a été agrandie`)
    // Ratio conservé à un pixel d'arrondi près.
    const écart = Math.abs(t.width / t.height - w / h)
    assert.ok(écart < 0.06, `${w}x${h} : ratio dérivé de ${écart}`)
  }
})

test("une image plus petite que 400 px n'est pas touchée", () => {
  assert.deepEqual(thumbDimensions(320, 200), { width: 320, height: 200 })
})

test("PROPRIÉTÉ : le rectangle de recadrage tient dans la source et vise le bon ratio", () => {
  for (const [w, h] of FORMES) {
    for (const ratio of Object.values(CROP_RATIOS)) {
      const r = centerCropRect(w, h, ratio)
      assert.ok(r.x >= 0 && r.y >= 0, `débordement négatif sur ${w}x${h}`)
      assert.ok(r.x + r.width <= w, `dépasse en largeur sur ${w}x${h}`)
      assert.ok(r.y + r.height <= h, `dépasse en hauteur sur ${w}x${h}`)
      assert.ok(r.width >= 1 && r.height >= 1)
      // L'INVARIANT est directionnel : le ratio obtenu n'est JAMAIS inférieur à
      // la cible. Sur 4:5, qui est exactement la borne basse d'Instagram, un
      // arrondi vers le bas produirait une image hors specs — recadrée POUR se
      // conformer, et refusée quand même.
      const obtenu = r.width / r.height
      assert.ok(
        obtenu >= ratio - 1e-9,
        `${w}x${h} → ${r.width}x${r.height} = ${obtenu}, sous la cible ${ratio}`
      )
      // Et pas plus loin que ce que permettent des pixels entiers.
      const marge = 1 + 2 / Math.min(r.width, r.height)
      assert.ok(
        obtenu <= ratio * marge,
        `${w}x${h} → ${obtenu} s'éloigne trop de ${ratio} (marge ${marge})`
      )
    }
  }
})

test("le recadrage est centré : ce qui est rogné l'est des deux côtés à parts égales", () => {
  const r = centerCropRect(4032, 3024, 1)
  assert.equal(r.width, 3024)
  assert.equal(r.height, 3024)
  assert.equal(r.x, Math.round((4032 - 3024) / 2))
  assert.equal(r.y, 0)
})

test("PROPRIÉTÉ : un recadrage ne fabrique jamais de pixels", () => {
  for (const [w, h] of FORMES) {
    for (const preset of Object.keys(CROP_RATIOS) as Array<keyof typeof CROP_RATIOS>) {
      const plan = cropPlan(preset, w, h)
      // La sortie ne dépasse jamais le rectangle disponible dans la source.
      assert.ok(
        plan.width <= plan.rect.width && plan.height <= plan.rect.height,
        `${preset} sur ${w}x${h} agrandit ${plan.rect.width}x${plan.rect.height} en ${plan.width}x${plan.height}`
      )
      assert.ok(plan.width >= 1 && plan.height >= 1)
    }
  }
})

test("PROPRIÉTÉ : tout recadrage rend un ratio accepté par Instagram", () => {
  // 9:16 est hors specs FEED (c'est un format story/reel) : on ne le teste que
  // sur les deux presets qui visent le feed.
  for (const [w, h] of FORMES) {
    for (const preset of ["1:1", "4:5"] as const) {
      const plan = cropPlan(preset, w, h)
      assert.ok(
        ratioWithinInstagram(plan.width, plan.height),
        `${preset} sur ${w}x${h} rend ${plan.width}x${plan.height}, hors ${IG_IMAGE_RATIO.min}–${IG_IMAGE_RATIO.max}`
      )
    }
  }
})

test("un recadrage 1080 est produit quand la source le permet, et pas au-delà", () => {
  // Source largement suffisante : on obtient la cible.
  assert.deepEqual(cropPlan("4:5", 4032, 3024).rect.height, 3024)
  const grand = cropPlan("1:1", 4032, 3024)
  assert.equal(grand.width, 1080)
  assert.equal(grand.height, 1080)
  // Source plus petite que la cible : on garde la taille réelle.
  const petit = cropPlan("1:1", 600, 800)
  assert.equal(petit.width, 600)
  assert.equal(petit.height, 600)
})

test("PROPRIÉTÉ : l'échelle de repli est strictement décroissante et bornée", () => {
  assert.ok(ENCODE_ATTEMPTS.length >= 3 && ENCODE_ATTEMPTS.length <= 10)
  // Le premier essai est à taille pleine : on ne dégrade pas sans raison.
  assert.equal(ENCODE_ATTEMPTS[0].scale, 1)
  let coûtPrécédent = Number.POSITIVE_INFINITY
  for (const essai of ENCODE_ATTEMPTS) {
    assert.ok(essai.quality > 0 && essai.quality <= 1)
    assert.ok(essai.scale > 0 && essai.scale <= 1)
    // Coût ≈ pixels × qualité : chaque essai doit peser moins que le précédent,
    // sinon la boucle pourrait tourner sans jamais converger.
    const coût = essai.scale * essai.scale * essai.quality
    assert.ok(coût < coûtPrécédent, `essai non décroissant: ${JSON.stringify(essai)}`)
    coûtPrécédent = coût
  }
  // La qualité ne descend jamais sous un seuil visible.
  assert.ok(ENCODE_ATTEMPTS.every((e) => e.quality >= 0.7))
})

test("scaledSize ne rend jamais zéro, même sur une image d'un pixel", () => {
  assert.deepEqual(scaledSize(1, 1, 0.3), { width: 1, height: 1 })
  assert.deepEqual(scaledSize(1000, 500, 0.5), { width: 500, height: 250 })
})

test("classifyUpload : toute image ressort en JPEG, la vidéo garde son conteneur", () => {
  assert.deepEqual(classifyUpload("image/heic", "IMG_1.HEIC", 4 * 1024 * 1024), {
    ok: true,
    kind: "image",
    targetMime: "image/jpeg",
  })
  assert.deepEqual(classifyUpload("image/png", "capture.png", 40 * 1024 * 1024), {
    ok: true,
    kind: "image",
    targetMime: "image/jpeg",
  })
  assert.deepEqual(classifyUpload("video/quicktime", "IMG_2.MOV", 120 * 1024 * 1024), {
    ok: true,
    kind: "video",
    targetMime: "video/quicktime",
  })
  // Type vide + extension : le cas iOS réel.
  assert.deepEqual(classifyUpload("", "IMG_3.heic", 3 * 1024 * 1024), {
    ok: true,
    kind: "image",
    targetMime: "image/jpeg",
  })
})

test("classifyUpload refuse AVANT le transfert, pas après", () => {
  assert.deepEqual(classifyUpload("application/pdf", "contrat.pdf", 1024), {
    ok: false,
    reason: "type_non_supporte",
  })
  assert.deepEqual(classifyUpload("video/mp4", "long.mp4", VIDEO_MAX_BYTES + 1), {
    ok: false,
    reason: "video_trop_grosse",
  })
  assert.deepEqual(classifyUpload("image/png", "enorme.png", IMAGE_SOURCE_MAX_BYTES + 1), {
    ok: false,
    reason: "image_trop_grosse",
  })
})

test("le plafond de la SOURCE image n'est pas celui d'Instagram", () => {
  // Un HEIC de 5 Mo est une entrée normale : c'est la SORTIE que `encodeJpeg`
  // borne à 8 Mo. Confondre les deux refuserait des photos parfaitement valides.
  const verdict = classifyUpload("image/heic", "IMG_1.HEIC", 5 * 1024 * 1024)
  assert.equal(verdict.ok, true)
  assert.ok(IMAGE_SOURCE_MAX_BYTES > 8 * 1024 * 1024)
})

test("ratioWithinInstagram borne bien la fenêtre 4:5 – 1.91:1", () => {
  assert.equal(ratioWithinInstagram(1080, 1350), true) // 4:5 pile
  assert.equal(ratioWithinInstagram(1910, 1000), true) // 1.91:1 pile
  assert.equal(ratioWithinInstagram(1080, 1920), false) // 9:16
  assert.equal(ratioWithinInstagram(3000, 1000), false) // panorama
})
