// Namespace i18n « notifications » (FR). Centre de notifications in-app.
export const notificationsFr = {
  notifications: {
    // En-tête de page (notifications/page.tsx)
    metaTitle: "Notifications",
    pageTitle: "Notifications",
    pageDescriptionUnread:
      "{count, plural, one {# non lue} other {# non lues}} — publications, validations et comptes à surveiller.",
    pageDescription: "Publications, validations et comptes à surveiller.",
    filterAll: "Toutes",
    filterUnread: "Non lues",
    markAllRead: "Tout marquer comme lu",
    noneUnreadToast: "Aucune notification non lue.",
    markedReadToast:
      "{count, plural, one {# notification marquée comme lue} other {# notifications marquées comme lues}}",
    markedReadToastDescription: "Action simulée (preview)",
    emptyUnreadTitle: "Aucune notification non lue",
    emptyTitle: "Aucune notification",
    emptyUnreadDescription: "Tu es à jour — rien ne demande ton attention pour l'instant.",
    emptyDescription: "Les alertes de publication, validation et reconnexion apparaîtront ici.",
    unreadDot: "Non lue",
    channelInApp: "In-app",
    channelPush: "Push",
    channelEmail: "E-mail",
  },
} as const
