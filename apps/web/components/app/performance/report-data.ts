import { getBrandKit, getClient, getSocialAccounts } from "@/lib/mocks"
import type { Client } from "@/lib/mocks/types"
import { getPerfPeriodData, type PerfPeriod, type PerfPeriodData } from "./perf-data"
import { compactNumber, signedPercent } from "./perf-utils"

// Couche de données du rapport client : synthèse en langage clair + tops.
// Réutilise getPerfPeriodData (mêmes mocks que la page Performance).

export interface ReportData {
  client: Client
  period: PerfPeriod
  periodLabel: string
  brandColor: string
  /** Première couleur du brand kit, sinon teinte de marque du client. */
  accentColor: string
  igFollowers: number
  perf: PerfPeriodData
  summaryLines: string[]
}

// Le rapport vise un livrable mensuel : période = mois en cours par défaut.
const REPORT_PERIOD: PerfPeriod = "month"
const REPORT_PERIOD_LABEL = "Juin 2026"

export function getReportData(clientId: string): ReportData | null {
  const client = getClient(clientId)
  if (!client) return null

  const perf = getPerfPeriodData(clientId, REPORT_PERIOD, client.timezone)
  const brand = getBrandKit(clientId)
  const ig = getSocialAccounts(clientId).find((a) => a.platform === "instagram")
  const { reach, engagement, count } = perf.kpis.current
  const delta = perf.kpis.delta

  const summaryLines = [
    `Ce mois-ci, ${count} publication${count > 1 ? "s ont" : " a"} touché ${compactNumber(reach)} comptes, soit ${signedPercent(delta.reach)} de portée par rapport au mois précédent.`,
    `Vos contenus ont généré ${compactNumber(engagement)} interactions (j'aime, commentaires et enregistrements), en évolution de ${signedPercent(delta.engagement)}.`,
    `La régularité de publication est tenue et le mix éditorial reste fidèle à la ligne définie ensemble.`,
  ]

  return {
    client,
    period: REPORT_PERIOD,
    periodLabel: REPORT_PERIOD_LABEL,
    brandColor: client.brandColor,
    accentColor: brand?.palette[0] ?? client.brandColor,
    igFollowers: ig?.followers ?? 0,
    perf,
    summaryLines,
  }
}
