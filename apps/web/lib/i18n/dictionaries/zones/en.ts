// Agrégateur des namespaces de zones UI (EN).

import { agendaEn } from "./agenda.en"
import { authEn } from "./auth.en"
import { boardEn } from "./board.en"
import { calendarEn } from "./calendar.en"
import { clientSettingsEn } from "./clientSettings.en"
import { clientsEn } from "./clients.en"
import { composerEn } from "./composer.en"
import { dashboardEn } from "./dashboard.en"
import { gridEn } from "./grid.en"
import { libraryEn } from "./library.en"
import { navEn } from "./nav.en"
import { notificationsEn } from "./notifications.en"
import { onboardingEn } from "./onboarding.en"
import { performanceEn } from "./performance.en"
import { portalEn } from "./portal.en"
import { reportEn } from "./report.en"
import { settingsEn } from "./settings.en"
import { studioEn } from "./studio.en"

export const zonesEn = {
  ...navEn,
  ...dashboardEn,
  ...clientsEn,
  ...calendarEn,
  ...gridEn,
  ...studioEn,
  ...composerEn,
  ...boardEn,
  ...settingsEn,
  ...clientSettingsEn,
  ...onboardingEn,
  ...performanceEn,
  ...reportEn,
  ...libraryEn,
  ...agendaEn,
  ...notificationsEn,
  ...portalEn,
  ...authEn,
}
