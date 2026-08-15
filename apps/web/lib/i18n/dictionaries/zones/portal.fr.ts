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
      noClientTitle: "Aucun espace de validation",
      noClientDescription:
        "Ton compte n'est rattaché à aucun client. Si tu as reçu une invitation, ouvre-la depuis l'e-mail ; sinon, demande à ton agence de te réinviter.",
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
    // components/portal/annotation-viewer.tsx + annotation-thread.tsx
    annotation: {
      pinHint: "Touchez un repère sur le visuel pour voir la remarque associée.",
      pinLabel: "Repère {label}",
      draftPinLabel: "Repère en cours de saisie",
      noThread: "Aucun échange pour le moment.",
      client: "Client",
      yourAgency: "Votre agence",
      // components/portal/annotation-composer.tsx
      composerTitle: "Votre remarque",
      composerHint:
        "Écrivez votre retour. Pour viser un détail précis, placez un repère sur le visuel.",
      composerPlaceholder: "Ex. : le logo est trop près du bord, peut-on le décaler ?",
      composerAriaLabel: "Votre remarque sur cette publication",
      pinAction: "Placer un repère",
      pickingCancel: "Annuler le repère",
      pickingHint: "Touchez le visuel à l'endroit exact que vous voulez signaler.",
      pinnedOnSlide: "Repère sur le visuel {index}",
      removePin: "Retirer le repère",
      send: "Envoyer la remarque",
      posted: "Remarque envoyée",
      postedDetail: "Votre agence la retrouvera dans son espace de travail.",
      postError: "Votre remarque n'a pas pu être envoyée. Réessayez.",
    },
    // components/portal/media-carousel.tsx
    carousel: {
      altSlide: "{alt} — visuel {index}",
      video: "Vidéo",
      previous: "Visuel précédent",
      next: "Visuel suivant",
      viewSlide: "Voir le visuel {index}",
      pickPoint: "Choisir l'endroit du repère sur le visuel",
    },
    // components/portal/review-actions.tsx
    review: {
      decisionRecorded: "Décision enregistrée",
      decisionDetail: "{label} — « {title} ».",
      decisionError: "Votre décision n'a pas pu être enregistrée. Réessayez.",
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
