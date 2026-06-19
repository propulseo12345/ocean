// Namespace i18n « clients » (FR). Pages app/(app) : liste clients, espace
// client (layout + onglets), studio, calendrier, grille, médiathèque, etc.
export const clientsFr = {
  clients: {
    // Liste des clients
    listTitle: "Clients",
    listDescription:
      "Tes espaces de travail. Chaque client est isolé : contenus, comptes, validations.",
    newClient: "Nouveau client",
    statScheduled: "Programmés",
    statReview: "En revue",
    statPublished: "Publiés",
    archivedTitle: "Archivés",
    archivedCollab: "Collaboration archivée",
    accountToReconnect: "Un compte est à reconnecter",
    // Création d'un client
    newClientTitle: "Nouveau client",
    newClientDescription:
      "Créez un espace de travail isolé : identité, comptes, marque et stratégie en quelques étapes.",
    // Espace client (layout + onglets)
    newContent: "Nouveau contenu",
    // Titres de métadonnées (onglet du navigateur)
    metaGrid: "Grille feed",
    metaCalendar: "Calendrier éditorial",
    metaContentBoard: "Studio de contenu",
    metaContentDetail: "Contenu",
    metaContentNew: "Nouveau contenu",
    metaContentEdit: "Modifier le contenu",
    metaIdeas: "Banque d'idées",
    metaLibrary: "Médiathèque",
    metaPerformance: "Performance",
    metaSettings: "Réglages",
    metaReport: "Rapport client",
    // Grille feed — profil Instagram
    importedPostTitle: "Publication du {date}",
    highlightNouveautes: "Nouveautés",
    highlightCoulisses: "Coulisses",
    highlightAvis: "Avis",
    highlightEquipe: "Équipe",
    // Fiche contenu
    backToContent: "Retour au contenu",
    tabMedia: "Média",
    tabNativePreview: "Aperçu natif",
    fieldNewsletterSubject: "Objet de la newsletter",
    fieldCaption: "Légende",
    fieldFirstComment: "Premier commentaire Instagram",
    cardActions: "Actions",
    cardClientReview: "Validation client",
    cardTargets: "Cibles ({count})",
    noteContentLabel: "Note du contenu",
    // Édition — verrou lecture seule
    readOnlyTitle: "Contenu en lecture seule",
    readOnlyDescription:
      "La publication a commencé : « {title} » n'est plus modifiable. Duplique le contenu depuis sa fiche pour repartir d'une nouvelle version.",
    // Réglages comptes (espace global)
    settingsTitle: "Réglages",
    settingsDescription: "Comptes sociaux, agendas connectés et profil.",
  },
} as const
