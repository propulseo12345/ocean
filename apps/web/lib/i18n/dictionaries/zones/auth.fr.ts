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
      forgotLink: "Mot de passe oublié ?",
    },
    // Demande de réinitialisation (email).
    forgot: {
      metaTitle: "Réinitialiser le mot de passe",
      cardTitle: "Mot de passe oublié",
      cardDescription: "Saisis ton adresse e-mail : on t'envoie un lien de réinitialisation.",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "toi@studio.fr",
      submit: "Envoyer le lien",
      submitting: "Envoi…",
      sentTitle: "E-mail envoyé",
      sentDescription:
        "Si un compte existe pour cette adresse, un lien de réinitialisation vient de partir. Pense à vérifier tes spams.",
      invalidEmail: "Adresse e-mail invalide.",
      backToLogin: "Retour à la connexion",
    },
    // Choix d'un nouveau mot de passe (après clic sur le lien).
    reset: {
      metaTitle: "Nouveau mot de passe",
      cardTitle: "Choisir un nouveau mot de passe",
      cardDescription: "Ton nouveau mot de passe doit faire au moins 8 caractères.",
      passwordLabel: "Nouveau mot de passe",
      passwordPlaceholder: "••••••••",
      submit: "Mettre à jour",
      submitting: "Mise à jour…",
      errorTitle: "Mise à jour impossible",
      weakPasswordDetail: "Le mot de passe doit faire au moins 8 caractères.",
      genericDetail: "Le lien a peut-être expiré. Redemande un e-mail de réinitialisation.",
    },
  },
} as const
