> Template générique bibliothèque Propul'SEO — à adapter à Ocean (voir docs/PRD.md).

# PRD - ANALYTICS REALTIME pour [PROJET] E-COMMERCE/ERP/SaaS

## 1. VIBE & GOAL
**Vibe** : Pipeline d'events propre, dashboards qui actualisent sans refresh, AI qui raconte ce que les chiffres veulent dire. Inspiration PostHog/June, pas Google Analytics labyrinthique. **Goal** : capturer chaque action métier (page_view, add_to_cart, signup, appointment_booked, task_done) → stocker brut dans Postgres → matérialiser pour requêtes < 200ms → restituer en funnels/cohortes/realtime → laisser Claude résumer la tendance en 3 lignes. **Pas un Google Tag Manager copy-paste.**

## 2. USER STORIES
- **As product owner**, I want voir les events live (last 60s) sur le dashboard, so that je vois l'effet immédiat d'un push email ou tweet viral.
- **As marketer**, I want construire un funnel (visited → signup → first_action → paid) avec drop-off par étape, so that j'identifie où je perds des users.
- **As CEO**, I want un résumé AI hebdomadaire ("CA +12% vs semaine dernière, drop sur le checkout step 2, 3 nouveaux clients VIP"), so que je n'aie pas à explorer 12 dashboards.
- **As data analyst**, I want exporter une cohorte en CSV pour analyse Excel, so que je ne suis pas bloqué par l'UI du produit.
- **As dev**, I want un SDK `track(event, properties)` typé strict, so que je ne pollue pas la DB avec 14 variantes de "AddToCart"/"add_to_cart"/"AddedToCart".

## 3. TECH SPECS

### Composants shadcn
`Tabs` (Realtime/Funnels/Cohorts/Insights) · `Card` (KPI top) · `DataTable` (events bruts, voir 02-sales-data-table.md) · `Sheet` (détail event) · `Chart` Recharts (line + bar + funnel) · `Skeleton` · `Badge` (live indicator pulsant).

### DB Schema Supabase
```sql
-- Event log brut, append-only
create table analytics_events (
  id bigint generated always as identity primary key,
  org_id uuid references organizations,
  user_id uuid references auth.users,           -- null si anonymous
  anonymous_id uuid,                            -- cookie/localStorage fallback
  session_id uuid not null,
  event text not null,                          -- 'page_view', 'add_to_cart'…
  properties jsonb not null default '{}',
  context jsonb,                                -- { url, referrer, user_agent, ip_country }
  created_at timestamptz not null default now()
);
create index on analytics_events (org_id, created_at desc);
create index on analytics_events (event, created_at desc);
create index on analytics_events (user_id, created_at desc) where user_id is not null;
create index on analytics_events (session_id, created_at);
create index on analytics_events using gin (properties);

-- Partitionnement mensuel obligatoire dès 10M+ rows
-- (utiliser pg_partman ou partition manuelle)

-- Vue matérialisée events agrégés par jour/event
create materialized view mv_events_daily as
select
  org_id,
  date_trunc('day', created_at) as day,
  event,
  count(*) as count,
  count(distinct coalesce(user_id::text, anonymous_id::text)) as unique_users
from analytics_events
group by 1, 2, 3;
create unique index on mv_events_daily (org_id, day, event);

-- Funnels (config user-defined)
create table funnels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations,
  name text not null,
  steps jsonb not null,                         -- [{ event, conditions }]
  conversion_window_hours int default 24,
  created_at timestamptz default now()
);

-- Cohortes
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations,
  name text not null,
  definition jsonb not null,                    -- { event: 'signup', date_range: '...' }
  user_ids uuid[],                              -- snapshot, recalc cron
  refreshed_at timestamptz
);
```

### Refresh strategy
- `mv_events_daily` : `REFRESH MATERIALIZED VIEW CONCURRENTLY` toutes les 5min via `pg_cron`.
- Realtime live (60s) : query directe sur `analytics_events` filtrée `created_at > now() - interval '60 seconds'` (index couvrant).
- Funnel queries : window functions sur events bruts, cache 60s côté serveur.

### SDK typé
```ts
// /lib/analytics/track.ts
type EventMap = {
  page_view: { url: string; referrer?: string };
  add_to_cart: { product_id: string; price: number; quantity: number };
  checkout_completed: { order_id: string; total: number; currency: string };
  signup: { method: 'email' | 'google' | 'github' };
  appointment_booked: { practitioner_id: string; specialty: string };
  // …extensible par projet
};
export function track<K extends keyof EventMap>(event: K, properties: EventMap[K]) {
  // côté client : POST /api/analytics/ingest, fire-and-forget, beacon API si page unload
  navigator.sendBeacon('/api/analytics/ingest', JSON.stringify({ event, properties }));
}
```

### Ingest endpoint
```ts
// /app/api/analytics/ingest/route.ts
export async function POST(req: Request) {
  const { event, properties } = await req.json();
  const session = await getOrCreateSessionId(req);
  const context = extractContext(req);  // url, ua, ip→country via Vercel headers
  // Validation Zod : event in EventMap keys + properties schema par event
  const parsed = eventSchema.safeParse({ event, properties });
  if (!parsed.success) return new Response('Invalid', { status: 400 });
  // Insert async via Edge Function ou queue (pg_notify pour realtime)
  await supabase.from('analytics_events').insert({ event, properties, session_id: session.id, context });
  return new Response(null, { status: 204 });
}
```

### Realtime live indicator
```ts
useEffect(() => {
  const channel = supabase
    .channel('analytics-live')
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events',
          filter: `org_id=eq.${orgId}` },
        (payload) => setLiveEvents(prev => [payload.new, ...prev].slice(0, 50)))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [orgId]);
```

### Funnel SQL
```sql
-- Funnel signup → first_action → paid sur 7 jours
with step1 as (
  select distinct user_id, min(created_at) as t1 from analytics_events
  where event = 'signup' and created_at > now() - interval '7 days' group by 1
),
step2 as (
  select s.user_id, min(e.created_at) as t2 from step1 s
  join analytics_events e on e.user_id = s.user_id and e.event = 'first_action'
                          and e.created_at between s.t1 and s.t1 + interval '24 hours'
  group by 1
),
step3 as (
  select s.user_id, min(e.created_at) as t3 from step2 s
  join analytics_events e on e.user_id = s.user_id and e.event = 'checkout_completed'
                          and e.created_at between s.t2 and s.t2 + interval '24 hours'
  group by 1
)
select
  (select count(*) from step1) as step1_count,
  (select count(*) from step2) as step2_count,
  (select count(*) from step3) as step3_count;
```

### AI Insights weekly
Edge Function `weekly-insights` (cron lundi 9h) :
1. Agrège KPI semaine (CA, signups, churn, top events, drop-offs funnels) via SQL.
2. Construit un prompt structuré pour Claude API : "Voici les chiffres + variations W-1. Rédige un résumé exécutif en 5 bullet points : 1 win, 1 alerte, 2 tendances, 1 action recommandée."
3. Stocke dans `weekly_insights` table + envoie par email (Brevo) + push notif (voir 09-notifications-realtime.md).

### UI Flow
```
┌──────────────────────────────────────────────────┐
│ Analytics                       [7j ▾] [Export] │
├──────────────────────────────────────────────────┤
│  🟢 LIVE  42 events · 18 users actifs (last 60s)│
├──────────────────────────────────────────────────┤
│ [Realtime] [Funnels] [Cohorts] [Insights AI]    │
├──────────────────────────────────────────────────┤
│  📈 Events / jour     │   🤖 Insight de la semaine│
│  ┌────────────────┐   │   ✅ +18% signups        │
│  │     /\    /\   │   │   ⚠️ -7% checkout step 2  │
│  │    /  \  /  \  │   │   📊 Pic mardi 14h        │
│  │ __/    \/    \_│   │   💡 Test header CTA     │
│  └────────────────┘   │                          │
└──────────────────────────────────────────────────┘
```

### Edge Cases
- **User anonyme** : `anonymous_id` UUID cookie, mergé vers `user_id` au login (UPDATE batch).
- **Ad-block** : `sendBeacon` survit aux page unload, mais bloqué par uBlock. Fallback : ingest serveur depuis Server Actions critiques (signup, checkout).
- **RGPD** : si user refuse cookies, `anonymous_id` non persistant + IP tronquée. Toggle dans consent banner.
- **Spam events** : rate limit 100 events/session/min côté ingest, drop silently au-dessus.
- **DB explosion** : à 10M rows, partitionnement obligatoire + archivage S3 events > 1 an.

### Intégrations
- Stripe webhooks → track `checkout_completed` côté serveur (source de vérité).
- Brevo webhooks → track `email_opened`/`email_clicked`.
- Push notifs (voir 09-notifications-realtime.md) pour alertes anomalies (drop > 30% vs J-7).

## 4. ADAPTATION PLACEHOLDERS
- **[EVENTS_DOMAIN]** : Events métier (DocAgora → `appointment_booked`/`prescription_issued` ; LOCAGAME → `reservation_made`/`delivery_completed` ; Tao → `priority_set`/`victory_logged`).
- **[FUNNELS_DEFAULT]** : Funnels pré-configurés par métier (e-com : visit→cart→checkout→paid ; santé : visit→signup→appointment ; SaaS : signup→onboarding→activation→paid).
- **[AI_INSIGHTS_FREQUENCY]** : daily/weekly/monthly selon volume (< 1k events/jour = weekly, > 100k = daily).
- **[CONSENT_LEVEL]** : `strict` (RGPD, opt-in obligatoire) / `legitimate-interest` (opt-out) selon JURIDICTION.
- **[RETENTION_DAYS]** : 90j (default), 365j (premium), 730j (enterprise/légal).

## 5. ACCEPTANCE CRITERIA
- [ ] SDK `track()` 100% typé, refuse les events hors `EventMap` à la compilation.
- [ ] Ingest endpoint < 50ms p95, fire-and-forget côté client.
- [ ] Realtime live indicator s'actualise sans refresh (< 2s lag).
- [ ] Funnel à 4 étapes calcule en < 500ms sur 1M events (index + window functions).
- [ ] Materialized view `mv_events_daily` rafraîchie toutes les 5min sans bloquer reads (`CONCURRENTLY`).
- [ ] AI insights weekly envoyé chaque lundi 9h, contient données réelles (pas hallucinations).
- [ ] Consent banner respecte RGPD, no track avant accept.
- [ ] Mobile 375px : graphs scrollables horizontalement, KPI cards en stack.
- [ ] Export CSV cohorte fonctionne jusqu'à 100k rows (Edge Function streaming, voir 13-csv-pdf-export.md).
- [ ] RLS : org A ne voit jamais events org B.

## 6. TODO IMPLEMENTATION
1. **DB** : `analytics_events` (partitionné si volume prévu > 10M/an) + `funnels` + `cohorts` + `weekly_insights` + index + RLS par org.
2. **MV** : `mv_events_daily` + cron refresh 5min.
3. **SDK client** `/lib/analytics/track.ts` typé + ingest API route.
4. **Server-side tracking** dans Server Actions critiques (signup, checkout, etc.).
5. **Dashboard UI** : tabs Realtime/Funnels/Cohorts/Insights, charts dynamic import.
6. **Realtime subscription** pour live indicator.
7. **Edge Function** `weekly-insights` avec Claude API integration.
8. **Consent banner** + storage cookie + respect côté SDK et serveur.

## 7. CODE SKELETON
```tsx
// /app/dashboard/analytics/page.tsx
import { Suspense } from 'react';
import { KpiTopBar } from '@/components/analytics/kpi-top-bar';
import { AnalyticsTabs } from '@/components/analytics/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-16" />}>
        <KpiTopBar />
      </Suspense>
      <AnalyticsTabs />
    </div>
  );
}
```

```ts
// /lib/analytics/weekly-insights.ts
import Anthropic from '@anthropic-ai/sdk';
export async function generateWeeklyInsight(orgId: string) {
  const stats = await fetchWeekStats(orgId);  // SQL agrégé
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Données semaine: ${JSON.stringify(stats)}\nRédige 5 bullets: 1 win, 1 alerte, 2 tendances, 1 action recommandée. Français, concis, chiffré.`,
    }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text : '';
}
```

## 8. NOTES SENIOR / GOTCHAS

❌ **Never** : Google Analytics + table maison en parallèle = double source de vérité = enfer du debugging. **Une seule, sous ton contrôle, sous ta DB.**
❌ **Never** : tracker des PII (email, nom, CB) dans `properties` → fuite RGPD garantie. Hash ou n'envoie pas.
❌ **Never** : `INSERT` synchrone bloquant dans le critical path checkout → tu casses la conversion pour mesurer la conversion. **Fire-and-forget ou queue.**
❌ **Never** : laisser `analytics_events` grossir sans partitionnement → à 50M rows, full table scan = 30s = dashboards morts.

⚠️ **Warning** : `REFRESH MATERIALIZED VIEW` sans `CONCURRENTLY` lock la vue → dashboards down pendant le refresh. Toujours `CONCURRENTLY` + unique index.
⚠️ **Warning** : realtime subscription sur `analytics_events` insert ALL = browser surchargé. Filtre côté serveur par org_id + sample côté client.
⚠️ **Warning** : Claude API weekly insight peut halluciner des chiffres si tu lui balances du texte. **Passe des nombres structurés** + demande "ne cite que les chiffres fournis".

✅ **Best practice** : track côté **serveur** pour events critiques (paiements, signups). Client-side = ad-blocked à 30%.
✅ **Best practice** : versionne tes events. `add_to_cart` v1 schema ≠ v2 schema → ajoute `event_version` au lieu de muter le payload.
✅ **Best practice** : dashboards = SQL pur, pas ORM. Tu écriras des window functions et CTE — Drizzle ou Prisma sont des cailloux dans la chaussure ici.
✅ **Best practice** : sample en local (track 1/N en dev) sinon ton .env local pollue la prod stats.

🚀 **Upgrade 2026** : agent "Ask the data" en Cmd+K. User tape "Combien j'ai vendu de t-shirts noirs en mars ?" → Claude (tool-use SQL strict avec whitelist tables/colonnes + LIMIT enforced) génère la query, l'exécute en read-only, restitue résultat + chart auto. Couplé à `mv_events_daily` + `orders` table. Le Saint Graal : remplacer Looker/Metabase à 0€. Pour Propul'SEO en mode self-service client, c'est l'argument de vente qui clôt n'importe quel deal SaaS B2B.
