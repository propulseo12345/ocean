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
import { platformMeta } from "@/lib/mocks/labels"
import type { PlatformRow } from "./perf-data"
import { compactNumber, percent } from "./perf-utils"

export function PerfPlatformTable({ rows }: { rows: PlatformRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparatif par plateforme</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Plateforme</TableHead>
              <TableHead className="text-right">Publications</TableHead>
              <TableHead className="text-right">Portée</TableHead>
              <TableHead className="text-right">Engagements</TableHead>
              <TableHead className="pr-6 text-right">Taux</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.platform}>
                <TableCell className="pl-6">
                  <div className="flex flex-col gap-0.5">
                    <PlatformBadge platform={r.platform} className="w-fit border-0 px-0" />
                    {r.note ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Info className="size-3" />
                        {r.note}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                {r.measurable ? (
                  <>
                    <TableCell className="text-right tabular-nums">{r.posts}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactNumber(r.reach)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactNumber(r.engagement)}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {percent(r.rate)}
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4} className="pr-6 text-right text-sm text-muted-foreground">
                    Non mesurable — {platformMeta[r.platform].label} en mode brouillon
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
