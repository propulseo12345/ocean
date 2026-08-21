import assert from "node:assert/strict"
import test from "node:test"

import { OAUTH_PROVIDERS } from "./config"
import {
  canPublish,
  grantedFromMetaPermissions,
  missingScopes,
  PUBLISH_SCOPES,
  parseScopeString,
} from "./scopes"

test("parseScopeString accepte l'espace (OAuth canonique) et la virgule (TikTok)", () => {
  assert.deepEqual(parseScopeString("a b c"), ["a", "b", "c"])
  assert.deepEqual(parseScopeString("a,b,c"), ["a", "b", "c"])
  assert.deepEqual(parseScopeString("a, b  c"), ["a", "b", "c"])
  assert.deepEqual(parseScopeString(""), [])
  assert.deepEqual(parseScopeString(undefined), [])
  assert.deepEqual(parseScopeString(null), [])
  // Dédoublonné : un provider peut répéter un scope.
  assert.deepEqual(parseScopeString("a a b"), ["a", "b"])
})

test("LE TICKET : une permission DECLINED n'est jamais comptée comme accordée", () => {
  const réponse = {
    data: [
      { permission: "instagram_basic", status: "granted" },
      { permission: "instagram_content_publish", status: "granted" },
      // L'utilisateur a décoché celle-ci sur l'écran de consentement Meta.
      { permission: "pages_manage_posts", status: "declined" },
      { permission: "pages_show_list", status: "granted" },
    ],
  }
  const accordés = grantedFromMetaPermissions(réponse)

  assert.deepEqual(accordés, ["instagram_basic", "instagram_content_publish", "pages_show_list"])
  assert.ok(!accordés.includes("pages_manage_posts"))
  // Et la conséquence, qui est tout l'intérêt de la distinction :
  assert.equal(canPublish("facebook", accordés), false)
  assert.equal(canPublish("instagram", accordés), true)
})

test("une réponse Meta absente, vide ou malformée ne fabrique pas de scopes", () => {
  // Le repli dangereux serait « en cas de doute, suppose que tout est accordé » :
  // on afficherait une connexion capable de publier alors qu'on n'en sait rien.
  for (const mauvais of [null, undefined, {}, { data: null }, { data: "x" }, 42, "texte"]) {
    assert.deepEqual(grantedFromMetaPermissions(mauvais), [])
  }
  assert.deepEqual(
    grantedFromMetaPermissions({ data: [{ permission: 42, status: "granted" }] }),
    []
  )
  assert.deepEqual(grantedFromMetaPermissions({ data: [{ status: "granted" }] }), [])
})

test("missingScopes rend ce qui manque, dans l'ordre demandé", () => {
  assert.deepEqual(missingScopes(["a", "b", "c"], ["b"]), ["a", "c"])
  assert.deepEqual(missingScopes(["a"], ["a", "b"]), [])
  assert.deepEqual(missingScopes([], ["a"]), [])
})

test("PROPRIÉTÉ : canPublish est faux dès qu'il manque UN scan requis, quel qu'il soit", () => {
  for (const [plateforme, requis] of Object.entries(PUBLISH_SCOPES)) {
    // Tout accordé → publiable.
    assert.equal(canPublish(plateforme, requis), true, `${plateforme} complet refusé`)
    // Chaque scope retiré à son tour → refusé. Une énumération de cas aurait
    // couvert le premier et oublié les suivants.
    for (const retiré of requis) {
      const amputé = requis.filter((s) => s !== retiré)
      assert.equal(canPublish(plateforme, amputé), false, `${plateforme} accepté sans ${retiré}`)
    }
  }
})

test("LE TICKET : `pages_manage_posts` est bien DEMANDÉ par la config Meta", () => {
  // Sans lui, la publication sur Page est refusée — et Meta ne rétro-accorde
  // jamais un scope : l'oublier ici oblige chaque client à tout reconnecter
  // après coup.
  assert.ok(
    OAUTH_PROVIDERS.meta.scopes.includes("pages_manage_posts"),
    "pages_manage_posts absent des scopes demandés à Meta"
  )
})

test("tout scope requis pour publier est effectivement DEMANDÉ à son fournisseur", () => {
  // Le piège symétrique : exiger en base un scope qu'on n'a jamais demandé au
  // fournisseur rendrait toute connexion « incapable de publier », pour
  // toujours, sans qu'aucune reconnexion n'y change rien.
  const demandésMeta = OAUTH_PROVIDERS.meta.scopes
  for (const s of [...PUBLISH_SCOPES.instagram, ...PUBLISH_SCOPES.facebook]) {
    assert.ok(demandésMeta.includes(s), `${s} exigé mais jamais demandé à Meta`)
  }
  for (const s of PUBLISH_SCOPES.tiktok) {
    assert.ok(OAUTH_PROVIDERS.tiktok.scopes.includes(s), `${s} exigé mais jamais demandé à TikTok`)
  }
})

test("une plateforme sans exigence connue n'est pas bloquée par défaut", () => {
  assert.equal(canPublish("newsletter", []), true)
})
