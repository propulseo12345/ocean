// Helper résiduel de l'aplatissement i18n (Phase 7, décision D1).
//
// Le contenu client est MONOLINGUE (FR, servi par la base) : le type `L<string>`,
// et les helpers `pick`/`isLocalized` qui le résolvaient, ont été supprimés — le
// contenu est désormais une `string` simple, et le toggle EN ne traduit plus que
// l'UI (dictionnaires), jamais les légendes.
//
// Il ne reste que `loc`, et UNIQUEMENT parce que le corpus de démonstration
// (`lib/mocks/**`) l'appelle encore ~200 fois sous la forme `loc(fr, en)`. Ces
// mocks disparaissent en Phase 8 (dégel de l'horloge + suppression de
// `lib/mocks`) — `loc` part avec eux. Le code PERMANENT (data layer, composants)
// n'en dépend plus.
//
// `loc` ne garde que le français : le second argument (ancien `en`) est ignoré.
export function loc<T>(fr: T, _en?: T): T {
  return fr
}
