// Namespace i18n « performance » (FR). Page Performance + helpers de données.
export const performanceFr = {
  performance: {
    title: "Performance",
    subtitle: "Aperçu de l'audience et de l'engagement, par période.",
    periodAriaLabel: "Période d'analyse",
    generateReport: "Générer le rapport client",
    mockNotice:
      "Statistiques issues des API des plateformes. Elles apparaissent une fois les comptes connectés et les publications mesurées — certaines métriques dépendent d'un accès avancé Meta, et TikTok en mode brouillon n'en fournit aucune via l'API.",
    // Périodes d'analyse.
    period: {
      "30d": "30 derniers jours",
      month: "Mois en cours",
      "90d": "90 derniers jours",
      short30d: "30 j",
      shortMonth: "Mois en cours",
      short90d: "90 j",
      prev30d: "30 jours précédents",
      prevMonth: "mois précédent",
      prev90d: "90 jours précédents",
    },
    // KPIs.
    kpi: {
      reach: "Portée totale",
      engagement: "Engagements",
      rate: "Taux d'engagement",
      count: "Publications",
      vsPrevious: "vs {previous}",
      deltaUnavailable: "Comparaison avec la période précédente non disponible",
    },
    // Graphe de tendance.
    trend: {
      title: "Évolution sur la période",
      reach: "Portée",
      engagement: "Engagements",
      chartAria: "Évolution de la portée et des engagements sur la période",
      tableCaption: "Portée et engagements par intervalle",
      colInterval: "Intervalle",
      colReach: "Portée",
      colEngagement: "Engagements",
      bucketLabel: "P{index}",
      barTitle: "{label} · {value}",
    },
    // Répartition par pilier.
    pillar: {
      title: "Répartition par pilier",
      description:
        "Part des engagements par pilier éditorial — le repère vertical marque la cible.",
      postsAndShare: "{posts} pub. · {share}",
      targetMarker: "Cible {target}",
      targetAbove: "Cible {target} · au-dessus de l'objectif",
      targetBelow: "Cible {target} · en deçà de l'objectif",
    },
    // Top / flop des publications.
    posts: {
      topTitle: "Meilleures publications",
      flopTitle: "À retravailler",
      reachSuffix: "{value} portée",
      engagementSuffix: "{value} eng.",
      openInStudio: "Ouvrir « {title} » dans le studio",
      viewOnInstagram: "Voir « {title} » sur Instagram",
      importedTitle: "Publication du {date}",
    },
    // Comparatif par plateforme.
    platform: {
      title: "Comparatif par plateforme",
      colPlatform: "Plateforme",
      colPosts: "Publications",
      colReach: "Portée",
      colEngagement: "Engagements",
      colRate: "Taux",
      notMeasurable: "Non mesurable — {platform} en mode brouillon",
      noteDraft: "Brouillon — aucune statistique via l'API",
      noteFbLimited: "Métriques Pages limitées (accès avancé requis)",
    },
    // Meilleurs créneaux (heatmap).
    bestTimes: {
      title: "Meilleurs créneaux",
      description:
        "Estimation à partir de l'historique de publication — meilleur créneau estimé : ",
      hour: "{hour} h",
      slotLabel: "{day} {hour} h",
      cellTitle: "{day} {hour} h — affinité estimée {affinity} %",
      cellSr: "{day} {hour} h, affinité {affinity} %",
      disclaimer:
        "Indicatif : aucune API ne garantit ces créneaux. Affinez avec les retours réels du compte une fois les statistiques connectées.",
    },
    // Libellés courts des jours (lun → dim) pour la heatmap.
    weekday: {
      mon: "Lun",
      tue: "Mar",
      wed: "Mer",
      thu: "Jeu",
      fri: "Ven",
      sat: "Sam",
      sun: "Dim",
    },
  },
} as const
