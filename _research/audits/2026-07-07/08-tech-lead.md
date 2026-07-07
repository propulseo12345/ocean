# Audit — Tech Lead : décisions, arbitrages, plan 5 ans (2026-07-07)

> Rapport transverse. Lit les 9 autres rapports du jour (01-07 + 09-securite + 10-devops) et le plan de branchement, arbitre les tensions, et donne le point de vue du responsable qui maintiendra Ocean 5 ans. Ne réinventorie pas les findings (voir 00-SYNTHESE) : il **tranche** et **priorise**.

## Verdict

En tant que tech lead, mon verdict est simple : **le front est un bon actif, la maquette est validée à raison, et le chemin vers le backend est clair — à une condition non négociable : ne pas commencer le câblage avant d'avoir soldé le lot « Pré-0 ».** La tentation naturelle, maquette validée, est d'attaquer directement les migrations Supabase et l'auth (Lot 0). Ce serait l'erreur classique : les 9 rapports convergent sur le fait que la façade est synchrone, le tenant absent, le contenu bilingue baké dans les types, et sans filet async — quatre coutures qui, ignorées, transforment « swap » en « réécriture d'une UI déjà validée, sous pression, avec régressions ». Ce sont **3-5 jours** de travail sur le front encore mocké, à comportement identique. Les payer d'abord n'est pas du perfectionnisme : c'est ce qui **tient la promesse §0** et protège les semaines de validation UI déjà investies. Au-delà, le produit est correctement pensé pour durer : les décisions structurantes (Postgres SKIP LOCKED plutôt que Redis, RLS+FK composites, worker séparé, OAuth custom, Vault) sont les bonnes pour un SaaS multi-tenant qui doit tenir des années sans fuite ni double publication. Mon rôle ici est surtout de **verrouiller la séquence** et de **trancher les 6 décisions ouvertes** avant qu'elles ne deviennent des refactos coûteux.

## Les tensions à arbitrer (et mes décisions)

### T-1 — Câbler d'abord vs solder les coutures d'abord → **Coutures d'abord (Pré-0)**
La seule vraie décision de séquencement. Argument pour câbler direct : « le front est prêt, gagnons du temps ». Réalité mesurée par l'audit : la façade sync lue dans 7 composants client, les 145 `pick()` bilingues, le `MOCK_NOW` dans 22 fichiers et l'absence de boundaries **ne sont pas contournables au câblage** — ils se paient soit avant (3-5 j, à froid, comportement identique), soit pendant (réécriture à chaud, sous pression, avec régressions sur l'UI validée). **Décision : Pré-0 est un pré-requis dur du Lot 0.** Non négociable.

### T-2 — Où vivent les types partagés → **`packages/shared` créé au Lot 0, extraction depuis `lib/mocks`**
Aujourd'hui les types DB + enums + constantes quotas (source de vérité future du worker) sont enfermés sous `lib/mocks` (~230 imports, cycle mocks↔i18n). Le worker (apps/worker) aura besoin des mêmes types et quotas. **Décision : créer `packages/shared` au Lot 0**, y déplacer les types domaine (dé-`L<string>`), les enums, les schémas Zod et `PLATFORM_QUOTAS`. `lib/mocks` ne garde que les *données* de démo, derrière la façade `lib/data`. C'est aussi ce qui débloque le partage web↔worker (§4).

### T-3 — Les 8 entités mock sans table PRD §6 → **Les acter au schéma maintenant, pas au câblage**
Médiathèque, piliers, hashtags, brand kit, vues, créneaux, événements client, notes : déjà en UI, sans table. La règle §8 (« toute table métier a `org_id` dès sa création ») interdit de les improviser au câblage. **Décision : les intégrer au design du schéma dès le Lot 0/1**, avec `org_id`/`client_id` + RLS + FK composites comme toute table métier. Le rapport 11a (mapping) en donnera le détail colonne par colonne.

### T-4 — Préfixe `/app` → **Réécrire le matcher du middleware, ne pas déplacer les routes**
Deux options : (a) déplacer les 23 pages sous `/app/*`, (b) réécrire le matcher §9 pour la topologie réelle. Option (a) = churn sur 23 pages + `routes.ts` + tous les liens + comportement (URLs changent). Option (b) = un fichier. **Décision : (b), fail-closed** — tout ce qui n'est pas explicitement public (`/login`, `/otp`, `/`, `/api/health`, `/api/oauth/*`) exige une session ; `/portal` exige une session mais pas d'org. Zéro impact sur l'UI validée.

### T-5 — `L<string>` : garder un adaptateur permanent vs résoudre à la frontière → **Résoudre à la frontière**
La rustine « garder `{fr,en}` en prod » ferait vivre un artefact de démo dans Zod, les Server Actions, TanStack Query et les sérialisations, à jamais. **Décision : les getters de la façade prennent la locale et retournent des `string`** ; les mocks gardent `L<string>` en interne, résolu une fois (pattern déjà prouvé par `getDashboardTasks`). Les composants ne connaissent que des `string` = shape DB exact. C'est un chantier L mais mécanique, à faire une fois.

### T-6 — Machine à états ContentStatus dupliquée 4× (divergente) → **Une seule source dans `packages/shared`**
Quatre copies avec des règles de transition **différentes** pour la même transition, plus la règle d'éditabilité §5.B dupliquée 5× : c'est un bug latent (comportement incohérent selon l'écran) autant qu'une dette. **Décision : extraire la machine à états et les prédicats (`isEditable`, `canSchedule`, groupes de statuts) dans `packages/shared`**, consommés partout. À faire pendant le Lot 1 (studio), pas avant (pas sur le chemin critique du Lot 0).

## Ce que je NE changerais pas (décisions déjà bonnes)

- **Postgres `FOR UPDATE SKIP LOCKED` comme file, pas Redis/BullMQ.** Une seconde source de vérité = risque de double publication. La décision actée §17 est la bonne pour un système où l'idempotence prime sur le débit.
- **Worker séparé (apps/worker), pas d'Edge Function pour publier.** Le polling vidéo 5-10 min disqualifie les runtimes Edge. Correct.
- **RLS 100 % + FK composites + helpers `private` SECURITY DEFINER.** L'isolation par construction physique (une ligne fille ne peut pas pointer un autre tenant) est le bon niveau de paranoïa pour des données de clients. Ne pas alléger.
- **OAuth custom (Route Handlers) plutôt que `linkIdentity`.** Un compte social de client ne doit jamais devenir une identité de connexion. Correct.
- **i18n dictionnaires maison, next-intl différé.** Déjà en place, fonctionne ; migrer next-intl maintenant serait un coût sans bénéfice. Garder.
- **La façade unique comme seam de câblage.** L'instinct architectural était bon ; il faut juste la rendre async + server-only.

## Risques de scaling à 5 ans (au-delà du MVP)

| Risque | Horizon | Mitigation à prévoir |
|---|---|---|
| Volume de contenus/médias par client → pages qui chargent tout | Dès les 1ers vrais clients | Pagination/fenêtrage posé dès le câblage (P1 perf) ; purge J+7 des originaux (déjà actée) |
| Multiplication des intégrations (Meta, TikTok, Google, MS) → surface tokens | Lots 2-4 puis V2 | Abstraction `IntegrationOAuthProvider` unique + deny-all secrets + rotation sous lock, posée une fois |
| Passage solo → multi-org (ouverture SaaS) | V2 | Le tenant threadé dès Pré-0 rend la transition non-disruptive ; à ne PAS repousser |
| Quotas plateformes évoluant (versionnage trimestriel API) | Continu | Quotas multi-compteurs dans `packages/shared`, enforcement worker (source de vérité), re-vérif avant chaque dev d'intégration (§12) |
| Dette de règles métier dispersées (statuts, éditabilité, dates) | Dès le Lot 1 | Centralisation dans `packages/shared` ; arithmétique de dates DST-safe (P2 debug) |
| Absence de monitoring → incidents silencieux | Dès le Lot 2 | Sentry + PostHog + watchdog dès le Lot 0 (déjà pré-requis) |

## Plan d'implémentation (vue tech lead, aligné PRD §11)

1. **Pré-0 (3-5 j)** — coutures sur front mocké, comportement identique : 2 P0 (fuseau, préfixe `/app`) → façade async server-only → seam tenant → dé-`L<string>` → horloge + boundaries. Acter D-1→D-6. **Build vert + revue après chaque couture.**
2. **Lot 0 (8-12 j)** — `packages/shared` + `supabase/` + remote GitHub + CI + Sentry/PostHog + migrations fondatrices (RLS + FK composites + helpers `private` + leak tests pgTAP) + auth réelle + invitation reviewer + PWA. **Porte : `get_advisors` clean + pgTAP vert.**
3. **Lot 1 (10-15 j)** — studio (machine à états centralisée), Module J (média), grille, calendrier. Bascule la façade contenu de mock à réel, module par module.
4. **Lot 2 (15-20 j)** — worker (idempotence testée kill -9), OAuth Meta, publication réelle, health check tokens, monitoring complet. Spikes + revues d'app **jour 1**. Supabase Pro avant 1er Reel.
5. **Lot 3 (8-10 j)** — portail reviewer, ReviewRequests, annotations, Realtime.
6. **Lot 4 (6-8 j)** — agenda Google/Microsoft, vue `unified_agenda`. Vérif Google **jour 1**.

**Règle de discipline transverse** (à tenir à chaque lot) : toute nouvelle table → `org_id` + RLS + FK composites + leak test pgTAP, écrits **en même temps** que la table (jamais « on ajoutera la RLS après »). Toute Server Action → `getActiveOrg()` en 1ʳᵉ ligne + Zod + injection `org_id`. Tout appel plateforme worker → refresh + quota vérifiés AVANT + `publish_started_at` avant le publish. Ce sont les 3 règles qui, tenues, empêchent les 2 catastrophes du produit (fuite RGPD, double publication).

## Ce qui va bien (à préserver)

- Les décisions d'architecture actées sont mûres et cohérentes ; le PRD §6/§8 et CLAUDE.md §2 forment une spec de sécurité complète.
- Le front est un actif de qualité (Server Components, façade, design system, i18n) — le câblage part d'une bonne base, pas d'un chantier.
- La phase preview a atteint son but : valider l'UX avant de payer le backend. Ne pas gâcher cet investissement en câblant sans les coutures.
