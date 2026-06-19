// Namespace i18n « settings » (FR). Réglages globaux : comptes sociaux, agendas, profil.
export const settingsFr = {
  settings: {
    tabs: {
      social: "Comptes sociaux",
      calendars: "Agendas",
      profile: "Profil",
    },
    accounts: {
      emptyTitle: "Aucun compte social connecté",
      emptyDescription:
        "Connecte un compte Instagram, Facebook ou TikTok depuis un espace client pour commencer à publier.",
      needsAttention:
        "{count, plural, one {# compte nécessite une reconnexion} other {# comptes nécessitent une reconnexion}}",
      healthDescription:
        "La santé des accès est surveillée en continu : un accès expiré est détecté avant l'heure de publication. Reconnecte les comptes signalés pour éviter tout échec.",
      followers: "{count} abonnés",
      reconnect: "Reconnecter",
      reconnectToast: "Reconnexion {platform}",
      reconnectToastDescription: "Action simulée (preview) — l'authentification s'ouvrira ici.",
    },
    calendars: {
      readOnlyTitle: "Connexion en lecture seule",
      readOnlyDescription:
        "Ocean lit tes événements pour composer l'agenda unifié (Google + Outlook) dans ton fuseau. Aucun rendez-vous n'est créé ni modifié sur tes calendriers.",
      connect: "Connecter un calendrier",
      connectToast: "Connexion {provider}",
      connectToastDescription: "Action simulée (preview) — l'autorisation s'ouvrira ici.",
      reconnect: "Reconnecter",
      reconnectToast: "Reconnexion {provider}",
      reconnectToastDescription: "Action simulée (preview) — l'autorisation s'ouvrira ici.",
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
