# Audit Senior Ocean — Synthèse (2026-07-07)

> Synthèse des **7 rapports d'audit produits** (01-architecture, 02-refacto, 03-debug, 04-performance, 05-clean-architecture, 06-backend-systems, 07-frontend) + le **plan de branchement backend** (`11-PLAN-BRANCHEMENT-BACKEND.md`). Les 3 rapports restants (08 tech-lead, 09 sécurité, 10 devops) seront produits au reset de quota (10/07/2026) — leurs zones sont déjà partiellement couvertes ci-dessous et signalées `[à confirmer 08/09/10]`.
>
> Findings **vérifiés adversarialement** (chaque item a résisté à une passe de réfutation par un agent sceptique). **READ-ONLY : aucun code modifié.**

---

## Executive summary

Le front d'Ocean est une **preview remarquablement propre** : 100 % des pages sont des Server Components `async`, une **façade unique** (`lib/mocks/index.ts`) sert de point de branchement Supabase, les enums de statuts recoupent fidèlement le PRD §6, et le design system a de bonnes fondations. **Le front est donc « prêt à câbler » — à condition de solder d'abord 4 coutures structurelles** qui, laissées telles quelles, transformeraient le swap Supabase en réécriture sous pression d'une UI déjà validée. **Verdict : refonte ciblée légère (lot « Pré-0 », 3-5 j) PUIS câblage.** Ce ne sont pas des bugs de la maquette (rien n'est cassé aujourd'hui, tout est mocké et figé) mais des **dettes de contrat** qui deviennent réelles au premier `await` réseau.

**3 risques majeurs pour la mise en prod + le câblage :**
1. **Façade synchrone non-swappable** — les getters sont synchrones et lus jusque dans 7 composants `use client` du shell ; incompatible avec Supabase (server-only + RLS + cookie httpOnly). Sans couture, le swap casse le shell transverse monté sur toutes les pages.
2. **Contrat de données divergent de la DB** — le tenant est absent (`grep org_id` = 0 occurrence), le contenu utilisateur est bilingue `L<string>` (~145 `pick()` / 70 fichiers) alors que la DB stocke du `text`, et 8 entités déjà en UI (médiathèque, piliers, hashtags, brand kit, vues, créneaux, événements, notes) n'ont **aucune table** au PRD §6.
3. **Aucun filet async** — zéro `error.tsx`/`loading.tsx`/`not-found.tsx` dans tout `app/` (14 `notFound()` pourtant appelés), plus un bug de fuseau **P0 confirmé empiriquement** dans la grille calendrier. La première erreur de fetch Supabase fera un crash plein écran non brandé sur PWA iOS.

Aucun de ces points ne bloque la mise en ligne de la maquette elle-même. **Tous doivent être tranchés avant le Lot média/worker.** Le chemin recommandé : Pré-0 (coutures) → Lot 0 (bootstrap + auth) → Lots 1-4 dans l'ordre PRD §11.

---

## Carte d'architecture (réel observé + cible)

**Réel (preview mockée)**
```
23 pages Server Component async  ──►  lib/mocks/index.ts (façade barrel SYNCHRONE)
   │                                     │  ~20 getters .find()/.filter() sur tableaux
   │  (bon pattern : props → client)     │  export * from ./types  (enums DB + L<string>)
   │                                     ▼
   │                                  22 modules de constantes typées, MOCK_NOW figé
   └── EXCEPTION : 7 composants use client du shell lisent la façade au rendu
       (command-palette, notifications-button, client-health-banner, app-sidebar,
        client-switcher, quick-capture, nav-user) → dataset complet dans le bundle client
```

**Cible (post-câblage)**
```
23 pages async  ──►  apps/web/lib/data/*.ts (façade ASYNC server-only, cache())
   │  await getX(orgId, clientId)          │  createServerClient() + getActiveOrg()
   │  loading/error/not-found boundaries   ▼
   │  Server Actions Zod (mutations)     Supabase Postgres (RLS 100%, FK composites)
   │  TanStack Query (recherche client)     + Storage (media-originals privé / thumbs public)
   │                                        + Vault (tokens OAuth) + Realtime
   packages/shared (types database.ts, Zod, quotas)  ◄── apps/worker (SKIP LOCKED, idempotence)
```

Le passage de l'un à l'autre est un **swap module-par-module derrière la façade**, à condition que les signatures et la forme des types soient stables — d'où les coutures Pré-0.

---

## Backlog priorisé unique (dédupliqué)

Findings recoupés entre rapports fusionnés en une ligne (sources notées). `[PRE-CABLAGE]` = à corriger **avant** de brancher Supabase.

| Prio | Dimension(s) | Finding | Où | Effort | Impact | ⚠ Comport. | Verrou |
|---|---|---|---|---|---|---|---|
| **P0** | 03-debug | Clés jour grille calendrier dépendantes du fuseau runtime (date-fns local + getters UTC) → off-by-one **confirmé** | `components/app/calendar/*`, `use-calendar-state.ts` | S | fort | non | — |
| **P0** | 05-clean, 03-debug | URLs `(app)` sans préfixe `/app` → middleware §9 `startsWith('/app')` ne protège rien ; aucun `middleware.ts` | `lib/routes.ts:2-27`, `app/(app)/**` | S | fort | oui¹ | CLAUDE.md §9 |
| **P1** `[PRE-CABLAGE]` | 01,02,04,05,06 | Façade `lib/mocks` synchrone + lue dans 7 composants `use client` → non-swappable vers Supabase | `lib/mocks/index.ts:40-236` + shell | M | fort | non | §0, §1 |
| **P1** `[PRE-CABLAGE]` | 01,02,04,05 | Wrapper bilingue `L<string>` cuit dans les types DB (~145 `pick()` / 70 fichiers) | `types/core.ts:147`, `lib/i18n/localized.ts:6` | L | fort | non | §0, PRD §6 |
| **P1** `[PRE-CABLAGE]` | 01,03,04,05 | Aucun seam d'horloge : `MOCK_NOW` figé importé par 22 fichiers dont `lib/format.ts` | `lib/format.ts:2`, `mocks/time.ts:3` | M | fort | non | §0 |
| **P1** `[PRE-CABLAGE]` | 04,05,07 | Zéro `error.tsx`/`loading.tsx`/`not-found.tsx` dans tout `app/` ; trilogie d'états incomplète (ErrorState absent) | `app/**`, `components/shared/` | M | fort | non | — |
| **P1** `[PRE-CABLAGE]` | 06 | Tenant absent du contrat : `grep org_id`=0 ; `getActiveOrg()` threadé nulle part | tout `apps/web` | M | fort | non | §2.7, §8 |
| **P1** `[PRE-CABLAGE]` | 06 | 8 entités en UI sans table PRD §6 (médiathèque, piliers, hashtags, brand kit, vues, slots, events, notes) | `types/pro.ts`, `types/library.ts` | M | fort | non | §8 |
| **P1** | 02,05,06 | Types DB + constantes quotas worker enfermés sous `lib/mocks` (~230 imports) ; cycle mocks↔i18n | `lib/mocks/**` | L | fort | non | §4 |
| **P1** | 03,06 | Portail : `DEMO_REVIEWER_CLIENT_ID` codé en dur (3-4 fichiers) au lieu d'un seam reviewer→`client_members` | `app/(portal)/**` | M | fort | non | §3 |
| **P1** | 03 | Détail portail n'applique pas la règle de visibilité reviewer (statuts+corbeille) ; seule la liste la respecte | `portal/[contentId]/page.tsx` | S | fort | oui² | PRD §5.F |
| **P1** | 02,03 | Machine à états ContentStatus dupliquée 4× avec règles **divergentes** ; règle d'éditabilité §5.B dupliquée 5× | studio (`board-*`, `detail-*`) | M | fort | non | PRD §5.B |
| **P1** | 04 | Aucune pagination/fenêtrage : façade retourne l'historique intégral, calendrier/grille/board chargent tout | `lib/mocks/index.ts`, listings | M | fort | non | — |
| **P1** | 07 | `error.tsx` absent → 1re erreur fetch Supabase = crash plein écran non brandé sur PWA iOS | `app/(app)/**` | S | fort | non | — |
| **P1** | 05,07 | PWA iOS : manifest icône SVG seule (ignorée iOS), pas d'`apple-touch-icon` PNG | `app/manifest.ts`, `public/` | S | moyen | non | §8.5 |
| **P2** | 06 | `Annotation.slideIndex` diverge du jsonb acté `{media_asset_id,x,y}` | `types/collab.ts:28-33` | S | moyen | non | PRD §6 |
| **P2** | 06 | Agenda unifié inclut `approved` non planifiés ≠ vue `unified_agenda` (planifiés) | `index.ts:114-130` | S | moyen | oui³ | PRD §6 |
| **P2** | 06 | `MemberRole="owner"\|"reviewer"` écrase le modèle à 2 tables (org_members + client_members) | `types/core.ts:47` | S | moyen | non | §2 |
| **P2** | 06 | Quotas mono-limite : IG 400 conteneurs / FB BUC 4800 non représentables | `quotas.ts:11-16` | M | moyen | non | §6 |
| **P2** | 03,04 | `ASAP_DELAY_MS` (5min) < `MIN_LEAD_MS` (15min) : « dès que possible » produit une date bloquée par le preflight | composer | S | faible | oui⁴ | — |
| **P2** | 03,04 | Arithmétique de dates en ms fixes (n×86 400 000) : dérive DST à chaque bascule heure été/hiver | grille, `scheduleBatch` | M | moyen | oui⁵ | — |
| **P2** | 04 | Dictionnaires FR+EN complets (229 Ko) aplatis dans le chunk client de 100 % des routes | `dictionaries/index.ts:26` | M | moyen | non | — |
| **P2** | 04,07 | Formatteurs Intl reconstruits à chaque rendu ; zéro mémoïsation grid/calendar | grid, calendar | M | moyen | non | — |
| **P2** | 07 | `MediaThumb` (13 usages) sans état erreur/chargement → URL signées expirées = glyphe cassé | `components/shared/media-thumb` | S | moyen | non | §8.3 |
| **P2** | 07 | Kanban non pilotable au clavier (`DndContext` sans `KeyboardSensor` + fausse affordance ARIA) | studio kanban | M | moyen | non | a11y |
| **P2** | 05 | Aucune route `/api/health` ni `HEALTHCHECK` Docker | racine, `app/api/` | S | moyen | non | §7 |
| **P2** | 05 | Runtime Node non pinné (CLAUDE.md=20, image=22, dev=24, engines>=20) | `Dockerfile`, `package.json` | S | moyen | non | §1 |
| **P3** | 02,05 | ~12 fichiers > 250 lignes sans exemption ; aucun outillage pour la règle | divers | M | faible | non | règle 24 |
| **P3** | 06 | `ImportedPost` sans `external_id` (clé dédup feed IG) ; `ContentTarget` sans `deleted_externally` | `types/core.ts` | S | faible | non | PRD §6 |
| **P3** | 03,07 | Formulaires login/OTP hors stack (pas de RHF+Zod, regex email maison) ; flow sans `?next=`/email→OTP | `app/(auth)/**` | M | faible | oui⁶ | §1 |
| **P3** | 04,05 | Rendu dynamique forcé sur 100 % des routes (`cookies()` root layout) ; images hot-linkées Pexels | `app/layout.tsx` | M | faible | non | — |

¹ change les URLs (si option « déplacer sous /app »). ² corrige une fuite de visibilité (comportement à corriger). ³ aligne l'affichage sur la vue cible. ⁴⁵⁶ corrigent des bugs latents.

**Total : 2 P0 · 14 P1 · 12 P2 · 4 P3** (après déduplication ; ~170 findings bruts fusionnés). Les rapports 08/09/10 ajouteront surtout des P1/P2 sécurité (isolation RLS, SSRF OAuth, portail) et devops (CI, Sentry, backup).

---

## Séquence recommandée

**Avant le câblage (lot Pré-0, ~3-5 j)** — les `[PRE-CABLAGE]` + les 2 P0, sur le front encore mocké, à comportement identique :
1. Les 2 P0 (fuseau calendrier + décision préfixe `/app`) — ils touchent le routing et un bug visible.
2. Couture façade async + server-only (débloque tout le reste).
3. Couture seam tenant (org/client + contexte reviewer).
4. Couture dé-`L<string>` (le plus gros, mais mécanique).
5. Couture horloge + boundaries + trilogie d'états.
6. Acter les décisions D-1→D-6 du plan (tables des 8 entités hors §6, préfixe `/app`, buckets…).

**Pendant le câblage (au fil des lots PRD §11)** — voir `11-PLAN-BRANCHEMENT-BACKEND.md` §1 : Lot 0 (bootstrap+auth) → Lot 1 (contenu) → Lot 2 (worker) → Lot 3 (portail) → Lot 4 (agenda). Les findings P1/P2 restants (dédup machine à états, pagination, quotas multi-limites) se soldent naturellement dans le lot qui touche la zone.

**Après (dette de confort)** — les P3 (règle 250 lignes + outillage, mémoïsation fine, a11y avancée).

> **Rien de tout ceci n'est appliqué.** Le prochain pas est ta validation : quels items veux-tu que je traite (ex. « tout le lot Pré-0 », ou un item précis) ? Je ne touche au code qu'après ton accord, avec build vert après chaque lot.
