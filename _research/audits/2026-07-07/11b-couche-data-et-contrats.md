# 11b — Couche d'accès données, façade & contrats (2026-07-07)

> Comment remplacer les mocks par Supabase **sans réécrire l'UI**. Signatures cibles de la façade, stratégie de bascule module-par-module, contrat par page, et contrat d'erreurs. Source : `apps/web/lib/mocks/index.ts` (façade actuelle, lue) + les 7 rapports. **READ-ONLY.**

## Principe : le seam est la façade, pas les pages

Aujourd'hui `lib/mocks/index.ts` expose ~20 getters **synchrones** (`getClients(): Client[]`, `getContentItem(id): ContentItem | undefined`…) et re-exporte les constantes brutes. Les pages (Server Components) les appellent, mais **7 composants `use client` du shell aussi** (command-palette, notifications-button, client-health-banner, app-sidebar, client-switcher, quick-capture, nav-user).

La cible : une façade `apps/web/lib/data/*` **async + server-only**, dont les signatures et les types de retour sont **stables**. Tant que `getContentItem(orgId, clientId, id): Promise<ContentItem | null>` garde sa forme, on bascule son corps de `Promise.resolve(MOCK)` à `await supabase.from(...)` **sans toucher un seul composant**.

## Transformation des signatures (avant → après)

| Aujourd'hui (`lib/mocks/index.ts`) | Cible (`lib/data/*`) |
|---|---|
| `getClients(includeArchived=false): Client[]` | `getClients(orgId, opts?): Promise<Client[]>` `[cache()]` |
| `getClient(id): Client \| undefined` | `getClient(orgId, clientId): Promise<Client \| null>` `[cache()]` |
| `getContentItems(clientId?): ContentItem[]` | `getContentItems(orgId, clientId, {page,pageSize}?): Promise<Paginated<ContentItem>>` |
| `getContentItem(id): ContentItem \| undefined` | `getContentItem(orgId, clientId, id): Promise<ContentItem \| null>` `[cache()]` |
| `getComments(contentId)` | `getComments(orgId, clientId, contentId): Promise<Comment[]>` |
| `getPortalContent()` | `getPortalContent(reviewerCtx): Promise<PortalItem[]>` |
| `getUnifiedAgenda()` | `getUnifiedAgenda(orgId): Promise<AgendaItem[]>` **(PLANIFIÉS uniquement)** |
| `CURRENT_USER` (constante) | `getCurrentUser(): Promise<User>` (depuis `auth.getUser()` + profiles) |
| `CALENDAR_ACCOUNTS` (constante) | `getCalendarAccounts(userId): Promise<CalendarAccount[]>` |
| `MOCK_NOW` (constante) | `now(): Date` (`lib/clock.ts`) |

**Changements structurels de signature** :
1. **`orgId` en 1er paramètre** partout (defense in depth §2.7). Résolu par `getActiveOrg()` en tête de page, jamais depuis le client.
2. **`clientId` explicite** pour les getters enfants (plus de confiance au seul `contentId` — voir 09-securite IDOR).
3. **`Promise<T>`** partout, `undefined` → `null` (convention DB).
4. **Locale résolue dans la façade** : les getters retournent des types contrat en `string` (plus de `L<string>`). Signature interne : `getClient(orgId, clientId, locale=getLocale())`.
5. **Pagination** sur les listings (`Paginated<T> = { items: T[]; total: number; page: number }`).

## Arborescence cible

```
packages/shared/src/
├── types/database.ts         # généré par `supabase gen types` — source de vérité
├── types/domain.ts           # types contrat UI (= mocks dé-L<string>) — importés par l'UI
├── schemas/                   # Zod : contentItemSchema, scheduleSchema, reviewSchema…
└── constants/quotas.ts        # PLATFORM_QUOTAS (multi-compteurs) — partagé web+worker

apps/web/lib/
├── supabase/{server,client,admin}.ts   # createServerClient / createBrowserClient / service role
├── auth/org-context.ts                 # getActiveOrg() (cache), getReviewerContext()
├── clock.ts                            # now()
└── data/                               # LA FAÇADE (remplace lib/mocks/index.ts)
    ├── clients.ts    content.ts    portal.ts    agenda.ts
    ├── notifications.ts    library.ts    quotas.ts    calendar.ts
    └── mutations/    # 'use server' + Zod : createContentItem, scheduleContent,
                      # submitReview, requestReview, reconnectAccount, switchOrg…
```

## Stratégie de bascule (mock → réel, incrémentale)

Flag par module derrière la façade :

```ts
// lib/data/content.ts
export const getContentItem = cache(async (orgId: string, clientId: string, id: string) => {
  if (USE_MOCKS.content) return mockGetContentItem(clientId, id)   // Pré-0 → Lot 0
  const supabase = await createServerClient()
  const { data } = await supabase.from('content_items')
    .select('*, media:media_assets(*), targets:content_targets(*)')
    .eq('org_id', orgId).eq('client_id', clientId).eq('id', id).maybeSingle()
  return data ? toContentItem(data, getLocale()) : null   // mapper DB→domaine
})
```

- **Pré-0** : tous les modules en mock, mais **signature cible déjà en place** (async, orgId, string). L'UI ne bouge plus jamais après.
- **Lot 0** : bascule `clients`, `dashboard`, `notifications` (`USE_MOCKS.clients=false`).
- **Lot 1** : bascule `content`, `library`, `calendar`, `grid`.
- **Lot 2** : `imported_posts`, quotas réels.
- **Lot 3** : `portal`, `comments`, `approvals`, `review_requests`.
- **Lot 4** : `calendar_accounts`, `agenda`.

Chaque bascule = 1 module, testable isolément, sans régression UI (les mocks restent le fallback jusqu'au flip).

## Contrat par page (données lues / mutations / cache)

| Page | Lit (getter → table) | Mute (Server Action) | Cache / invalidation |
|---|---|---|---|
| `dashboard` | getDashboardTasks, getUnreadCount → content_items, notifications | — | revalidateTag('dashboard') |
| `clients` (liste) | getClients + statsAgrégées → clients, content_items | createClient | revalidatePath('/clients') |
| `clients/new` | — | createClient (Zod) | → redirect client |
| `clients/[id]` | getClient, getSocialAccounts → clients, social_accounts | — | tag(`client:${id}`) |
| `clients/[id]/content` (board) | getContentItems (paginé) → content_items | createContentItem, updateStatus, moveToTrash | tag(`content:${clientId}`) |
| `.../content/[cid]` | getContentItem + getComments + getApprovals + getVersions + getActivity | (portail : submitReview) | tag(`content-item:${cid}`) |
| `.../content/new` \| `/edit` | getBrandKit, getPillars, getHashtagGroups, getLibraryAssets | createContentItem / updateContentItem (Zod + RHF) | invalider board + item |
| `.../grid` | getContentItems + getImportedPosts → content_items, imported_posts | reschedule (permutation dates) | tag(`grid:${clientId}`) |
| `.../calendar` | getContentItems(mois) + getClientEvents + getRecurringSlots | reschedule | tag(`calendar:${clientId}:${month}`) |
| `.../library` | getLibraryAssets (paginé) | uploadAsset (TUS), deleteAsset | tag(`library:${clientId}`) |
| `.../performance` | getPostMetrics → (métriques) | — | tag(`perf:${clientId}`) |
| `.../report` | agrégats → content_items, metrics | — | — |
| `.../settings` | getClient, getBrandKit, getPillars | updateClient, updateBrandKit | tag(`client:${id}`) |
| `agenda` | getUnifiedAgenda(orgId) → vue unified_agenda | — | tag('agenda') |
| `notifications` | getNotifications → notifications | markRead | tag('notifications') |
| `settings/accounts` | getSocialAccounts, getCalendarAccounts, health | connect (OAuth redirect), reconnect | tag('accounts') |
| `portal` | getPortalContent(reviewerCtx) → content_items (scoped client_members) | — | tag(`portal:${reviewerId}`) |
| `portal/[cid]` | getPortalContentItem + comments | submitReview, addComment/annotation | Realtime + tag |

**Realtime** (Lot 3) : statuts de publication et décisions de revue → `supabase.channel()` côté client (portail + dashboard owner), via TanStack Query invalidation.

**TanStack Query** (Lot 0+) : uniquement pour les surfaces client interactives — recherche ⌘K (route serveur top-K débounce), notifications live, Realtime. Le reste reste Server Components (`await` direct + `revalidateTag`).

## Contrat d'erreurs (à câbler dès Pré-0)

Chaque vue async gère les 3 états ; c'est ce qui permet aux erreurs Supabase d'hériter d'une architecture prête :

| État | Mécanisme | Où |
|---|---|---|
| **loading** | `loading.tsx` par segment + `<Suspense>` sur les sous-arbres lents | chaque groupe de routes |
| **error** | `error.tsx` (client, `reset()`) + `global-error.tsx` racine + primitive `<ErrorState>` (sœur d'`EmptyState`) + capture Sentry | `(app)`, `(portal)`, `(auth)` |
| **empty** | `<EmptyState>` (déjà présent) — étendre aux surfaces manquantes (liste clients 0, activité récente, sections rapport) | composants |
| **not-found** | `not-found.tsx` par groupe (14 `notFound()` déjà appelés) | `(app)`, `(portal)` |
| **media** | `<MediaThumb>` gagne état erreur/chargement (URL signées expirent à 48 h) | `components/shared` |

## Mutations : de `toast.success()` à Server Actions

Aujourd'hui 100 % des écritures sont des `toast` + état local inline. Cible (CLAUDE.md §3) :

```ts
// lib/data/mutations/content.ts
'use server'
export async function createContentItem(input: unknown) {
  const ctx = await getActiveOrg()
  if (!ctx) throw new Error('UNAUTHORIZED')
  if (!['owner','admin'].includes(ctx.role)) throw new Error('FORBIDDEN')
  const parsed = contentItemSchema.parse(input)           // Zod strict
  const supabase = await createServerClient()
  const { data, error } = await supabase.from('content_items')
    .insert({ ...parsed, org_id: ctx.org.id })            // INJECTION org_id obligatoire
    .select().single()
  if (error) throw error
  revalidateTag(`content:${parsed.clientId}`)
  return data
}
```

Dépendances à ajouter (absentes aujourd'hui de `package.json`) : `zod`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `@supabase/supabase-js`, `@supabase/ssr`.

## Résumé de la bascule

Le swap est **mécanique et sûr** si Pré-0 pose les bonnes signatures : async + orgId + clientId + string + pagination + boundaries. Après Pré-0, brancher Supabase = changer le corps des getters module par module, jamais l'UI. C'est exactement la promesse §0.
