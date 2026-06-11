# KICKOFF — Claude Code Day 1 · Ocean (SaaS multi-tenant)

> Template Propul'SEO (templates/kickoff/02-day1-saas.md) instancié pour Ocean
> Bootstrap d'un SaaS Next.js 16 + Supabase + Brevo + Coolify, monorepo pnpm `apps/web` + `apps/worker`
> Output Day 1 : monorepo + stack + schéma multi-tenant (FK composites, helpers `private`, `*_secrets` deny-all) + auth OTP/magic link + buckets storage + PWA manifest + leak test multi-tenant passé + deploy staging Coolify
> ⚠️ Pas de Stripe au MVP (phase solo) — le billing arrive à l'ouverture SaaS.

---

## ⚠️ PRÉREQUIS EXTERNES SPÉCIFIQUES OCEAN (avant toute ligne de code)

- [ ] **Repo GitHub** créé (privé, `main` protégée)
- [ ] **Projet Supabase** créé (région EU, **plan Free pour l'instant**) — ⚠️ garde-fou bloquant : **passage Pro obligatoire AVANT le premier test de Reel au Lot 2** (le Free plafonne à 50 MB/fichier → les uploads de Reels échoueraient de façon incompréhensible)
- [ ] **App Meta créée en TYPE BUSINESS / use case Pages** (« Manage everything on your Page ») — **surtout PAS une app Consumer avec modes dev/live** (une app Consumer en mode dev produit des posts INVISIBLES du public)
- [ ] **Variante « Instagram API with Instagram Login » configurée** (produit Instagram > API setup with Instagram login — graph.instagram.com, scopes `instagram_business_*`, publie sans Page Facebook)
- [ ] **App TikTok développeur créée** + **préparer la soumission en revue d'app standard (scope `video.upload`, privacy policy URL requise) dès le début du Lot 2** — il n'y a PAS de « mode dev » TikTok utilisable en phase solo, la revue est un jalon bloquant
- [ ] **Compte Brevo** : KYC, sender domain authentifié SPF/DKIM/DMARC, **SMTP custom Supabase pointé sur Brevo** (magic link/OTP partent via Brevo)
- [ ] **Projet GCP** : OAuth client dédié agendas, **scopes granulaires `calendar.events.readonly` + `calendar.calendarlist.readonly`** (plus simples à justifier que `calendar.readonly`) — ⚠️ en statut « Testing », refresh tokens expirés tous les 7 jours → lancer la vérification « sensible » tôt (Lot 4, gratuite, ~10 j)
- [ ] **App registration Entra ID** : multi-tenant + comptes perso, flow confidential web app (jamais SPA)
- [ ] **Projet Sentry** créé (2 DSN : web + worker)
- [ ] **Projet PostHog** créé (EU host)
- [ ] **Coolify** : projet provisionné avec **2 apps : web + worker**

---

## 0. PRÉ-REQUIS AVANT LE PROMPT

### Validation produit (NON NÉGOCIABLE)
- [ ] **PRD.md v0.2** validé (en réécriture — référence fonctionnelle)
- [ ] **docs/ANALYSE-LANCEMENT.md** lu : décisions §6 ACTÉES (OTP mobile, validation optionnelle par contenu, import feed IG au MVP, Vault, bucket thumbs public, rétention J+7, fenêtre de grâce 2h, report quota auto)
- [ ] **CLAUDE.md** Ocean en place à la racine (fait)
- [ ] Schéma SQL de l'analyse (FK composites, helpers, policies modèles) sous la main — à reprendre tel quel dans les migrations du Lot 0

### Variables d'environnement
```env
# Next (apps/web)
NEXT_PUBLIC_SITE_URL=https://staging.app.[domain]

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Worker (apps/worker) — Supavisor mode SESSION port 5432, JAMAIS 6543
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Meta (app type Business — IG Login + Facebook Login for Business)
META_APP_ID=
META_APP_SECRET=
META_OAUTH_REDIRECT_URI=

# TikTok
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_OAUTH_REDIRECT_URI=

# Google (agendas — OAuth client dédié)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=

# Microsoft (agendas — Entra ID multi-tenant)
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_OAUTH_REDIRECT_URI=

# Brevo
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
BREVO_TEMPLATE_REVIEWER_INVITATION=
BREVO_TEMPLATE_REVIEW_REQUESTED=
BREVO_TEMPLATE_CHANGES_REQUESTED=
BREVO_TEMPLATE_CONTENT_APPROVED=
BREVO_TEMPLATE_PUBLISH_FAILED=
BREVO_TEMPLATE_PUBLISH_DELAYED=
BREVO_TEMPLATE_NEEDS_REAUTH=
BREVO_TEMPLATE_TIKTOK_DRAFT_READY=
BREVO_TEMPLATE_WATCHDOG_ALERT=

# Sentry
SENTRY_DSN_WEB=
SENTRY_DSN_WORKER=
SENTRY_AUTH_TOKEN=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# Web Push (VAPID — clés STABLES, ne jamais régénérer)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

### Outils locaux
- Node 20 LTS, pnpm 9+, Supabase CLI, GitHub CLI, Biome (pas ESLint)

---

## 1. LE PROMPT DAY 1 (copy-paste ready)

> Place CLAUDE.md + docs/PRD.md + docs/ANALYSE-LANCEMENT.md dans le repo, puis colle ce prompt dans Claude Code.

```
Salut Claude. Day 1 sur Ocean, SaaS multi-tenant de gestion de contenu social.

Ce kickoff est plus exigeant qu'un projet client standard parce que la sécurité multi-tenant et les tokens OAuth sont CRITIQUES dès Day 1. Une erreur ici = faille RGPD ou publication non voulue chez un client. Tu travailles en mode "show me, don't tell me" : chaque étape se valide par output observable.

Pas une ligne de code avant Phase 0 complétée.

═══════════════════════════════════════════════════════
PHASE 0 — LECTURE & ALIGNEMENT
═══════════════════════════════════════════════════════

1. Lis CLAUDE.md. Récap en 6 bullets :
   - Multi-tenant rules non négociables (org_id dénormalisé + FK composites + helpers private)
   - Tables *_secrets deny-all (tokens OAuth jamais côté client)
   - Idempotence worker (publish_started_at — jamais de retry aveugle)
   - Auth : magic link desktop / OTP 6 chiffres mobile
   - Buckets media-originals privé / media-thumbs public
   - Anti-patterns Ocean interdits

2. Lis docs/PRD.md puis docs/ANALYSE-LANCEMENT.md. Récap en 6 bullets :
   - Promesse produit en 1 phrase
   - Entités cœur (ContentItem / ContentTarget / PublishJob / Client / Reviewer)
   - Machine à états du contenu (validation client OPTIONNELLE par contenu)
   - Architecture worker (file Postgres FOR UPDATE SKIP LOCKED, pas de Redis)
   - Décisions actées §6 de l'analyse
   - Périmètre Lot 0

3. Pose-moi questions de clarification SI nécessaires (max 5).

   STOP. J'approuve.

═══════════════════════════════════════════════════════
PHASE 1 — SETUP MONOREPO & STACK
═══════════════════════════════════════════════════════

4. Init le monorepo pnpm workspaces :
   - pnpm-workspace.yaml : apps/*, packages/*
   - apps/web : Next.js 16 + TypeScript strict + Tailwind v4 + App Router + Turbopack
   - apps/worker : Node 20 + TypeScript strict (tsx en dev, build tsc), entry src/index.ts
   - packages/shared : types + schémas Zod + constantes plateformes (quotas, specs médias)

5. Installe les deps de base :
   # apps/web
   pnpm add @supabase/supabase-js @supabase/ssr
   pnpm add zod react-hook-form @hookform/resolvers @tanstack/react-query
   pnpm add lucide-react sonner clsx tailwind-merge nuqs
   pnpm add @sentry/nextjs posthog-js
   pnpm add @serwist/turbopack serwist
   # apps/worker
   pnpm add @supabase/supabase-js postgres zod @sentry/node
   # racine
   pnpm add -D @biomejs/biome typescript

6. Init shadcn/ui dans apps/web + composants core :
   pnpm dlx shadcn@latest init -d
   pnpm dlx shadcn@latest add button input form label card sonner dialog dropdown-menu sheet tabs alert badge avatar separator skeleton

7. Init Biome à la racine (biome.json partagé) — PAS d'ESLint, PAS de Prettier.
   Init Sentry : wizard Next.js dans apps/web + @sentry/node dans apps/worker.

8. Crée .env.example complet (toutes les vars listées dans le pré-requis du kickoff, web ET worker).
   Crée .env.local localement (je te passe les valeurs).
   Vérifie .gitignore (déjà en place à la racine).

   STOP. Montre-moi le diff. J'ajoute les vraies valeurs. GO.

═══════════════════════════════════════════════════════
PHASE 2 — SCHÉMA MULTI-TENANT FOUNDATIONS
═══════════════════════════════════════════════════════

> Reprendre le schéma SQL fourni par l'analyse (§3.1) tel quel. Ce qui suit en est le contrat.

9. Écris la migration SQL initiale dans /supabase/migrations/[timestamp]_init_multitenant.sql.
   Doit inclure :

   a. Table `organizations` :
      - id uuid PK, slug text unique, name text
      - created_at, updated_at

   b. Table `profiles` (liée auth.users) :
      - id uuid PK FK → auth.users (cascade)
      - email, full_name, avatar_url, timezone (TZ du freelance pour l'agenda unifié)
      - trigger `handle_new_user` qui n'insère QUE dans profiles (rien d'autre)

   c. Table `organization_members` :
      - org_id FK → organizations (cascade), user_id FK → auth.users (cascade)
      - role text check (role in ('owner','admin'))
      - unique (org_id, user_id)

   d. Table `clients` (les clients du freelance) :
      - id uuid PK, org_id uuid NOT NULL FK → organizations
      - name, timezone NOT NULL (TZ du client pour le contenu — décision actée)
      - archived_at timestamptz (soft-delete / offboarding)
      - **UNIQUE(id, org_id)** ← FK composite, non négociable

   e. Table `client_members` (Reviewer/Editor — vrais comptes Supabase Auth invités par magic link/OTP) :
      - client_id + org_id FK composite → clients(id, org_id)
      - user_id FK → auth.users
      - role text check (role in ('reviewer','editor'))
      - unique (client_id, user_id)

   f. Tables `social_accounts` + `social_account_secrets` :
      - social_accounts : org_id + client_id (FK composite), platform, external_id, status (active/needs_reauth), métadonnées publiques
      - social_account_secrets : tokens OAuth (références Vault) — **RLS activée, ZÉRO policy = deny-all, service role uniquement**

   g. Table `notifications` (entité prévue au schéma dès le Lot 0 — analyse §7)

   h. Helpers RLS dans un schéma **`private` NON exposé** (pas dans l'API) :
      - private.user_org_ids() / private.is_org_member(org uuid) / private.has_role_in_org(org uuid, roles text[])
      - private.user_client_ids() / private.is_client_member(client uuid)
      - SECURITY DEFINER STABLE, SET search_path = ''
      - PAS de claims JWT d'autorisation (révocation Reviewer doit être immédiate)

   i. RLS sur TOUTES les tables (y compris organization_members et client_members — via helpers, sinon récursion) :
      - policies wrappées `(select private.fn())` ← sinon −95% perf
      - `TO authenticated` sur chaque policy
      - Reviewer : ne passe AUCUNE policy org-level par construction (il n'a que client_members)

   j. Triggers updated_at génériques + indexes sur toutes les FK et colonnes filtrées

   k. Test d'isolation pgTAP (CI) : user A / org X vs user B / org Y + reviewer scoping

   STOP. Envoie-moi le SQL COMPLET commenté. Je le lis ligne par ligne. Tu ne touches PAS la DB tant que je n'ai pas dit GO.

10. Après mon GO : applique via Supabase MCP, lance get_advisors (zéro warning RLS), génère les types :
    pnpm supabase gen types typescript --project-id [REF] > packages/shared/src/database.ts

═══════════════════════════════════════════════════════
PHASE 3 — SUPABASE CLIENTS & MIDDLEWARE
═══════════════════════════════════════════════════════

11. Crée apps/web/lib/supabase/server.ts, client.ts, admin.ts, middleware.ts (helpers @supabase/ssr).

12. Crée apps/web/lib/auth/org-context.ts :
    - getActiveOrg() React cache : user, cookie active_org_id, vérifie organization_members, retourne { org, role }
    - switchOrg(orgId) Server Action : valide membership, set cookie httpOnly, revalidate
    - getReviewerClients() : clients accessibles via client_members (contexte portail)

13. Crée apps/web/middleware.ts :
    - updateSession Supabase
    - Routes publiques (marketing, /login, /otp, /api/health, /api/oauth/*) → passe
    - /app/* sans user → redirect /login
    - /portal/* : authentifié, scoping par RLS (pas de cookie org)

═══════════════════════════════════════════════════════
PHASE 4 — AUTH : MAGIC LINK DESKTOP + OTP MOBILE
═══════════════════════════════════════════════════════

> ⚠️ Piège n°1 du projet : un magic link ouvert depuis Mail sur iOS crée la session dans Safari,
> PAS dans la PWA installée (stockage séparé) → déconnexion en boucle.
> Parade ACTÉE : OTP 6 chiffres sur mobile (signInWithOtp/verifyOtp), magic link conservé sur desktop.

14. Configure Supabase Auth :
    - SMTP custom pointé sur Brevo (sender authentifié)
    - Template email : lien magique ET code OTP dans le même email (scanners de liens des messageries d'entreprise)

15. Crée /app/(auth)/login/page.tsx :
    - Détection mobile (UA + display-mode standalone) → flow OTP : signInWithOtp(email) puis verifyOtp(email, code 6 chiffres)
    - Desktop → magic link classique
    - shouldCreateUser: false pour les connexions (l'inscription freelance est un flow séparé ; les Reviewers sont créés par inviteUserByEmail)

16. Crée le flow d'invitation Reviewer (squelette, le portail complet = Lot 3) :
    - Server Action inviteReviewer(clientId, email) : inviteUserByEmail + INSERT client_members + email Brevo

   STOP. Démo : connexion OTP fonctionnelle sur mon iPhone (PWA non encore installée, ce sera Phase 6). GO.

═══════════════════════════════════════════════════════
PHASE 5 — STORAGE : BUCKETS & POLICIES
═══════════════════════════════════════════════════════

17. Crée les 2 buckets (migration ou MCP) :
    - `media-originals` : PRIVÉ, mime jpeg/png/mp4/mov, limite 300 MB (⚠️ plan Free = 50 MB effectifs → garde-fou Reel au Lot 2)
    - `media-thumbs` : PUBLIC (vignettes ~400px WebP, URLs stables, cache optimal — décision actée)

18. Policies storage.objects via storage.foldername() :
    - Chemins = mécanisme d'isolation : {org_id}/{client_id}/{content_item_id}/{media_asset_id}/…
    - Lecture/écriture scopées par helpers private.* sur le premier segment
    - À poser AVANT le premier upload, pas après

19. Aucune exposition d'original non publié : URL signée TTL 48h générée côté serveur uniquement (le worker s'en servira au Lot 2).

═══════════════════════════════════════════════════════
PHASE 6 — PWA FOUNDATIONS (PRIORITÉ iOS)
═══════════════════════════════════════════════════════

20. Configure Serwist via @serwist/turbopack (Next 16 = Turbopack par défaut ; ne PAS forcer --webpack).
    - manifest.json : name, icons, display standalone, theme
    - SW : allowlist explicite — ne JAMAIS cacher /auth/v1/* ni les POST (fuite post-logout)

21. Crée l'onboarding d'installation iOS (dès le Lot 0 — décision actée, Étienne est sur iPhone) :
    - Détection display-mode + iOS → écran guidé « Partager → Sur l'écran d'accueil »
    - State persisté (ne pas re-prompter à chaque visite)

═══════════════════════════════════════════════════════
PHASE 7 — PAGES FONDATION
═══════════════════════════════════════════════════════

22. Crée /app/(app)/layout.tsx : sidebar desktop / bottom-nav mobile + header + getActiveOrg requis.

23. Crée /app/(app)/dashboard/page.tsx : page vide avec "Bienvenue dans Ocean" + CTA "Ajouter un client".

24. Crée /app/(app)/clients/ : liste + création de Client (name + timezone obligatoire).

25. Crée /app/(portal)/portal/page.tsx : squelette portail Reviewer (liste des clients accessibles via getReviewerClients — le flux de validation complet = Lot 3).

26. Configure PostHog (provider client) + /lib/analytics/events.ts (EventMap typé strict du CLAUDE.md §11).

═══════════════════════════════════════════════════════
PHASE 8 — TEST CRITIQUE : AUTH DESKTOP + MOBILE PWA
═══════════════════════════════════════════════════════

27. Test E2E manuel :
    a. Desktop : /login → magic link → session OK → /app/dashboard
    b. iPhone : installer la PWA (onboarding Phase 6)
    c. DANS la PWA installée : login OTP 6 chiffres → session créée DANS la PWA (pas Safari)
    d. Fermer/rouvrir la PWA → session persiste (pas de déconnexion en boucle)
    e. Création org + premier client (timezone) → visible dashboard

   STOP. Tu me montres TOUTES les étapes (captures ou logs). Si (c) ou (d) échoue → on debug avant Phase 9.

═══════════════════════════════════════════════════════
PHASE 9 — TEST CRITIQUE : MULTI-TENANT LEAK
═══════════════════════════════════════════════════════

> Protocole de référence : prompts/08-qa/02-test-multi-tenant-leak.md (bibliothèque).

28. Crée 2 users + 2 orgs distinctes : User A → org X, User B → org Y.
    + User C = Reviewer invité sur client C1 de l'org X (client_members uniquement).

29. En tant qu'user A, insère 1 client + 1 row métier.

30. Connecté en user B : supabase.from('clients').select('*') → Expected : tableau vide.

31. Connecté en user B via REST direct (curl + JWT user B) → Expected : [] (RLS bloque).

32. Connecté en user B, tente d'INSERT avec org_id = X → Expected : WITH CHECK rejette.

33. Connecté en user C (Reviewer) :
    - voit UNIQUEMENT le client C1 (pas les autres clients de l'org X)
    - ne passe AUCUNE route /app/* ni aucune policy org-level
    - DELETE de sa ligne client_members → accès révoqué IMMÉDIATEMENT (pas d'attente refresh token)

34. Vérifie que social_account_secrets est inaccessible avec N'IMPORTE QUEL JWT user (deny-all).

35. Documente dans /tests/security/multitenant-leak.test.ts (pgTAP et/ou Vitest) et fais passer en CI.

   STOP. Captures + résultats. GO si tous tests passent.

═══════════════════════════════════════════════════════
PHASE 10 — CI/CD & DEPLOY STAGING COOLIFY
═══════════════════════════════════════════════════════

36. Crée .github/workflows/ci.yml :
    - biome check + typecheck + build (web ET worker) sur push/PR
    - tests sécurité (Phase 9) sur PR vers main

37. Deploy staging sur Coolify — 2 apps :
    - apps/web : build Next standalone, /api/health pour le health check
    - apps/worker : squelette qui boote, log "tick" 5 s, exit propre sur SIGTERM (la logique de publication = Lot 2) ; DATABASE_URL en Supavisor SESSION port 5432
    - Toutes vars d'env injectées par app

38. Configure Sentry sourcemap upload en build (web) + init Sentry worker.

═══════════════════════════════════════════════════════
PHASE 11 — RECAP & DAY 2 PLANNING
═══════════════════════════════════════════════════════

39. Génère RECAP_DAY1.md :
    - Foundations livrées (schéma, auth OTP/magic link, buckets, PWA, monorepo, deploy)
    - Leak test multi-tenant + reviewer scoping passés
    - URL staging
    - Risques / TODO restants
    - Plan Day 2 (5 tâches priorisées du Lot 1 : entités ContentItem/ContentTarget, machine à états, specs médias + conversion JPEG/HEIC, miniatures client, calendrier squelette)

═══════════════════════════════════════════════════════

Règles d'or pendant tout le Day 1 :
- Multi-tenant : aucune table sans org_id dénormalisé + FK composites + RLS. Aucune.
- Tokens : tables *_secrets deny-all, jamais un token vers le navigateur.
- Mobile : OTP, jamais magic link dans la PWA iOS.
- Worker : SESSION port 5432, jamais 6543.
- À chaque STOP : tu attends, montres les outputs, ne continues pas.
- Si un test échoue Phase 8 ou 9 → ON ARRÊTE, on debug. On ne deploye pas avec une faille.

GO. Phase 0.
```

---

## 2. CHECKLIST DE VALIDATION ÉTIENNE — POINTS CRITIQUES

### Phase 2 (Schéma multi-tenant)
- [ ] Toutes tables métier ont `org_id` NOT NULL dénormalisé (+ `client_id` sur les filles de Client)
- [ ] FK composites présentes : `UNIQUE(id, org_id)` sur clients, FK composite sur client_members/social_accounts
- [ ] Helpers dans schéma `private` NON exposé, `SECURITY DEFINER STABLE SET search_path = ''`
- [ ] Policies wrappées `(select private.fn())` + `TO authenticated` partout
- [ ] `social_account_secrets` : RLS activée, ZÉRO policy (deny-all)
- [ ] Trigger `handle_new_user` n'insère QUE dans profiles
- [ ] RLS aussi sur organization_members et client_members (pas de récursion)
- [ ] `get_advisors` clean après migration
- [ ] Indexes sur toutes les FK

### Phase 4 (Auth)
- [ ] SMTP Supabase → Brevo opérationnel (email reçu < 30 s)
- [ ] Email contient lien magique ET code OTP
- [ ] OTP fonctionne avec `shouldCreateUser: false`
- [ ] Invitation Reviewer = inviteUserByEmail + client_members (jamais de lien public non authentifié)

### Phase 5 (Storage)
- [ ] media-originals PRIVÉ, media-thumbs PUBLIC
- [ ] Policies storage.objects via storage.foldername() posées AVANT tout upload
- [ ] Aucune URL publique permanente vers un original

### Phase 8 (Auth mobile)
- [ ] Session OTP créée DANS la PWA installée, persiste après fermeture
- [ ] Onboarding installation iOS affiché et fonctionnel

### Phase 9 (Multi-tenant)
- [ ] User B ne voit ZÉRO data de l'org A via SDK et via REST direct
- [ ] User B ne peut PAS INSERT avec org_id de A
- [ ] Reviewer ne voit QUE son client, révocation immédiate
- [ ] *_secrets inaccessibles avec tout JWT user
- [ ] Tests automatisés committés et en CI

---

## 3. PIÈGES FRÉQUENTS OCEAN DAY 1

❌ **Skipper le leak test multi-tenant** → 1 bug RLS = catastrophe RGPD + confiance produit détruite. NON NÉGOCIABLE.
❌ **App Meta créée en type Consumer** → modes dev/live, posts invisibles du public. Type BUSINESS / use case Pages, point.
❌ **Magic link comme auth mobile** → session dans Safari, pas dans la PWA → déconnexion en boucle. OTP 6 chiffres.
❌ **Rester sur Supabase Free au moment des Reels** → plafond 50 MB/fichier, uploads qui échouent de façon incompréhensible. Pro AVANT le premier test de Reel (Lot 2).
❌ **Worker branché sur le pooler transaction (6543)** → advisory locks cassés, double publication. SESSION 5432.
❌ **Claims JWT pour l'autorisation Reviewer** → révocation effective ~1h plus tard. Helpers `private.*` qui lisent les tables.
❌ **Policies avec jointures ou sans wrapping `(select fn())`** → −95% de perf, l'app rame dès 1000 lignes.
❌ **Bucket public pour les originaux** → contenu client non publié exposé. Privé + URL signée 48h.
❌ **SW qui cache /auth/v1/* ou des POST** → fuite de données post-logout.
❌ **VAPID keys régénérées au deploy** → tous les tokens push invalidés. Clés stables en secret Coolify.
❌ **Reporter la soumission TikTok** → la revue d'app standard prend des jours/semaines, à soumettre dès le DÉBUT du Lot 2, en parallèle du dev.

---

## 4. ESTIMATION TEMPS DAY 1 OCEAN

Avec tous les pré-requis OK :
- **Solo Étienne supervision** : 6-9h de chat (schéma + auth OTP + PWA = dense)
- **Sans prérequis Supabase/Brevo/Meta prêts** : NE PAS DÉMARRER

Si Day 1 dépasse 10h actives → split en Day 1 (monorepo + schéma + auth) + Day 2 (storage + PWA + tests + deploy).

---

## 5. POST-DAY-1 : CADENCE OCEAN (Lots du PRD + corrections de l'analyse §7)

| Lot | Contenu | Jalons externes |
|-----|---------|-----------------|
| **Lot 0** (= Day 1-2) | Monorepo, schéma multi-tenant (ContentTarget, soft-delete, notifications), auth OTP/magic link, buckets, PWA manifest + onboarding iOS, deploy Coolify | App Meta type Business créée |
| **Lot 1** | Studio contenu : specs médias + validation upload (JPEG/HEIC, ratios), miniatures côté client, machine à états complète, TZ par client, calendrier éditorial, grille IG + import du feed existant (`GET /media`) | — |
| **Lot 2** | Worker SKIP LOCKED + watchdog, refresh tokens, publication IG/FB, TikTok brouillon, Module Notifications (triple canal) | ⚠️ **Spike n°1 visibilité Meta (premier jour)** ; ⚠️ **soumettre la revue d'app TikTok immédiatement** ; ⚠️ **Spike n°2 brouillon photo TikTok** ; ⚠️ **Supabase Pro AVANT le premier test de Reel** |
| **Lot 3** | Portail de validation client : invitations Brevo, versioning des approbations (insert-only), ReviewRequest, annotations pin (x,y) | Templates Brevo opérationnels |
| **Lot 4** | Agenda unifié Google+Outlook : OAuth custom, sync fenêtrée 15 min, vue unified_agenda, toggle par calendrier | ⚠️ **Lancer la vérification Google « sensible » tôt** (gratuite, ~10 j — sinon reconnexion hebdo) |
| **V2** | App Review Meta, audit TikTok Direct Post, vérification Google finalisée, admin consent + publisher verification Microsoft, stats V2 (nouvelles métriques v26.0), Stripe/billing, custom domain Supabase si carrousels photo TikTok | — |

---

**Version template** : v1.0 (templates/kickoff/02-day1-saas.md) — instancié pour Ocean le 2026-06-11
