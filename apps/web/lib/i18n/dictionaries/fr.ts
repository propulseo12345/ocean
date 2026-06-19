// Dictionnaire FRANÇAIS — source de vérité des clés.
// en.ts doit refléter EXACTEMENT les mêmes clés (vérifié par le build, type Dictionary).
// Structure plate par namespace ; valeurs = messages (mini-ICU : {var}, {n, plural, …}).

export const fr = {
  common: {
    cancel: "Annuler",
    save: "Enregistrer",
    delete: "Supprimer",
    confirm: "Confirmer",
    close: "Fermer",
    back: "Retour",
    next: "Suivant",
    previous: "Précédent",
    edit: "Modifier",
    duplicate: "Dupliquer",
    search: "Rechercher",
    loading: "Chargement…",
    today: "Aujourd'hui",
    all: "Tous",
    none: "Aucun",
    seeDetail: "Voir le détail",
    skipToContent: "Aller au contenu",
    previewSuffix: "(aperçu)",
  },
  locale: {
    toggleLabel: "Changer de langue",
    switchTo: "Passer en {lang}",
  },
  meta: {
    appTitleDefault: "Ocean — le poste de pilotage du freelance en communication",
    appDescription:
      "Planification, aperçu de feed, calendrier éditorial, validation client et agenda unifié — tout le travail d'une agence dans un seul outil.",
  },
} as const

// Forme structurelle : mêmes clés que `fr`, mais valeurs élargies à `string`.
// en.ts doit fournir EXACTEMENT les mêmes clés (parité vérifiée par le compilateur),
// avec des chaînes libres (pas les littéraux français).
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export type Dictionary = Widen<typeof fr>

// Type conservant les littéraux FR — sert à dériver les chemins de clés (MessageKey).
export type FrDictionary = typeof fr
