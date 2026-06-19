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
  status: {
    content: {
      idea: "Idée",
      draft: "Brouillon",
      in_review: "En revue",
      changes_requested: "Modifs demandées",
      approved: "Approuvé",
      scheduled: "Programmé",
      publishing: "Publication…",
      published: "Publié",
      partially_published: "Partiellement publié",
      failed: "Échec",
      canceled: "Annulé",
    },
    target: {
      pending: "En attente",
      queued: "En file",
      publishing: "Publication…",
      awaiting_manual: "À publier manuellement",
      published: "Publié",
      pushed_to_platform: "Brouillon poussé",
      failed: "Échec",
      skipped: "Ignoré",
      canceled: "Annulé",
    },
    account: {
      connected: "Connecté",
      needs_reauth: "Reconnexion requise",
      expired: "Expiré",
    },
    review: {
      pending: "En attente",
      partial: "Partiellement traité",
      done: "Traité",
    },
    approval: {
      required: "Validation obligatoire",
      optional: "Validation optionnelle",
      auto: "Publication directe",
    },
    activity: {
      created: "Créé",
      updated: "Modifié",
      sent_for_review: "Envoyé en validation",
      commented: "Commenté",
      approved: "Approuvé",
      changes_requested: "Modifs demandées",
      scheduled: "Programmé",
      rescheduled: "Reprogrammé",
      published: "Publié",
      failed: "Échec",
      retried: "Nouvelle tentative",
    },
  },
  format: {
    post: "Post",
    carousel: "Carrousel",
    reel: "Reel",
    story: "Story",
  },
  platform: {
    custom: "Sur mesure",
  },
  marronnier: {
    kind: {
      ferie: "Jour férié",
      fete: "Fête",
      soldes: "Soldes",
      marketing: "Temps fort",
    },
  },
  quota: {
    label: "Quota :",
    window: {
      ig: "publications · 24 h",
      fb: "Reels · 24 h",
      tt: "brouillons · 24 h",
    },
  },
  specs: {
    errorPrefix: "Erreur :",
    warningPrefix: "Avertissement :",
    crop916:
      "Recadrage 9:16 recommandé pour {target, select, reel {un Reel} story {une story} other {ce format}} (actuel : {current}).",
    igRatioOut: "Ratio {ratio} hors bornes Instagram (4:5 à 1.91:1) — recadre le visuel.",
    igImageTooBig: "Image de {size} Mo — Instagram accepte {max} Mo max en JPEG.",
    notJpeg: "Format non JPEG : conversion automatique avant publication.",
    videoRequired: "Une vidéo est requise pour ce format sur {platform}.",
    videoFormat: "Format vidéo non supporté — MP4 ou MOV attendu.",
    videoTooShort: "Vidéo trop courte : {min} s minimum sur {platform}.",
    videoTooLong: "Vidéo trop longue : {max} maximum sur {platform}.",
    videoTooBig: "Vidéo de {size} Mo — {max} Mo maximum.",
    storyTooLong: "Story vidéo limitée à {max} s.",
    feedVideoAsReel: "Les vidéos du feed sont publiées comme Reels par Instagram.",
    carouselMax: "Maximum {max} visuels par carrousel (limite API Meta).",
    carouselMin: "Un carrousel contient au moins {min} visuels.",
  },
} as const

// Forme structurelle : mêmes clés que `fr`, mais valeurs élargies à `string`.
// en.ts doit fournir EXACTEMENT les mêmes clés (parité vérifiée par le compilateur),
// avec des chaînes libres (pas les littéraux français).
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export type Dictionary = Widen<typeof fr>

// Type conservant les littéraux FR — sert à dériver les chemins de clés (MessageKey).
export type FrDictionary = typeof fr
