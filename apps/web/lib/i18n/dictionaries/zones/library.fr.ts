// Namespace i18n « library » (FR).
export const libraryFr = {
  library: {
    // En-tête / workspace
    title: "Médiathèque",
    subtitle: "La banque de médias de {name} — le composer pioche dedans sans re-upload.",
    select: "Sélectionner",
    depositLink: "Lien de dépôt client",
    addMedia: "Ajouter des médias",
    // Tri
    sort: {
      recent: "Plus récents",
      weight: "Plus lourds",
      usage: "Plus utilisés",
      ariaLabel: "Trier les médias",
    },
    // Sources d'asset
    source: {
      upload: "Upload",
      uploadVerb: "Ajouté le",
      depositClient: "Déposé par le client",
      depositVerb: "Reçu le",
      import: "Importé",
      importVerb: "Importé le",
    },
    // Types MIME (libellé de repli)
    mime: {
      video: "Vidéo",
      image: "Image",
    },
    // Unités
    unit: {
      mb: "{value} Mo",
      video: "Vidéo",
    },
    // Carte d'asset
    card: {
      fallbackLabel: "Média {id}",
      selectAria: "Sélectionner {label}",
      openAria: "Ouvrir la fiche de {label}",
      usedCount: "Utilisé ×{count}",
      unused: "Inédit",
      offSpec: "Hors specs Instagram",
      specWarning: "Avertissement specs",
    },
    // Grille
    grid: {
      emptyFilteredTitle: "Aucun média ne correspond",
      emptyTitle: "Médiathèque vide",
      emptyFilteredDesc: "Modifie la recherche ou les filtres pour retrouver tes médias.",
      emptyDesc: "Ajoute des médias ou envoie un lien de dépôt à ton client pour démarrer.",
      depositSection: "Reçus du client",
      depositCount:
        "{count, plural, one {# média déposé via le lien de dépôt} other {# médias déposés via le lien de dépôt}}",
      allMedia: "Tous les médias",
    },
    // Statistiques d'en-tête (chips)
    stats: {
      total: "{count, plural, one {média} other {médias}}",
      unused: "{count, plural, one {inédit} other {inédits}}",
      deposit: "{count, plural, one {reçu du client} other {reçus du client}}",
      offSpec: "hors specs",
    },
    // Barre d'outils / filtres
    toolbar: {
      searchPlaceholder: "Rechercher (alt text, nom de fichier)…",
      searchAria: "Rechercher un média",
      filtersLabel: "Filtres de la médiathèque",
      typeImage: "Images",
      typeVideo: "Vidéos",
      usageUsed: "Utilisés",
      usageUnused: "Inédits",
      offSpecIg: "Hors specs IG",
      clear: "Effacer",
    },
    // Fiche asset (sheet)
    sheet: {
      conform: "Conforme aux specs Instagram.",
      createContent: "Créer un contenu avec ce média",
      crop: "Recadrer (aperçu)",
      cropToastTitle: "Recadrage simulé (aperçu)",
      cropToastDesc: "L'éditeur de recadrage 4:5 · 1:1 · 9:16 s'ouvrira ici en réel.",
      delete: "Supprimer (aperçu)",
    },
    // Détails d'asset
    details: {
      type: "Type",
      format: "Format",
      dimensions: "Dimensions",
      ratio: "Ratio",
      weight: "Poids",
      duration: "Durée",
      source: "Source",
      altLabel: "Texte alternatif",
      altPlaceholder: "Décris le visuel pour l'accessibilité et le SEO social…",
      altHint: "Envoyé à Instagram et Facebook si la plateforme le supporte.",
      save: "Enregistrer (aperçu)",
      usedIn: "{count, plural, one {Utilisé dans # contenu} other {Utilisé dans # contenus}}",
      neverUsed: "Jamais utilisé",
      unusedHint: "Média inédit — idéal pour le prochain batch de contenu.",
      purgeNote:
        "En réel, l'original est purgé 7 jours après publication : seule la miniature reste et réutiliser ce média demandera un re-téléversement.",
    },
    // Dialogue de suppression
    deleteDialog: {
      title: "Supprimer ce média ?",
      description:
        "{name} est utilisé dans {count, plural, one {# contenu} other {# contenus}} :",
      andMore: "{count, plural, one {et # autre…} other {et # autres…}}",
      warning:
        "En réel, ces contenus perdraient ce visuel et repasseraient en brouillon. En preview, la suppression est purement visuelle.",
      confirm: "Supprimer quand même (aperçu)",
    },
    // Barre de sélection (batch)
    selection: {
      itemLabel: "sélectionné",
      download: "Télécharger (aperçu)",
      tag: "Taguer",
      delete: "Supprimer",
    },
    // Lien de dépôt client
    deposit: {
      title: "Lien de dépôt client",
      description:
        "{name} dépose ses photos et vidéos via ce lien sécurisé reçu par email — sans mot de passe à retenir. Tout arrive directement dans « Reçus du client », et tu es notifié à chaque dépôt.",
      urlLabel: "Lien de dépôt",
      copyAria: "Copier le lien de dépôt",
      validityLabel: "Durée de validité",
      validityDays: "{count} jours",
      validityHint: "Passé ce délai, le lien expire — tu pourras en générer un nouveau ici.",
      received:
        "{count, plural, one {# média déjà reçu du client} other {# médias déjà reçus du client}}",
      seeInLibrary: "voir dans la médiathèque",
      sendEmail: "Envoyer par email (aperçu)",
      copyLink: "Copier le lien",
      copied: "Lien copié dans le presse-papier",
      copyError: "Copie impossible — sélectionne le lien manuellement.",
      emailToastTitle: "Email de dépôt envoyé (aperçu)",
      emailToastDesc:
        "Ton client recevra le lien valable {count} jours, avec les consignes de format.",
    },
    // Dialogue d'upload
    upload: {
      title: "Ajouter des médias",
      description:
        "Aucun fichier n'est réellement téléversé pendant la preview — le clic simule l'ajout.",
      dropTitle: "Glisse tes photos et vidéos ici",
      dropHint: "ou clique pour parcourir (simulation d'ajout)",
      specImage:
        "Images Instagram : JPEG ≤ {max} Mo, ratio 4:5 à 1.91:1 — conversion automatique des PNG.",
      specHeic: "HEIC iPhone : converti en JPEG à l'import, rien à faire de ton côté.",
      specReel: "Reels : MP4 ou MOV, 3 s à 15 min, ≤ {max} Mo.",
    },
    // Toasts (workspace)
    toast: {
      deleted: "Média supprimé (aperçu)",
      noneDeletedTitle: "Aucun média supprimé",
      noneDeletedDesc: "Tous les médias sélectionnés sont utilisés dans des contenus.",
      batchDeleted:
        "{count, plural, one {# média supprimé (aperçu)} other {# médias supprimés (aperçu)}}",
      batchKept:
        "{count, plural, one {# conservé : utilisé dans des contenus.} other {# conservés : utilisés dans des contenus.}}",
      downloading:
        "{count, plural, one {# média en téléchargement (aperçu)} other {# médias en téléchargement (aperçu)}}",
      tagTitle: "Étiquettes (aperçu)",
      tagDesc:
        "{count, plural, one {Les tags libres arriveront ici pour # média.} other {Les tags libres arriveront ici pour # médias.}}",
      altSaved: "Texte alternatif enregistré (aperçu)",
      added: "{count, plural, one {# média ajouté (aperçu)} other {# médias ajoutés (aperçu)}}",
      addedDesc: "Aucun fichier téléversé — assets fictifs pour valider le parcours.",
    },
  },
} as const
