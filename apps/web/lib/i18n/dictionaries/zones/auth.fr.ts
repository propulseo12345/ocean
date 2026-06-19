// Namespace i18n « auth » (FR) — connexion (lien magique / OTP).
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
      enterDemo: "Entrer dans la démo",
      seeClientPortal: "Voir le portail client",
      footer: "Ocean · Studio Marea — preview front (UI seule, sans backend)",
      featurePublish: "Publication multi-plateforme",
      featureFeed: "Aperçu du feed Instagram",
      featureCalendar: "Calendrier éditorial",
      featureReview: "Validation client",
      featureAgenda: "Agenda unifié",
    },
    // Page connexion (carte).
    loginPage: {
      metaTitle: "Connexion",
      cardTitle: "Accéder à la démo",
      cardDescription:
        "Aperçu produit à données fictives. Entre en un clic, ou simule une connexion sans mot de passe.",
    },
    // Page OTP (carte).
    otpPage: {
      metaTitle: "Vérification",
      cardTitle: "Entre ton code",
      cardDescription: "Saisis le code à 6 chiffres envoyé à ton adresse e-mail.",
      changeEmail: "Changer d'adresse e-mail",
    },
    login: {
      demoToastTitle: "Bienvenue dans la démo Ocean",
      demoToastDetail: "Compte de démonstration — données fictives.",
      invalidEmailTitle: "Adresse e-mail invalide",
      invalidEmailDetail: "Saisis une adresse valide pour continuer.",
      magicLinkToastTitle: "Lien magique validé (preview)",
      magicLinkToastDetail: "Connexion simulée pour {email} — accès à la démo.",
      otpToastTitle: "Code envoyé (preview)",
      otpToastDetail: "Action simulée — saisis un code de 6 chiffres au choix.",
      enterDemo: "Entrer dans la démo",
      orSimulate: "ou simule une connexion",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "toi@studio.fr",
      sendMagicLink: "Recevoir le lien magique",
      sendOtp: "Recevoir un code à 6 chiffres",
      hintDesktopPrefix: "Sur ordinateur, le ",
      hintDesktopBold: "lien magique",
      hintDesktopSuffix: " est le plus simple.",
      hintMobilePrefix: "Sur mobile, préfère le ",
      hintMobileBold: "code à 6 chiffres",
      hintMobileSuffix: ".",
    },
    otp: {
      incompleteTitle: "Code incomplet",
      incompleteDetail: "Saisis les 6 chiffres reçus par e-mail.",
      verifiedTitle: "Code vérifié (preview)",
      verifiedDetail: "Action simulée — redirection vers le tableau de bord.",
      resentTitle: "Nouveau code envoyé (preview)",
      resentDetail: "Action simulée — un code a été renvoyé.",
      codeLabel: "Code à 6 chiffres",
      digitAriaLabel: "Chiffre {index} sur {total}",
      verify: "Vérifier",
      noCode: "Tu n'as rien reçu ?",
      resend: "Renvoyer le code",
    },
  },
} as const
