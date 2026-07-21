# PLAN DE NUIT — Câblage Supabase Ocean, Phases 8→11 (autonomie complète)

> Écrit le 2026-07-21 pour une **session fraîche** (le contexte de la session
> précédente était saturé). Objectif : exécuter les 4 dernières phases du
> câblage **sans t'arrêter entre les phases**, temps et tokens illimités, avec
> une **boucle de vérification + commit après chaque phase**.
>
> Étienne DORT pendant l'exécution. Il a donné feu vert explicite aux 4 phases et
> a choisi la vérification runtime **« créer puis supprimer »** (voir §Runtime).

---

## 0. DÉMARRAGE — lis dans cet ordre, EN ENTIER, avant tout code

1. `CLAUDE.md` (racine) + `apps/web/AGENTS.md` — **Next 16 ≠ ton training** : lis
   `apps/web/node_modules/next/dist/docs/` avant tout code Next.
2. `.planning/SESSION.md` — état complet, tous les pièges déjà payés.
3. `.planning/PROGRESS_cablage-supabase.md` — la méthode invariante par phase.
4. **CE fichier** — le plan des 4 phases restantes.
5. `docs/superpowers/plans/2026-07-21-cablage-supabase-PLAN-DETAILLE.md` — le
   plan d'origine (référence : décisions D1–D11, phases, risques).
6. `docs/superpowers/audits/2026-07-21-cablage/*.json` — specs colonnes exactes.

## 1. ÉTAT AU DÉMARRAGE (vérifié)

- Branche `feat/cablage-supabase` @ `1a8db10`. **Rien n'est poussé, aucune PR
  mergée** (décision actée : on merge à la fin, jamais avant).
- **Migrations 010→016 EN LIGNE** (Étienne les a appliquées) + `deploy/09_seed_demo.sql`
  appliqué. Projet Supabase en ligne : `hgdeopkmkwyoumsfggrm`. **Vérifié au
  runtime** : dashboard + détail contenu rendent du réel.
- **Phases 1→7 faites et vérifiées.** pgTAP 003→016 + 090 + 091 = **231/231**
  (218 + 13 de 091), plan == émis sur 16 fichiers. Typecheck 0. Build vert.
- **Phase 8 partiellement faite** : `lib/actions/content.ts` (saveContentItem,
  scheduleContentItem, trash/restore) écrit + testé (pgTAP 091). **Il RESTE à
  brancher ces actions à l'UI** (composer, board, calendrier, corbeille).

## 2. RÈGLES NON NÉGOCIABLES (rappel — ne pas re-litiger)

- **Décisions actées** : auth = MOT DE PASSE uniquement ; D1 = contenu `text`
  monolingue FR (fait Phase 7) ; D4 = `client_settings` org-only ; **on MERGE À
  LA FIN** (ne pousse pas, ne merge aucune PR).
- **Vérifie TOUT par exécution, jamais par supposition.** Un test vert issu d'un
  run vide n'est pas vert : **vérifie toujours `plan == tests émis`** (piège payé
  3 fois). Compte `grep -c "^ ok "` == le nombre du `plan(N)`.
- **Multi-tenant** : toute nouvelle table → `org_id` dénormalisé + FK composites
  + RLS + leak test pgTAP + `revoke all` GUARD-05 + `is_reviewer_visible_content`
  sur les tables filles de contenu. (Phases 8→11 ne créent PAS de table — que
  des actions + du câblage UI. Si tu en crées une, applique tout ça.)
- **MCP Supabase sur un AUTRE compte** (il ne voit que les projets *Coproflex*) :
  tu ne peux PAS appliquer de migration ni lancer `get_advisors` en ligne. Génère
  les scripts `deploy/` et signale-les à Étienne.
- **Ne tue PAS les serveurs dev d'autres projets.** Ocean = PORT **3010**. Un
  serveur dev Ocean tourne peut-être déjà sur 3010 (le réutiliser, ne pas en
  relancer un — `EADDRINUSE` = il tourne déjà, tant mieux).
- **Mets à jour `.planning/SESSION.md` ET `PROGRESS_cablage-supabase.md` à chaque
  phase terminée**, + commit par phase.

## 3. BOUCLE DE VÉRIFICATION — après CHAQUE phase, dans l'ordre

1. `pnpm --filter web exec tsc --noEmit` → **0 erreur** (le vrai code de sortie ;
   sur Windows le tool peut afficher vide, relance et lis `echo TSC=$?`).
2. Si migration/action touchant la DB : **pgTAP** via
   `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"; export MSYS_NO_PATHCONV=1`
   puis `bash scripts/run-pgtap.sh 016 <tests...>`. Le conteneur `ocean_rev2`
   doit tourner (`docker ps`). Recopier migrations+tests d'abord :
   `docker exec ocean_rev2 rm -rf /tmp/migrations /tmp/tests && docker cp supabase/migrations ocean_rev2:/tmp/migrations && docker cp supabase/tests ocean_rev2:/tmp/tests`.
   **Vérifier plan == émis** (voir §2).
3. `pnpm --filter web build` → vert (attrape ce que tsc rate).
4. **Runtime Playwright** (create-verify-delete, voir §Runtime).
5. `npx biome check --write <SEULEMENT tes fichiers>` — **JAMAIS `biome check`
   sur tout le repo** (piège : reformate 319 fichiers, virgules traînantes).
   Pour retirer des imports morts, script Python ciblé, pas le formateur global.
6. Commit de la phase (message détaillé, factuel, preuves par exécution).
7. MAJ `SESSION.md` + `PROGRESS`. Commit docs.

## 4. RUNTIME (choix d'Étienne : « créer puis supprimer »)

- Serveur dev sur **3010** connecté au vrai projet en ligne (via
  `apps/web/.env.local`, déjà pointé sur `hgdeopkmkwyoumsfggrm`). Session déjà
  ouverte comme `linda@socean.com` (owner de l'org `socean`, mot de passe
  `Password` si reconnexion nécessaire).
- **Vérifie chaque écriture au runtime PUIS nettoie les lignes de test** que tu
  crées (supprime le contenu créé, etc.). Quelques résidus possibles → les
  **signaler** dans le rapport final.
- Playwright MCP : `mcp__playwright__browser_navigate` / `browser_snapshot` /
  `browser_click` / `browser_fill_form`. Toggle langue = bouton
  `aria-label="Passer en English"` / `"Switch to Français"`.
- **⚠️ Horloge gelée jusqu'à la Phase 11** : `lib/clock.ts` renvoie `MOCK_NOW`
  (11 juin 2026). Le seed date par rapport au vrai `now()` (21 juil). Donc
  « 0 à publier aujourd'hui » sur le dashboard est NORMAL avant le dégel — ne pas
  le prendre pour un bug.

---

## PHASE 8 (reste : 2/2) — Brancher les écritures cœur à l'UI · **L**

**Les Server Actions existent déjà** (`lib/actions/content.ts`, commit `1a8db10`,
pgTAP 091 vert). Il ne reste QUE le câblage UI.

### 8.1 — Composer → `saveContentItem`
- Fichier : `components/app/studio/composer/composer-screen.tsx`, `handleSave`
  (ligne ~135) qui fait aujourd'hui `toast + router.push`.
- Construire le `SaveContentPayload` depuis le `draft` (le type est exporté par
  `lib/actions/content.ts`). Mapping : `draft.media` → ne garder que ceux avec
  `libraryAssetId` (les autres = uploads frais non persistables, TUS non câblé →
  les ignorer, et afficher un toast « média non encore uploadé ignoré » si au
  moins un est écarté). `contentId` = `initialContent?.id` (édition) ou absent
  (création).
- `handleSave` devient async : appelle l'action, gère `{ ok }`, toast succès/
  erreur, `router.push(routes.clientContent(client.id))` + `router.refresh()`.
- Le composer est un Client Component → importer l'action serveur directement
  (Next 16 : `import { saveContentItem } from "@/lib/actions/content"`).
- **Piège** : `draftFromContent` réinjecte les hashtags dans la légende ;
  `splitCaption` (dans l'action) les re-sépare. Vérifier le round-trip : créer un
  contenu avec « Texte #promo », recharger l'édition → caption = « Texte »,
  hashtags = [promo], et la légende ré-affichée = « Texte\n\n#promo ». Pas de
  double #.

### 8.2 — Board studio → `applyStatusIntent`
- `components/app/studio/board-state.ts` applique aujourd'hui des overrides
  LOCAUX (`setStatusOverrides`). `board-kanban.tsx` appelle `board.setStatusBatch`.
- Remplacer les mutations de statut par un appel à `applyStatusIntent`
  (`lib/actions/content-status.ts`, déjà écrite Phase 6). Le kanban connaît déjà
  l'intention (via `canApplyIntent`) — mapper la colonne cible → `StatusIntent`
  (`in_review`→`send_to_review`, `draft`→`back_to_draft`, `idea`→`back_to_idea`,
  `scheduled`→`schedule`, `approved`→`approve`). Optimiste + `router.refresh()`.
- **Ne PAS** casser le comportement optimiste (l'UX drag doit rester fluide) :
  garder l'override local ET persister en arrière-plan ; rollback si l'action
  échoue.

### 8.3 — Calendrier → `scheduleContentItem`
- `components/app/calendar/calendar-actions.ts` (`performDrop`, `performReschedule`,
  `performShift`, `performUnschedule`) = overrides locaux + toast « (aperçu) ».
- Persister via `scheduleContentItem` (nouvelle date ISO). `isMovable` gouverne
  déjà quels statuts sont déplaçables (verrous). Garder l'override optimiste,
  persister, rollback sur échec.
- La programmation qui CHANGE le statut (draft→scheduled) passe par
  `applyStatusIntent('schedule', …)` PUIS `scheduleContentItem` pour la date.

### 8.4 — Corbeille → `trashContent` / `restoreContent`
- `components/app/studio/content-actions.tsx` (bouton supprimer) et
  `components/app/client-settings/trash-list.tsx` (restaurer).

### Vérif Phase 8
- pgTAP 091 déjà vert (garde des écritures).
- **Runtime create-verify-delete** : dans le composer d'un client, créer un
  brouillon « TEST NUIT » → recharger la liste studio → il apparaît → l'ouvrir →
  champs corrects → le mettre à la corbeille → il disparaît → **le supprimer
  définitivement** (ou le laisser en corbeille et le noter). Drag board d'un
  contenu draft→in_review → vérifier le statut changé en base (relire la page).
- Commit « Phase 8 (2/2) — câblage UI des écritures ».

---

## PHASE 9 — Câblage UI des actions déjà écrites · **M**

Tout est écrit côté actions ; presque rien n'est branché.

### 9.1 — Phase 6 RPC
- `components/app/studio/detail-manual-center.tsx` : le bouton **« Publié »**
  (marquer publié manuellement) → `markTargetPublishedManually` (avec le lien
  optionnel saisi). Le bouton **retry** d'une cible en échec → `requestTargetRetry`.
  (Actions dans `lib/actions/content-status.ts`.)

### 9.2 — Portail Reviewer
- `components/portal/review-actions.tsx` : Approuver / Demander des modifs →
  `submitReviewDecision` (`lib/actions/collaboration.ts`). C'est le cœur du
  produit (validation client) — actuellement un simple toast.
- `components/portal/annotation-viewer.tsx` + le thread : commentaires →
  `postComment`. Annotations (x/y sur un média) → `postComment` avec
  `annotationContentMediaId` + `annotationX/Y` (voir la signature de l'action).
- **Vérif runtime du portail = impossible sans compte reviewer** (aucun n'est
  seedé : il faut `auth.users` + `client_members`). → Vérifier par **pgTAP**
  (013 couvre déjà submit_review_decision + anti-fuite) + typecheck + build.
  **Ne PAS créer de compte reviewer en ligne sans décision d'Étienne** (invitation
  = email Brevo, exclu). Laisser la vérif visuelle du portail à Étienne.

### 9.3 — Médias
- Médiathèque + composer : `attachMedia` / `deleteAsset` / `updateAssetAlt`
  (`lib/actions/media.ts`). L'upload FICHIER (TUS) reste exclu — mais attacher un
  asset EXISTANT et éditer l'alt/supprimer sont câblables.
- **Note** : le seed ne contient AUCUN média (pas de fichier Storage). Donc la
  médiathèque est vide en ligne → runtime limité. Vérifier le câblage par
  typecheck + build ; runtime possible seulement si Étienne uploade des assets.

### Vérif Phase 9
- pgTAP existant (013) + typecheck + build. Runtime là où c'est possible
  (manual-center sur le contenu TikTok seedé « Recette express »). Commit.

---

## PHASE 10 — Performance réelle & dettes de lecture · **M**

### 10.1 — perf-data / perf-breakdown / report-data en async + orgId
- `components/app/performance/{perf-data,perf-breakdown,report-data}.ts`
  importent `@/lib/mocks` en **synchrone** (contournent la façade). Les passer
  async + `orgId`, lire les vraies `getPostMetrics`/`getTopPosts`/`getContentItems`
  (déjà câblés dans `lib/data`).
- **SUPPRIMER `PERIOD_FACTOR` et `DELTA_SHAPE`** (perf-data.ts) : ce sont des
  deltas **INVENTÉS** affichés dans un rapport destiné au client final —
  malhonnête. Soit calculer un vrai delta (période N vs N-1 depuis `post_metrics`),
  soit afficher « — » / « non disponible ». **Ne jamais persister un delta inventé.**
- `reach` nullable → propager « non disponible » proprement.

### 10.2 — N+1 de la grille
- La grille appelle `getPostMetrics` une fois PAR tuile. `lib/data/pro.ts`
  `getPostMetrics(orgId, refId)` = 1 requête/appel. Ajouter un
  `getPostMetricsBatch(orgId, refIds[])` (une requête `in(...)`) et l'utiliser
  dans `grid/page.tsx`.

### 10.3 — saved_views labels par id
- Dette : `saved_views.filters.labels` reçoit des `label_ids` (uuid) mais
  `board-utils` matche encore par NOM. Corriger `matchesFilters` pour matcher par
  `content_label_id`. (Le contenu porte des labels par NOM côté front après
  Phase 7 — il faudra peut-être résoudre nom↔id ; voir `getContentItems` qui
  charge `labels` comme noms. Décider : soit exposer les label_ids sur le
  ContentItem, soit résoudre les vues par nom. **Trancher au moment voulu, noter
  la décision.**)

### Vérif Phase 10
- Build + runtime (page performance d'un client rend depuis `post_metrics` ;
  `grep "@/lib/mocks" components/app/performance/perf-data.ts` = 0). **Attention** :
  le seed ne pose PAS de `post_metrics` (écriture service_role exclusive) → la
  page perf sera VIDE en ligne, c'est normal ; vérifier qu'elle ne CRASHE pas et
  n'affiche pas de deltas inventés. Commit.

---

## PHASE 11 (DERNIÈRE) — Dégel de l'horloge & suppression des mocks · **M**

À faire EN DERNIER (rien ne doit plus dépendre des mocks).

### 11.1 — Dégel `lib/clock.ts`
- Remplacer `MOCK_NOW` par un vrai `now()` : `export function now() { return new Date() }`
  et `nowIso()` idem. **C'est ce dégel qui rend « aujourd'hui » correct** (le
  dashboard seedé montrera enfin les publications du jour).
- 5+ composants importent `fromNow/hours/days/MOCK_NOW` depuis `lib/mocks/time` :
  les faire pointer vers `lib/clock` (ou déplacer ces helpers hors des mocks).

### 11.2 — Relocaliser les types domaine
- `lib/mocks/types/{core,collab,library,pro,index}.ts` → `lib/domain/` (les types
  domaine ne doivent plus vivre sous `mocks`). Mettre à jour tous les
  `from "@/lib/mocks/types"` → `from "@/lib/domain"` (script sed ciblé).

### 11.3 — Supprimer `lib/mocks/**`
- Après relocalisation des types : plus rien ne doit importer `@/lib/mocks`
  (`grep -rl "@/lib/mocks"` = 0 hors types déplacés). Supprimer le dossier.
- **`loc` disparaît avec** (son dernier appelant = les mocks) : retirer
  `loc` de `lib/i18n/localized.ts` et de l'export `lib/i18n/index.ts`. Le fichier
  `localized.ts` peut être supprimé entièrement.
- Retirer `Client.theme` du type + `lib/mocks/images` + le `themeFor()` de
  `lib/data/clients.ts` et `use-library-assets.ts` (dérivé par hash aujourd'hui).
- Retirer le bandeau « Mode démo » statique (`components/app/shell/demo-banner.tsx`)
  si plus pertinent (à confirmer — c'est visuel, décision légère).
- Supprimer `apps/web/__tz_repro.mjs` (débug non commité).

### Vérif Phase 11
- **Suite pgTAP complète** (003→016 + 090 + 091) plan == émis, tous verts.
- Typecheck 0, build vert.
- **Runtime après dégel** : dashboard montre « à publier aujourd'hui » cohérent
  avec la vraie date ; toggle EN OK ; pas de crash.
- `get_advisors` : **à faire faire par Étienne** (MCP autre compte) — le noter
  dans le rapport final comme action ouverte.
- Commit. MAJ finale SESSION + PROGRESS : **câblage Supabase TERMINÉ** (l'UI ne
  consomme QUE Supabase).

---

## 5. EXCLU DE L'AUTONOMIE — handoff Étienne (NE PAS tenter la nuit)

Impossible à vérifier de nuit / nécessite secrets, comptes externes, décisions :

- **Upload TUS + conversion JPEG/HEIC + vignette WebP** (crypto client + Storage,
  chunks 6 MB). Sans lui, la médiathèque reste vide en ligne.
- **Emails Brevo** (clé API + templates : reviewer-invitation, review-requested,
  publish-failed…).
- **OAuth Meta / TikTok / Google / Microsoft + worker de publication** (Vault,
  credentials d'app, advisory locks). C'est le Lot 2+ du PRD, hors câblage.
- **Route Handler d'acceptation d'invitation** (dépend de la décision D8/D9 +
  email Brevo).
- **`get_advisors` + régénération de `types.ts`** (MCP sur autre compte —
  `types.ts` est maintenu À LA MAIN ; si tu ajoutes des colonnes, mets-le à jour
  à la main comme fait jusqu'ici).

## 6. SI TU ES BLOQUÉ (décision non actée / dépendance externe)

**Ne devine pas.** Arrête-toi sur ce point précis, laisse-le dans une liste
« À TRANCHER » en tête de SESSION.md, et **continue sur le reste de la phase / la
phase suivante** si c'est indépendant. Ne bloque jamais toute la nuit sur un seul
point tranchable au réveil.

Décisions déjà pré-actées (ne pas re-demander) : D2 (chemin Storage sans
content_item_id) et D3 (media-thumbs public) — **déjà appliquées en ligne**
(deploy/05 est passé), donc closes.

## 7. PIÈGES DÉJÀ PAYÉS (ne pas les redécouvrir)

- **`biome check --write` global reformate 319 fichiers** (virgules traînantes,
  reflow) → interdit. Cibler les fichiers ; imports morts par script Python.
- **pgTAP** : pas de CTE data-modifying dans un `is()`/`results_eq()` scalaire
  (« WITH clause … must be at the top level »). Pour tester une écriture RLS
  no-op, faire l'update sous le rôle (lives_ok) puis **relire sous l'owner** que
  la valeur est INCHANGÉE.
- **Toujours `plan == émis`** (compté 3 fois de travers).
- **Docker hors PATH** : `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"`
  + `export MSYS_NO_PATHCONV=1`. `docker cp` imbrique si la cible existe → `rm -rf`
  d'abord. Le runner saute les `*_storage.sql` (schéma storage ancien du conteneur).
- **types.ts maintenu à la main** : des colonnes à défaut DB peuvent y être
  marquées requises dans `Insert` (corrigé pour content_labels/content_item_labels
  au commit 1a8db10). Si un `.insert()` râle sur une colonne à défaut, la passer
  optionnelle dans `Insert`.
- **`loc` existe encore** (réduit à `loc(fr,_en)=>fr`) UNIQUEMENT pour les mocks
  → il meurt en Phase 11 avec eux. Le code permanent n'en dépend plus.
- **CRLF Windows** : `autocrlf=true` → git warne « LF will be replaced by CRLF ».
  Environnemental, le CI Linux passe. Ne pas « corriger » en reformatant.

## 8. DÉFINITION DE FINI (câblage Supabase terminé)

- Les 4 phases committées, chacune vérifiée par exécution.
- `grep -rl "@/lib/mocks" apps/web` = 0 (hors éventuel résidu documenté).
- Suite pgTAP complète verte, plan == émis partout.
- Typecheck 0, build vert, runtime OK après dégel.
- SESSION.md + PROGRESS à jour. Rapport final listant : ce qui est fait, les
  résidus runtime non nettoyés, les actions ouvertes pour Étienne (get_advisors,
  TUS, Brevo, OAuth), les décisions prises seul (le cas échéant).
- **NE PAS pousser, NE PAS merger.** Laisser la branche prête pour qu'Étienne
  merge au réveil.
