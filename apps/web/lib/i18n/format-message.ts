import type { Locale } from "./config"

// Mini-formatteur de messages, sous-ensemble d'ICU MessageFormat, sans dépendance.
// Supporte :
//   - interpolation simple : "Bonjour {name}"
//   - pluriel : "{count, plural, one {# publication} other {# publications}}"
//     (le `#` est remplacé par la valeur ; clés supportées : =0, one, other)
//   - sélection : "{kind, select, note {note} other {événement}}"
// Les accolades littérales s'échappent avec '{' et '}' (apostrophe simple, façon ICU).

export type MessageParams = Record<string, string | number>

// Règle de pluriel CLDR simplifiée (suffisant pour FR/EN).
function pluralCategory(locale: Locale, n: number): "one" | "other" {
  const abs = Math.abs(n)
  if (locale === "fr") return abs < 2 ? "one" : "other" // FR : 0 et 1 → singulier
  return abs === 1 ? "one" : "other" // EN : seul 1 → singulier
}

// Trouve l'accolade fermante correspondant à l'ouvrante en `start` (gère l'imbrication).
function matchBrace(src: string, start: number): number {
  let depth = 0
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Découpe le corps d'un bloc plural/select en branches { clé -> texte }.
function parseBranches(body: string): Record<string, string> {
  const branches: Record<string, string> = {}
  let i = 0
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++
    if (i >= body.length) break
    let key = ""
    while (i < body.length && body[i] !== "{" && !/\s/.test(body[i])) {
      key += body[i]
      i++
    }
    while (i < body.length && /\s/.test(body[i])) i++
    if (body[i] !== "{") break
    const end = matchBrace(body, i)
    if (end === -1) break
    branches[key] = body.slice(i + 1, end)
    i = end + 1
  }
  return branches
}

export function formatMessage(
  template: string,
  locale: Locale,
  params: MessageParams = {}
): string {
  let out = ""
  let i = 0
  while (i < template.length) {
    const c = template[i]
    // Échappement '{' / '}' à la ICU.
    if (c === "'" && (template[i + 1] === "{" || template[i + 1] === "}")) {
      out += template[i + 1]
      i += 2
      continue
    }
    if (c !== "{") {
      out += c
      i++
      continue
    }
    const end = matchBrace(template, i)
    if (end === -1) {
      out += c
      i++
      continue
    }
    const inner = template.slice(i + 1, end)
    const firstComma = inner.indexOf(",")
    if (firstComma === -1) {
      // Interpolation simple {name}
      const key = inner.trim()
      out += key in params ? String(params[key]) : ""
    } else {
      const name = inner.slice(0, firstComma).trim()
      const rest = inner.slice(firstComma + 1)
      const secondComma = rest.indexOf(",")
      const type = (secondComma === -1 ? rest : rest.slice(0, secondComma)).trim()
      const body = secondComma === -1 ? "" : rest.slice(secondComma + 1)
      const branches = parseBranches(body)
      const value = params[name]
      if (type === "plural") {
        const n = typeof value === "number" ? value : Number(value)
        const exact = `=${n}`
        const chosen =
          branches[exact] ?? branches[pluralCategory(locale, n)] ?? branches.other ?? ""
        // Récursion (branches peuvent contenir d'autres placeholders) + `#`.
        out += formatMessage(chosen.replaceAll("#", String(n)), locale, params)
      } else if (type === "select") {
        const chosen = branches[String(value)] ?? branches.other ?? ""
        out += formatMessage(chosen, locale, params)
      } else {
        out += value === undefined ? "" : String(value)
      }
    }
    i = end + 1
  }
  return out
}
