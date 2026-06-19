import { Info } from "lucide-react"
import { PlatformBadge } from "@/components/shared/platform-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLabels, useLocale, useT } from "@/lib/i18n"
import type { PlatformRow } from "./perf-data"
import { compactNumber, percent } from "./perf-utils"

export function PerfPlatformTable({ rows }: { rows: PlatformRow[] }) {
  const t = useT()
  const lbl = useLabels()
  const { locale } = useLocale()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("performance.platform.title")}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">{t("performance.platform.colPlatform")}</TableHead>
              <TableHead className="text-right">{t("performance.platform.colPosts")}</TableHead>
              <TableHead className="text-right">{t("performance.platform.colReach")}</TableHead>
              <TableHead className="text-right">
                {t("performance.platform.colEngagement")}
              </TableHead>
              <TableHead className="pr-6 text-right">{t("performance.platform.colRate")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.platform}>
                <TableCell className="pl-6">
                  <div className="flex flex-col gap-0.5">
                    <PlatformBadge platform={r.platform} className="w-fit border-0 px-0" />
                    {r.noteKey ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Info className="size-3" />
                        {t(r.noteKey)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                {r.measurable ? (
                  <>
                    <TableCell className="text-right tabular-nums">{r.posts}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactNumber(r.reach, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactNumber(r.engagement, locale)}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {percent(r.rate, locale)}
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4} className="pr-6 text-right text-sm text-muted-foreground">
                    {t("performance.platform.notMeasurable", {
                      platform: lbl.platform(r.platform),
                    })}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
