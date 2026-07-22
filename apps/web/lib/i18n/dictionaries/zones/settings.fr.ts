// Namespace i18n « settings » (FR). Réglages globaux : comptes sociaux, agendas, profil.
export const settingsFr = {
  settings: {
    tabs: {
      social: "Comptes sociaux",
      calendars: "Agendas",
      profile: "Profil",
    },
    accounts: {
      emptyTitle: "Aucun espace client",
      emptyDescription:
        "Crée un espace client pour y connecter un compte Instagram, Facebook ou TikTok.",
      needsAttention:
        "{count, plural, one {# compte nécessite une reconnexion} other {# comptes nécessitent une reconnexion}}",
      healthDescription:
        "La santé des accès est surveillée en continu : un accès expiré est détecté avant l'heure de publication. Reconnecte les comptes signalés pour éviter tout échec.",
      followers: "{count} abonnés",
      noAccountForClient: "Aucun compte connecté pour ce client.",
      connect: "Connecter un compte",
      connectPlatform: "Connecter {platform}",
      reconnect: "Reconnecter",
      connectedToast: "Compte {provider} connecté",
      connectErrorTitle: "Connexion impossible",
      errorUnconfigured: "L'intégration n'est pas encore configurée (identifiants manquants).",
      errorDenied: "Autorisation refusée sur la plateforme.",
      errorGeneric: "La connexion a échoué. Réessaie dans un instant.",
    },
    calendars: {
      readOnlyTitle: "Connexion en lecture seule",
      readOnlyDescription:
        "Ocean lit tes événements pour composer l'agenda unifié (Google + Outlook) dans ton fuseau. Aucun rendez-vous n'est créé ni modifié sur tes calendriers.",
      connect: "Connecter un calendrier",
      reconnect: "Reconnecter",
      providerGoogle: "Google Agenda",
      providerMicrosoft: "Microsoft Outlook",
    },
    profile: {
      title: "Profil",
      description:
        "Informations de ton compte. La modification arrivera dans une prochaine version.",
      name: "Nom",
      email: "Adresse e-mail",
      timezone: "Fuseau horaire",
      timezoneHint: "Utilisé pour afficher ton agenda unifié.",
    },
  },
} as const
