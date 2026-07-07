# Audit — Sécurité (2026-07-07)

> Périmètre : surface de sécurité du front mocké **et** surface d'attaque que le câblage Supabase va créer. Rédigé à partir de la lecture directe du code (routes, auth mock, portail, config, absence de secrets) + CLAUDE.md §2 (règles 1-23) + PRD §6/§8.
> **Nature de la phase** : preview 100 % mockée, aucun backend, aucun secret en base. La quasi-totalité des risques est donc **prospective** — ce sont les garde-fous à poser AVANT/PENDANT le câblage, pas des failles exploitables aujourd'hui. Un finding qui reproche seulement « il n'y a pas d'auth réelle » a été écarté (c'est le chantier). Ne survivent que les obstacles concrets à un câblage sécurisé.

## Verdict

Aujourd'hui la surface d'attaque réelle est **quasi nulle** : pas de backend, pas de secret commité (`grep NEXT_PUBLIC|process.env|service_role|SUPABASE` sur `apps/web` = **0 occurrence**), données mockées déterministes. Le risque n'est pas présent, il est **structurel et imminent** : le front a été conçu sans aucune des coutures de sécurité que le modèle multi-tenant d'Ocean exige (CLAUDE.md §2), et plusieurs choix actuels **rendraient un câblage naïf directement dangereux**. Les trois zones critiques : (1) **le contexte tenant n'existe nulle part** — `grep org_id` = 0, aucun `getActiveOrg()`, la seule protection contre l'accès inter-client est une garde UI (`content.clientId !== clientId → notFound`) posée sur les getters *parents* mais **pas sur les getters enfants** (commentaires, approbations, versions) qui font aveuglément confiance au `contentId` de l'URL ; câblé tel quel sans RLS+FK composites, c'est une IDOR directe. (2) **Le middleware d'auth acté (§9) ne protégerait rien** : il filtre `startsWith('/app')` mais toutes les routes sont à la racine (`/dashboard`, `/clients/...`) et **aucun `middleware.ts`/`proxy.ts` n'existe** — au câblage, la matrice de protection est à l'envers et les routes authentifiées sont ouvertes par défaut. (3) **Le portail Reviewer est câblé sur une constante** (`DEMO_REVIEWER_CLIENT_ID`) au lieu d'un scoping `client_members` — l'isolation reviewer (le point le plus sensible du produit, §2.6) n'a aucun reflet dans le code. **Aucune de ces failles n'est exploitable en preview ; toutes doivent être fermées au design du câblage, pas après.** La bonne nouvelle : le modèle de sécurité cible (RLS 100 % + FK composites + helpers `private` + tables `*_secrets` deny-all + Vault) est parfaitement spécifié dans CLAUDE.md §2 et le PRD §8 — il « suffit » de l'implémenter sans dévier.

## Fonctionnement réel observé

**Auth** : purement visuelle. `app/(auth)/login/page.tsx` et `otp/page.tsx` sont des formulaires mock (toast, pas de `signInWithOtp`/`verifyOtp`), regex email maison, sans transport de l'email vers `/otp` ni gestion de `?next=`. Aucune session, aucun cookie.

**Protection des routes** : **aucun `middleware.ts` ni `proxy.ts`** dans `apps/web`. Toute route est publiquement rendue. Les URLs (`lib/routes.ts:2-27`) sont à la racine sans préfixe `/app` : `/dashboard`, `/clients/[id]/...`, `/agenda`, `/portal`, `/notifications`, `/settings/accounts`.

**Scoping des données** : `getContentItem(id)` = `CONTENT_ITEMS.find(c => c.id === id)` sans filtre client/org (`index.ts:59-61`). Les pages détail compensent par une garde UI (`content.clientId !== clientId → notFound`, `content/[contentId]/page.tsx:59` ; portail `[contentId]/page.tsx:40`), mais les getters enfants appelés juste après (`getComments`, `getApprovals`, `getContentVersions`, `getActivityEntries`) **ne re-scopent rien** et font confiance au `contentId`.

**Portail Reviewer** : la frontière tenant du reviewer est résolue depuis la constante `DEMO_REVIEWER_CLIENT_ID` dispersée dans 3-4 fichiers de `app/(portal)/`, pas depuis un contexte `client_members`. Le détail portail n'applique même pas la règle de visibilité reviewer (statuts + corbeille) que la liste respecte — un reviewer verrait un contenu qui ne devrait pas lui être visible.

**Secrets** : aucun. Pas de `.env` commité (vérifié : `.env*` absent, `.gitignore` + `.dockerignore` les excluent correctement). Aucun `process.env` dans le code. next.config a un hostname en dur (`images.pexels.com`) — cosmétique de démo, pas un secret.

## Findings (triés par sévérité P0 → P3)

Aucun P0 **exploitable aujourd'hui** (mocks, pas de backend). Les P1 ci-dessous sont des **failles qui s'ouvrent au premier jour du câblage si la couture n'est pas posée avant** — traités comme des pré-requis bloquants du Lot 0.

### [P1] IDOR structurelle : getters enfants non re-scopés, à câbler sur RLS+FK composites obligatoirement
- **Où** : `apps/web/lib/mocks/index.ts:59-69` (getters enfants) ; `app/(app)/clients/[clientId]/content/[contentId]/page.tsx:59-69`
- **Constat** : seule la garde parente (`content.clientId !== clientId`) protège la page ; `getComments(contentId)`/`getApprovals(contentId)`/`getContentVersions(contentId)`/`getActivityEntries(contentId)` acceptent le `contentId` brut de l'URL sans revérifier l'appartenance.
- **Scénario d'échec / coût à l'échelle** : au câblage, si ces getters deviennent de simples `select().eq('content_item_id', id)` **sans** que RLS impose le tenant, un utilisateur de l'org A lisant un `contentId` de l'org B (deviné/fuité) obtient ses commentaires et approbations. C'est l'exact scénario que CLAUDE.md §2 règle 8 impose de tester (leak test pgTAP).
- **Pourquoi ça bloque le scaling** : une fuite inter-tenant détruit la confiance produit (contenus = données des clients des freelances). La défense ne peut pas rester applicative.
- **Reco** : RLS sur 100 % des tables + FK composites `UNIQUE(id, client_id)` (une ligne fille ne peut PHYSIQUEMENT pas pointer un autre tenant) + defense in depth (filtre `org_id`/`client_id` explicite dans la façade `lib/data` EN PLUS de RLS). Leak test pgTAP pour chaque ressource enfant.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §2 règles 1-8

### [P1] Aucun middleware d'auth + matrice de protection à l'envers (préfixe `/app` inexistant)
- **Où** : `apps/web/` (aucun `middleware.ts`/`proxy.ts`) ; `lib/routes.ts:2-27` (routes à la racine) ; CLAUDE.md §9 (matcher `startsWith('/app')`)
- **Constat** : le middleware acté protège `/app/*` et `/portal`, mais les routes réelles sont `/dashboard`, `/clients/...` — le matcher ne les couvrirait pas. Et il n'existe aujourd'hui aucun middleware du tout.
- **Scénario d'échec / coût à l'échelle** : au câblage, un middleware copié tel quel de §9 laisserait `/dashboard` et `/clients/*` **accessibles sans session** (fail-open). Un utilisateur non authentifié atteindrait des Server Components qui tentent de lire des données tenant.
- **Pourquoi ça bloque le scaling** : le contrôle d'accès des routes est le premier rempart ; le poser faux dès le Lot 0 se propage à toutes les routes ajoutées ensuite.
- **Reco** : trancher le préfixe (décision D-3 du plan : réécrire le matcher pour la topologie réelle **ou** déplacer sous `/app/*`). Écrire le `proxy.ts` (Next 16) avec `updateSession` + redirections login/portail, **fail-closed** (tout ce qui n'est pas explicitement public exige une session). Route callbacks OAuth (`/api/oauth/*`) publiques mais protégées par state HMAC+PKCE.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (si option « déplacer sous /app » : les URLs changent)   **Verrou** : CLAUDE.md §9

### [P1] Isolation Reviewer non modélisée : `DEMO_REVIEWER_CLIENT_ID` au lieu d'un scoping `client_members`
- **Où** : `app/(portal)/portal/page.tsx`, `portal/[contentId]/page.tsx` (constante dispersée) ; détail portail sans règle de visibilité (`[contentId]/page.tsx:40`)
- **Constat** : le reviewer est le rôle le plus sensible (accès cloisonné à SON client uniquement, §2.6). Aujourd'hui son périmètre est une constante, et le détail n'applique pas la règle de visibilité (statuts publics + hors corbeille) que la liste respecte.
- **Scénario d'échec / coût à l'échelle** : au câblage, un reviewer du client 1 ne doit JAMAIS voir le client 2 de la même org. Sans seam `client_members` + RLS client-level, un reviewer accédant à un `contentId` d'un autre client de la même org le verrait (le portail ne re-scope pas par client accessible).
- **Pourquoi ça bloque le scaling** : c'est le cas de fuite explicitement nommé dans le leak test obligatoire (§2 règle 8 : « un Reviewer du client 1 ne voit jamais le client 2 de la même org »).
- **Reco** : seam « contexte Reviewer » résolvant les clients accessibles via `client_members` (helper `private.*` SECURITY DEFINER) ; le Reviewer = vrai user Supabase Auth possédant UNIQUEMENT des lignes `client_members` → ne passe aucune policy org-level par construction (§2.6). Appliquer la règle de visibilité (statuts + corbeille) au détail comme à la liste.
- **Effort** : M   **Impact scaling** : fort
- **⚠ Comportement** : oui (le détail portail cachera des contenus aujourd'hui visibles — correction voulue)   **Verrou** : CLAUDE.md §2.6, PRD §5.F

### [P1] Toute la couche secrets/tokens OAuth reste à construire selon le pattern deny-all — aucun garde-fou en place
- **Où** : `apps/web/` (aucune gestion de secrets), futures tables `*_secrets`, `lib/oauth/` (inexistant)
- **Constat** : la preview ne manipule aucun token (normal), mais cela signifie qu'aucun garde-fou n'existe encore : pas d'abstraction OAuth, pas de séparation service-role, pas de règle empêchant un token de transiter côté client.
- **Scénario d'échec / coût à l'échelle** : au Lot 2 (worker + OAuth Meta), un token IG/FB/TikTok qui fuiterait dans une réponse API, un log, ou un composant client = compromission du compte social d'un CLIENT. C'est la catastrophe §8 (anti-pattern explicite).
- **Pourquoi ça bloque le scaling** : chaque intégration ajoutée (Meta, TikTok, Google, Microsoft) multiplie la surface ; le pattern doit être posé une fois, correctement, avant la première intégration.
- **Reco** : tables `*_secrets` en **deny-all** (RLS activée, ZÉRO policy → service role serveur exclusivement) ; tokens agendas dans Supabase Vault ; OAuth custom via Route Handlers (jamais `linkIdentity`) derrière une abstraction `IntegrationOAuthProvider` unique ; service role key interdite dur côté client (jamais `NEXT_PUBLIC_*`) ; scrubbing Sentry des tokens ; rotation refresh sous advisory lock (TikTok/Microsoft).
- **Effort** : L   **Impact scaling** : fort
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §2 règles 11-14, §8

### [P2] SSRF : le worker devra chunker les médias (FILE_UPLOAD), jamais PULL_FROM_URL sur *.supabase.co
- **Où** : futur `apps/worker/publishers/tiktok.ts` (inexistant) ; MediaCarousel front rend `fullUrl` via next/image
- **Constat** : anticipation. TikTok/IG proposent PULL_FROM_URL ; le pointer sur une URL signée `*.supabase.co` est à la fois un risque SSRF et un anti-pattern acté (§5.6).
- **Scénario d'échec / coût à l'échelle** : PULL_FROM_URL sur une URL interne peut exposer l'infra ou casser à l'expiration de l'URL signée 48 h.
- **Reco** : FILE_UPLOAD chunké depuis le worker (§5.6) ; URL signées TTL 48 h générées à la publication uniquement ; jamais d'URL permanente d'un média non publié.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §5, règle 20-22

### [P2] Chemins storage = mécanisme d'isolation : `MediaAsset` mock ne les modélise pas
- **Où** : `lib/mocks/types/core.ts:115-130` (`thumbUrl`/`fullUrl` d'URL Pexels, pas de `storage_path`)
- **Constat** : les chemins `{org_id}/{client_id}/{content_item_id}/{asset_id}/…` sont le support des policies RLS Storage (§2 règle 21). Le mock utilise des URLs plates externes.
- **Scénario d'échec / coût à l'échelle** : au câblage média, si les chemins ne suivent pas la convention, les policies `storage.foldername()` ne peuvent pas isoler les tenants → un client accède aux médias d'un autre.
- **Reco** : `media_assets` porte `storage_path`/`thumb_path` suivant la convention de chemins ; policies storage.objects via `storage.foldername()` ; bucket `media-originals` privé (URL signées 48 h), `media-thumbs` public.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §2 règles 20-23

### [P2] IDs séquentiels/prévisibles dans les mocks → au câblage, ne jamais exposer d'ID énumérable sans RLS
- **Où** : `lib/mocks/*.ts` (IDs type `content_1`, `cl_marea`…), URLs `/clients/[clientId]/content/[contentId]`
- **Constat** : les IDs de démo sont prévisibles. En soi anodin (mock), mais le pattern d'URL expose des IDs de ressources dans le chemin.
- **Scénario d'échec / coût à l'échelle** : si le câblage repose sur des IDs séquentiels côté DB **sans** RLS stricte, l'énumération d'URL devient une IDOR. La défense n'est pas l'opacité de l'ID mais la RLS.
- **Reco** : UUID en base (déjà prévu, `org_id uuid`) ; RLS comme défense principale (pas l'imprévisibilité) ; les gardes UI (`notFound`) restent en defense in depth mais ne sont jamais la seule barrière.
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou** : CLAUDE.md §2

### [P2] Formulaires auth hors stack : pas de validation Zod, regex email maison, flow OTP incomplet
- **Où** : `app/(auth)/login/page.tsx`, `otp/page.tsx`
- **Constat** : formulaires mock sans React Hook Form + Zod (stack imposée §1), regex email artisanale, pas de transport email→OTP ni de `?next=`.
- **Scénario d'échec / coût à l'échelle** : au câblage `signInWithOtp`/`verifyOtp`, le parcours casse (pas d'email transmis à `/otp`, pas de redirection post-login) et la validation d'entrée n'est pas centralisée (contrats Zod).
- **Reco** : RHF + Zod, transport de l'email vers `/otp`, gestion `?next=` avec validation de la cible (éviter open redirect), rate limiting Supabase Auth sur l'OTP.
- **Effort** : M   **Impact scaling** : moyen
- **⚠ Comportement** : oui (le flow auth devient réel)   **Verrou** : CLAUDE.md §1

### [P3] `approvals` doit être insert-only (aucune policy UPDATE/DELETE) — le mock ne le contraint pas
- **Où** : `lib/mocks/types/collab.ts:18-26` (`Approval`) ; PRD §6 (approvals INSERT-ONLY)
- **Constat** : le snapshot d'approbation est une preuve légale/contractuelle ; il doit être immuable (§6 invariant).
- **Reco** : table `approvals` avec policies INSERT + SELECT uniquement, zéro UPDATE/DELETE ; `versionLabel` → snapshot/hash de version (piste d'audit).
- **Effort** : S   **Impact scaling** : faible
- **⚠ Comportement** : non   **Verrou** : PRD §6

## Ce qui va bien (à préserver)

- **Aucun secret commité** : `.env*` absents, correctement ignorés par `.gitignore` ET `.dockerignore` (`!**/.env.example` bien géré). Zéro `process.env` dans le code preview.
- **Image Docker non-root** : le runner tourne en utilisateur `nextjs` (uid 1001), bonne pratique.
- **Le modèle de sécurité cible est entièrement spécifié** (CLAUDE.md §2 + PRD §8) : RLS 100 %, FK composites, helpers `private`, deny-all secrets, Vault, OAuth custom. La discipline consiste à l'implémenter sans dévier — pas à le concevoir.
- **Gardes UI en defense in depth** déjà présentes sur les pages détail (`notFound` sur mismatch client) : à conserver EN PLUS de la RLS, jamais à la place.

> Rapport prospectif : la sécurité d'Ocean se joue à 100 % au moment du câblage. Le présent audit fournit la checklist des coutures à poser ; le rapport `11c` (à venir) détaille les policies RLS par famille de tables et les leak tests pgTAP.
