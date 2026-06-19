// Namespace i18n « portal » (FR) — portail de validation client + alertes partagées.
export const portalFr = {
  portal: {
    // Layout du portail (header / footer).
    layout: {
      reviewSpace: "Espace de validation",
      reviewSecuredSpace: "Ocean — espace de validation",
      connectedAs: "Connecté en tant que {name} · Ocean — espace sécurisé",
    },
    // Page d'accueil du portail (liste à valider + historique).
    home: {
      metaTitle: "Espace de validation",
      greeting: "Bonjour{name},",
      toValidateHeading:
        "Vous avez {count, plural, one {# publication} other {# publications}} à valider",
      upToDate: "Vous êtes à jour",
      toValidateLead:
        "Relisez chaque publication, laissez vos remarques si besoin, puis approuvez en un clic.",
      upToDateLead: "Dès qu'une nouvelle publication est prête, vous la retrouverez ici.",
      sectionToValidate: "À valider",
      sectionHistory: "Historique",
      emptyValidatedTitle: "Tout est validé",
      emptyValidatedDescription: "Aucune publication n'attend votre relecture pour l'instant.",
    },
    // Page de relecture d'un contenu.
    detail: {
      metaTitle: "Relecture",
      backToReviewSpace: "Retour à l'espace de validation",
      yourDecision: "Votre décision",
      nothingToDo: "Publication {status} — rien à faire de votre côté.",
      decisionHistory: "Historique des décisions",
      approved: "Approuvé",
      changesRequested: "Modifications demandées",
    },
    // components/portal/portal-card.tsx
    card: {
      textOnly: "Texte",
      reviewAndApprove: "Relire et valider",
      review: "Relire",
    },
    // components/portal/annotation-viewer.tsx
    annotation: {
      pinHint: "Touchez un repère sur le visuel pour voir la remarque associée.",
      pinLabel: "Repère {label}",
      noThread: "Aucun échange pour le moment.",
      client: "Client",
      yourAgency: "Votre agence",
    },
    // components/portal/media-carousel.tsx
    carousel: {
      altSlide: "{alt} — visuel {index}",
      video: "Vidéo",
      previous: "Visuel précédent",
      next: "Visuel suivant",
      viewSlide: "Voir le visuel {index}",
    },
    // components/portal/review-actions.tsx
    review: {
      decisionRecorded: "Décision enregistrée",
      decisionDetail: "{label} — « {title} » (action simulée, preview).",
      approved: "Contenu approuvé",
      changesRequested: "Modifications demandées",
      approve: "Approuver",
      requestChanges: "Demander des modifications",
      changesPlaceholder: "Expliquez ce qui doit être ajusté (texte, visuel, date…)",
      changesAriaLabel: "Message de demande de modifications",
      sendRequest: "Envoyer la demande",
      footnote: "Votre décision est enregistrée et votre agence en est informée immédiatement.",
    },
    // Clés partagées (components/shared/*) — sous portal.shared.* pour rester dans la zone.
    shared: {
      // account-alert.tsx
      reconnectSimulated: "Reconnexion {platform} simulée (aperçu)",
      reconnectSimulatedDetail: "Aucun compte n'est réellement reconnecté pendant la preview.",
      accountStatusTitle: "{platform} — {status}",
      reconnectImpact: "Le compte @{username} doit être reconnecté pour continuer à publier.",
      reconnect: "Reconnecter",
      inlineTitle: "@{username} — {status}",
      // selection-bar.tsx
      selectionActions: "Actions sur la sélection",
      selectionCount: "{count} {item}",
      clearSelection: "Tout désélectionner",
      itemSelected: "{count, plural, one {sélectionné} other {sélectionnés}}",
    },
  },
} as const
