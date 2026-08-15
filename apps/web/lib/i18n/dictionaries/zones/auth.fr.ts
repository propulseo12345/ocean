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
      noAccount: "Pas encore de compte ?",
      signUpLink: "Créer un compte",
      inviteSent:
        "Un e-mail vient de partir vers l'adresse invitée. Ouvre-le pour accéder à ton espace de validation.",
      inviteOtherAccount:
        "Cette invitation vise une autre adresse que celle de ta session. Déconnecte-toi, puis rouvre le lien.",
      inviteInvalid: "Ce lien d'invitation est invalide, expiré ou déjà utilisé.",
      authFailed: "Le lien a expiré ou a déjà servi. Reconnecte-toi.",
      signupPending: "Compte créé. Confirme ton adresse e-mail, puis connecte-toi.",
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
    // Amorçage d'organisation (P7-3) — atterrissage de tout compte sans org.
    onboarding: {
      metaTitle: "Créer ton organisation",
      cardTitle: "Créer ton organisation",
      cardDescription:
        "Ton compte n'est rattaché à aucune organisation. Donne-lui un nom pour commencer.",
      nameLabel: "Nom de l'organisation",
      namePlaceholder: "Studio Marea",
      nameHelp: "C'est le nom que verront tes clients. Tu pourras le changer plus tard.",
      submit: "Créer l'organisation",
      submitting: "Création…",
      errorTitle: "Création impossible",
      invalidNameDetail: "Le nom doit faire entre 1 et 120 caractères.",
      genericDetail: "Réessaie dans un instant. Si le problème persiste, contacte le support.",
      signOut: "Ce n'est pas mon compte — se déconnecter",
    },
    // Inscription (P7-4) — la route /signup n existait pas.
    signup: {
      metaTitle: "Créer un compte",
      cardTitle: "Créer un compte",
      cardDescription: "Quelques secondes, et ton espace de travail est prêt.",
      nameLabel: "Ton nom",
      namePlaceholder: "Étienne Guimbard",
      nameHelp: "Il sert aussi de nom à ton organisation — modifiable ensuite.",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "toi@exemple.fr",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "••••••••",
      passwordHelp: "8 caractères minimum.",
      submit: "Créer mon compte",
      submitting: "Création…",
      errorTitle: "Inscription impossible",
      invalidFormatDetail:
        "Vérifie ton nom, ton adresse e-mail et un mot de passe d'au moins 8 caractères.",
      genericDetail: "Cette adresse est peut-être déjà utilisée. Essaie de te connecter.",
      haveAccount: "Tu as déjà un compte ?",
      signInLink: "Se connecter",
    },
    // Acceptation d'une invitation reviewer (V-3). Page de CONFIRMATION : le
    // simple fait d'ouvrir ce lien ne rejoint plus rien et n'envoie plus rien.
    invitation: {
      metaTitle: "Invitation",
      joinTitle: "Rejoindre {client} ?",
      joinDescription:
        "Tu as été invité à valider les contenus de {client}. Personne n'est ajouté tant que tu n'as pas confirmé.",
      joinSubmit: "Rejoindre {client}",
      joinSubmitting: "Ajout en cours…",
      notMe: "Ce n'est pas ce que je veux",
      proofTitle: "Confirme ton adresse",
      proofDescription:
        "Pour rejoindre cet espace, il faut d'abord te connecter à l'adresse qui a reçu l'invitation. On t'envoie le lien.",
      proofSubmit: "M'envoyer le lien de connexion",
      proofSubmitting: "Envoi…",
      proofSentTitle: "Regarde tes e-mails",
      proofSentDescription:
        "Si cette invitation est valide, un lien de connexion vient de partir vers l'adresse invitée. Pense à vérifier tes spams.",
      wrongAccountTitle: "Mauvais compte",
      wrongAccountDescription:
        "Tu es connecté avec {courant}, mais cette invitation vise une autre adresse. Déconnecte-toi, puis rouvre le lien.",
      signOut: "Se déconnecter",
      invalidTitle: "Lien inutilisable",
      invalidDescription:
        "Ce lien d'invitation n'est plus valide. Il a peut-être expiré, été révoqué, ou déjà été utilisé. Demande une nouvelle invitation.",
      backToLogin: "Retour à la connexion",
      errorTitle: "Impossible de rejoindre",
      crossSiteDetail:
        "Cette demande n'a pas été envoyée depuis Ocean. Par sécurité, elle est refusée. Rouvre le lien depuis ton e-mail.",
      genericDetail: "Réessaie dans un instant. Si le problème persiste, contacte ton agence.",
    },
  },
} as const
