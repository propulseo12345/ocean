# Plan de câblage Supabase — du preview mocké au back office réel

**Date** : 2026-07-21
**État de départ** : schéma Lot 0 déployé et vérifié en ligne (`hgdeopkmkwyoumsfggrm`), app 100 % mockée.
**Point de retour** : `dbc02ed` (Pré-0 front commité), `81de8cd` (scripts de déploiement).

---

## 0. Constat — ce que « tout brancher » veut dire réellement

Cartographie croisée du code et du schéma en ligne. Trois écarts structurels, par ordre de gravité.

### 0.1 Le schéma couvre ~35 % de ce que l'UI consomme

**15 tables en ligne**, l'UI consomme ~25 entités.

| Couvert (9) | **Aucune table (16)** |
|---|---|
| `organizations`, `profiles`, `organization_members`, `clients`, `client_members`, `social_accounts`, `platform_connections`, `content_items`, `content_targets`, `notifications` | `media_assets`, `comments`, **`approvals`**, `review_requests`, `content_versions`, `activity_entries`, `brand_kits`, `content_pillars`, `hashtag_groups`, `client_events`, `recurring_slots`, `saved_views`, `post_metrics`, `imported_posts`, `calendar_accounts`, `calendar_events` |

`approvals` + `comments` = le portail de validation client, c'est-à-dire la proposition de valeur du produit. Sans ces tables, le portail reste une maquette.

Même sur les tables existantes, des champs manquent : `content_items` n'a ni `pillar_id`, ni rattachement média.

### 0.2 L'app est en lecture seule — zéro Server Action

`grep "use server"` sur `apps/web` : **aucun résultat**. Toutes les mutations de l'UI (créer un contenu, approuver, commenter, programmer, uploader) sont des `toast()` + `router.push()`. Le chemin d'écriture est entièrement à construire.

### 0.3 La démo est cassée aujourd'hui (régression connue)

Vérifié par requêtes réelles sur le serveur de dev :

```
/           → 307 → /dashboard
/dashboard  → 307 → /login      (proxy.ts : aucun cookie sb-*)
/login      → 200
```

`proxy.ts` exige un cookie `sb-*` que **rien n'écrit** (aucun client Supabase dans l'app). Les formulaires de login font `router.push("/dashboard")` → le proxy renvoie sur `/login` → **boucle**. Cette régression était déjà dans l'arbre de travail avant cette session ; elle est désormais commitée dans le Pré-0. La Phase 1 la referme.

Anomalies annexes constatées : `/otp` et `/portal` renvoient 404 (à diagnostiquer en Phase 1).

### 0.4 Deux décisions de conception à trancher

1. **Textes bilingues.** Les mocks typent les champs narratifs en `L<string>` = `{ fr, en }` (~125 fichiers consomment ces types). La DB stocke du `text` simple. Le contenu client est rédigé dans **une** langue par le freelance — le bilingue était un artifice de démo. Il faut décider : `text` simple (recommandé) et l'i18n ne porte plus que l'UI, pas les données.
2. **Modèle d'auth.** Le CLAUDE.md impose magic link / OTP. Le provider **email+password est activé** sur le projet et fonctionne (vérifié). À trancher avant d'ouvrir à des Reviewers externes.

---

## 1. Séquencement — dépendance bloquante

`packages/shared` et `supabase/` n'existent que sur `fix/lot-0-guardrails` (**PR #1, non mergée**). Tout le câblage en dépend.

> **Prérequis : merger la PR #1.** Le job CI `Database` est vert ; seul le job `Web` échoue, sur une incompatibilité `node 20` / `pnpm 11.1.2` sans rapport avec le SQL.

Branche de travail ensuite : `feat/cablage-supabase`, depuis `main` à jour.

---

## 2. Phases

### Phase 1 — Fondations (débloque tout le reste)

**But** : l'app parle à Supabase, l'auth fonctionne, la démo n'est plus cassée.

1. `pnpm add @supabase/supabase-js @supabase/ssr` dans `apps/web`.
2. `lib/supabase/server.ts` — client Server Components / Server Actions (cookies).
3. `lib/supabase/client.ts` — client navigateur.
4. `lib/supabase/admin.ts` — service role, `import "server-only"`, jamais exposé.
5. `lib/supabase/types.ts` — types générés depuis le schéma.
6. **DAL** : `lib/auth/dal.ts` avec `verifySession()` en `cache()`.
7. `lib/auth/org-context.ts` réécrit : `getActiveOrg()` lit la session réelle + valide `organization_members`, renvoie `null` si non membre. `getReviewerContext()` s'adosse à `client_members`.
8. Auth : Server Actions `signInWithOtp` / `verifyOtp` / `signOut`, route `app/(auth)/callback/route.ts`, formulaires branchés.
9. `proxy.ts` : garder le **check optimiste** (la doc Next 16 exclut explicitement le proxy comme solution de session) et corriger le fail-open sur les chemins non listés.
10. Diagnostiquer les 404 de `/otp` et `/portal`.

> **Règle d'architecture (doc Next 16)** : ne PAS vérifier l'auth dans les layouts — le Partial Rendering fait qu'ils ne re-rendent pas à la navigation. La vérification vit dans la DAL, appelée par chaque fonction de données.

**Vérification** : login réel avec `linda@socean.com` → session posée → `/dashboard` accessible → `signOut` → redirigé. Testé par requêtes, pas supposé.

---

### Phase 2 — Câbler l'existant (9 entités)

**But** : les pages qui peuvent lire du réel le font.

`lib/data/mock.ts` reste ; on ajoute `lib/data/supabase.ts` et `lib/data/index.ts` bascule fonction par fonction. Le contrat existant (`async` + `cache()` + `orgId` en 1er paramètre) est déjà le bon — il n'y a rien à réécrire côté appelants.

| Fonction | Table | Pages impactées |
|---|---|---|
| `getCurrentUser` | `profiles` | toutes |
| `getClients` / `getClient` | `clients` | 17 pages |
| `getContentItems` / `getContentItem` / `getTrashedContent` | `content_items` | 10 pages |
| `getSocialAccounts` | `social_accounts` | 12 pages |
| `getNotifications` / `getUnreadCount` | `notifications` + RPC `mark_notification_read` | 3 pages |
| `getReviewer` | `client_members` + `profiles` | 6 pages |
| `getShellSnapshot` | agrégat | layout `(app)` |

**Vérification** : chaque page rendue avec de vraies données, RLS active, et un test de fuite inter-tenant (créer une 2ᵉ org, vérifier l'isolation).

---

### Phase 3 — Étendre le schéma (16 tables) ⚠️ décision requise

**Ampleur comparable au Lot 0 qu'on vient de livrer.** Chaque table exige : `org_id` dénormalisé + `client_id`, FK composites, RLS + policies, leak test pgTAP, passage `get_advisors`.

Découpage proposé par valeur décroissante :

| Lot | Tables | Débloque |
|---|---|---|
| **3a** | `media_assets`, `content_item_media` | Studio, Librairie, Grille — **le plus structurant** (specs IG, buckets, URLs signées) |
| **3b** | `approvals`, `comments`, `review_requests` | **Le portail client** — proposition de valeur |
| **3c** | `content_pillars`, `brand_kits`, `hashtag_groups`, `recurring_slots`, `saved_views` | Configuration client, composer |
| **3d** | `content_versions`, `activity_entries` | Historique studio |
| **3e** | `client_events`, `calendar_accounts`, `calendar_events` | Calendrier éditorial, agenda unifié |
| **3f** | `imported_posts`, `post_metrics` | Grille feed, Performance |

Le 3a impose aussi les buckets Storage (`media-originals` privé, `media-thumbs` public) et les policies `storage.objects` — c'est un chantier à part entière.

---

### Phase 4 — Câbler le reste

Même méthode que la Phase 2, sur les tables de la Phase 3, dans le même ordre (3a → 3f).

À traiter au passage : les 3 fichiers de `components/app/performance/` qui **contournent `lib/data`** et lisent `@/lib/mocks` en synchrone (`perf-data.ts`, `perf-breakdown.ts`, `report-data.ts`).

---

### Phase 5 — Chemins d'écriture (Server Actions)

Aujourd'hui inexistants. Chaque action suit le pattern CLAUDE.md §7 : `getActiveOrg()` → contrôle de rôle → parse Zod → injection `org_id` → `revalidatePath`.

Surface minimale : créer / éditer / supprimer un contenu, programmer, demander une revue, approuver, demander des modifications, commenter, uploader un média, connecter un compte, inviter un reviewer, `switchOrg`, marquer une notification lue (RPC déjà en place).

> Rappel garde-fou : la migration 008 interdit à `authenticated` de poser `publishing`/`published`/`failed`, et `content_items_insert` impose la naissance en `idea`/`draft`. Les Server Actions doivent respecter la matrice de transition, pas la contourner.

---

### Phase 6 — Vérification de bout en bout

- Parcours réels : login → dashboard → client → contenu → programmation → portail → approbation.
- Test de fuite inter-tenant applicatif (2 orgs, 2 users).
- `get_advisors` en ligne après chaque migration.
- pgTAP étendu à chaque nouvelle table.
- Purge des mocks résiduels.

---

## 3. Ce qui n'est PAS dans ce plan

Worker de publication (Lot 2), OAuth plateformes (Lot 1), Brevo, PWA/push, Skills (Lot 5), Stripe. Ce plan s'arrête au back office fonctionnel sur données réelles.

---

## 4. Ordre d'exécution recommandé

1. Merger la PR #1.
2. **Phase 1** — fondations + auth. Sans elle, rien d'autre n'est testable.
3. **Phase 2** — câbler les 9 entités existantes.
4. Trancher les deux décisions du §0.4.
5. **Phase 3a** (médias) puis **3b** (portail) — les deux lots à plus forte valeur.
6. Phases 4 → 6 en suivant.
