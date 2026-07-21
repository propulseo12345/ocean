// Namespace i18n « auth » (FR) — connexion par mot de passe.
export const authFr = {
  auth: {
    // En-tête de la landing — bouton de connexion.
    signIn: "Connexion",
    // Landing publique + panneau de marque (auth layout).
    landing: {
      previewBadge: "Aperçu produit — données de démonstration",
      heroTitle: "Le poste de pilotage du freelance en communication",
      heroLead:
        "Tout ce qu'une agence fait dans cinq outils — planification, feed, calendrier, validation client et agenda — réuni dans un seul, sans la complexité.",
      heroLeadShort:
        "Planification, feed, calendrier, validation client et agenda — réunis dans un seul outil, sans la complexité.",
      enterDemo: "Se connecter",
      seeClientPortal: "Voir le portail client",
      footer: "Ocean · Studio Marea",
      featurePublish: "Publication multi-plateforme",
      featureFeed: "Aperçu du feed Instagram",
      featureCalendar: "Calendrier éditorial",
      featureReview: "Validation client",
      featureAgenda: "Agenda unifié",
    },
    // Page connexion (carte).
    loginPage: {
      metaTitle: "Connexion",
      cardTitle: "Se connecter",
      cardDescription: "Saisis ton adresse e-mail et ton mot de passe.",
    },
    login: {
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "toi@studio.fr",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "••••••••",
      submit: "Se connecter",
      submitting: "Connexion…",
      invalidCredentialsTitle: "Connexion impossible",
      invalidCredentialsDetail: "Adresse e-mail ou mot de passe incorrect.",
    },
  },
} as const
