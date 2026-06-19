// Agrégateur des namespaces de zones UI (FR). Un fichier par zone.
import { navFr } from "./nav.fr"
import { dashboardFr } from "./dashboard.fr"
import { clientsFr } from "./clients.fr"
import { calendarFr } from "./calendar.fr"
import { gridFr } from "./grid.fr"
import { studioFr } from "./studio.fr"
import { composerFr } from "./composer.fr"
import { boardFr } from "./board.fr"
import { settingsFr } from "./settings.fr"
import { clientSettingsFr } from "./clientSettings.fr"
import { onboardingFr } from "./onboarding.fr"
import { performanceFr } from "./performance.fr"
import { reportFr } from "./report.fr"
import { libraryFr } from "./library.fr"
import { agendaFr } from "./agenda.fr"
import { notificationsFr } from "./notifications.fr"
import { portalFr } from "./portal.fr"
import { authFr } from "./auth.fr"

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
