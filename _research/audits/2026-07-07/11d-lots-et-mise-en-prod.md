# 11d — Lots de câblage détaillés & mise en production (2026-07-07)

> Découpe opérationnelle du chantier en lots testables, avec périmètre exact, definition of done, tests et risques. + plan de mise en prod Coolify et prérequis externes. Aligné PRD §11 et 08-tech-lead. **READ-ONLY.**

## Lot Pré-0 — Coutures sur front mocké (3-5 j) · comportement identique

**Pourquoi** : sans ça, le swap Supabase devient une réécriture de l'UI validée. C'est le pré-requis dur du Lot 0.

| Tâche | Périmètre | DoD |
|---|---|---|
| P0-a Fuseau calendrier | `components/app/calendar/*`, `use-calendar-state.ts` | clés jour dérivées d'un fuseau explicite (client), plus du runtime ; off-by-one corrigé, testé sur TZ négatif |
| P0-b Préfixe `/app` | `proxy.ts` (matcher fail-closed) | routes réelles protégées, `?next=` géré |
| Couture façade async | `lib/data/*` signatures async+orgId+string, `no-restricted-imports` Biome | build vert, 7 composants shell re-routés (props/provider), 0 régression visuelle |
| Couture seam tenant | `getActiveOrg()`/`getReviewerContext()` mock, threadé | `grep org_id` > 0, portail sans `DEMO_REVIEWER_CLIENT_ID` |
| Couture dé-`L<string>` | getters résolvent la locale, types domaine en `string` | ~145 `pick()` retirés des composants, UI bilingue identique |
| Couture horloge + boundaries | `lib/clock.ts`, error/loading/not-found par groupe, `ErrorState`, `MediaThumb` états | 3 boundaries présentes, build vert |
| Acter D-1→D-6 | décision écrite | schéma prêt à figer |

**Test global** : `pnpm -C apps/web build` vert + revue Playwright (screenshots FR/EN identiques à la maquette validée). **Risque** : dé-`L<string>` touche 70 fichiers → faire par vagues, build après chaque.

## Lot 0 — Bootstrap + socle (8-12 j)

**Périmètre** : `packages/shared` (types, Zod, quotas), `supabase/` (migrations 001-006 : orgs/profiles/members/clients/content_items/content_targets/notifications/push + RLS + helpers `private` + FK composites), remote GitHub, CI GitHub Actions, Sentry (web) + PostHog, auth réelle (magic link + OTP, SMTP Brevo), invitation reviewer (mécanique), PWA (manifest PNG + Serwist + onboarding iOS), `/api/health`.
**Tables** : organizations, profiles, organization_members, client_members, clients, content_items, content_targets, notifications, push_subscriptions.
**Bascule façade** : `clients`, `dashboard`, `notifications` → réel.
**DoD** : login réel fonctionne (desktop + mobile OTP) ; `supabase db push` OK ; `get_advisors` clean ; leak tests pgTAP verts (org isolation + reviewer isolation) ; CI verte (biome+typecheck+build+pgTAP) ; dashboard affiche des données Supabase.
**Prérequis externes** : repo GitHub, projet Supabase (Free), app Meta (use case Business), app TikTok créée, Brevo (SMTP).
**Risques** : SMTP Brevo mal configuré (tester tôt) ; RLS récursive sur tables d'appartenance (utiliser les helpers `private`, ne pas jointer).

## Lot 1 — Contenu & visuel (10-15 j)

**Périmètre** : studio (machine à états centralisée dans `packages/shared`, validation optionnelle), Module J (validation/conversion JPEG à l'upload, miniatures client WebP, TUS chunks 6 MB), grille feed (DnD = permutation dates, import IG en seed), calendrier éditorial (fuseau client). Migrations 007-011 (social_accounts+secrets, media_assets+buckets, pillars/slots/events/brandkit/views, library/hashtags, imported_posts).
**Bascule façade** : `content`, `library`, `calendar`, `grid` → réel.
**DoD** : créer/éditer/programmer un contenu réel bout en bout (sans publication) ; upload média réel (JPEG converti, thumb générée, chemin `{org}/{client}/…`) ; grille et calendrier sur données Supabase ; machine à états unique (plus de divergence).
**Risques** : conversion HEIC iPhone (tester sur vrai device) ; TUS + Storage (chunks exactement 6 MB) ; pagination des listings (ne pas charger tout l'historique).

## Lot 2 — Publication (15-20 j) · composant critique

**Périmètre** : `apps/worker` (SKIP LOCKED, lease 2 min + reaper, idempotence `publish_started_at`, backoff exp max 5, fenêtre grâce 2 h, report quota, watchdog pg_cron), URL signées 48 h + purge J+7, IG Login (+ import feed réel + sync quotidienne), Facebook (Pages/Reels/Stories), TikTok brouillon vidéo (FILE_UPLOAD + push H + copier légende + relance J+1), canaux manuels, onboarding connexion comptes, health check tokens, Module I complet (publish_failed/delayed/needs-reauth). Migration 013 (publish_jobs + index unique partiel). Sentry worker + Cron Monitors.
**🚩 Jour 1** : Spike 1 (visibilité Meta) + **soumission revue d'app TikTok** (délai 2-4 sem en parallèle) + Spike 2 (brouillon photo TikTok).
**⚠️ Garde-fou bloquant** : passage **Supabase Pro** avant le 1er test de Reel (Free plafonne à 50 MB, §13.14).
**Bascule façade** : `imported_posts`, quotas réels.
**DoD** : publication IG réelle programmée → publiée par le worker à H ; **idempotence testée** (kill -9 entre `publish_started_at` et `media_publish` → pas de double post) ; quota IG vérifié avant chaque post ; échec → notification triple canal ; connexion Supavisor SESSION port 5432 vérifiée.
**Risques** : double publication (LE risque produit — idempotence structurelle non négociable) ; token expiré à H (health check quotidien + refresh proactif) ; advisory locks cassés si port 6543 (jamais).

## Lot 3 — Validation client (8-10 j)

**Périmètre** : portail reviewer (accès cloisonné via `client_members`, invitation Brevo réelle), ReviewRequests (lots), commentaires + annotations pin (x,y jsonb `{media_asset_id,x,y}`) par slide, approbations versionnées insert-only, règle multi-reviewers, Realtime des statuts, flux approbation tardive (tâche « à reprogrammer », jamais de publication auto). Migration 012.
**Bascule façade** : `portal`, `comments`, `approvals`, `review_requests`.
**DoD** : un reviewer invité valide/commente dans SON espace uniquement ; l'owner voit le statut en Realtime ; leak test reviewer cross-client vert ; approbation tardive ne publie pas.
**Risques** : isolation reviewer (leak test le plus important) ; annotation jsonb (pas de `slideIndex`).

## Lot 4 — Agenda unifié (6-8 j)

**Périmètre** : OAuth custom Google + Microsoft (multi-comptes, Vault), sync fenêtrée (cron 15 min + sweep), toggle par calendrier, vue `unified_agenda` (PLANIFIÉS), purge hors fenêtre. Migration 014.
**🚩 Jour 1** : vérification Google « scope sensible » (~10 j, sinon reconnexion hebdo).
**Bascule façade** : `calendar_accounts`, `agenda`.
**DoD** : agenda unifié affiche vrais RDV Google/Outlook + publications, dans le fuseau du freelance ; refresh tokens gérés sous verrou.
**Risques** : refresh Google 7 j en mode test (lancer la vérif jour 1) ; « Secure by Default » Microsoft (jalon V2, admin consent).

## Plan de mise en production Coolify

**2 apps** : `web` (Dockerfile actuel) + `worker` (`Dockerfile.worker` à créer, `--filter worker`, connexion port 5432).

**Checklist déploiement** (reprend 10-devops + CLAUDE.md §7) :
- [ ] Remote GitHub + CI (biome + typecheck + build + pgTAP + `get_advisors`)
- [ ] 2 apps Coolify + labels + `/api/health` (web) + santé worker + `HEALTHCHECK`
- [ ] Sentry web + worker + Cron Monitors + sourcemaps + scrubbing tokens
- [ ] PostHog EU, events serveur (publication, approbation, connexions)
- [ ] Env vars par environnement (web ET worker) ; service role JAMAIS en `NEXT_PUBLIC_*`
- [ ] Worker : Supavisor SESSION 5432 ; horloge `now()` Postgres
- [ ] PWA : manifest PNG + apple-touch-icon ; SW n'a jamais en cache `/auth/v1/*` ni POST
- [ ] Runtime Node pinné (une version alignée doc/CI/image) ; `.dockerignore` complété
- [ ] Supabase Pro avant 1er Reel ; backups PITR ; procédure rollback
- [ ] Migrations : RLS + FK composites + leak test + `get_advisors` clean à chaque fois

## Prérequis externes (délais parallèles — lancer tôt)

| Prérequis | Quand | Délai |
|---|---|---|
| Repo GitHub, projet Supabase Free | Lot 0 | immédiat |
| App Meta (use case Business), app TikTok créée, Brevo SMTP | Lot 0 | immédiat |
| Revue d'app TikTok (Content Posting brouillon) | **Lot 2 jour 1** | 2-4 semaines |
| Spikes Meta (visibilité) + TikTok photo | Lot 2 jour 1 | jours |
| Supabase Pro | Avant 1er Reel (Lot 2) | immédiat (garde-fou) |
| Vérification Google « scope sensible » | **Lot 4 jour 1** | ~10 jours |
| Vérif INPI/EUIPO + domaine (nom « Ocean ») | Avant lancement commercial (V2) | — |

## Estimation globale

| Lot | Estimé (j solo) | Chemin critique |
|---|---|---|
| Pré-0 | 3-5 | ✅ bloque tout |
| Lot 0 | 8-12 | ✅ |
| Lot 1 | 10-15 | ✅ |
| Lot 2 | 15-20 | ✅ (+ revues d'app parallèles) |
| Lot 3 | 8-10 | parallélisable après Lot 1 |
| Lot 4 | 6-8 | parallélisable après Lot 0 |
| **Total MVP** | **~50-70 j** | hors délais externes |

> La contrainte réelle du planning n'est pas le code mais les **revues d'app** (TikTok 2-4 sem, Google ~10 j) : les soumettre dès l'entrée dans leur lot pour que les délais courent en parallèle du dev.
