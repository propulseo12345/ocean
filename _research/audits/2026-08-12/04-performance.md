# Audit — Performance : goulots, logique inefficace, rendus inutiles, opérations coûteuses, fuites de ressources (DATE-MANQUANTE)

## Verdict

Ocean est **rapide aujourd'hui parce que la base est vide**, pas parce que le code est économe. Toute la couche de lecture applique un principe unique — « charger tout, hydrater tout, filtrer en mémoire » — jusque dans le layout : chaque chargement à froid du segment `(app)` rapatrie **l'intégralité des contenus de l'org**, les hydrate (cibles, médias, labels), **signe toutes les URL Storage des originaux** et sérialise le tout vers un composant client qui n'utilise que cinq champs ([layout.tsx:21](<../../../apps/web/app/(app)/layout.tsx#L21>) → [dashboard.ts:168](../../../apps/web/lib/data/dashboard.ts#L168) → [content.ts:223](../../../apps/web/lib/data/content.ts#L223)). Aucune des six lectures de croissance n'a de `LIMIT`, aucune n'a de fenêtre temporelle, et aucune ne lit `error` : le jour où une de ces requêtes cassera (414, timeout, plafond `max_rows`), l'app n'affichera pas une erreur — elle affichera **une liste vide crédible**, à Étienne comme au client dans le portail. Pour un usage RÉEL immédiat, trois choses bloquent réellement : le composer d'édition **supprime silencieusement tous les médias d'un contenu à chaque enregistrement** ([composer-types.ts:153](../../../apps/web/components/app/studio/composer/composer-types.ts#L153), F01) ; `next/image` n'autorise qu'`images.pexels.com`, donc **aucune vignette Supabase ne s'affichera jamais** — grille de preview du feed, studio, médiathèque et surtout portail de validation ([next.config.ts:14](../../../apps/web/next.config.ts#L14), F02) ; et le worker n'a **aucune clôture de bail** — toutes ses écritures sont en `where id = $1`, sans prédicat `worker_id`, donc deux exécuteurs peuvent traiter le même job après une coupure DB > 2 min ([pg-store.ts:98](../../../apps/worker/src/db/pg-store.ts#L98), F03, règle 15). Aucun P0 au sens de la grille de cet audit (clé d'API en dur, token OAuth atteignable côté client, fuite inter-tenant) n'a survécu à la réfutation sur cette dimension : deux findings initialement classés P0 ont été ramenés à P1, sans cesser d'être bloquants. **Risque à 5 ans** : le coût de chaque page croît linéairement avec l'HISTORIQUE cumulé de l'org — jamais purgé, jamais paginé, jamais fenêtré — pendant que le débit du worker reste plafonné à un job en vol. La trajectoire n'est pas « ça ralentit progressivement », c'est « ça ralentit partout en même temps, puis ça tombe d'un coup » : le mur du 414 sur les `.in()` non bornés (F13) et la troncature silencieuse à `max_rows = 1000` (F14) sont des falaises, pas des pentes.

Note de périmètre : cette passe a été conduite sous l'angle performance, mais trois défauts de **correction** ont été trouvés sur des chemins chauds en traçant leur coût (F01 composer, F03 fencing worker, F09 reaper). Ils sont conservés ici parce qu'ils vivent exactement dans le code analysé et qu'ils sont, de loin, les plus graves de la passe.

---

## Fonctionnement réel observé

### 1. Le coût fixe d'un chargement de page : le shell

Toute page de `(app)` paie d'abord son layout, qui est **dynamique** (il lit le cookie `active_org_id` via `getActiveOrg`) donc jamais mis en cache :

```
AppLayout                                app/(app)/layout.tsx:18
  -> getActiveOrg()                      auth + organization_members + profiles
  -> getShellSnapshot(orgId)             dashboard.ts:161   [Promise.all de 6]
       ├─ getClients(orgId)
       ├─ getCurrentUser()
       ├─ getNotifications(orgId)        AUCUN limit  -> toute la table
       ├─ getUnreadCount(orgId)          head:true    <- le bon pattern
       ├─ getContentItems(orgId)         AUCUN limit  -> TOUT l'historique de l'org
       │    └─ hydrate()                 content.ts:171  [Promise.all de 3 loaders]
       │         ├─ loadTargets()        .in(item_ids)                 non borné
       │         ├─ loadContentMedia()   .in(item_ids) + .in(asset_ids) non bornés
       │         │     └─ createSignedUrls(TOUS les originaux du lot, TTL 1 h)
       │         └─ loadLabels()         2 requêtes, .in(item_ids)
       └─ getSocialAccounts(orgId)
  -> <CommandPalette contentItems={shell.contentItems} />   layout.tsx:54  (COMPOSANT CLIENT)
```

Trois faits structurants en découlent :

- **Le shell est le poste le plus lourd de l'app, sur toutes les routes.** `getShellSnapshot` parallélise correctement ses six lectures ([dashboard.ts:162-170](../../../apps/web/lib/data/dashboard.ts#L162)), mais l'une d'elles déclenche à elle seule jusqu'à six requêtes supplémentaires plus un appel batch Storage.
- **Le payload RSC transporte des données que personne n'affiche.** `shell.contentItems` part vers [command-palette.tsx](../../../apps/web/components/app/shell/command-palette.tsx) (`"use client"`) qui n'utilise que `id`, `title`, `caption`, `status`, `clientId` — mais l'objet sérialisé contient les cibles, les hashtags, les médias et **les URL signées des originaux**, y compris de contenus jamais approuvés (F04, F05).
- **Les pages enfants refont le même travail sous une autre clé de cache.** `cache()` de React ne déduplique que sur un tuple d'arguments identique : `getContentItems(orgId)` (shell) et `getContentItems(orgId, clientId)` (layout client, [layout.tsx:28](<../../../apps/web/app/(app)/clients/[clientId]/layout.tsx#L28>)) sont deux entrées distinctes. L'org est donc hydratée deux fois par chargement complet.

### 2. La façade `lib/data` : « charger tout, filtrer en mémoire »

`grep '.limit(|.range('` sur `apps/web/lib/data` ne renvoie que **trois** occurrences (toutes dans `pro.ts`). `getContentItems` ([content.ts:213-227](../../../apps/web/lib/data/content.ts#L213)), `getTrashedContent`, `getPortalContent`, `getLibraryAssets` ([pro.ts:239](../../../apps/web/lib/data/pro.ts#L239)), `getImportedPosts` et `getNotifications` n'ont ni `.range()`, ni `.limit()`, ni filtre de date. Deux conséquences se combinent :

- **PostgREST plafonne à `max_rows`** — `supabase/config.toml:8` déclare `max_rows = 1000` — et coupe **sans erreur** (F14). `getContentItems` trie `created_at ASC` ([content.ts:223](../../../apps/web/lib/data/content.ts#L223)) : la troncature mord donc sur les contenus **les plus récents**.
- **L'hydratation passe par des `.in(uuid[])` dérivés d'un SELECT non borné** ([content.ts:104](../../../apps/web/lib/data/content.ts#L104), [content-media.ts:103](../../../apps/web/lib/data/content-media.ts#L103)). supabase-js émet un GET avec les ids en query string ; postgrest-js embarque lui-même un `urlLengthLimit` de 8000 caractères et un hint explicite (« consider using an RPC function » pour plus de 200 ids). À ~39 caractères par uuid, la casse arrive vers 200 ids (F13).

Et dans les deux cas, l'échec est **muet** : le pattern de la façade est `const { data } = await ...` puis `data ?? []` (une trentaine d'occurrences dans `lib/data`, zéro lecture de `error`). Une panne de lecture est indistinguable d'un catalogue vide.

### 3. Le rendu client : grille et board studio

La grille de preview du feed et le board studio partagent la même architecture : **tout ce que le serveur renvoie est monté d'un coup, sans mémoïsation d'aucune sorte**.

- `grep useMemo|useCallback|memo(` sur `apps/web/components/app/grid` : **zéro occurrence**. `FeedGrid` recalcule à chaque rendu ~13 balayages de listes complètes ([feed-grid.tsx:74-113](../../../apps/web/components/app/grid/feed-grid.tsx#L74)), reconstruit `ctx`, `toolbarView` et `presentationTiles`, et sérialise tous les ids visibles en une chaîne triée pour servir de dépendance d'effet ([feed-grid.tsx:93](../../../apps/web/components/app/grid/feed-grid.tsx#L93)).
- `GridBoard` mappe `pinned`/`planned`/`published`/`imported` en entier ([grid-board.tsx:63-109](../../../apps/web/components/app/grid/grid-board.tsx#L63)), et **chaque tuile verrouillée enregistre un droppable dnd-kit** ([locked-grid-tile.tsx:30](../../../apps/web/components/app/grid/locked-grid-tile.tsx#L30)) — donc chaque `onDragStart` re-mesure tous les rects.
- Côté studio, `ContentCard` n'est pas `memo()` et reçoit quatre props recréées à chaque rendu ([content-board.tsx:185-197](../../../apps/web/components/app/studio/content-board.tsx#L185)) ; la recherche re-normalise en NFD toutes les légendes à chaque frappe, sans debounce ([board-toolbar.tsx:95](../../../apps/web/components/app/studio/board-toolbar.tsx#L95) → [board-utils.ts:23](../../../apps/web/components/app/studio/board-utils.ts#L23)).

### 4. Les mutations : fan-out de Server Actions

Toutes les actions de lot suivent le même schéma : `Promise.all(ids.map(uneServerAction))`. Or chaque `scheduleContentItem` exécute une vérification d'appartenance, un UPDATE, un `rpc('enqueue_publish_jobs')` puis **deux** `revalidatePath` ([content.ts:293-316](../../../apps/web/lib/actions/content.ts#L293)). Décaler 40 tuiles d'une semaine, c'est donc ~160 allers-retours Postgres et 80 invalidations de cache ([use-grid-tiles.ts:248](../../../apps/web/components/app/grid/use-grid-tiles.ts#L248)) — avec un rollback optimiste global si un seul appel échoue.

### 5. Le worker : la boucle de tick

```
tick()                          index.ts:52
  -> reapExpired()              pg-store.ts:78   (1 UPDATE, sans notion de propriétaire)
  -> claim()                    pg-store.ts:55   (FOR UPDATE SKIP LOCKED, limit 1)
  -> runOne()                   index.ts:34      (heartbeat setInterval + await processJob)
```

Le squelette est le bon (claim atomique, `SKIP LOCKED`, lease, reaper). Mais **aucune écriture ne referme le bail** : `extendLease`, `markPublishStarted`, `succeed` et `retryOrFail` ciblent toutes `where id = $1` ([pg-store.ts:94-181](../../../apps/worker/src/db/pg-store.ts#L94)) ; `worker_id` n'est jamais un prédicat, seulement une colonne écrite. Et le heartbeat se contente d'un `log.warn` quand il échoue ([index.ts:25-27](../../../apps/worker/src/index.ts#L25)) : un worker ne peut structurellement pas savoir qu'il a perdu son bail. C'est F03.

### 6. Les frontières mal câblées

Trois points de contact avec le monde extérieur sont configurés pour la maquette, pas pour la production : `next/image` n'autorise qu'un hôte de stock photos (F02), les dictionnaires i18n FR **et** EN sont aplatis au module scope dans un composant client monté à la racine ([layout.tsx:49](../../../apps/web/app/layout.tsx#L49), F18), et le flux OAuth accepte un `state` sans TTL ni cookie apparié ([callback/route.ts:34](<../../../apps/web/app/api/oauth/[provider]/callback/route.ts#L34>), F10).

---

## Findings (triés par sévérité P0 → P3)

> Aucun finding P0 n'a survécu à la réfutation sur cette dimension. Deux findings initialement proposés en P0 (F01, F03) ont été ramenés à **P1** : ils ne relèvent d'aucune des trois classes P0 de cet audit (clé d'API en dur, token OAuth atteignable côté client, fuite inter-tenant). Ils restent **bloquants** pour un usage réel.

### [P1] Le composer d'édition SUPPRIME tous les médias du contenu à l'enregistrement — go-live : bloquant

- **Où** : [apps/web/components/app/studio/composer/composer-types.ts:153](../../../apps/web/components/app/studio/composer/composer-types.ts#L153)
- **Constat** : `draftFromContent()` reconstruit les `ComposerMedia` depuis `content.media` mais n'écrit **jamais** `libraryAssetId` — les champs mappés sont `id`, `type`, `thumbUrl`, `fullUrl`, `width`, `height`, `durationSec`, `fileSizeMb`, `mimeType`, `altText` ([composer-types.ts:151-164](../../../apps/web/components/app/studio/composer/composer-types.ts#L151)). Or `handleSave()` ne persiste QUE les médias porteurs d'un `libraryAssetId` : `draft.media.flatMap(m => m.libraryAssetId ? [...] : [])` ([composer-screen.tsx:144-148](../../../apps/web/components/app/studio/composer/composer-screen.tsx#L144)). Un grep confirme que `libraryAssetId` n'est posé QUE par `mediaFromLibrary` (ligne 86), c'est-à-dire par le picker. Le payload part donc avec `media: []`, et `reconcileMedia()` fait un `DELETE FROM content_media WHERE content_item_id = ...` puis un `return` anticipé sans rien réinsérer ([content.ts:219-220](../../../apps/web/lib/actions/content.ts#L219)). Le gate `RECONCILABLE_STATUSES` ([content.ts:71](../../../apps/web/lib/actions/content.ts#L71)) inclut `draft` et `changes_requested`, et la page d'édition ne passe en lecture seule que pour `publishing`/`published`/`partially_published` ([edit/page.tsx:29](<../../../apps/web/app/(app)/clients/[clientId]/content/[contentId]/edit/page.tsx#L29>)) : le chemin d'édition quotidien est exactement le chemin destructeur. L'information nécessaire au correctif est déjà présente — `MediaAsset.id` EST l'id de `media_assets` ([content-media.ts:118](../../../apps/web/lib/data/content-media.ts#L118)) — elle n'est simplement pas recopiée.
- **Scénario d'échec / coût à l'échelle** : Étienne ouvre un post client en `draft` ou `changes_requested` pour corriger une faute dans la légende, clique « Enregistrer ». Les lignes `content_media` sont supprimées : ordre, `alt_text_override` et `crop_preset` avec. Le post repart en validation sans image, la grille affiche une tuile de repli, et s'il est reprogrammé le worker publiera (ou fera échouer) un contenu sans média. Le toast « N médias ignorés » s'affiche **après** la suppression. Aucun garde-fou à aucune couche : le trigger de cardinalité de [012_media.sql:263-265](../../../supabase/migrations/012_media.sql#L263) est `after insert/update` et sort à `count = 0`, et le soft-delete n'existe que sur `content_items` ([content.ts:363](../../../apps/web/lib/actions/content.ts#L363)).
- **Pourquoi ça bloque le scaling** : le préjudice croît avec le volume — chaque édition d'un contenu existant détruit ses liaisons médias, sans que le serveur puisse le détecter (la Server Action est parfaitement « ok »). À l'ouverture SaaS, c'est une destruction systématique de travail client, silencieuse.
- **Nuance de la réfutation** : la perte n'est **pas** irrécupérable — `media_assets` et les fichiers Storage survivent, seules les liaisons meurent ; la réparation consiste à re-sélectionner les médias dans la médiathèque. Par ailleurs `recordUploadedAsset` ([media.ts:37](../../../apps/web/lib/actions/media.ts#L37)) n'a aujourd'hui aucun appelant : le bug est **inerte tant que l'upload TUS n'est pas câblé**. Comme l'upload est lui-même un prérequis go-live, la destruction se déclenchera dès le premier jour d'usage réel.
- **Reco** : ajouter `libraryAssetId: m.id` (et `crop: m.cropPreset` s'il est exposé) au mapping de `draftFromContent`. Filet côté serveur : dans `reconcileMedia`, refuser un `media: []` sur un contenu qui en avait, ou exiger un flag explicite `mediaTouched`, plutôt que de supprimer en silence. Ajouter un test qui charge un `ContentItem` à 3 médias, re-sérialise le draft et vérifie que le payload en contient 3.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 27 (Server Action Zod : payload valide mais sémantiquement destructeur), 20-22 (médias)

### [P1] `next/image` : l'hôte Supabase Storage n'est pas dans `remotePatterns` — aucune vignette réelle ne s'affichera — go-live : bloquant

- **Où** : [apps/web/next.config.ts:14](../../../apps/web/next.config.ts#L14)
- **Constat** : `images.remotePatterns` n'autorise que `images.pexels.com`. Or 100 % des vignettes réelles sont des URL absolues Supabase Storage — `getPublicUrl(THUMBS_BUCKET, …)` produit `https://<ref>.supabase.co/storage/v1/object/public/media-thumbs/…` ([content-media.ts:50](../../../apps/web/lib/data/content-media.ts#L50), hôte confirmé dans `apps/web/.env.local.example`) — ou des URL CDN Instagram pour les posts importés ([pro.ts:580](../../../apps/web/lib/data/pro.ts#L580)). Elles sont rendues par `<Image src={media.thumbUrl}>` dans [media-thumb.tsx:36](../../../apps/web/components/shared/media-thumb.tsx#L36) (appelé par [grid-tile.tsx:80](../../../apps/web/components/app/grid/grid-tile.tsx#L80) et [content-card.tsx:105](../../../apps/web/components/app/studio/content-card.tsx#L105)), [reels-tab.tsx:30](../../../apps/web/components/app/grid/reels-tab.tsx#L30), [presentation-mode.tsx:21](../../../apps/web/components/app/grid/presentation-mode.tsx#L21), le carrousel du portail et la médiathèque — 17 points d'appel au total, aucun `unoptimized`, aucun loader custom. Vérifié sur le build présent : `.next/images-manifest.json` ne contient qu'un seul pattern.
- **Scénario d'échec / coût à l'échelle** : dès le premier média uploadé ou le premier post importé, l'ouverture de `/clients/<id>/grid`, du board studio, de la médiathèque et du **portail de validation** affiche des images cassées partout. `MediaThumb` intercepte via `onError` et dégrade en icône ; `reels-tab` et `presentation-mode` n'ont aucun repli et laissent des tuiles vides. Le client à qui l'on demande d'approuver un contenu ne voit pas le contenu.
- **Pourquoi ça bloque le scaling** : même corrigé, chaque vignette transite par `/_next/image` sur le VPS Coolify. Une grille de 500 tuiles = 500 optimisations `sharp` sur un seul VPS, pour des vignettes **déjà** générées en WebP ~400 px côté client (règle 20). CPU et cache disque saturent avant le trafic réel.
- **Nuance de la réfutation** : le mécanisme n'est **pas** un crash. Dans le paquet installé (`node_modules/next/dist/shared/lib/image-loader.js`), le `throw` « hostname is not configured » est imbriqué dans `if (process.env.NODE_ENV !== 'production')` ; le `Dockerfile:24` pose `NODE_ENV=production`. En prod le loader émet `/_next/image?url=…` et l'optimiseur répond **HTTP 400** (`"url" parameter is not allowed`). Le crash avec error boundary n'existe qu'en `next dev` — donc visible dès le premier test local, ce qui est une chance. La sous-affirmation « `<Image src="">` lève » est également fausse : `get-img-props.js:270` bascule en `unoptimized`.
- **Reco** : ajouter l'hôte du projet Supabase — idéalement dérivé de `NEXT_PUBLIC_SUPABASE_URL` pour ne pas casser au changement de projet — avec `pathname: "/storage/v1/object/public/**"`, plus `scontent*.cdninstagram.com`. Puis passer les vignettes `media-thumbs` en `unoptimized` (ou loader passthrough) : elles sont déjà à la bonne taille, la ré-optimisation est du CPU pur perdu. Ajouter un smoke test rendant une tuile avec une URL Supabase.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 20 (media-thumbs public)

### [P1] Aucune clôture de bail (fencing) : un worker qui a perdu son lease continue d'écrire et de publier — go-live : bloquant

- **Où** : [apps/worker/src/db/pg-store.ts:98](../../../apps/worker/src/db/pg-store.ts#L98)
- **Constat** : toutes les écritures du store ciblent `where id = $1` sans jamais vérifier `worker_id = $moi` ni `lease_expires_at > now()` — `extendLease` ([94-101](../../../apps/worker/src/db/pg-store.ts#L94)), `markPublishStarted` (116-133), `succeed` (146-164), `retryOrFail` (173-181). L'interface `JobStore` ne transporte même pas de `workerId` : le fencing est absent **par construction**. Le reaper ([78-92](../../../apps/worker/src/db/pg-store.ts#L78)) ne filtre que sur le statut et l'expiration, sans savoir si le détenteur est vivant. Le heartbeat se contente d'un `log.warn` et ne lit pas `rowCount` ([index.ts:25-27](../../../apps/worker/src/index.ts#L25)) : un bail volé renvoie « succès » silencieux. Aucun garde-fou en base : `020_publish_jobs.sql` n'a que deux `check` et un trigger `updated_at`. **Le dépôt se contredit lui-même** : le standard interne [docs/superpowers/tickets/lot-5/10-worker-queue.md:84](../../../docs/superpowers/tickets/lot-5/10-worker-queue.md#L84) impose `and worker_id = $2` avec la justification exacte « sinon deux workers exécutent le même run en parallèle ». La garde existe dans la doc du projet, pas dans le worker livré.
- **Scénario d'échec / coût à l'échelle** : coupure Supabase/Supavisor > 2 min (maintenance, failover) pendant qu'un job est en cours. Le heartbeat échoue silencieusement, le bail expire. Un **second** process (2ᵉ réplica Coolify, recouvrement de rolling deploy, ou worker local branché sur le `DATABASE_URL` de prod) exécute `reapExpired`, remet le job en `retrying`, le claim, et — si le premier n'a pas encore atteint `markPublishStarted` — passe par `publishFresh` ([engine.ts:110-126](../../../apps/worker/src/engine.ts#L110)), crée son propre conteneur et poste. Pendant ce temps le premier flux, toujours vivant, poste aussi. **Double publication chez un vrai client**, exactement ce que la règle 15 doit interdire. Ni `recoverStartedJob` (qui ne traite que le crash-puis-reclaim séquentiel) ni l'index unique partiel de la règle 16 (qui empêche des *jobs* dupliqués, pas des *exécutions* dupliquées) ne couvrent ce cas.
- **Pourquoi ça bloque le scaling** : le risque croît linéairement avec le nombre de réplicas worker et avec la durée des jobs (upload TikTok chunké = plusieurs minutes sous bail). Aujourd'hui masqué parce que les publishers sont des stubs sans réseau ; le jour où un POST réel est branché, le trou devient une double publication observable par le client.
- **Nuance de la réfutation** : deux sous-affirmations sont fausses et ont été retirées. (a) Le **même** process ne peut pas reaper son propre job en vol : `tick()` appelle `reapExpired()` une fois en tête puis `await runOne(...)` séquentiellement ([index.ts:52-66](../../../apps/worker/src/index.ts#L52)) — la précondition est ≥ 2 process vivants. (b) Republier un conteneur IG `FINISHED` (prêt, non publié) est le comportement **correct** ; l'absence d'état `ready` dans `ContainerStatus` ([publishers/types.ts:11](../../../apps/worker/src/publishers/types.ts#L11)) est une dette de modélisation pour le futur publisher réel, pas le vecteur de double post.
- **Reco** : ajouter un prédicat de fencing à toutes les écritures (`and worker_id = $workerId and lease_expires_at > now()`), et traiter `rowCount = 0` comme un `LeaseLostError` qui abandonne le job **sans écrire**. Faire échouer le job (pas un `warn`) quand `extendLease` renvoie 0 ligne. Étendre `ContainerStatus` avec `ready` et ne republier que sur `error`/`expired`. Ce correctif doit atterrir **en même temps** que les publishers réels.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 15, 17

### [P1] Le shell rehydrate TOUT le contenu de l'org et le sérialise vers le navigateur — go-live : dégradé

- **Où** : [apps/web/lib/data/dashboard.ts:168](../../../apps/web/lib/data/dashboard.ts#L168), consommé par [app/(app)/layout.tsx:21](<../../../apps/web/app/(app)/layout.tsx#L21>)
- **Constat** : `getShellSnapshot` appelle `getContentItems(orgId)` **sans clientId, sans fenêtre, sans limite**, et il est invoqué dans le layout racine du groupe `(app)` — donc sur toutes les pages de l'app. Un appel = 1 requête `content_items` + hydratation complète (`content_targets`, `content_media`, `media_assets`, `content_item_labels`, `content_labels`) + 1 appel Storage `createSignedUrls` ([content-media.ts:107](../../../apps/web/lib/data/content-media.ts#L107)). Le tableau hydraté complet part ensuite dans le payload RSC vers `CommandPalette` ([layout.tsx:52-56](<../../../apps/web/app/(app)/layout.tsx#L52>)), composant `"use client"` qui n'utilise que `id`, `clientId`, `title`, `caption`, `status`. Aucun `<Suspense>` dans tout `app/**` hors [settings/accounts/page.tsx:42](<../../../apps/web/app/(app)/settings/accounts/page.tsx#L42>) : rien ne s'affiche tant que ce chargement n'est pas terminé. En prime, les layouts enfants rappellent `getContentItems(orgId, clientId)` — clé `cache()` différente, donc l'org est hydratée **deux fois** par chargement.
- **Scénario d'échec / coût à l'échelle** : 10 clients × 18 posts/mois × 12 mois ≈ 2 200 contenus. Chaque chargement à froid déclenche 6 requêtes rapatriant ~2 200 lignes plus ~4 000 lignes filles, signe ~3 000 URL Storage, puis pousse plusieurs Mo de JSON dans le payload de la page. Le TTFB passe de ~200 ms à plusieurs secondes sur TOUTES les routes, y compris sur l'iPhone d'Étienne (cible PWA prioritaire). Le coût est repayé à chaque `router.refresh()` et après chaque `revalidatePath('/', 'layout')` ([(auth)/actions.ts:48](<../../../apps/web/app/(auth)/actions.ts#L48>)).
- **Pourquoi ça bloque le scaling** : coût O(contenu total de l'org) **par page vue**, strictement croissant, sans plafond ni dégressivité. La 500ᵉ page vue coûte dix fois la 50ᵉ.
- **Nuance de la réfutation** : sur une navigation *soft* entre deux enfants du même layout, Next peut ne pas re-rendre le layout partagé — « à chaque clic » surestime la fréquence. Le coût reste payé sur tout chargement complet, refresh, `router.refresh()` et revalidation de layout.
- **Reco** : réduire le snapshot à ce que le shell affiche réellement — requête dédiée `select('id, client_id, title, caption, status')`, sans hydratation médias/cibles, `.limit(200)` sur `created_at desc`. Déplacer la recherche globale de la palette vers une Server Action (`ilike`/`textSearch` + limit) déclenchée à l'ouverture, au lieu de précharger l'intégralité du catalogue sur chaque page. Envelopper les blocs du shell dans `<Suspense>`.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune (mais r26 « Client minimal » en esprit)

### [P1] URL signées des ORIGINAUX générées et envoyées au navigateur pour toutes les listes — go-live : dégradé

- **Où** : [apps/web/lib/data/content-media.ts:107](../../../apps/web/lib/data/content-media.ts#L107)
- **Constat** : `loadContentMedia` appelle `makeMediaUrlResolver` sur TOUS les `storage_path` du lot, ce qui déclenche un `createSignedUrls` sur tous les originaux (TTL 1 h, [content-media.ts:35-47](../../../apps/web/lib/data/content-media.ts#L35)), y compris pour la grille, le calendrier, le board et la palette de commandes — qui n'utilisent **aucun** `fullUrl` (vérifié : `grid-tile.tsx`, `grid-visibility.ts:62-66`, `presentation-mode.tsx`, `reels-tab.tsx`, `calendar-types.ts:21`, `content-board.tsx:46` ne lisent que `thumbUrl`/`coverUrl`). Le champ `fullUrl` est posé sur chaque `MediaAsset` ([content-media.ts:125](../../../apps/web/lib/data/content-media.ts#L125)) et part dans le payload RSC de chaque page, notamment vers `CommandPalette` qui est un composant client.
- **Scénario d'échec / coût à l'échelle** : grille d'un client à 300 posts = 1 appel Storage signant 300+ chemins (HMAC + latence) à chaque rendu, et ~300 URL signées d'originaux **privés** injectées dans le HTML, là où aucune n'est affichée. Toute extension de navigateur, tout cache proxy, toute capture du DOM récupère un accès direct d'une heure aux fichiers sources de tous les contenus listés — y compris ceux non encore approuvés par le client.
- **Pourquoi ça bloque le scaling** : le coût de signature croît avec le nombre de médias affichés par page, et la surface d'exposition croît avec le catalogue.
- **Nuance de la réfutation** : ce n'est **pas** une fuite inter-tenant — les URL ne couvrent que des médias déjà passés par la RLS de l'appelant. Et comme TUS n'est pas câblé, `storage_path` est aujourd'hui null partout : le batch de signature est vide. Le chemin se déclenche dès qu'un média réel existe. Le TTL de 1 h est une déviation UI assumée par rapport aux 48 h de la règle 20 (qui concerne le worker à la publication).
- **Reco** : passer un flag à `loadContentMedia` (`withOriginals: false` par défaut) ; ne signer que sur les vues qui affichent réellement l'original (studio, lightbox, portail plein écran), idéalement à la demande via Server Action au clic. Les listes se contentent de `thumbUrl` (bucket public).
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 20

### [P1] `getLibraryAssets` recharge et signe la médiathèque entière — sur le chemin d'édition le plus fréquent — go-live : dégradé

- **Où** : [apps/web/lib/data/pro.ts:239](../../../apps/web/lib/data/pro.ts#L239)
- **Constat** : la fonction lit tous les `media_assets` non supprimés du client **sans limite** ([pro.ts:239-247](../../../apps/web/lib/data/pro.ts#L239)), puis TOUS les `content_media` du client pour dériver `usedInContentIds` ([253-257](../../../apps/web/lib/data/pro.ts#L253)), puis signe TOUS les originaux en batch ([270-279](../../../apps/web/lib/data/pro.ts#L270)). Elle est appelée par la médiathèque ([library/page.tsx:28](<../../../apps/web/app/(app)/clients/[clientId]/library/page.tsx#L28>)) mais aussi par les **deux** pages studio : [content/new/page.tsx:78](<../../../apps/web/app/(app)/clients/[clientId]/content/new/page.tsx#L78>) et [content/[contentId]/edit/page.tsx:76](<../../../apps/web/app/(app)/clients/[clientId]/content/[contentId]/edit/page.tsx#L76>).
- **Scénario d'échec / coût à l'échelle** : un client actif depuis 2 ans à 3 uploads/jour ≈ 2 000 assets. Chaque ouverture de l'éditeur de contenu — l'action la plus fréquente du produit — rapatrie 2 000 lignes `media_assets` plus toutes les liaisons `content_media` du client, et signe 2 000 URL avant le premier octet de HTML. Aggravant : `ComposerScreen` et `LibraryWorkspace` sont des composants clients, donc tout le tableau (URL signées incluses) part aussi dans le payload RSC.
- **Pourquoi ça bloque le scaling** : le stock de médias est ce qui croît le plus vite et ne décroît jamais (aucune purge côté lecture). Le coût d'ouverture du studio augmente donc mécaniquement chaque mois. Et au-delà de 1 000 assets, `max_rows` transforme la lecture non bornée en **troncature silencieuse de la médiathèque**.
- **Reco** : paginer (`.range`) sur `created_at desc` ; dériver `usedInContentIds` par une agrégation dédiée (ou à la demande sur l'asset survolé) ; ne signer les originaux qu'à l'ouverture de la lightbox (cf. finding précédent). Le picker du studio doit charger 60 assets et paginer au scroll.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

### [P1] `/clients` : N+1 d'hydratation complète (médias + URL signées) pour afficher 3 compteurs par client — go-live : dégradé

- **Où** : [apps/web/app/(app)/clients/page.tsx:19](<../../../apps/web/app/(app)/clients/page.tsx#L19>) et [:36](<../../../apps/web/app/(app)/clients/page.tsx#L36>)
- **Constat** : `clientStats()` appelle `getContentItems(orgId, clientId)` pour CHAQUE client — donc l'hydratation complète (cibles + `content_media` + `media_assets` + labels + signature Storage) — pour n'en tirer que trois `.filter().length` ([page.tsx:18-27](<../../../apps/web/app/(app)/clients/page.tsx#L18>)). Juste après, `getSocialAccounts(orgId, clientId)` est refait par client ([page.tsx:39-45](<../../../apps/web/app/(app)/clients/page.tsx#L39>)) alors que `getSocialAccounts(orgId)` renvoie déjà tout l'org en une requête ([clients.ts:109-131](../../../apps/web/lib/data/clients.ts#L109)) — et a déjà été chargé par le shell juste avant, sous une clé de cache différente. La façade `lib/data` n'expose aucune lecture d'agrégat ([index.ts:15-53](../../../apps/web/lib/data/index.ts#L15)).
- **Scénario d'échec / coût à l'échelle** : 12 clients = 12 × (1 requête items + 1 cibles + 2 requêtes médias + 2 labels) + 12 batchs de signature ≈ 80 allers-retours réseau, pour afficher 36 nombres et quelques icônes de plateformes. La page `/clients` devient la plus lente du produit alors qu'elle est la porte d'entrée quotidienne.
- **Pourquoi ça bloque le scaling** : coût O(clients × contenus par client), avec un facteur constant très lourd (signature Storage). Doubler le portefeuille quadruple le coût de la page.
- **Reco** : ajouter dans `lib/data` un `getContentCountsByClient(orgId)` — une seule requête `select('client_id, status')` sur `content_items` (ou une RPC `count(*) group by client_id, status`), agrégation en mémoire. Remplacer la boucle `getSocialAccounts` par un unique `getSocialAccounts(orgId)` groupé par `clientId` côté page.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

### [P1] Les actions de lot déclenchent N Server Actions, chacune avec auth + update + RPC + 2 `revalidatePath` — go-live : dégradé

- **Où** : [apps/web/components/app/grid/use-grid-tiles.ts:248](../../../apps/web/components/app/grid/use-grid-tiles.ts#L248)
- **Constat** : `batchShiftWeek` fait `Promise.all(targets.map(t => scheduleContentItem(...)))` ; même pattern pour `applyPending` ([157](../../../apps/web/components/app/grid/use-grid-tiles.ts#L157)), `batchSendReview` (268), `batchCancel` (290), et côté studio pour `archiveBatch`/`cancelBatch`/`scheduleBatchCommit`/`sendReviewRequest` ([board-state.ts:235, 256, 273, 302](../../../apps/web/components/app/studio/board-state.ts#L235)). Or chaque `scheduleContentItem` ([content.ts:293-316](../../../apps/web/lib/actions/content.ts#L293)) exécute `requireClientInOrg` (getActiveOrg + SELECT clients), un UPDATE, un `rpc('enqueue_publish_jobs')`, puis DEUX `revalidatePath` — soit ≥ 4 allers-retours par id. `scheduleBatchCommit` chaîne même deux actions par id.
- **Scénario d'échec / coût à l'échelle** : décaler d'une semaine une sélection de 40 tuiles = 40 invocations → ~160 allers-retours Postgres, 80 invalidations de cache et 40 recalculs serveur de l'arbre RSC de la page grille (elle-même non bornée, cf. F21). Plusieurs secondes de spinner. **Pire** : si une seule échoue, `commit(prev)` annule visuellement TOUT alors que la base a déjà validé les autres, et la branche d'échec n'appelle **pas** `router.refresh()` ([use-grid-tiles.ts:251-255](../../../apps/web/components/app/grid/use-grid-tiles.ts#L251)) — l'écran ment jusqu'au prochain refresh manuel.
- **Pourquoi ça bloque le scaling** : le fan-out est linéaire dans la taille de la sélection, sans plafond de concurrence, et la sélection multiple est justement la fonctionnalité qui rend le lot utile quand le volume monte.
- **Nuance de la réfutation** : Next sérialise les invocations de Server Actions côté routeur — « parallèles » décrit le site d'appel, pas l'exécution. La conséquence réelle est donc N latences **cumulées** (spinner) plutôt qu'une saturation du pooler.
- **Reco** : créer des Server Actions **de lot** (un seul appel avec `contentIds: string[]`) faisant un update ensembliste (`.in('id', ids)`) sous une seule vérification d'appartenance, un seul `enqueue_publish_jobs` par lot et un seul `revalidatePath` en fin. Renvoyer la liste des ids en échec pour un rollback partiel exact au lieu d'un rollback global.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 7 (filtre `org_id` explicite à conserver dans la version ensembliste), 27

### [P1] Le reaper abandonne définitivement les jobs à bout de tentatives : cible impubliable pour toujours — go-live : dégradé

- **Où** : [apps/worker/src/db/pg-store.ts:89](../../../apps/worker/src/db/pg-store.ts#L89)
- **Constat** : `reapExpired` est une UPDATE unique filtrée `and attempts < max_attempts`, sans branche alternative. Un job en `claimed`/`publishing` dont le bail a expiré alors que `attempts` a déjà atteint `max_attempts` reste bloqué dans ce statut **pour toujours** : le claim ne prend que `scheduled`/`retrying`/`awaiting_media` ([pg-store.ts:62](../../../apps/worker/src/db/pg-store.ts#L62)), donc plus personne ne le regarde. Le commentaire de la ligne 81 renvoie au « watchdog pg_cron (indépendant, §5) » : **ce watchdog n'existe pas** — aucun répertoire `supabase/functions`, aucun `cron.schedule` dans `supabase/migrations` ni dans `deploy/`. Et l'index unique partiel `publish_jobs_active_target_idx` ([020_publish_jobs.sql:115-117](../../../supabase/migrations/020_publish_jobs.sql#L115)) couvre `claimed` et `publishing` : la cible ne peut plus jamais recevoir un nouveau job.
- **Scénario d'échec / coût à l'échelle** : un job ayant consommé ses 5 tentatives (crashs successifs, redeploys pendant l'exécution) subit un dernier crash → la ligne reste `claimed` ad vitam. Étienne reprogramme le post depuis l'app : `enqueue_publish_jobs` ([020:196](../../../supabase/migrations/020_publish_jobs.sql#L196)) fait `on conflict do update set run_at` sur ce zombie, retourne 1, l'UI affiche « programmé »… et rien ne partira jamais. Aucun email, aucune alerte. Aggravant : `cancel_publish_jobs` ne touche que `scheduled`/`retrying` avec `publish_started_at` null — aucune issue côté app non plus — et [content-status.ts:96](../../../apps/web/lib/actions/content-status.ts#L96) ignore la valeur de retour du RPC.
- **Pourquoi ça bloque le scaling** : un zombie par cible cassée, accumulé pour toujours, et chaque zombie condamne définitivement sa cible. En multi-org ces lignes deviennent aussi du bruit permanent dans l'index actif utilisé par le claim.
- **Nuance de la réfutation** : `attempts` ne peut atteindre `max_attempts` que via le reaper (`retryOrFail` bascule en `failed` dès `attempts + 1 >= max`), donc le zombie exige ~5 expirations de bail puis un dernier crash. Rare — mais l'état résultant est définitif et silencieux.
- **Reco** : ajouter dans `reapExpired` une seconde requête (ou un `CASE`) : les jobs `claimed`/`publishing` à bail expiré ET `attempts >= max_attempts` passent en `dead_letter` + `failed_at` + `last_error = 'lease_expired_max_attempts'`, avec mise à jour de `content_targets`. Tant que le watchdog pg_cron n'existe pas, c'est le seul filet.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 17, 18

### [P1] State OAuth sans TTL ni liaison au navigateur : greffe d'un compte social dans l'org d'un tiers — go-live : dégradé

- **Où** : [apps/web/app/api/oauth/[provider]/callback/route.ts:34](<../../../apps/web/app/api/oauth/[provider]/callback/route.ts#L34>)
- **Constat** : le callback ne vérifie QUE la signature HMAC du state et l'égalité du provider, puis fait entièrement autorité sur `state.orgId` / `state.userId` / `state.clientId` pour `persistConnection` ([lignes 53-58](<../../../apps/web/app/api/oauth/[provider]/callback/route.ts#L53>)). Aucun contrôle de session à cet endroit — la route est publique ([proxy.ts:20](../../../apps/web/proxy.ts#L20)) — et le state ne porte ni `iat`/`exp` ni cookie apparié : `signState` ajoute un nonce qui n'est **jamais mémorisé ni rejoué** côté serveur ([state.ts:33-37](../../../apps/web/lib/oauth/state.ts#L33)), et la route de démarrage ne pose aucun cookie. `persistConnection` écrit en service role ([tokens.ts:54](../../../apps/web/lib/oauth/tokens.ts#L54)), donc sans re-validation d'appartenance et hors RLS. Aggravant : le payload est du base64url JSON **en clair**, donc `codeVerifier` est lisible et PKCE ne bloque pas le rejeu.
- **Scénario d'échec / coût à l'échelle** : un state capté (historique du navigateur, en-tête `Referer`, logs du provider, lien recopié) reste valable indéfiniment. L'attaquant relance le flow chez Meta avec notre `client_id`, notre `redirect_uri` et le state de la victime : le callback persiste le compte Instagram **de l'attaquant** sur le client de la victime. Les publications programmées de ce client partent ensuite chez l'attaquant, médias inclus. Variante miroir : state signé par l'attaquant + consentement de la victime chez Meta = tokens de la victime dans l'org de l'attaquant.
- **Pourquoi ça bloque le scaling** : à l'ouverture SaaS, n'importe quel utilisateur inscrit peut greffer un compte dans l'org d'un autre freelance. La faille devient systémique et invisible côté RLS.
- **Nuance de la réfutation** : obtenir un state signé exige aujourd'hui une session owner (`getActiveOrg` au démarrage du flow) ou la capture d'un state. En phase solo (une org, un user, pas de signup public), cela n'empêche pas l'usage réel — c'est un risque à fermer **avant tout deuxième utilisateur**.
- **Reco** : ajouter `exp` (5-10 min) dans le state ; poser un cookie httpOnly contenant le nonce au démarrage (`/api/oauth/[provider]`) et exiger l'égalité au callback ; vérifier en plus que la session courante correspond à `state.userId` avant `persistConnection`.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 13

### [P1] L'invitation reviewer est un GET mutant : les scanners d'email consomment le token avant le client — go-live : dégradé

- **Où** : [apps/web/app/api/invitations/accept/route.ts:24](../../../apps/web/app/api/invitations/accept/route.ts#L24)
- **Constat** : le handler GET crée l'utilisateur auth, upsert `client_members`, marque l'invitation `accepted` ([lignes 55-88](../../../apps/web/app/api/invitations/accept/route.ts#L55)) puis redirige vers un `action_link` magiclink **à usage unique** ([92-98](../../../apps/web/app/api/invitations/accept/route.ts#L92)). Route publique ([proxy.ts:20](../../../apps/web/proxy.ts#L20)), et le lien est réellement envoyé par email avec le token en clair ([collaboration.ts:325-330](../../../apps/web/lib/actions/collaboration.ts#L325)).
- **Scénario d'échec / coût à l'échelle** : Outlook Safe Links, les proxys d'images, les antivirus d'entreprise et le prefetch navigateur ouvrent le lien AVANT le reviewer. L'invitation passe à `accepted_at` et le magiclink est brûlé ; quand le vrai reviewer clique, le contrôle des [lignes 44-51](../../../apps/web/app/api/invitations/accept/route.ts#L44) échoue et il atterrit sur `/login?error=invite`. Le freelance est convaincu d'avoir invité son client, le client ne peut pas entrer, et personne ne comprend pourquoi.
- **Pourquoi ça bloque le scaling** : la majorité des clients B2B ont un scanner de liens — le scénario devient le cas nominal à mesure que la base grandit. C'est aussi le **premier contact du CLIENT** avec le produit.
- **Nuance de la réfutation** : brûler le magiclink suppose que le scanner suive la redirection, mais `accepted_at` seul suffit à casser le parcours. L'index unique partiel (prédicat `accepted_at is null`, [06_migration_013.sql:307-309](../../../deploy/06_migration_013.sql#L307)) permet de réinviter après coup — d'où « dégradé » et non « bloquant ».
- **Reco** : découper — GET = page d'atterrissage **idempotente** qui n'écrit rien (elle valide le token et affiche « Accéder à mon espace »), POST = mutation + connexion. Le token reste valide tant que la mutation n'a pas eu lieu.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

### [P1] Portail : cast `as Client` sur un tableau potentiellement vide → 500 au lieu d'un message — go-live : dégradé

- **Où** : [apps/web/app/(portal)/portal/page.tsx:21](<../../../apps/web/app/(portal)/portal/page.tsx#L21>)
- **Constat** : `const client = ctx.clients[0] as Client` puis `const tz = client.timezone` ligne 23, avant tout autre fetch. `getReviewerContext()` renvoie `clients: []` dès que l'utilisateur n'a aucune ligne `client_members` ([org-context.ts:129-133](../../../apps/web/lib/auth/org-context.ts#L129)), et aucune migration n'insère l'owner dans `client_members`. Le layout gère le cas (`ctx.clients[0] ?? null`, [(portal)/layout.tsx:12](<../../../apps/web/app/(portal)/layout.tsx#L12>)) ; la page non. Le proxy laisse passer : il n'exige qu'une session, pas une appartenance ([proxy.ts:52-60](../../../apps/web/proxy.ts#L52)).
- **Scénario d'échec / coût à l'échelle** : Étienne (owner, aucune ligne `client_members`) ouvre `/portal` pour tester un lien d'email → `TypeError: Cannot read properties of undefined (reading 'timezone')` → écran d'erreur. Même chose pour un reviewer dont l'accès vient d'être révoqué : au lieu d'un « vous n'avez plus accès », il reçoit un crash.
- **Pourquoi ça bloque le scaling** : chaque révocation d'accès produit un incident au lieu d'une sortie propre, et le volume de reviewers révoqués ne fait que croître.
- **Nuance de la réfutation** : `tsconfig` n'active pas `noUncheckedIndexedAccess`, donc le cast `as Client` est **redondant** plutôt que masquant — détail de raisonnement, le TypeError au runtime reste factuel.
- **Reco** : `if (ctx.clients.length === 0) redirect("/login?error=no_access")` (ou un `EmptyState` dédié) avant toute lecture, et supprimer le cast.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 6

### [P1] Hydratation par `.in(uuid[])` non borné : GET à 40 Ko de querystring → 414 silencieux — go-live : après

- **Où** : [apps/web/lib/data/content.ts:104](../../../apps/web/lib/data/content.ts#L104)
- **Constat** : toutes les hydratations passent des listes d'uuid dérivées d'un SELECT non borné dans un `.in()` — `loadTargets` ([content.ts:104](../../../apps/web/lib/data/content.ts#L104)), `loadLabels` (134), `loadContentMedia` ([content-media.ts:91/103](../../../apps/web/lib/data/content-media.ts#L91)), `getPostMetricsBatch` ([pro.ts:680](../../../apps/web/lib/data/pro.ts#L680)) où `refIds` = tous les contenus + tous les posts importés du client ([perf-data.ts:209-210](../../../apps/web/components/app/performance/perf-data.ts#L209)). postgrest-js émet un **GET** avec `url.searchParams.append(column, 'in.(...)')` et porte lui-même un `urlLengthLimit` de 8000 caractères, plus un hint explicite recommandant une RPC au-delà de ~200 ids. Et chaque appel fait `const { data } = await ...` puis `data ?? []` : `error` n'est jamais lu ni loggé.
- **Scénario d'échec / coût à l'échelle** : à ~39 caractères par uuid, le GET de `loadTargets` franchit la limite vers 200 contenus (et non 700-1000 comme initialement estimé). La gateway répond 414/400, `data` vaut null, le code retourne une Map vide. Résultat : toutes les pages affichent des contenus **sans cibles ni médias**, sur toutes les routes en même temps, et rien n'apparaît dans Sentry.
- **Pourquoi ça bloque le scaling** : le seuil est atteint d'un coup, sans dégradation progressive annonciatrice, et touche toutes les orgs qui franchissent le même volume.
- **Nuance de la réfutation** : « le shell casse » est inexact — `data ?? []` ne throw pas, `hydrate` rend les items avec cibles/médias vides. C'est une **dégradation silencieuse**, pas un crash, ce qui est pire pour le diagnostic.
- **Reco** : (a) hydrater en une requête via jointure PostgREST imbriquée (`content_items?select=…,content_targets(*),content_media(*,media_assets(*))`) ou une RPC `get_content_items(p_org, p_client, p_from, p_to)` — plus aucune liste d'ids dans l'URL ; (b) à défaut, chunker chaque `.in()` par 200 ids ; (c) dans tous les cas, **arrêter d'ignorer `error`** : le destructurer et le remonter à Sentry, sinon la panne restera invisible.
- **Effort** : L   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

### [P1] Zéro pagination dans toute la façade : troncature silencieuse au plafond `max_rows` — go-live : après

- **Où** : [apps/web/lib/data/content.ts:223](../../../apps/web/lib/data/content.ts#L223)
- **Constat** : `grep '.limit(|.range('` sur `apps/web/lib/data` ne renvoie que 3 hits ([pro.ts:318, 480, 633](../../../apps/web/lib/data/pro.ts#L318)) et zéro `.range()`. `getContentItems` ([213-227](../../../apps/web/lib/data/content.ts#L213)), `getTrashedContent` (247-261), `getPortalContent` (272-284), `getLibraryAssets` ([pro.ts:239-247](../../../apps/web/lib/data/pro.ts#L239)), `getImportedPosts` ([pro.ts:548-556](../../../apps/web/lib/data/pro.ts#L548)) et `getNotifications` ([notifications.ts:21-27](../../../apps/web/lib/data/notifications.ts#L21)) n'ont ni `.range()`, ni `.limit()`, ni filtre de date. `createServerClient` ne configure aucun plafond global. PostgREST applique son `max_rows` — **déclaré à 1000 dans le dépôt** ([supabase/config.toml:8](../../../supabase/config.toml#L8)) — et coupe sans erreur ; le code ignorant `error`, la troncature est totalement muette.
- **Scénario d'échec / coût à l'échelle** : à la 1001ᵉ ligne, un post programmé cesse d'apparaître dans le calendrier, la grille et le portail client, alors qu'il existe en base et que le worker le publiera quand même : l'écran ment au freelance ET au reviewer, puis le contenu « disparu » sort en ligne. **Aggravant** : `getContentItems` trie `created_at ASC`, donc la troncature mord sur les contenus les **plus récents** — exactement ceux qu'on regarde. Et comme `getShellSnapshot` appelle `getContentItems(orgId)` **sans clientId**, le plafond est atteint à l'échelle de l'org entière, pas par client.
- **Pourquoi ça bloque le scaling** : le portail reviewer et la corbeille grossissent aussi sans plafond ; la mémoire du process Node porte l'intégralité du catalogue par requête concurrente.
- **Reco** : fenêtre temporelle explicite pour les vues datées (calendrier/grille = mois affiché ± 1 via `scheduled_at`), keyset pagination sur `created_at` pour le board et la corbeille, `.limit()` partout ailleurs. **Correctif immédiat à coût nul** : passer `getContentItems` en `created_at desc` pour que la coupe tombe sur l'historique ancien, pas sur le mois en cours.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

### [P1] Portail détail : client, commentaires et approbations scopés sur la MAUVAISE org (reviewer multi-org) — go-live : après

- **Où** : [apps/web/app/(portal)/portal/[contentId]/page.tsx:39](<../../../apps/web/app/(portal)/portal/[contentId]/page.tsx#L39>)
- **Constat** : `const client = (await getClient(reviewerCtx.orgId, content.clientId)) as Client` — or `reviewerCtx.orgId` vaut `memberships[0]?.org_id ?? ""`, c'est-à-dire la **première** appartenance seulement ([org-context.ts:144](../../../apps/web/lib/auth/org-context.ts#L144)). [content.ts:263-270](../../../apps/web/lib/data/content.ts#L263) documente explicitement ce piège et scope volontairement `getPortalContent` sur `client_ids`, jamais sur `org_id` ; la page détail réintroduit le filtre org pour le client (39), `getComments` (41) et `getApprovals` (42), et re-cast en `as Client`.
- **Scénario d'échec / coût à l'échelle** : un reviewer invité par deux freelances différents ouvre un contenu du SECOND : `getClient` renvoie null (l'`org_id` ne matche pas) → `client.timezone` ligne 40 lève → page 500. Si le crash était corrigé sans corriger le scope, `getComments`/`getApprovals` renverraient vide : le fil de discussion et l'historique d'approbation disparaîtraient **silencieusement** — le reviewer croirait que ses retours ont été effacés.
- **Pourquoi ça bloque le scaling** : cas normal à l'ouverture SaaS — un même community manager côté client est souvent reviewer chez plusieurs freelances.
- **Nuance de la réfutation** : le déréférencement ligne 40 précède `getComments`/`getApprovals`, donc le 500 survient AVANT le fil vide ; l'ordre décrit initialement était inexact. Non atteignable aujourd'hui (une seule org), d'où le classement « après ».
- **Reco** : scoper ces trois lectures sur `content.clientId` uniquement (un client appartient à une seule org via `UNIQUE(id, org_id)`, le filtre client est au moins aussi fort), ou résoudre l'`org_id` depuis la ligne `client_members` correspondante ; supprimer le cast.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : 6

---

### [P2] Cascade d'awaits strictement séquentiels sur la grille (dont deux `await` dans le JSX) — go-live : dégradé

- **Où** : [apps/web/app/(app)/clients/[clientId]/grid/page.tsx:147](<../../../apps/web/app/(app)/clients/[clientId]/grid/page.tsx#L147>)
- **Constat** : 10 lectures enchaînées sans `Promise.all` — `getClient` (147), `getTopPosts` (153), `getContentItems` (155), `getPostMetricsBatch` (157), `getImportedPosts` (179), `getSocialAccounts` (191), `getQuotaUsage` (192), `getPillars` (193), puis `getBrandKit` (231) et `getReviewer` (232) **awaités à l'intérieur des props JSX**. Le layout parent enchaîne déjà de la même façon ([layout.tsx:25-28](<../../../apps/web/app/(app)/clients/[clientId]/layout.tsx#L25>)). Aucun `Suspense` dans tout `app/**` hors `settings/accounts`.
- **Scénario d'échec / coût à l'échelle** : le TTFB est la SOMME des latences. L'utilisateur voit une page blanche puis tout d'un coup, sans aucun streaming, sur l'écran le plus consulté du produit.
- **Nuance de la réfutation** : l'estimation initiale (~35 hops, ~1,4 s) est exagérée — `hydrate` parallélise ses 3 loaders et toutes ces fonctions sont wrappées en `cache()`, donc `getClient`/`getContentItems`/`getSocialAccounts` sont déjà résolus par le layout et coûtent 0 RTT. La profondeur série réelle est de ~12-14 hops.
- **Reco** : grouper les lectures indépendantes en `Promise.all`, sortir les `await` des props JSX, isoler les blocs lents (métriques, quota, brand kit, posts importés) derrière des `<Suspense>` pour streamer la grille dès que les tuiles sont prêtes.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 26

### [P2] Chaque tuile publiée/importée enregistre un droppable dnd-kit + un HoverCard + un Popover — go-live : dégradé

- **Où** : [apps/web/components/app/grid/locked-grid-tile.tsx:30](../../../apps/web/components/app/grid/locked-grid-tile.tsx#L30)
- **Constat** : `LockedGridTile` appelle `useDroppable({ id: "locked_" + tile.id, data: { locked: true } })` (template literal dans le code) pour CHAQUE tuile verrouillée, et monte systématiquement `TileQuickView` (HoverCard, [tile-quick-view.tsx:29](../../../apps/web/components/app/grid/tile-quick-view.tsx#L29)) plus `TileInfoButton` (Popover, ligne 42) — ce dernier monté puis masqué en CSS (`hidden … pointer-coarse:flex`). Elles sont rendues sans borne par [grid-board.tsx:89 et 101](../../../apps/web/components/app/grid/grid-board.tsx#L89). Mécanisme confirmé dans `@dnd-kit/core` 6.3.1 : au passage `dragging = true`, `measureDroppableContainers()` re-mesure **tous** les containers via `getBoundingClientRect`, et [grid-workspace.tsx:79](../../../apps/web/components/app/grid/grid-workspace.tsx#L79) utilise `closestCenter` sans prop `measuring`, donc les droppables verrouillés participent aussi à la détection de collision à chaque mouvement.
- **Scénario d'échec / coût à l'échelle** : au premier `onDragStart` avec 550 tuiles verrouillées, c'est 550 `getBoundingClientRect()` → un reflow forcé massif au moment précis où l'utilisateur commence à glisser. Latence perceptible avant que la tuile ne suive le doigt sur iPhone, alors que ces droppables ne servent qu'à afficher un anneau rouge « dépôt interdit ».
- **Pourquoi ça bloque le scaling** : le nombre de droppables croît avec l'historique publié, qui n'est jamais borné. À 1500 tuiles, le drag-and-drop de la grille — la fonctionnalité signature — devient inutilisable.
- **Nuance de la réfutation** : les chiffres (200-500 ms) sont des estimations non mesurées, et les portails Base UI ne sont pas montés tant qu'ils sont fermés : le coût réel par tuile est **1 droppable + 1 bouton DOM caché**, pas 3 racines de portail.
- **Reco** : enregistrer UN seul droppable « zone verrouillée » englobant (ou une collision detection qui ignore les tuiles verrouillées). Ne monter `TileInfoButton` que sur pointeur grossier détecté en JS, et le contenu du HoverCard qu'à l'ouverture. Coupler avec la pagination/virtualisation du feed verrouillé (F21).
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

### [P2] Les deux dictionnaires i18n complets partent dans le bundle navigateur de toutes les pages — go-live : dégradé

- **Où** : [apps/web/app/layout.tsx:49](../../../apps/web/app/layout.tsx#L49)
- **Constat** : `LocaleProvider` est un composant `"use client"` ([provider.tsx:1](../../../apps/web/lib/i18n/provider.tsx#L1)) monté à la racine de TOUTES les routes. Il importe `createTranslator` → [dictionaries/index.ts](../../../apps/web/lib/i18n/dictionaries/index.ts), qui importe FR **et** EN en entier (lignes 2-5), les fusionne et exécute `flatten()` récursivement **sur les deux au module scope** (lignes 14-29) — aucun import dynamique, aucune sélection par locale, donc rien n'est tree-shakable. Mesures sur le build présent : `du -sb lib/i18n/dictionaries` = 243 924 o ; le chunk `.next/static/chunks/106n0k275f24b.js` fait 189 465 o et contient à la fois des chaînes FR et EN ; `.next/diagnostics/route-bundle-stats.json` le liste dans le `firstLoadChunkPaths` des **26 routes sur 26**, y compris `/portal`, `/login` et `/`.
- **Scénario d'échec / coût à l'échelle** : chaque visiteur — y compris le reviewer sur le portail, qui n'a besoin que du namespace `portal` — télécharge, parse et aplatit les DEUX langues sur le thread principal avant l'interactivité. C'est le plus gros chunk **applicatif** du build (le seul plus lourd est le runtime framework), sur le parcours iPhone/4G déclaré prioritaire.
- **Pourquoi ça bloque le scaling** : chaque nouvelle zone UI et chaque nouvelle langue s'ajoutent linéairement à ce chunk unique servi à tout le monde ; le coût de `flatten()` au module scope est payé à chaque chargement, jamais amorti.
- **Reco** : ne charger que la locale active — passer depuis le serveur la map plate déjà filtrée en prop du provider (elle transite alors dans le payload RSC, une seule langue), ou import dynamique par locale. Ne pas aplatir au module scope.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 26

### [P2] Variables d'env OAuth documentées ≠ variables lues, et l'échec est masqué par un catch muet — go-live : dégradé

- **Où** : [apps/web/app/api/oauth/[provider]/route.ts:50](<../../../apps/web/app/api/oauth/[provider]/route.ts#L50>)
- **Constat** : le `catch` transforme toute erreur en `?error=oauth_unconfigured` **sans le moindre log**. Le chemin d'échec est atteignable (`providerCredentials` throw à [config.ts:108](../../../apps/web/lib/oauth/config.ts#L108), `signState` throw à [state.ts:24](../../../apps/web/lib/oauth/state.ts#L24)). Or les noms réellement lus sont `OAUTH_META_CLIENT_ID`, `OAUTH_META_CLIENT_SECRET`, `OAUTH_TIKTOK_CLIENT_KEY`, `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_MICROSOFT_CLIENT_ID` ([config.ts:55-93](../../../apps/web/lib/oauth/config.ts#L55)) plus `OAUTH_STATE_SECRET`, alors que [.env.local.example:47-54](../../../apps/web/.env.local.example#L47) documente `META_APP_ID`, `META_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID` — et ne mentionne pas `OAUTH_STATE_SECRET`.
- **Scénario d'échec / coût à l'échelle** : un développeur (ou Étienne en local) renseigne exactement les variables du fichier d'exemple, clique « Connecter Instagram », est renvoyé sur `/settings/accounts` avec un message générique, et **aucun log serveur** ne dit quelle variable manque.
- **Nuance de la réfutation** : le scénario « aucune publication réelle possible » est **faux** — le runbook réellement suivi ([deploy/GO-LIVE-points-1-2.md:37-48](../../../deploy/GO-LIVE-points-1-2.md#L37)) liste les noms CORRECTS, `OAUTH_STATE_SECRET` compris, et documente la redirection `?error=oauth_unconfigured`. Le finding se réduit à une dérive de doc dev-local plus une absence d'observabilité.
- **Reco** : aligner `.env.local.example` sur les noms réellement lus (+ `OAUTH_STATE_SECRET`), valider les env au boot via un schéma Zod (fail-fast au démarrage du conteneur), et logger l'erreur côté serveur avant la redirection générique.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 13

### [P2] `FeedGrid` : ~13 balayages de tout le feed à chaque rendu, zéro `useMemo`, zéro tuile mémoïsée — go-live : après

- **Où** : [apps/web/components/app/grid/feed-grid.tsx:74](../../../apps/web/components/app/grid/feed-grid.tsx#L74)
- **Constat** : entre les lignes 71 et 113, aucun `useMemo` — `plannedVisible` (map + 3 filtres), `lockedVisible` appliqué 3 fois, `allVisible`, `excludedReels`, `reels`, `sortablePlanned`, `allTiles`, puis `STATUS_ORDER.filter(s => allTiles.some(...))` et `FORMAT_ORDER.filter(...)`. L'objet `ctx` (115-129) et `toolbarView` (141) sont recréés à chaque rendu, `presentationTiles` (237-242) reconstruit même dialog fermé. `grep useMemo|useCallback|memo(` sur tout `components/app/grid` : **zéro occurrence** — rien en aval n'est mémoïsé, et chaque tuile monte un `useSortable` ou un `useDroppable`.
- **Scénario d'échec / coût à l'échelle** : chaque toggle de sélection et chaque changement de filtre ré-exécute ~13N passes et remonte des identités de tableaux neuves jusqu'à chaque tuile. Sur un client à 18 mois de feed (~550 tuiles), un simple clic de sélection re-rend 550 composants avec chacun leur hook dnd-kit : le mode sélection multiple devient visiblement saccadé sur mobile.
- **Nuance de la réfutation** : « chaque ouverture de HoverCard » est faux (le HoverCard est non contrôlé et ne re-rend pas `FeedGrid`), `some()` court-circuite (les 13 balayages ne sont pas tous complets), et `makeWithCover` ne clone les tuiles que si un `coverOverride` existe. Par ailleurs aucun writer n'alimente `imported_posts` aujourd'hui : le feed reste petit au démarrage réel.
- **Reco** : envelopper les listes dérivées dans `useMemo` (clés : `tiles.planned`, `view.coverOverrides`, `view.hiddenIds`, filtres), stabiliser `ctx` avec `useMemo` + `useCallback` dans `useGridView`/`useGridTiles`, mémoïser `GridTile`/`LockedGridTile`/`SortableGridTile` avec `React.memo`, et calculer `statuses`/`formats` en un seul balayage (deux `Set`).
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

### [P2] La grille rend l'intégralité de l'historique du client, sans pagination ni virtualisation — go-live : après

- **Où** : [apps/web/components/app/grid/grid-board.tsx:63](../../../apps/web/components/app/grid/grid-board.tsx#L63)
- **Constat** : `GridBoard` mappe `pinned`, `planned`, `published` et `imported` en entier (lignes 64, 75, 89, 99-109), sans fenêtre ni découpage. Côté serveur, la page appelle `getContentItems(orgId, clientId)` et `getImportedPosts(orgId, clientId)` sans `.limit()` ni `.range()` ([grid/page.tsx:155 et 179](<../../../apps/web/app/(app)/clients/[clientId]/grid/page.tsx#L155>)). Toutes les tuiles, avec leur légende, leur permalink et leurs métriques, traversent le payload RSC.
- **Scénario d'échec / coût à l'échelle** : un client actif sur Instagram depuis 2 ans ≈ 700 posts importés. La page sérialise 700 objets `GridTileData` dans le flux RSC, monte 700 composants avec leurs hooks dnd-kit, et chaque `router.refresh()` (après CHAQUE action de lot) recharge tout.
- **Pourquoi ça bloque le scaling** : c'est le point de rupture principal du produit à moyen terme — la grille est censée montrer « le feed », donc la donnée ne fait que croître, à jamais.
- **Nuance de la réfutation** : les vignettes sont des URL **publiques** (`getPublicUrl`), pas des URL signées, et `MediaThumb` n'utilise pas `priority` — le lazy-loading natif évite les ~700 requêtes `/_next/image` immédiates. Aucun importeur n'écrit dans `imported_posts` aujourd'hui (seul le seed de démo) : à l'ouverture réelle la grille est quasi vide.
- **Reco** : borner côté serveur (par ex. 3 mois de publié/importé + « charger plus »), et rendre le feed verrouillé en liste virtualisée — ou `content-visibility: auto` sur les lignes hors écran, quasi gratuit à mettre en place ici. Le planifié reste petit et peut rester complet.
- **Effort** : L   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

### [P2] Le board studio rend toutes les cartes filtrées, non mémoïsées, avec des props recréées à chaque rendu — go-live : après

- **Où** : [apps/web/components/app/studio/content-board.tsx:185](../../../apps/web/components/app/studio/content-board.tsx#L185)
- **Constat** : `filtered.map(it => <ContentCard ... />)` rend l'intégralité des contenus du client ([content/page.tsx:33](<../../../apps/web/app/(app)/clients/[clientId]/content/page.tsx#L33>), sans limite). `ContentCard` n'est pas `memo()` ([content-card.tsx:52](../../../apps/web/components/app/studio/content-card.tsx#L52)) et reçoit à chaque rendu quatre props recréées : `onToggleSelect` (191), `onLabelsChange` (193), `reviewMeta` (objet neuf via `cardReviewMeta`, 194) et `onRemind` (195). L'état de sélection vit dans le parent : **une seule case cochée re-rend toutes les cartes**.
- **Scénario d'échec / coût à l'échelle** : 600 contenus = 600 cartes montées d'un coup, chacune avec un `Link`, un `Checkbox`, un `MediaThumb` et un Popover d'étiquettes. Cocher une case pour un envoi en validation groupé re-rend les 600. Le payload RSC porte en plus les légendes, hashtags et URL signées.
- **Reco** : `React.memo` sur `ContentCard` + handlers stables (`(id) => ...` via `useCallback` plutôt que des closures par item), mémoïser `reviewMeta` par item, puis borner : pagination serveur ou liste virtualisée au-delà de ~100 cartes.
- **Effort** : M   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 26 (Client minimal)

### [P2] Recherche du board studio : re-normalisation NFD de toutes les légendes à chaque frappe, sans debounce — go-live : après

- **Où** : [apps/web/components/app/studio/board-toolbar.tsx:95](../../../apps/web/components/app/studio/board-toolbar.tsx#L95)
- **Constat** : l'input appelle `board.patchFilters({ search: e.target.value })` à chaque frappe ; `patchFilters` crée un nouvel objet `filters` qui invalide le `useMemo` de `filteredItems` ([board-state.ts:355-362](../../../apps/web/components/app/studio/board-state.ts#L355)) et relance `matchesSearch` sur chaque item. `matchesSearch` ([board-utils.ts:21-29](../../../apps/web/components/app/studio/board-utils.ts#L21)) construit à chaque appel un haystack `[title, caption, ...labels, ...hashtags].join(" ")` puis le passe par `.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")` — et **re-normalise aussi la requête pour chaque item**. Aucun debounce, `useDeferredValue` ou `startTransition` dans tout `studio/` ni `hooks/`.
- **Scénario d'échec / coût à l'échelle** : avec 600 contenus et des légendes IG de ~1500 caractères, chaque caractère tapé déclenche 600 normalisations Unicode sur ~900 Ko de texte + 600 regex Diacritic, puis un tri complet (`sortItems`) et le re-rendu de toutes les cartes (non mémoïsées, cf. finding précédent).
- **Pourquoi ça bloque le scaling** : coût O(contenus × longueur des légendes) **par frappe**, sur le premier écran où l'on cherche un contenu dans son historique.
- **Reco** : debouncer la valeur de recherche (~150 ms) dans un état séparé de l'input contrôlé ; pré-calculer une seule fois par item un champ `searchHaystack` normalisé (dans un `useMemo` sur `items`) ; normaliser la requête une seule fois par appel de filtre.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

### [P2] Deux `Intl.DateTimeFormat` construits par date affichée, une fois par carte et par tuile — go-live : après

- **Où** : [apps/web/components/app/studio/content-card.tsx:211](../../../apps/web/components/app/studio/content-card.tsx#L211)
- **Constat** : `f.dateTime(...)` appelle `formatDateTime` ([lib/format.ts:39-48](../../../apps/web/lib/format.ts#L39)) qui construit un `new Intl.DateTimeFormat(...)` puis appelle `formatTime` qui en construit un **second** — aucun cache au niveau module. Même schéma sur les tuiles de grille ([tile-overlays.tsx:157-158](../../../apps/web/components/app/grid/tile-overlays.tsx#L157), `dayMonth` + `time`). En prime, `useFormat()` ([provider.tsx:84](../../../apps/web/lib/i18n/provider.tsx#L84)) alloue un objet de 8 closures à chaque rendu de chaque composant qui l'utilise, et `useLabels()` (ligne 80) refabrique la table de libellés.
- **Scénario d'échec / coût à l'échelle** : la construction d'un `Intl.DateTimeFormat` coûte quelques dizaines de µs (chargement des données ICU du fuseau) ; 600 cartes × 2 constructions = 1200 par rendu de liste, cumulées au reste. Le même formatteur (locale + tz identiques) est reconstruit des centaines de fois pour rien.
- **Nuance de la réfutation** : deux ancres secondaires initialement citées sont surévaluées — le séparateur « Aujourd'hui » n'est rendu qu'une fois, et la fiche express n'est montée qu'à l'ouverture du HoverCard. Le vrai coût par tuile est dans `tile-overlays.tsx`. Les chiffres sont extrapolés, pas mesurés.
- **Reco** : mettre en cache les `Intl.DateTimeFormat` par clé `locale|tz|preset` dans une Map au niveau module de `lib/format.ts`, et faire de `formatDateTime` un **seul** formatteur (weekday + day + month + hour + minute) au lieu de deux. Mémoïser le retour de `makeFormat`/`makeLabels` par locale dans le provider i18n.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

### [P2] N+1 quotas dans le studio : boucle `for` séquentielle sur les comptes sociaux — go-live : après

- **Où** : [apps/web/app/(app)/clients/[clientId]/content/page.tsx:35](<../../../apps/web/app/(app)/clients/[clientId]/content/page.tsx#L35>)
- **Constat** : `for (const account of accounts) { const usage = await getQuotaUsage(...) }` — boucle **séquentielle**, et `getQuotaUsage` fait lui-même 2 requêtes enchaînées ([pro.ts:724 et 737](../../../apps/web/lib/data/pro.ts#L724)) ; le wrapper `cache()` ne déduplique pas entre comptes (clés différentes). Le même fan-out existe en `Promise.all` dans [content/new/page.tsx:70](<../../../apps/web/app/(app)/clients/[clientId]/content/new/page.tsx#L70>) et [content/[contentId]/edit/page.tsx:68](<../../../apps/web/app/(app)/clients/[clientId]/content/[contentId]/edit/page.tsx#L68>), et dans [content/[contentId]/page.tsx:73-75](<../../../apps/web/app/(app)/clients/[clientId]/content/[contentId]/page.tsx#L73>) — cette dernière précédée de 7 awaits séquentiels (lignes 66-72).
- **Scénario d'échec / coût à l'échelle** : 3 comptes sociaux = 6 requêtes en série juste pour les jauges de quota, sur une page qui bloque déjà sur 8 autres lectures enchaînées.
- **Pourquoi ça bloque le scaling** : l'enforcement quota est une règle métier centrale (r19) ; cette lecture sera appelée de plus en plus souvent (calendrier, composer, détail, grille).
- **Reco** : exposer `getQuotaUsageBatch(orgId, accountIds[])` (un `in(...)` sur `social_accounts` + un sur `social_account_quota_usage`) et le réutiliser dans les 4 pages ; passer les lectures indépendantes du détail en `Promise.all`.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Règle CLAUDE.md** : 19

### [P2] Acceptation d'invitation reviewer : `listUsers()` non paginé casse au-delà de 50 comptes auth — go-live : après

- **Où** : [apps/web/app/api/invitations/accept/route.ts:63](../../../apps/web/app/api/invitations/accept/route.ts#L63)
- **Constat** : quand `admin.auth.admin.createUser` échoue parce que l'email existe déjà, le fallback appelle `admin.auth.admin.listUsers()` **sans `page`/`perPage`** (défaut GoTrue : 50 par page, confirmé dans auth-js 2.110.7) puis cherche l'email en mémoire ([lignes 64-65](../../../apps/web/app/api/invitations/accept/route.ts#L64)). Si l'utilisateur n'est pas dans la première page, `userId` reste null et la route sort par `fail(origin)` ligne 67. Le chemin est atteignable par un flux normal : l'index unique est `(client_id, lower(email))` ([013_collaboration.sql:302](../../../supabase/migrations/013_collaboration.sql#L302)), donc le même reviewer invité sur un 2ᵉ client passe forcément par ce fallback.
- **Scénario d'échec / coût à l'échelle** : dès que le projet dépasse 50 utilisateurs auth (freelances + reviewers cumulés, toutes orgs confondues), la ré-invitation d'un reviewer déjà existant renvoie systématiquement `/login?error=invite`. Aucun log n'explique pourquoi.
- **Pourquoi ça bloque le scaling** : le coût est O(tous les utilisateurs de l'instance) à chaque acceptation, et `auth.users` est **global** : la panne d'un tenant est provoquée par la croissance des AUTRES tenants. C'est le pire type de couplage inter-tenant.
- **Reco** : résoudre l'`user_id` via la table applicative `profiles` (email peuplé par `handle_new_user`, [003_identity_orgs.sql:60-68](../../../supabase/migrations/003_identity_orgs.sql#L60)) plutôt que via l'API admin ; à défaut, paginer `listUsers({ page, perPage })` jusqu'à trouver. Garder `createUser` uniquement comme chemin de création.
- **Effort** : S   **Impact** : fort
- **⚠ Comportement** : oui   **Règle CLAUDE.md** : aucune

---

### [P3] Clé de dépendance d'effet construite par tri + join de tous les ids visibles, à chaque rendu — go-live : après

- **Où** : [apps/web/components/app/grid/feed-grid.tsx:93](../../../apps/web/components/app/grid/feed-grid.tsx#L93)
- **Constat** : `const visibleKey = allVisible.map(t => t.id).sort().join("|")` est calculé à chaque rendu, puis l'effet (97-101) refait `visibleKey.split("|")` pour reconstruire un `Set`. Les ids sont des UUID de 36 caractères : la chaîne est triée et allouée même quand rien n'a changé. Les deps incluent `select.selectedIds`, nouveau tableau à chaque changement de sélection ([use-multi-select.ts:68](../../../apps/web/components/app/shared/use-multi-select.ts#L68)).
- **Scénario d'échec / coût à l'échelle** : sur 550 tuiles, ~20 Ko de chaîne allouée + triée par rendu, re-parsée en 550 sous-chaînes par l'effet — soit ~20 Ko de churn GC par clic de sélection, pour une simple opération d'ensemble. À 1500 tuiles, ~55 Ko par rendu.
- **Nuance de la réfutation** : l'impact est **dominé** par les cinq `.map(withCover)` non mémoïsés du même rendu (F20) ; rien n'est cassé ni visible pour l'utilisateur. Le vrai risque est la propagation du pattern « sérialiser une liste en string pour servir de dep d'effet » par copier-coller.
- **Reco** : remplacer par un `useMemo` renvoyant un `Set<string>` des ids visibles et faire l'élagage de sélection dans le handler de filtre (dérivation) plutôt que dans un effet ; si l'effet est conservé, dépendre du Set mémoïsé.
- **Effort** : S   **Impact** : moyen
- **⚠ Comportement** : non   **Règle CLAUDE.md** : aucune

---

## Annexe — pistes non vérifiées

> Ces pistes ont été **cappées** par la limite de findings de la passe : elles n'ont PAS été soumises à la réfutation adversariale et ne doivent pas être traitées comme confirmées. À reprendre dans une passe dédiée (worker + SQL notamment).

**Worker et CI** (non vérifiés)
- La CI ne compile ni ne teste jamais le worker — `.github/workflows/ci.yml:107`.
- Traitement strictement séquentiel : un seul job à la fois, une vidéo TikTok bloque toute la file — `apps/worker/src/index.ts:64`.
- L'index dédié au claim est inutilisable par la requête de claim (prédicat non impliqué) — `apps/worker/src/db/pg-store.ts:62` et `supabase/migrations/020_publish_jobs.sql:104`.
- Pool pg sans handler `'error'` : une connexion idle coupée tue le process — `apps/worker/src/db/pool.ts:11`.
- Aucun timeout de requête ni signal de vivacité : le worker peut se figer sans jamais crasher — `apps/worker/src/db/pool.ts:15`.
- Report pour quota : re-essai toutes les 60 s puis `dead_letter` au bout de 2 h, au lieu du report au prochain créneau — `apps/worker/src/index.ts:78`.
- Aucune notification ni Sentry côté worker : tout échec de publication est silencieux — `apps/worker/package.json:13`.
- Aucun artefact de déploiement du worker, et son script `start` dépend d'une devDependency — `apps/worker/package.json:7`.
- `withTx` : le ROLLBACK non protégé masque l'erreur réelle et rend un client suspect au pool — `apps/worker/src/db/pg-store.ts:243`.
- Aucune revérification de l'état métier avant publication : un job ressuscité publie un contenu déprogrammé — `apps/worker/src/engine.ts:27`.
- Drainage du backlog : les jobs périmés passent devant les jobs encore publiables — `apps/worker/src/db/pg-store.ts:65`.
- `WORKER_MAX_ATTEMPTS` lu, documenté dans le runbook, jamais utilisé — `apps/worker/src/env.ts:47`.

**SQL / schéma** (non vérifiés)
- Aucun index ne sert la lecture cœur (`org_id` + `deleted_at is null` + `order by created_at`) — `supabase/migrations/006_content_core.sql:82`.
- Clés étrangères non indexées, dont une sur le chemin chaud du composer — `supabase/migrations/013_collaboration.sql:138`.
- La vue `unified_agenda` est du code mort, et sa branche publication est structurellement non indexable sous RLS — `supabase/migrations/015_agenda.sql:256`.
- `report_shares` : `expires_at` nullable et jamais renseigné — lien anonyme perpétuel, sans purge ni leak test — `supabase/migrations/018_report_shares.sql:19`.
- Deux policies SELECT permissives sur `profiles` — `supabase/migrations/003_identity_orgs.sql:131`.
- `refresh_client_comments_count` recompte tout le fil à chaque écriture et verrouille le `content_item` parent — `supabase/migrations/013_collaboration.sql:329`.
- Policies storage : le cast `(storage.foldername(name))[1]::uuid` met tout le bucket en panne dès qu'un objet est mal nommé — `supabase/migrations/012_media_storage.sql:59`.
- `notifications` : aucun index pour la cloche, aucune rétention — `supabase/migrations/007_notifications_push.sql:39`.
- Prédicats de visibilité reviewer en SubPlans corrélés imbriqués : O(lignes × pièces jointes) sur le portail — `supabase/migrations/012_media.sql:149`.
- Le schéma promet une rétention (purge médias J+7 / 180 j) qu'aucun mécanisme n'implémente — `supabase/migrations/012_media.sql:48`.

**Façade de lecture et UI** (non vérifiés)
- `getQuotaUsage` : 2 requêtes par compte, dont une inutile — `apps/web/lib/data/pro.ts:724`.
- La page performance charge tout l'historique hydraté pour calculer des fenêtres 30/90 jours — `apps/web/components/app/performance/perf-data.ts:204`.
- `getImportedPosts` lit TOUTES les métriques du client au lieu de celles des posts affichés — `apps/web/lib/data/pro.ts:566`.
- Trois lectures sans filtre `org_id`/`client_id` : défense en profondeur (règle 7) absente — `apps/web/lib/data/pro.ts:364`.
- `pro.ts` fait 879 lignes (règle 24 : 250 max) et concentre 8 domaines — `apps/web/lib/data/pro.ts:879`.
- Notifications non bornées, rechargées à chaque page pour en afficher 5 — `apps/web/lib/data/notifications.ts:27` et `apps/web/app/(app)/dashboard/page.tsx:31`.
- Mots interdits : une RegExp compilée par mot et par frappe, calculée deux fois — `apps/web/components/app/studio/composer/caption-tools.tsx:72`.
- Barre d'actions de lot : intersection sélection × items en O(N×S) à chaque rendu — `apps/web/components/app/studio/board-batch-actions.tsx:47`.
- Six fichiers du périmètre dépassent 250 lignes (règle 24) — `apps/web/components/app/studio/board-state.ts:1`.
- PWA iOS : icône SVG uniquement, aucun `apple-touch-icon` PNG, pas de service worker malgré l'assistant d'installation — `apps/web/app/manifest.ts:15`.
- `getTopPosts` peut renvoyer moins de posts que demandé (dedup après `limit*2`) — `apps/web/lib/data/pro.ts:633`.
- `getPostMetrics` : code mort exporté par la façade, réintroduit le N+1 supprimé — `apps/web/lib/data/pro.ts:590`.
- Couleurs hexadécimales en dur dans l'anneau de story Instagram — `apps/web/components/app/grid/instagram-profile-header.tsx:8`.

---

## Ce qui va bien (à préserver)

- **Le squelette du worker est le bon.** Claim atomique en une requête avec `FOR UPDATE SKIP LOCKED` et `limit 1` ([pg-store.ts:55-71](../../../apps/worker/src/db/pg-store.ts#L55)), lease + reaper, HTTP hors transaction, backoff. La décision « file Postgres, pas de Redis » tient. Il manque le fencing (F03) et une issue pour les jobs à bout de tentatives (F09) — pas une réécriture.
- **Les URL Storage sont signées en BATCH, jamais une par une** ([content-media.ts:35-47](../../../apps/web/lib/data/content-media.ts#L35), [pro.ts:270-279](../../../apps/web/lib/data/pro.ts#L270)), et jamais stockées en base. Le problème est le périmètre (on signe trop), pas le mécanisme.
- **`hydrate()` parallélise ses trois loaders** ([content.ts:171](../../../apps/web/lib/data/content.ts#L171)) et `getShellSnapshot` parallélise ses six lectures ([dashboard.ts:162](../../../apps/web/lib/data/dashboard.ts#L162)) : le réflexe `Promise.all` existe, il faut juste l'étendre aux pages (F16).
- **`getUnreadCount` utilise `head: true` + `count`** — le bon pattern pour un compteur, à généraliser aux compteurs de `/clients` (F07).
- **Le N+1 de métriques par tuile a déjà été supprimé** au profit d'un `getPostMetricsBatch` ([grid/page.tsx:156-160](<../../../apps/web/app/(app)/clients/[clientId]/grid/page.tsx#L156>), commentaire explicite). La démarche est acquise, elle n'a simplement pas été appliquée aux compteurs ni aux quotas.
- **`cache()` de React est utilisé systématiquement** dans `lib/data` : la déduplication intra-requête fonctionne dès lors que les arguments coïncident — c'est pourquoi une projection unique pour le shell (F04) supprimerait mécaniquement plusieurs doublons.
- **`getPortalContent` est volontairement scopé sur `client_ids` et non sur `org_id`**, avec un commentaire qui explique le piège du reviewer multi-org ([content.ts:263-270](../../../apps/web/lib/data/content.ts#L263)). C'est la bonne décision — il faut l'appliquer aussi à la page de détail du portail (F15).
- **La séparation buckets public/privé est respectée** : `media-thumbs` en `getPublicUrl`, `media-originals` en URL signée, jamais l'inverse.
- **`MediaThumb` dégrade proprement via `onError`** ([media-thumb.tsx:43](../../../apps/web/components/shared/media-thumb.tsx#L43)) — c'est ce qui transforme F02 en « images absentes » plutôt qu'en écran d'erreur. À généraliser à `reels-tab` et `presentation-mode`, qui n'ont pas ce filet.
