import { getBrandKit, getClient, getSocialAccounts } from "@/lib/mocks"
import type { Client } from "@/lib/mocks/types"
import { getPerfPeriodData, type PerfPeriod, type PerfPeriodData } from "./perf-data"

// Couche de données du rapport client : valeurs brutes + tops.
// Réutilise getPerfPeriodData (mêmes mocks que la page Performance).
// Toute la mise en mots (synthèse, libellé de période) est localisée à
// l'affichage par ReportWorkspace via t() — rien n'est figé en FR ici.

export interface ReportData {
  client: Client
  period: PerfPeriod
  brandColor: string
  /** Première couleur du brand kit, sinon teinte de marque du client. */
  accentColor: string
  igFollowers: number
  perf: PerfPeriodData
}

// Le rapport vise un livrable mensuel : période = mois en cours par défaut.
const REPORT_PERIOD: PerfPeriod = "month"

export function getReportData(clientId: string): ReportData | null {
  const client = getClient(clientId)
  if (!client) return null

  const perf = getPerfPeriodData(clientId, REPORT_PERIOD, client.timezone)
  const brand = getBrandKit(clientId)
  const ig = getSocialAccounts(clientId).find((a) => a.platform === "instagram")

  return {
    client,
    period: REPORT_PERIOD,
    brandColor: client.brandColor,
    accentColor: brand?.palette[0] ?? client.brandColor,
    igFollowers: ig?.followers ?? 0,
    perf,
  }
}
