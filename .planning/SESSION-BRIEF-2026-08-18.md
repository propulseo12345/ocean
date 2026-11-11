# Brief de session — 18/08/2026 : la phase 6, jusqu'où elle va sans Meta

Session d'exécution **autonome et longue** (plusieurs heures, plusieurs lots). Une session de
pilotage vérifiera ton travail **contre le code**, pas contre ton rapport. Branche
`chore/phase-0-outillage` @ `83f7099` — continue dessus, commits atomiques par ticket.

## Où en est le projet

Les phases 0, 2 (partielle), 3, 4, 5, 7 et 8 sont livrées. Les migrations **035 et 036 sont
appliquées en production** (ledger à 36 lignes) — donc `read_integration_secret` et
`revoke_integration_secret` existent en ligne, et `account_status` porte `disconnected`.

**Aucun post réel n'a jamais été émis.** Les trois publishers sont des stubs de 14 à 19 lignes.
`assertLivePublishersAvailable()` refuse `PUBLISHERS_MODE=live` avec le message
« phase 6 non atteinte : les 3 publishers sont des stubs ». Ton lot consiste à rendre ce refus
obsolète.

## Ce qui est bloqué, et ce qui ne l'est pas — lis ça avant de commencer

**Bloqué, définitivement, hors de ta portée** : il n'existe **ni app Meta ni identifiants**. Le
critère de sortie de la phase 6 — « un post réel, programmé la veille, apparaît sur le compte de
test » — **tu ne peux pas l'atteindre**, et tu ne dois pas prétendre l'avoir atteint.

**Pas bloqué du tout** : tout le code qui produit ce post. Les publishers réels s'écrivent et se
testent contre un **transport HTTP injecté** — un faux Graph API qui rejoue les formes de réponse
documentées. C'est plusieurs heures de travail sérieux, et c'est exactement ce qui reste.

La frontière est celle-ci, tiens-la : **tu livres le dialogue, pas la preuve du dialogue.** Écris-le
noir sur blanc dans ton rapport final.

## Règles du projet qui mordent ici

Relis `CLAUDE.md` §5, §6, §8. Les quatre qui vont te contraindre le plus :

- **Règle 15 — idempotence.** `publish_started_at` est posé AVANT `media_publish`. Un job retrouvé
  avec `publish_started_at` non nul n'est JAMAIS republié à l'aveugle : il interroge d'abord
  `GET /{container}?fields=status_code`. Le moteur (`engine.ts`) orchestre déjà ça ; ton publisher
  doit implémenter `getContainerStatus` honnêtement, y compris les cas `ERROR` et `EXPIRED`.
- **Règle 18 — appels HTTP hors transaction**, et erreur permanente (token révoqué, média invalide)
  = `failed` direct, jamais de retry. Tu dois **classer** les erreurs Meta : un code 190 (token) ne
  se retente pas, un 4 (rate limit) si.
- **Règle 19 — quota par `social_account`** vérifié AVANT le post.
- **Aucun token, jamais, dans un log.** Y compris dans un message d'erreur recopié depuis la
  réponse du fournisseur — Meta renvoie parfois l'URL appelée.

---

# LOT 1 — Les deux coutures que tout publisher exige

Rien ne sert d'écrire Instagram si le contexte de publication est vide. `context.ts:22` porte le
TODO exact.

## T1-1 · `media/signed-urls.ts` — l'URL signée 48 h

**Le module n'existe pas** : `apps/worker/src/media/` est un répertoire absent, alors que
`CLAUDE.md` §4 le liste et que `PublishContext.mediaUrl` l'attend.

Instagram et Facebook ne reçoivent jamais d'octets : ils reçoivent une **URL** qu'ils vont chercher
eux-mêmes. Le bucket `media-originals` est privé (règle 20), donc l'URL est signée à la publication,
TTL 48 h, générée par le worker avec la clé service_role.

Décisions à prendre et à écrire :
- **Le TTL est long exprès** — un job qui part en retry sur 5 tentatives avec backoff doit encore
  avoir une URL valide à la dernière. Dis-le dans un commentaire, sinon quelqu'un le raccourcira.
- **Un job multi-médias (carrousel) signe chaque média.** Ordre stable, celui de `content_media`.
- **Que se passe-t-il si la signature échoue ?** Ce n'est pas une erreur permanente — Storage peut
  être momentanément indisponible. Retry, pas `failed`.

## T1-2 · `context.ts` — le token frais, pour de vrai

`prepare()` lit le token via `loadAccessToken` mais **ne le rafraîchit jamais**. `tokens/refresh.ts`
existe depuis P8-4, avec son advisory lock et son compare-and-swap. Branche-le.

⚠ **Le piège** : rafraîchir sous verrou à l'intérieur du chemin de publication rallonge le temps de
lease (2 min). Vérifie que le refresh se fait **avant** le claim ou dans un budget de temps borné,
et que l'appel HTTP du refresh reste hors transaction (c'est déjà le cas dans `refresh.ts` — ne le
casse pas en l'appelant depuis un endroit qui tient une transaction ouverte).

---

# LOT 2 — Instagram réel

`publishers/instagram.ts:4-14` contient déjà la spécification du flux, écrite par la session qui a
posé le stub. Suis-la.

- `createContainer` : `POST /{ig-user-id}/media` — image (`image_url`, `caption`) ou reel
  (`media_type=REELS`, `video_url`). Retourne le `creation_id`.
- **Un reel n'est pas prêt immédiatement** : `GET /{creation_id}?fields=status_code` jusqu'à
  `FINISHED`. C'est une attente, pas une erreur — et elle doit passer par l'état
  `awaiting_media` de la machine à états, pas par un `sleep` dans le publisher.
- `publish` : `POST /{ig-user-id}/media_publish?creation_id=…`
- `getContainerStatus` : la reprise de la règle 15. `PUBLISHED` → ne pas republier.
- `resolvePublished` : récupérer `permalink` et l'id du média.

**Le transport est injecté.** N'appelle pas `fetch` global depuis le publisher : prends une fonction
`fetch`-compatible en paramètre de fabrique. C'est ce qui rend le tout testable — et c'est la seule
façon dont je peux vérifier ton travail sans app Meta.

**Transmets `ctx.signal` à chaque appel** (`types.ts:20-27` explique pourquoi : sans lui, la requête
survit au timeout du moteur, socket et token compris).

**Écris les tests contre les formes réelles de réponse Meta**, y compris les erreurs : `{"error":
{"code":190,...}}` (token invalide → permanent), `{"error":{"code":4,...}}` (rate limit →
retry), média rejeté (→ permanent). Un test qui n'exerce que le chemin heureux ne prouve rien.

---

# LOT 3 — Facebook Pages, puis TikTok

- **Facebook** : publication sur la Page, et les **Reels plafonnés à 30/24 h/Page** (§6 du CLAUDE).
  Le BUC se lit dans l'en-tête `X-Business-Use-Case-Usage` de chaque réponse — donc le quota
  distant se met à jour **en sortie d'appel**, pas avant. Note-le, c'est contre-intuitif.
- **TikTok** : brouillon uniquement (scope `video.upload`), statut `pushed_to_platform`. Vidéo en
  **FILE_UPLOAD chunké depuis le worker** — jamais `PULL_FROM_URL` sur `*.supabase.co` (anti-pattern
  explicite du CLAUDE.md §5). Compteur local : 5 brouillons/24 h/créateur.

---

# LOT 4 — Le quota distant

`context.ts:61` marque l'emplacement exact : l'appel distant vient **avant** la décision locale, et
son résultat fait un UPSERT dans `social_account_quota_usage` avec `source = 'api'`.

- IG : `GET /content_publishing_limit` avant chaque post.
- FB : l'en-tête de la réponse précédente (cf. LOT 3).
- Quota atteint → **report automatique** au prochain créneau + notification (décision actée, §5).
  Ce n'est pas un échec.

⚠ Vérifie que `source = 'api'` existe bien dans l'enum ou la colonne concernée. **Si une migration
est nécessaire, écris-la en `supabase/migrations/037_*.sql` + son fichier `deploy/`, et n'applique
RIEN en ligne** — c'est le travail de la session de pilotage, sur autorisation d'Étienne.

---

# LOT 5 — Lever le refus, sans ouvrir un trou

Quand les trois publishers sont réels, `assertLivePublishersAvailable()` doit cesser de refuser.
**Mais ne te contente pas de supprimer le garde-fou.**

`PUBLISHERS_MODE=live` sans identifiants Meta doit échouer **au démarrage**, clairement, et pas au
premier job à 7 h du matin chez un client. Remplace le refus « les publishers sont des stubs » par
un refus « identifiants plateforme manquants » qui liste les variables absentes. Le test qui
existe déjà (`env.test.ts:69`) doit être réécrit pour vérifier la nouvelle raison, pas supprimé.

---

# Si tu as encore du temps — LOT 6, le watchdog

Le seul filet **indépendant du worker** n'existe toujours pas (phase 2, `ACTION-PLAN.md:145`) :
pg_cron 1×/5 min → jobs en retard > 2 min non claimés → Edge Function → e-mail Brevo. La partie SQL
et la fonction s'écrivent sans aucun compte externe ; seul l'envoi effectif attend `BREVO_API_KEY`.
Même règle : **migration en fichier, jamais appliquée en ligne.**

---

# Comment tu prouves ton travail

Les commandes, **corrigées** — deux d'entre elles mentaient dans les briefs précédents :

```bash
pnpm -w build
pnpm --filter web exec tsc --noEmit
pnpm --filter worker exec tsc --noEmit
pnpm --filter web test          # référence : 124/124
pnpm --filter worker test       # référence : 51/51 — c'est ce chiffre qui doit monter
export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"; export MSYS_NO_PATHCONV=1
npx supabase@latest db reset --no-seed && npx supabase@latest test db   # référence : Files=34, Tests=364, PASS
```

⚠ **`bash scripts/run-pgtap.sh` sans argument n'exécute AUCUN test et sort 0.** Son `$1` est `UPTO`
(défaut `011`), les arguments suivants sont les fichiers de test. Ne l'utilise pas comme preuve.

⚠ **`scripts/gen-types.py` a été supprimé** le 15/08 : il annonçait « regenere 42 tables » et
n'écrivait rien. `apps/web/lib/supabase/types.ts` est **manuel**. Si tu ajoutes une table ou une RPC,
tu mets ce fichier à jour **à la main**.

## Ce que la session de pilotage exigera de toi

Elle a payé cinq faux positifs cette semaine. Elle ne croira aucune de tes affirmations sans
regarder le code. Anticipe :

1. **Vérification par mutation, pour chaque garde que tu écris.** Casse-la, montre quel test tombe,
   remets-la. Un test qui passe avant ET après ton correctif ne prouve rien.
2. **Ne crois pas le message de sortie d'un outil, regarde son effet.** `git status` après un
   générateur, les `ok`/`not ok` après un runner.
3. **Dis ce que tu n'as pas couvert.** La limite de ce lot est connue d'avance et elle est énorme :
   aucun octet n'aura transité vers Meta. Un rapport qui ne le dit pas sera rejeté entier.
