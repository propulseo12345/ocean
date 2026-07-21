import { getBrandKit, getClient, getSocialAccounts } from "@/lib/data"
import type { Client } from "@/lib/mocks/types"
import { getPerfPeriodData, type PerfPeriod, type PerfPeriodData } from "./perf-data"

// Couche de données du rapport client : valeurs brutes + tops (métriques réelles,
// mêmes sources que la page Performance). La mise en mots (synthèse, libellé de
// période) est localisée à l'affichage par ReportWorkspace via t().

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

export async function getReportData(orgId: string, clientId: string): Promise<ReportData | null> {
  const client = await getClient(orgId, clientId)
  if (!client) return null

  const [perf, brand, accounts] = await Promise.all([
    getPerfPeriodData(orgId, clientId, REPORT_PERIOD, client.timezone),
    getBrandKit(orgId, clientId),
    getSocialAccounts(orgId, clientId),
  ])
  const ig = accounts.find((a) => a.platform === "instagram")

  return {
    client,
    period: REPORT_PERIOD,
    brandColor: client.brandColor,
    accentColor: brand?.palette[0] ?? client.brandColor,
    igFollowers: ig?.followers ?? 0,
    perf,
  }
}
