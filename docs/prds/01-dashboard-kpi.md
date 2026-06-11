> Template générique bibliothèque Propul'SEO — à adapter à Ocean (voir docs/PRD.md).

# PRD - DASHBOARD KPI pour [PROJET] E-COMMERCE/ERP

## 1. VIBE & GOAL
**Vibe** : Clean pro, data-driven, dense mais respirant. Le dashboard est la home authentifiée — premier WOW. Cards KPI en haut, graphes interactifs au milieu, tableau récent en bas. Dark mode natif, mobile-first 375px.

**Goal** : Donner à `[ROLE=admin/manager]` une vision instantanée de la santé business (`[METIER]`) avec drill-down vers écrans détaillés. LCP < 1.2s, realtime activé, zéro frustration.

## 2. USER STORIES
- As admin, I want voir CA jour/semaine/mois en cards so that je détecte les anomalies en 5 secondes.
- As manager, I want toggler la période (7j/30j/90j/YTD/custom) so that je compare les tendances.
- As `[ROLE]`, I want cliquer une KPI card so that je navigue vers le détail filtré.
- As user mobile, I want scroller fluide sur 375px so that je consulte au resto sans bug.
- As admin, I want voir les realtime updates so that je ne rafraîchis jamais la page.

## 3. TECH SPECS

### Composants shadcn/ui
- `Card / CardHeader / CardTitle / CardContent / CardDescription` pour KPI tiles
- `Tabs` pour switch période
- `Skeleton` pour loading states (shimmer)
- `Badge` pour deltas (+12% vert, -3% rouge)
- `Tooltip` pour info hover
- `DateRangePicker` (shadcn block) pour période custom

### Charts (Recharts via dynamic import, NEVER SSR)
- `LineChart` : revenue evolution timeline
- `BarChart` : ventes par catégorie/produit
- `PieChart` : répartition top 5 (catégories/sources)
- `AreaChart` : cumul vs objectif
- Tous wrapped `'use client'` + `next/dynamic({ ssr: false })`

### DB Schema Supabase (vue matérialisée pour perf)
```sql
CREATE MATERIALIZED VIEW dashboard_daily_kpi AS
SELECT 
  date_trunc('day', created_at) AS day,
  COUNT(*) AS orders_count,
  SUM(total_amount) AS revenue,
  AVG(total_amount) AS aov,
  COUNT(DISTINCT customer_id) AS unique_customers,
  SUM(CASE WHEN status = 'refunded' THEN total_amount ELSE 0 END) AS refunds
FROM orders
WHERE status IN ('paid', 'refunded')
GROUP BY day;

CREATE UNIQUE INDEX ON dashboard_daily_kpi(day);

-- RLS
ALTER MATERIALIZED VIEW dashboard_daily_kpi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dashboard_admin_only" ON dashboard_daily_kpi
FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin', 'manager')
);

-- Refresh cron (pg_cron, toutes les 5min)
SELECT cron.schedule('refresh_dashboard', '*/5 * * * *', 
  'REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_daily_kpi');
```

### Server Actions
```ts
// /app/dashboard/actions.ts
'use server'
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

const PeriodSchema = z.enum(['7d', '30d', '90d', 'ytd', 'custom']);

export async function getDashboardKPIs(
  period: z.infer<typeof PeriodSchema>,
  customRange?: { from: Date; to: Date }
) {
  const validated = PeriodSchema.parse(period);
  const supabase = createServerClient();
  const { from, to } = resolvePeriod(validated, customRange);
  
  const { data, error } = await supabase
    .from('dashboard_daily_kpi')
    .select('*')
    .gte('day', from.toISOString())
    .lte('day', to.toISOString())
    .order('day', { ascending: true });
    
  if (error) throw new Error(`Dashboard fetch failed: ${error.message}`);
  return aggregateKPIs(data);
}
```

### Realtime (Supabase channel + TanStack invalidation)
```ts
useEffect(() => {
  const channel = supabase
    .channel('dashboard-updates')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'orders' },
      () => queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

### UI Flow (wireframe textuel)
```
[Header sticky: Greeting "Bonjour [Prénom]" + Tabs période + DateRangePicker + Refresh btn]
[Grid 4 cols desktop / 2 cols sm / 1 col mobile]
  └ KPI Card : CA total + delta % vs période précédente
  └ KPI Card : Nb commandes + delta
  └ KPI Card : AOV + delta
  └ KPI Card : Clients uniques + delta
[Grid 2 cols (mobile stack)]
  └ LineChart revenue (interactif, tooltip détaillé)
  └ BarChart top catégories
[Full width: Tableau 10 dernières commandes → link /sales]
[Footer: "Dernière maj : il y a 2min" + indicateur realtime (point vert pulsant)]
```

### Edge Cases (NE PAS NÉGLIGER)
- **Empty state** : illustration SVG + CTA "Importer historique" / "Connecter Stripe"
- **Loading** : skeleton cards + chart placeholders shimmer (pas de spinner)
- **Error** : Toast Sonner + bouton retry
- **Offline PWA** : Cached data via TanStack persister + banner "Mode hors-ligne"
- **Période sans data** : "Aucune donnée sur cette période, essaie 30j"
- **Réfresh manuel** : Debounce 2s, disabled state animé

### Intégrations
- Stripe webhooks → INSERT orders → trigger realtime
- Export PDF dashboard snapshot (jsPDF + html2canvas)
- Slack/Telegram alert si CA jour < seuil (Edge Function cron)
- AI insight (OpenAI/Claude API) : "Pourquoi ton CA a chuté de 15% mardi ?"

## 4. ADAPTATION PLACEHOLDERS

- **`[METIER=mode]`** : KPI taux retour, ventes par taille/couleur, top SKU
- **`[METIER=food]`** : panier moyen, fréquence client, table turnover, hours peaks
- **`[METIER=B2B/CRM]`** : pipeline value, win rate, deal cycle, MRR
- **`[METIER=SaaS]`** : MRR, churn, LTV, CAC, NRR, trial→paid conversion
- **`[METIER=santé/DocAgora]`** : consultations/jour, no-show rate, revenu par practicien
- **`[METIER=location/LOCAGAME]`** : taux d'occupation, jours locagame, CA par catégorie matos
- **`[ROLES]`** : Filter KPIs visibles par rôle (sales voit own perf, admin tout)
- **`[REALTIME=on/off]`** : Désactive pour clients low-traffic (économie compute)
- **`[CHARTS_LIB=recharts/tremor/visx]`** : Tremor pour dashboards rapides, visx si custom advanced

## 5. ACCEPTANCE CRITERIA

- [ ] Lighthouse Performance >95 (mobile + desktop)
- [ ] Lighthouse Accessibility >95 (ARIA labels sur charts via `role="img"` + `aria-label`)
- [ ] LCP < 1.2s (server prefetch + Suspense streaming)
- [ ] CLS < 0.05 (skeleton dimensions = real dimensions)
- [ ] RLS testée : user non-admin → empty array (pas erreur 500)
- [ ] Mobile 375px : no overflow horizontal, cards stack 2x2
- [ ] Realtime fonctionne : nouvel ordre → KPI update <2s
- [ ] Dark mode : contraste WCAG AA partout (test axe-core)
- [ ] i18n fr/en : tous strings dans `/messages/[locale].json`
- [ ] Période 90d : pas de lag (vue matérialisée concurrente)
- [ ] Empty state propre (jamais d'écran blanc)
- [ ] Zéro `console.log` / `debugger` en prod

## 6. TODO IMPLEMENTATION

1. **DB** : Migration vue matérialisée + pg_cron + RLS policies + indexes
2. **Server Actions** : `getDashboardKPIs(period, customRange)`, `getRecentOrders(limit)`
3. **Hooks** : `useDashboardKPIs(period)` TanStack Query (staleTime 60s, gcTime 5min)
4. **Components** :
   - `<KPICard title delta value icon href />` réutilisable
   - `<RevenueChart data />` dynamic import
   - `<CategoryChart data />` dynamic import
   - `<RecentOrdersTable />` réutilise feature data-table
   - `<DashboardHeader period onPeriodChange />`
5. **Page** : `/app/dashboard/page.tsx` Server Component + Suspense par section
6. **Realtime** : Hook `useDashboardRealtime()` subscribe + invalidate cache
7. **Tests Vitest** : Snapshot KPI cards, mock Supabase, edge cases empty/error
8. **Audit final** : Lighthouse CI, axe-core, manual mobile test sur device réel

## 7. CODE SKELETON

```tsx
// /app/dashboard/page.tsx
import { Suspense } from 'react';
import { KPIGrid, KPIGridSkeleton } from './_components/kpi-grid';
import { RevenueSection } from './_components/revenue-section';
import { CategoryChart } from './_components/category-chart';
import { RecentOrders } from './_components/recent-orders';
import { DashboardHeader } from './_components/dashboard-header';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ period?: string }>
}) {
  const { period = '30d' } = await searchParams;
  
  return (
    <div className="space-y-6 p-4 md:p-6">
      <DashboardHeader period={period as Period} />
      
      <Suspense fallback={<KPIGridSkeleton />}>
        <KPIGrid period={period as Period} />
      </Suspense>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueSection period={period as Period} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <CategoryChart period={period as Period} />
        </Suspense>
      </div>
      
      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders limit={10} />
      </Suspense>
    </div>
  );
}
```

```tsx
// /app/dashboard/_components/kpi-card.tsx
'use client'
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpIcon, ArrowDownIcon, type LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  delta?: number;
  icon: LucideIcon;
  href?: string;
}

export function KPICard({ title, value, delta, icon: Icon, href }: KPICardProps) {
  const isPositive = (delta ?? 0) >= 0;
  const content = (
    <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" aria-label={`${title}: ${value}`}>
          {value}
        </div>
        {delta !== undefined && (
          <Badge variant={isPositive ? 'default' : 'destructive'} className="mt-2 gap-1">
            {isPositive ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
```

## 8. NOTES SENIOR / GOTCHAS

- ❌ **NE PAS** fetch KPI client-side (`useEffect` + `fetch`) → toujours server-side + cache
- ❌ **NE PAS** stocker Recharts dans bundle SSR → `dynamic({ ssr: false })` OBLIGATOIRE
- ⚠️ Si > 100k orders : vue matérialisée OBLIGATOIRE (queries directes = mort DB)
- ⚠️ Realtime channel : cleanup au unmount, sinon memory leak
- ⚠️ Period change : `router.replace()` avec searchParams pour garder URL historique
- ⚠️ Refresh manuel : debounce 2s, disabled state pendant fetch
- ✅ Pré-fetch server avec `prefetchQuery` TanStack pour LCP optimal
- ✅ Streaming SSR Suspense par section → user voit cards avant charts
- ✅ Upgrade 2026 : AI insight card "Anomaly detected" via OpenAI/Claude API
