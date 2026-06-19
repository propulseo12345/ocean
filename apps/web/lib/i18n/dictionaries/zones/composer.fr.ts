// Namespace i18n « composer » (FR) — studio de création/édition de contenu.
export const composerFr = {
  composer: {
    // En-tête
    header: {
      back: "Retour au studio",
      titleCreate: "Nouveau contenu",
      titleEdit: "Modifier le contenu",
      tzHint: "(fuseau {tz})",
      noDate: "Sans date",
      reschedule: "Reprogrammer…",
      schedule: "Programmer…",
      save: "Enregistrer",
    },

    // Section « Contenu »
    basics: {
      title: "Contenu",
      internalTitle: "Titre interne",
      internalTitlePlaceholder: "Ex. : Nouveau single origin Éthiopie",
      format: "Format",
      state: "État",
      stateIdea: "Idée",
      stateDraft: "Brouillon",
      pillar: "Pilier éditorial",
      noPillar: "Aucun pilier",
      labels: "Étiquettes",
      removeLabel: "Retirer l'étiquette {label}",
      addLabelPlaceholder: "Ajouter (Entrée)…",
      internalNotes: "Notes internes",
      internalNotesPlaceholder: "Jamais visibles par le client — brief, rappels, liens…",
    },

    // Section « Légende »
    caption: {
      title: "Légende",
      commonTab: "Commune",
      commonPlaceholder: "Écris la légende commune à toutes les plateformes…",
      commonAria: "Légende commune",
      destinationCaption: "la légende",
      customized: "Personnalisée",
      inherited: "Héritée de la légende commune",
      backToCommon: "Revenir à la commune",
      customizeFor: "Personnaliser pour {platform}",
      captionFor: "Légende {platform}",
      commonEmpty: "Légende commune vide.",
      firstComment: "Premier commentaire (Instagram)",
      firstCommentPlaceholder:
        "Hashtags hors légende, lien d'épingle… posté juste après la publication.",
      destinationFirstComment: "le premier commentaire",
    },

    // Outils de légende (compteurs, mots à éviter, hashtags)
    tools: {
      over: "dépassement",
      truncateAfter: "« … plus » après {count}",
      truncateTitle: "Instagram coupe la légende après ~{count} caractères dans le feed",
      bannedTitle: "Mots à éviter (brand kit) :",
      bannedSuffix: "— corrige ou assume avant l'envoi en validation.",
      hashtagStats:
        "{total}/{limit} hashtags Instagram (légende {inCaption} · premier commentaire {inFirstComment})",
      hashtagOver: " — limite dépassée",
      hashtagDuplicates: "Doublons légende / commentaire : {words}",
    },

    // Section « Médias »
    media: {
      title: "Médias",
      slidesCount: "{count}/{max} slides (limite API Meta)",
      libraryButton: "Médiathèque",
      emptyChoose: "Choisir un visuel dans la médiathèque",
      emptyHint: "Dépôt de fichiers réel au Lot 1 — la preview pioche dans les médias mockés.",
      slidesAria: "Slides du contenu",
      carouselReorder:
        "Glisse les vignettes pour réordonner — la 1re slide est la couverture du carrousel.",
      sizeMb: "{size} Mo",
      duration: "{count} s",
      cropped: "recadré {preset}",
      crop: "Recadrer",
      remove: "Retirer",
      altLabel: "Texte alternatif (accessibilité)",
      altPlaceholder: "Décris le visuel pour les lecteurs d'écran…",
      altHint: "Envoyé à Instagram et Facebook si la plateforme le supporte.",
      noMediaSelected: "Aucun média sélectionné",
      specsTitle: "Validation des specs plateformes",
    },

    // Sélecteur de médiathèque
    picker: {
      title: "Médiathèque du client",
      descMultiple:
        "Sélectionne jusqu'à {max, plural, one {# visuel} other {# visuels}} — l'upload réel arrive au Lot 1.",
      descSingle: "Sélectionne un visuel — l'upload réel arrive au Lot 1.",
      assetAlt: "Média de la médiathèque",
      used: "Utilisé",
      unused: "Inédit",
      add: "Ajouter",
      addCount: "Ajouter ({count})",
    },

    // Recadrage
    crop: {
      square: "Carré (feed)",
      portrait: "Portrait (recommandé IG)",
      vertical: "Vertical (Reel, story)",
      title: "Recadrer le visuel",
      currentRatio: "Ratio actuel : {ratio}",
      currentRatioSize: "Ratio actuel : {ratio} · {size} Mo",
      previewAlt: "Visuel à recadrer",
      exportHint:
        "Export en JPEG ≤ 8 Mo — conversion et compression automatiques avant publication (specs Instagram).",
      apply: "Appliquer le recadrage",
      toastApplied: "Recadrage {preset} appliqué (aperçu)",
      toastDesc: "Aucun traitement d'image réel pendant la preview.",
    },

    // Vignette de slide
    slide: {
      ariaSlide: "Slide {index}",
      ariaSlideSelected: "Slide {index} (sélectionnée)",
      slideAlt: "Slide {index}",
      cover: "Couverture",
      removeSlide: "Retirer la slide {index}",
    },

    // Section « Diffusion »
    targets: {
      title: "Diffusion",
      followers: "{count} abonnés",
      targetAria: "Cibler {platform} @{username}",
      manualChannels: "Canaux manuels",
      newsletter: "Newsletter",
      newsletterDesc: "Publication manuelle assistée à l'heure programmée.",
      newsletterAria: "Cibler la newsletter",
      newsletterSubject: "Objet de la newsletter",
      newsletterSubjectPlaceholder: "Ex. : Le cold brew arrive en bouteille ☀️",
      custom: "Sur mesure",
      customDesc: "Canal libre (affichage, print, story avec stickers…) — checklist manuelle.",
      customAria: "Cibler le canal sur mesure",
    },

    // Options avancées
    advanced: {
      title: "Options avancées par plateforme",
      igLocation: "Lieu (géotag)",
      igLocationPlaceholder: "Ex. : Lille, France",
      igHint:
        "Identification de comptes et posts collab indisponibles au MVP (variante API Instagram Login).",
      fbLink: "Lien sortant",
      fbHint: "Affiché en aperçu de lien sous le post Facebook.",
      tiktokHint:
        "Publication en brouillon : confidentialité, duo/collage et commentaires se règlent dans l'app TikTok à la finalisation. Tu recevras une notification à l'heure programmée avec la légende à coller.",
    },

    // Aperçu
    preview: {
      title: "Aperçu",
      mediaAlt: "Aperçu du média",
      prevSlide: "Slide précédente",
      nextSlide: "Slide suivante",
      noMedia: "Aucun média sélectionné",
      noTargets: "Aucune plateforme ciblée — aperçu Instagram par défaut.",
      emptyCaption: "Légende vide pour l'instant…",
      morePlus: "… plus",
      moreTitle: "Instagram coupe ici dans le feed (~{count} caractères)",
    },

    // Panneau pré-flight
    preflight: {
      title: "Pré-flight de programmation",
      srBlocking: "Bloquant : ",
      srWarning: "Avertissement : ",
      srOk: "OK : ",
      summaryBlocking:
        "{count, plural, one {# point bloquant} other {# points bloquants}} — corrige avant de programmer.",
      summaryWarnings:
        "Prêt à programmer, avec {count, plural, one {# avertissement} other {# avertissements}}.",
      summaryReady: "Prêt à programmer.",
      // Items
      targetsNone: "Aucune plateforme ciblée",
      targetsNoneDetail: "Active au moins un compte ou un canal manuel.",
      targetsCount: "{count, plural, one {# cible} other {# cibles}}",
      accountsBroken: "Compte à reconnecter",
      accountsOk: "Comptes connectés",
      mediaNoneManual: "Sans média (canal manuel)",
      mediaNone: "Aucun média",
      mediaNoneDetail: "Ajoute au moins un visuel depuis la médiathèque.",
      mediaOk: "Médias conformes aux specs",
      mediaErrors: "{count, plural, one {# bloquant} other {# bloquants}}",
      mediaWarnings: "{count, plural, one {# avertissement} other {# avertissements}}",
      mediaOutOfSpec: "Médias hors specs",
      mediaToCheck: "Médias à vérifier",
      mediaIssuesDetail: "{parts} — voir la section Médias.",
      captionTooLong: "Légende trop longue",
      captionTruncated: "Coupée après {count} caractères sur Instagram",
      captionTruncatedDetail: "Place le message clé avant le « … plus » (voir l'aperçu).",
      captionOk: "Légende dans les limites",
      hashtagsOver: "{total} hashtags — Instagram en accepte 30",
      hashtagsOverDetail: "Cumul légende + premier commentaire.",
      hashtagsDup: "Hashtags en doublon",
      hashtagsOk: "{total}/30 hashtags Instagram",
      bannedHit: "Mots à éviter (brand kit)",
      bannedOk: "Aucun mot interdit détecté",
      approvalRequired: "Validation client obligatoire",
      approvalRequiredDetail: "Envoie en revue avant la publication — ce client valide tout.",
      approvalOptional: "Validation client optionnelle",
      approvalAuto: "Publication directe (sans validation)",
      dateNone: "Aucune date de publication",
      dateNoneDetail: "Le contenu restera dans l'étagère « À planifier ».",
      datePast: "Date dans le passé",
      datePastDetail: "Choisis « dès que possible » ou une date ≥ maintenant + 15 min.",
      dateOk: "Programmé le {date}",
      dateOkDetail: "Fuseau du client ({tz}).",
      altMissing: "Texte alternatif manquant ({count, plural, one {# visuel} other {# visuels}})",
      altMissingDetail: "Accessibilité + SEO social — envoyé si la plateforme le supporte.",
      altOk: "Textes alternatifs renseignés",
    },

    // Dialog de programmation
    schedule: {
      shortcutTomorrow: "Demain 9 h",
      shortcutSaturday: "Samedi 11 h",
      shortcutNextSlot: "Prochain créneau ({time})",
      title: "Programmer la publication",
      tzNote: "Date et heure saisies dans le fuseau du client : {tz}.",
      hour: "Heure ({tz})",
      publishAt: "Publication : {date}",
      tzClient: "(fuseau du client)",
      inYourTz: "Soit {date} dans ton fuseau ({tz}).",
      latePast: "Ce créneau est déjà passé (ou à moins de 15 min).",
      asap: "Publier dès que possible",
      asapDetail:
        "Rattrapage immédiat — au-delà de {hours} h de retard, un contenu passe en échec et doit être reprogrammé.",
      repick: "Choisir une autre date",
      repickDetail: "Sélectionne un créneau futur (≥ maintenant + 15 min).",
      blocked:
        "Pré-flight bloquant : {count, plural, one {# point à corriger} other {# points à corriger}} avant de programmer (voir le panneau Pré-flight).",
      removeDate: "Retirer la date",
      confirm: "Programmer",
      toastAsap: "Publication dès que possible (aperçu)",
      toastScheduled: "Programmation enregistrée (aperçu)",
      toastScheduledDesc: "{date} — fuseau du client ({tz}).",
      toastRemoved: "Date retirée (aperçu)",
      toastRemovedDesc: "Le contenu repart dans l'étagère « À planifier ».",
    },

    // Popover hashtags
    hashtags: {
      groups: "Groupes de hashtags",
      groupsTitle: "Groupes du client",
      insertHint: "Un clic insère le groupe dans {destination}.",
      tagCount: "{count, plural, one {# tag} other {# tags}}",
    },

    // Écran principal (alertes, toasts)
    screen: {
      inReviewTitle: "Contenu en revue chez le client",
      inReviewDesc:
        "En réel, l'enregistrer le retire de la revue (règle d'éditabilité PRD) — le client en sera notifié.",
      scheduledTitle: "Contenu programmé",
      scheduledDesc:
        "En réel, seule la date reste modifiable sans annuler la programmation (règle PRD §5.B).",
      extraMediaRemoved: "Visuels supplémentaires retirés",
      extraMediaRemovedDesc: "Le format {format} n'accepte qu'un seul média (aperçu).",
      savedScheduled: "Contenu programmé (aperçu)",
      savedDraft: "Brouillon enregistré (aperçu)",
      savedDesc: "Aucune donnée n'est réellement écrite pendant la preview.",
    },
  },
} as const
