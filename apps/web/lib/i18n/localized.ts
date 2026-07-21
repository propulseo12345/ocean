import type { Locale } from "./config"

// ⚠️ SHIM DE TRANSITION (Phase 7 — aplatissement L<string> → text, décision D1).
//
// Le contenu client est désormais MONOLINGUE (FR, servi par la base). Ces
// helpers ne sont plus qu'un pont le temps de retirer les 147 `pick()` répartis
// dans ~70 fichiers : ils compilent à chaque étape sans casser le build.
//
// - `pick` est TOLÉRANT : il accepte aussi bien un ancien `L<T>` (mock bilingue
//   pas encore aplati) qu'une `string` déjà aplatie, et renvoie la bonne valeur.
//   Les appelants n'ont donc pas besoin d'être touchés pour basculer les types.
// - `loc` renvoie désormais LE SEUL `fr` : tout le corpus de démo devient FR-only
//   d'un seul geste (le toggle EN ne traduit plus le contenu, seulement l'UI).
//
// Objectif final : `L`, `loc`, `pick` supprimés, champs typés `string`.
export type L<T = string> = { fr: T; en: T }

function isLocalized<T>(value: L<T> | T): value is L<T> {
  return value !== null && typeof value === "object" && "fr" in (value as object)
}

export function pick<T>(value: L<T> | T, locale: Locale): T {
  return isLocalized(value) ? value[locale] : value
}

// Aplatissement D1 : on ne garde que le français. Le second argument (ancien
// `en`) est ignoré — conservé dans la signature le temps que les ~500 appels
// `loc(fr, en)` du corpus mock soient nettoyés en T4.
export function loc<T>(fr: T, _en?: T): T {
  return fr
}
