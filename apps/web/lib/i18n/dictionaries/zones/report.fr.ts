// Namespace i18n « report » (FR). Rapport client mensuel (export PDF).
export const reportFr = {
  report: {
    // Période du rapport.
    periodLabel: "Juin 2026",
    // Barre d'actions.
    actions: {
      backToPerformance: "Performance",
      customize: "Personnaliser",
      sectionsTitle: "Sections du rapport",
      copyLink: "Copier le lien",
      exportPdf: "Exporter en PDF",
      copiedTitle: "Lien de partage copié",
      copiedDescription: "Instantané figé du rapport, consultable sans compte. Le lien reste privé tant que tu ne le partages pas.",
      readyTitle: "Lien de partage prêt",
      shareError: "Le lien n'a pas pu être généré. Réessayez.",
      printTitle: "Ouverture de l'impression…",
      printDescription: "Choisissez « Enregistrer en PDF » dans la boîte de dialogue.",
    },
    // Sections incluables (toggle « Personnaliser »).
    section: {
      kpis: "Chiffres clés",
      highlights: "Meilleures publications",
      mix: "Mix de contenu",
      note: "Mot du community manager",
    },
    // En-tête brandé.
    header: {
      monthlyReview: "Bilan mensuel · {period}",
      igFollowers: "abonnés Instagram",
    },
    // Synthèse en langage clair.
    summary: {
      title: "En un coup d'œil",
      line1:
        "Ce mois-ci, {count, plural, one {# publication a} other {# publications ont}} touché {reach} comptes.",
      line2:
        "Vos contenus ont généré {engagement} interactions (j'aime, commentaires et enregistrements).",
      line3:
        "La régularité de publication est tenue et le mix éditorial reste fidèle à la ligne définie ensemble.",
    },
    // Chiffres clés.
    kpi: {
      reach: "Portée",
      engagement: "Engagements",
      rate: "Taux d'engagement",
      count: "Publications",
      vsPreviousMonth: "{delta} vs mois précédent",
    },
    // Meilleures publications.
    highlights: {
      title: "Vos meilleures publications",
      stats: "{reach} vues · {engagement} interactions",
    },
    // Mix de contenu.
    mix: {
      title: "Mix de contenu",
      pillarTitle: "{name} · {share}",
    },
    // Mot du mois.
    note: {
      title: "Le mot du mois",
      ariaLabel: "Mot de synthèse du community manager",
      default:
        "Un mois régulier et fidèle à votre ligne éditoriale. On capitalise le mois prochain sur les formats qui ont le mieux résonné auprès de votre communauté, et on garde ce rythme de publication.",
    },
    // Pied de page.
    footer: {
      generatedBy: "Généré par Ocean",
      separator: "{name} · {period}",
    },
    printHint:
      "Aperçu fidèle à l'impression — utilisez « Exporter en PDF » pour le livrable client.",
  },
} as const
