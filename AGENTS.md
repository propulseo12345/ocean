# AGENTS.md — Ocean · SaaS multi-tenant Propul'SEO

> **Tu es Codex sur Ocean, un SaaS multi-tenant de gestion de contenu social pour freelances marketing.**
> Lis ce fichier INTÉGRALEMENT avant chaque action. Puis docs/PRD.md et docs/ANALYSE-LANCEMENT.md.
> **Sécurité multi-tenant, tokens OAuth et idempotence du worker de publication sont CRITIQUES — un bug ici = catastrophe RGPD ou double publication chez un client.**
> **⚠️ PHASE EN COURS : preview front UI-only avec données mockées — voir « Phase actuelle » (§0). Les règles backend (RLS, worker, tokens) s'appliquent à partir du Lot 0 réel, pas pendant la preview.**

---

## 0. IDENTITÉ DU PROJET

- **Nom produit** : Ocean (codename — vérification INPI/EUIPO + domaine + handles AVANT lancement commercial, décision actée §6 de l'analyse)
- **Type** : SaaS B2B — publication Instagram/Facebook (Standard Access Meta), TikTok en brouillon, grille de preview du feed IG, calendrier éditorial par client, portail de validation client, agenda unifié Google+Outlook, PWA mobile (priorité iOS)
- **Client** : Propul'SEO (projet interne)
- **Owner** : Étienne (Propul'SEO)
- **Phase actuelle** : ⚠️ **PREVIEW FRONT — UI seule, données mockées** (décision du 11/06/2026). On construit et valide d'abord le front (dashboard, studio, grille feed, calendrier éditorial, portail client) **SANS backend** : ne PAS câbler Supabase (auth/DB/RLS/storage), ni remote GitHub, ni Meta/TikTok/Brevo tant que le front n'est pas validé par Étienne. La couche données = mocks typés dans `packages/shared` (mêmes types/enums que la future DB du PRD §6, pour brancher Supabase ensuite sans réécrire l'UI). Après validation : phase solo complète (Étienne = premier utilisateur, accès développeur des plateformes), Lots 0–4 du PRD.
- **Repo** : [à créer — voir docs/kickoff-day1.md]
- **URL prod app** : `app.[domain]` (à acter avec le nom commercial)
- **URL staging** : `staging.app.[domain]`
- **Monétisation** : hors périmètre MVP (phase solo). Stripe sera introduit à l'ouverture SaaS — ne rien câbler de spéculatif.

## 1. STACK & VERSIONS

```yaml
node: 20 LTS
pkg_manager: pnpm 9+ (monorepo workspaces)
monorepo:
  apps/web: Next.js 16 App Router (Turbopack)
  apps/worker: worker Node de publication programmée (file Postgres FOR UPDATE SKIP LOCKED — PAS de Redis/BullMQ)
  packages/shared: types DB, schémas Zod, constantes plateformes
language: TypeScript strict
styling: Tailwind v4 + shadcn/ui
db: Supabase Postgres + RLS sur 100% des tables (org_id dénormalisé + FK composites)
auth: Supabase Auth (magic link desktop, OTP 6 chiffres mobile ; Reviewer = compte invité par inviteUserByEmail + signInWithOtp)
storage: Supabase Storage (media-originals PRIVÉ + URL signées 48h ; media-thumbs PUBLIC ~400px WebP)
secrets: Supabase Vault (tokens OAuth Meta/TikTok/Google/Microsoft)
realtime: Supabase Realtime (notifications in-app, statut de publication)
queue: Postgres SELECT … FOR UPDATE SKIP LOCKED — connexion worker Supavisor SESSION port 5432, JAMAIS 6543
email: Brevo (transactional + SMTP custom Supabase — JAMAIS Resend)
forms: React Hook Form + Zod
state: TanStack Query
i18n: FR only au MVP (next-intl différé)
errors: Sentry (web + worker + Cron Monitors, sourcemaps sur build)
analytics: PostHog (EU host)
pwa: Serwist via @serwist/turbopack — priorité iOS (onboarding installation soigné)
hosting: Coolify VPS — 2 apps (web + worker)
lint: Biome (PAS ESLint)
ci: GitHub Actions
```

## 2. RÈGLES ABSOLUES — MULTI-TENANT

### Multi-tenant : règles non négociables
1. **Toute table métier a `org_id uuid not null` DÉNORMALISÉ** (référence organizations). Sans exception. Les tables filles de Client portent AUSSI `client_id`.
2. **RLS activée sur 100% des tables** (y compris les tables d'appartenance, via helpers — sinon récursion). Policies écrites en même temps que la table.
3. **FK composites obligatoires** : `UNIQUE(id, org_id)` sur clients, `UNIQUE(id, client_id)` sur content_items — une ligne fille ne peut PHYSIQUEMENT pas pointer vers un autre tenant, même avec un bug applicatif. Policies sans jointure.
4. **Pas de claims JWT d'autorisation au MVP** : helpers `SECURITY DEFINER` dans un schéma `private` non exposé, lisant 2 tables d'appartenance indexées (`organization_members` : owner/admin ; `client_members` : reviewer/editor). Raison : révoquer un Reviewer doit être effectif immédiatement, pas au refresh du token.
5. **Wrapping `(select fn())` dans chaque policy** (sinon −95% perf) + **`TO authenticated` sur chaque policy** + vues en `security_invoker = true`.
6. **Reviewer = vrai utilisateur Supabase Auth** (invité par magic link/OTP), possédant uniquement une ligne `client_members` → ne passe aucune policy org-level par construction.
7. **JAMAIS de query sans filtre org_id** — implicite via RLS, mais aussi explicite dans le code (defense in depth).
8. **Test de fuite multi-tenant obligatoire** : pgTAP en CI + `get_advisors` après chaque migration. Pour chaque ressource, un test vérifie que user A ne voit/écrit JAMAIS data de org B, et qu'un Reviewer du client 1 ne voit JAMAIS le client 2 de la même org.
9. **Trigger `handle_new_user` n'insère QUE dans profiles**. Rien d'autre.
10. **Active org en contexte** : Server Components récupèrent `org_id` depuis cookie `active_org_id`, jamais depuis client untrusted.

### Tokens OAuth : règles non négociables
11. **Tables sœurs `*_secrets` en DENY-ALL** : RLS activée, ZÉRO policy → seuls worker/serveur (service role) y accèdent. **Aucun token ne transite jamais vers le navigateur.**
12. **Tokens chiffrés dans Supabase Vault** (décision actée). Jamais en clair en base, jamais dans les logs.
13. **OAuth custom via Route Handlers, PAS Supabase Auth `linkIdentity`** (un compte Google d'agenda ne doit jamais devenir une identité de connexion). Une seule abstraction `IntegrationOAuthProvider` pour Meta/TikTok/Google/Microsoft.
14. **Rotation des refresh tokens** (TikTok, Microsoft) = remplacement sous verrou (advisory lock par compte / FOR UPDATE). Échec refresh → statut `needs_reauth` + email Brevo.

### Worker de publication : règles non négociables
15. **Idempotence absolue** : `publish_started_at` posé AVANT `media_publish`. Un job retrouvé avec `publish_started_at` non nul ne retry JAMAIS aveuglément — il interroge d'abord `GET /{container}?fields=status_code` (PUBLISHED → succès).
16. **Index unique partiel `(content_item_id, social_account_id)` sur jobs actifs** — pas de double job pour la même cible.
17. **Connexion worker = Supavisor mode SESSION (port 5432)** — jamais le pooler transaction (6543, casse les advisory locks). Horloge = `now()` Postgres.
18. **Appels HTTP hors transaction.** Claim atomique + lease 2 min + reaper. Backoff exponentiel + jitter, max 5 tentatives ; erreurs permanentes (token révoqué, média invalide) = failed direct.
19. **Rate limiting PAR social_account** : IG `GET /content_publishing_limit` avant chaque post ; FB header `X-Business-Use-Case-Usage` ; TikTok compteur local.

### Médias : règles non négociables
20. **2 buckets** : `media-originals` PRIVÉ (exposition uniquement par URL signée TTL 48h générée par le worker à la publication) ; `media-thumbs` PUBLIC (vignettes ~400px WebP, générées côté client à l'upload). Jamais de bucket public pour du contenu client non publié.
21. **Chemins = mécanisme d'isolation** : `{org_id}/{client_id}/{content_item_id}/{media_asset_id}/…` ; policies storage.objects via `storage.foldername()`.
22. **Conversion JPEG OBLIGATOIRE pour IG** : images = JPEG uniquement ≤8 MB, ratio 4:5–1.91:1 (conversion PNG/HEIC côté client — attention HEIC iPhone). Reels = MP4/MOV moov atom en tête (faststart), 3 s–15 min, ≤300 MB.
23. **Jamais de DELETE SQL sur storage.objects** — suppression par l'API Storage uniquement (Edge Function `media-cleanup`, lots de 100).

### Code (héritées du standard)
24. Fichier ≤ 250 lignes
25. Zéro `any`, zéro couleur hardcodée
26. Server Components par défaut, Client minimal
27. Server Actions Zod-validées avec parsing strict
28. Biome pour lint + format (pas ESLint, pas Prettier)

## 3. ARCHITECTURE MULTI-TENANT — CONTEXTE

### Récupérer l'org active (Server Components)
```ts
// apps/web/lib/auth/org-context.ts
import { cookies } from 'next/headers';
import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';

export const getActiveOrg = cache(async () => {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const orgId = cookieStore.get('active_org_id')?.value;

  // valider que l'user est bien membre de cette org
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id, role, organizations(*)')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single();

  if (!membership) {
    // fallback : première org de l'user, ou null (cas Reviewer : aucune org → portail uniquement)
    return null;
  }
  return { org: membership.organizations, role: membership.role };
});
```

### Server Action avec org context
```ts
'use server';
export async function createContentItem(formData: FormData) {
  const ctx = await getActiveOrg();
  if (!ctx) throw new Error('UNAUTHORIZED');
  if (!['owner','admin'].includes(ctx.role)) throw new Error('FORBIDDEN');

  const parsed = contentItemSchema.parse(Object.fromEntries(formData));
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('content_items')
    .insert({ ...parsed, org_id: ctx.org.id })  // INJECTION ORG_ID OBLIGATOIRE (+ client_id validé côté RLS par FK composite)
    .select()
    .single();
  // ...
}
```

### Contexte Reviewer (portail client)
Le Reviewer n'a PAS d'org active : il est scoped par ses lignes `client_members`. Le portail (`/portal`) résout ses clients accessibles via les helpers `private.*` — jamais de cookie org, jamais d'accès aux routes `/(app)`.

### Switch organization
```ts
'use server';
export async function switchOrg(orgId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from('organization_members').select('org_id')
    .eq('user_id', user!.id).eq('org_id', orgId).single();
  if (!membership) throw new Error('NOT_MEMBER');

  const cookieStore = await cookies();
  cookieStore.set('active_org_id', orgId, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/',
  });
  revalidatePath('/app', 'layout');
}
```

## 4. ARCHITECTURE FICHIERS — MONOREPO

```
/apps
  /web                              # Next.js 16 App Router
    /app
      /(marketing)/                 # public, SEO indexé (minimal en phase solo)
      /(auth)/
        login/page.tsx              # magic link desktop / OTP 6 chiffres mobile
        otp/page.tsx
      /(app)/                       # app freelance authentifiée
        layout.tsx                  # require auth + active org
        dashboard/page.tsx
        clients/[clientId]/
          calendar/                 # calendrier éditorial par client
          grid/                     # grille preview feed IG (posts app + importés)
          content/                  # studio contenu (upload, légendes, ciblage plateformes)
        agenda/page.tsx             # agenda unifié Google+Outlook (vue unified_agenda)
        settings/
          accounts/                 # connexions sociales + agendas (health check tokens)
      /(portal)/portal/             # portail de validation client (Reviewer)
      /api/
        oauth/[provider]/           # Route Handlers OAuth custom (meta, tiktok, google, microsoft)
        health/route.ts             # health check Coolify
    /components/{app, portal, ui, shared}
    /lib
      /supabase/{server, client, admin}.ts
      /auth/{org-context, roles, middleware}.ts
      /oauth/                       # IntegrationOAuthProvider + 1 impl par provider
      /media/                       # validation specs plateformes, conversion JPEG/HEIC, thumbs client
      /brevo/transactional.ts
      /analytics/events.ts
    /middleware.ts
  /worker                           # worker Node de publication programmée (2e app Coolify)
    /src
      index.ts                      # tick 5 s, claim FOR UPDATE SKIP LOCKED, lease 2 min + reaper
      queue/                        # claim atomique, états PublishJob, backoff
      publishers/{instagram, facebook, tiktok}.ts
      tokens/refresh.ts             # refresh quotidien Meta, à la volée TikTok (advisory lock)
      media/signed-urls.ts          # URL signées 48h à la publication
/packages
  /shared                           # types database.ts, schémas Zod, constantes quotas plateformes
/supabase
  /migrations
  /functions                        # Edge Functions : media-cleanup, watchdog-notify
/docs                               # PRD.md, ANALYSE-LANCEMENT.md, kickoff-day1.md, prds/
```

## 5. WORKER DE PUBLICATION — PATTERN OBLIGATOIRE

### Machine à états PublishJob
```
scheduled → claimed → (awaiting_media ⇄ claimed)* → succeeded
                                                  → retrying → … (max 5, backoff exp + jitter)
                                                  → failed | dead_letter | canceled
sous-étapes : refresh_token → check_quota → create_container → publish → verify
```
`PublishJob` porte l'exécution technique ; `ContentTarget` porte l'état métier par plateforme (statut, ID externe, permalink). Un ContentItem multi-plateformes a un statut global agrégé (`partially_published` possible).

### Claim atomique (cœur de la file)
```sql
UPDATE publish_jobs
SET status = 'claimed', claimed_at = now(),
    lease_expires_at = now() + interval '2 minutes', worker_id = $1
WHERE id = (
  SELECT id FROM publish_jobs
  WHERE status = 'scheduled' AND run_at <= now()
  ORDER BY run_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

### Idempotence (règle absolue — relire la règle 15)
```
si job.publish_started_at IS NOT NULL :
  → NE PAS republier. GET /{container_id}?fields=status_code
  → PUBLISHED → marquer succeeded (récupérer media_id/permalink)
  → sinon → reprendre la sous-étape correspondante
sinon :
  → poser publish_started_at = now()  (commit)
  → POST /media_publish
```

### Filets de sécurité
- **Fenêtre de grâce** : publier si < 2h de retard ; au-delà → failed + notification, l'admin choisit une nouvelle date (décision actée).
- **Quota IG atteint** : report automatique au prochain créneau disponible + notification du décalage (décision actée).
- **Watchdog pg_cron indépendant** (1×/5 min) : jobs en retard > 2 min non claimés → Edge Function → email Brevo. pg_cron trop fragile pour publier, parfait pour surveiller.
- **Sentry** : worker + Cron Monitors.
- **Refresh tokens** : tâche quotidienne (Meta long-lived 60 j, refresh si < 10 j — non rafraîchi = perdu) ; TikTok à la volée avant chaque job (rotation du refresh token → advisory lock par compte).
- **TikTok = brouillon** (scope `video.upload`) : statut `pushed_to_platform` + bouton « copier la légende » + notification push à l'heure planifiée + relance si jamais finalisé. Vidéo → FILE_UPLOAD chunké depuis le worker ; jamais PULL_FROM_URL sur *.supabase.co.

## 6. QUOTAS PLATEFORMES — ENFORCEMENT

| Plateforme | Limite réelle (juin 2026) | Enforcement Ocean |
|---|---|---|
| Instagram | 100 posts API/24h glissantes (carrousel = 1) + 400 créations de conteneurs/24h | `GET /content_publishing_limit` AVANT chaque post ; quota atteint → report auto + notification |
| Facebook Pages | BUC 4800 × engaged users/24h par Page ; **30 Reels API/24h/Page** | Surveiller header `X-Business-Use-Case-Usage` ; compteur Reels enforced par l'app |
| TikTok | **5 brouillons en attente/24h par créateur** ; 6 req/min/token sur init | Compteur local par social_account |

Enforcement côté DB/worker (source de vérité), UI = affichage ergonomique du quota restant. Jamais de check uniquement côté client.

## 7. WORKFLOW Codex — SPÉCIFIQUE OCEAN

### Pour chaque nouvelle table métier
1. Tu ajoutes `org_id uuid not null` dénormalisé (+ `client_id` si table fille de Client, verrouillé par FK composite)
2. Tu écris la migration SQL (table + index + RLS + FK composites)
3. Les RLS utilisent les helpers `private.*` SECURITY DEFINER, wrappés `(select fn())`, `TO authenticated`
4. Tu écris un test pgTAP "leak test" : user A insère, user B (autre org) ne voit pas ; Reviewer client 1 ne voit pas client 2
5. Tu lances `get_advisors` après la migration
6. Tu valides avec moi le SQL avant exécution

### Pour chaque nouvelle Server Action
1. Récupère `getActiveOrg()` en première ligne (ou contexte Reviewer pour le portail)
2. Vérifie rôle si action restreinte
3. Parse Zod
4. INJECTE `org_id: ctx.org.id` dans tout insert
5. `revalidatePath` ou `revalidateTag` après mutation

### Pour chaque appel API plateforme (worker)
1. Refresh token vérifié AVANT (jamais à l'heure H sans filet)
2. Quota vérifié AVANT (règle 19)
3. `publish_started_at` posé AVANT le publish — jamais de retry aveugle après (règle 15)
4. Appel HTTP HORS transaction
5. Erreur permanente (token révoqué, média invalide) → failed direct, pas de retry
6. Résultat écrit sur ContentTarget (état métier) ET PublishJob (état technique)

### Pour chaque média
1. Validation specs plateforme à l'upload (AVANT programmation, message d'erreur clair)
2. Conversion JPEG côté client si IG (PNG/HEIC → JPEG)
3. Miniature WebP ~400px générée côté client → `media-thumbs`
4. Original → `media-originals` privé, chemin `{org_id}/{client_id}/…`, TUS chunks 6 MB exactement

### Avant deploy
- [ ] Toutes nouvelles tables ont RLS + FK composites + leak test pgTAP
- [ ] `get_advisors` clean après migrations
- [ ] Aucun token OAuth accessible côté client (tables `*_secrets` deny-all vérifiées)
- [ ] Worker : idempotence testée (kill -9 entre publish_started_at et media_publish → pas de double post)
- [ ] Variables d'env par environnement correctes (web ET worker)
- [ ] Sentry sourcemaps uploadées (web + worker)
- [ ] PWA : SW ne cache pas /auth/v1/* ni les POST (allowlist explicite)

## 8. ANTI-PATTERNS INTERDITS — OCEAN

❌ Table créée sans `org_id` "on l'ajoutera plus tard" → tu le fais tout de suite ou tu ne crées pas la table
❌ RLS désactivée temporairement pour "tester" → JAMAIS. Tu écris la policy avant.
❌ Policy avec jointure vers une autre table tenant → FK composites + helpers, c'est le pattern, point.
❌ Token OAuth dans une réponse API, un log, un composant client → deny-all `*_secrets`, service role serveur exclusivement
❌ Retry aveugle d'un job avec `publish_started_at` non nul → double publication chez un client = catastrophe
❌ Worker connecté au pooler transaction (6543) → casse les advisory locks. SESSION port 5432.
❌ Redis/BullMQ "pour faire propre" → Postgres FOR UPDATE SKIP LOCKED est LA décision actée. Pas de seconde source de vérité.
❌ Edge Function qui publie sur les réseaux → limites runtime disqualifiées (analyse §3.2). Edge Functions = cleanup/watchdog uniquement.
❌ Magic link comme auth mobile → session créée dans Safari, pas dans la PWA installée = déconnexion en boucle. OTP 6 chiffres sur mobile.
❌ Bucket public pour les originaux / URL publique permanente d'un média non publié → URL signée 48h générée à la publication
❌ DELETE SQL sur storage.objects → fichiers orphelins. API Storage uniquement.
❌ PNG/HEIC envoyé tel quel à Instagram → JPEG uniquement, conversion obligatoire
❌ Resend, ou tout autre ESP → Brevo, point final.
❌ `linkIdentity` Supabase pour les comptes d'agenda → OAuth custom Route Handlers (un compte Google client ne doit jamais ouvrir une session)
❌ Service role key dans `'use client'` ou `NEXT_PUBLIC_*` → compromission totale
❌ Quota plateforme vérifié uniquement côté UI → enforcement worker/DB obligatoire
❌ SW qui cache /auth/v1/* ou des POST → fuite de données post-logout

## 9. MIDDLEWARE AUTH

```ts
// apps/web/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(req: NextRequest) {
  const { response, user } = await updateSession(req);
  const { pathname } = req.nextUrl;

  // Routes publiques
  if (pathname.startsWith('/login') || pathname.startsWith('/otp')
      || pathname === '/' || pathname.startsWith('/api/health')
      || pathname.startsWith('/api/oauth')) {  // callbacks OAuth (protégés par state signé)
    if (user && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/app/dashboard', req.url));
    }
    return response;
  }

  // Portail Reviewer : authentifié, mais PAS membre d'org (scoping client_members via RLS)
  if (pathname.startsWith('/portal')) {
    if (!user) return NextResponse.redirect(new URL('/login?next=' + pathname, req.url));
    return response;
  }

  // Routes app authentifiées (freelance)
  if (!user && pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login?next=' + pathname, req.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

## 10. EMAILS BREVO — TRANSVERSAUX OBLIGATOIRES

> SMTP custom Supabase pointé sur Brevo (magic link / OTP partent via Brevo). Brevo requis dès le Lot 3 (invitations Reviewer), transactionnel d'échec dès le Lot 2.

### Templates V1
- `reviewer-invitation` : invitation au portail de validation (inviteUserByEmail)
- `review-requested` : contenu(s) en attente de validation (lien direct portail)
- `changes-requested` : retour client → notification admin
- `content-approved` : confirmation à l'admin
- `publish-failed` : échec de publication — canal GARANTI du triple canal (push + Realtime in-app + email)
- `publish-delayed` : report automatique pour quota atteint
- `needs-reauth` : échec refresh token, reconnexion requise (health check proactif)
- `tiktok-draft-ready` : brouillon TikTok poussé, à finaliser dans l'app
- `watchdog-alert` : jobs en retard non claimés (destinataire : Étienne)

### Pattern envoi
```ts
// apps/web/lib/brevo/transactional.ts (partagé avec le worker via packages/shared)
export async function sendTransactional(opts: {
  template: string; to: string | string[]; params?: Record<string, unknown>;
  tags?: string[];
}) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: BREVO_TEMPLATES[opts.template],
      to: (Array.isArray(opts.to) ? opts.to : [opts.to]).map(email => ({ email })),
      params: opts.params,
      tags: opts.tags,
    }),
  });
  if (!res.ok) throw new Error(`Brevo: ${res.status} ${await res.text()}`);
}
```

## 11. ANALYTICS EVENTS — MINIMUM OCEAN (PostHog)

```ts
type EventMap = {
  signup_completed: { method: 'magic_link' | 'otp' };
  social_account_connected: { platform: 'instagram'|'facebook'|'tiktok'; via: string };
  calendar_account_connected: { provider: 'google'|'microsoft' };
  content_created: { platforms: string[]; media_type: string };
  content_scheduled: { platforms: string[]; lead_time_hours: number };
  review_requested: { items_count: number };
  content_approved: { latency_hours: number };
  changes_requested: { has_annotations: boolean };
  publish_succeeded: { platform: string; media_type: string };
  publish_failed: { platform: string; error_class: string };
  publish_delayed_quota: { platform: string };
  tiktok_draft_pushed: {};
  token_reauth_needed: { platform: string };
  pwa_installed: { os: 'ios'|'android'|'desktop' };
  // + events produit
};
```

Track côté SERVEUR pour les events critiques (publication, approbation, connexions de comptes). Côté client uniquement pour events UI (installation PWA, clicks).

## 12. CONTEXTES SPÉCIFIQUES PROPUL'SEO

- Le SaaS sert AUSSI la marque personnelle Étienne (build-in-public). Si tu touches un truc visible publiquement → screenshot dans la PR.
- **Phase solo** : Étienne est le premier utilisateur, sur **iPhone** → parcours PWA iOS prioritaire (onboarding installation, OTP, Web Push déclaratif iOS 18.4+, fallback FAB + picker Photos — pas de Share Target). Android en second plan.
- Les contenus gérés appartiennent aux CLIENTS des freelances : la moindre fuite inter-tenant ou publication non voulue détruit la confiance du produit. Paranoia = feature.
- Cible FR : UI en français, TZ du client pour le contenu, TZ du freelance pour l'agenda unifié, stockage UTC `timestamptz`.
- Communication : direct, factuel, Étienne préfère "voici la faille" à "tout va bien".

## 13. DOCUMENTS DE RÉFÉRENCE

| Document | Rôle |
|---|---|
| `docs/PRD.md` | Référence fonctionnelle (v0.2 en réécriture — la lire en premier) |
| `docs/ANALYSE-LANCEMENT.md` | Architecture détaillée et décisions ACTÉES (RLS, worker, storage, PWA, agendas, état réel des API juin 2026). **Fait foi en cas de doute technique.** |
| `docs/kickoff-day1.md` | Plan de bootstrap Day 1 + prérequis externes |
| `docs/prds/` | Templates PRD features génériques de la bibliothèque — à adapter à Ocean |
| `docs/archive/` | Versions historiques — ne pas modifier |

---

**Dernière mise à jour** : 2026-06-11
**Version template** : v1.0 (templates/Codex-md/02-saas-multitenant.md) — instancié pour Ocean
