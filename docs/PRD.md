# PRD — Ocean

**Plateforme de gestion de contenu social pour freelances marketing**

**Nom :** Ocean *(acté le 11/06/2026 — vérification INPI/EUIPO classes 9, 35, 42 + domaine + handles à faire avant tout lancement commercial)*
**Version :** 0.2 — verrouillée pour le développement
**Dernière mise à jour :** 11 juin 2026
**Documents liés :** [ANALYSE-LANCEMENT.md](ANALYSE-LANCEMENT.md) (vérification API juin 2026, architecture détaillée, décisions) · [archive/PRD-v0.1.md](archive/PRD-v0.1.md)

**Changelog v0.1 → v0.2 :**
- Corrections factuelles API (Meta, TikTok, Google, Microsoft) après vérification sur docs officielles — §7.
- Nouveau : entité **ContentTarget** (statut par plateforme), machine à états complète, validation client **optionnelle par contenu** — §5.B.
- Nouveau : **Module I — Notifications** et **Module J — Médias** (référencés mais non définis en v0.1).
- Nouveau : **import du feed Instagram existant** dans la grille (MVP) — §5.C.
- Sémantique du drag & drop tranchée (permutation des dates) — §5.C.
- Règles fuseaux horaires, approbation tardive, idempotence, fenêtre de grâce — §5.B, §5.E.
- Stack arrêtée sur la stack canonique Propul'SEO (Supabase Storage, worker Node SKIP LOCKED, OAuth custom + Vault) — §8.
- Jalon ajouté : **revue d'app TikTok à soumettre dès le début du Lot 2** (le Sandbox ne couvre pas la production) — §7.
- Les 11 décisions ouvertes de la v0.1 sont actées — §13.
- Passé au crible d'une vérification adversariale (4 lentilles : complétude, cohérence, exactitude, implémentabilité) le 11/06/2026 — corrections intégrées : règles d'agrégation des statuts (ensemble S), cycle `awaiting_manual` des canaux manuels, règle multi-reviewers unique, carrousels photo TikTok reportés en V2 par défaut (PULL_FROM_URL → custom domain), bornes du drag & drop, éditabilité par statut, champs invalidant une approbation.

---

## 1. Résumé exécutif

### Le problème
Un freelance qui gère la communication de plusieurs entreprises jongle entre 4 ou 5 outils : un planificateur de posts (Later, Planoly), un outil de preview de feed, un Notion/Trello pour le calendrier éditorial, des allers-retours mail/WhatsApp pour la validation client, et son agenda pour les rendez-vous. Rien n'est centralisé, le suivi multi-clients est fastidieux.

### La solution
Un SaaS unique, pensé **pour le freelance en marketing**, qui réunit :
1. La **planification et la publication** multi-plateforme (Instagram, Facebook, TikTok, newsletter, canaux sur mesure).
2. L'**aperçu visuel du feed Instagram** (grille), incluant le feed existant du client.
3. Le **calendrier éditorial** par client.
4. Un **espace de validation client** (relecture, commentaires, annotations, approbation).
5. Un **agenda unifié** (Google + Outlook) superposé au planning éditorial.

### Positionnement
> « Le poste de pilotage du freelance en communication : tout ce qu'une agence fait dans 5 outils, dans un seul, sans la complexité. »

### Stratégie produit
Conçu **dès le départ comme un SaaS multi-locataire**, mais **testé en solo** par son créateur. Cet avantage est réel mais **différencié par plateforme** (vérifié juin 2026, détail §7) :
- **Meta (Instagram + Facebook)** : le **Standard Access** (app de type Business) permet la publication réelle et publique sur les comptes où le freelance a un rôle, **sans App Review** — jusqu'à ~50 testeurs (500 si Business Manager vérifié). ✅ Couvre toute la phase solo.
- **TikTok** : **pas d'équivalent**. Le Sandbox ne produit pas de posts publics ; la phase solo est déjà de la production → la **revue d'app TikTok standard** (dossier léger, quelques jours à semaines) est un jalon bloquant du Lot 2. Le mode brouillon évite en revanche l'**audit Content Posting** (réservé au Direct Post public, V2).
- **Google Calendar** : le mode test fait expirer les refresh tokens **tous les 7 jours** → la vérification « scope sensible » (gratuite, ~10 jours, sans CASA) est à lancer tôt (Lot 4).
- **Microsoft** : zéro friction en solo (propre tenant + comptes perso).

---

## 2. Objectifs & indicateurs de succès

### Objectifs produit
- **O1** — Réduire à un seul outil le flux de travail quotidien d'un freelance multi-clients.
- **O2** — Planifier et publier un contenu Instagram/Facebook en quelques clics, web ou mobile.
- **O3** — Offrir une boucle de validation client fluide, sans mails ni captures d'écran.
- **O4** — Donner une vue unifiée du temps : rendez-vous + planning de publication.

### Indicateurs (phase test solo)
- Le créateur gère **100 % de ses clients** sur l'outil (plus de Notion/Later en parallèle).
- **≥ 80 %** des posts Instagram/Facebook publiés directement depuis l'app.
- Temps de préparation d'un post planifié : **< 3 min** de l'idée à la programmation.
- Cycle de validation client : **< 24 h** grâce au portail.
- **0 double publication** et **0 échec silencieux** (toute anomalie produit une notification).

### Indicateurs (phase SaaS, post-MVP)
- Activation : % de nouveaux comptes qui connectent ≥ 1 réseau et planifient ≥ 1 post.
- Rétention à 30 jours.
- Nombre de clients gérés par utilisateur.

---

## 3. Personas & rôles

### Persona principal — « Le freelance / community manager »
Gère la communication de 3 à 15 entreprises. Travaille sur ordinateur en journée, publie depuis son **iPhone** au bon moment (l'utilisateur de la phase solo est sur iOS — priorité PWA iOS, cf. §8.5).
**Rôle produit : `owner`** (rôle org). Accès total : espaces clients, comptes sociaux, contenu, programmation, facturation (V2).

### Persona secondaire — « Le client » (Reviewer)
Le contact côté entreprise qui valide les publications. Pas un expert outil.
**Rôle produit : `reviewer`** (rôle scopé à UN client). C'est un **vrai compte Supabase Auth créé par invitation** (magic link / OTP — UX perçue : « je clique sur un lien dans l'email », zéro mot de passe), ce qui donne une identité authentifiée aux approbations (valeur de preuve) et porte l'isolation RLS. Accès strictement limité à son espace : lecture des contenus partagés + commentaires/annotations + approbation. Jamais les autres clients, les tokens, les réglages.

### Personas futurs (post-MVP, prévus dans l'architecture)
- **`editor`** (rôle scopé client) : sous-traitant partageant un ou plusieurs clients.
- **`admin`** (rôle org) : administrateur d'agence (AgencyAdmin).

> **Implication d'architecture :** rôles portés par deux tables d'appartenance (`organization_members` : owner/admin ; `client_members` : reviewer/editor) — l'ajout d'un rôle futur = un INSERT + une policy, zéro refonte. Détail §8.1.

---

## 4. Périmètre — MVP vs V2 vs Backlog

| Domaine | MVP (V1) | V2 | Backlog |
|---|---|---|---|
| Espaces multi-clients | ✅ Création, isolation, navigation, archivage (soft-delete) | | Équipes / collaborateurs partagés |
| Studio de contenu | ✅ Anatomie complète, statuts par plateforme (ContentTarget), validation optionnelle | Variantes de légende par plateforme, IA de rédaction | Bibliothèque de hashtags |
| Aperçu feed Instagram | ✅ Grille 3 colonnes, drag & drop (permutation de dates), **import du feed existant**, posts planifiés + publiés | Aperçu profil complet (bio, highlights) | Grille TikTok |
| Calendrier éditorial | ✅ Vue mois/semaine par client | Vue multi-clients superposée, modèles récurrents | |
| Publication / programmation | ✅ Instagram + Facebook (réel, 1-clic / programmé), TikTok **brouillon vidéo**, canaux manuels | TikTok Direct Post public (post-audit), carrousels photo TikTok (custom domain + Spike 2), newsletter via Brevo | Fil de commentaires auto |
| Validation client | ✅ Portail client (compte invité), commentaires, annotations (pin), approbation versionnée, demandes de revue (lots) | Validation par lot en 1 clic, relances automatiques | Signature électronique |
| Notifications (Module I) | ✅ In-app (Realtime) + Web Push + email Brevo selon matrice | Préférences fines par événement | Digest quotidien |
| Médias (Module J) | ✅ Validation/conversion à l'upload, miniatures, rétention J+7 | Transcodage avancé | |
| Agenda unifié | ✅ Google + Outlook (OAuth custom), lecture + superposition | Écriture deux sens | Prise de rdv type Calendly |
| Statistiques | ❌ | ✅ Reach, engagement, meilleurs créneaux (⚠️ nouvelles métriques v26.0) | Rapports clients PDF |
| Facturation SaaS | ❌ (test solo) | ✅ Stripe Subscriptions | Facturation des clients finaux |
| Recherche, audit log global | ❌ | | ✅ Full-text, audit log généralisé |
| Plateforme | ✅ Web responsive + PWA (priorité iOS) | Apps natives (si métriques PostHog le justifient) | |

---

## 5. Fonctionnalités détaillées

### Module A — Espaces de travail multi-clients

**Description.** Chaque entreprise gérée est un « espace client » isolé. Toute donnée (contenu, comptes sociaux, calendrier, validations) est rattachée à un client. Sélecteur global pour basculer. Un tableau de bord d'accueil donne la vue transversale.

**User stories.**
- En tant qu'owner, je crée un espace client (nom, logo, couleur, **fuseau horaire**) pour organiser mon travail.
- En tant qu'owner, je bascule rapidement d'un client à l'autre.
- En tant qu'owner, je vois un tableau de bord global agrégeant les **tâches du jour**.
- En tant qu'owner, j'archive un client en fin de collaboration sans perdre l'historique.

**Règles.**
- Toutes les vues sont contextualisées au client sélectionné, **sauf** le tableau de bord global et l'agenda unifié.
- Isolation stricte : les données d'un client ne fuient jamais vers un autre — ni vers un autre tenant (RLS + FK composites, §8.1).
- **Fuseaux horaires** : chaque client a un `timezone` (IANA, défaut Europe/Paris). Les dates de publication sont **saisies et affichées dans le fuseau du client** (c'est l'audience du client qui compte), **stockées en UTC** (`timestamptz`). L'agenda unifié s'affiche dans le fuseau du freelance. Le worker compare en UTC — un changement d'heure (DST) entre programmation et exécution ne décale rien : l'instant UTC fait foi.
- **Tâches du jour** (définition) : vue dérivée, pas d'entité « tâche » manuelle au MVP. Agrège : publications du jour (par statut), échecs à traiter, contenus `in_review` en attente depuis > 48 h ou dont la date approche (J-1), brouillons TikTok poussés non finalisés, comptes à reconnecter, rendez-vous du jour (agenda unifié).
- **Archivage client (offboarding)** : soft-delete (`archived_at`) sur Client. Effets : annulation des PublishJobs futurs, révocation des accès reviewer, déconnexion des comptes sociaux (révocation des tokens), **conservation** des contenus, miniatures et historiques d'approbation (preuve contractuelle). Suppression définitive (RGPD, droit à l'effacement) : action séparée, explicite, qui purge tout — ce mécanisme servira aussi à l'exigence « data deletion » des app reviews Meta/TikTok (V2).

---

### Module B — Studio de contenu

**Description.** L'unité de travail est le **contenu** (ContentItem). Un contenu vise une ou plusieurs plateformes : chaque ciblage est un **ContentTarget** qui porte son propre statut. Le studio crée, édite et fait avancer le contenu dans son cycle de vie.

**Anatomie d'un contenu :**
- Client (rattachement), créateur, notes internes
- **Cibles** (ContentTargets) : plateforme × compte social — Instagram, Facebook, TikTok, Newsletter, Sur mesure
- Format : post simple, carrousel, Reel/vidéo, story
- Légende commune + hashtags (variantes par plateforme : V2 ; exception : le canal Newsletter a un champ « objet » dédié dès le MVP, même si l'envoi reste manuel)
- Média(s) ordonnés (Module J)
- Date/heure de publication prévue (fuseau du client)
- Statut global (agrégé) + statut par cible
- Commentaires & annotations, approbations (Module F)

#### Machine à états

**Statut global ContentItem :**
`idea | draft | in_review | changes_requested | approved | scheduled | publishing | published | partially_published | failed | canceled`

**Statut par cible (ContentTarget) :**
`pending | queued | publishing | awaiting_manual | published | pushed_to_platform | failed | skipped | canceled`

Ensemble « succès » **S = {published, pushed_to_platform}** — utilisé par les règles d'agrégation du statut global ci-dessous.

**Transitions (matrice — toute transition absente est interdite) :**

| De | Vers | Déclencheur / règle |
|---|---|---|
| idea | draft | L'owner complète le minimum requis (≥ 1 cible, légende ou média) |
| draft | in_review | Envoi en revue (Module F) — **optionnel, par contenu** : décision actée |
| draft | scheduled | **Chemin direct sans validation** : date valide (≥ maintenant + 15 min), contenu minimum par cible respecté (§5.E) et médias — s'il y en a — valides pour chaque plateforme ciblée |
| in_review | approved | Approbation reviewer (Module F) |
| in_review | changes_requested | Demande de modification (statut **persistant**, le commentaire reste attaché) |
| in_review | draft | Retrait de la revue par l'owner (la ReviewRequest est mise à jour, le contenu redevient invisible au portail) |
| changes_requested | draft | L'owner modifie le contenu |
| changes_requested | approved | Nouvelle décision positive des reviewers (règle multi-reviewers — Module F) |
| approved | scheduled | Programmation (crée les PublishJobs par cible) |
| approved | draft | L'owner modifie le contenu → **l'approbation est invalidée** (marquée « périmée », le reviewer voit la nouvelle version au prochain envoi en revue) |
| scheduled | publishing | Le worker claim le(s) job(s) à l'heure H |
| scheduled | draft/approved | Annulation de la programmation (jobs `canceled`) — retour à `approved` si une approbation valide existe, sinon `draft` |
| publishing | published | Toutes les cibles ∈ S (le marquage manuel fait passer une cible `awaiting_manual` ou `pushed_to_platform` à `published`) |
| publishing | partially_published | ≥ 1 cible ∈ S ET ≥ 1 cible `failed` |
| publishing | failed | Toutes les cibles `failed` ou `canceled` |
| partially_published / failed | scheduled | **Retry ciblé** : re-programmer uniquement les cibles `failed` (jamais de re-publication d'une cible ∈ S — idempotence §5.E ; exige que l'original du média existe encore, sinon re-upload demandé — Module J) |
| partially_published | published | L'owner abandonne les cibles `failed` (→ `skipped`) et toutes les cibles restantes sont ∈ S |
| tout sauf published | canceled | Suppression/abandon du contenu (soft-delete) |

**Transitions ContentTarget :**

| De | Vers | Déclencheur |
|---|---|---|
| pending | queued | Programmation du contenu — **cibles API uniquement** (création du PublishJob) |
| pending | awaiting_manual | Heure H atteinte — **cibles manuelles** (Newsletter, Sur mesure) : pas de PublishJob, notification « à publier manuellement » (Module I) |
| queued | publishing | Le worker claim le job |
| publishing | published | Succès API (`external_post_id` + permalink stockés) |
| publishing | pushed_to_platform | TikTok : brouillon poussé dans l'inbox |
| publishing | failed | Échec définitif du job |
| pushed_to_platform | published | Action owner « marquer comme publié » (permalink optionnel) — relance J+1 si non marqué (Module I) |
| awaiting_manual | published | Action owner « marquer comme publié » |
| failed | queued | Retry ciblé (exige l'original du média — Module J) |
| failed | skipped | Abandon de la cible par l'owner (« publier sans cette plateforme ») |
| toute cible non terminale | canceled | Annulation de la programmation / du contenu |

**Règles complémentaires :**
- Le passage en `in_review` rend le contenu visible au portail client (Module F).
- Le passage en `scheduled` crée un PublishJob **par cible API** (Module E) ; les cibles manuelles n'en créent pas (rappel à l'heure H).
- Un contenu dont les cibles restantes sont `awaiting_manual` (aucune `failed`) reste `publishing` avec badge « action requise » jusqu'au marquage manuel — c'est l'état normal d'une newsletter en attente d'envoi.
- **Éditabilité par statut** : édition libre en `idea`/`draft`/`changes_requested` ; en `in_review`, édition interdite sans retrait de revue préalable (`in_review → draft`) ; en `scheduled`, seule la date est modifiable directement (annulation/recréation des jobs) — toute autre édition exige d'annuler la programmation ; interdite à partir de `publishing` (dupliquer le contenu pour repartir).
- **Validité & re-validation** : les conditions (date ≥ maintenant + 15 min, contenu minimum par cible, médias valides) s'appliquent à TOUTE transition vers `scheduled` (depuis `draft` ou `approved`) et à la publication 1-clic ; modifier les cibles ou le format **re-déclenche la validation des médias existants** (erreur bloquante immédiate, comme à l'upload).
- **Date dépassée en `in_review`** : alerte J-1 (Module I) ; si la date passe, le contenu reste `in_review` avec badge « périmé » + notification. Jamais de publication automatique d'un contenu non programmé.
- **Approbation après la date prévue** : le contenu passe `approved` mais sa date est invalide → tâche « à reprogrammer » au dashboard + notification. **Jamais de publication immédiate automatique.**
- Modifier la **date** d'un contenu `scheduled` (calendrier, grille ou studio) = annulation + recréation des jobs concernés (snapshot propre).
- Filtres du studio : par statut (global et par plateforme), par plateforme, par format.

---

### Module C — Aperçu du feed Instagram (grille)

**Description.** Fonctionnalité signature. Grille 3 colonnes reproduisant le feed Instagram d'un compte client : **posts importés** (le feed réel existant), **posts publiés via l'app** et **posts planifiés**, dans l'ordre chronologique inverse. Réorganisation par glisser-déposer pour composer l'esthétique avant publication.

**Import du feed existant (MVP — décision actée).**
- À la connexion d'un compte Instagram : import des posts existants via `GET /media` (médias + miniatures + permalink + timestamp), stockés comme **posts importés** (entité légère `imported_posts`, sans ContentItem). Miniatures persistées dans `media-thumbs`.
- Synchronisation périodique (worker, 1×/jour + bouton manuel) : nouveaux posts publiés hors outil (**dédupliqués** sur l'`external_post_id` des content_targets existants — pas de doublon avec les posts publiés via l'app) ; posts supprimés côté Instagram → retrait de la grille, et s'il s'agit d'un post publié via l'app : cible marquée `deleted_externally` (retrait de la grille, historique conservé).
- **Séquencement** : Lot 1 = entité `imported_posts` + rendu grille sur données de seed ; l'import réel et la sync sont branchés au Lot 2 (dépendent de l'OAuth et du worker).

**User stories.**
- En tant qu'owner, je vois la grille avec le feed réel du client + mes posts à venir pour juger l'harmonie visuelle.
- En tant qu'owner, je glisse-dépose les vignettes planifiées pour réorganiser le feed.
- En tant qu'owner, je distingue posts publiés (lecture seule), importés et planifiés (badge/opacité), et les Reels (icône dédiée).

**Règles.**
- La grille n'affiche que des **miniatures** (WebP ~400px, Module J) — jamais les originaux.
- **Sémantique du drag & drop (décision actée) : permutation des DATES.** Pas de champ d'ordre indépendant (il produirait une grille mensongère : l'ordre réel d'un feed Instagram est déterminé uniquement par l'heure de publication).
  - Un déplacement **permute les datetimes existants** entre les posts planifiés concernés : les créneaux restent les mêmes, seuls les contenus changent de créneau. Aperçu des nouvelles dates + **confirmation** avant commit.
  - Les posts publiés/importés forment une **zone verrouillée** en queue de grille — drop interdit avant ou entre eux.
  - Les contenus sans date (`idea`/`draft`) vivent dans une **étagère latérale** hors grille ; les glisser dans la grille assigne une date interpolée entre les voisins, arrondie à la prochaine heure pleine dans une fenêtre 9 h–21 h (fuseau du client). **Bornes** : toute date assignée (drop, interpolation, calendrier, studio) est ≥ maintenant + 15 min ; drop en tête de grille (pas de voisin supérieur) = dernier créneau planifié + 24 h, ramené dans la fenêtre 9 h–21 h ; drop adjacent à la zone verrouillée = interpolation bornée à maintenant + 15 min minimum.
  - Deux contenus au même datetime : tie-break sur `created_at` (et l'UI empêche de créer ce cas au drop).
  - Toute permutation est **journalisée** sur les contenus concernés ; si un contenu permuté était `approved` sur une date explicitement validée, notification à l'owner (Module I) — la date ne fait pas partie des champs qui invalident une approbation (Module F).
  - Un contenu **multi-plateforme** déplacé dans la grille change sa date pour TOUTES ses cibles (la date est commune au MVP) — l'aperçu de confirmation le signale explicitement.
- Les **Stories ne vont pas dans le feed** : exclues de la grille (elles restent visibles au calendrier avec une icône dédiée).
- Posts publiés/importés : lecture seule dans la grille.

---

### Module D — Calendrier éditorial

**Description.** Vue calendrier (mois/semaine) du contenu d'un client. Sert à planifier la cadence et repérer les trous.

**User stories.**
- En tant qu'owner, je vois le mois avec tous les contenus planifiés d'un client.
- En tant qu'owner, je crée un contenu depuis une case de date.
- En tant qu'owner, je distingue plateformes (code couleur/icône) et statuts.

**Règles.**
- Par client, affiché dans le **fuseau du client**. Création depuis une case de date : heure par défaut = prochaine heure pleine dans la fenêtre 9 h–21 h.
- Cohérence totale : modifier une date ici met à jour le contenu partout (studio, grille, agenda unifié, PublishJobs — via annulation/recréation, §5.B).
- Distinct de l'agenda unifié (Module G) : ici par client et centré contenu ; là-bas transversal et centré temps.

---

### Module E — Planification & publication multi-plateforme

**Description.** Le cœur opérationnel : programmer un contenu pour qu'il parte automatiquement, ou publier en 1 clic. Chaque cible (ContentTarget) génère son PublishJob, exécuté par le **worker de publication** (§8.2).

**Capacités par plateforme (MVP — état vérifié juin 2026) :**

| Plateforme | MVP | Comportement |
|---|---|---|
| **Instagram** | Publication réelle directe/programmée : photos, carrousels (≤10), Reels, Stories | API « Instagram with Instagram Login » (graph.instagram.com, **sans Page Facebook requise**). Workflow conteneur : création → polling `status_code` (1×/min) → publication. Toute vidéo feed = Reel. |
| **Facebook** | Publication réelle directe/programmée sur Pages : texte, liens, photos, vidéos, Reels, Stories | Pages API + Video API + Reels (`/video_reels`) + Stories (`/photo_stories`, `/video_stories`). ⚠️ La programmation native Meta (`scheduled_publish_time`) n'existe que pour le feed — **toute la programmation passe par notre worker**, uniformément. |
| **TikTok** | **Brouillon vidéo** poussé dans l'inbox TikTok. Carrousels photo : **V2 par défaut** (exigeraient le Spike 2 concluant ET un custom domain Supabase) | Vidéo : `FILE_UPLOAD` chunké via le worker. ⚠️ Photos : **PULL_FROM_URL uniquement** (pas de FILE_UPLOAD photo) → vérification de propriété du domaine requise, impossible sur \*.supabase.co → custom domain Supabase (add-on payant). L'utilisateur finalise dans l'app TikTok. ⚠️ Les brouillons **vidéo** ne pré-remplissent pas la légende → bouton « copier la légende » + notification push à l'heure H. Statut cible : `pushed_to_platform`, puis « marquer comme publié » par l'owner (relance J+1). |
| **Newsletter** | Manuel | Vit dans le calendrier et le flux de validation (avec champ « objet ») ; **pas de PublishJob** : à l'heure H la cible passe `awaiting_manual` + notification « à publier manuellement » ; envoi réel via Brevo en V2. |
| **Sur mesure** | Manuel | Canal générique : planifié, validé, rappel à l'heure H (`awaiting_manual`), marqué « publié » à la main. C'est aussi le **fallback TikTok** si l'intégration brouillon bloque. |

**User stories.**
- En tant qu'owner, je programme un post Instagram à une date/heure future.
- En tant qu'owner, je publie immédiatement en 1 clic depuis mon téléphone.
- En tant qu'owner, je suis notifié de chaque échec avec le motif exact, et du succès (configurable).
- En tant qu'owner, pour TikTok je reçois une notification à l'heure planifiée : « ton brouillon est prêt, ouvre TikTok pour publier ».

**Règles de fiabilité (le contrat du produit : 0 publication manquée silencieusement, 0 double publication).**
- **File de jobs** : table `publish_jobs` dans Postgres, worker dédié (§8.2). Chaque tentative enregistre statut + réponse plateforme.
- **Idempotence (règle absolue)** : index unique sur les jobs actifs par (contenu, compte) ; un job dont l'appel de publication a démarré (`publish_started_at` posé) ne retente JAMAIS aveuglément — il vérifie d'abord l'état distant (statut du conteneur Meta). Le retry d'un contenu partiellement publié ne re-publie que les cibles en échec.
- **Retries** : backoff exponentiel + jitter, max 5 tentatives pour les erreurs transitoires ; échec direct (sans retry) pour les erreurs permanentes (token révoqué, média invalide, violation de règles) avec motif clair.
- **Fenêtre de grâce (décision actée)** : si le worker était indisponible à l'heure H, il publie au redémarrage **si le retard est < 2 h** ; au-delà : échec + notification, l'owner choisit une nouvelle date.
- **Quotas (décision actée : report automatique)** : si le quota est atteint (Instagram : 100 posts API/24 h glissantes par compte, vérifié via `content_publishing_limit` ; + 400 conteneurs/24 h ; Facebook : budget BUC + 30 Reels/24 h par Page ; TikTok : 5 brouillons en attente/24 h par créateur, 6 req/min/token), le job est **reporté automatiquement** + notification du décalage. Définition du report : **IG/FB** = première heure où le quota se libère (calculable via `content_publishing_limit` / compteur local), la notification annonce la nouvelle heure ; **TikTok** = statut « en attente de quota », re-tentative horaire, la notification explique qu'il faut finaliser des brouillons existants dans l'app (aucune heure promise). Rate limiting **par compte social**, pas global.
- **Tokens** : santé surveillée en continu (§7.4) — un token expiré/révoqué est détecté **avant** l'heure H quand c'est possible (health check quotidien) et déclenche « reconnecte le compte X », jamais découvert à l'heure de publication.
- Traitement vidéo asynchrone Meta : le job passe en attente (`awaiting_media`) sans bloquer le worker ; budget de polling 10 min avant échec.

**Contenu minimum & formats par canal (gardes-fous UI, vérifiés avant toute programmation) :**

| Canal | Contenu minimum | Formats autorisés |
|---|---|---|
| Instagram | ≥ 1 média | post, carrousel, Reel, story |
| Facebook | légende seule acceptée (texte/lien) | post (texte, lien, photo, vidéo), Reel, story |
| TikTok | vidéo obligatoire | Reel/vidéo (carrousel photo : V2) |
| Newsletter | objet + légende | texte long (pas de story/carrousel) |
| Sur mesure | libre | tous |

---

### Module F — Workflow de validation client (portail client)

**Description.** L'espace où le client relit, commente, annote et approuve. Remplace les allers-retours par mail. **La validation est optionnelle par contenu** (décision actée) : l'owner choisit, contenu par contenu, de passer par la revue ou de programmer directement.

**Objets du module :**
- **ReviewRequest (demande de revue)** : matérialise l'envoi d'un **lot** de contenus en revue — objet de **niveau client**, lié aux contenus par une table de jointure (§6) — destinataire(s) reviewer(s), date d'envoi, message optionnel. État du lot **dérivé** des décisions : en attente (aucune décision) / partiellement traité / traité (chaque contenu du lot a une décision). L'email d'invitation référence la demande ; le portail reste accessible en permanence au reviewer (la ReviewRequest structure le suivi et les relances, pas l'accès).
- **Approval (approbation)** : **insert-only** (immuable) — décision (`approved` / `changes_requested`), reviewer, horodatage, message, et **version du contenu approuvée** (snapshot/hash de légende + hashtags + médias et leur ordre + format ; la date y figure à titre informatif, sans être un critère d'invalidation). Piste d'audit inviolable, prépare la « preuve d'approbation » du backlog.
- **Comment / Annotation** : commentaire texte sur le contenu, ou **annotation positionnelle = pin (x, y) sur une image, par slide de carrousel** + commentaire attaché. **Pas d'annotation vidéo au MVP** (commentaire simple sur le contenu). Commentaires immuables côté reviewer (pas d'édition/suppression).

**User stories.**
- En tant qu'owner, j'envoie un lot de contenus en revue à un client.
- En tant que reviewer, je vois les publications prévues (visuel + légende + date, dans mon fuseau) dans une interface simple, sans mot de passe.
- En tant que reviewer, je commente ou pose un pin sur le visuel pour indiquer une correction.
- En tant que reviewer, j'approuve ou demande des modifications en un clic.
- En tant qu'owner, je vois en temps réel (Supabase Realtime) les statuts approuvé / en attente / à corriger.

**Règles.**
- **Accès reviewer (décision actée)** : compte Supabase Auth créé par invitation (`inviteUserByEmail` côté serveur) ; connexions suivantes par magic link **ou code OTP à 6 chiffres** (même email — l'OTP pare les scanners de liens des messageries d'entreprise et le piège PWA iOS). `shouldCreateUser: false` sur le flux de connexion (pas de comptes orphelins). Jamais de lien public signé non authentifié.
- Périmètre de visibilité du reviewer : contenus de SON client uniquement, aux statuts `in_review`, `changes_requested`, `approved`, `scheduled`, `publishing`, `published`, `partially_published`, `failed` — les états techniques (`publishing`, `failed`, `partially_published`) sont présentés au reviewer sous un libellé neutre (« programmé » / « publié ») : le **masquage des échecs techniques au client est délibéré**, c'est au freelance de gérer l'incident. Jamais `idea`/`draft` ni les notes internes.
- **Révocation** : retirer un reviewer est effectif immédiatement (lookup RLS en base, pas de claim JWT — §8.1).
- **Plusieurs reviewers (règle unique)** : le contenu passe `changes_requested` dès qu'une demande de modification arrive (elle prévaut) ; il ne repasse `approved` que lorsque la **dernière décision de chaque reviewer sollicité** par la demande de revue est positive — un reviewer qui a demandé des modifications doit donc re-approuver (transition `changes_requested → approved`, §5.B). L'owner voit l'historique complet.
- **Modification après approbation** — champs **invalidants** : légende, hashtags, médias (et leur ordre), format, ajout/retrait de cible → approbation invalidée (marquée périmée), retour `draft` (§5.B). Champs **non invalidants** : notes internes, **date** (changement de date → notification à l'owner seulement, cf. Module C).
- Historique complet conservé sur chaque contenu.

---

### Module G — Agenda unifié

**Description.** Agrège tous les agendas connectés du freelance (Google, Outlook, multi-comptes) **en lecture**, superposés au planning éditorial de tous les clients. Une seule timeline pour « mon temps ».

**User stories.**
- En tant qu'owner, je connecte mes comptes Google et Microsoft (plusieurs par fournisseur).
- En tant qu'owner, je vois rendez-vous + publications planifiées (tous clients) dans une vue unique, dans MON fuseau.
- En tant qu'owner, je filtre par source (compte agenda, calendrier, client) et j'active/désactive chaque calendrier (évite le bruit « Jours fériés », anniversaires…).

**Règles (MVP).**
- **OAuth custom** (Route Handlers serveur), PAS les providers Supabase Auth — un compte Google d'agenda ne doit jamais devenir une identité de connexion ; multi-comptes par fournisseur requis. Même abstraction `IntegrationOAuthProvider` que Meta/TikTok (§8.4).
- Scopes minimaux : Google `calendar.events.readonly` + `calendar.calendarlist.readonly` ; Microsoft `Calendars.Read` + `offline_access`. Scopes accordés stockés par compte (montée de privilèges incrémentale en V2).
- Tokens chiffrés dans **Supabase Vault** (décision actée), accès serveur uniquement.
- **Synchronisation** : cache local (`calendar_events`) par **refetch fenêtré** [-30 j, +180 j], toutes les 15 min via le **scheduler interne du worker Node** (`apps/worker` — ce choix remplace le pont pg_cron → pgmq → Route Handler décrit dans l'analyse §3.5, par cohérence avec §8.2 : pas de déclencheur fire-and-forget pour une tâche récurrente) + sync-on-open débouncée (2 min). Récurrences déléguées aux providers (`singleEvents=true` / `calendarView`). Sweep des événements supprimés à chaque run. Événements « journée entière » stockés en date (jamais convertis en UTC). Purge des événements au-delà de la fenêtre (minimisation RGPD). Évolution V2 : syncToken/delta + webhooks derrière l'abstraction `syncWindow()`.
- **Vue unifiée** : vue Postgres `unified_agenda` (security_invoker) = UNION des événements (calendriers activés) et des ContentItems planifiés. Pas de duplication de données.
- Déconnexion propre : révocation provider (Google `/revoke`), suppression des secrets Vault, cascade.
- **Écriture deux sens : V2** (décision actée).

---

### Module H — Authentification, rôles & socle SaaS

**Description.** Le socle multi-locataire, activé dès le MVP.

**User stories (MVP).**
- En tant qu'utilisateur, je crée un compte et me connecte via un portail sécurisé (magic link sur desktop, **code OTP 6 chiffres sur mobile** — décision actée, cf. piège PWA iOS §8.5).
- En tant qu'owner, j'invite un reviewer dans un espace client en accès limité.

**User stories (V2).**
- En tant qu'owner, je souscris un abonnement Stripe.

**Règles.**
- Multi-locataire : un compte freelance = une `organization` (tenant). Isolation par RLS sur 100 % des tables + `org_id` dénormalisé + FK composites (§8.1).
- Rôles : `owner`/`admin` (org) et `reviewer`/`editor` (client) via tables d'appartenance. MVP active `owner` et `reviewer`.
- Auth Supabase (magic link + OTP). Pas de mot de passe au MVP. SSO Google : V2 (un OAuth client GCP distinct de celui des agendas).
- Facturation : hors MVP, architecture prête (organization = entité de facturation).

---

### Module I — Notifications *(nouveau en v0.2)*

**Description.** Système transversal. Trois canaux : **in-app** (table `notifications` + Supabase Realtime, badge/centre de notifications), **Web Push** (PWA — format double : Declarative Web Push iOS + service worker Android), **email Brevo** (transactionnel — canal garanti, indépendant de l'installation PWA).

**Matrice événement × canal × destinataire (MVP) :**

| Événement | In-app | Push | Email | Destinataire |
|---|---|---|---|---|
| Échec de publication (avec motif) | ✅ | ✅ | ✅ | Owner |
| Succès de publication | ✅ | ✅ (configurable) | — | Owner |
| Report (quota) / retard > 2 h | ✅ | ✅ | ✅ | Owner |
| Brouillon TikTok poussé (« à finaliser ») | ✅ | ✅ | — | Owner |
| Contenu `in_review` : date J-1 / périmé | ✅ | ✅ | — | Owner |
| Approbation / demande de modification reçue | ✅ | ✅ | — | Owner |
| Nouveau commentaire reviewer | ✅ | ✅ | — | Owner |
| Invitation / demande de revue | — | — | ✅ | Reviewer |
| Approbation tardive → « à reprogrammer » | ✅ | ✅ | — | Owner |
| Échéance d'un canal manuel (« à publier manuellement ») | ✅ | ✅ | — | Owner |
| Relance brouillon TikTok non marqué publié (J+1) | ✅ | ✅ | — | Owner |
| Permutation de date d'un contenu approuvé | ✅ | ✅ | — | Owner |
| Préavis de purge d'un média jamais publié (180 j) | ✅ | — | ✅ | Owner |
| Token expiré / compte à reconnecter | ✅ | — | ✅ | Owner |
| Worker en panne (watchdog indépendant) | — | — | ✅ | Ops (Etienne) |

**Règles.**
- Toute notification a un lien profond vers l'objet concerné.
- Les emails reviewer (invitations, demandes de revue) partent via Brevo **dès le Lot 3** (correction v0.1 : ce n'est pas de la V2).
- Push : table `push_subscriptions` (RLS user), envoi VAPID côté worker ; nettoyage des subscriptions mortes (410 Gone).
- Préférences : au MVP, un seul toggle (« me notifier des succès de publication ») ; préférences fines en V2.

---

### Module J — Médias *(nouveau en v0.2 — référencé mais jamais défini en v0.1)*

**Description.** Gestion du cycle de vie des médias : upload, validation, conversion, miniatures, stockage, purge. Deux besoins distincts : **miniatures légères persistantes** (grille, historique) et **originaux temporaires** (publication via URL publique à l'instant T).

**Specs par plateforme (validées à l'upload — l'échec se découvre à l'upload, jamais à l'heure H) :**

| Plateforme / format | Contraintes (juin 2026) |
|---|---|
| Instagram image | **JPEG uniquement** (conversion automatique PNG/HEIC → JPEG côté client), ≤ 8 MB, ratio 4:5 à 1.91:1, largeur 320–1440 px |
| Instagram Reel (= toute vidéo feed) | MP4/MOV H.264/HEVC, **moov atom en tête (faststart)**, 3 s–15 min, ≤ 300 MB, 9:16 recommandé |
| Instagram Story | Image ou vidéo, ≤ 100 MB / 60 s |
| Instagram carrousel | ≤ 10 médias ordonnés, mix image/vidéo |
| Facebook Reel | 9:16, min 540×960 (1080×1920 recommandé), 3–90 s, 24–60 fps (60 s max si diffusé aussi en story) |
| Facebook Story | Photo ≤ 4 MB ; vidéo 9:16 (durée max à confirmer sur la doc Page Stories au Lot 2 — la règle « Reel diffusé en story = 60 s max » suggère 60 s) |
| Facebook photo (feed) | JPEG/PNG ≤ 4 MB (spec exacte à relever sur la doc Pages au Lot 2) |
| Facebook vidéo (feed) | MP4 via Video API (`file_url`) — specs exactes à relever au Lot 2 |
| TikTok vidéo | MP4/MOV/WebM, ≤ 4 GB ; **durée max propre au créateur** (à lire via `creator_info` — comportement en mode brouillon à confirmer) ; transport : upload chunké par le worker (chunks 5–64 MB) |
| TikTok carrousel photo | ≤ 35 images — **V2 par défaut** : exige PULL_FROM_URL (vérification de domaine → custom domain Supabase payant) + Spike 2 concluant (§7.5) |

**Règles.**
- **Validation à l'upload** : type, poids, ratio, durée — par plateforme ciblée. Message d'erreur clair + proposition (conversion auto, recadrage manuel) AVANT la programmation.
- **Miniatures générées côté client à l'upload** (canvas/createImageBitmap → WebP ~400 px ; frame à ~0,5 s pour les vidéos). Persistées indéfiniment dans le bucket public `media-thumbs` (décision actée) — elles survivent à la purge de l'original et constituent l'historique léger de la grille.
- **Originaux** dans le bucket **privé** `media-originals` (limite 300 MB). Exposition uniquement par **URL signée TTL 48 h** générée par le worker au moment de la publication (Meta exige une URL publiquement accessible « at the time of the attempt » — une URL signée satisfait ce contrat ; jamais de bucket public pour du contenu client non publié). URL signée régénérée à chaque tentative de retry.
- **Upload mobile résilient** : protocole TUS (chunks de 6 MB exactement), reprise après coupure réseau, Wake Lock pendant l'upload. iOS : l'upload ne progresse qu'app au premier plan (l'UI ne promet jamais le contraire).
- **Rétention (décision actée)** : original purgé **J+7 après publication**, et SEULEMENT si **aucune cible du contenu n'est `failed`** et que toutes sont en état terminal « succès ou abandon » (`published` / `pushed_to_platform` / `skipped` / `canceled`) — un échec en attente de retry **bloque la purge**. Si l'original a malgré tout disparu, tout retry/duplication qui le réclame est bloqué avec le message « re-uploader le média ». Contenus jamais publiés : purge à 180 jours d'inactivité avec préavis (Module I). Purge via job quotidien (pg_cron → Edge Function → API Storage), idempotente et journalisée. `MediaAsset` garde les métadonnées (dimensions, durée, poids, `original_deleted_at`) pour toujours.

---

## 6. Modèle de données (entités principales)

```
organizations (tenant = compte freelance)
 ├─ profiles (1:1 auth.users — sans rôle ni org_id)
 ├─ organization_members (org_id, user_id, role: owner|admin)
 ├─ platform_connections (connexion OAuth racine du freelance : Meta, TikTok)
 │     ├─ platform_connection_secrets (tokens racine chiffrés — RLS deny-all, serveur uniquement)
 │     └─ une révocation est représentable et notifiable (elle casse N social_accounts)
 ├─ clients (espace client — name, logo, brand_color, timezone, archived_at)
 │   ├─ client_members (client_id, user_id, role: reviewer|editor)
 │   ├─ social_accounts (IG/FB/TikTok — métadonnées, status, needs_reauth)
 │   │     └─ social_account_secrets (tokens chiffrés — RLS deny-all, serveur uniquement)
 │   ├─ imported_posts (feed IG existant : external_id, permalink, thumb, timestamp, media_type)
 │   ├─ review_requests (lot envoyé en revue — niveau client : reviewers, message, état dérivé)
 │   │     └─ review_request_items (jointure → content_items)
 │   └─ content_items (status global, caption, hashtags, format, scheduled_at UTC,
 │       │             newsletter_subject, internal_notes, archived_at)
 │       ├─ content_targets (× plateforme/compte : status par cible, external_post_id,
 │       │                   permalink, published_at, deleted_externally, caption_override V2)
 │       ├─ media_assets (storage_path, thumb_path, position, type, dimensions, durée,
 │       │                poids, expires_at, original_deleted_at)
 │       ├─ comments (body, annotation jsonb {media_asset_id, x, y} — pin par slide)
 │       ├─ approvals (INSERT-ONLY : decision, reviewer, snapshot de version, horodatage)
 │       └─ publish_jobs (1 par cible : run_at, status, step, attempts, lease,
 │                        ig_container_id, publish_started_at, external_post_id,
 │                        last_error, error_history — manipulé par le worker)
 ├─ notifications (événement, destinataire, canal, lu/non-lu, deep link)
 ├─ push_subscriptions (endpoint, clés — RLS user)
 └─ calendar_accounts (par user : provider, provider_account_id (sub/oid — jamais l'email),
     │                 scopes accordés, status, secrets via Supabase Vault)
     ├─ calendar_calendars (provider_calendar_id, name, color, is_enabled)
     └─ calendar_events (external_id, starts_at/ends_at UTC ou date si all_day,
                          series_master_id, last_sync_run_id)
```

**Statuts** — ContentItem : `idea | draft | in_review | changes_requested | approved | scheduled | publishing | published | partially_published | failed | canceled` · ContentTarget : `pending | queued | publishing | awaiting_manual | published | pushed_to_platform | failed | skipped | canceled` · PublishJob : `scheduled | claimed | awaiting_media | retrying | succeeded | failed | dead_letter | canceled`.

**Invariants structurels (détail §8.1) :**
- `org_id` dénormalisé NOT NULL sur toutes les tables métier ; `client_id` sur toutes les filles de Client ; **FK composites** (`UNIQUE(id, org_id)` / `UNIQUE(id, client_id)`) : une ligne ne peut physiquement pas être rattachée au mauvais tenant/client.
- Les tokens vivent dans des tables/secret stores séparés (`*_secrets`, Vault) **sans aucune policy de lecture client** — ils ne transitent jamais vers le navigateur.
- `approvals` est insert-only (aucune policy UPDATE/DELETE).
- `publish_jobs` : index unique partiel anti-doublon sur les jobs actifs par (content_item, social_account).
- Soft-delete (`archived_at`) sur clients et content_items.

---

## 7. Contraintes techniques & intégrations *(réécrit en v0.2 — état vérifié le 11/06/2026 sur les docs officielles ; re-vérifier à chaque dev d'intégration, versionnage trimestriel)*

### 7.1 Tableau récapitulatif

| Plateforme | API retenue | Phase solo (MVP) | Quotas clés | Jalon pour ouvrir le SaaS (V2) |
|---|---|---|---|---|
| **Instagram** | « Instagram API with Instagram Login » (graph.instagram.com, scopes `instagram_business_*`, **sans Page Facebook**) — Graph API v25.0 | **Standard Access** : publication réelle sans App Review sur les comptes ajoutés comme testeurs (~50 ; 500 si Business Manager vérifié ; le compte doit être public et son titulaire accepter l'invitation) | 100 posts API/24 h/compte (carrousel = 1) ; 400 conteneurs/24 h ; suivi via `content_publishing_limit` | App Review Meta (Advanced Access) : justification par permission, screencasts, Business Verification, Data Use Checkup annuel |
| **Facebook** | Pages API + Video API + Reels + Page Stories — via « Facebook Login for Business » | **Standard Access** : publication réelle et publique sur les Pages où l'utilisateur à rôle sur l'app a la tâche CREATE_CONTENT. ⚠️ Créer l'app via **use case Business** (pas de modes dev/live) — une app Consumer en mode dev publie des posts invisibles | BUC : 4800 appels × engaged users/24 h/Page (⚠️ petites Pages = budget réduit, header `X-Business-Use-Case-Usage`) ; 30 Reels API/24 h/Page ; tokens de Page sans expiration | Idem Meta ci-dessus |
| **TikTok** | Content Posting API, mode **upload/brouillon** (`video.upload`) | ⚠️ **Pas de mode dev utilisable en prod** : le Sandbox (10 comptes) ne fait pas de posts publics → **revue d'app TikTok standard à soumettre dès le DÉBUT du Lot 2** (privacy policy, démo ; jours à semaines). Le mode brouillon échappe à l'audit Content Posting et aux restrictions SELF_ONLY (vidéo confirmé ; carrousels photo : V2 par défaut — PULL_FROM_URL exige un custom domain + Spike 2) | 5 brouillons en attente/24 h/créateur ; 6 req/min/token ; (Direct Post : ~15 posts/24 h — V2) | Audit Content Posting (Direct Post public) : mockups PDF, screencast d'une app finie, conformité UX stricte ; 2–4 semaines |
| **Google Calendar** | Calendar API, scopes granulaires `calendar.events.readonly` + `calendar.calendarlist.readonly` | ⚠️ Mode test = refresh tokens expirés tous les **7 jours** → lancer la **vérification « scope sensible »** (gratuite, ~10 j, sans CASA) dès le Lot 4 | 600 req/min/user (dépassements facturables courant 2026) | Vérification déjà faite si lancée au Lot 4 |
| **Microsoft Graph** | `Calendars.Read` délégué, app multi-tenant + comptes perso | Zéro friction : app dans son propre tenant + self-admin-consent + comptes Outlook.com perso | Subscriptions < 7 j renouvelables (V2) | ⚠️ « Secure by Default » (2025) : les tenants M365 bloquent le consentement utilisateur sur Calendars.* → flux **admin consent** + **publisher verification** (gratuite, compte Partner) |
| **Newsletter** | — (manuel MVP) | — | — | API Brevo `POST /v3/emailCampaigns` (décision actée : Brevo, ferme) |

### 7.2 Insight stratégique corrigé

L'avantage « test solo sans validation » de la v0.1 est **confirmé pour Meta, partiel pour TikTok, inversé pour Google** :
- **Meta** : le terme « mode développeur » était impropre. Le mécanisme réel est le **Standard Access des apps Business** (pas de modes dev/live) : permissions auto-accordées, utilisables par toute personne ayant un rôle sur l'app, publication réelle. L'App Review n'est nécessaire que pour des utilisateurs externes sans rôle (= ouverture SaaS). Préparer dès maintenant la liaison à un Business Manager vérifié (50 → 500 testeurs, fluidifie la future review).
- **TikTok** : la phase solo est déjà de la production → revue d'app standard obligatoire (Lot 2), distincte de l'audit Content Posting (V2). Le brouillon reste le bon chemin MVP.
- **Google** : contrairement à Meta, attendre coûte (reconnexion hebdo) — la vérification est légère, la passer tôt.
- **Onboarding d'un compte client** (flux à implémenter, Lot 2) : Instagram → ajouter le compte IG du client comme testeur dans l'App Dashboard, le titulaire accepte, puis OAuth Instagram Login ; Facebook → le client attribue au freelance un rôle avec CREATE_CONTENT sur sa Page via Meta Business Suite, puis OAuth Facebook Login for Business et sélection de la Page ; TikTok → OAuth sur le compte du client (post-revue d'app).

### 7.3 Gestion des médias
→ Spécifiée au **Module J** (§5.J) et dans l'architecture (§8.3). Décision actée : Supabase Storage (pas de R2/B2), bucket privé + URL signées 48 h, miniatures publiques persistantes, purge J+7.

### 7.4 Tokens & robustesse
- **Instagram (IG Login)** : long-lived token 60 jours, refresh via `/refresh_access_token` (token ≥ 24 h d'âge, non expiré) — **non rafraîchi en 60 j = définitivement perdu** → job de refresh quotidien (rafraîchit ce qui expire sous 10 j).
- **Facebook** : tokens de Page long-lived sans expiration ; le user token racine (60 j) est porté par `platform_connections`.
- **TikTok** : access token 24 h / refresh token 365 j, **rotation du refresh token à chaque échange** → persistance atomique sous verrou (advisory lock par compte).
- **Google/Microsoft** : refresh à la volée dans le worker de sync, sous verrou (Microsoft rote aussi son refresh token). Google : max 100 refresh tokens par compte/client_id (le plus ancien révoqué silencieusement) — un seul RT par compte, réutilisé.
- **Health check quotidien** de tous les tokens → `needs_reauth` + notification AVANT l'échec de publication.
- Échecs : journalisation complète (sans jamais logger un token — scrubbing Sentry), retries, notifications systématiques avec motif.

### 7.5 Spikes de validation (avant ou en tout début de Lot 2)
1. **Visibilité Meta** : publier 1 post test IG + 1 post FB via Standard Access et vérifier leur visibilité publique depuis un compte tiers sans rôle (confiance moyenne sur ce point précis — aucun engagement officiel explicite).
2. **Brouillon photo TikTok** *(uniquement si les carrousels photo sont remis au périmètre MVP)* : tester 1 brouillon carrousel photo (`MEDIA_UPLOAD`) sur compte client public avec app non auditée — l'erreur 403 `unaudited_client_can_only_post_to_private_accounts` est documentée sur cet endpoint sans exemption explicite du mode brouillon. **Prérequis du test** : héberger les images sur un domaine dont la propriété est vérifiée dans le portail développeur TikTok (les photos passent par PULL_FROM_URL — sans domaine vérifié, le test échoue sur l'ownership d'URL, pas sur la question visée). Le spike ne lève que la question d'audit ; le **custom domain Supabase reste un prérequis de production**. Par défaut : carrousels photo TikTok = V2, vidéo seule au MVP.

---

## 8. Architecture & stack *(arrêtée — stack canonique Propul'SEO, détail complet dans [ANALYSE-LANCEMENT.md](ANALYSE-LANCEMENT.md) §3)*

**Monorepo pnpm** : `apps/web` (Next.js 16 App Router, TypeScript strict, Tailwind v4 + shadcn/ui, React Hook Form + Zod, TanStack Query v5 + Table v8, nuqs, next-intl, lucide-react, Biome) · `apps/worker` (worker Node de publication + sync agendas) · `packages/` (types partagés, adapters plateformes derrière une abstraction par intégration). Hébergement **Coolify VPS** (2 apps), CI GitHub Actions, Sentry, PostHog, Brevo.

### 8.1 Multi-tenant & sécurité (Supabase)
- **RLS sur 100 % des tables dès leur création.** `org_id`/`client_id` dénormalisés + **FK composites** anti-fuite. Policies sans jointure via helpers `SECURITY DEFINER` (schéma `private` non exposé) lisant les tables d'appartenance indexées — révocation d'un reviewer **instantanée** (pas de claims JWT d'autorisation au MVP).
- Tables `*_secrets` en **deny-all** (RLS activée, zéro policy) ; tokens agendas dans **Supabase Vault**. Service role uniquement côté serveur (interdit dur côté client).
- Vues en `security_invoker = true`. Test d'isolation multi-tenant (pgTAP) en CI + `get_advisors` après chaque migration.

### 8.2 Worker de publication (composant critique)
- **Worker Node dédié sur Coolify + Postgres comme file** (`SELECT … FOR UPDATE SKIP LOCKED`) — pas de Redis/BullMQ (seconde source de vérité = risque de double publication), pas d'Edge Functions pour publier (limites runtime vs polling vidéo 5–10 min). Connexion **Supavisor mode session (port 5432)**.
- Tick 5 s, claim atomique + lease 2 min + reaper, appels HTTP hors transaction, horloge = `now()` Postgres (UTC).
- Cycle PublishJob : `scheduled → claimed → (awaiting_media ⇄ claimed)* → succeeded | retrying | failed | dead_letter | canceled` ; étapes `refresh_token → check_quota → create_container → publish → verify`.
- **Watchdog indépendant** : pg_cron (5 min) détecte les jobs en retard non claimés → Edge Function → email Brevo. Sentry Cron Monitors sur le tick.

### 8.3 Stockage médias
- **100 % Supabase Storage.** Buckets : `media-originals` (privé, 300 MB) / `media-thumbs` (public, 1 MB). Chemins `{org_id}/{client_id}/{content_item_id}/{asset_id}/…` = support direct des policies RLS Storage.
- Upload TUS (chunks 6 MB), miniatures côté client, URL signées 48 h à la publication, purge quotidienne par Edge Function (API Storage, jamais de DELETE SQL sur storage.objects).
- ⚠️ **Plan Supabase** : Free pour les Lots 0–1 (décision actée) ; **passage en Pro (25 $/mois) OBLIGATOIRE avant le premier test de Reel au Lot 2** (le Free plafonne à 50 MB/fichier) — item de checklist bloquant.

### 8.4 Intégrations OAuth
- **Toutes custom** (Route Handlers serveur, state HMAC + PKCE) derrière une abstraction commune — Meta (2 flux : Instagram Login + Facebook Login for Business), TikTok, Google, Microsoft. Jamais via les providers Supabase Auth (un compte connecté ne doit pas devenir une identité de connexion).
- Comptes identifiés par ID stable (`sub`, `oid+tid`), jamais l'email.

### 8.5 PWA (priorité iOS — décision actée : l'utilisateur solo est sur iPhone)
- Service worker **Serwist via `@serwist/turbopack`** (Next 16 = Turbopack par défaut). Manifest + icônes maskable + onboarding d'installation iOS soigné dès le Lot 0 (le push iOS exige l'installation écran d'accueil — inchangé iOS 26).
- **Auth mobile = OTP 6 chiffres** (le magic link ouvert depuis Mail crée la session dans Safari, pas dans la PWA installée).
- Web Push **double format** : Declarative Web Push (iOS 18.4+) + handler service worker (Android). Triple canal avec Realtime in-app et email Brevo (Module I).
- Partage depuis la galerie : Web Share Target = Android uniquement → **fallback iOS : FAB « Nouveau contenu » → picker Photos natif** (~1 tap de plus). Share-sheet iOS natif = V2.
- Offline minimal : lecture (calendrier, dashboard, liste + miniatures) + file d'upload. Jamais de publication offline. Le SW ne met jamais en cache auth/POST (allowlist explicite).

---

## 9. Parcours utilisateurs clés

**Parcours 1 — Préparer et programmer un post Instagram**
Sélection du client → création du contenu (visuel validé/converti à l'upload + légende + hashtags + format) → positionnement dans la grille → choix date/heure (fuseau du client) → *(optionnel)* envoi en revue → approbation → programmation (PublishJob par cible) → publication automatique à l'heure H → notification de succès → original purgé à J+7, miniature conservée dans la grille.

**Parcours 2 — Validation côté client**
Invitation par email (Brevo) → clic sur le lien (ou code OTP) → portail client (son espace uniquement) → revue des posts (visuel, légende, date dans son fuseau) → pin/commentaire ou approbation en 1 clic → l'owner voit le statut en temps réel (Realtime) → si approbation tardive (date passée) : tâche « à reprogrammer » côté owner, jamais de publication auto.

**Parcours 3 — Vue de ma journée**
Dashboard global → tâches du jour (à publier, échecs, revues en attente, brouillons TikTok à finaliser, comptes à reconnecter) + agenda unifié (rendez-vous Google/Outlook + publications tous clients, dans mon fuseau).

**Parcours 4 — Publier depuis le téléphone (PWA installée)**
Photo prise → ouverture de la PWA (FAB « Nouveau contenu » → picker Photos) → upload TUS avec reprise → publication 1-clic ou programmation → notification push au succès/échec.

---

## 10. Exigences non-fonctionnelles

- **RGPD** : hébergement UE (Supabase région EU + VPS Coolify UE), consentement, droit à l'effacement (flux de suppression définitive d'un client, §5.A), registre des traitements, minimisation (purge médias J+7, purge événements agenda hors fenêtre). Politique de confidentialité + mécanisme de suppression de données : requis par les app reviews Meta/TikTok (TikTok dès le Lot 2 — privacy policy URL exigée à la revue d'app).
- **Sécurité** : chiffrement des tokens (tables deny-all + Vault), isolation multi-tenant ET intra-tenant (reviewer ↔ autres clients), cookies httpOnly, service role jamais côté client, webhooks signés, scrubbing des secrets dans les logs/Sentry, audit trail des approbations (insert-only).
- **Conformité plateformes** : ToS Meta/TikTok ; guidelines UX TikTok même en mode brouillon (consentement explicite avant upload, affichage du compte cible, information « finalise via la notification inbox », pas de watermark tiers).
- **Fiabilité** : 0 échec silencieux (matrice de notifications + watchdog indépendant du worker), 0 double publication (idempotence §5.E), file monitorée (Sentry), fenêtre de grâce 2 h.
- **Performance** : grille et calendrier fluides (miniatures WebP, TanStack Query), publication mobile rapide, budgets perf Propul'SEO (Lighthouse CI).

---

## 11. Roadmap — lots de développement

**Lot 0 — Socle**
Monorepo pnpm + CI + Biome + Sentry/PostHog. Migrations fondatrices : organizations, profiles, memberships, clients (+ timezone, archived_at), **content_items + content_targets**, notifications, push_subscriptions — RLS + FK composites + helpers `private` + tests d'isolation pgTAP. Auth (magic link desktop + **OTP mobile**), mécanique d'invitation reviewer (`inviteUserByEmail` via SMTP Brevo — les emails de demande de revue arrivent au Lot 3). Navigation, sélecteur de client, dashboard (coquille). PWA : manifest, Serwist, onboarding d'installation iOS. ⚙️ Externes : repo GitHub, projet Supabase (Free), **app Meta créée via use case Business** (Pages : « Manage everything on your Page » — pas de modes dev/live, cf. §7.1), app TikTok créée (soumission au Lot 2), Brevo (SMTP custom Supabase).

**Lot 1 — Contenu & visuel**
Studio (anatomie, machine à états complète, validation optionnelle), Module J (validation/conversion à l'upload, miniatures client, TUS), grille de feed (drag & drop = permutation de dates, zone verrouillée, étagère, **import du feed IG : entité + rendu sur données de seed** — l'import réel arrive au Lot 2 avec l'OAuth), calendrier éditorial (fuseau client).

**Lot 2 — Publication**
🚩 **Jour 1 : Spike 1 (visibilité Meta) + soumission de la revue d'app TikTok + Spike 2 (brouillon photo TikTok)** — les délais courent en parallèle du dev. ⚠️ **Passage Supabase Pro avant le premier test de Reel.**
Worker (SKIP LOCKED, lease, retries, idempotence, fenêtre de grâce 2 h, report quota, watchdog pg_cron), URL signées + purge J+7, intégration Instagram (IG Login) + **import réel du feed IG + sync quotidienne**, Facebook (Pages/Reels/Stories), TikTok brouillon vidéo (FILE_UPLOAD + push à l'heure H + « copier la légende » + marquage publié / relance J+1), canaux manuels (`awaiting_manual` + rappels), onboarding de connexion des comptes (§7.2), health check tokens, Module I complet pour les événements de publication (in-app + push + email).

**Lot 3 — Validation client**
Portail reviewer (accès cloisonné, invitation Brevo), ReviewRequests (lots), commentaires + annotations pin (x,y) par slide, approbations versionnées insert-only, règle multi-reviewers, Realtime des statuts, flux approbation tardive.

**Lot 4 — Agenda unifié**
🚩 **Jour 1 : lancer la vérification Google « scope sensible »** (sinon reconnexion hebdo).
OAuth custom Google + Microsoft (multi-comptes, Vault), sync fenêtrée (cron 15 min + sweep), toggle par calendrier, vue unifiée (`unified_agenda`), purge hors fenêtre.

**→ Fin MVP (test solo).**

**V2 (ouverture SaaS)**
App Review Meta (Advanced Access + Business Verification) ; audit TikTok Content Posting (Direct Post public) ; **carrousels photo TikTok (custom domain Supabase + Spike 2)** ; vérification Google déjà faite ; **admin consent + publisher verification Microsoft** ; statistiques (⚠️ nouvelles métriques post-dépréciation v26.0) ; newsletter Brevo (`emailCampaigns`) ; facturation Stripe ; variantes de légende par plateforme ; écriture agenda deux sens ; relances/validation par lot ; SSO Google ; apps natives si les métriques PostHog le justifient (partage galerie iOS).

---

## 12. Risques & hypothèses

| Risque / hypothèse | Impact | Mitigation |
|---|---|---|
| Règles des API sociales changent (versionnage trimestriel) | Une intégration casse | Re-vérifier avant chaque dev ; abstraction par intégration ; changelogs Meta/TikTok suivis |
| Visibilité publique des posts Meta en Standard Access non garantie par écrit | Stratégie MVP Meta | **Spike 1 en tout premier au Lot 2** ; fallback : Business Manager vérifié + escalade support |
| Revue d'app TikTok refusée ou lente | Pas de TikTok brouillon au MVP | Soumission dès le début du Lot 2 (délai en parallèle) ; fallback = canal manuel (déjà spécifié) |
| Carrousels photo TikTok (PULL_FROM_URL : domaine vérifié requis + restriction apps non auditées) | Pas de carrousels photo TikTok au MVP | V2 par défaut : custom domain Supabase + Spike 2 ; vidéo seule au MVP |
| Publication programmée échoue silencieusement | Perte de confiance | Worker monitoré + watchdog pg_cron indépendant + matrice de notifications |
| Double publication | Pire qu'un échec | Idempotence structurelle (§5.E) : index unique, publish_started_at, vérification d'état distant avant tout retry |
| Token expiré découvert à l'heure H | Publication manquée | Health check quotidien + refresh proactif + needs_reauth notifié en avance |
| Refresh tokens Google expirés (7 j en mode test) | Agendas à reconnecter chaque semaine | Vérification Google lancée au Lot 4 (gratuite, ~10 j) |
| « Secure by Default » Microsoft (tenants pro) | Connexion agenda bloquée chez les clients M365 en phase SaaS | Flux admin consent + publisher verification — jalon V2 |
| App Review Meta / audits refusés à l'ouverture SaaS | Bloque la phase commerciale | Standard Access couvre la phase solo ; privacy policy, data deletion et démos préparées tôt |
| Tension stockage médias vs coût | Surcoût | Supabase Storage + purge J+7 ; seuil de réexamen documenté (egress > 250 GB/mois) |
| Risque marque « Ocean » (Mediaocean, SEO) | Rebranding tardif coûteux | Décision assumée ; vérification INPI/EUIPO + domaine AVANT tout lancement commercial |
| Complexité multi-plateforme sous-estimée | Dérapage planning | MVP volontairement limité ; TikTok = brouillon ; newsletter/sur-mesure = manuels |
| Accès client trop lourd | Faible adoption de la validation | Compte invité = UX d'un lien magique (zéro mot de passe) + OTP |

---

## 13. Décisions actées (11/06/2026)

| # | Sujet | Décision |
|---|---|---|
| 1 | Nom | **Ocean** (vérif INPI/EUIPO + domaine avant lancement commercial) |
| 2 | Stockage médias | **Supabase Storage** (pas R2/B2) : bucket privé + URL signées 48 h + purge J+7 + miniatures persistantes |
| 3 | Accès client | **Compte Supabase Auth invité** (magic link / OTP) — pas de lien public anonyme |
| 4 | Drag & drop grille | **Permutation des dates** (pas de champ d'ordre indépendant) |
| 5 | TikTok MVP | **Mode brouillon vidéo** (carrousels photo : V2 par défaut ; fallback : canal manuel) ; revue d'app au Lot 2 |
| 6 | Newsletter V2 | **Brevo**, ferme |
| 7 | Écriture agenda | **Lecture seule au MVP**, écriture en V2 |
| 8 | Validation client | **Optionnelle par contenu** |
| 9 | Import feed IG existant | **Oui, au MVP** |
| 10 | Auth mobile | **OTP 6 chiffres** (magic link sur desktop) |
| 11 | Quota IG atteint | **Report automatique** + notification |
| 12 | Fenêtre de grâce worker | **< 2 h** : publier ; au-delà : échec + notification |
| 13 | Rétention originaux | **J+7** post-publication ; 180 j pour les jamais-publiés |
| 14 | Plan Supabase | **Free jusqu'au Lot 2** ; Pro obligatoire avant le premier test de Reel (garde-fou) |
| 15 | Bucket miniatures | **Public** |
| 16 | Tokens OAuth | **Supabase Vault** (agendas) + tables deny-all ; AES applicatif seulement si self-host un jour |
| 17 | Worker | **Node sur Coolify + Postgres SKIP LOCKED** (pas de Redis, pas d'Edge Functions pour publier) |
| 18 | Téléphone phase solo | **iPhone** → priorité PWA iOS |

---

*Fin du PRD v0.2 — verrouillé pour le développement. Toute modification passe par une nouvelle version.*
