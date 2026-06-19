# Audit fonctionnalités — Pages client (Grille feed · Calendrier · Studio)

> **Généré le 2026-06-11** — audit multi-agents (21 agents) : lecture intégrale du code des 3 pages et des mocks, extraction PRD + ANALYSE-LANCEMENT, **198 findings de benchmark** (Later, Planoly, Plann, Preview, Buffer, Publer, SocialBee, Vista Social, Metricool, Swello, Agorapulse, Iconosquare, Kontentino, Planable + workflow métier freelance SMM + plaintes utilisateurs G2/Capterra/Reddit), gap analysis par page, **filtre de faisabilité contre l’état réel des API Meta/TikTok (juin 2026)**, critique de complétude.
>
> Légende : `P0` indispensable · `P1` différenciant · `P2` confort — effort S/M/L — 🎨 = prototypable dès maintenant en UI mockée — 📋 = déjà prévu au PRD mais absent de l’UI — 🔧 = faisable en adaptant (voir note).

## Synthèse exécutive

**121 fonctionnalités proposées → 113 retenues** (8 écartées : toutes pour cause de scope explicitement V2/backlog au PRD, aucune pour infaisabilité API), dont **42 P0** réparties ainsi : Grille 7 · Calendrier 10 · Studio 12 · Transversal 10 · Compléments 3. **Toutes les P0 sont prototypables dès maintenant en UI mockée** — parfaitement aligné avec la phase preview en cours.

### Les 6 constats majeurs (fil rouge cross-pages)

1. **La boucle de validation client — le cœur du métier — est invisible.** `in_review`, `changes_requested` et `approved` sont indiscernables dans la grille comme dans le calendrier ; les annotations client n'apparaissent pas dans le studio ; il n'existe ni envoi en revue groupé, ni relance, ni suivi. C'est pourtant LA raison d'être d'Ocean face à un Later ou un Buffer.
2. **Les états d'erreur n'existent nulle part dans l'UI.** Les mocks contiennent un reel `failed` (« Token expiré »), un compte `needs_reauth` et un `partially_published` (FB refusé) — aucun n'est visible dans la grille ni le calendrier. Un échec de publication invisible est l'exact opposé de la promesse produit (triple canal d'alerte).
3. **Le studio est une liste en lecture seule : on ne peut ni créer ni éditer un contenu.** Pas de composer (le bouton « Nouveau contenu » mène à une liste), pas d'édition de légende, pas de programmation par dialog. C'est le P0 le plus structurant de tout l'audit.
4. **Le drag-and-drop est amorcé mais incomplet partout.** L'étagère affiche « Glisse une carte dans la grille » mais ses items ne sont pas draggables ; les permutations de la grille n'ont ni confirmation ni annulation ; le calendrier n'a aucune replanification par drag.
5. **Aucune multi-sélection / action par lot, alors que le freelance travaille en batch mensuel.** Envoyer 12 posts en validation, décaler une semaine entière, approuver en masse : impossible aujourd'hui. Demande revenue dans les 4 gap analyses indépendamment.
6. **Quotas et santé des comptes absents de l'UI** alors que l'enforcement worker est au cœur de l'architecture : aucune jauge IG 100/24h, FB 30 Reels, TikTok 5 brouillons, aucune alerte de reconnexion.

### Ordre de mock recommandé pour la preview

1. **Composer studio** (création + édition + programmation outillée) — débloque la moitié des autres features.
2. **Statuts de validation visibles partout** (pastilles grille/calendrier, panneau annotations studio, envoi en revue groupé).
3. **Erreurs & santé des comptes** (échecs visibles, alertes reconnexion, jauges de quotas).
4. **Drag-and-drop complet** (étagère → grille, replanification calendrier, confirmation/annulation).
5. **Multi-sélection et actions par lot** (studio + calendrier).

### Quick wins (effort S, mockables immédiatement)

Ratio 3:4 des tuiles de grille (Instagram recadre en 3:4 depuis 2025 — la preview 1:1 actuelle ment au client) · pastilles de statut sur les tuiles · séparateur « Aujourd'hui » dans la grille · fix du « +N autres » du calendrier (panneau Jour) · compteurs de caractères avec ligne de coupure « … plus » · légende calendrier · alerte `needs_reauth` en bandeau.

### Note de lecture

Les features communes à plusieurs pages (hashtags + premier commentaire, légendes par plateforme, médiathèque, duplication) sont regroupées en **section 4 (Transversal)**. Certaines ont été écartées de la section Studio par le filtre PRD (V2/backlog) mais conservées en Transversal avec verdict « à adapter » : l'arbitrage final de lot t'appartient — le filtre a appliqué strictement les colonnes MVP/V2 du PRD §4.


## 1. Grille feed Instagram

### 1.1 État des lieux — ce qui existe déjà

- **Aperçu de profil Instagram simulé** — Header reproduisant le profil IG (instagram-profile-header.tsx) : avatar avec anneau dégradé story officiel IG, stats publications/abonnés/abonnements (followers formatés FR « 8,4 k »), nom + badge vérifié, catégorie, bio multiligne, @handle, boutons Suivre/Message/options, rangée de 4 « stories à la une », barre d'onglets PUBLICATIONS/Reels/Profil. Données issues du SocialAccount IG (username, followers) et du Client (name, bio, category, following).
- **Grille 3 colonnes format feed** — Grille CSS grid-cols-3 gap-1 avec tuiles carrées (aspect-square), colonne limitée à max-w-[468px] pour reproduire la largeur d'un feed IG, centrée sur mobile (mx-auto sm:mx-0).
- **Trois groupes de tuiles ordonnés** — Planifiés (statuts scheduled/approved/in_review/changes_requested avec scheduledAt) en tête, puis publiés via l'app (published/partially_published), puis feed réel importé en queue. Chaque groupe trié par date décroissante (byDateDesc).
- **Filtre d'éligibilité au feed** — inFeed() : un contenu apparaît seulement s'il cible Instagram, n'est pas une story et possède au moins 1 média. Stories et contenus FB-only/newsletter exclus par construction.
- **Drag-and-drop des tuiles planifiées** — dnd-kit (DndContext + SortableContext rectSortingStrategy). Seules les tuiles planifiées sont déplaçables. PointerSensor avec activation à 6px de distance (distingue clic et drag) + DragOverlay affichant un fantôme de la tuile avec shadow-lg ; tuile d'origine en opacity-40 pendant le drag.
- **Sémantique de permutation des dates** — Au drop, arrayMove réordonne les tuiles puis ré-applique la suite de dates d'origine sur les positions : les créneaux restent fixes, seuls les contenus changent de créneau (sémantique PRD).
- **Toast de feedback après drag** — Toast sonner info « Les dates seront permutées entre ces posts (aperçu) » avec description nommant le titre déplacé et sa nouvelle date, et précisant qu'aucune date n'est réellement modifiée (preview front).
- **Drag accessible au clavier** — KeyboardSensor + sortableKeyboardCoordinates : prise/déplacement des tuiles au clavier. Liens des tuiles avec focus-visible:ring.
- **Tuiles verrouillées (publiés + importés)** — LockedGridTile : non draggables, hors SortableContext (drop impossible dessus). Publiés → Link vers la fiche studio ; importés → lien externe target=_blank vers le permalink instagram.com avec aria-label « Voir … sur Instagram ».
- **Clic tuile planifiée → studio** — SortableGridTile enveloppe la tuile d'un Link vers routes.content(clientId, contentId) (fiche studio), aria-label « Ouvrir {titre} », draggable={false} pour ne pas interférer avec dnd-kit.
- **Cadenas sur posts importés** — Icône Lock en haut-gauche sur fond noir/55 backdrop-blur pour les tuiles du feed réel importé.
- **Anneau de surbrillance sur planifiés** — Tuiles planifiées avec ring-2 ring-primary/60 et image en opacity-90 pour les distinguer du feed réel.
- **Overlay date + heure en fuseau client** — Bas de tuile : dégradé noir avec jour/mois (formatDayMonth) et heure (formatTime) affichés dans le timezone du client (tile.tz), tabular-nums. Client Studio Rise en America/Montreal dans les mocks pour tester.
- **Icône de format par tuile** — FormatIcon en bas-droite : post (Image), carrousel (Images), reel (Film), story (Circle), avec aria-label du libellé FR.
- **Badges média (vidéo / carrousel)** — MediaThumb ajoute en haut-droite un badge Film pour les vidéos, ou un badge Layers + nombre de slides si mediaCount > 1 (carrousels).
- **Étagère latérale « sans date »** — GridShelf : panneau latéral 18rem (passe sous la grille en <lg) listant les idées/brouillons non datés avec mini-vignette 44px, icône format, titre, mention « Sans date », compteur d'items, hover border-primary/40.
- **Légende des groupes** — GridLegend : 3 entrées statiques — pastille primary « Planifié · déplaçable », pastille verte « Publié · lecture seule », icône Lock « Importé · feed réel verrouillé ».
- **État vide global** — Si aucun contenu dans aucun groupe ni l'étagère : EmptyState avec icône ImageIcon, « Aucun contenu à afficher » et texte invitant à connecter un compte Instagram ou créer du contenu dans le studio (texte seul, sans bouton).
- **État vide de l'étagère** — Texte « Idées et brouillons non datés apparaîtront ici. » quand la liste est vide.
- **Stories à la une dérivées des imports** — 4 highlights construits à partir des 4 premiers posts importés (covers) avec labels hardcodés « Nouveautés, Coulisses, Avis, Équipe », rangée scrollable horizontalement.
- **Compteur de publications synthétique** — postCount du header = nombre de publiés via l'app + nombre de posts importés ; avatar = vignette du 1er post importé, fallback 1er publié, fallback chaîne vide.
- **Header client partagé (layout)** — layout.tsx : avatar initiales sur couleur de marque (brandColor oklch), nom, @handle, timezone avec icône Clock, icônes colorées des plateformes connectées (PlatformIcon), bouton « Nouveau contenu » → page studio du client. notFound() si clientId inconnu.
- **Onglets de navigation client** — ClientTabs : Grille feed / Calendrier / Studio avec icônes, état actif par préfixe de pathname (bordure primary), barre scrollable horizontalement (overflow-x-auto) sur mobile.
- **Date des publiés robuste** — publishedDate() : date affichée = publishedAt de la cible Instagram si présent, sinon scheduledAt en fallback.
- **Métadonnée de page** — export metadata title « Grille feed ».

### 1.2 Frictions constatées dans l’UI actuelle

- Hint contradictoire de l'étagère : le texte affiche « Glisse une carte dans la grille pour lui attribuer une date » mais les items de l'étagère ne sont PAS draggables (simples <li>, aucune intégration dnd-kit ; le commentaire du code dit lecture seule en preview, Lot 2). L'utilisateur est invité à une interaction impossible.
- Items de l'étagère non cliquables : toContentTile leur fournit un href vers le studio, mais ShelfItem ne rend aucun Link — impossible d'ouvrir l'idée/le brouillon depuis l'étagère.
- Réordonnancement éphémère sans persistance ni filet : état local useState seulement, perdu à la navigation ; pas de bouton Annuler/Rétablir, pas de « réinitialiser l'ordre », pas de mode « enregistrer les permutations » — uniquement le toast d'aperçu.
- Aucune distinction visuelle des sous-statuts dans le groupe planifié : in_review, changes_requested, approved et scheduled ont exactement le même rendu (ring primary). Un contenu refusé par le client est indiscernable d'un contenu validé.
- Incohérence légende/tuiles : la légende affiche une pastille verte pour « Publié · lecture seule » mais les tuiles publiées ne portent aucune pastille verte ni aucun marqueur — elles sont visuellement nues (ni ring ni cadenas), seule l'absence d'indicateur les distingue.
- Contenus failed, publishing et canceled totalement absents de la grille : ils ne rentrent dans aucun des 3 groupes ni l'étagère. Le reel IG « failed » des mocks (avec lastError « Token expiré ») disparaît du feed preview sans aucune trace.
- partially_published affiché comme un publié normal : aucune indication de l'échec partiel (mock : IG publié mais FB « média refusé ») alors que lastError et le statut existent dans les données.
- Aucune alerte needs_reauth : le compte IG de Brûlerie Lacaze est en needs_reauth dans les mocks, mais la grille affiche son profil et son feed sans aucun avertissement de reconnexion.
- Aucun indicateur de quota IG (100 posts/24h) alors que le CLAUDE.md prévoit une UI d'affichage ergonomique du quota restant.
- Friction drag mobile (PWA iOS prioritaire) : className touch-none sur chaque tuile sortable + PointerSensor à seuil de distance sans TouchSensor/délai long-press — le swipe vertical sur une tuile ne scrolle pas la page et peut déclencher un drag involontaire sur une grille qui occupe tout l'écran iPhone.
- Aucun feedback quand on tente de déposer une tuile sur la zone verrouillée (publiés/importés) : le drop est silencieusement ignoré (over null / id introuvable), sans toast ni indication visuelle de zone interdite.
- Aucune recherche ni filtre : pas de filtre par format (post/carrousel/reel), par statut, ni de bascule « feed réel seul / avec planifiés » pour voir le rendu final du feed.
- Pas de multi-sélection ni d'action par lot, alors que la persona travaille en batch mensuel.
- Permalink des posts publiés via l'app non exploité : ContentTarget.permalink existe dans les mocks pour les cibles published, mais la tuile publiée ne propose aucun lien vers le post réel sur Instagram (lien studio uniquement).
- Titre du contenu jamais visible sur la grille : uniquement en aria-label et alt — aucun tooltip ni overlay au survol pour identifier un post sans cliquer.
- commentsCount et approvalStale non affichés sur les tuiles : un contenu avec 3 commentaires client et une validation périmée n'affiche rien dans la grille.
- Aucune frontière visuelle entre zone planifiée (futur) et zone publiée (passé) : pas de séparateur « aujourd'hui » dans le flux de tuiles, seule la différence de ring marque la limite.
- État vide sans CTA : le texte mentionne « connecte un compte » et « crée du contenu » mais aucun bouton d'action n'est rendu (EmptyState supporte pourtant une prop action).
- Les idées sans média sont invisibles partout sur la page : inFeed() exige media.length > 0, donc l'idée carrousel des mocks (media: 0) n'atteint jamais l'étagère pourtant censée accueillir les idées — seul le brouillon avec média y figure (1 item par client).
- Highlights non data-driven : labels hardcodés dans la page (HIGHLIGHT_LABELS) et covers = 4 premiers imports ; aucun champ mock dédié, non éditables.
- Aucune indication multi-plateforme sur les tuiles : un post ciblant aussi Facebook ou TikTok est indiscernable d'un post IG-only (targets non exploités au-delà du filtre).
- Le drag ne permet que la permutation entre créneaux existants : impossible d'assigner une nouvelle date, d'insérer un créneau ou de décaler une seule tuile depuis la grille — toute autre modification de date impose d'ouvrir le studio.
- Badge vérifié (BadgeCheck) hardcodé pour tous les clients dans le header profil — non porté par les données, faux pour la plupart des petits commerces clients.
- Boutons Suivre / Message / options du header profil purement décoratifs (aucun onClick), sans signal qu'il s'agit d'un chrome de simulation.
- Donnée importée pauvre côté UI : mediaCount toujours 1 pour les imports (les carrousels importés s'affichent comme posts simples) et titre hardcodé « Post importé » pour toutes les tuiles importées.

### 1.3 Fonctionnalités manquantes proposées (25)

---

**P0 — Indispensable pour un usage pro quotidien**

#### `P0` · Aperçu fidèle au ratio 3:4 d'Instagram _(effort M)_
🎨 mockable dès maintenant (UI preview)

Un commutateur 1:1 / 3:4 au-dessus de la grille affiche les vignettes au recadrage réel du profil Instagram (3:4 depuis janvier 2025), avec un overlay des zones rognées haut/bas sur la tuile survolée ou sélectionnée. Le freelance repère immédiatement les textes et visages qui seront coupés avant de livrer le feed au client.

- **Valeur freelance** : Une preview restée en carré ment au client et fait prendre de mauvaises décisions de crop ; les leaders (Sked, Planoly) affichent déjà le ratio réel. C'est la crédibilité de la promesse centrale de la page.
- **Inspiration** : Sked Social / Planoly / PostFast (grille 3:4 + safe zones)

#### `P0` · Confirmation des permutations avec annulation _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Après un drag, une barre récapitulative liste les échanges de dates (« Post A → mar. 16 juin 18h, Post B → jeu. 12 juin 11h »), signale les contenus multi-plateformes déplacés et les contenus approuvés sur date validée, puis Confirmer / Annuler ; un toast Undo reste actif 10 s après confirmation. Le drop sur la zone verrouillée déclenche un feedback visuel de zone interdite au lieu d'être ignoré en silence.

- **Valeur freelance** : Le PRD exige l'aperçu + confirmation avant commit, et le drag imprécis sans undo est LA plainte Capterra contre Planoly. Filet indispensable dès que les permutations seront persistées.
- **Inspiration** : PRD Lot 1 + Planoly (plainte Capterra « drag trop sensible »)
- **Note** : Quasi verbatim PRD §5.C : aperçu des nouvelles dates + confirmation avant commit, signalement explicite du multi-plateforme, notification si contenu approuvé sur date validée, drop interdit sur zone verrouillée. Ajouts (toast Undo 10 s, feedback zone interdite) = raffinements UI ; en réel, l'undo = permutation inverse, journalisée elle aussi.

#### `P0` · Glisser un brouillon de l'étagère vers la grille _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Les cartes de l'étagère deviennent draggables : déposée entre deux tuiles, l'idée reçoit une date interpolée entre les voisins (heure pleine, fenêtre 9h–21h fuseau client), prévisualisée dans la boîte de confirmation. Les cartes deviennent aussi cliquables vers le studio, et les idées sans média y apparaissent enfin avec une vignette placeholder.

- **Valeur freelance** : Le hint actuel promet une interaction impossible (« Glisse une carte dans la grille ») : c'est le geste cœur du batch mensuel — composer le feed en piochant dans les idées sans repasser par le calendrier.
- **Inspiration** : PRD Lot 1 + Vista Social (médiathèque → grille en 3 panneaux)
- **Note** : Verbatim PRD §5.C : étagère latérale + date interpolée, heure pleine, fenêtre 9h–21h fuseau client. Respecter les bornes du PRD (≥ maintenant + 15 min ; drop en tête = dernier créneau + 24h). Cartes cliquables et placeholder pour idées sans média : corrige un artefact du mock actuel (filtre inFeed exclut les idées sans média même de l'étagère).

#### `P0` · Pastilles de statut de validation sur les tuiles _(effort S)_
🎨 mockable dès maintenant (UI preview)

Chaque tuile planifiée porte une pastille couleur + libellé court issus de contentStatusMeta (déjà dans les mocks) : en revue (ambre), modifs demandées (rouge), approuvé (vert), programmé (bleu). Un filtre rapide « à corriger » fait remonter les contenus refusés par le client.

- **Valeur freelance** : Aujourd'hui un contenu refusé par le client est indiscernable d'un contenu validé dans la grille ; avec 3-10 clients, le freelance doit lire l'état du workflow de validation d'un coup d'œil sans ouvrir chaque fiche.
- **Inspiration** : Plann (icône statut sur tuile) / Iconosquare (pastilles brouillon-programmé)

#### `P0` · Échecs et publications en cours visibles dans la grille _(effort S)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Les contenus failed, publishing et canceled réintègrent la grille : tuile failed avec ring rouge, icône alerte, lastError en infobulle et CTA « Reprogrammer » ; tuile publishing avec indicateur animé ; partially_published avec badge signalant la plateforme en échec (mock : IG ok, FB refusé).

- **Valeur freelance** : Le reel en échec des mocks (« Token expiré ») disparaît aujourd'hui du feed sans aucune trace : un post qui saute silencieusement est le pire scénario de confiance pour un outil de publication.
- **Inspiration** : original (gap audit — complète le triple canal d'échec du PRD)
- **⚠️ Faisabilité** : failed/publishing/partially_published : oui — cohérent avec « 0 échec silencieux » (§10) et le retry ciblé failed→scheduled (§5.B) ; lastError existe déjà dans les mocks. MAIS exclure canceled : c'est le soft-delete du PRD (§5.B « suppression/abandon ») — le réintégrer pollue la grille. CTA « Reprogrammer » = transition déjà prévue.

#### `P0` · Alerte reconnexion du compte Instagram _(effort S)_
🎨 mockable dès maintenant (UI preview)

Quand le SocialAccount IG est en needs_reauth ou expired, un bandeau d'avertissement s'affiche au-dessus du header de profil avec CTA « Reconnecter » vers Réglages > Comptes ; les tuiles planifiées passent en semi-transparence avec mention « publication bloquée ».

- **Valeur freelance** : Brûlerie Lacaze est volontairement en needs_reauth dans les mocks et la grille n'affiche rien : sans ce signal, le freelance découvre l'échec après l'heure de publication promise au client.
- **Inspiration** : original (health check tokens prévu au PRD côté settings)

#### `P0` · Drag tactile au long-press (PWA iOS) _(effort S)_
🎨 mockable dès maintenant (UI preview)

Ajout d'un TouchSensor dnd-kit avec délai d'appui long (~250 ms) et léger grossissement de la tuile saisie : le swipe vertical scrolle normalement la page, l'appui long démarre le drag. Retrait du touch-none permanent sur les tuiles sortables.

- **Valeur freelance** : Étienne et la persona travaillent sur iPhone : aujourd'hui la grille pleine page bloque le scroll et peut déclencher des drags involontaires — friction rédhibitoire sur LE device prioritaire du projet.
- **Inspiration** : UNUM (réagencement pensé pour le doigt)

---

**P1 — Différenciant fort**

#### `P1` · Fiche express au survol ou à l'appui _(effort M)_
🎨 mockable dès maintenant (UI preview)

Survol desktop ou tap (distinct du long-press de drag) ouvre un popover : titre, extrait de légende, statut, plateformes ciblées, nombre de commentaires client, badge « validation périmée », et actions rapides — Ouvrir dans le studio, Voir sur Instagram (permalink), Copier la légende.

- **Valeur freelance** : Le titre n'est jamais visible sur la grille et le permalink des posts publiés via l'app est ignoré : identifier un post parmi 30 tuiles sans ouvrir dix fiches studio est un gain quotidien massif.
- **Inspiration** : Planable / Vista Social (détail et actions depuis la grille)

#### `P1` · Filtres de grille et mode « rendu final » _(effort M)_
🎨 mockable dès maintenant (UI preview)

Barre de chips pour filtrer par format (post/carrousel/reel) et par statut, plus un toggle « Rendu final » qui masque tout sauf le feed réel et les contenus approuvés/programmés — la grille telle qu'elle sera réellement publiée. Variante « après la prochaine publication » pour valider la première ligne à venir.

- **Valeur freelance** : Vérifier l'esthétique exacte du futur profil sans le bruit des brouillons et des refusés est le check final avant envoi en validation ; le « grid shift » d'UNUM en est la version la plus fine.
- **Inspiration** : Buffer (3 sources mêlées) + UNUM (grid shift)

#### `P1` · Multi-sélection et actions par lot _(effort M)_
🎨 mockable dès maintenant (UI preview)

Un mode sélection (bouton ou appui long) permet de cocher plusieurs tuiles planifiées puis d'agir en lot via une barre flottante : envoyer en validation, décaler de N jours, changer la plage horaire, annuler. Le compteur de sélection et les actions indisponibles (mix de statuts) sont explicites.

- **Valeur freelance** : La persona programme 15-30 posts d'un coup en batch mensuel : sans action par lot, chaque ajustement se fait poste par poste dans le studio — la grille doit être l'outil de pilotage du mois.
- **Inspiration** : UNUM (bulk swap) + workflow batch mensuel

#### `P1` · Placeholders par pilier éditorial _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Bouton « Réserver une case » : insère dans la grille une tuile colorée typée par pilier (produit, coulisses, avis, inspiration…) avec date et récurrence optionnelle. À la livraison des visuels du client, « Convertir en brouillon » ouvre le studio pré-rempli sur ce créneau.

- **Valeur freelance** : Structurer le mois par stratégie éditoriale AVANT le shooting est le réflexe pro du batch : la grille devient le plan de contenu visuel du client, pas seulement la preview de l'existant.
- **Inspiration** : Planoly (Placeholders récurrents) / Plann (placeholders thématiques)
- **⚠️ Faisabilité** : Recoupe les « modèles récurrents » classés V2 au PRD §4 (Module D) et introduit un nouveau concept (pilier) absent du modèle §6. À limiter en preview à une case réservée simple (tuile locale, sans récurrence) avec « Convertir en brouillon » ; piliers + récurrence → V2.

#### `P1` · Insérer un créneau depuis la grille _(effort M)_
🎨 mockable dès maintenant (UI preview)

Au survol entre deux tuiles planifiées (ou via le menu d'une tuile), « Insérer un créneau ici » ouvre un mini-picker pré-rempli avec une date interpolée, avec option « décaler les posts suivants ». Permet aussi de re-dater une seule tuile sans permutation, sans quitter la grille.

- **Valeur freelance** : Le drag actuel ne sait que permuter des créneaux existants : ajouter un post au milieu du mois ou combler un trou impose aujourd'hui d'ouvrir le studio puis le calendrier — friction majeure en composition de feed.
- **Inspiration** : Planoly (popup de re-programmation au drop)

#### `P1` · Validation de la grille entière par le client _(effort M)_
🎨 mockable dès maintenant (UI preview)

Bouton « Partager l'aperçu » : génère un lien vers une vue grille en lecture seule dans le portail Reviewer, filtrable par statut de validation, avec cadre téléphone optionnel ; le client approuve ou commente tuile par tuile directement depuis la grille.

- **Valeur freelance** : Le client doit valider la cohérence VISUELLE du mois, pas des posts isolés en liste : très peu d'outils font commenter dans la grille — différenciant fort pour vendre une direction artistique, et pont naturel vers le portail existant.
- **Inspiration** : HeyOrca / Sked Social / Planable (grille partageable + commentaires)

#### `P1` · Comparateur de covers de Reel en contexte _(effort M)_
🎨 mockable dès maintenant (UI preview)

Depuis une tuile Reel, « Tester la cover » permet de cycler entre 2-3 covers candidates affichées en place dans la grille, avec l'outline du crop 3:4 superposé. La cover retenue est renvoyée vers la fiche studio du contenu.

- **Valeur freelance** : La cover est une décision d'esthétique de feed, pas de vidéo : les vignettes de Reels aux visages coupés sont la plainte récurrente des SMM — choisir en contexte préserve l'harmonie vendue au client.
- **Inspiration** : Preview App (Reels Planner) / Later

#### `P1` · Pastilles multi-plateformes sur les tuiles _(effort S)_
🎨 mockable dès maintenant (UI preview)

Les tuiles dont le contenu cible aussi Facebook ou TikTok affichent une mini-rangée d'icônes plateformes (réutilisant PlatformIcon et platformMeta), avec l'état par cible visible dans la fiche express (FB échoué, brouillon TikTok poussé).

- **Valeur freelance** : Un post cross-posté est indiscernable d'un IG-only alors que déplacer sa date impacte TOUTES ses cibles (décision PRD) : le freelance doit le voir avant de permuter, pas le découvrir dans la confirmation.
- **Inspiration** : Planable (indicateurs multi-réseaux sur vignettes)

#### `P1` · Séparateur « Aujourd'hui » entre futur et passé _(effort S)_
🎨 mockable dès maintenant (UI preview)

Une fine ligne avec libellé « Aujourd'hui · 11 juin » s'insère dans le flux de tuiles entre le dernier planifié et le premier publié, sticky pendant le scroll. Au-dessus : le feed à venir, modifiable ; en dessous : l'historique réel, verrouillé.

- **Valeur freelance** : La frontière modifiable/verrouillé n'est aujourd'hui marquée que par un ring discret, en contradiction avec la légende ; ce repère rend la lecture temporelle de la grille instantanée, surtout sur mobile.

#### `P1` · Jauge de quota de publication Instagram _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Un chip en tête de grille affiche « 97/100 posts API sur 24h » (valeur mockée) avec barre de progression et tonalité d'alerte sous 10 restants ; un avertissement apparaît si les contenus planifiés des prochaines 24h dépassent le quota restant, annonçant le report automatique.

- **Valeur freelance** : Le CLAUDE.md prévoit explicitement une UI ergonomique du quota restant : un report automatique pour quota atteint ne doit jamais être une surprise découverte par le client.
- **Inspiration** : CLAUDE.md §6 (enforcement quotas) — original côté UI
- **Note** : CLAUDE.md §6 prévoit explicitement « UI = affichage ergonomique du quota restant » ; enforcement worker + report auto actés (décision n°11, PRD §5.E). En réel : GET /content_publishing_limit (+ limite 400 conteneurs/24h, analyse §2.1). Rarement critique pour un freelance (1–3 posts/j) → garder le chip discret hors alerte.

#### `P1` · Simulation des posts épinglés _(effort S)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Action « Épingler dans l'aperçu » (max 3) sur les tuiles publiées/importées : elles remontent en première ligne avec une icône punaise, comme sur le vrai profil. Le choix est conservé par client dans l'état mock.

- **Valeur freelance** : Les 3 pins d'Instagram modifient la première ligne réelle du profil : une grille validée par le client qui les ignore ne correspond pas à ce que son audience verra en ligne.
- **Inspiration** : Preview App + Instagram natif (réorganisation des pins, juin 2025)
- **⚠️ Faisabilité** : L'API Meta ne permet ni d'épingler ni de LIRE l'état épinglé (aucun champ pinned sur GET /media) → simulation manuelle permanente, jamais synchronisée avec le vrai profil. À garder mais étiqueté clairement « simulation » et inclus dans le reset du bac à sable, sinon la grille ment (principe §5.C).

#### `P1` · Reel hors grille (toggle par contenu) _(effort S)_
🎨 mockable dès maintenant (UI preview)

Sur chaque Reel planifié ou publié, un interrupteur « Afficher dans la grille principale » reproduit le choix natif Instagram : désactivé, la tuile sort de la grille feed mais reste visible dans l'onglet Reels et au calendrier.

- **Valeur freelance** : Sans ce flag, la preview affiche des Reels qui n'apparaîtront jamais sur le profil réel du client — la fidélité, promesse centrale de la page, s'effondre.
- **Inspiration** : Rella / Metricool (Edit Grid) / Instagram natif

---

**P2 — Confort**

#### `P2` · Onglet Reels avec grille de covers dédiée _(effort M)_
🎨 mockable dès maintenant (UI preview)

L'onglet « Reels » du header de profil (aujourd'hui décoratif) devient fonctionnel : grille de covers en 9:16 des Reels planifiés et importés, dans leur ordre propre, pour juger l'esthétique de l'onglet Reels séparément du feed principal.

- **Valeur freelance** : L'onglet Reels du profil a sa propre vitrine : un feed principal soigné avec un onglet Reels chaotique est une critique client classique que les outils multi-grilles ont déjà adressée.
- **Inspiration** : Planoly (grilles feed et Reels distinctes)

#### `P2` · Analyse colorimétrique du feed _(effort M)_
🎨 mockable dès maintenant (UI preview)

Un panneau « Harmonie » extrait côté client (canvas sur les miniatures) les couleurs dominantes des 12 prochaines tuiles, affiche la palette HEX copiable et surligne la tuile en rupture de tonalité avec ses voisines.

- **Valeur freelance** : Le check d'harmonie de 5 secondes avant envoi en validation, plus des HEX à coller dans Canva : la direction artistique devient un argument data face au client.
- **Inspiration** : UNUM (Color Map) / Plann (palette la plus performante)

#### `P2` · Client fictif pour maquettes avant-vente _(effort M)_
🎨 mockable dès maintenant (UI preview)

Création d'un client « maquette » sans OAuth : le freelance uploade des visuels du prospect (screenshots, exports), édite avatar, bio, compteurs et highlights du header simulé, et compose un avant/après de feed présentable en mode cadre iPhone.

- **Valeur freelance** : Pitcher une refonte de feed AVANT d'avoir les accès Meta du prospect est un levier commercial direct pour un freelance — version conforme aux ToS du « preview par handle » de MWM, et le header simulé devient enfin éditable (badge vérifié, bio).
- **Inspiration** : Feed Preview (MWM) / TryMyPost — adapté sans scraping

#### `P2` · Recycler un post qui a performé _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Les tuiles importées et publiées affichent en option likes/commentaires (engagement mocké, puis champs GET /media), avec un tri « top posts » ; l'action « Recréer à partir de ce post » ouvre le studio pré-rempli (média, structure de légende, format).

- **Valeur freelance** : Réutiliser ce qui a marché est le réflexe mensuel de la persona : repérer les tops du client et les décliner sans fouiller Instagram fait gagner une session de travail par client.
- **Inspiration** : Metricool / Preview App (stats en grille) + pratique métier batch
- **⚠️ Faisabilité** : like_count/comments_count sont des champs GET /media (dispo en Standard Access dès l'import Lot 2) — pas l'API insights ; le vrai module Statistiques reste V2 (PRD §4, métriques post-v26.0). MAIS le pré-remplissage média est limité : originaux purgés J+7 et importés sans original (seules les miniatures persistent, Module J) → pré-remplir légende/format/structure et demander le re-upload du média.

#### `P2` · Bac à sable : masquer des posts et tout réinitialiser _(effort S)_
🎨 mockable dès maintenant (UI preview)

Action « Masquer de l'aperçu » sur les tuiles importées/publiées pour simuler une refonte ou un archivage, avec compteur de posts masqués, et bouton « Réinitialiser l'aperçu » qui annule masquages, pins et réordonnancements pour revenir à l'état réel du feed.

- **Valeur freelance** : Simuler un nettoyage de feed avant de le faire sur Instagram est un argument visuel fort en rendez-vous de refonte ; le reset transforme la grille en bac à sable sans risque.
- **Inspiration** : UNUM (masquage de posts) + Feed Preview MWM (reset vers l'état réel)

#### `P2` · Mode présentation avec cadre iPhone _(effort S)_
🎨 mockable dès maintenant (UI preview)

Un toggle affiche header de profil + grille dans un mockup iPhone épuré, sans chrome Ocean, avec bouton « Exporter en image » générant un PNG de la grille à coller dans un deck ou un message WhatsApp/email client.

- **Valeur freelance** : Des captures professionnelles « comme vos abonnés le verront » pour les rendez-vous et validations informelles : bien plus vendeur qu'un screenshot d'outil avec sidebar et badges.
- **Inspiration** : Preview App / PlanMyGrid (preview en cadre téléphone)


## 2. Calendrier éditorial

### 2.1 État des lieux — ce qui existe déjà

- **Vue Mois (grille 7 colonnes)** — Grille lundi→dimanche avec en-têtes Lun…Dim, jours débordants du mois précédent/suivant affichés grisés (bg-muted/30, texte atténué), cellules min-h-28 (sm:min-h-32), bordures complètes, coins arrondis.
- **Vue Semaine (cartes par jour)** — 7 cartes jour (lundi→dimanche) en grille responsive : 2 colonnes mobile, 4 en sm, 7 en lg. Chaque carte a un en-tête (jour abrégé + numéro) et la liste complète des contenus du jour (pas de limite d'affichage).
- **Bascule Mois / Semaine** — Segmented control (2 boutons « Mois » / « Semaine ») avec aria-pressed, fond bg-muted, option active en bg-background + shadow.
- **Navigation période précédente / suivante** — 2 boutons chevron (aria-label « Période précédente/suivante ») qui décalent d'un mois en vue mois ou de 7 jours en vue semaine.
- **Bouton « Aujourd'hui »** — Réinitialise simultanément le curseur mois ET l'ancre semaine sur la date courante (MOCK_NOW = 11/06/2026, exprimée dans le fuseau du client).
- **Libellé de période dynamique** — « juin 2026 » (capitalisé CSS) en vue mois, « Semaine du lundi 9 juin » en vue semaine (premier jour de la semaine affichée), formaté fr-FR dans le fuseau client.
- **Affichage du fuseau client** — Sous-titre « Fuseau du client · Europe/Paris » dans la toolbar. Tout le calendrier (clé jour, heures, libellés) est calculé dans client.timezone — Studio Rise (America/Montreal) s'affiche donc décalé correctement.
- **Mise en évidence d'aujourd'hui** — Vue mois : ring primary/40 + fond primary/[0.04] sur la cellule, numéro du jour en pastille pleine bg-primary. Vue semaine : ring sur la carte + en-tête teinté primary/[0.05] + numéro en pastille pleine.
- **Entrée de contenu en vue mois** — Chaque contenu = lien vers sa fiche studio (routes.content) affichant : pastille de statut (couleur du ton uniquement, 1.5px), icône de format (post/carrousel/reel/story, lucide), heure HH:MM tabulaire dans le fuseau client, titre tronqué (truncate), jusqu'à 3 pastilles plateformes colorées (slice(0,3)).
- **Tooltip natif sur les entrées du mois** — Attribut HTML title = « HH:MM · titre » sur chaque entrée de la vue mois (tooltip navigateur uniquement, absent en vue semaine).
- **Carte de contenu en vue semaine** — Lien-carte bordée vers la fiche contenu : pastille statut + heure + icône format en première ligne, titre sur 2 lignes max (line-clamp-2), toutes les pastilles plateformes en dessous, hover border-primary/30 + bg-muted/40.
- **Débordement « +N autre(s) »** — Vue mois limitée à 3 entrées par cellule (MAX_VISIBLE=3) ; au-delà, un lien « +N autre(s) » apparaît et navigue vers la liste studio complète du client (routes.clientContent) — pas vers une vue du jour.
- **Bouton « + » par jour (création simulée)** — Vue mois : bouton ghost icon-xs révélé au hover de la cellule (opacity-0 → group-hover, aussi focus-visible), aria-label « Nouveau contenu le {date} ». Vue semaine : toujours visible dans l'en-tête de carte. Dans les deux cas, onClick déclenche uniquement un toast sonner « Action simulée (preview) » avec la date — aucune navigation, aucun préremplissage.
- **Empty state mensuel** — Si aucun jour du mois courant n'a de contenu (jours débordants exclus du test), un EmptyState s'affiche SOUS la grille (icône CalendarDays, « Aucun contenu programmé ce mois-ci », description invitant à planifier depuis une case ou le studio). Aucun bouton d'action (la prop action d'EmptyState n'est pas utilisée).
- **Empty state par jour en vue semaine** — Texte centré « Aucun contenu » (muted/60) dans la carte d'un jour vide.
- **Tri chronologique intra-jour** — groupByDay trie les contenus d'un même jour par scheduledAt croissant (comparaison ISO).
- **Filtrage des données côté page** — Le Server Component ne transmet que les contenus datés (scheduledAt !== null) du client ; les idées/brouillons non datés sont exclus du calendrier. Client inconnu → notFound() (404).
- **Gestion robuste des fuseaux/DST** — calendar-utils raisonne en clés jour YYYY-MM-DD calculées via Intl fr-CA dans le fuseau client (cache de formatters), dates ancrées à midi UTC pour éviter tout glissement DST, semaine débutant le lundi (date-fns weekStartsOn:1).
- **Toolbar responsive** — flex-col sur mobile, sm:flex-row avec justify-between ; libellé de période truncate ; le ViewSwitch passe sous les contrôles de navigation sur petit écran.
- **Couleurs par metas centralisées** — Statut → toneDotClass (success/warning/info/danger/neutral/brand → classes bg-* du thème) ; plateforme → variable CSS (var(--instagram), --facebook, --tiktok, --newsletter, --custom) via PlatformDot ; format → FormatIcon avec aria-label FR (formatMeta). Aucune couleur hardcodée.
- **Contexte du layout client parent** — Au-dessus du calendrier : avatar + nom + @handle du client, son fuseau, les icônes des plateformes connectées, bouton « Nouveau contenu » (simple lien vers le studio, sans date), et les onglets de navigation Grille feed / Calendrier / Studio (état actif souligné).
- **Accessibilité partielle** — aria-label sur les chevrons et les boutons « + » (avec date en toutes lettres), aria-pressed sur le switch de vue, aria-label sur FormatIcon et PlatformIcon ; en revanche PlatformDot et la pastille de statut sont des span purement décoratifs sans texte accessible.

### 2.2 Frictions constatées dans l’UI actuelle

- Aucun drag-and-drop : impossible de déplacer/reprogrammer un contenu en le glissant sur une autre date — la replanification exige d'ouvrir la fiche contenu.
- Le bouton « + » d'un jour ne fait qu'un toast « Action simulée (preview) » : même en phase mock, aucune navigation vers le studio avec la date préremplie n'est prototypée.
- Le lien de débordement « +N autre(s) » envoie vers la liste studio ENTIÈRE du client, sans filtre sur le jour concerné — perte totale du contexte de date ; pas de popover/vue « jour » pour voir les contenus masqués sur place.
- Aucun filtre (par statut, plateforme, format) ni recherche dans le calendrier — le freelance ne peut pas isoler « ce qui reste à faire valider » ou « les Reels IG » du mois.
- Le statut n'est exprimé que par une pastille de couleur de 6px sans libellé, tooltip ni légende : in_review, changes_requested et partially_published partagent le même ton warning et sont indistinguables ; information portée par la couleur seule (problème d'accessibilité), alors que ContentStatusBadge (avec libellé FR) existe et n'est pas utilisé ici.
- Les pastilles plateformes (PlatformDot) sont des points de couleur sans aria-label ni légende — IG/FB/TikTok/Newsletter indistinguables pour un daltonien ou un lecteur d'écran.
- Les contenus non datés (idea/draft avec scheduledAt null) sont exclus en amont : aucune étagère « à planifier » visible depuis le calendrier, alors que le persona travaille en batch mensuel (les mocks contiennent 2 items non datés par client).
- Aucune distinction visuelle des jours/contenus passés ni des publications en retard : un échec (failed) n'affiche qu'un point rouge, lastError (présent dans les mocks : « Token expiré… ») n'est jamais montré ; isPast existe dans lib/format mais n'est pas utilisé par le calendrier.
- Le changement de vue ne conserve pas la période naviguée : curseur mois et ancre semaine sont des états indépendants — naviguer vers juillet en vue mois puis passer en vue semaine ramène à la semaine du 11 juin.
- Pas de saut rapide de date (sélecteur mois/année, mini date-picker) : navigation uniquement chevron par chevron.
- Aucune miniature média dans les entrées (media[0].thumbUrl disponible dans les mocks) — le calendrier est purement textuel alors que le produit est visuel (grille feed à côté).
- Aucune information de quota plateforme (IG 100 posts/24h, FB 30 Reels/24h, TikTok 5 brouillons/24h) ni alerte de densité/conflit horaire dans le calendrier, alors que l'enforcement quota est central au produit.
- La vue semaine n'a ni axe horaire ni indicateur « maintenant » : c'est une liste empilée par jour, pas une grille horaire.
- Mobile (persona PWA iOS prioritaire) : la grille mois reste en 7 colonnes sur iPhone (cellules très étroites, texte 11px tronqué) sans mode condensé (points/compteur) ; le bouton « + » révélé au hover est inopérant au tactile (pas de hover) ; aucun geste swipe pour changer de période.
- Aucun aperçu rapide (popover/sheet) au clic ou survol d'une entrée : toute consultation force une navigation complète vers la fiche contenu puis un retour.
- L'empty state mensuel n'a pas de bouton d'action (prop action non utilisée) : le texte invite à « planifier depuis une case ou le studio » mais n'offre aucun raccourci cliquable.
- Le compte Instagram en needs_reauth (Brûlerie Lacaze dans les mocks) n'est pas signalé dans le calendrier alors que des posts IG y sont programmés — risque d'échec invisible depuis cette vue.
- commentsCount et approvalStale (présents dans les mocks) ne sont pas affichés : impossible de repérer depuis le calendrier un contenu ayant des retours client ou une approbation périmée.
- Aucune multi-sélection ni action par lot (déplacer une semaine entière, demander la validation de plusieurs contenus) — en friction avec le travail en batch mensuel du persona.
- Aucun raccourci clavier (pas de handler keydown : ni flèches pour naviguer, ni T pour aujourd'hui).
- Pas de compteur de cadence (nb de posts du mois/de la semaine, jours sans contenu) alors que l'empty state mentionne explicitement « remplir la cadence ».

### 2.3 Fonctionnalités manquantes proposées (23)

---

**P0 — Indispensable pour un usage pro quotidien**

#### `P0` · Drag-and-drop de replanification _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Glisser une entrée vers une autre case (vue mois) ou un autre jour (vue semaine) la reprogramme instantanément, avec toast de confirmation et annulation (undo). Pendant le drag, les jours invalides (passé, quota atteint) sont grisés et refusent le drop.

- **Valeur freelance** : La replanification est l'opération la plus courante quand un client décale tout ; ouvrir la fiche contenu pour changer chaque date est rédhibitoire face à Later ou Planoly où c'est le geste de base.
- **Inspiration** : Later / Planoly (visual planner)
- **⚠️ Faisabilité** : La replanification depuis le calendrier est prévue (§5.B : modifier la date = annulation/recréation des jobs), le geste DnD non. À cadrer : refus de drop uniquement pour le passé (< maintenant + 15 min) et les statuts non déplaçables (publishing/published — éditabilité §5.B) ; « quota atteint » = avertissement heuristique, jamais refus dur (fenêtres 24h GLISSANTES évaluées à l'heure H par le worker, report auto acté — décision n°11) ; un approved déplacé garde son approbation (date non invalidante) mais notifie (Module F).

#### `P0` · Mois condensé mobile + gestes _(effort M)_
🎨 mockable dès maintenant (UI preview)

Sur iPhone, la vue mois passe en mode condensé : points colorés ou compteur par jour, tap sur un jour ouvre le panneau Jour en bottom sheet, swipe horizontal change de période. Le bouton « + » devient utilisable au tactile (visible en permanence ou dans le sheet) au lieu d'être révélé au hover.

- **Valeur freelance** : Le persona vit dans la PWA iOS : la grille 7 colonnes actuelle est illisible sur iPhone et le bouton « + » est littéralement inatteignable au doigt (hover only).
- **Inspiration** : Planoly mobile / standard iOS

#### `P0` · Étagère « À planifier » _(effort M)_
🎨 mockable dès maintenant (UI preview)

Panneau latéral (desktop) ou tiroir (mobile) listant les contenus du client sans date (idea/draft, scheduledAt null) avec vignette et statut, glissables directement sur une case pour les programmer. Un compteur « 2 à planifier » reste visible dans la toolbar.

- **Valeur freelance** : Le batch mensuel consiste exactement à transformer un stock d'idées en cases remplies ; les contenus non datés sont aujourd'hui exclus en amont du calendrier alors que les mocks en contiennent 2 par client.
- **Inspiration** : Buffer (backlog) / Later (side library)

#### `P0` · Aperçu rapide d'un contenu _(effort M)_
🎨 mockable dès maintenant (UI preview)

Un clic sur une entrée ouvre un popover/sheet : visuel du média, début de légende et hashtags, statut par plateforme (avec permalien si publié), commentaires client, et actions (ouvrir au studio, dupliquer, déplacer, demander validation). Fermeture par clic extérieur ou Échap, sans perdre la position dans le calendrier.

- **Valeur freelance** : Toute consultation force aujourd'hui une navigation complète vers la fiche puis un retour ; sur 17 contenus par client et par mois, l'aperçu sur place change la vitesse de revue du planning.
- **Inspiration** : Buffer / Hootsuite

#### `P0` · Création préremplie depuis une case _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Cliquer le « + » d'un jour (ou double-cliquer la case) ouvre le studio avec la date préremplie et l'heure par défaut à la prochaine heure pleine dans la fenêtre 9h–21h. Remplace l'actuel toast « Action simulée » qui ne fait rien, même en mock. En vue semaine, le même geste reprend le jour de la carte.

- **Valeur freelance** : Planifier depuis le calendrier est le geste n°1 du batch mensuel ; aujourd'hui il faut aller au studio puis ressaisir la date à la main, soit deux frictions sur l'action la plus fréquente.
- **Inspiration** : PRD Lot 1 + Buffer (double-clic jour)
- **Note** : Prévu mot pour mot au PRD §5.D : création depuis une case de date, heure par défaut = prochaine heure pleine fenêtre 9h–21h (fuseau client). Remplace le toast mort actuel (day-cell.tsx) — exécution attendue du Module D.

#### `P0` · Panneau Jour (fix « +N autres ») _(effort S)_
🎨 mockable dès maintenant (UI preview)

Cliquer un jour ou le lien « +N autre(s) » ouvre un popover (desktop) ou bottom sheet (mobile) listant TOUS les contenus du jour avec heure, statut, plateformes et actions rapides (ouvrir, dupliquer, déplacer). Supprime le lien actuel qui éjecte vers la liste studio entière sans filtre de date.

- **Valeur freelance** : Perte totale de contexte aujourd'hui dès qu'un jour dépasse 3 contenus ; le freelance doit consulter et agir sur une journée chargée sans quitter le calendrier.
- **Inspiration** : Buffer / pattern Google Calendar

#### `P0` · Filtres statut, plateforme, format _(effort S)_
🎨 mockable dès maintenant (UI preview)

Barre de filtres dans la toolbar : statut (brouillon, en validation, retours, programmé, publié, échec), plateforme (IG/FB/TikTok/newsletter) et format (post, carrousel, reel, story), combinables, avec compteur de contenus masqués. Les filtres persistent en naviguant de mois en mois.

- **Valeur freelance** : « Qu'est-ce qui n'est pas encore validé ? » et « montre-moi les Reels IG » sont les deux questions quotidiennes du pilotage ; impossible d'y répondre aujourd'hui sans scanner chaque case à l'œil.
- **Inspiration** : Planable / Kontentino

#### `P0` · Statuts lisibles et légende _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Remplacer la pastille 6px par le ContentStatusBadge existant (libellé FR) en vue semaine, et par pastille + libellé court ou motif distinct en vue mois ; ajouter une légende dépliable des couleurs. Différencier enfin in_review, changes_requested et partially_published (même ton warning aujourd'hui) et donner un aria-label aux PlatformDot.

- **Valeur freelance** : Le statut est LA donnée de pilotage du batch : trois états critiques sont actuellement indistinguables et l'information n'est portée que par la couleur, inaccessible aux daltoniens et lecteurs d'écran.
- **Inspiration** : Swello / Planable (codes statuts visibles)
- **Note** : User story explicite du Module D (« je distingue plateformes et statuts »). ContentStatusBadge existe (components/shared/status-badge.tsx) mais n'est pas utilisé au calendrier ; différencier in_review/changes_requested/partially_published + aria-labels = exécution attendue, zéro contrainte API.

#### `P0` · Échecs visibles avec re-essai _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Une entrée failed devient saillante (fond et bordure danger, icône alerte) avec la raison (lastError, déjà dans les mocks : « Token expiré ») en tooltip et dans l'aperçu, plus un bouton « Reprogrammer » en un clic. Un partially_published montre quelle plateforme a échoué et laquelle est publiée.

- **Valeur freelance** : L'échec silencieux est la plainte n°1 contre Later et Planoly (avis 1 étoile récurrents) et le tueur de confiance absolu quand le post raté est celui d'un client payant.
- **Inspiration** : Publer (re-essai) + avis G2/Trustpilot Later
- **Note** : Retry ciblé failed → scheduled prévu (§5.B) ; motif d'échec exposé (Module E « notifié de chaque échec avec le motif exact ») ; détail par plateforme = raison d'être de ContentTarget. Contrainte : « Reprogrammer » ne re-programme QUE les cibles failed, jamais re-publication d'une cible publiée (idempotence §5.E), nouvelle date ≥ maintenant + 15 min.

#### `P0` · Alerte compte à reconnecter _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Bandeau en tête de calendrier quand un compte social du client est en needs_reauth avec des posts programmés : « 4 posts Instagram risquent d'échouer — reconnecter le compte », lien direct vers réglages comptes. Les entrées concernées portent un marqueur d'avertissement individuel.

- **Valeur freelance** : Brûlerie Lacaze (mock) a un IG expiré et des posts programmés dessus, invisibles depuis cette vue : c'est exactement le scénario catastrophe que le health check token d'Ocean doit rendre impossible.
- **Inspiration** : original (health check Ocean)
- **Note** : Health check quotidien + needs_reauth + notification AVANT l'heure H explicitement prévus (§5.E, §7.4, Module I). Le bandeau calendrier est une surface d'affichage supplémentaire cohérente ; needs_reauth existe déjà au mock SocialAccount.

---

**P1 — Différenciant fort**

#### `P1` · Multi-sélection et actions par lot _(effort L)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Mode sélection (checkbox au survol desktop, appui long mobile) pour cocher plusieurs contenus puis agir d'un coup via une barre flottante : décaler de N jours, envoyer en validation, dupliquer, annuler. Fonctionne en vue mois comme en vue semaine, sélection conservée en changeant de période.

- **Valeur freelance** : Envoyer les 15 posts du mois en validation en UN clic au lieu de 15, ou décaler d'une semaine tout un lancement reporté : la différence entre un outil pensé batch et un outil poste-par-poste.
- **Inspiration** : Planable / Sked Social (bulk edit)
- **⚠️ Faisabilité** : L'envoi en revue par LOT existe déjà (ReviewRequest, Module F) — la multi-sélection calendrier en est une bonne porte d'entrée. À borner : chaque action de lot respecte l'éditabilité par statut (§5.B : pas de décalage des publishing/published ; décaler = annulation/recréation des jobs) et les bornes de date (≥ maintenant + 15 min) ; afficher les éléments ignorés du lot.

#### `P1` · Pilotage validation client _(effort M)_
🎨 mockable dès maintenant (UI preview)

Les entrées affichent un badge retours client (commentsCount) et un marqueur « approbation périmée » (approvalStale) ; un filtre dédié « en attente client » et un bouton « Relancer » par contenu envoient un rappel au Reviewer sans quitter le calendrier. L'état des ReviewRequests (pending/partial/done, déjà mocké) est visible sur les jours concernés.

- **Valeur freelance** : La validation est le goulot n°1 du métier (47 % des marketeurs, CMI 2025) : à J-3 de la fin du mois, le freelance doit voir en 2 secondes ce qui bloque chez quel client et relancer en un clic.
- **Inspiration** : Agorapulse / Planable + portail Ocean

#### `P1` · Marronniers FR en overlay _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Calque activable affichant fêtes, journées mondiales, temps forts commerciaux et vacances scolaires françaises dans les cases, avec packs thématiques activables par client (food, e-commerce, B2B, artisanat). Cliquer un marronnier propose « créer un contenu pour cette date » prérempli.

- **Valeur freelance** : Source n°1 d'idées du batch et filet anti-oubli (Fête des mères, soldes, Chandeleur) ; c'est LE différenciant FR de Swello face aux outils US, parfaitement aligné avec la cible FR-only d'Ocean.
- **Inspiration** : Swello (400+ marronniers FR) / Metricool
- **⚠️ Faisabilité** : Hors PRD mais faisable sans aucune API (dataset statique FR à maintenir : fériés, vacances zones A/B/C, journées). Limiter au calque national unique + « créer un contenu prérempli » (réutilise §5.D) ; les packs thématiques par client = backlog (scope creep sur un PRD verrouillé).

#### `P1` · Quotas et densité par jour _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Indicateurs dans les cases chargées : alerte si Reels FB > 30/24h ou brouillons TikTok > 5/24h sur un même compte, rappel du quota IG, et avertissement quand deux posts du même compte sont à moins de quelques minutes. Un post reporté automatiquement (quota IG atteint) porte un badge « décalé » montrant ancienne et nouvelle date.

- **Valeur freelance** : L'enforcement quota est central au produit mais invisible dans la vue de planification ; montrer OÙ un post a été décalé évite l'effet « l'outil a bougé mon post sans prévenir » qui détruit la confiance.
- **Inspiration** : original (règles Ocean) + Publer (respacing)
- **Note** : Rôle UI explicitement prévu : « enforcement côté DB/worker (source de vérité), UI = affichage ergonomique du quota restant » (CLAUDE.md §6) ; badge « décalé » = décision actée n°11 (report auto quota IG + notification du décalage). Présenter les seuils (FB 30 Reels, TikTok 5 brouillons, IG 100) comme fenêtres 24h glissantes par compte, pas comme quotas par jour calendaire.

#### `P1` · Piliers de contenu et jauge de mix _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Chaque contenu peut porter un pilier coloré défini par client (éducation, preuve sociale, promo, coulisses) avec ratio cible ; la couleur apparaît en liseré sur les entrées et une jauge compare le mix planifié du mois au ratio promis. Filtre par pilier inclus dans la barre de filtres.

- **Valeur freelance** : Vérifier d'un coup d'œil que le mois n'est pas « tout promo » avant l'envoi en validation : argument de professionnalisme à la revue mensuelle et garde-fou contre la dérive imposée par le client.
- **Inspiration** : SocialBee / Loomly / Buffer (tags)
- **⚠️ Faisabilité** : Aucune dépendance API, vraie pratique CM, mais absent du PRD v0.2 verrouillé (nouvelle dimension de données : pilier par contenu + ratios par client). Si retenu en preview : limiter à un tag pilier coloré + liseré + filtre ; ratios cibles et jauge de mix = extension post-MVP.

#### `P1` · Export PDF du planning _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Bouton « Exporter » générant un livrable mensuel du client : grille calendrier avec vignettes, légendes, statuts et heures, en PDF ou CSV, avec option d'inclure ou non les notes internes. Mocké en phase preview par une vue d'impression propre (print stylesheet) et un aperçu avant export.

- **Valeur freelance** : Beaucoup de clients FR non-tech veulent un planning figé à archiver ou faire suivre en interne ; l'export en un clic remplace le deck fabriqué à la main chaque fin de mois.
- **Inspiration** : Kontentino (export PDF/CSV)
- **⚠️ Faisabilité** : MVP : print stylesheet (impression navigateur) comme proposé, coût quasi nul. Génération PDF/CSV serveur = backlog, aligné « Rapports clients PDF » (PRD §4). Un livrable destiné au client exclut par défaut notes internes ET états techniques (failed/partially_published masqués au client, cohérent §5.F).

#### `P1` · Événements et notes client _(effort S)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Ajouter au calendrier des éléments non-post propres au client : salon, lancement produit, fermeture estivale, ou note de contexte (« semaine promo -20 % ») affichés en bandeau sur les jours concernés. Chaque élément est marqué interne ou visible du client (repris alors dans le portail de validation).

- **Valeur freelance** : Le freelance planifie autour de la vie réelle du client au lieu de la découvrir en cours de mois, et donne le contexte de campagne sans passer par WhatsApp.
- **Inspiration** : Swello / Agorapulse (notes partagées)
- **⚠️ Faisabilité** : Faisable (nouvelle entité simple org_id/client_id), utile au contexte de planification. Garder INTERNE au MVP : l'option « visible du client » élargirait le périmètre du portail Reviewer, strictement défini au §5.F (contenus en revue uniquement, jamais les notes) — à trancher séparément si besoin.

#### `P1` · Miniatures médias dans les cases _(effort S)_
🎨 mockable dès maintenant (UI preview)

Chaque entrée affiche la vignette du premier média (media[0].thumbUrl, déjà mocké) : micro-miniature carrée en vue mois, vignette large en vue semaine, avec indicateur carrousel/vidéo. Toggle « compact / visuel » dans la toolbar pour les calendriers chargés.

- **Valeur freelance** : Le produit est visuel (grille feed dans l'onglet voisin) mais son calendrier est purement textuel ; le freelance reconnaît un post à son image bien plus vite qu'à son titre tronqué en 11px.
- **Inspiration** : Later / Planoly

#### `P1` · Trous de cadence et compteurs _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

La toolbar affiche « 14 posts ce mois · 3 jours sans contenu la semaine prochaine » et les périodes vides au-delà d'un seuil sont marquées discrètement dans la grille. Un bandeau « Rien de programmé la semaine prochaine pour ce client » apparaît quand le risque est imminent.

- **Valeur freelance** : Le filet anti-oubli du travail en batch sur 3-10 clients ; Plann en a fait un argument commercial central, et l'empty state actuel parle de « cadence » sans donner le moindre chiffre ni raccourci.
- **Inspiration** : Plann (gap detection)
- **Note** : Mission explicite du Module D : « sert à planifier la cadence et repérer les trous » (§5.D). Compteurs et bandeaux = exécution directe, calcul local sans dépendance API.

#### `P1` · Dupliquer vers une date ou un client _(effort S)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Menu contextuel sur chaque entrée : « Dupliquer » vers une autre date du même client ou vers un autre client, en copiant média, légende et ciblage ; la copie repart en brouillon à adapter avec son propre circuit de validation. Accessible aussi depuis l'aperçu rapide et la multi-sélection.

- **Valeur freelance** : Deux restos, trois artisans : un format qui marche se décline ; recréer à la main le même post « journée mondiale » pour chaque client du secteur coûte des heures chaque mois.
- **Inspiration** : Planable / Kontentino / Sked Social
- **⚠️ Faisabilité** : Duplication même client : OK (échappatoire prévue §5.B « dupliquer le contenu pour repartir », copie en draft avec son circuit de validation). Cross-client : exige la COPIE physique des médias vers le chemin du client cible (chemins {org_id}/{client_id}/… = mécanisme d'isolation, règle 21) et un original encore présent (purge J+7 → flux « re-uploader le média », Module J). Trivial en mock, à borner pour le réel.

#### `P1` · Canaux manuels différenciés _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Les contenus non publiables par API (brouillon TikTok, newsletter, canal custom) s'affichent avec un traitement distinct (bordure pointillée, icône cloche/main) et l'heure du rappel push prévu. L'état « poussé sur TikTok, à finaliser » (pushed_to_platform) est visible et relançable depuis la case du calendrier.

- **Valeur freelance** : Un seul modèle mental pour le semi-automatique : le freelance doit savoir au premier regard ce qui partira tout seul et ce qui exigera son téléphone à 18h — aujourd'hui un post newsletter ressemble trait pour trait à un post API.
- **Inspiration** : Planoly (rappels Stories) / mode brouillon TikTok Ocean
- **Note** : États awaiting_manual (newsletter/sur-mesure) et pushed_to_platform (TikTok brouillon, seul mode possible — analyse §2.3) + rappel à l'heure H + relance J+1 explicitement prévus (Modules E/I). Le traitement visuel distinct au calendrier est l'exécution attendue ; « relancer/marquer publié » depuis la case = actions déjà spécifiées.

---

**P2 — Confort**

#### `P2` · Navigation rapide et mémoire de vue _(effort S)_
🎨 mockable dès maintenant (UI preview)

Clic sur le libellé de période ouvre un sélecteur mois/année (mini date-picker) ; la période naviguée est conservée en basculant Mois ⇄ Semaine (aujourd'hui la bascule ramène au 11 juin) ; raccourcis clavier : flèches pour la période, T pour aujourd'hui, M/S pour la vue, N pour nouveau contenu.

- **Valeur freelance** : Micro-frictions cumulées d'un écran utilisé des heures par jour : huit clics de chevron pour atteindre février et une bascule de vue qui téléporte cassent le flow du power user.
- **Inspiration** : Buffer (micro-UX calendrier)

#### `P2` · Traitement visuel du passé _(effort S)_
🎨 mockable dès maintenant (UI preview)

Les jours et contenus passés sont atténués (opacité réduite, fond distinct), les publiés affichent un lien permalien direct, et une ligne « aujourd'hui » sépare visuellement passé et futur en vue semaine. Le helper isPast existe déjà dans lib/format mais n'est pas utilisé par le calendrier.

- **Valeur freelance** : Le calendrier sert aussi d'historique du mois (les publiés/échoués passés y figurent) mais rien ne distingue ce qui est derrière de ce qui reste à produire — l'œil doit relire les dates en permanence.
- **Inspiration** : original / pattern calendriers standards

### 2.4 Écartées par le filtre de faisabilité (3)

| Feature | Raison |
|---|---|
| Créneaux récurrents (placeholders) | « Modèles récurrents » explicitement classés V2 au PRD §4 (ligne Calendrier éditorial). Hors MVP — ne pas le maquetter en preview pour ne pas créer d'attente sur la phase solo. |
| Vue multi-clients superposée | Explicitement V2 au PRD §4 (ligne Calendrier éditorial : « vue multi-clients superposée »). Le besoin transversal MVP est déjà couvert par l'agenda unifié (Module G : publications tous clients + rendez-vous). |
| Meilleures heures suggérées | « Meilleurs créneaux » est explicitement V2 (PRD §4, ligne Statistiques — MVP sans stats) ; la version réelle dépend des insights, en pleine dépréciation v25→v26 fin 2026 (analyse §2.2). Un calque statique « par secteur » afficherait une recommandation sans fondement que le MVP ne peut pas honorer. |


## 3. Studio de contenu

### 3.1 État des lieux — ce qui existe déjà

- **Grille de cartes responsive** — La liste affiche les contenus du client en grille 1 colonne mobile / 2 (sm) / 3 (lg) / 4 (xl). Chaque carte est entièrement cliquable (Link) vers la page détail, avec hover (bordure primary/40, fond accent/20, titre souligné). Source : content-board.tsx + content-card.tsx.
- **En-tête avec compteur dynamique** — Titre « Studio de contenu » + sous-titre « N contenus » (pluriel géré), qui devient « N contenus sur M » quand un filtre est actif, + rappel du fuseau du client (« fuseau Europe/Paris »).
- **Bouton « Nouveau contenu » (x2)** — Présent deux fois sur la page liste : dans le layout client (layout.tsx) et dans l'en-tête du board. Les deux pointent vers routes.clientContent(client.id), c'est-à-dire la page liste elle-même — aucun formulaire derrière.
- **Filtre Statut** — ToggleGroup outline single-select : « Tous » + 8 statuts dans l'ordre du cycle de vie (Brouillon, En revue, Modifs demandées, Approuvé, Programmé, Publication…, Publié, Échec). Labels FR via contentStatusMeta. idea / partially_published / canceled absents du filtre.
- **Filtre Plateforme** — « Toutes » + plateformes dérivées dynamiquement des cibles réellement présentes dans les contenus du client (Set sur items.targets), chaque option avec icône de marque colorée (var(--instagram) etc.) + label.
- **Filtre Format** — « Tous » + Post / Carrousel / Reel / Story (liste statique FORMAT_FILTERS). Filtres combinables entre rangées (ET logique statut × plateforme × format), mais une seule valeur par rangée.
- **Réinitialisation des filtres** — Bouton « Réinitialiser » (variant link, xs) affiché dans la barre de filtres uniquement si au moins un filtre est actif ; second bouton « Réinitialiser les filtres » dans l'état vide filtré.
- **Filtres scrollables (mobile)** — Chaque rangée de filtres est dans un conteneur overflow-x-auto : les ToggleGroups débordants se scrollent horizontalement sur petit écran. Layout label/options empilé en mobile, en ligne en sm+.
- **État vide de liste** — EmptyState (icône SlidersHorizontal, bordure dashed) « Aucun contenu ne correspond » + « Ajuste ou réinitialise les filtres… », avec bouton reset seulement si isFiltered. Le même message s'affiche pour un client sans aucun contenu.
- **Carte : cover média** — MediaThumb du 1er média en ratio 4:3 (next/image, sizes adaptés) ; badge Film en haut à droite si vidéo ; badge Layers + nombre si carrousel (count > 1) ; fallback : bloc muted avec icône + label du format si 0 média (cas idea/newsletter).
- **Carte : métadonnées** — Titre clampé 2 lignes ; badge de statut (pastille de couleur tonale + label FR via ContentStatusBadge) ; rangée d'icônes des plateformes ciblées (PlatformIcons, couleurs de marque) ; format avec icône (FormatLabel) ; date/heure programmée formatée fr-FR dans le fuseau du client, ou « Sans date » en italique avec icône CalendarOff.
- **Carte : compteur de commentaires** — Icône MessageSquare + nombre (tabular-nums), affiché seulement si commentsCount > 0. Pas de notion lu/non-lu.
- **Détail : retour + layout 2 colonnes** — Bouton ghost « Retour au studio » (ArrowLeft). Grille lg : colonne principale + aside fixe 22rem (cartes Actions et Validation client) ; tout est empilé en mobile.
- **Détail : en-tête statut** — ContentStatusBadge + FormatLabel + badge conditionnel « Approbation périmée » (TriangleAlert, tonalité warning) si content.approvalStale. Titre h1, puis ligne méta : date programmée (icône Clock) ou « Sans date » (CalendarOff) + rappel « Fuseau {tz} ».
- **Détail : bandeau d'erreur** — Si content.lastError : encart bordure/fond destructive avec icône TriangleAlert et le message (ex. « Token expiré : reconnecte le compte Instagram. », « Facebook : média refusé (ratio non conforme). »).
- **Détail : visionneuse médias** — ContentDetailMedia (client component) : média actif en carré plein cadre ; badge durée si vidéo (« 18s » ou « Vidéo ») ; compteur « n / N » si plusieurs médias ; bande de vignettes 64px scrollable, cliquables, état actif (bordure primary, opacité), aria-label/aria-current, overlay Film sur les vignettes vidéo ; état vide « Aucun média » (dashed + ImageOff).
- **Détail : champs éditoriaux** — Blocs avec icône + label : « Objet de la newsletter » (conditionnel), « Légende » (rendu multiligne whitespace-pre-line), hashtags en badges secondary préfixés « # », « Notes internes » (conditionnel, en muted). Lecture seule — aucun champ éditable.
- **Détail : section Cibles** — « Cibles (N) » : une ligne par ContentTarget avec icône plateforme dans une tuile, nom de la plateforme, « Publié le {date} » si publishedAt (fuseau client), TargetStatusBadge (En attente / En file / Publication… / À publier manuellement / Publié / Brouillon poussé / Échec / Ignoré / Annulé), bouton « Voir » (lien externe permalink, target _blank) si publié.
- **Détail : actions contextuelles au statut** — ContentActions mappe l'action primaire : idea/draft → « Programmer » + « Envoyer en revue » ; changes_requested → « Renvoyer en revue » ; in_review → « Retirer de la revue » ; approved → « Programmer » ; scheduled → « Modifier la date » ; failed → « Reprogrammer les échecs » ; défaut (canceled) → « Dupliquer ». Actions secondaires : « Modifier le contenu » (masqué en in_review), « Dupliquer », et bouton destructive « Annuler la programmation » (libellé si scheduled) / « Abandonner ».
- **Détail : verrou lecture seule post-publication** — Pour publishing / published / partially_published : Alert avec icône Lock « Contenu en lecture seule — La publication a commencé… » et unique bouton « Dupliquer le contenu » (conforme PRD §5.B, commenté dans le code).
- **Feedback d'action simulée** — Chaque bouton d'action déclenche un toast sonner success (« Contenu programmé », « Envoyé en revue »…) avec la description « Action simulée (preview) ». Aucun état local/navigations ne change.
- **Détail : panneau « Validation client »** — ContentReviewPanel : décisions (carte verte « Approuvé » / orange « Modifications demandées », icône check/X, badge de version « v1 », message du reviewer, horodatage relatif FR) ; séparateur ; fil de commentaires (avatar initiales, nom, badge « Moi »/« Client », mention textuelle « Pin · slide N » avec icône MapPin si le commentaire porte une annotation, corps, horodatage relatif) ; EmptyState « Pas encore de retour » sinon.
- **Portail : actions de revue (miroir client)** — ReviewActions : gros boutons « Approuver » (vert success) et « Demander des modifications » (toggle) ; zone repliable animée (grid-rows + opacity) contenant une Textarea (placeholder explicite, aria-label), boutons « Annuler » / « Envoyer la demande » (désactivé si message vide après trim) ; toast simulé incluant le titre du contenu ; phrase de réassurance « Votre décision est enregistrée… ».
- **Portail : visionneuse annotée (miroir client)** — AnnotationViewer + MediaCarousel : carrousel ratio 4:5 avec flèches circulaires (wrap), dots de pagination (état actif élargi), compteur n/N, badge « Vidéo » ; pins numérotés positionnés en pourcentage (x,y normalisés) sur le slide courant, cliquables (scale-125 + couleur si actif) ; hint « Touchez un repère sur le visuel… » ; fil de commentaires cliquable qui synchronise slide + pin actif (focusComment), numéro de pin rappelé dans le fil, distinction visuelle Client / « Votre agence ».
- **Garde-fous d'URL** — notFound() si client inexistant, contenu inexistant, ou contentId n'appartenant pas au clientId de l'URL (vérification content.clientId !== clientId dans la page détail) — l'isolation inter-clients est simulée dès les mocks.
- **Contexte client persistant (layout)** — Le layout client affiche avatar, nom, @handle, fuseau, icônes des comptes sociaux connectés et les onglets de navigation (ClientTabs : calendrier / grille / studio) au-dessus des deux pages.
- **Accessibilité ponctuelle** — aria-label sur vignettes médias, pins, flèches du carrousel et textarea du portail ; aria-current sur vignette et dot actifs ; icônes de format avec aria-label ; tabular-nums sur les dates/compteurs.

### 3.2 Frictions constatées dans l’UI actuelle

- « Nouveau contenu » est un lien mort : les deux boutons (layout client + en-tête du studio) pointent vers la page liste elle-même. Aucune page, dialog ou formulaire de création n'existe (pas d'upload, pas de saisie de légende, pas de ciblage de plateformes).
- « Modifier le contenu » n'ouvre rien : aucun éditeur n'est prototypé. Le détail est 100 % lecture seule, même pour un brouillon.
- Aucune recherche texte dans la liste (titre, légende, hashtag non cherchables) — gênant dès ~17 contenus par client dans les mocks.
- Aucun tri ni pagination : l'ordre affiché est l'ordre de génération du mock (ordre du BLUEPRINT, mélange passé/futur/sans date), sans contrôle utilisateur.
- Filtre Statut incomplet et mono-sélection : idea, partially_published et canceled existent dans les données mais ne sont sélectionnables par aucun filtre (visibles uniquement en « Tous ») ; impossible de combiner deux statuts (ex. « tout ce qui attend une action »).
- Toutes les actions du détail sont des toasts sans surface UI : « Programmer » n'ouvre pas de sélecteur de date/heure, « Envoyer en revue » ne propose ni choix du reviewer ni message d'accompagnement, « Modifier la date » n'affiche pas de calendrier, « Dupliquer » ne navigue pas. Même en preview UI-only, aucun de ces écrans intermédiaires n'est prototypé.
- Les annotations ne sont pas visibles côté studio : ContentReviewPanel affiche « Pin · slide N » en texte, mais ContentDetailMedia ne superpose aucun pin sur le média et cliquer un commentaire ne navigue pas vers le slide concerné. L'AnnotationViewer (pins cliquables, sync slide/commentaire) n'existe que côté portail — le freelance, premier concerné par « où est la remarque », ne le voit pas.
- Impossible de répondre à un commentaire client depuis le studio : aucun champ de saisie dans le panneau Validation client, alors que des réponses owner existent dans les mocks (COMMENTS contient des messages role=owner).
- Les cibles n'affichent pas le compte social concret : socialAccountId n'est jamais résolu vers SOCIAL_ACCOUNTS (pas de @username, pas de followers) ni l'état du compte — l'Instagram de Brûlerie Lacaze est needs_reauth dans les mocks mais rien ne l'indique sur un contenu programmé vers Instagram avant l'échec.
- Échec par cible sans détail ni action ciblée : badge « Échec » sans message d'erreur propre à la cible (lastError est global au ContentItem), pas de bouton « réessayer cette cible » ; et « Reprogrammer les échecs » n'existe que pour le statut global failed — un partially_published est en lecture seule, sa cible Facebook en échec n'a aucune action de reprise.
- Cible TikTok « Brouillon poussé » sans outillage : pas de bouton « copier la légende », pas de relance, pas de lien vers l'app — alors que le flux TikTok-brouillon du PRD repose dessus.
- Aucune visibilité des quotas plateformes (IG 100 posts/24h, FB 30 Reels/24h/Page, TikTok 5 brouillons/24h) au moment de cibler ou programmer, dans la liste comme dans le détail.
- Pas d'aperçu « rendu plateforme » ni de garde-fous de specs : pas de compteur de caractères de légende, pas de variante de légende par plateforme (un même caption sert IG/FB/TikTok/newsletter), aucun contrôle ratio/durée/poids affiché alors que MediaAsset porte width/height/durationSec.
- Aucune action batch alors que la persona travaille en batch mensuel : pas de sélection multiple de cartes, pas d'envoi groupé en revue — le type ReviewRequest (contentIds[], state pending/partial/done) et getReviewRequest() existent dans les mocks mais ne sont consommés par AUCUNE page (grep confirmé).
- « Sans date » non actionnable : pas de programmation rapide depuis la carte ou la liste (il faut ouvrir le détail puis cliquer un bouton simulé) ; aucun signalement des contenus programmés dans le passé/en retard.
- L'état vide d'un client sans aucun contenu affiche le message orienté filtres (« Ajuste ou réinitialise les filtres ») sans CTA « Créer un contenu » — incohérent quand isFiltered est false.
- Badge « Approbation périmée » purement informatif : pas d'action contextuelle (renvoyer en revue) ni d'explication de ce qui a changé depuis l'approbation.
- Visionneuse du détail : pas de navigation clavier/flèches ni swipe (uniquement clic sur vignettes, contrairement au carrousel du portail qui a des flèches), pas de lecture vidéo (les assets video sont des images figées avec badge), pas de zoom.
- Le portail ne permet pas au client de poser un pin : les annotations mockées sont en lecture seule, ReviewActions n'offre qu'un message texte global — la boucle d'annotation n'est prototypée que dans le sens affichage.

### 3.3 Fonctionnalités manquantes proposées (21)

---

**P0 — Indispensable pour un usage pro quotidien**

#### `P0` · Composer de création et d'édition de contenu _(effort L)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

« Nouveau contenu » et « Modifier le contenu » ouvrent enfin un vrai écran : zone de dépôt de médias, choix du format (post, carrousel, Reel, story), légende, hashtags, notes internes, ciblage des plateformes par compte connecté, champ objet si Newsletter, date optionnelle. Le même composer sert en édition, pré-rempli, en appliquant les règles d'éditabilité par statut du PRD (retrait de revue obligatoire en in_review, date seule en scheduled).

- **Valeur freelance** : C'est le cœur du studio et les deux boutons sont aujourd'hui des liens morts : rien ne se crée ni ne s'édite. Sans composer, impossible de valider le parcours principal du freelance pendant la preview front.
- **Inspiration** : PRD Lot 1 + Buffer (composer multi-canaux)
- **Note** : Cœur du Module B : anatomie complète (cibles par compte, format, légende+hashtags, notes internes, objet newsletter dès le MVP, date optionnelle) et règles d'éditabilité par statut (retrait de revue en in_review, date seule en scheduled) sont littéralement le PRD §5.B. Indispensable à la preview.

#### `P0` · Programmation outillée : dialog date/heure + rattrapage des retards _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

« Programmer » et « Modifier la date » ouvrent un sélecteur date/heure dans le fuseau du client avec garde-fou « ≥ maintenant + 15 min » et rappel de l'heure dans le fuseau du freelance. Les cartes « Sans date » gagnent une programmation rapide sans ouvrir le détail, et les contenus programmés dans le passé reçoivent un badge « En retard » avec action de reprogrammation immédiate.

- **Valeur freelance** : Programmer est l'action n°1 du studio et elle n'a aucune surface UI (simple toast simulé). Le freelance repère aussi d'un coup d'œil les trous et retards de son pipeline.
- **Inspiration** : PRD Lot 1 + pratique métier
- **⚠️ Faisabilité** : Garde-fou ≥ maintenant+15 min, saisie en TZ client et flux « à reprogrammer » sont déjà au PRD (§5.A, §5.B). À ajuster : un scheduled dépassé n'est pas un état stable côté réel — fenêtre de grâce <2 h = publication au rattrapage, au-delà = failed + notification (décision actée n°12). Le badge « En retard » doit refléter ces deux cas, pas un scheduled flottant.

#### `P0` · Envoi en revue outillé et demandes groupées _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

« Envoyer en revue » ouvre un dialog : reviewer destinataire (avec sa dernière activité, ex. jamais connecté), message d'accompagnement, et ajout d'autres contenus du même client pour une demande groupée. La demande vit ensuite dans le studio avec son état (en attente / partielle / terminée), en consommant le modèle ReviewRequest et le ReviewStateBadge déjà présents dans les mocks mais orphelins.

- **Valeur freelance** : La validation client est la boucle centrale d'Ocean et son modèle existe sans aucune UI. En batch mensuel, on envoie 15 contenus à valider en une fois, pas en quinze allers-retours.
- **Inspiration** : Kontentino / Planable + modèle ReviewRequest des mocks
- **Note** : C'est exactement l'entité ReviewRequest du Module F : lot de contenus niveau client, destinataires, message, état dérivé (en attente/partiel/traité). Les mocks ont déjà ReviewRequest + ReviewStateBadge orphelins (vérifié : définis, jamais rendus) et Reviewer.lastActiveAt — la feature les branche enfin.

#### `P0` · Sélection multiple et actions en lot _(effort M)_
🎨 mockable dès maintenant (UI preview)

Un mode sélection sur la liste (checkbox au survol, appui long sur mobile) fait apparaître une barre d'actions : envoyer en revue, programmer en série, dupliquer, abandonner. Compteur de sélection et actions désactivées selon les statuts mélangés guident l'utilisateur.

- **Valeur freelance** : La persona travaille en batch mensuel : préparer 20 contenus puis les traiter un par un est exactement la friction qu'Ocean promet de supprimer.
- **Inspiration** : Vista Social (multi-sélection) + workflow batch

#### `P0` · Fil de discussion bidirectionnel avec onglets Interne / Client _(effort M)_
🎨 mockable dès maintenant (UI preview)

Le panneau Validation client gagne un champ de réponse (des réponses role=owner existent déjà dans les mocks sans aucune UI de saisie) et deux onglets : « Client » (visible au portail) et « Interne » (notes de travail jamais exposées), avec un marquage visuel net de la confidentialité.

- **Valeur freelance** : Impossible aujourd'hui de répondre à un retour client sans sortir d'Ocean. La séparation interne/client évite la fuite catastrophique d'une note de travail vers le portail — l'erreur qui détruit une relation de prestation.
- **Inspiration** : Kontentino (Team chat Interne/Client)

#### `P0` · Erreur et relance par cible _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Chaque cible en échec porte son propre message d'erreur (nécessite de déplacer lastError de ContentItem vers ContentTarget dans les mocks) avec deux actions : « Réessayer cette cible » et « Ignorer cette cible » (skipped). Un partially_published reste actionnable sur ses cibles failed, sans jamais retoucher les cibles déjà publiées.

- **Valeur freelance** : Le retry ciblé est acté au PRD mais n'a aucune surface : aujourd'hui un contenu partiellement publié avec une cible Facebook en échec est une impasse totale en lecture seule.
- **Inspiration** : PRD (retry ciblé Lot 2)
- **Note** : Aligné mot pour mot sur §5.B : retry ciblé des seules cibles failed, skipped sur abandon, partially_published actionnable, jamais de re-publication d'une cible en succès (idempotence). Déplacer lastError vers ContentTarget colle au modèle réel (last_error vit sur publish_jobs, 1 par cible).

#### `P0` · Centre de publication manuelle (TikTok, Stories, newsletter) _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Pour les cibles pushed_to_platform et awaiting_manual : bouton « Copier la légende », lien d'ouverture de l'app concernée, marquage « Publié manuellement » avec permalink optionnel, et rappel programmé si le brouillon TikTok n'est jamais finalisé. Le statut awaiting_manual, défini dans les types mais jamais produit par le générateur, devient un vrai état visible (newsletter, Stories avec stickers).

- **Valeur freelance** : Tout le flux TikTok-brouillon du PRD repose sur cet outillage absent. L'étendre aux Stories interactives et à la newsletter couvre tous les canaux hors API avec un seul pattern, y compris depuis l'iPhone à l'heure H.
- **Inspiration** : PRD + Metricool / Buffer (notification publishing)
- **⚠️ Faisabilité** : Le centre lui-même est prévu (pushed_to_platform + copier la légende + marquer publié + relance J+1 ; awaiting_manual newsletter/sur-mesure — §5.E, Module I ; statut jamais produit par les mocks, vérifié). Correction : les Stories IG/FB SE PUBLIENT par API au MVP (analyse §2.1/§2.2, /photo_stories, /video_stories) — ne pas les ranger en manuel ; le cas « story avec stickers » (non supportés par l'API) passe par le canal Sur mesure.

#### `P0` · Éditeur de carrousel : réordonnancement et limites API _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Dans le composer, les vignettes du carrousel se réordonnent par glisser-déposer (MediaAsset.position existe déjà dans les mocks, sans aucune UI), avec aperçu du swipe, compteur « 7/10 » et mention claire de la limite de 10 slides via l'API Meta.

- **Valeur freelance** : Le carrousel est le format n°1 des SMM et le plus buggé chez les concurrents. Réordonner sans re-uploader est une friction quotidienne du batch, et l'ordre des médias invalide l'approbation (PRD) : il doit donc être manipulable et visible.
- **Inspiration** : Apaya / ContentStudio / Buffer (limite API affichée)
- **Note** : Limite 10 slides exacte (analyse §2.1, Module J : ≤10 médias ordonnés) ; MediaAsset.position existe au modèle et dans les mocks sans UI (vérifié). Le drag & drop de slides est la matérialisation attendue.

#### `P0` · Validation des specs médias à l'upload _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Au dépôt d'un fichier, contrôle immédiat selon les plateformes ciblées : ratio (4:5–1.91:1 IG), poids (≤8 MB JPEG), durée et format vidéo, avec message d'erreur en français et proposition de correction (conversion JPEG simulée, recadrage). La validation se rejoue si on change les cibles ou le format, comme acté au PRD.

- **Valeur freelance** : Planoly est explicitement critiqué parce que les erreurs surgissent à l'heure H, quand on ne peut plus corriger. width/height/durationSec sont déjà dans les mocks : tous les cas d'erreur sont simulables dès maintenant.
- **Inspiration** : PRD Lot 1 (Module J) + plaintes Capterra Planoly
- **Note** : Module J intégral : validation par plateforme ciblée à l'upload, conversion JPEG/HEIC côté client, messages FR avant programmation, et re-validation au changement de cibles/format explicitement au §5.B. Specs citées exactes (4:5–1.91:1, ≤8 MB JPEG IG).

#### `P0` · Compteurs de caractères et ligne de coupure « … plus » _(effort S)_
🎨 mockable dès maintenant (UI preview)

Sous la légende, un compteur en temps réel par plateforme ciblée (2 200 IG, 63 206 FB, 2 200 TikTok) qui passe en alerte au dépassement, et un marqueur visuel à ~125 caractères montrant où Instagram tronquera la légende dans le feed.

- **Valeur freelance** : Évite la légende tronquée publiée chez un client — l'erreur bête qui coûte la confiance — et pousse à placer le hook avant le « … plus », gain d'engagement mécanique pour tous les clients.
- **Inspiration** : Publer / Hootsuite

#### `P0` · Annotations client visibles dans le studio _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Les pins numérotés posés par le client s'affichent en surimpression sur les médias du détail studio (réutilisation directe de l'AnnotationViewer du portail), et cliquer un commentaire « Pin · slide N » navigue vers le slide concerné en mettant le pin en évidence.

- **Valeur freelance** : Le freelance est le premier concerné par « où est la remarque » et il est le seul à ne pas voir les pins aujourd'hui. Corrige l'asymétrie la plus absurde du flux de validation, à coût quasi nul (composant existant).
- **Inspiration** : Parité interne (AnnotationViewer du portail) / Planable
- **Note** : Les annotations pin (x,y) par slide sont actées (Module F, analyse §4) et « l'owner voit l'historique complet » est une règle PRD — l'affichage côté studio en est la contrepartie évidente. Réutilisation de l'AnnotationViewer du portail = zéro coût nouveau pattern.

#### `P0` · Cibles reliées aux comptes réels + alerte reconnexion _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Chaque ContentTarget affiche le compte concret (@username, avatar, followers) résolu depuis SOCIAL_ACCOUNTS au lieu du seul nom de plateforme. Si le compte est en needs_reauth ou expired, un badge « Reconnexion requise » apparaît dès la programmation, avec lien vers Réglages > Comptes.

- **Valeur freelance** : Dans les mocks, deux comptes sont en needs_reauth et rien ne le signale sur un contenu programmé avant l'échec à l'heure H. Détecter le token mort au moment de programmer, c'est un clic préventif au lieu d'un post raté chez un client.
- **Inspiration** : original (gap Ocean) + health check tokens du PRD
- **Note** : ContentTarget = plateforme × compte social (PRD §5.B) et needs_reauth + health check proactif quotidien + notification « compte à reconnecter » sont actés (§7.4, Module I). Les mocks ont déjà SOCIAL_ACCOUNTS avec statuts connected/needs_reauth/expired — résolution directe.

---

**P1 — Différenciant fort**

#### `P1` · Médiathèque client avec statut utilisé / inédit _(effort L)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Un espace médias par client : tous les assets reçus, tags libres, et marqueur automatique « déjà publié / inédit » avec filtre par défaut sur les inédits. Le composer pioche dedans au lieu d'exiger un nouvel upload, et un même asset montre dans quels contenus il a servi.

- **Valeur freelance** : Le freelance reçoit 40 Go de shooting en vrac (Drive, WhatsApp) : voir ce qui reste à utiliser et ne jamais reposter deux fois le même visuel est la plainte n°1 contre Metricool. Étanchéité par client native chez Ocean.
- **Inspiration** : Later (Side Library) / Vista Social / plainte Metricool
- **⚠️ Faisabilité** : Conflit frontal avec la rétention actée : originaux purgés J+7 après publication, jamais-publiés à 180 j (décision n°13, Module J). Une DAM complète est impossible sans changer cette décision. Cadrage viable : médiathèque des INÉDITS (originaux encore présents) + historique des publiés en miniatures persistantes avec lien vers les contenus ; réutiliser un asset publié = re-upload (message déjà prévu Module J).

#### `P1` · Recherche, tri et vues filtrées enregistrées _(effort M)_
🎨 mockable dès maintenant (UI preview)

Champ de recherche (titre, légende, hashtags), tri (date programmée, date de création, statut), filtres multi-sélection incluant les statuts aujourd'hui invisibles (idea, partially_published, canceled), et vues prêtes à l'emploi type « À traiter » (modifs demandées + échecs + retards + sans date).

- **Valeur freelance** : Dès ~17 contenus par client, retrouver « le post sur le pain aux noix » sans recherche est pénible. La vue « À traiter » transforme la liste en outil de pilotage quotidien au lieu d'un inventaire.
- **Inspiration** : original + pattern marché

#### `P1` · Aperçu natif pixel-perfect _(effort M)_
🎨 mockable dès maintenant (UI preview)

Un panneau d'aperçu dans le composer et le détail montre le rendu réel par plateforme : post feed IG avec troncature « … plus » simulée, carrousel swipeable, tuile Reel 9:16, rendu Facebook. Bascule d'un onglet par cible.

- **Valeur freelance** : Argument n°1 de HeyOrca : le client valide ce qu'il verra vraiment et le freelance détecte le texte coupé avant l'envoi en revue. Renforce directement le portail de validation, différenciateur d'Ocean.
- **Inspiration** : HeyOrca (mockups natifs)

#### `P1` · Choix de la couverture des Reels _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

À la programmation d'un Reel, un scrubber permet de choisir la frame de couverture ou d'uploader une image dédiée. La cover choisie alimente la vignette de la carte studio et la grille de preview du feed IG.

- **Valeur freelance** : La cover du Reel EST ce qui apparaît dans le feed : sans ce contrôle, la grille soigneusement composée — l'argument central d'Ocean — est cassée par chaque vidéo programmée.
- **Inspiration** : Statusbrew / Metricool / pattern marché
- **⚠️ Faisabilité** : Non couvert par l'analyse. La partie sûre : la frame choisie alimente la miniature WebP générée côté client (Module J) pour carte + grille — aucun risque, à faire. La partie cover IG réelle (cover_url/thumb_offset sur le conteneur REELS) est plausible mais à confirmer sur la variante IG Login au Lot 2 ; rien de garanti pour FB Reels. Présenter le scrubber comme pilotant la miniature, cover API « si supportée ».

#### `P1` · Banque d'idées _(effort M)_
🎨 mockable dès maintenant (UI preview)

Un espace « Idées » par client exploitant le statut idea (présent dans l'enum mais absent des filtres) : capture rapide titre + note + média éventuel depuis l'iPhone entre deux rendez-vous, liste séparée du pipeline daté, et promotion d'une idée en brouillon dans le composer le jour du batch.

- **Valeur freelance** : On collecte des idées toute la journée, on produit en batch une fois par mois : remplace le Notion/Trello parallèle que tiennent la plupart des SMM. Un outil de moins, et le pipeline idée → publié vit au même endroit.
- **Inspiration** : Buffer (Ideas) / Kontentino (Post Ideas)

#### `P1` · Duplication vers un autre client _(effort M)_
🎨 mockable dès maintenant (UI preview)

« Dupliquer » ouvre un dialog : même client (copie immédiate ouverte dans le composer) ou autre client, avec re-ciblage des comptes, légende à adapter et avertissement explicite que les médias ne traversent jamais d'un client à l'autre (re-sélection dans la médiathèque du client cible).

- **Valeur freelance** : Réutiliser un format qui a marché chez A pour B est un réflexe quotidien du freelance multi-clients. Rend aussi enfin « Dupliquer » fonctionnel (simple toast aujourd'hui) tout en matérialisant l'étanchéité des médias par tenant.
- **Inspiration** : Vista Social / Kontentino (Time savers)

#### `P1` · Historique de versions et diff d'approbation _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Une timeline des modifications du contenu (qui, quoi, quand) avec comparaison avant/après de la légende et des médias. Le badge « Approbation périmée » devient cliquable : il montre précisément ce qui a changé depuis la validation (champs invalidants du PRD) et propose « Renvoyer en revue » en un clic.

- **Valeur freelance** : Tranche les litiges « ce n'est pas ce que j'avais validé » — la protection juridique du freelance — et donne un sens actionnable à approvalStale, aujourd'hui purement décoratif, ainsi qu'au versionLabel « v1 » des approbations.
- **Inspiration** : Planable (version history) / Kontentino (version tracking)
- **⚠️ Faisabilité** : Le diff vs version approuvée est faisable et pertinent : le snapshot d'approbation insert-only (légende+hashtags+médias+ordre+format) et les champs invalidants sont actés (Module F) — il rend le badge « périmée » (approvalStale déjà mocké) actionnable avec « Renvoyer en revue ». En revanche la timeline complète qui/quoi/quand = audit log généralisé, Backlog PRD §4 → limiter au diff depuis la dernière approbation.

#### `P1` · Jauges de quotas plateformes _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

À la programmation et sur le détail, une jauge par compte affiche le quota restant simulé : IG 87/100 posts sur 24h, FB 28/30 Reels, TikTok 3/5 brouillons. Un avertissement prévient si le créneau choisi risque le report automatique prévu au PRD.

- **Valeur freelance** : Les quotas sont une contrainte dure d'Ocean (report auto + notification actés). Les rendre visibles au moment de cibler évite la surprise du décalage et installe la confiance dans le moteur de publication.
- **Inspiration** : original (enforcement PRD §6 rendu visible)
- **Note** : Chiffres exacts (IG 100 posts/24h via content_publishing_limit, FB 30 Reels/24h, TikTok 5 brouillons/24h) et le report automatique sur quota est une décision actée. CLAUDE.md §6 prévoit explicitement l'UI comme « affichage ergonomique du quota restant » — l'enforcement reste worker/DB.

---

**P2 — Confort**

#### `P2` · Alt text par média _(effort S)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Un champ texte alternatif par image dans le composer, avec suggestion pré-remplie mockée, envoyé à Instagram et Facebook à la publication.

- **Valeur freelance** : Accessibilité + SEO social (l'alt text est indexé par Instagram et influence Explore) pour un coût UI minime : un champ par média. Argument professionnel que le freelance peut montrer à ses clients.
- **Inspiration** : Buffer / Publer
- **⚠️ Faisabilité** : Non couvert par l'analyse ni le PRD. FB photos : champ alt text custom existant côté Graph. IG : le support d'un paramètre alt_text à la publication n'est pas vérifié — à confirmer par spike léger au Lot 2. Garder le champ en UI (accessibilité = bon réflexe) mais le présenter comme « envoyé si la plateforme le supporte », dégradable sans casse.

### 3.4 Écartées par le filtre de faisabilité (4)

| Feature | Raison |
|---|---|
| Variantes de légende par plateforme | Explicitement V2 : PRD §4 (« Variantes de légende par plateforme » colonne V2) et modèle §6 (« caption_override V2 » sur content_targets). Le composer MVP = légende commune + exception objet newsletter. Bonne idée, mauvais lot — ne pas gonfler la preview avec de la V2. |
| Premier commentaire programmé | Le PRD §4 le place explicitement au Backlog (« Fil de commentaires auto »), hors MVP et même hors V2. Techniquement faisable (POST /{media}/comments IG/FB) mais ajoute un scope et une sous-étape worker post-publish. À laisser au backlog, ne pas l'introduire dans la preview. |
| Groupes de hashtags et snippets par client | « Bibliothèque de hashtags » est explicitement au Backlog du PRD §4 — ni MVP ni V2. Aucune contrainte API mais c'est du scope en plus sur une preview qui doit rester MVP. À re-prioriser plus tard si le batch hebdo le réclame. |
| Assistant IA avec voix de marque par client | « IA de rédaction » est explicitement V2 au PRD §4 (ligne Studio de contenu). La phase preview valide le front du MVP (Lots 0–4) ; y insérer un panneau IA mocké, ses profils de ton par client et son emplacement UI, c'est cadrer de la V2 avant d'avoir validé le MVP. À mocker le jour où la V2 sera cadrée. |


## 4. Transversal — section client

### 4.1 Fonctionnalités manquantes proposées (25)

---

**P0 — Indispensable pour un usage pro quotidien**

#### `P0` · Médiathèque par client _(effort L)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Un onglet « Médias » par client : tous les assets uploadés ou déposés par le client, filtrables par type et par usage, avec statut « utilisé dans X posts / jamais utilisé ». On crée un contenu depuis un média, ou on attache un média existant depuis le studio sans re-upload.

- **Valeur freelance** : MediaAsset n'existe qu'imbriqué dans un ContentItem : impossible de réutiliser une photo entre posts ni de visualiser le stock de matière première restant avant le batch du mois. Pivot indispensable du lien de dépôt client.
- **Inspiration** : Later (Media Library)
- **⚠️ Faisabilité** : En tension avec la rétention actée (originaux purgés J+7 post-publication, 180 j si jamais publiés — Module J) : la réutilisation sans re-upload n'est garantie que tant que l'original existe. Viable comme inventaire fondé sur les miniatures persistantes (« utilisé dans X posts », création depuis un média) avec état « original purgé » explicite ; nécessite une entité média de niveau client absente du modèle §6 (media_assets est fille de content_items).

#### `P0` · Sélection multiple et actions par lot _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Mode sélection dans le studio, la grille et le calendrier (checkbox au survol desktop, appui long mobile) avec barre d'actions flottante : envoyer en validation, décaler les dates de +N jours, changer le statut, étiqueter, dupliquer, annuler. Inclut le décalage en masse d'une période entière (« tout pousser d'une semaine ») quand le client demande un report global.

- **Valeur freelance** : Le persona prépare 15-20 posts par client en batch mensuel : sans action groupée, chaque geste est multiplié par 20. C'est aussi le prérequis technique de la demande de validation groupée. Aucune multi-sélection n'existe aujourd'hui sur les 3 pages.
- **Inspiration** : Sked Social / Vista Social (bulk actions)
- **⚠️ Faisabilité** : Faisable sans API, mais à contraindre par la machine à états verrouillée (PRD §5.B) : « changer le statut » en masse = uniquement des transitions valides (envoyer en revue, programmer, annuler) ; décalage de dates sur des scheduled = annulation/recréation des jobs ; publiés/importés exclus du décalage. L'envoi en validation groupé rejoint la ReviewRequest déjà prévue (Module F) ; « étiqueter » dépend de la feature étiquettes.

#### `P0` · Demande de validation groupée avec suivi _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Depuis la sélection multiple, un panneau « Envoyer en validation » récapitule les contenus, permet un message personnalisé au reviewer et crée la ReviewRequest. Un volet « Validations » par client liste les demandes envoyées : état (en attente / partielle / terminée), date d'envoi, décisions reçues post par post.

- **Valeur freelance** : C'est LE geste du workflow batch : 20 posts soumis d'un coup au client. L'entité ReviewRequest existe dans les mocks (4 instances) mais aucune UI ne permet de la créer ni de la suivre — le flux central du produit est invisible en preview.
- **Inspiration** : Kontentino (batch approvals) — prévu PRD Lot 3, absent de l'UI
- **Note** : C'est exactement l'entité ReviewRequest du PRD : envoi par lot, message optionnel, état dérivé en attente/partiel/traité, décisions par contenu (Module F, §6 review_requests + review_request_items, Lot 3). Le volet « Validations » par client = l'UI de cette entité.

#### `P0` · Légendes déclinées par plateforme _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Dans le studio, des onglets par cible (IG / FB / TikTok) permettent de surcharger la légende commune : hashtags et emojis sur IG, ton plus sobre avec lien cliquable sur FB, accroche courte TikTok. Un indicateur « personnalisée » signale les cibles qui divergent, avec retour possible à la version commune.

- **Valeur freelance** : La caption unique actuelle force le plus petit dénominateur commun entre plateformes aux conventions opposées (hashtags IG vs liens FB). Standard absolu des outils SMM pro, son absence disqualifie l'outil en usage quotidien.
- **Inspiration** : Buffer / Hootsuite / Vista Social
- **⚠️ Faisabilité** : Explicitement acté en V2 au PRD (§4 « variantes de légende par plateforme » ; champ caption_override V2 sur content_targets §6). Aucune contrainte API — la légende est par post. L'avancer au MVP est une décision produit à faire acter par Étienne ; maquettable dès la preview puisque le modèle le réserve déjà.

#### `P0` · Pré-flight de programmation (conformité média + complétude) _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Avant programmation, une checklist automatique par cible vérifie le ratio réel du média (bornes IG 4:5–1.91:1), format et poids attendus, longueur de légende, présence de date, de cibles et d'alt text. Bloqueurs en rouge avec action corrective (« recadrer en 4:5 »), avertissements en orange, badge « prêt à programmer » sur la carte studio.

- **Valeur freelance** : MediaAsset.width/height ne sont lus par aucun composant alors que la règle produit (CLAUDE.md §22) fait du ratio la cause d'échec n°1. Détecter à la création plutôt qu'à l'heure H évite l'échec silencieux — la plainte la plus destructrice de confiance chez tous les concurrents (Trustpilot Later 1.3/5).
- **Inspiration** : Later (post readiness) + diagnostic d'échec actionnable (benchmark anti-Later)
- **Note** : Déjà exigé par le PRD : validation type/poids/ratio/durée à l'upload (Module J) + conditions re-vérifiées à toute transition vers scheduled (§5.B). Bornes IG 4:5–1.91:1 et JPEG only conformes à l'analyse §2.1. La checklist visuelle + badge est la bonne UI par-dessus ; l'alt text reste un avertissement (pas un champ du PRD actuel).

#### `P0` · Reprogrammation par drag-drop dans le calendrier _(effort M)_
🎨 mockable dès maintenant (UI preview)

Glisser une entrée du calendrier (vue mois ou semaine) vers un autre jour pour la reprogrammer, avec confirmation d'heure ; une étagère « sans date » permet de déposer les contenus prêts directement sur un jour. Même qualité tactile que le drag de la grille (vérifié : le drag n'existe aujourd'hui que dans feed-grid/sortable-grid-tile, rien dans le calendrier).

- **Valeur freelance** : Reprogrammer est le geste quotidien n°1 face aux imprévus client ; devoir ouvrir le studio pour changer une date casse le flux de planification. Les leaders du créneau sont nés mobile-first sur ce geste précis.
- **Inspiration** : Agorapulse / Planable / Preview App (grille mobile-first)

#### `P0` · Groupes de hashtags par client + premier commentaire IG _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Chaque client dispose de groupes de hashtags nommés (« local », « piliers », « promo ») insérables en un clic dans la légende ou dans un champ « premier commentaire » IG dédié. Compteur ≤30 hashtags, alerte doublon entre légende et premier commentaire.

- **Valeur freelance** : Le freelance retape ses hashtags à chaque post — l'audit du modèle confirme qu'aucun champ ne les porte ni ne les mutualise. Le premier commentaire est l'emplacement métier classique pour garder une légende propre.
- **Inspiration** : Plann / Flick / Planoly
- **Note** : « Bibliothèque de hashtags » figure au backlog PRD §4 ; les groupes par client = tables simples sans API. Le premier commentaire IG est faisable via POST /{media_id}/comments (scope instagram_business_manage_comments, inclus dans la variante IG Login retenue, auto-accordé en Standard Access) = sous-étape worker post-publish avec sa propre idempotence. Compteur ≤30 cumulé légende+commentaire correct.

#### `P0` · État de validation visible sur toutes les pages _(effort S)_
🎨 mockable dès maintenant (UI preview)

Monter le ReviewStateBadge (existant dans status-badge.tsx mais orphelin) sur les tuiles de la grille, les entrées du calendrier et les cartes du studio : « en validation », « approuvé », « corrections demandées ». Ajout d'un filtre rapide « en attente client » sur les 3 pages.

- **Valeur freelance** : Le freelance doit voir d'un coup d'œil ce qui bloque la publication du mois. Chez Vista Social et Hootsuite, l'approbation est un état de premier ordre visible dans calendrier et files — pas une information enfouie dans le détail d'un contenu.
- **Inspiration** : Vista Social / Hootsuite (approval as first-class state)

#### `P0` · Alerte santé des connexions au niveau client _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Bandeau persistant sur grille/calendrier/studio quand un compte du client est needs_reauth ou expiré (« Instagram déconnecté — les 3 publications de jeudi échoueront ») avec CTA « Reconnecter », plus pastille santé sur le header client et la liste des clients. Le header client actuel (layout.tsx) affiche les icônes plateformes sans aucun état de santé.

- **Valeur freelance** : Découvrir le token mort à l'heure de publication est le scénario cauchemar documenté chez Later et Plann. La panne doit être visible là où le freelance travaille, pas seulement dans Réglages > Comptes.
- **Inspiration** : Pain n°1 des avis Later/Plann — health check prévu Lot 2, surfaçage cross-page absent
- **Note** : Le socle est acté : health check quotidien des tokens, statut needs_reauth, notification « compte à reconnecter » (PRD §7.4, Module I, analyse §4). Le bandeau contextuel avec impact (« N publications échoueront ») = jointure social_accounts × jobs futurs, zéro appel API supplémentaire. Vérifié : le header client actuel n'affiche aucun état de santé.

#### `P0` · Dupliquer et recycler un contenu _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Action « Dupliquer » sur tout contenu depuis le studio, le calendrier ou la grille : copie légende + médias + cibles en brouillon sans date, vers le même client ou un autre. Sur un post importé performant de la grille, « Recréer un post similaire » pré-remplit le studio.

- **Valeur freelance** : Recycler les formats qui marchent et décliner un post entre clients est un réflexe hebdomadaire du freelance multi-clients ; aujourd'hui tout est resaisi à la main. Aucune action de duplication n'existe dans l'UI.
- **Inspiration** : Buffer / Later (duplicate post)
- **⚠️ Faisabilité** : La duplication est déjà référencée au PRD (§5.B « dupliquer le contenu pour repartir » ; Module J : bloquée si original purgé → message « re-uploader le média »). À adapter : « recréer un post similaire » depuis un post importé ne pré-remplit que légende/format — imported_posts ne conserve que miniature+permalink, jamais l'original ; duplication vers un autre client = copie d'objet Storage (chemins {org}/{client} différents).

---

**P1 — Différenciant fort**

#### `P1` · Jauges de quotas API et report annoncé _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Jauge de quota restant par compte social (IG x/100 posts 24h, FB x/30 Reels/Page, TikTok x/5 brouillons) affichée à la programmation dans le studio et sur la page comptes. Si le créneau choisi dépasse le quota, l'UI annonce le report automatique avant validation (« sera décalé à 9h12 + notification »).

- **Valeur freelance** : Le CLAUDE.md §6 exige un affichage ergonomique du quota et la notification publish_delayed y fait référence, mais aucune entité quota n'est mockée : le comportement de report est aujourd'hui imprévisible pour l'utilisateur. Quasi aucun concurrent ne le montre — différenciant.
- **Inspiration** : Règle produit Ocean (CLAUDE.md §6) — original face au marché
- **⚠️ Faisabilité** : Report auto + notification actés (décision n°11, §5.E) et CLAUDE.md §6 prévoit « UI = affichage ergonomique du quota restant ». Ajustements : jauge IG fiable (GET content_publishing_limit, servie côté serveur — jamais de check UI-only) ; FB Reels et TikTok = compteurs locaux (pas de jauge BUC FB proactive, le header n'est connu qu'après appel) ; heure de report annonçable pour IG/FB mais PAS TikTok (§5.E : « aucune heure promise », re-tentative horaire).

#### `P1` · Relances de validation manuelles et automatiques _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Sur une demande de validation en attente : bouton « Relancer » (email au reviewer) avec historique horodaté des relances, affichage du lastActiveAt du reviewer (« Marc n'a jamais ouvert le portail ») et cadence automatique configurable par client (J+2, J+4, escalade avant la date de publication).

- **Valeur freelance** : Courir après le client est la tâche la plus pénible du métier : l'outil joue le créancier à la place du freelance et le contenu part à l'heure. Reviewer.lastActiveAt existe dans les mocks mais n'est affiché nulle part.
- **Inspiration** : Gain (relances 6-72h avec escalade) / Cloud Campaign — auto flaggé V2 au PRD
- **⚠️ Faisabilité** : À découper : relance manuelle + historique = OK dès le Lot 3 (Brevo en place, template review-requested ; lastActiveAt dérivable de l'activité portail). Les relances automatiques à cadence (J+2/J+4, escalade) sont explicitement classées V2 au PRD §4 (« relances automatiques »).

#### `P1` · Niveau de validation réglable par client _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Dans les réglages du client : validation désactivée (publication directe), optionnelle, obligatoire (bloquante) ou mode veto (programmé, part sauf objection avant J-1). Studio, calendrier et grille adaptent leurs actions et avertissements au mode choisi.

- **Valeur freelance** : Chaque client a sa rigueur : bloquer la publication chez les clients confiants crée des trous de calendrier, publier sans garde-fou chez les sensibles crée des incidents. Le réglage par client évite le pire des deux mondes.
- **Inspiration** : Planable (approval levels par espace) / Agorapulse (mode veto)
- **⚠️ Faisabilité** : La décision actée est « validation optionnelle PAR CONTENU » (§13 n°8). Un défaut par client (pré-cocher ou non l'envoi en revue) est compatible et utile ; les modes « obligatoire bloquant » et « veto J-1 » modifient la machine à états verrouillée v0.2 (nouvelles transitions, annulation auto sur objection) — à reporter ou à re-acter explicitement avec Étienne.

#### `P1` · Historique de versions avant/après corrections _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Chaque renvoi après « corrections demandées » crée une version (v1, v2…) consultable dans le studio : diff de légende surligné, médias remplacés signalés, horodatage et auteur. Le portail montre au client ce qui a changé depuis son dernier retour.

- **Valeur freelance** : Le flux changes_requested → nouvelle version est central au produit mais versionLabel est « v1 » en dur sans entité de versionnage. La trace horodatée protège aussi commercialement le freelance face au « je n'ai jamais validé ça ».
- **Inspiration** : Filestage / Planable — complète les approbations versionnées du Lot 3
- **Note** : S'appuie sur l'acté : approbations insert-only avec snapshot de version (légende+hashtags+médias+ordre+format) et « historique complet conservé » (Module F, Lot 3). Le diff de légende se calcule entre snapshots ; pour les médias, diff sur les miniatures persistantes (l'original peut être purgé J+7).

#### `P1` · Fil de retours : interne vs client + résolution _(effort M)_
🎨 mockable dès maintenant (UI preview)

Deux couches de commentaires par contenu : le fil client (miroir du portail) et des notes internes invisibles du client, visuellement distinctes. Chaque retour client peut recevoir une réponse et être « marqué traité », avec compteur « 2/3 retours traités » avant renvoi en validation.

- **Valeur freelance** : Comment n'a ni flag resolved ni fil de réponse : impossible de savoir ce qui reste à corriger après un retour. Sans couche interne, la cuisine du freelance part sur WhatsApp et le contexte se perd.
- **Inspiration** : Planable (internal vs client comments) / proofing Filestage

#### `P1` · Étiquettes de contenu transverses _(effort M)_
🎨 mockable dès maintenant (UI preview)

Labels libres colorés (« promo », « UGC », « marronnier », « pilier conseil ») posés sur les contenus depuis le studio ou en lot, avec page de gestion par client, filtres dans studio/calendrier/grille et comptage par étiquette sur la période affichée.

- **Valeur freelance** : Retrouver « tous les posts promo du client X au T3 » et vérifier l'équilibre des piliers éditoriaux d'un mois est impossible aujourd'hui. C'est aussi la fondation des futurs rapports par campagne (Power Reports).
- **Inspiration** : Buffer / Agorapulse (publishing labels + rapports par label)

#### `P1` · Créneaux de publication récurrents par client _(effort M)_
🎨 mockable dès maintenant (UI preview)

Définir des slots hebdomadaires par client (mar/jeu 11h30, sam 9h) affichés en fantôme dans le calendrier ; à la programmation, un bouton « prochain créneau libre » place le contenu automatiquement. Les slots vides matérialisent les trous à combler pendant le batch.

- **Valeur freelance** : Le batch mensuel consiste à remplir une grille de créneaux convenus avec le client ; choisir date + heure à la main 20 fois est lent et source d'oublis. L'audit du modèle confirme l'absence totale de queue slots.
- **Inspiration** : Buffer (queue) / Later (quick schedule)

#### `P1` · Aperçu fidèle par plateforme _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Dans le studio et le portail, un aperçu pixel-perfect par cible : post feed IG avec troncature « … plus » au bon caractère, carrousel swipable, Reel/Story plein écran 9:16, post FB avec aperçu de lien. Bascule entre cibles pour vérifier chaque déclinaison de légende.

- **Valeur freelance** : Le client valide ce qu'il verra réellement publié — moins de retours « je l'imaginais autrement » — et le freelance repère les légendes coupées avant l'heure H. Les visionneuses actuelles utilisent des ratios CSS figés, pas le rendu plateforme.
- **Inspiration** : Planable / Kontentino (previews natives)
- **⚠️ Faisabilité** : Pur front, pertinent studio + portail. Ajustements : la bascule par cible suppose les légendes déclinées (V2/feature liée — sinon aperçu sur légende commune) ; aperçu de lien FB = fetch OpenGraph côté serveur (CORS) ; la troncature « … plus » IG dépend du device — viser « fidèle » (heuristique ~125 caractères), pas « pixel-perfect au bon caractère ».

#### `P1` · Lien de dépôt de médias pour le client _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Générer un lien de dépôt par client (intégré au portail Reviewer) : drag & drop de photos/vidéos sans création de compte, fichiers rangés automatiquement dans la médiathèque du bon client avec notification au freelance, et relance automatique si rien n'est déposé à J-X du batch day.

- **Valeur freelance** : « Courir après les photos du client » est le pain point n°1 cité par les SMM ; tuer le combo WeTransfer + email ancre Ocean dans le workflow des deux côtés de la relation.
- **Inspiration** : Content Snare / File Request Pro / Metricool
- **⚠️ Faisabilité** : Le dépôt « sans création de compte » contredit la règle actée « jamais de lien public signé non authentifié » (PRD Q2/Module F) et ouvrirait le Storage en écriture anonyme. À adapter : dépôt par le Reviewer AUTHENTIFIÉ dans le portail (compte invité existant — l'UX « clic dans l'email » lève déjà la friction visée) + policies storage INSERT scopées client. Relance J-X = Module I extensible. Dépend de la médiathèque.

#### `P1` · Options avancées par plateforme _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Champs par cible dans le studio : géotag et comptes identifiés/collab sur IG, alt text par média, couverture de Reel choisie parmi les frames, options TikTok (confidentialité, duet/stitch, commentaires), sticker lien pour les Stories. Rappel des options manquantes dans le pré-flight.

- **Valeur freelance** : L'internalNotes mocké dit littéralement « Penser à taguer le lieu et le partenaire » : le besoin est documenté mais aucun champ ne le porte. Ces réglages conditionnent la portée réelle des posts (collab IG double l'audience).
- **Inspiration** : Later / Planable + audit du modèle de données Ocean
- **⚠️ Faisabilité** : Faisables : alt text IG (param alt_text), couverture de Reel (thumb_offset/cover_url). À écarter au MVP : identification/collab IG — la variante « Instagram API with Instagram Login » retenue exclut le tagging (analyse §2.1) ; géotag dépend de la recherche de lieux (Pages Search, hors variante) ; sticker lien Stories non exposé par les API de publication Meta ; options TikTok (privacy/duet/stitch) inopérantes en mode brouillon — le créateur les règle dans l'app → les basculer en checklist de la publication manuelle assistée.

#### `P1` · Switcher de client contextuel (Cmd+K) _(effort S)_
🎨 mockable dès maintenant (UI preview)

Un sélecteur dans le header client et une palette Cmd+K (le composant cmdk est installé dans components/ui/command.tsx mais jamais utilisé) pour basculer vers le même onglet d'un autre client : la grille de Verde → la grille de Nove en un geste, recherche de contenu incluse à terme.

- **Valeur freelance** : En batch mensuel on enchaîne les clients sur la même activité (toutes les grilles, puis tous les calendriers) ; repasser par le dashboard à chaque bascule coûte des dizaines d'allers-retours par session de travail.
- **Inspiration** : UNUM (un espace par client) / pattern palette Linear

#### `P1` · Recherche et tri dans le studio _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Champ de recherche plein texte sur légendes et notes du client courant avec surlignage des occurrences, et tri configurable (date de publication, dernière modification, statut). Complète les filtres existants statut/plateforme/format — aucun champ de recherche n'existe aujourd'hui dans l'app (vérifié).

- **Valeur freelance** : À 60+ contenus par client, retrouver « le post sur les soldes » par scroll devient la friction quotidienne du studio, surtout sur mobile où la grille de cartes est longue.
- **Inspiration** : Standard SaaS — recherche full-text au backlog PRD
- **Note** : Le backlog PRD §4 vise la recherche full-text GLOBALE ; la version proposée scopée au client courant (ILIKE/pg_trgm sur caption + notes) est légère et sans contrainte API ; le tri est trivial. Vérifié : aucun champ de recherche dans l'app actuelle.

#### `P1` · Publication manuelle assistée (awaiting_manual) _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Pour newsletter, sur-mesure et TikTok finalisé : à l'heure H, la cible passe « à publier manuellement » avec une carte d'action dédiée — médias téléchargeables, bouton « copier la légende », checklist par plateforme (son tendance, duet/stitch pour TikTok), puis « Marquer comme publié » avec collage du permalink.

- **Valeur freelance** : L'état awaiting_manual existe dans les enums mais n'est jamais instancié ni actionnable (la cible newsletter reçoit « pending » à tort). C'est le filet de sécurité du mode TikTok-brouillon, maillon faible reconnu du workflow, et les chips dashboard « À publier manuellement » sont vides faute de données.
- **Inspiration** : Later (notification publishing) / Planable (checklist TikTok) — canaux manuels prévus Lot 2
- **Note** : Le cycle est déjà spécifié : awaiting_manual + notification « à publier manuellement », pushed_to_platform TikTok, « copier la légende », « marquer comme publié » avec permalink optionnel, relance J+1 (§5.B/E, Module I). Ajouts purs UI : téléchargement des médias (URL signée — l'original existe encore avant publication) et checklist par plateforme.

---

**P2 — Confort**

#### `P2` · Récap mensuel par client (preuve de valeur) _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Un clic génère le bilan du mois d'un client : posts publiés avec vignettes et permaliens, validations obtenues et délais de réponse, échecs et reports, répartition par plateforme et par étiquette. Partageable en lien public léger ou PDF aux couleurs du freelance.

- **Valeur freelance** : Le renouvellement du forfait mensuel se joue sur la preuve de travail ; aujourd'hui le freelance fait des captures d'écran. Les seules données de publication suffisent — pas besoin d'attendre les statistiques V2.
- **Inspiration** : Metricool (rapports brandés) / Planoly (Plan Report) — rapports PDF au backlog PRD
- **⚠️ Faisabilité** : Réalisable dès le MVP avec les seules données INTERNES (publications + permaliens, délais de validation, échecs/reports, répartition par étiquette) — sans le module Statistiques V2 (reach/engagement exigent l'Advanced Access et les nouvelles métriques post-v26.0). « Rapports clients PDF » figure au backlog §4. Remplacer le « lien public léger » par un accès portail authentifié ou un PDF téléchargeable (règle « jamais de lien public non authentifié »).

#### `P2` · Détection de trous et de conflits de calendrier _(effort S)_
🎨 mockable dès maintenant (UI preview)

Le calendrier signale les périodes vides au-delà du rythme convenu (« 8 jours sans publication ») et les collisions (deux posts du même client à moins d'une heure), avec suggestion de créneau de repli. Un indicateur de remplissage du mois s'affiche dans la toolbar.

- **Valeur freelance** : Le trou de calendrier découvert trop tard est l'angoisse du batch mensuel et la cause du post improvisé de dernière minute ; le détecter pendant la planification protège la régularité vendue au client.
- **Inspiration** : Original — s'appuie sur les créneaux récurrents


## 5. Compléments — domaines détectés par la critique de complétude

Domaines entiers absents du premier passage, identifiés par l’agent critique :

- **Analytics & reporting de performance par client** : Import des insights IG/FB par post (reach, likes, saves, partages, ER) rattachés aux contenus publiés via Ocean · Page « Performance » par client : tops posts, évolution followers, meilleur format/pilier, comparaison mois vs mois · Rapport de performance brandé (PDF ou lien partageable) distinct du simple récap d'activité, avec commentaires du freelance · Objectifs par client (followers, ER, cadence) avec jauge de progression · Suggestions de hashtags/formats basées sur les performances passées du client
- **Onboarding d'un nouveau client** : Wizard de création de client : fiche (secteur, TZ, fréquence contractuelle), checklist guidée de connexion IG/FB/TikTok · Questionnaire de brief auto-envoyé au client (ton, interdits, concurrents, objectifs) dont les réponses alimentent la fiche client · Invitation Reviewer guidée avec email de bienvenue et mini-tutoriel du portail de validation · Indicateur « setup incomplet » sur le dashboard tant que comptes/brief/premier créneau ne sont pas en place
- **Brand kit par client (identité de marque)** : Fiche brand kit : logos, palette de couleurs, typographies, bio et liens officiels, téléchargeables en un clic · Ton de voix structuré (règles do/don't, mots interdits, signatures) injecté dans l'assistant IA et affiché dans le composer · Vérificateur de cohérence : alerte si une légende contient un mot interdit ou s'écarte des règles du client · Templates visuels par client (gabarits de covers, citations, carrousels) réutilisables depuis le studio
- **Import de l'existant** : Synchronisation du feed Instagram déjà publié pour peupler la grille avec les vrais posts du client à l'onboarding · Import de l'historique Facebook (posts et Reels) dans le calendrier en vue « passé » · Détection des posts publiés hors Ocean (directement dans l'app IG) et réconciliation dans la grille · Rattachement des métriques aux posts importés pour alimenter le recyclage des tops posts
- **Veille & inspiration** : Bibliothèque de références par client : enregistrer des posts/liens/screenshots d'inspiration, taggés par pilier · Partage iOS vers Ocean (PWA) : envoyer un post repéré sur Instagram directement dans la banque d'idées du bon client · Flux de tendances FR : formats qui marchent, sons TikTok du moment, avec bouton « créer un contenu à partir de cette tendance » · Suivi de comptes concurrents/inspirants par client avec rappel de veille hebdomadaire
- **Automatisations & règles de workflow** : Publication automatique dès approbation client (règle activable par client) au créneau déjà planifié · Remplissage automatique des créneaux récurrents depuis l'étagère « À planifier » dans l'ordre de priorité · File evergreen : contenus intemporels re-programmés cycliquement dans les trous de calendrier · Règles personnalisées type « si non validé 48h avant la date prévue, décaler automatiquement et prévenir »
- **Link-in-bio par client** : Mini-page de liens hébergée par client, aux couleurs du brand kit · Synchronisation automatique avec les derniers posts publiés (chaque post pointe vers son lien) · Statistiques de clics par lien intégrées au reporting client · Champ « lien de destination » dans le composer qui alimente automatiquement la page link-in-bio à la publication
- **Engagement & inbox sociale** : Boîte de réception unifiée des commentaires IG/FB par client, filtrée sur les posts publiés via Ocean · Réponses enregistrées (FAQ du client) et brouillons de réponse soumis à validation du client si besoin · Modération : masquer/signaler un commentaire, alertes sur mots sensibles définis par client · Notification « premiers commentaires » dans l'heure suivant une publication pour soigner l'engagement initial
- **Recherche globale cross-clients** : Recherche plein texte sur TOUS les clients à la fois : légendes, hashtags, notes, noms de fichiers médias · Palette de commandes étendue (au-delà du switch client) : « planifier X », « ouvrir la grille de Y », actions rapides · Section « récents » : derniers contenus/clients/vues consultés pour naviguer vite en batch · Recherche par filtre transverse : « tous les Reels non validés toutes marques confondues »
- **Archivage, corbeille & journal d'activité** : Archivage d'un client parti : lecture seule, masqué des listes, avec export complet (médias + légendes + historique) pour la réversibilité · Corbeille avec restauration des contenus supprimés (délai de grâce avant purge des médias) · Journal d'activité par contenu : qui a créé/modifié/approuvé/publié quoi et quand (preuve en cas de litige client) · Vue « archives publiées » consultable par année/mois sans alourdir le calendrier courant
- **Expérience PWA iOS spécifique** : Assistant d'installation PWA guidé (Ajouter à l'écran d'accueil) avec détection si déjà installée · Capture rapide mobile : FAB + picker Photos pour envoyer une photo/vidéo prise chez le client directement dans la médiathèque du bon client · Notifications push (échec de publication, contenu approuvé, brouillon TikTok à finaliser) avec écran d'activation soigné iOS 18.4+ · Mode hors-ligne : consultation du calendrier/grille et rédaction de brouillons en métro, synchronisés au retour du réseau · Badge d'app avec le nombre de contenus en attente d'action
- **Pipeline de production (vue tâches/kanban)** : Vue kanban transverse des contenus par étape de production : idée → à produire → à valider → planifié → publié · Checklist de production par contenu (visuel fait, légende relue, hashtags ajoutés) distincte du statut de validation · Échéances internes (deadline de production) séparées de la date de publication, avec alertes · Vue charge de travail : combien de contenus à produire par client cette semaine, pensée pour le batch mensuel
- **Édition média intégrée** : Recadrage guidé aux ratios plateformes (4:5, 1:1, 9:16) directement dans le studio, sans repasser par un outil externe · Trim vidéo simple (début/fin) et vérification du hook des 3 premières secondes pour les Reels · Sous-titres burn-in pour les Reels (généré + éditable), indispensable pour la consommation sans son · Compression/redimensionnement automatique quand le média dépasse les limites API (8 MB JPEG, 300 MB vidéo)
- **Accessibilité de l'interface** : Alternative clavier complète au drag-and-drop (grille et calendrier) : déplacer une tuile via menu « déplacer vers… » · Contrastes AA sur les pastilles de statut (ne jamais coder l'information par la couleur seule : icône + libellé) · Support lecteur d'écran : annonces des changements de statut, labels ARIA sur les tuiles de grille · Respect de prefers-reduced-motion sur les animations de drag, transitions et confirmations

### 5.1 Features issues de ces domaines (19)

#### `P0` · [grid] Synchronisation du feed IG existant _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

À la connexion du compte Instagram d'un client, Ocean importe les posts déjà publiés (vignettes, légendes, dates, permaliens) et les affiche dans la grille en tuiles « importé », sous les contenus planifiés. Une sync régulière détecte les posts publiés hors Ocean (directement dans l'app IG) et les réconcilie dans la grille avec un badge distinct. En preview front : tuiles mockées avec badge importé/hors-Ocean.

- **Valeur freelance** : Sans le vrai feed, la grille de preview ment dès le premier client existant. C'est LA condition pour que la page grid serve à composer visuellement la suite du feed.
- **Inspiration** : Planoly et Preview App importent le feed réel à l'onboarding ; Later réconcilie les posts publiés hors outil.
- **Note** : Déjà spécifié PRD §5.C + décision actée #9 : entité imported_posts, GET /media à la connexion, sync 1×/jour + bouton manuel, dédup sur external_post_id, deleted_externally. Lot 1 = seed/mocks, import réel Lot 2. Le badge « hors-Ocean » distinct est un ajout mineur compatible. En preview front : tuiles mockées OK.

#### `P0` · [transversal] Assistant d'installation PWA et push iOS _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Au premier accès mobile, écran guidé « Ajouter à l'écran d'accueil » avec captures pas-à-pas Safari, détection automatique si la PWA est déjà installée. Une fois installée, écran d'activation des notifications push soigné (échec de publication, contenu approuvé, brouillon TikTok à finaliser) et badge d'app avec le nombre de contenus en attente d'action.

- **Valeur freelance** : Étienne est sur iPhone et la PWA iOS est la priorité actée : sans installation ni push, le triple canal de notification d'échec de publication n'existe pas sur mobile.
- **Inspiration** : Onboarding d'installation de la PWA Starbucks ; Web Push déclaratif iOS 18.4+.
- **Note** : Onboarding d'installation iOS soigné explicitement prévu dès le Lot 0 (PRD §8.5, décisions #11/#18), push double format (Declarative Web Push iOS 18.4+ / SW Android) acté. Le badge d'app (Badging API) fonctionne sur PWA installée iOS — ajout compatible. Détection d'installation via display-mode standalone.

#### `P0` · [studio] Recadrage guidé et compression automatique _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Dans le studio, éditeur de recadrage aux ratios plateformes (4:5, 1:1, 1.91:1, 9:16) avec aperçu du rendu grille IG. Si le média dépasse les limites API (8 MB JPEG, ratio hors bornes), Ocean recadre/compresse automatiquement côté client avec un avant/après, au lieu d'un message d'erreur bloquant.

- **Valeur freelance** : Une photo iPhone sort souvent hors specs Meta : sans correction intégrée, chaque upload mobile devient un détour par une app externe. Supprime la cause numéro un d'échec de publication évitable.
- **Inspiration** : Recadrage intégré de Buffer et Later au moment du ciblage plateforme.
- **Note** : Prolonge directement le Module J : « message d'erreur clair + proposition (conversion auto, recadrage manuel) AVANT la programmation » (§5.J), conversion JPEG ≤8 MB et ratios 4:5–1.91:1 déjà spécifiés, traitement côté client conforme à l'architecture (§3.3 analyse). Ajouter 9:16 pour Reels/Stories. L'avant/après est un plus UX.

#### `P1` · [transversal] Page Performance par client _(effort L)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Nouvel onglet « Performance » dans l'espace client : tops posts du mois (reach, likes, saves, partages, ER) rattachés aux contenus publiés via Ocean, courbe d'évolution des followers, meilleur format/pilier, comparaison mois vs mois. L'utilisateur définit des objectifs par client (followers, ER, cadence) affichés en jauges de progression.

- **Valeur freelance** : Le freelance justifie sa facture chaque mois. Aujourd'hui il fait des captures d'écran depuis Meta Business Suite — c'est le premier motif de churn d'un client final.
- **Inspiration** : Metricool (référence FR/ES des freelances), Iconosquare pour les tops posts et l'ER par format.
- **⚠️ Faisabilité** : Statistiques explicitement V2 au PRD (§4). À adapter : IG OK via insights (nouvelles métriques views/reposts, analyse §2.1) ; FB = métriques Pages massivement dépréciées à v26.0 fin 2026 (analyse §2.2) → cibler les nouvelles métriques ; TikTok EXCLU (mode brouillon, aucune stat API). Courbe followers = snapshots quotidiens à stocker. Objectifs/jauges = pur produit, OK. Mock en preview, dev en V2.

#### `P1` · [transversal] Rapport client brandé partageable _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Depuis la page Performance, bouton « Générer le rapport » : sélection de la période, ajout de commentaires libres du freelance par section, logo et couleurs du client, export en lien partageable (consultable sans compte) ou PDF. Distinct du simple récap d'activité du portail.

- **Valeur freelance** : Transforme les chiffres en livrable professionnel envoyé en un clic — l'argument de rétention numéro un du freelance face à son client.
- **Inspiration** : Rapports Metricool et Swydo ; liens partageables type Notion publish.
- **⚠️ Faisabilité** : « Rapports clients PDF » figure au backlog PRD (§4) ; dépend de la page Performance (stats V2). Le lien « consultable sans compte » est à cadrer : le PRD proscrit les liens publics non authentifiés pour le portail (décision actée #3) — un rapport FIGÉ avec token révocable est un artefact différent mais doit être acté explicitement. PDF = chemin sûr.

#### `P1` · [transversal] Wizard d'onboarding client _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Création d'un client via un wizard en étapes : fiche (secteur, TZ, fréquence contractuelle), checklist guidée de connexion IG/FB/TikTok, envoi optionnel d'un questionnaire de brief au client (ton, interdits, concurrents, objectifs) dont les réponses pré-remplissent la fiche, invitation Reviewer avec email de bienvenue. Tant que comptes + brief + premier créneau ne sont pas en place, le dashboard affiche un indicateur « setup incomplet » avec les étapes restantes.

- **Valeur freelance** : Le setup d'un nouveau client passe de bricolage en 6 endroits à un parcours unique — crucial quand on signe un client et qu'on veut publier dans la semaine.
- **Inspiration** : Onboarding par checklist d'Agorapulse ; collecte de brief type Content Snare.
- **⚠️ Faisabilité** : L'onboarding de connexion des comptes est prévu Lot 2 (PRD §7.2), mais la checklist doit refléter des étapes MANUELLES hors-app en phase solo : IG = ajouter le compte client comme testeur dans l'App Dashboard + acceptation ; FB = tâche CREATE_CONTENT attribuée via Business Suite ; TikTok = post-revue d'app. Le questionnaire de brief doit passer par le compte Reviewer invité ou email Brevo — jamais de formulaire public non authentifié. Indicateur « setup incomplet » : OK.

#### `P1` · [studio] Brand kit par client _(effort M)_
🎨 mockable dès maintenant (UI preview)

Onglet « Marque » dans la fiche client : logos, palette de couleurs, typographies, bio et liens officiels téléchargeables en un clic, plus un ton de voix structuré (règles do/don't, mots interdits, signatures de fin de post). Le composer du studio affiche un panneau latéral rappelant ces règles pendant la rédaction, et l'assistant IA les recevra en contexte.

- **Valeur freelance** : Fini l'aller-retour vers un Google Doc de charte : les règles du client sont là où on écrit. Réduit les retours de validation pour « ce n'est pas notre ton ».
- **Inspiration** : Canva Brand Kit ; brand guidelines de Frontify en version légère.

#### `P1` · [studio] Garde-fous de légende _(effort S)_
🎨 mockable dès maintenant (UI preview)

Pendant la rédaction, le composer surligne en temps réel tout mot interdit ou écart aux règles do/don't du brand kit du client (ex. concurrent cité, tutoiement alors que le client exige le vouvoiement). Un encart non bloquant explique la règle violée ; l'utilisateur peut ignorer ou corriger avant d'envoyer en validation.

- **Valeur freelance** : Évite l'erreur qui détruit la confiance (nom d'un concurrent, claim interdit) — surtout en batch mensuel où on rédige 30 légendes d'affilée pour des clients différents.
- **Inspiration** : Vérificateurs de style type Grammarly Business / linters, appliqués aux légendes.

#### `P1` · [calendar] Règles d'automatisation par client _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Dans les réglages du client, toggles de règles de workflow : « publier automatiquement dès approbation au créneau planifié », « si non validé 48 h avant la date prévue, décaler automatiquement et prévenir », « relancer le Reviewer après X jours sans réponse ». Le calendrier affiche un pictogramme sur les tuiles régies par une règle, et chaque déclenchement apparaît dans les notifications.

- **Valeur freelance** : Supprime le baby-sitting des validations : le freelance en batch mensuel n'a plus à revenir manuellement publier chaque post approuvé ni à surveiller les retardataires.
- **Inspiration** : Auto-publish à l'approbation de Planable ; rappels d'approbation de Gain.
- **⚠️ Faisabilité** : Compatible si les invariants du PRD §5.B sont respectés : auto-programmation à l'approbation OK uniquement si date ≥ maintenant + 15 min ; approbation tardive = JAMAIS de publication auto (retour admin, règle actée). Décalage auto à H-48 = nouvelle règle viable (la date n'invalide pas une approbation). Relances Reviewer déjà prévues en V2 (PRD §4 « relances automatiques »). Chaque déclenchement → Module I.

#### `P1` · [transversal] Recherche globale et palette de commandes _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Cmd+K étendu : recherche plein texte sur tous les clients à la fois (légendes, hashtags, notes, noms de fichiers), actions rapides (« planifier X », « ouvrir la grille de Y »), section « récents » (derniers contenus/vues consultés), et filtres transverses type « tous les Reels non validés toutes marques confondues ».

- **Valeur freelance** : « Où est ce post sur les soldes que j'ai écrit le mois dernier ? » trouve sa réponse en 2 secondes au lieu de 5 minutes de fouille client par client — vital en batch multi-clients.
- **Inspiration** : Palette Cmd+K de Linear et Notion ; recherche transverse de Slack.
- **⚠️ Faisabilité** : La recherche full-text est explicitement au backlog PRD (§4). À découper : palette Cmd+K (actions rapides, récents, filtres transverses) = pur front, OK dès la preview ; le plein texte serveur viendra plus tard (Postgres FTS, toujours filtré RLS/org). Ne pas promettre la recherche dans les noms de fichiers avant d'avoir le backend.

#### `P1` · [transversal] Journal d'activité par contenu _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI) · 🔧 à adapter

Onglet « Historique » sur chaque contenu : timeline horodatée de qui a créé, modifié, envoyé en validation, commenté, approuvé, planifié et publié, avec diff des légendes entre versions. Consultable aussi depuis le portail côté admin (pas côté Reviewer).

- **Valeur freelance** : La preuve en cas de litige : « vous avez approuvé ce post le 12 à 14 h 32 ». Protège le freelance, l'actif le plus fragile de la relation client.
- **Inspiration** : Activity log de Planable, historique de page Notion.
- **⚠️ Faisabilité** : Partiellement prévu : approbations insert-only avec snapshot de version (§5.F), permutations journalisées (§5.C), « historique complet conservé sur chaque contenu », audit log généralisé au backlog (§4). Le diff de légendes entre versions exige un versioning des révisions non prévu au modèle §6 — à ajouter si retenu. Le reste = agrégation d'événements déjà produits.

#### `P1` · [transversal] Archivage client et corbeille _(effort M)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

Archiver un client parti : il passe en lecture seule, disparaît des listes et du switcher, avec export complet en un clic (médias + légendes + historique) pour la réversibilité. Corbeille des contenus supprimés avec restauration pendant un délai de grâce avant purge des médias. Vue « archives publiées » par année/mois pour ne pas alourdir le calendrier courant.

- **Valeur freelance** : Un freelance perd et regagne des clients en continu : archiver proprement sans rien perdre (ni payer du stockage à vie) est une question qui arrive dès le mois 3.
- **Inspiration** : Archivage de canaux Slack, corbeille 30 jours de Notion.
- **Note** : Cœur déjà spécifié PRD §5.A : soft-delete archived_at, annulation des jobs, révocation tokens/reviewers, conservation des preuves. Extensions compatibles : export un clic (réversibilité, complète le flux RGPD), corbeille avec délai de grâce, vue archives. Attention : restauration après purge J+7 → la règle « re-uploader le média » (§5.J) s'applique.

#### `P1` · [transversal] Capture rapide mobile _(effort S)_
🎨 mockable dès maintenant (UI preview) · 📋 déjà prévu au PRD (absent de l’UI)

FAB visible sur toutes les vues mobiles : ouvre le picker Photos iOS, l'utilisateur choisit photo/vidéo prise chez le client, sélectionne le client de destination, et le média atterrit dans sa médiathèque avec statut « idée » (légende optionnelle en deux taps). Conforme à la décision actée : FAB + picker, pas de Share Target.

- **Valeur freelance** : Le freelance shoote en rendez-vous client et perd ensuite 20 minutes à trier sa pellicule. Capturer vers le bon client sur le moment, c'est le réflexe quotidien qui rend Ocean indispensable.
- **Inspiration** : Quick add de Things 3, capture rapide Todoist.
- **Note** : C'est exactement le fallback acté : FAB « Nouveau contenu » → picker Photos natif (PRD §8.5, Parcours 4, analyse §3.4). Le statut « idea » existe dans la machine à états. Upload TUS chunks 6 MB ; iOS = upload au premier plan uniquement (l'UI ne promet jamais le contraire).

#### `P1` · [studio] Kanban de production _(effort M)_
🎨 mockable dès maintenant (UI preview)

Vue kanban transverse (tous clients ou filtrée) des contenus par étape : idée → à produire → à valider → planifié → publié. Chaque carte porte une checklist de production (visuel fait, légende relue, hashtags ajoutés) distincte du statut de validation, et une deadline interne de production séparée de la date de publication, avec alertes. En-tête « charge de la semaine » : nombre de contenus à produire par client.

- **Valeur freelance** : Le calendrier répond à « quand ça part », pas à « où j'en suis dans ma production ». Pour un batch mensuel de 40 contenus sur 6 clients, le pipeline de travail est la vue qui manque.
- **Inspiration** : Boards Trello des SMM, vues kanban Notion/ClickUp adaptées au contenu social.

#### `P1` · [transversal] Accessibilité grille et calendrier _(effort M)_
🎨 mockable dès maintenant (UI preview)

Alternative clavier complète au drag-and-drop : menu contextuel « déplacer vers… » sur chaque tuile de grille et de calendrier. Pastilles de statut en contraste AA avec icône + libellé (jamais la couleur seule), labels ARIA et annonces lecteur d'écran sur les changements de statut, respect de prefers-reduced-motion sur les animations de drag et transitions.

- **Valeur freelance** : Conformité (RGAA pour de futurs clients publics) et robustesse : le « déplacer vers… » sert aussi tout utilisateur mobile pour qui le drag tactile est pénible — à intégrer dès la preview front, c'est dix fois plus coûteux en retrofit.
- **Inspiration** : WCAG 2.2 (2.5.7 Dragging Movements), navigation clavier des boards Trello.

#### `P2` · [transversal] Banque d'inspiration par client _(effort M)_
🎨 mockable dès maintenant (UI preview)

Section « Inspiration » par client : l'utilisateur colle un lien IG/TikTok ou dépose un screenshot, le tague par pilier de contenu, et ajoute une note. Une liste de comptes concurrents/inspirants à suivre par client complète la banque, avec rappel de veille hebdomadaire. Bouton « créer un contenu depuis cette référence » qui ouvre le studio pré-rempli. Sur PWA iOS, l'ajout passe par le FAB + collage de lien (pas de Share Target, conformément à la décision actée).

- **Valeur freelance** : Le swipe file du freelance vit aujourd'hui dans les posts enregistrés IG, illisibles par client. Centraliser l'inspiration au bon endroit alimente directement le batch mensuel.
- **Inspiration** : Posts enregistrés Instagram en collections, mymind, swipe files Notion des SMM.

#### `P2` · [calendar] File evergreen et auto-remplissage _(effort M)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Les contenus marqués « evergreen » rejoignent une file par client. L'utilisateur active le remplissage automatique : les créneaux récurrents vides sont comblés depuis l'étagère « À planifier » dans l'ordre de priorité, puis par recyclage cyclique des evergreen (avec délai minimal entre deux reprogrammations du même post). Les tuiles auto-remplies sont visuellement distinctes et restent déplaçables.

- **Valeur freelance** : Garantit la cadence contractuelle même les semaines creuses — l'angoisse du trou dans le calendrier disparaît.
- **Inspiration** : Queue de Buffer, recyclage SocialBee, bibliothèque MeetEdgar.
- **⚠️ Faisabilité** : Conflit direct avec la rétention actée : originaux purgés J+7 après publication (décision #13, PRD §5.J) → recycler un evergreen publié exige l'original. À adapter : flag « evergreen » excluant l'asset de la purge (coût stockage à accepter), sinon limiter l'auto-remplissage à l'étagère « À planifier » (jamais publiés). Re-publier le même média = nouveau post (OK API) mais consomme les quotas (IG 100/24h).

#### `P2` · [transversal] Inbox commentaires par client _(effort L)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Boîte de réception unifiée des commentaires IG/FB par client, filtrée sur les posts publiés via Ocean : répondre, marquer traité, masquer/signaler, réponses enregistrées (FAQ du client). Alertes sur mots sensibles définis par client. Notification « premiers commentaires » dans l'heure suivant chaque publication pour soigner l'engagement initial.

- **Valeur freelance** : L'heure qui suit la publication décide de la portée du post ; le freelance qui gère aussi la modération arrête de jongler entre 8 comptes IG.
- **Inspiration** : Inbox d'Agorapulse (référence du marché), conversations Iconosquare.
- **⚠️ Faisabilité** : Faisable pour IG/FB (gestion des commentaires couverte par IG Login + Pages API, budget BUC à surveiller) mais TikTok impossible (Content Posting API sans accès commentaires). Gros périmètre non prévu au MVP — le backlog PRD ne mentionne que le « fil de commentaires auto » (§4). À reporter V2, limité IG/FB, mock possible en preview.

#### `P2` · [studio] Trim vidéo et sous-titres Reels _(effort L)_
🎨 mockable dès maintenant (UI preview) · 🔧 à adapter

Sur un Reel, éditeur léger : trim début/fin sur timeline, repère visuel « hook 3 premières secondes », et sous-titres burn-in générés automatiquement puis éditables ligne par ligne (police/position aux couleurs du brand kit). En preview front : éditeur mocké avec transcription factice.

- **Valeur freelance** : 85 % des Reels sont vus sans le son ; aujourd'hui le freelance repasse par CapCut pour chaque vidéo. Garder les sous-titres dans Ocean fait gagner 15 minutes par Reel.
- **Inspiration** : CapCut auto-captions, Submagic (très utilisé par les SMM FR).
- **⚠️ Faisabilité** : Trim léger côté client : envisageable mais coûteux (ré-encodage, Reels ≤300 MB, moov faststart à préserver — §5.J). Sous-titres auto = transcription (aucun service dans la stack) + burn-in = ré-encodage complet, irréaliste sur iPhone/PWA. À reporter V2 (« transcodage avancé » §4), potentiellement côté worker. En preview : mock OK comme proposé.

### 5.2 Écartées (1)

| Feature | Raison |
|---|---|
| [transversal] Link-in-bio par client | Aucun blocage API (page publique hébergée, pas de dépendance Meta), mais c'est un produit annexe complet (hébergement public multi-domaine, éditeur drag-and-drop, analytics de clics) absent du PRD et de l'analyse, et ses stats dépendent du module Performance (V2). Hors scope MVP/V2 actuel — à reproposer post-V2 si le besoin émerge en phase solo. |


## Annexe A — Contraintes API/scope ayant servi de filtre

- Meta Standard Access (app type Business, pas de modes dev/live) : publication réelle et PUBLIQUE sans App Review, limitée aux ~50 comptes testeurs avec rôle sur l'app (500 si Business Manager vérifié) — couvre toute la phase solo ; App Review/Advanced Access requis seulement à l'ouverture SaaS (V2)
- Visibilité publique des posts Meta en Standard Access non garantie par écrit (confiance moyenne) → Spike 1 obligatoire au jour 1 du Lot 2 : publier 1 post test IG + 1 FB et vérifier depuis un compte tiers sans rôle
- Onboarding compte client Instagram : le compte doit être ajouté comme testeur dans l'App Dashboard, être PUBLIC, et son titulaire doit accepter l'invitation
- Instagram via « Instagram API with Instagram Login » (graph.instagram.com, scopes instagram_business_*) : photos, carrousels ≤10, Reels, Stories SANS Page Facebook — mais pas d'ads, pas de tagging, pas de recherche hashtag, pas de resumable upload (URL publique obligatoire au moment de la publication)
- Quota Instagram : 100 posts API/24h glissantes par compte (carrousel = 1 post) + 400 créations de conteneurs/24h — vérification via GET /content_publishing_limit AVANT chaque post ; quota atteint → report automatique + notification (décision actée)
- Workflow IG asynchrone imposé : POST /media → polling status_code 1×/min (budget 10 min) → POST /media_publish ; conteneur expiré à 24h ; toute vidéo feed = Reel (media_type VIDEO n'existe plus)
- Specs IG : images JPEG UNIQUEMENT ≤8 MB, ratio 4:5–1.91:1, largeur 320–1440 px (conversion PNG/HEIC obligatoire côté client) ; Reels MP4/MOV moov atom en tête (faststart), 3 s–15 min, ≤300 MB ; Stories ≤100 MB / 60 s
- Tokens IG Login : long-lived 60 jours, refresh seulement si ≥24h d'âge et non expiré — non rafraîchi en 60 jours = DÉFINITIVEMENT perdu → job de refresh quotidien (seuil <10 j) indispensable
- Facebook : créer l'app via use case Business — une app Consumer en mode dev publie des posts INVISIBLES du public ; publication limitée aux Pages où l'utilisateur détient la tâche CREATE_CONTENT (attribuée par le client via Meta Business Suite) ; tokens de Page sans expiration
- Programmation native Meta (scheduled_publish_time, 10 min–30 j) limitée au feed Facebook — Reels et Stories n'en ont PAS → toute la programmation passe par le worker interne, uniformément
- Quotas Facebook : BUC 4800 appels × engaged users/24h par Page (petites Pages clientes = budget réduit, surveiller le header X-Business-Use-Case-Usage) + 30 Reels API/24h par Page (compteur enforced par l'app) ; specs FB : Reel 9:16 min 540×960, 3–90 s, 24–60 fps ; photo JPEG/PNG ≤4 MB
- Statistiques/insights : HORS MVP — dépréciation massive des métriques Pages en v25.0, suppression à v26.0 fin 2026 → le module stats V2 devra cibler les nouvelles métriques (views, reposts) ; aucune gestion de commentaires au MVP (fil auto = backlog)
- TikTok : PAS de mode dev utilisable en production — le Sandbox (10 comptes) ne produit pas de posts publics ; la phase solo est déjà de la production → revue d'app TikTok standard à soumettre dès le DÉBUT du Lot 2 (privacy policy + démo, quelques jours à semaines) ; fallback à coût zéro = canal manuel Sur mesure
- TikTok MVP = brouillon vidéo UNIQUEMENT (scope video.upload, statut pushed_to_platform) : échappe à l'audit Content Posting et aux restrictions SELF_ONLY ; l'utilisateur finalise lui-même dans l'app TikTok ; Direct Post public = V2 (audit 2–4 semaines, mockups + screencast d'app finie, ~15 posts/24h)
- Brouillons TikTok vidéo : la légende n'est PAS pré-remplie (le pré-remplissage n'existe que pour les photos) → bouton « copier la légende » + notification push à l'heure H + relance J+1 si jamais marqué publié
- Quotas TikTok : 5 brouillons en attente/24h par créateur (atteint → re-tentative horaire sans heure promise, il faut finaliser des brouillons dans l'app) + 6 req/min/token sur les endpoints init ; durée vidéo max propre à chaque créateur (à lire via creator_info)
- Transport vidéo TikTok : FILE_UPLOAD chunké (5–64 MB) depuis le worker obligatoire — PULL_FROM_URL impossible sur *.supabase.co (vérification de propriété du domaine requise) ; prévoir RAM/disque VPS ~200 MB par Reel
- Carrousels photo TikTok = V2 par défaut : photos en PULL_FROM_URL uniquement (pas de FILE_UPLOAD photo) → custom domain Supabase payant requis + Spike 2 (erreur 403 unaudited_client_can_only_post_to_private_accounts documentée sans exemption explicite du mode brouillon)
- Guidelines UX TikTok à respecter même en mode brouillon : consentement explicite avant upload, affichage du compte cible, information « finalise via la notification inbox », pas de watermark tiers
- Google Calendar en mode test : refresh tokens expirés tous les 7 jours (reconnexion hebdo) → vérification « scope sensible » (gratuite, ~10 j, sans CASA) à lancer dès le jour 1 du Lot 4 ; 600 req/min/user ; max 100 refresh tokens par compte/client_id (le plus ancien révoqué silencieusement)
- Microsoft : zéro friction en phase solo (propre tenant + comptes perso) ; en phase SaaS, « Secure by Default » (2025) bloque le consentement utilisateur sur Calendars.* dans les tenants M365 → admin consent + publisher verification = jalon V2 ; rotation du refresh token à chaque échange (verrou requis)
- Agenda unifié : LECTURE SEULE au MVP (écriture deux sens = V2, décision actée) ; sync par polling fenêtré 15 min (le syncToken Google est incompatible avec timeMin/timeMax) ; événements all-day jamais convertis en UTC
- Supabase Free plafonne à 50 MB/fichier → passage Pro (25 $/mois) OBLIGATOIRE avant le premier test de Reel au Lot 2 (les Reels font jusqu'à 300 MB) — item de checklist bloquant
- Meta exige une URL média publiquement accessible « at the time of the attempt » → URL signée TTL 48h générée par le worker à la publication, régénérée à chaque retry ; jamais de bucket public pour du contenu client non publié
- Rétention médias : originaux purgés J+7 après publication (seulement si toutes les cibles sont en état terminal succès/abandon — un échec en attente bloque la purge) ; jamais-publiés purgés à 180 j avec préavis ; retry/duplication après purge = re-upload demandé ; les miniatures WebP persistantes sont le seul historique visuel de la grille
- PWA iOS : un magic link ouvert depuis Mail crée la session dans Safari, PAS dans la PWA installée (déconnexion en boucle) → OTP 6 chiffres obligatoire sur mobile ; le push iOS exige l'installation écran d'accueil (Declarative Web Push iOS 18.4+, inchangé iOS 26)
- Limites PWA iOS : Web Share Target = Android uniquement (fallback FAB + picker Photos, ~1 tap de plus) ; l'upload ne progresse qu'app au premier plan ; partage galerie iOS et upload écran verrouillé = impossibles en PWA (natif V2) ; jamais de publication offline
- Règles produit verrouillées : jamais de publication automatique d'un contenu non programmé (approbation tardive → reprogrammation manuelle) ; date de programmation ≥ maintenant + 15 min ; fenêtre de grâce worker < 2h sinon échec + nouvelle date choisie par l'owner ; 0 double publication (idempotence : publish_started_at + vérification d'état distant avant tout retry)
- Newsletter : 100% manuelle au MVP (cible awaiting_manual + rappel à l'heure H, champ objet dès le MVP) — envoi réel via Brevo POST /v3/emailCampaigns en V2 ; canal Sur mesure = manuel, sert aussi de fallback TikTok
- Pas d'annotation vidéo au MVP dans le portail client (commentaire simple uniquement) ; commentaires reviewer immuables (pas d'édition/suppression)
- Phase solo : Étienne = unique utilisateur (owner) sur iPhone, ses clients en testeurs Meta ; monétisation Stripe hors périmètre MVP ; UI FR only ; TZ client pour le contenu, TZ freelance pour l'agenda, stockage UTC
- Phase actuelle (11/06/2026) : preview front UI-ONLY avec données mockées typées dans packages/shared — ne câbler AUCUN backend (Supabase, Meta, TikTok, Brevo, remote GitHub) tant que le front n'est pas validé par Étienne ; les types/enums des mocks doivent refléter la future DB du PRD §6

## Annexe B — Modèle de données mocké : écarts relevés

### Champs/entités mockés non exploités par l’UI, ou manquants au modèle

- ReviewRequest est entièrement orpheline : aucune UI de « demande de validation groupée » (sélection multi-contenus → envoi au reviewer), alors que c'est LE geste du workflow batch mensuel du persona. ReviewStateBadge existe mais n'est monté nulle part ; sentAt/state/message invisibles.
- ContentTarget.externalPostId n'est affiché nulle part (seul permalink l'est) ; Reviewer.lastActiveAt jamais affiché — utile pour relancer un client qui ne valide pas (Marc, lastActiveAt null, serait le cas d'usage parfait).
- MediaAsset.width/height ne sont lus par aucun composant : les ratios sont figés en CSS (aspect-square grille, 4:5 portail, 4:3 studio). Aucune visualisation du ratio réel ni alerte « ratio hors bornes IG 4:5–1.91:1 » pourtant critique avant programmation (règle CLAUDE.md §22).
- Enums présents mais jamais instanciés dans les données : ContentStatus canceled, TargetStatus awaiting_manual/skipped/canceled, AccountStatus expired, Platform custom, ReviewRequestState pending/done. Les badges existent mais ces états sont invisibles en preview — la cible newsletter « scheduled » reçoit « pending » au lieu de « awaiting_manual » qui semblait fait pour elle.
- Dashboard : les filtres « À reprogrammer » (reschedule) et « À publier manuellement » (manual_due) sont présents dans task-list.tsx mais getDashboardTasks ne génère jamais ces tâches → chips toujours vides ; la notification manual_due (newsletter) existe pourtant côté NOTIFICATIONS.
- La notification audience « ops » (watchdog) n'est affichable nulle part : toutes les requêtes UI sont getNotifications("owner").
- Aucune entité quota/compteur API mockée (IG 100 posts/24h, FB 30 Reels/24h/Page, TikTok 5 brouillons/24h) alors que la notification publish_delayed y fait référence et que le CLAUDE.md §6 exige un affichage ergonomique du quota restant. Impossible de prototyper la jauge de quota ou le report auto en UI.
- Caption unique partagée entre toutes les plateformes : pas de variante de légende par cible (IG vs FB vs TikTok), standard chez les outils SMM pro et nécessaire vu les contraintes différentes (hashtags IG vs ton FB).
- Pas de « premier commentaire » IG (emplacement classique des hashtags), pas de localisation/géotag, pas de mentions/tags de comptes ni collab — ironiquement, l'internalNotes mocké dit « Penser à taguer le lieu et le partenaire », preuve que le besoin existe mais qu'aucun champ ne le porte.
- Pas d'alt text par média (accessibilité + bonne pratique IG), pas de cover personnalisée pour les Reels (coverUrl/frame), pas d'options TikTok (privacy, duet/stitch/commentaires) ni de lien/sticker pour les Stories.
- Pas de brand kit client : seulement brandColor + bio. Manquent logo (l'avatar IG de la grille est improvisé depuis le 1er post importé), palette, ton de voix, et surtout des groupes de hashtags réutilisables par client — le freelance retape ses hashtags à chaque post.
- Pas de bibliothèque média au niveau client : MediaAsset n'existe qu'imbriqué dans un ContentItem, donc aucun écran « médiathèque » (réutilisation d'assets entre posts, dépôt de fichiers par le client) n'est prototypable.
- Aucune métrique de performance (likes/reach/commentaires), même pas sur ImportedPost — rien pour nourrir un volet « résultats » du dashboard ni justifier la valeur auprès du client final.
- Pas de versionnage réel des contenus : Approval.versionLabel est « v1 » en dur, sans entité ContentVersion ni historique avant/après corrections — pourtant le flux changes_requested → nouvelle version est central au produit (approvalStale l'effleure seulement).
- Pas de créneaux de publication récurrents / best-time-to-post (queue slots) ni de récurrence d'événements agenda — utiles pour le travail en batch mensuel du persona.
- Comment sans flag resolved ni fil de réponse : impossible de prototyper le « marquer comme traité » côté studio après correction.

### Notes sur les mocks

- Qualité d'ensemble très solide : horloge figée MOCK_NOW (11/06/2026 08:00 UTC, apps/web/lib/mocks/time.ts) → rendu déterministe sans mismatch d'hydratation ; génération par BLUEPRINT couvrant toute la machine à états du PRD (idea → published/partially_published/failed, brouillon TikTok pushed_to_platform inclus) ; copies FR crédibles par secteur (café, resto, mode, yoga) avec hashtags.
- Volumes : 5 clients (1 archivé), 9 comptes sociaux, 66 contenus, ~110 cibles, 24 posts importés, 20 commentaires (~6 annotés), 24 approbations, 4 review requests, 10 notifications, 13 événements calendrier, 2 comptes agenda. Suffisant pour éprouver grille, calendrier et studio en conditions réalistes.
- Limite de réalisme : le même blueprint rejoué pour les 4 clients actifs produit des timelines clonées (tous ont un échec hier 19h, un carrousel demain 11h…) — visible dès qu'on navigue entre clients ou sur l'agenda unifié. Quelques décalages par client casseraient l'effet miroir.
- Incohérence mineure : lastError « Token expiré : reconnecte le compte Instagram » est posé sur le reel failed de TOUS les clients, alors que seul le compte IG de Brûlerie est needs_reauth — Verde/Nove/Rise ont un échec token avec un compte « Connecté ». Doublon d'image dans le pool yoga (id Pexels 8436449 en 1re et dernière position).
- Branchement Supabase facilité par la couche d'accès centralisée de apps/web/lib/mocks/index.ts (getContentItems, getPortalContent, getUnifiedAgenda, getDashboardTasks, getNotifications…) : conserver ces signatures et les réimplémenter en requêtes/vues (unified_agenda) limitera la réécriture aux imports, pas aux composants.
- Écarts à prévoir pour le mapping DB : champs camelCase vs snake_case du PRD §6, AUCUN org_id sur les entités (seulement clientId — l'org est implicite), IDs lisibles préfixés (cl_, ct_, tg_) vs uuid, dates ISO string vs timestamptz. Un adaptateur de types dans packages/shared (annoncé par le CLAUDE.md comme emplacement des mocks, qui vivent en réalité dans apps/web/lib/mocks) résoudrait les deux sujets : partage avec le worker + conversion.
- deriveStatus/assignTargetStatus (apps/web/lib/mocks/content.ts) encodent déjà l'agrégation cibles → statut global (partially_published émergent) prévue côté DB/worker : à extraire vers packages/shared pour garantir la même logique entre UI, vues SQL et worker.
- Les couleurs respectent strictement la règle « zéro hardcode » : brandColor oklch en donnée, colorVar via var(--chart-N) et var(--instagram|facebook|tiktok) — le swap de thème restera gratuit. labels.ts est directement réutilisable comme référentiel i18n FR post-backend.
- Images Pexels distantes via next/image (48 URLs CDN) : dépendance réseau en démo et remotePatterns requis ; prévoir le swap vers les vignettes Supabase media-thumbs (même forme thumbUrl/fullUrl, déjà séparées dans MediaAsset — bon présage pour originals privés + thumbs publics).
- Fichiers analysés : apps/web/lib/mocks/{types,index,clients,content,copy,images,imported,interactions,agenda,notifications,labels,time}.ts, apps/web/lib/format.ts, apps/web/lib/routes.ts, apps/web/components/shared/{status-badge,platform-badge,client-avatar,media-thumb,format-icon,empty-state,page-header,brand-icons}.tsx, recoupés avec les pages grid/studio/portal/dashboard/agenda/notifications.

---

_Audit généré par workflow multi-agents Claude Code — 21 agents, 198 findings benchmark. Source brute : run wf_95b9e102-d12._