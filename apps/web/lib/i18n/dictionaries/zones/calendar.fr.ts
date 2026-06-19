// Namespace i18n « calendar » (FR).
export const calendarFr = {
  calendar: {
    // automation-dialog
    automation: {
      title: "Automatisations du client",
      description:
        "Règles de workflow propres à ce client. Aperçu — elles seront actives avec le backend.",
      ruleToggled: "Règle {state, select, on {activée} other {désactivée}} (aperçu)",
      rules: {
        remindEmptyWeekLabel: "Rappel si aucun post planifié à J-7",
        remindEmptyWeekDesc:
          "Une notification te prévient quand la semaine à venir est vide pour ce client.",
        remindReviewerLabel: "Relance du client après 48 h sans validation",
        remindReviewerDesc:
          "Un rappel est envoyé automatiquement au Reviewer (email + portail).",
        quotaDeferLabel: "Report automatique si quota Instagram atteint",
        quotaDeferDesc:
          "Comportement standard d'Ocean : le post est décalé au prochain créneau et tu es notifié du déplacement.",
        publishOnApprovalLabel: "Publication automatique dès approbation",
        publishOnApprovalDesc:
          "Uniquement si la date prévue est à plus de 15 minutes — une approbation tardive ne publie jamais seule.",
      },
    },
    // calendar-banners
    banners: {
      reconnectImpact:
        "{count, plural, one {# publication {platform} risque} other {# publications {platform} risquent}} d'échouer — reconnecte le compte @{username}.",
      pendingReview:
        "{count, plural, one {# contenu en attente} other {# contenus en attente}} de validation client.",
      pendingReviewAction: "Voir",
      nextWeekEmpty: "Rien n'est programmé sur les 7 prochains jours pour ce client.",
    },
    // calendar-controls
    controls: {
      monthPosts: "{count, plural, one {# post} other {# posts}} ce mois",
      gapTitle: "Périodes de plus de 4 jours sans publication planifiée",
      gaps: "{count, plural, one {# trou} other {# trous}} de cadence",
      toPlan: "{count} à planifier",
      igQuotaTitle: "Quota Instagram du compte (24 h glissantes)",
      marronniers: "Marronniers",
      marronniersToggle: "Afficher les marronniers",
      legend: "Légende",
      selection: "Sélection",
      monthMix: "Mix du mois",
      automations: "Automatisations",
      export: "Exporter",
    },
    // calendar-filters
    filters: {
      status: "Statut",
      platform: "Plateforme",
      format: "Format",
      pillar: "Pilier",
      clear: "Effacer",
      counts:
        "{count, plural, one {# affiché} other {# affichés}}{masked, plural, =0 {} one { · # masqué} other { · # masqués}}",
    },
    // calendar-legend
    legend: {
      statuses: "Statuts",
      platforms: "Plateformes",
      markers: "Marqueurs",
      lockedDate: "Date verrouillée",
      manualPublish: "Publication manuelle",
      tiktokDraft: "Brouillon TikTok",
      internalNote: "Note interne",
      clientEvent: "Événement client",
      marronnier: "Marronnier",
      cadenceGap: "Trou de cadence",
    },
    // calendar-toolbar
    toolbar: {
      prevPeriod: "Période précédente",
      nextPeriod: "Période suivante",
      today: "Aujourd'hui",
      todayShortcut: "Raccourci : T",
      clientTimezone: "Fuseau du client · {tz}",
      goToMonth: "Aller à un mois précis",
      prevYear: "Année précédente",
      nextYear: "Année suivante",
      viewMonth: "Mois",
      viewWeek: "Semaine",
      months: {
        jan: "Janv.",
        feb: "Févr.",
        mar: "Mars",
        apr: "Avr.",
        may: "Mai",
        jun: "Juin",
        jul: "Juil.",
        aug: "Août",
        sep: "Sept.",
        oct: "Oct.",
        nov: "Nov.",
        dec: "Déc.",
      },
      weekOf: "Semaine du {date}",
    },
    // calendar-selection-actions
    selection: {
      shiftDays: "Décaler de N jours",
      sendToReview: "Envoyer en validation",
      unschedule: "Annuler la planification",
    },
    // day-cell
    dayCell: {
      gapTitle: "Trou de cadence (plus de 4 jours sans publication)",
      viewDay: "Voir le détail du {day}",
      densityHigh:
        "{count} publications Instagram ce jour — densité élevée (le quota IG s'évalue sur 24 h glissantes)",
      densityNormal: "{count} publications Instagram ce jour",
      addTo: "Ajouter au {day}",
      posts: "{count} posts",
      createContent: "Créer un contenu (date préremplie)",
      addNote: "Ajouter une note",
      itemsOnDay: "{count, plural, one {# contenu} other {# contenus}} le {day}",
      marronnierTitle: "{label} · {kind} — créer un contenu pour cette date",
      marronnierKindSr: "({kind})",
      note: "Note",
      event: "Événement",
      moreOthers: "{count, plural, one {+# autre} other {+# autres}}",
    },
    // duplicate-dialog
    duplicate: {
      title: "Dupliquer le contenu",
      targetDate: "Date cible",
      targetClient: "Client de destination",
      thisClient: " (ce client)",
      copyHint:
        "La copie repart en brouillon, médias et légende inclus, avec son propre circuit de validation.",
      pastDate: "La date cible ne peut pas être passée.",
      confirm: "Dupliquer (aperçu)",
    },
    // move-dialogs (reschedule + shift)
    reschedule: {
      title: "Replanifier",
      date: "Date (fuseau client)",
      time: "Heure",
      pastError: "Impossible de replanifier dans le passé.",
      approvedNote:
        "La validation client reste valable après le changement de date — le client sera simplement notifié.",
      confirm: "Replanifier (aperçu)",
    },
    shift: {
      title: "Décaler la sélection",
      description:
        "{movable, plural, one {# contenu sera décalé} other {# contenus seront décalés}}{locked, plural, =0 {} one { · # ignoré (statut verrouillé)} other { · # ignorés (statut verrouillé)}}.",
      daysLabel: "Nombre de jours (négatif = avancer)",
      confirm: "Décaler de {days, plural, one {# jour} other {# jours}} (aperçu)",
    },
    // pillar-mix-panel
    mix: {
      title: "Mix du mois",
      subtitle: "Part réelle planifiée vs part promise au client.",
      driftLabel: "Écart de {points} points avec la cible",
      meterLabel:
        "{name} : {share} % planifié (cible {target} %, {count, plural, one {# contenu} other {# contenus}})",
      targetTitle: "Cible : {target} %",
      footnote: "Calculé sur les contenus datés du mois affiché (hors annulés).",
    },
    // entry-markers
    markers: {
      reconnectRisk: "Compte à reconnecter — risque d'échec",
      partiallyPublished: "Partiellement publié",
      tiktokDraft: "Brouillon TikTok — à finaliser dans l'app",
      manualPublish: "Publication manuelle (rappel à l'heure prévue)",
      waitingTitle: "En attente de validation depuis {days} j",
      waitingDays: "{days} j",
      commentsTitle: "{count, plural, one {# retour client} other {# retours client}}",
      approvalStale: "Approbation périmée — le contenu a changé depuis la validation",
      lockedDefault: "Date verrouillée",
      ariaLabel: "{title} — {status}",
    },
    // calendar-schedule lock reasons
    lock: {
      published: "Déjà publié — la date ne peut plus changer.",
      publishing: "Publication en cours — date verrouillée.",
      partiallyPublished: "Partiellement publié — repasser par la fiche pour relancer.",
      failed: "En échec — utilise « Réessayer » plutôt qu'un déplacement.",
      canceled: "Contenu annulé — date verrouillée.",
    },
    // calendar-actions toasts
    actions: {
      pastError: "Impossible de planifier dans le passé",
      rescheduledApproved: "Replanifié au {date} (aperçu)",
      rescheduledApprovedDesc:
        "La validation client reste valable — le client sera notifié du changement de date.",
      moved: "{state, select, scheduled {Planifié} other {Replanifié}} au {date} (aperçu)",
      movedDesc: "Aucune date n'est réellement modifiée pendant la preview.",
      reschedulePrecise: "Replanifié au {date} à {time} (aperçu)",
      reschedulePreciseApprovedDesc:
        "La validation client reste valable — le client sera notifié.",
      shifted:
        "{dir, select, advance {{count, plural, one {# contenu avancé} other {# contenus avancés}}} other {{count, plural, one {# contenu décalé} other {# contenus décalés}}}} de {days, plural, one {# jour} other {# jours}} (aperçu)",
      shiftedSkippedDesc:
        "{count, plural, one {# ignoré} other {# ignorés}} (statut verrouillé ou date passée).",
      unscheduled:
        "Planification annulée pour {count, plural, one {# contenu} other {# contenus}} (aperçu)",
      unscheduledSkippedDesc:
        "{count, plural, one {# ignoré} other {# ignorés}} (statut verrouillé ou déjà sans date). Les contenus repassent dans « À planifier ».",
      unscheduledDesc: "Les contenus repassent dans « À planifier ».",
      sendToReview:
        "Demande de validation envoyée pour {count, plural, one {# contenu} other {# contenus}} (aperçu)",
      sendToReviewDesc: "Le client recevra un lien direct vers le portail de validation.",
      retry: "Nouvelle tentative programmée pour « {title} » (aperçu)",
      retryDesc:
        "Seules les cibles en échec seront relancées — jamais de re-publication d'une cible déjà publiée.",
      remind: "Relance envoyée à {name} (aperçu)",
      remindFallbackName: "ton client",
      remindDesc: "Un rappel email pointe directement vers les contenus à valider.",
      duplicated: "« {title} » dupliqué (aperçu)",
      duplicatedDesc:
        "Copie en brouillon pour le {date}{client, select, none {} other { chez {client}}} — médias, légende et ciblage repris.",
    },
    // day-sheet
    daySheet: {
      itemsCount: "{count, plural, one {# contenu} other {# contenus}} · fuseau du client",
      marronnierKind: " · {kind}",
      createContent: "Créer un contenu",
      noContent: "Aucun contenu ce jour.",
      notesEvents: "Notes et événements",
      noNote: "Aucune note pour ce jour.",
      note: "Note",
      event: "Événement",
      addNotePlaceholder: "Ajouter une note (interne)…",
      noteTextLabel: "Texte de la note",
      typeToggle: "Type : {kind, select, note {note} other {événement}} — changer",
      typeToggleTitle: "Basculer note / événement",
      add: "Ajouter",
      createPrefilled: "Créer un contenu — date préremplie",
      noteAdded: "{kind, select, note {Note ajoutée} other {Événement ajouté}} (aperçu)",
    },
    // day-sheet-row
    daySheetRow: {
      actions: "Actions — {title}",
      openStudio: "Ouvrir le studio",
      reschedule: "Replanifier",
      duplicate: "Dupliquer",
      retry: "Réessayer",
      remindClient: "Relancer le client",
    },
    // content-quick-view
    quickView: {
      tiktokDraft: "Brouillon TikTok — à finaliser dans l'app à l'heure du rappel.",
      manualPublish: "Publication manuelle — un rappel sera envoyé à l'heure prévue.",
      awaitingReview: "En attente de validation client",
      awaitingReviewSince: "En attente de validation client depuis {days} j",
      openStudio: "Ouvrir le studio",
      reschedule: "Replanifier",
      duplicate: "Dupliquer",
      retry: "Réessayer",
      copyCaption: "Copier la légende",
      captionCopied: "Légende copiée",
      captionCopiedDesc: "Colle-la dans l'app à l'heure du rappel.",
      remindClient: "Relancer le client",
    },
    // entry-shell
    entryShell: {
      select: "Sélectionner : {label}",
    },
    // export-dialog
    export: {
      title: "Exporter le planning",
      description:
        "Aperçu d'impression — utilise « Enregistrer en PDF » dans la boîte de dialogue d'impression.",
      hideTechnical: "Masquer les états techniques",
      clientDeliverable: "Livrable client (masque échecs, annulés et statuts techniques)",
      footer:
        "Planning généré avec Ocean — aperçu preview, heures dans le fuseau du client ({tz}).",
      print: "Imprimer / PDF",
    },
    // planning-shelf
    shelf: {
      toPlan: "À planifier",
      allPlanned: "Aucun contenu sans date — tout est planifié.",
      dragHint: "Glisse une carte sur une case du calendrier pour la planifier (aperçu).",
      evergreenQueue: "File evergreen",
      evergreenEmpty:
        "Étiquette un contenu « Evergreen » dans le studio pour alimenter la file.",
      autoFill: "Auto-remplissage des trous (aperçu)",
      autoFillToggle: "Auto-remplissage des trous",
      autoFillOn: "Auto-remplissage activé (aperçu)",
      autoFillOff: "Auto-remplissage désactivé (aperçu)",
      autoFillOnDesc:
        "Ocean proposera des créneaux — aucune publication sans ta confirmation.",
      noGaps: "Aucun trou de cadence à venir ce mois-ci — rien à proposer.",
      proposalArrow: " → « {title} »",
      proposalHint:
        "Proposition uniquement : la file suggère des créneaux pour les trous de cadence, elle ne publie jamais sans confirmation.",
      noDate: "Sans date",
    },
    // month-grid
    monthGrid: {
      emptyTitle: "Aucun contenu programmé ce mois-ci",
      emptyDescription:
        "Planifie un contenu depuis une case de date, l'étagère « À planifier » ou le studio pour tenir la cadence.",
      createContent: "Créer un contenu",
    },
    // week-view
    week: {
      viewDay: "Voir le détail du {day}",
      newContent: "Nouveau contenu le {day}",
      note: "Note",
      event: "Événement",
      noContent: "Aucun contenu",
    },
    // weekday short labels (lundi → dimanche)
    weekdays: {
      mon: "Lun",
      tue: "Mar",
      wed: "Mer",
      thu: "Jeu",
      fri: "Ven",
      sat: "Sam",
      sun: "Dim",
    },
    // day-entry tooltip
    dayEntry: {
      tooltip: "{time} · {title}",
    },
  },
} as const
