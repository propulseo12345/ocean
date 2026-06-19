# Plan d'implémentation — Audit pages client (113 features)

> Source : docs/AUDIT-PAGES-CLIENT.md (audit du 2026-06-11).
> Contexte : **phase preview front UI-only, données mockées** — zéro backend, zéro Supabase.
> Objectif : implémenter les 113 features retenues, rendu professionnel, par vagues à périmètres disjoints.
> Contraintes : TS strict, zéro `any`, fichiers ≤ 250 lignes, zéro couleur hardcodée (tokens oklch/var),
> Server Components par défaut, UI 100% FR, Biome, Next.js 16 (lire node_modules/next/dist/docs/ si doute).

## État d'avancement (mis à jour 2026-06-11, fin de session 1)

- [x] **Vague 1 — Fondation** : FAIT + vérifié (tsc/biome/build verts). Contrat gelé. Rapport : types/ dir (core/collab/library/pro), 9 nouveaux datasets, lib/{specs,caption,marronniers}.ts, hooks/use-multi-select, 5 primitives shared (status-dot, quota-gauge, account-alert, selection-bar, spec-issues), routes + client-tabs étendus (Médiathèque/Performance/Réglages).
- [x] **Vague 2 — Pages cœur** : FAIT + vérifié (tsc/biome/next build verts). Composer 12/12 features (pages content/new + content/[id]/edit + components/app/studio/composer/), Grille 26/26 (22 nouveaux fichiers grid/), Calendrier 25/25 (22 nouveaux fichiers calendar/).
- [x] **Vague 3 — Studio détail/board + surfaces** : FAIT + vérifié (tsc OK, biome 245 fichiers clean, next build vert — 20 routes dont /ideas et /library). Détail 12/12 (detail-*), Board 10/10 (board-* + page /ideas), Médiathèque 7/7 (page /library + components/app/library/), Shell 6/6 (components/app/shell/ : palette ⌘K, FAB capture, assistant PWA, bandeau santé, raccourcis ?, switcher contextuel).
- [x] **Vague 4 — Modules périphériques** : FAIT + vérifié (tsc+biome+next build verts, 23 routes). C1 Performance+Rapport (perf-* + report-* ; graphes CSS pur, honnêteté API), C2 Onboarding wizard 5 étapes (/clients/new), C3 Réglages client (brand kit, approvalMode, créneaux récurrents, cadence, archivage+corbeille).
- [x] **Vague 5 — QA finale** : FAIT. Fixes directs (query params composer date/time/media + lien médiathèque ?media= ; harmonisation tutoiement — "vous" gardé seulement pour portail/rapport/reviewer). Revue de correction par 4 code-reviewers (aucun bug bloquant, fondation saine). Fixes appliqués par 3 agents : cohérence couleur statut (changes_requested→danger partout, suppression de l'override grille local), dérive DST sur décalage par lot, factorisation TZ (lib/tz.ts), double # à l'édition, idées à pilier inconnu, bypass validation wizard, chevauchement top/flop perf, period count, client archivé→404, durcissements divers. Nettoyage : Date.now()→compteurs stables, feed-grid <250 lignes. **Build final vert, 23 routes, tsc 0 erreur, biome clean, aucun fichier applicatif >250 lignes, zéro any, zéro Date.now au rendu.**

**TOUTES LES VAGUES TERMINÉES.** Backups : .planning/audit-impl/backups/wave{1-5}-src.tgz. Rien n'est commité en git (à proposer à Étienne).

### Notes de reprise (session suivante)
- Backups sources : `.planning/audit-impl/backups/wave{1,2,3}-src.tgz` (tar des dossiers app/components/lib/hooks de apps/web). RIEN n'est commité en git (l'utilisateur n'a pas demandé de commit — à proposer).
- Manques de fondation signalés par les agents (à traiter en Vague 5 ou plus tard, fondation gelée pendant les vagues) :
  - Helper TZ « heure murale client → UTC » dupliqué dans composer-utils.ts ET calendar-schedule.ts → à remonter dans lib/ en Vague 5.
  - `lastError` global au ContentItem (pas par cible) ; `awaiting_manual` jamais produit par les mocks ; pas de `ReviewRequest.remindersSentAt[]` ; `SavedView` sans champ sort ; `LibraryAsset` sans name/tags ; `ImportedPost` sans mediaCount/caption ; aucun mock `publishing` ciblant IG ; hashtags mockés incohérents (# inline vs séparé) ; composer n'accepte pas `?media=` (présélection médiathèque) ni `?date=`/`?time=` (le calendrier envoie ces query params vers content/new !) — À VÉRIFIER/CÂBLER en Vague 5.
  - `contentStatusMeta` : même ton warning pour in_review/changes_requested/partially_published → la grille a un override local `gridStatusTone` ; envisager d'enrichir labels.ts en V5.
  - `canceled` réintégré dans la grille (l'audit recommandait de l'exclure) → à arbitrer.
- Tons/copy : vérifier la cohérence tutoiement/vouvoiement entre les surfaces des différents agents (Vague 5).
- Agents réutilisables via SendMessage : fondation ab65ed7317dc00ba1 · composer ae02b87007b562442 · grille a72548dd692453426 · calendrier a24558f214ea6f6a3 · détail a4bd83b96bbbdb52a · board a3e208866798bce8b · médiathèque a6f2bd9e0b1564ae4 · shell a67f81bcfabee57b9 (valables uniquement dans la session d'origine).

## Vague 1 — Fondation (contrat gelé pour les vagues suivantes)

Restructurer `lib/mocks/types.ts` → `lib/mocks/types/{core,collab,library,pro}.ts` + `types/index.ts` (compat `./types`).

Nouveaux types + données mockées réalistes FR :
- `ContentTarget.captionOverride?` (déclinaison par plateforme) · `ContentItem.firstComment?` (1er commentaire IG)
- `ContentItem` : `pillarId?`, `pinned?`, `excludeFromGrid?` (reel hors grille), `coverUrl?` (cover Reel), `deletedAt?` (corbeille), `labels?: string[]`
- `MediaAsset.altText?`
- `HashtagGroup` {id, clientId, name, tags[]} — 2-3 groupes par client
- `LibraryAsset` (médiathèque) {id, clientId, type, thumb/full, dims, uploadedAt, source: upload|depot_client|import, usedInContentIds[], altText?} — ~10/client
- `ContentVersion` {id, contentId, label, caption, note, createdAt} — historique sur 2-3 contenus
- `ActivityEntry` {id, contentId, at, actorName, kind, detail} — journal sur 3-4 contenus
- `ContentPillar` {id, clientId, name, colorVar, targetShare} — 3-4 piliers/client
- `ClientEvent` {id, clientId, date, title, kind: note|event} — notes calendrier client
- `RecurringSlot` {id, clientId, weekday, time, platforms[], pillarId?}
- `BrandKit` {clientId, palette[], tone, doList[], dontList[], bannedWords[]}
- `SavedView` {id, clientId, name, filters} (studio)
- `PostMetrics` {refId (content|imported), likes, comments, reach, saves} — pour Performance + « recycler un top post »
- `ImportedPost` : + metrics inline, + `pinned?`
- `Client` : + `approvalMode: 'required'|'optional'|'auto'`, + `notes?`
- `QuotaUsage` helper `getQuotaUsage(accountId)` → {used, limit, windowLabel} (IG 100/24h, FB Reels 30/24h, TikTok 5 brouillons/24h) calculé depuis les mocks

Nouveaux helpers/libs :
- `lib/specs.ts` — specs plateformes (ratios IG 4:5–1.91:1, JPEG ≤8MB, Reels 3s–15min ≤300MB, carrousel ≤10 IG…) + `validateMedia(asset, platform, format)` → SpecIssue[]
- `lib/caption.ts` — compteurs (IG 2200, coupure «… plus» ~125, FB, TikTok 2200), détection mots interdits (garde-fous brand kit)
- `lib/marronniers.ts` — ~30 dates FR 2026 (fériés, fêtes, soldes, événements marketing) {date, label, kind}
- `hooks/use-multi-select.ts` — sélection multiple générique
- `lib/mocks/labels.ts` — étendre : statusMeta complet (tone+label par ContentStatus/TargetStatus), pillarMeta

Primitives UI partagées (components/shared/) :
- `status-dot.tsx` (pastille statut, tailles sm/md, tooltip)
- `quota-gauge.tsx` (jauge quota plateforme)
- `account-alert.tsx` (bandeau needs_reauth/expired, variante inline + bannière)
- `selection-bar.tsx` (barre flottante d'actions par lot, slot d'actions)
- `spec-issues.tsx` (liste d'avertissements specs média)

Routes (lib/routes.ts) : `clientLibrary`, `clientIdeas`, `clientPerformance`, `clientSettings`, `clientNew` (= /clients/new), `clientReport`.
ClientTabs : + Médiathèque, + Performance, + Réglages (scrollable).

## Vague 2 — 3 agents parallèles (fichiers disjoints)

### Agent A1 — Composer studio (P0 le plus structurant)
Fichiers : `components/app/studio/composer/**` (NOUVEAU dossier) + `app/(app)/clients/[clientId]/content/page.tsx` (uniquement brancher le bouton) + `components/app/studio/composer-launcher.tsx`.
Features : Composer création/édition (sheet/dialog plein écran : titre, légende, formats, médias mockés depuis médiathèque, ciblage plateformes) · Compteurs caractères + ligne «… plus» · Programmation outillée (dialog date/heure TZ client + rattrapage retard) · Éditeur carrousel (réordonnancement dnd + limites API 10 IG) · Validation specs à l'upload (lib/specs) · Légendes déclinées par plateforme (onglets) · Groupes hashtags + 1er commentaire IG · Garde-fous de légende (mots interdits brand kit) · Pré-flight de programmation (checklist conformité) · Options avancées par plateforme · Recadrage guidé (mock UI crop 3 ratios) · Alt text par média.

### Agent A2 — Grille feed
Fichiers : `app/.../grid/page.tsx` + `components/app/grid/**`.
Features : ratio 3:4 (toggle 1:1/3:4) · pastilles statut · échecs/publishing visibles · alerte reconnexion · confirmation permutations + annuler · drag étagère→grille · long-press tactile · fiche express (hover-card) · pastilles multi-plateformes · séparateur « Aujourd'hui » · jauge quota IG · posts épinglés simulés · reel hors grille · filtres + mode « rendu final » · multi-sélection + lot · placeholders par pilier · insérer créneau · demande validation grille entière (mock toast + état) · comparateur covers Reel · bac à sable masquer/réinitialiser · onglet Reels · analyse colorimétrique (mock palette) · mode présentation cadre iPhone · client fictif avant-vente · recycler top post · sync feed IG existant (mock bouton + état sync).

### Agent A3 — Calendrier éditorial
Fichiers : `app/.../calendar/page.tsx` + `components/app/calendar/**`.
Features : création préremplie depuis case · drag replanification (avec règles : verrouiller publiés) · panneau Jour (fix +N autres) · filtres statut/plateforme/format · statuts lisibles + légende · échecs + re-essai · alerte compte · mois condensé mobile + gestes · étagère « À planifier » · aperçu rapide (popover) · pilotage validation · marronniers FR overlay (toggle) · événements/notes client · multi-sélection + lot (décaler semaine) · miniatures dans cases · quotas/densité par jour · trous de cadence · dupliquer vers date/client · piliers + jauge de mix · canaux manuels différenciés · export PDF (mock print stylé) · navigation rapide + mémoire de vue · traitement visuel du passé · règles d'automatisation par client (dialog mock) · file evergreen (mock).

## Vague 3 — 4 agents parallèles

### Agent B1 — Studio détail (`[contentId]/page.tsx` + studio/{content-review-panel,content-targets,content-actions,content-detail-media}.tsx + nouveaux composants détail)
Annotations client dans le studio · fil interne/client (onglets) + résolution · cibles reliées aux comptes + alerte · erreur + relance par cible · centre publication manuelle (TikTok/Stories/newsletter : checklist, copier légende, marquer publié) · historique versions + diff · journal d'activité · duplication vers autre client · publication manuelle assistée (awaiting_manual) · choix cover Reel · aperçu natif pixel-perfect (IG/FB) · état validation visible.

### Agent B2 — Studio board (`content/page.tsx` + content-board/content-card)
Recherche/tri/vues enregistrées · multi-sélection + actions lot · envoi en revue groupé avec suivi · kanban de production (toggle vue) · étiquettes transverses · jauges quotas · statut validation visible · banque d'idées (onglet/filtre idea) · relances validation.

### Agent B3 — Médiathèque + dépôt client (`app/.../library/page.tsx` NOUVEAU + components/app/library/**)
Médiathèque par client (grille assets, statut utilisé/inédit, recherche, tags, alt text) · lien de dépôt médias client (mock dialog lien partageable) · import depuis médiathèque (contrat pour composer).

### Agent B4 — Shell transversal (app-sidebar, layouts, nouveaux composants app/)
Recherche globale + palette Cmd+K (cmdk déjà installé) · switcher client contextuel · capture rapide mobile (FAB) · assistant installation PWA iOS (dialog onboarding mock) · alerte santé connexions au niveau client (bandeau layout client) · accessibilité (focus, aria, raccourcis doc).

## Vague 4 — 3 agents parallèles

### Agent C1 — Performance + Rapport (`app/.../performance/page.tsx` + report)
Page Performance par client (metrics mockées par post, tops/flops) · Rapport client brandé partageable (mock aperçu + lien) · Récap mensuel (preuve de valeur).

### Agent C2 — Onboarding wizard (`app/(app)/clients/new/page.tsx`)
Wizard 4-5 étapes mock : infos client, comptes à connecter (mock), brand kit, piliers, premier contenu.

### Agent C3 — Réglages client (`app/.../settings/page.tsx` client + components)
Brand kit éditeur · niveau de validation par client · créneaux récurrents · archivage client + corbeille contenus · journal/notes client · détection trous/conflits (réglage seuils mock).

## Vague 5 — QA finale
- `tsc --noEmit` + `biome check` + fix.
- Audit fichiers >250 lignes → découpage.
- grep `any\b`, couleurs hardcodées (#hex, rgb() hors tokens) → fix.
- Revue code-reviewer par domaine + harmonisation copy FR (ton, majuscules, vouvoiement→tutoiement cohérent avec l'existant).
- Test visuel : `next dev` + parcours des routes principales.

## Règles pour TOUS les agents
1. Lire d'abord : `apps/web/AGENTS.md` (Next 16 ≠ training data), la section concernée de `docs/AUDIT-PAGES-CLIENT.md`, les composants existants du domaine (style à imiter).
2. Mocks uniquement — interactions via `useState` + toasts sonner « (aperçu) » comme le pattern drag existant. AUCUN appel réseau/Supabase.
3. shadcn/ui d'abord (components/ui/ déjà fourni), lucide-react, tokens Tailwind v4 existants. Pas de nouvelle dépendance sans nécessité absolue (dnd-kit, cmdk, sonner, date-fns, react-day-picker déjà là).
4. ≤250 lignes/fichier, zéro `any`, zéro couleur hardcodée, "use client" seulement si nécessaire.
5. FR impeccable (libellés, pluriels, accents), formats via lib/format.ts, TZ client via les helpers existants.
6. Ne PAS toucher aux fichiers hors de son périmètre (listés par agent). Les types/mocks sont GELÉS après Vague 1 — si un champ manque, le signaler dans le rapport final, ne pas modifier la fondation.
