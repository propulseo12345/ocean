# PRD — Plateforme de gestion de contenu social pour freelances marketing

**Nom de travail :** [Produit] *(à définir — dossier de travail : « Ocean »)*
**Auteur :** —
**Version :** 0.1 (avant phase dev)
**Dernière mise à jour :** 11 juin 2026

---

## 1. Résumé exécutif

### Le problème
Un freelance qui gère la communication de plusieurs entreprises doit aujourd'hui jongler entre 4 ou 5 outils : un planificateur de posts (Later, Planoly), un outil de preview de feed, un Notion/Trello pour le calendrier éditorial, des allers-retours par mail/WhatsApp pour la validation client, et son propre agenda pour les rendez-vous. Chaque outil est une « usine à gaz » sur son périmètre, rien n'est centralisé, et le suivi multi-clients est fastidieux.

### La solution
Un SaaS unique, pensé **pour le freelance en marketing**, qui réunit en un seul endroit :
1. La **planification et la publication** de contenu multi-plateforme (Instagram, TikTok, Facebook, newsletter, canaux sur mesure).
2. L'**aperçu visuel du feed Instagram** (grille) pour composer l'esthétique avant de publier.
3. Le **calendrier éditorial** par client.
4. Un **espace de validation client** (relecture, commentaires, approbation).
5. Un **agenda unifié** qui agrège tous les agendas connectés (Google, Outlook) avec les rendez-vous et le planning éditorial.

### Positionnement
> « Le poste de pilotage du freelance en communication : tout ce qu'une agence fait dans 5 outils, dans un seul, sans la complexité. »

Le différenciateur n'est pas une fonctionnalité isolée (elles existent ailleurs) mais **la centralisation cohérente multi-clients dans une interface simple**, là où les concurrents sont soit mono-fonction, soit pensés pour de grosses équipes.

### Stratégie produit
Le produit est conçu **dès le départ comme un SaaS multi-locataire** (multi-comptes, isolation des données, portail de connexion, rôles), mais sera **testé en solo** par son créateur dans une première phase. Ce choix a un impact technique majeur et favorable (voir §8) : presque toutes les intégrations sociales peuvent fonctionner en **mode développeur** sur ses propres comptes / comptes gérés **sans passer par les longues validations d'API**, ce qui dé-risque entièrement le MVP.

---

## 2. Objectifs & indicateurs de succès

### Objectifs produit
- **O1** — Réduire à un seul outil le flux de travail quotidien d'un freelance multi-clients.
- **O2** — Permettre de planifier et publier un contenu Instagram/Facebook en quelques clics depuis le web ou le mobile.
- **O3** — Offrir une boucle de validation client fluide, sans mails ni captures d'écran.
- **O4** — Donner une vue unifiée du temps : rendez-vous + planning de publication.

### Indicateurs de succès (phase test solo)
- Le créateur gère **100 % de ses clients** sur l'outil (plus de Notion/Later en parallèle).
- **≥ 80 %** des posts Instagram/Facebook publiés directement depuis l'app.
- Temps de préparation d'un post planifié : **< 3 min** de l'idée à la programmation.
- Cycle de validation client : **réduit de plusieurs jours à < 24 h** grâce au portail.

### Indicateurs (phase SaaS, post-MVP)
- Activation : % de nouveaux comptes qui connectent ≥ 1 réseau et planifient ≥ 1 post.
- Rétention à 30 jours.
- Nombre de clients gérés par utilisateur (proxy de la valeur).

---

## 3. Personas & rôles

### Persona principal — « Le freelance / community manager » (Admin)
Gère la communication de 3 à 15 entreprises. Travaille principalement depuis son ordinateur en journée, mais a besoin du mobile pour publier au bon moment. Veut tout voir d'un coup d'œil, par client, et limiter la charge mentale.
**Rôle dans le produit :** `Owner / Admin`. Accès total : crée les espaces clients, connecte les comptes, crée et programme le contenu, gère la facturation (post-MVP).

### Persona secondaire — « Le client » (Reviewer)
Le contact côté entreprise qui doit valider les publications. N'est pas un expert outil. Veut une expérience simple : voir ce qui est prévu, commenter, approuver, sans créer de compte compliqué.
**Rôle dans le produit :** `Reviewer / Guest`. Accès **limité à son espace** uniquement, en lecture + commentaire + approbation. Pas d'accès aux autres clients, aux tokens, à la facturation.

### Personas futurs (post-MVP, à prévoir dans l'architecture)
- **Collaborateur / sous-traitant** (`Editor`) : un autre freelance avec qui on partage un ou plusieurs clients.
- **Administrateur d'agence** : si le produit monte vers de petites agences.

> **Implication d'architecture :** le modèle de rôles et l'isolation des données doivent être construits proprement dès le MVP, même si seuls `Admin` et `Reviewer` sont activés au départ.

---

## 4. Périmètre — MVP vs V2 vs Backlog

| Domaine | MVP (V1) | V2 | Backlog |
|---|---|---|---|
| Espaces multi-clients | ✅ Création, isolation, navigation par client | | Équipes / collaborateurs partagés |
| Studio de contenu | ✅ Anatomie complète d'un post, statuts | Variantes par plateforme, IA de rédaction de légende | Bibliothèque de hashtags réutilisables |
| Aperçu feed Instagram | ✅ Grille 3 colonnes, drag & drop, posts planifiés + publiés | Aperçu profil complet (bio, stories highlights) | Aperçu TikTok / grille TikTok |
| Calendrier éditorial | ✅ Vue mois/semaine par client | Vue multi-clients superposée, modèles récurrents | |
| Publication / programmation | ✅ Instagram + Facebook (1-clic / programmé), TikTok en brouillon, canaux manuels | TikTok publication publique directe (après audit), newsletter via 1 ESP | Stories, carrousels avancés, fil de commentaires auto |
| Validation client | ✅ Portail client, commentaires, annotations, approbation | Notifications email au client, validation par lot | Signature électronique / preuve d'approbation |
| Agenda unifié | ✅ Connexion Google + Outlook (OAuth), vue agrégée lecture + planning éditorial | Écriture deux sens (créer un rdv qui se synchronise) | Prise de rdv type Calendly |
| Statistiques | ❌ | ✅ Reach, engagement, meilleurs créneaux | Rapports clients exportables (PDF) |
| Facturation SaaS | ❌ (test solo) | ✅ Abonnements, plans, paiement | Facturation des clients finaux |
| Plateforme | ✅ Web responsive + PWA mobile | Apps natives iOS / Android | |

---

## 5. Fonctionnalités détaillées

### Module A — Espaces de travail multi-clients

**Description.** Chaque entreprise gérée par le freelance est un « espace client » isolé. Toute donnée (contenu, comptes sociaux, calendrier éditorial, validations) est rattachée à un client. Le freelance navigue de l'un à l'autre via un sélecteur global. Un tableau de bord d'accueil donne une vue transversale (« qu'est-ce qui m'attend aujourd'hui, tous clients confondus »).

**User stories.**
- En tant qu'admin, je veux créer un espace pour un nouveau client (nom, logo, couleur, fuseau horaire) afin d'organiser mon travail par client.
- En tant qu'admin, je veux basculer rapidement d'un client à l'autre afin de ne pas me perdre.
- En tant qu'admin, je veux un tableau de bord global qui agrège les tâches du jour (à valider, à publier, rendez-vous) tous clients confondus.

**Règles.**
- Toutes les vues (contenu, calendrier, feed) sont contextualisées au client sélectionné, **sauf** le tableau de bord global et l'agenda unifié.
- Les données d'un client ne doivent jamais fuiter vers un autre (isolation stricte, base du multi-locataire).

---

### Module B — Studio de contenu (anatomie d'un post)

**Description.** L'unité de travail centrale est le **contenu** (« content item »). C'est une idée de publication qui évolue par étapes. Le studio permet de le créer, l'éditer et le faire avancer dans son cycle de vie.

**Anatomie d'un contenu :**
- Client (rattachement)
- Plateforme(s) cible(s) : Instagram, TikTok, Facebook, Newsletter, Sur mesure
- Format : post simple, carrousel, Reel/vidéo, story
- Légende / texte
- Hashtags
- Média(s) : image(s) ou vidéo (voir Module Médias)
- Date/heure de publication prévue
- Statut (cycle de vie)
- Notes internes
- Commentaires & annotations (voir Module F)

**Cycle de vie (statuts) :**
`Idée` → `Brouillon` → `En revue` (envoyé au client) → `Approuvé` **ou** `Modifications demandées` → `Programmé` → `Publié` → (`Échec` si la publication API échoue)

**User stories.**
- En tant qu'admin, je veux créer un contenu en renseignant légende, visuel, hashtags, format et date afin de préparer une publication.
- En tant qu'admin, je veux faire passer un contenu d'un statut au suivant afin de suivre où il en est.
- En tant qu'admin, je veux filtrer mes contenus par statut et par plateforme afin de voir ce qui est en attente.

**Règles.**
- Un même contenu peut viser plusieurs plateformes ; à terme (V2) chaque plateforme peut avoir sa variante de légende. En MVP, une légende commune suffit.
- Le passage en `En revue` déclenche la disponibilité côté portail client.
- Le passage en `Programmé` crée une tâche de publication planifiée (voir Module E).

---

### Module C — Aperçu du feed Instagram (grille)

**Description.** Fonctionnalité signature. Une **grille 3 colonnes** reproduisant le rendu du feed Instagram, où l'on voit à droite (ou en plein écran sur mobile) l'enchaînement visuel des posts **planifiés et publiés**, dans l'ordre. On peut **réorganiser par glisser-déposer** pour composer l'esthétique du feed avant publication.

**User stories.**
- En tant qu'admin, je veux voir une grille façon Instagram avec mes posts à venir afin de juger l'harmonie visuelle.
- En tant qu'admin, je veux glisser-déposer les vignettes pour réorganiser l'ordre du feed.
- En tant qu'admin, je veux distinguer visuellement les posts déjà publiés des posts planifiés (badge, opacité).
- En tant qu'admin, je veux que les Reels soient identifiés par une icône dédiée dans la grille.

**Règles.**
- La grille n'affiche que des vignettes (miniatures) — **pas besoin d'héberger les fichiers en haute définition pour la preview** (voir §7, gestion des médias).
- L'ordre du feed est dérivé des dates/heures de publication ; le glisser-déposer **réordonne les dates** (ou un champ d'ordre dédié) de manière cohérente.
- Les posts déjà publiés sont en lecture seule dans la grille.

---

### Module D — Calendrier éditorial

**Description.** Vue calendrier (mois / semaine) du contenu d'un client, montrant chaque publication à sa date. Sert à planifier la cadence et repérer les trous.

**User stories.**
- En tant qu'admin, je veux voir le mois en cours avec tous les contenus planifiés d'un client afin de visualiser ma cadence.
- En tant qu'admin, je veux créer un contenu directement depuis une case de date.
- En tant qu'admin, je veux distinguer les contenus par plateforme (code couleur / icône) et par statut.

**Règles.**
- Le calendrier éditorial est **par client**.
- Cohérence totale avec le studio : modifier une date ici met à jour le contenu partout (grille, agenda unifié).
- À distinguer de l'**agenda unifié** (Module G) qui, lui, mélange tous les clients + les rendez-vous.

---

### Module E — Planification & publication multi-plateforme

**Description.** Le cœur opérationnel : programmer un contenu pour qu'il parte automatiquement à la bonne heure, ou le publier en 1 clic immédiatement. Le comportement dépend de la plateforme (voir §7 pour le détail technique des contraintes par réseau).

**Capacités par plateforme (MVP) :**

| Plateforme | MVP | Comportement |
|---|---|---|
| **Instagram** | Publication directe / programmée (posts, carrousels, Reels) | Vraie publication automatique via l'API officielle, sur comptes Business/Creator connectés |
| **Facebook** | Publication directe / programmée (Pages) | Vraie publication automatique via l'API officielle, sur Pages connectées |
| **TikTok** | Brouillon poussé dans l'app | Le contenu est envoyé dans la boîte de réception TikTok ; l'utilisateur finalise la publication dans l'app *(la publication publique 100 % automatique nécessite un audit — voir §7 et roadmap)* |
| **Newsletter** | Manuel (MVP) | Le contenu vit dans le calendrier et le flux de validation ; envoi réel via un outil emailing en V2 |
| **Sur mesure** | Manuel | Canal générique : planifié, validé, puis marqué « publié » à la main (checklist) |

**User stories.**
- En tant qu'admin, je veux programmer un post Instagram à une date/heure future afin qu'il parte sans intervention.
- En tant qu'admin, je veux publier immédiatement en 1 clic depuis le mobile afin de saisir le bon moment.
- En tant qu'admin, je veux être notifié si une publication automatique échoue (et savoir pourquoi) afin de corriger.
- En tant qu'admin, je veux pour TikTok que le contenu soit prêt en brouillon afin de le finaliser rapidement dans l'app.

**Règles.**
- La programmation s'appuie sur une **file de tâches planifiées** côté serveur (un worker qui déclenche la publication à l'heure dite) — c'est un composant critique à ne pas sous-estimer.
- Chaque tentative de publication enregistre son statut et la réponse de la plateforme (succès / échec / motif).
- Gestion des nouvelles tentatives (retry) en cas d'erreur transitoire de l'API.
- Respect des limites de débit de chaque plateforme (voir §7).

---

### Module F — Workflow de validation client (portail client)

**Description.** Un espace dédié où le client relit le contenu prévu, **commente, annote et approuve** — sans quitter l'outil. Remplace les allers-retours par mail et captures d'écran. C'est souvent le vrai cœur de valeur d'un outil « agence ».

**User stories.**
- En tant qu'admin, je veux envoyer un lot de contenus « en revue » à un client afin qu'il valide.
- En tant que client, je veux voir les publications prévues (visuel + légende + date) dans une interface simple.
- En tant que client, je veux commenter un post ou annoter directement le visuel afin d'indiquer une correction.
- En tant que client, je veux approuver ou demander des modifications en un clic.
- En tant qu'admin, je veux voir en temps réel quels contenus sont approuvés / en attente / à corriger.

**Règles.**
- Le client n'a accès **qu'à son espace**, en lecture + commentaire + approbation. Jamais aux autres clients ni aux réglages.
- Accès simplifié : idéalement par **lien magique / invitation par email** plutôt qu'un compte lourd (à arbitrer).
- L'approbation d'un contenu débloque sa programmation ; une demande de modification le renvoie en `Brouillon` avec le commentaire attaché.
- Historique des échanges conservé sur chaque contenu.

---

### Module G — Agenda unifié

**Description.** Une vue qui **agrège tous les agendas connectés** du freelance (Google Agenda, Outlook) **via OAuth**, superposée au planning éditorial de tous les clients. Objectif : une seule timeline pour « mon temps » — rendez-vous, deadlines de publication, créneaux de production.

**User stories.**
- En tant qu'admin, je veux connecter mes comptes Google et Outlook via OAuth afin d'importer mes rendez-vous.
- En tant qu'admin, je veux voir dans une seule vue mes rendez-vous **et** mes publications planifiées (tous clients) afin de gérer mon temps.
- En tant qu'admin, je veux filtrer par source (agenda perso, par client) afin de me concentrer.

**Règles (MVP).**
- Connexion multi-comptes Google (API Google Calendar) et Microsoft (Microsoft Graph), tokens stockés de façon chiffrée.
- **MVP = lecture + superposition** des événements et des contenus planifiés dans une vue commune.
- **V1.5 / V2 = écriture deux sens** (créer un rendez-vous depuis l'app qui se répercute dans Google/Outlook).
- À distinguer du calendrier éditorial (Module D) qui est *par client* et *centré contenu* ; l'agenda unifié est *transversal* et *centré temps*.

---

### Module H — Authentification, rôles & socle SaaS

**Description.** Le socle multi-locataire : portail de connexion, comptes, rôles, isolation. Activé dès le MVP même si une seule personne l'utilise, pour ne pas avoir à tout réécrire ensuite.

**User stories (MVP).**
- En tant qu'utilisateur, je veux créer un compte et me connecter via un portail sécurisé.
- En tant qu'admin, je veux inviter un client dans un espace en accès limité.

**User stories (V2).**
- En tant qu'admin, je veux souscrire un abonnement et gérer mon paiement.

**Règles.**
- Architecture **multi-locataire** : chaque compte freelance = un locataire (tenant) ; isolation stricte des données.
- Modèle de rôles : `Admin`, `Reviewer` (MVP) ; `Editor`, `AgencyAdmin` (extensible).
- Authentification standard (email + mot de passe, idéalement option SSO Google).
- Facturation / plans : **hors MVP**, à prévoir architecturalement (V2).

---

## 6. Modèle de données (entités principales)

```
Organization (locataire = compte freelance)
 ├─ User (Admin, Editor…) — appartient à Organization
 ├─ Client (entreprise gérée) — appartient à Organization
 │   ├─ Reviewer/Guest (contact validation) — accès limité à ce Client
 │   ├─ SocialAccount (IG / TikTok / FB) — tokens OAuth chiffrés
 │   └─ ContentItem (la publication)
 │        ├─ MediaAsset (réf. stockage + miniature)
 │        ├─ Comment / Annotation (par User ou Reviewer)
 │        ├─ Approval (statut, qui, quand)
 │        └─ PublishJob (tâche planifiée → plateforme, statut, tentatives, réponse)
 └─ CalendarAccount (Google / Outlook) — appartient à User, tokens OAuth chiffrés
      └─ CalendarEvent (rendez-vous synchronisés)
```

**Statuts ContentItem :** `idea | draft | in_review | approved | changes_requested | scheduled | published | failed`

**Notes :**
- `SocialAccount` est rattaché au **Client** (un client = ses propres comptes IG/TikTok/FB).
- `CalendarAccount` est rattaché au **User** (ce sont *mes* agendas, transversaux).
- `PublishJob` est l'objet manipulé par le worker de programmation ; il porte la cible précise (quel compte, quel format) et l'historique d'exécution.

---

## 7. Contraintes techniques & intégrations *(section critique)*

> Cette section traduit l'état réel des API de publication au moment de la rédaction. Ces plateformes changent leurs règles régulièrement (versionnage trimestriel) : à re-vérifier avant le développement de chaque intégration.

### 7.1 Tableau récapitulatif des API de publication

| Plateforme | Formats publiables via API | Prérequis | Validation officielle requise ? | Chemin MVP recommandé |
|---|---|---|---|---|
| **Instagram** | Photos, vidéos, carrousels, Reels, Stories | Compte **Business ou Creator** lié à une Page Facebook ; app développeur Meta ; permissions de publication | App Review Meta pour la production (au-delà de ~25 comptes de test) ; ~2–4 semaines | **Mode développeur** sur tes comptes / comptes gérés (≤ 25) → publication réelle **sans app review** pendant la phase solo |
| **Facebook** | Texte, liens, photos, vidéos, Reels, Stories — **Pages uniquement** | App développeur Meta + **vérification d'entreprise** ; permissions `pages_manage_posts` & dépendances ; jeton de Page | App Review + Business Verification pour la production | Mode développeur sur les Pages où tu as un rôle → OK pour la phase solo |
| **TikTok** | Vidéos, carrousels photo | App développeur TikTok ; scope de publication ; consentement utilisateur | **Audit séparé** obligatoire pour la publication **publique** ; tant qu'il n'est pas passé, tout post est **privé** (visible du seul créateur) et max 5 comptes/24 h | **Mode brouillon** (push dans la boîte de réception TikTok, finalisation dans l'app) → **ne nécessite pas l'audit**. La publication publique automatique attend l'audit (V2). |
| **Newsletter** | — | Dépend d'un outil d'emailing (Mailchimp, Brevo, MailerLite…) | Selon l'outil | **Manuel en MVP** ; intégration d'un ESP en V2 |
| **Sur mesure** | — | — | — | Canal générique manuel (planifié, validé, marqué publié) |

### 7.2 L'insight stratégique : mode développeur vs production

Le fait de **tester en solo** est un avantage déterminant. Les API Meta (Instagram + Facebook) permettent à une app **en mode développeur** de publier réellement sur **tes comptes et les comptes où tu as un rôle** (jusqu'à ~25 comptes de test), **sans passer par l'app review**. Or c'est exactement ta situation : tu gères les comptes de tes clients.

**Conséquence :** tu peux avoir une **vraie publication Instagram/Facebook en 1 clic dès le MVP**, sans attendre des semaines de validation. L'app review ne devient nécessaire que le jour où tu ouvres l'outil à des clients externes qui connectent leurs propres comptes (= la vraie phase commerciale SaaS). À ce moment-là, prévoir : politique de confidentialité, mécanisme de suppression de données, captures/vidéo de démonstration du parcours, justification écrite par permission.

Pour **TikTok**, le mode brouillon couvre le MVP sans audit. L'audit (2–6 semaines, dossier strict, app finie évaluée) sera à lancer pour débloquer la publication publique automatique.

### 7.3 Gestion des médias — preview vs publication

C'est le point qui demande une décision claire. Il y a **deux besoins distincts** :

1. **Pour l'aperçu du feed (grille)** : seules des **miniatures compressées** sont nécessaires. Stockage très léger. On peut même afficher des aperçus générés côté navigateur. → Pas de problème de place.

2. **Pour la publication via API** : les plateformes (Instagram en tête) **récupèrent le média via une URL publique** au moment de la publication, ou exigent un envoi du fichier. Le fichier **doit donc être accessible publiquement à l'instant T de la publication**. → Là, un hébergement est incontournable.

**Recommandation pour concilier les deux et économiser l'espace :**
- Utiliser un **stockage objet bon marché** (ex. Cloudflare R2, Backblaze B2, ou un S3) pour les fichiers à publier.
- Appliquer une **politique de cycle de vie** : on garde le fichier le temps nécessaire (avant + juste après publication), puis **suppression automatique** après une courte rétention. On ne stocke jamais éternellement.
- Conserver uniquement les **miniatures légères** pour l'historique de la grille.

Cela répond à « je ne veux pas que ça prenne trop de place » tout en rendant la publication 1-clic possible. **C'est une décision à acter avant le dev** (voir §13).

### 7.4 Limites & robustesse à prévoir
- **Limites de débit** : ~100 publications / 24 h par compte Instagram ; ~15/jour par créateur TikTok ; limites par app côté Facebook. À surveiller pour éviter les blocages.
- **Traitement asynchrone** : la publication vidéo/Reel n'est pas instantanée (création de conteneur → attente de traitement → publication). Le système doit gérer cette latence et le suivi de statut.
- **Tokens** : stockage chiffré, gestion de l'expiration et du rafraîchissement des jetons OAuth (sociaux + agendas).
- **Échecs** : journalisation, nouvelles tentatives, notification à l'utilisateur avec motif clair.

### 7.5 Intégrations agendas
- **Google Agenda** : API Google Calendar, OAuth 2.0, lecture des événements (puis écriture en V1.5/V2).
- **Outlook / Microsoft 365** : Microsoft Graph, OAuth 2.0, permissions calendrier.
- Multi-comptes par utilisateur, jetons chiffrés.

---

## 8. Architecture & stack suggérée *(indicatif, non prescriptif)*

- **Frontend** : application web responsive (React / Next.js), optimisée mobile, livrée en **PWA** pour permettre la publication depuis le téléphone sans app native au MVP.
- **Backend** : API (Node/NestJS ou équivalent), base **PostgreSQL** (multi-locataire), **file de tâches** (BullMQ / Redis) pour la **programmation des publications** — composant critique.
- **Stockage médias** : stockage objet (R2 / B2 / S3) avec politique de cycle de vie (cf. §7.3).
- **Authentification** : solution éprouvée (Auth0 / Clerk / Supabase Auth) ou maison, avec gestion des rôles.
- **Hébergement** : **région européenne** (RGPD — voir §10).
- **Mobile natif** (iOS/Android) : **V2** seulement ; la PWA couvre le MVP.

---

## 9. Parcours utilisateurs clés

**Parcours 1 — Préparer et programmer un post Instagram**
Sélection du client → création d'un contenu (visuel + légende + hashtags + format) → positionnement dans la grille du feed → choix date/heure → envoi en revue client → (approbation) → programmation → publication automatique à l'heure dite → confirmation / notification.

**Parcours 2 — Validation côté client**
Réception d'une invitation (lien) → ouverture du portail client (son espace uniquement) → revue des posts prévus (visuel, légende, date) → commentaire / annotation → approbation ou demande de modification → l'admin voit le statut mis à jour en temps réel.

**Parcours 3 — Vue de ma journée**
Ouverture du tableau de bord global → agenda unifié : rendez-vous (Google + Outlook) + publications planifiées tous clients → identification des tâches du jour (à valider, à publier).

---

## 10. Exigences non-fonctionnelles

- **RGPD / vie privée** : l'utilisateur et son créateur étant en France/UE, héberger les données en UE, prévoir consentement, droit à l'effacement, registre des traitements. Les API Meta/TikTok exigeront une politique de confidentialité et un mécanisme de suppression de données lors de la mise en production.
- **Sécurité** : chiffrement au repos des jetons OAuth (sociaux + agendas), isolation stricte multi-locataire, accès client cloisonné.
- **Conformité plateformes** : respect des conditions d'utilisation et des règles d'UX imposées par Meta et TikTok (notamment côté TikTok, écrans de consentement et libellés requis).
- **Fiabilité** : la programmation des publications doit être robuste (une publication manquée = perte de confiance). File de tâches monitorée, retries, alertes.
- **Performance** : grille de feed et calendrier fluides ; publication mobile rapide.

---

## 11. Roadmap / découpage en lots de développement

**Lot 0 — Socle**
Multi-locataire, authentification, rôles, espaces clients, navigation, tableau de bord global (coquille).

**Lot 1 — Contenu & visuel**
Studio de contenu (anatomie + statuts), aperçu du feed Instagram (grille drag & drop, miniatures), calendrier éditorial par client.

**Lot 2 — Publication**
Stockage médias + cycle de vie, file de tâches de programmation, intégration **Instagram** (mode dév), intégration **Facebook** (mode dév), **TikTok en brouillon**, canal manuel/sur mesure. Gestion des erreurs et notifications.

**Lot 3 — Validation client**
Portail client (accès cloisonné, lien d'invitation), commentaires, annotations, approbation, synchronisation des statuts.

**Lot 4 — Agenda unifié**
OAuth Google + Outlook, agrégation lecture, vue unifiée rendez-vous + planning éditorial.

**→ Fin MVP (test solo).**

**V2 (post-validation solo / ouverture SaaS)**
App review Meta + audit TikTok (publication TikTok publique), statistiques (reach/engagement/créneaux), intégration newsletter (1 ESP), facturation & plans, écriture deux sens agendas, apps natives.

---

## 12. Risques & hypothèses

| Risque / hypothèse | Impact | Mitigation |
|---|---|---|
| Les règles des API sociales changent (versionnage trimestriel) | Une intégration peut casser | Re-vérifier avant chaque dev ; isoler chaque intégration derrière une couche d'abstraction |
| App review / audit refusés à l'ouverture SaaS | Bloque la publication publique pour clients externes | Mode dév couvre la phase solo ; préparer tôt politique de confidentialité, suppression de données, démos |
| La publication programmée échoue silencieusement | Perte de confiance | File de tâches monitorée, retries, notifications systématiques |
| Tension stockage médias vs coût/place | Surcoût ou impossibilité de publier | Stockage objet + cycle de vie (cf. §7.3), décision à acter |
| Complexité du multi-plateforme sous-estimée | Dérapage du planning | MVP volontairement limité (IG + FB réels, TikTok brouillon, reste manuel) |
| Accès client trop lourd décourage les clients | Faible adoption de la validation | Lien magique / invitation simple plutôt qu'un compte complet |

---

## 13. Questions ouvertes à trancher avant le dev

1. **Médias** : valide-t-on l'approche « stockage objet + suppression automatique après publication » (§7.3) ? C'est la décision la plus structurante côté technique.
2. **Accès client** : lien magique sans mot de passe, ou compte léger ? (impacte l'UX de validation et la sécurité).
3. **Grille de feed** : le glisser-déposer réordonne-t-il les **dates de publication** ou un **champ d'ordre** indépendant de la date ? (ces deux logiques ne se valent pas).
4. **TikTok au MVP** : mode brouillon, **ou** simple notification « à poster maintenant » ? (le brouillon est plus pratique mais demande l'intégration de l'API d'upload).
5. **Newsletter** : laquelle de tes outils emailing cibler en premier en V2 (Brevo, Mailchimp, autre) ?
6. **Écriture agenda** : la création de rendez-vous depuis l'app (deux sens) est-elle un besoin réel à court terme, ou la lecture/superposition suffit-elle au début ?
7. **Nom du produit** et identité (placeholder `[Produit]` à remplacer).

---

*Fin du PRD v0.1.*
