# Brief de reprise — août 2026

Document destiné à Claude Code. À référencer en début de chaque session.

Rédigé le 14 août 2026, sur la base d'une lecture du code à `main @ 8a1d8b5` (22 juillet 2026).

> **Addendum d'audit** — un audit senior 11 dimensions a été conduit le 12/08/2026
> (`_research/audits/2026-08-12/`). Il **confirme la vision et la séquence de ce brief**, mais
> **corrige plusieurs affirmations de la section 3** et **ajoute des prérequis de sûreté avant la
> session 3**. Voir la section 12 en fin de document — elle fait foi en cas de contradiction avec
> la section 3, car elle est adossée à des `fichier:ligne` vérifiés de façon adversariale.

---

## 1. À lire avant toute autre chose : corrections d'état

`CLAUDE.md` §0 est périmé et décrit un état d'il y a deux mois. Il annonce :

> « PHASE EN COURS : preview front UI-only avec données mockées, ne PAS câbler Supabase »
> « Repo : à créer »

**C'est faux.** Le repo existe, Supabase est câblé, les migrations 001 à 021 sont appliquées en ligne, le worker est écrit, l'app est déployée. Première tâche de la reprise : corriger ce paragraphe, ainsi que les champs `Repo`, `URL prod app` et `URL staging`.

Tant que ce n'est pas fait, chaque nouvelle session repart d'un postulat faux et risque de réintroduire des mocks.

---

## 2. La vision : le cercle, pas l'arc

SoCean doit couvrir **l'intégralité du cycle de vie du contenu**, et surtout le refermer sur lui-même. Aujourd'hui le produit est un arc : il va de l'idée à la publication et s'arrête. Il doit devenir un cercle.

Les cinq phases, dans l'ordre :

1. **Strategy & ideate.** Piliers éditoriaux, brand kit, banque d'idées, génération d'idées assistée.
2. **Plan.** Calendrier éditorial, board, grille de feed, créneaux récurrents.
3. **Design & create.** Rédaction (copywriting), **et création visuelle**, les deux assistées par l'IA et contraintes par le brand kit.
4. **Publish & distribute.** Publication réelle multi-plateformes, programmée, idempotente.
5. **Evaluate & maintain.** Collecte des métriques, rapports client, gestion des commentaires, recyclage des contenus performants.

**Ce qui referme le cercle** et qui n'existe nulle part aujourd'hui : la phase 5 doit alimenter la phase 1. Concrètement, croiser `content_pillars.target_share` (part de production visée par pilier) avec `post_metrics.engagement_total` (performance réelle) pour produire des constats du type « ce pilier représente 20 % de ta production et 58 % de ton engagement, produis-en plus ». C'est du SQL, pas de l'IA. C'est la brique la moins chère du backlog et c'est celle qui transforme un outil de publication en système de pilotage.

Les sept piliers visés à terme : génération d'idées, copywriting, création d'image, community management, programmation, suivi des KPI, IA transverse. Avec deux modes d'usage : pour soi, et pour ses clients.

---

## 3. État réel vérifié du code, phase par phase

Ne pas se fier au PRD sur ces points, il diverge du code.

> ⚠ Les pourcentages ci-dessous mesurent **ce qui est écrit**, pas ce qui **fonctionne de bout en
> bout**. L'audit du 12/08 les corrige en section 12.

### Phase 1, Strategy & ideate : environ 70 %

Existant et fonctionnel : `content_pillars` avec `target_share` et jauge de dérive, `brand_kits` (palette oklch ordonnée, ton, do, don't, mots interdits avec détection câblée), `hashtag_groups`, `recurring_slots`, banque d'idées écrivant de vrais `content_items` en `status='idea'`, `saved_views`.

Manquant : tout ce qui est génératif. L'idéation est de la capture, pas de la proposition.

### Phase 2, Plan : environ 95 %

Le point fort du produit. Calendrier par client en timezone client, board avec actions par lot, grille Instagram avec reprogrammation par glisser-déposer, `exclude_from_grid` persisté, labels, `applyStatusIntent` qui enfile dans `publish_jobs`.

Rien de structurel ne manque.

### Phase 3, Design & create : environ 50 %

Côté texte : studio, composer, cibles par plateforme, `content_versions`, duplication intra et inter clients, options avancées par plateforme. L'assistance IA à la rédaction est spécifiée en Lot 5 mais compte **zéro ligne de code**, et aucune dépendance IA n'est présente dans le lockfile.

Côté image : `media_assets`, `content_media`, deux buckets, conversion et miniatures côté client, médiathèque. Tout cela est de **l'ingestion, pas de la création**. Rien dans SoCean ne produit un visuel.

### Phase 4, Publish & distribute : environ 85 %, mais jamais prouvé

Excellente ingénierie : `publish_jobs`, claim avec `SKIP LOCKED`, lease, reaper, idempotence via `publish_started_at` plus vérification distante du conteneur, index unique partiel par cible active, backoff avec jitter, limitation de débit par compte, `social_account_quota_usage`.

**Mais `STUB_MODE = true` dans `apps/worker/src/publishers/index.ts`.** Aucun post n'est jamais sorti du système. Les publishers Instagram, Facebook et TikTok sont des simulations déterministes.

TODO explicites restants dans le worker :
1. `context.ts` : rafraîchissement réel du token proche de l'expiration.
2. `context.ts` : génération de l'URL signée 48h du média original à la publication.
3. `context.ts` : quota réel (IG `content_publishing_limit`, header BUC Facebook, compteur TikTok local).
4. `tokens/refresh.ts` : rotation sous advisory lock, statut `needs_reauth`, email Brevo à l'échec.

### Phase 5, Evaluate & maintain : environ 40 %, et le trou est plus petit qu'il n'y paraît

Beaucoup plus existe que ce que le PRD admet : `post_metrics` est une vraie table (likes, comments, saves, reach nullable, `engagement_total` en colonne générée stockée), rattachée soit à un `content_target` soit à un `imported_post` avec contrainte d'exclusivité. `imported_posts` existe. La page Performance lit réellement. La page Report et le partage public `/r/[token]` fonctionnent, avec RPC et quatre policies (migration 018).

**Le trou : personne n'écrit dans `post_metrics`.** Aucun collecteur n'existe. Le commentaire dans `perf-data.ts` le dit explicitement. Toute la chaîne d'évaluation est construite sauf le job qui la remplit.

Absent également : toute la moitié « maintain » (recyclage des tops, rafraîchissement de contenu).

### Transverse : ce que le PRD promet et qui n'est pas installé

Vérifié dans `apps/web/package.json`, ces dépendances sont **absentes** : Sentry, PostHog, Serwist, TanStack Query, React Hook Form.

Conséquences concrètes : aucune visibilité sur les erreurs en production alors que le worker publiera seul la nuit sur des comptes clients, et pas de Web Push malgré la table `push_subscriptions` et une matrice de notifications qui en dépend.

Brevo : le code est complet mais inerte, il manque les secrets.

---

## 4. Décisions prises, à appliquer sans les rediscuter

1. **Sentry et PostHog : à installer maintenant.** Sentry est bloquant avant le premier post réel, y compris les Cron Monitors pour le heartbeat du worker. PostHog restera inerte jusqu'aux premiers utilisateurs mais s'installe dans la même passe.
2. **Serwist et Web Push : plus tard**, dans une session dédiée, après le premier post réel et avant les premiers clients payants. Compter quatre à huit heures, ce n'est pas une simple config.
3. **TanStack Query et React Hook Form : abandonnés.** Amender le PRD en conséquence. 49 500 lignes fonctionnent en Server Components et Server Actions. Les introduire serait une réécriture sans bénéfice utilisateur.
4. **Premier post réel sur un compte de test dédié**, créé exprès. Connecter aussi un compte Instagram réel avec de l'historique, sinon l'import du feed existant est intestable.
5. **Rythme de travail : 10 à 20 heures par semaine.** Découper en sessions courtes et vérifiables, pas en marathons.
6. **La Business Verification Meta est lancée en parallèle dès le premier jour.** Elle a sa propre file, son propre risque de rejet, et rien ne peut être soumis en App Review avant qu'elle soit passée. C'est le seul délai incompressible du projet.

---

## 5. Session 1 : app Meta et identifiants

Objectif : disposer d'identifiants réels avant d'écrire une seule ligne de publisher. Écrire un publisher sans App ID revient à coder à l'aveugle.

1. Corriger `CLAUDE.md` §0 et les champs d'URL.
2. Créer l'app Meta en mode développement.
3. Ajouter le compte de test et le compte Instagram personnel comme testeurs.
4. Récupérer App ID et App Secret.
5. Poser `OAUTH_STATE_SECRET` et `OAUTH_META_CLIENT_ID` / `OAUTH_META_CLIENT_SECRET` dans Coolify.
6. Déclarer les redirect URIs côté Meta.
7. Créer la seconde application Coolify `ocean-worker` : commande `pnpm --filter worker start`, `DATABASE_URL` sur Supavisor **port session 5432** (pas le transaction pooler).
8. Exécuter `deploy/smoke_publish_jobs.sql` et vérifier claim, lease, reaper.

En parallèle, hors code : créer l'entité et le Business Manager, lancer la Business Verification.

Critère de sortie : un job de test est claim par le worker déployé, avec des identifiants Meta réels en environnement.

## 6. Session 2 : observabilité

Sentry sur `apps/web` et `apps/worker`, sourcemaps au build, Cron Monitors sur le heartbeat worker, alerte sur job `failed` ou `dead_letter`. PostHog en host EU.

Critère de sortie : une erreur provoquée volontairement dans le worker remonte dans Sentry.

## 7. Sessions 3 et suivantes : publishers réels

Retirer `STUB_MODE`, en le conservant derrière un flag pour les tests.

Instagram d'abord : `POST /{ig-user-id}/media` puis `media_publish`, Reels, carrousels, alt text, `user_tags`, `location_id`. Puis Facebook Pages. Puis TikTok en push brouillon.

Traiter les quatre TODO du worker listés en section 3.

Rappels de règles internes à respecter : idempotence (règle 15), interroger l'état du conteneur au lieu de republier à l'aveugle, appels HTTP hors transaction, formats Instagram (JPEG, 8 Mo maximum, ratio entre 4:5 et 1.91:1).

Critère de sortie : un post réel, programmé la veille, apparaît sur le compte de test sans intervention humaine.

## 8. Session suivante : refermer le cercle

Le job collecteur de métriques. Insights Instagram et Facebook par `social_account`, écriture en service_role, même pattern de file que `publish_jobs`. Puis l'import réel du feed pour peupler `imported_posts`. Puis l'historisation permettant la comparaison de période N contre N-1, aujourd'hui impossible puisque `post_metrics` est un instantané.

Enfin la requête qui referme la boucle, décrite en section 2.

---

## 9. Ordre du reste, à ne pas anticiper

Après le go-live, la monétisation passe avant les nouveaux piliers. Le PRD dit « monétisation hors périmètre MVP », c'est l'hypothèse à rouvrir en premier : sans Stripe, aucun revenu, quel que soit le nombre de piliers couverts.

Ensuite seulement, dans cet ordre :

1. **Lot 5, moteur de skills.** Franchir la gate `LOT5-01`, créer `packages/skills` et les quatre tables, la boucle LLM dans le worker. Premier skill : génération d'idées, car elle sort des `content_items` en `status='idea'` et ne demande aucune nouvelle interface.
2. **Création d'image.** Ne pas construire un second pipeline : rendre `skill_artifacts` polymorphe (texte ou image). Commencer par la composition déterministe pilotée par `brand_kits.palette` (cartes citation, covers de carrousel, cartes stat) via satori ou sharp, qui couvre l'essentiel de ce qu'une agence publie, sans coût par image et on-brand par construction. La génération par modèle vient après, derrière une interface fournisseur. Ajouter `sharp` au worker pour la normalisation, les modèles sortant du PNG carré alors qu'Instagram exige du JPEG en 4:5 à 1.91:1. Les visuels produits atterrissent dans `media_assets` au chemin `{org_id}/{client_id}/{content_item_id}/{media_asset_id}/` pour hériter de la RLS, des URL signées et de la purge sans nouvelle règle.
3. **Community management.** Instagram et Facebook uniquement, TikTok n'expose aucune API de commentaires. Table `social_comments` auto-référencée, Route Handler webhook avec vérification de signature, job d'ingestion arbitrant le budget BUC face à la publication. **Les réponses passent par la file, jamais par une Server Action** : une double réponse est du même ordre de gravité qu'une double publication. Différenciateur : brouillon de réponse soumis à validation du client via le portail existant.
4. **Nouvelles plateformes.** LinkedIn puis Google Business Profile, qui sont les deux qui font vendre à un ICP de PME françaises. Ensuite la couche sans revue si un volume d'intégrations est utile au marketing : Bluesky, Telegram, Discord, WordPress, Ghost.

Note technique à trancher avant la deuxième plateforme : l'interface `Publisher` est calquée sur le modèle conteneur d'Instagram (`createContainer` puis `publish`). Bluesky, Telegram ou WordPress n'ont pas de conteneur, c'est un seul POST. Soit généraliser l'interface, soit faire retourner à ces adaptateurs un pseudo-conteneur avec un `publish` neutre.

Note économique sur X : le modèle est passé au paiement à l'usage, environ 0,015 dollar par post et 0,20 dollar si le post contient un lien, sans tier gratuit ni possibilité de souscrire aux anciens forfaits. Cela crée un coût variable par post qui impacte directement la marge. C'est une décision de pricing à prendre avant d'écrire le publisher.

---

## 10. Guardrails permanents

1. Ne jamais réintroduire de données mockées.
2. Toute écriture plateforme passe par le worker et la file, jamais par une Server Action.
3. `org_id` et `client_id` sur toute nouvelle table, RLS activée.
4. Appels HTTP hors transaction.
5. Aucun secret loggé, jamais de token en clair dans les traces.
6. Sessions courtes avec critère de sortie vérifiable, pas de gros lots non testables.
7. Le nom commercial n'est pas arrêté. Ne pas coder de dépendance forte au nom ni à un domaine tant que la recherche INPI et EUIPO n'est pas faite. C'est bloquant pour l'App Review, qui exige une politique de confidentialité hébergée sur un domaine propre.

---

## 11. Explicitement hors périmètre pour l'instant

Ne pas commencer, même si l'occasion se présente : messages privés Instagram (permission distincte, la plus scrutée par Meta, exige un webhook fonctionnel et un opt-out), link-in-bio, TanStack Query, React Hook Form, plateformes autres que Meta et TikTok, tout skill IA avant que la gate `LOT5-01` soit franchie.

---

## 12. Addendum — corrections issues de l'audit senior du 12/08/2026

*(section renseignée à l'issue de la vérification croisée brief ↔ audit ↔ code — voir
`_research/audits/2026-08-12/12-BRIEF-vs-AUDIT.md` pour le détail finding par finding)*
