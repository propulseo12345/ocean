// Namespace i18n « agenda » (FR). Rempli par le lot UI correspondant.
export const agendaFr = {
  agenda: {
    // En-tête de page (agenda/page.tsx)
    metaTitle: "Agenda unifié",
    pageTitle: "Agenda unifié",
    pageDescription:
      "Tes rendez-vous Google et Outlook superposés aux publications de tous tes clients — dans ton fuseau.",
    // Navigation semaine
    prevWeek: "Semaine précédente",
    nextWeek: "Semaine suivante",
    today: "Aujourd'hui",
    filters: "Filtres",
    calendarsAndFilters: "Agendas & filtres",
    // États vides
    freeWeek: "Semaine libre",
    freeWeekHint: "Aucun rendez-vous ni publication sur cette semaine.",
    // Grille / blocs
    allDayShort: "Jour",
    allDay: "Journée",
    // Sidebar
    connectedAccounts: "Comptes connectés",
    calendars: "Calendriers",
    showCalendar: "Afficher le calendrier {name}",
    legend: "Légende",
    legendEvent: "Rendez-vous agenda",
    legendPublication: "Publication planifiée",
    // Libellés courts des jours (lun → dim)
    weekday: {
      mon: "lun",
      tue: "mar",
      wed: "mer",
      thu: "jeu",
      fri: "ven",
      sat: "sam",
      sun: "dim",
    },
  },
} as const
