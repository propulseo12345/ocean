// Namespace i18n « onboarding » (FR) — wizard de création d'un client.
export const onboardingFr = {
  onboarding: {
    // Étapes (libellés courts du stepper) + titres/descriptions de chaque étape
    steps: {
      identity: "Identité",
      accounts: "Comptes",
      brand: "Marque",
      strategy: "Stratégie",
      review: "Récapitulatif",
    },
    stepTitle: {
      identity: "Identité du client",
      accounts: "Comptes sociaux",
      brand: "Identité de marque",
      strategy: "Stratégie de contenu",
      review: "Récapitulatif",
    },
    stepDescription: {
      identity: "Les informations de base de la marque.",
      accounts: "Connectez les réseaux à gérer.",
      brand: "Palette, ton et garde-fous éditoriaux.",
      strategy: "Piliers, créneaux et validation.",
      review: "Vérifiez avant de créer le client.",
    },
    // Coquille du wizard
    shell: {
      progressLabel: "Progression",
      skip: "Passer",
      createClient: "Créer le client",
      identityRequired: "Renseignez le nom et l'identifiant du client pour continuer.",
      identityRequiredHint: "Le nom et l'identifiant sont requis pour passer à la suite.",
      reviewerEmailFix: "Corrigez l'adresse email du valideur ou laissez le champ vide.",
      defaultClientName: "Le client",
      clientCreated: "{name} créé",
      clientCreatedWithReviewer: "Invitation du relecteur enregistrée.",
      clientCreatedNoReviewer: "Client créé.",
      creating: "Création…",
      handleTaken: "Cet identifiant est déjà pris par un autre client.",
      createError: "Création impossible. Réessayez.",
    },
    // Stepper
    stepper: {
      navLabel: "Étapes de création",
    },
    // Actions génériques des éditeurs de liste/tags
    listEditor: {
      add: "Ajouter",
      removeAria: "Retirer {value}",
    },
    // Étape 1 — identité
    identity: {
      previewLabel: "Aperçu de la fiche client",
      previewHeading: "Aperçu",
      newClient: "Nouveau client",
      nameLabel: "Nom du client",
      namePlaceholder: "Ex. Brûlerie Lacaze",
      handleLabel: "Identifiant",
      handlePlaceholder: "brulerielacaze",
      handleHint: "Le @ du compte principal, sans espace.",
      handleFallback: "identifiant",
      categoryLabel: "Catégorie",
      categoryPlaceholder: "Choisir une activité",
      timezoneLabel: "Fuseau horaire du client",
      timezoneHint: "Les publications seront planifiées à l'heure locale du client.",
      bioLabel: "Bio",
      bioPlaceholder: "La présentation affichée sur le profil — quelques lignes suffisent.",
    },
    // Étape 2 — comptes
    accounts: {
      notice:
        "La connexion réelle se fait via l'autorisation officielle de chaque plateforme. Ici, en aperçu, on simule la liaison. Vous pourrez tout connecter (ou reconnecter) plus tard depuis les réglages — aucun compte n'est obligatoire pour créer le client.",
      connectedCount:
        "{count, plural, one {# compte connecté} other {# comptes connectés}} (aperçu)",
      igRecommended: "Instagram est recommandé pour la grille de feed.",
    },
    // Carte de connexion de compte
    accountCard: {
      noteInstagram:
        "Requiert un compte Pro (Business ou Créateur) relié à une Page Facebook. Recommandé pour la grille de feed.",
      noteFacebook: "La publication passe par la Page Facebook liée, pas par un profil personnel.",
      noteTiktok:
        "Publication en brouillon uniquement : Ocean prépare la vidéo, vous finalisez la légende dans l'app TikTok.",
      connected: "Connecté",
      usernameLabel: "Identifiant du compte",
      usernamePlaceholderTiktok: "@compte.tiktok",
      usernamePlaceholder: "@compte",
      connect: "Connecter",
      disconnect: "Déconnecter",
      usernameRequired: "Renseignez l'identifiant du compte avant de connecter.",
      oauthRedirect: "Redirection OAuth {platform} (aperçu)",
      oauthRedirectHint:
        "L'autorisation s'ouvrira ici en production — compte marqué connecté (aperçu).",
      disconnected: "{platform} déconnecté (aperçu)",
    },
    // Étape 3 — marque
    brand: {
      intro:
        "Ces repères suivront le client partout : ils s'afficheront pendant la rédaction et serviront de garde-fous. Vous pourrez les affiner à tout moment dans les réglages.",
      toneLabel: "Ton éditorial",
      tonePlaceholder: "Choisir un ton",
      toneHint: "Comment la marque s'adresse à son audience (tutoiement, vouvoiement, registre…).",
      doLabel: "À faire",
      doPlaceholder: "Ex. Tutoyer la communauté",
      dontLabel: "À éviter",
      dontPlaceholder: "Ex. Promotions agressives",
      bannedLabel: "Mots interdits",
      bannedDescription:
        "Termes à ne jamais utiliser (concurrents, claims, jargon). Ocean alertera s'ils apparaissent dans une légende.",
      bannedPlaceholder: "Ex. discount, concurrent…",
    },
    // Palette de couleurs de marque
    palette: {
      brandColorLabel: "Couleur de marque",
      paletteLabel: "Palette de la marque",
      paletteHint:
        "Sélectionnez de 3 à 5 teintes — elles guideront la direction artistique du feed.",
      selectedCount: "{count, plural, one {# teinte sélectionnée} other {# teintes sélectionnées}}",
      maxReached: "maximum atteint",
    },
    // Couleurs de marque (libellés des teintes)
    color: {
      cafe: "Café",
      green: "Vert",
      pink: "Rose",
      purple: "Violet",
      coral: "Corail",
      blue: "Bleu",
      cyan: "Cyan",
      emerald: "Émeraude",
      amber: "Ambre",
      earth: "Terre",
      slate: "Ardoise",
      graphite: "Graphite",
    },
    // Étape 4 — stratégie
    strategy: {
      pillarsTitle: "Piliers de contenu",
      pillarsDescription:
        "Les grands thèmes éditoriaux du client, avec une part cible — pour garder un mois équilibré.",
      slotsTitle: "Créneaux de publication récurrents",
      slotsDescription:
        "Les rendez-vous convenus avec le client (jour, heure locale, plateformes).",
      approvalTitle: "Niveau de validation",
      approvalDescription: "Comment les publications sont validées avant de partir.",
      approvalLabel: "Niveau de validation du client",
      approvalHelp: {
        required:
          "Chaque publication passe par le portail : rien ne part sans le feu vert du client.",
        optional: "Vous décidez au cas par cas si une publication a besoin d'une validation.",
        auto: "Les publications partent directement à l'heure prévue, sans étape de validation.",
      },
    },
    // Éditeur de piliers
    pillar: {
      suggestionsFor: "Suggestions pour « {category} »",
      suggestions: "Suggestions",
      sharePctAria: "Part cible de {name} en pourcentage",
      removeAria: "Retirer {name}",
      customPlaceholder: "Nom d'un pilier sur-mesure",
      add: "Ajouter",
      totalBalanced: "Total : {total} % — parfaitement équilibré",
      totalHint: "Total : {total} % (idéalement 100 %)",
    },
    // Suggestions de piliers (par catégorie)
    pillarSuggestion: {
      productMenu: "Produit & menu",
      backstage: "Coulisses",
      reviews: "Avis clients",
      events: "Événements",
      collection: "Collection",
      lookbook: "Lookbook & styling",
      workshop: "Atelier",
      communityUgc: "Communauté & UGC",
      careProducts: "Soins & produits",
      tips: "Conseils",
      beforeAfter: "Avant / après",
      testimonials: "Témoignages",
      craft: "Savoir-faire",
      novelties: "Nouveautés",
      bespoke: "Sur-mesure",
      expertise: "Expertise",
      caseStudies: "Cas clients",
      practicalTips: "Conseils pratiques",
      classes: "Cours & ateliers",
      teaching: "Pédagogie",
      wellbeing: "Bien-être",
      studioLife: "Vie du studio",
      product: "Produit",
      community: "Communauté",
    },
    // Éditeur de créneaux
    slot: {
      dayLabel: "Jour",
      dayFallback: "Jour",
      timeLabel: "Heure (locale client)",
      platformsLegend: "Plateformes",
      addSlot: "Ajouter le créneau",
      removeAria: "Retirer ce créneau",
    },
    // Jours de la semaine
    weekday: {
      mondayLong: "Lundi",
      mondayShort: "Lun",
      tuesdayLong: "Mardi",
      tuesdayShort: "Mar",
      wednesdayLong: "Mercredi",
      wednesdayShort: "Mer",
      thursdayLong: "Jeudi",
      thursdayShort: "Jeu",
      fridayLong: "Vendredi",
      fridayShort: "Ven",
      saturdayLong: "Samedi",
      saturdayShort: "Sam",
      sundayLong: "Dimanche",
      sundayShort: "Dim",
    },
    // Catégories d'activité
    category: {
      restaurant: "Restaurant / Café",
      fashion: "Mode / Boutique",
      beauty: "Beauté / Bien-être",
      craft: "Artisan / Atelier",
      services: "Services / Conseil",
      sport: "Sport / Studio",
      realEstate: "Immobilier",
      health: "Santé",
      culture: "Association / Culture",
      other: "Autre",
    },
    // Fuseaux horaires
    timezone: {
      paris: "Europe/Paris (métropole)",
      brussels: "Europe/Bruxelles",
      luxembourg: "Europe/Luxembourg",
      reunion: "La Réunion (UTC+4)",
      martinique: "Martinique (UTC−4)",
      guadeloupe: "Guadeloupe (UTC−4)",
      guiana: "Guyane (UTC−3)",
      tahiti: "Tahiti (UTC−10)",
      montreal: "Montréal (UTC−4/−5)",
    },
    // Tons éditoriaux
    tone: {
      warm: "Chaleureux & proche",
      professional: "Professionnel & posé",
      casual: "Décontracté & spontané",
      premium: "Premium & raffiné",
      committed: "Engagé & militant",
      educational: "Pédagogique & rassurant",
    },
    // Étape 5 — récapitulatif
    review: {
      cardIdentity: "Identité",
      cardAccounts: "Comptes sociaux",
      cardBrand: "Marque",
      cardStrategy: "Stratégie",
      emptyValue: "—",
      noAccounts: "Aucun compte connecté — à faire plus tard dans les réglages.",
      toneLine: "Ton :",
      toneUndefined: "non défini",
      doCount: "{count, plural, one {# à faire} other {# à faire}}",
      dontCount: "{count, plural, one {# à éviter} other {# à éviter}}",
      bannedCount: "{count, plural, one {# mot interdit} other {# mots interdits}}",
      pillarsLine: "{count, plural, one {# pilier} other {# piliers}}",
      mixLine: "mix {total} %",
      noPillars: "Aucun pilier défini.",
      slotsLine: "{count, plural, one {# créneau récurrent} other {# créneaux récurrents}}",
      approvalLine: "Validation :",
      reviewerLabel: "Inviter un valideur (optionnel)",
      reviewerHint:
        "Le contact du client qui validera les publications depuis le portail. Un email de bienvenue partira via Brevo — aucun envoi pendant l'aperçu.",
      reviewerPlaceholder: "contact@client.fr",
      reviewerInvalid: "Adresse email invalide.",
    },
  },
} as const
