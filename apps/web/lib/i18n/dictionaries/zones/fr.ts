// Agrégateur des namespaces de zones UI (FR). Un fichier par zone.

import { agendaFr } from "./agenda.fr"
import { authFr } from "./auth.fr"
import { boardFr } from "./board.fr"
import { calendarFr } from "./calendar.fr"
import { clientSettingsFr } from "./clientSettings.fr"
import { clientsFr } from "./clients.fr"
import { composerFr } from "./composer.fr"
import { dashboardFr } from "./dashboard.fr"
import { gridFr } from "./grid.fr"
import { libraryFr } from "./library.fr"
import { navFr } from "./nav.fr"
import { notificationsFr } from "./notifications.fr"
import { onboardingFr } from "./onboarding.fr"
import { performanceFr } from "./performance.fr"
import { portalFr } from "./portal.fr"
import { reportFr } from "./report.fr"
import { settingsFr } from "./settings.fr"
import { studioFr } from "./studio.fr"

export const zonesFr = {
  ...navFr,
  ...dashboardFr,
  ...clientsFr,
  ...calendarFr,
  ...gridFr,
  ...studioFr,
  ...composerFr,
  ...boardFr,
  ...settingsFr,
  ...clientSettingsFr,
  ...onboardingFr,
  ...performanceFr,
  ...reportFr,
  ...libraryFr,
  ...agendaFr,
  ...notificationsFr,
  ...portalFr,
  ...authFr,
} as const
