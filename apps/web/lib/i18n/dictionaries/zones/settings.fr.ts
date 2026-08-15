// Namespace i18n « settings » (FR). Réglages globaux : comptes sociaux, agendas, profil.
export const settingsFr = {
  settings: {
    // P8-1 — rattachement explicite des sous-comptes
    attach: {
      title: "Choisir les comptes à rattacher",
      description:
        "Connexion « {account} ». Coche uniquement les comptes qui appartiennent au client choisi.",
      chooseClient: "Comptes disponibles",
      clientLabel: "Client destinataire",
      clientHint:
        "Un compte rattaché au mauvais client devient publiable depuis son espace — choisis avec attention.",
      selected:
        "{count, plural, =0 {Aucun compte sélectionné} one {# compte sélectionné} other {# comptes sélectionnés}}",
      submit: "Rattacher",
      done: "{count, plural, one {# compte rattaché} other {# comptes rattachés}}",
      error: "Rattachement impossible. Recharge la page et réessaie.",
      empty:
        "Ce compte ne donne accès à aucune Page ni aucun compte publiable. Vérifie les autorisations accordées côté fournisseur.",
    },
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
      detach: "Détacher",
      detachConfirm:
        "Le compte {platform} @{username} ne sera plus publiable, et son jeton d'accès sera définitivement détruit. Les publications déjà parues restent visibles dans l'historique. Pour le réutiliser, il faudra le reconnecter.",
      detached: "Compte détaché, jeton détruit.",
      detachError: "Détachement incomplet — le jeton est peut-être toujours actif. Réessaie.",
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
