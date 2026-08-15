# Brief de session — 17/08/2026 : faire entrer les médias

Session d'exécution autonome et longue. Une autre session pilote et vérifie ticket par ticket.
Branche `chore/phase-0-outillage` (non poussée — droits GitHub côté Étienne). Continue dessus.

## Où en est le projet

**Le LOT 0 de la veille est clos et vérifié** (open redirect, flux d'invitation, CSRF, appels morts).
La passe de vérification est dans `_research/audits/2026-08-12/13-VERIF-phase7.md` ; ses quatre
défauts sont corrigés, et la session de pilotage a re-contrôlé chaque correctif dans le code.

**Base de données à jour** : ledger à **34 lignes (`001`→`034`)**. Les migrations 032, 033 et 034
ont été appliquées en production par la session de pilotage, avec vérification des grants
(`anon` n'a `EXECUTE` sur aucune d'elles ; la surface `anon` reste à une seule fonction).

⚠ **Aucune écriture en ligne dans cette session.** Toute nouvelle migration va dans
`supabase/migrations/035_*.sql` et suivantes, avec son fichier `deploy/`.

**Environnement local débloqué** : le stack Supabase d'Ocean tourne sur les ports **544xx**
(`npx supabase@latest start` / `stop`). Celui du projet `preventionelectrique` occupe 5432x et
**ne doit jamais être touché**. `.github/workflows/ci.yml` a été aligné sur les nouveaux ports.

**Ce qui reste chez Étienne** : les gabarits d'e-mail Supabase (`GABARITS-EMAIL-supabase.md`).
Sans eux aucune invitation n'aboutit — mais cela ne bloque pas ton lot.

---

# LOT 1 — L'upload des médias (le dernier verrou avant la publication)

Instagram et Facebook refusent tout post sans média. Tant que ce lot n'est pas fait, la chaîne
création → validation → publication est **physiquement impossible**, quel que soit l'état des
publishers.

## Ce qui existe déjà, et qu'il ne faut pas refaire

- `apps/web/lib/media/paths.ts` — convention de chemin `{org_id}/{client_id}/{media_asset_id}/…`,
  assainissement des noms, dérivation du chemin de vignette, et `tenantOf` qui relit les deux
  segments d'isolation. **Testé par propriété** (« aucun chemin visant un autre tenant n'est
  accepté »). Ce module n'a aujourd'hui **aucun importeur** : c'est toi qui le câbles.
- Les Server Actions, écrites, validées Zod, et **sans appelant** : `recordUploadedAsset`,
  `attachMedia`, `deleteAsset`, `updateAssetAlt` (`lib/actions/media.ts`).
- Les deux buckets et leurs policies. `media-originals` est privé, `media-thumbs` public.
- La lecture Reviewer (migration 033, appliquée) : `private.can_read_client_media` résout l'objet
  par `media_assets.storage_path`, qui porte un index UNIQUE.

## ⚠ Le piège d'ordonnancement, déjà payé une fois

Le `media_asset_id` du chemin est **généré par l'INSERT** : le navigateur ne peut pas le connaître
au moment où il téléverse. Une première version de la migration 033 lisait ce segment du chemin et
n'aurait jamais rien matché — 9 tests verts la certifiaient. **Décide l'ordre des opérations avant
d'écrire une ligne**, et écris-le dans le commit : soit l'identifiant est généré côté client et
l'INSERT le reprend, soit l'INSERT précède le transfert et rend le chemin. Les deux se défendent ;
l'implicite, non.

## Les tickets

- **P5-6a** — Client d'upload TUS vers Supabase Storage (`/storage/v1/upload/resumable`), chunks de
  **6 Mo exactement** (Supabase l'exige), reprise après coupure, progression, annulation.
  Le transfert se fait avec le jeton de l'utilisateur : la policy `media_originals_insert` doit
  donc l'autoriser — vérifie-le pour de vrai, ne le suppose pas.
- **P5-6b** — Conversion **HEIC → JPEG** côté client (photos iPhone : c'est la cible prioritaire du
  produit, pas un cas exotique) et PNG → JPEG pour Instagram (règle 22 : JPEG uniquement, ≤ 8 Mo,
  ratio 4:5 à 1.91:1).
- **P5-6c** — Vignette WebP ~400 px générée côté client → `media-thumbs`, au chemin dérivé par
  `paths.ts`.
- **P5-7** — Une vraie zone de dépôt et un sélecteur de fichier, dans la médiathèque **et** dans le
  composer. Aujourd'hui `upload-dialog.tsx` est un `<button>` qui jette `e.dataTransfer`.
- **P5-8b** — Câbler les quatre Server Actions existantes sur ces surfaces.
- **P5-9** — Appliquer réellement l'intention de recadrage enregistrée par `applyCrop` (elle
  n'invente plus de mesures depuis le 15/08, mais rien ne traite encore l'image).

## Critère de sortie — non négociable

**Un fichier réellement transféré**, vérifié dans le Storage local :
1. déposé depuis le navigateur,
2. présent dans `media-originals` au chemin `{org}/{client}/{media_asset_id}/…`,
3. sa vignette dans `media-thumbs`,
4. affiché dans la grille, le studio **et** le portail,
5. une photo **HEIC** d'iPhone arrive en JPEG conforme aux specs Instagram.

Si tu ne peux pas transférer un octet, **arrête-toi et explique** — c'est ce qu'a fait la session
précédente, à raison. Du code d'upload jamais exécuté est pire qu'un ticket non commencé : il a
l'air fait.

---

# LOT 2 — OAuth propre (seulement si le LOT 1 est fini et vérifié)

- **P8-1** — Écran de sélection des sous-comptes Meta (aujourd'hui **toutes** les Pages du compte
  connecté sont rattachées au client courant, avec leurs tokens).
- **P8-2** — Détachement + révocation du secret dans le Vault (aucun `.delete()` nulle part : passif
  RGPD).
- **P8-3** — Échange long-lived Meta (`fb_exchange_token` = 0 occurrence : les tokens meurent en une
  heure).
- **P8-4** — `tokens/refresh.ts` réel, appel HTTP **hors** du verrou (règle 18).
- **P8-5** — State OAuth durci : `exp`, nonce à usage unique, lien de session, `codeVerifier` PKCE
  non lisible.
- **P8-6** — Scope `pages_manage_posts` (Meta ne rétro-accorde pas un scope) et stocker les scopes
  **accordés**, pas ceux demandés.
- **P8-7** — `needs_reauth` est écrit sur `platform_connections`, table que le web ne lit jamais.

---

## Règles de travail — non négociables

- **Un commit par ticket**, dans l'ordre.
- **Aucune écriture sur le projet Supabase en ligne.** Migrations dans `035_*` et suivantes.
- **Toute migration a son test pgTAP.** La suite doit rester verte (348 ok / 0 not ok au 16/08).
- **Preuve avant affirmation.** Commande lancée, sortie réelle collée.
- Si un ticket s'avère plus gros ou plus risqué que prévu, **arrête-toi et explique**.

## Trois faux positifs payés cette semaine — ne les reproduis pas

1. **Un test qui énumère ne prouve rien.** 8 tests verts certifiaient un filtre d'open redirect
   inopérant : leur liste ne contenait aucun dot-segment, donc l'assertion ne pouvait pas se
   déclencher. Préfère une propriété sur un corpus généré.
2. **Un test peut certifier un correctif qui ne corrige rien.** La migration 033 v1 lisait un
   segment de chemin qui aurait toujours été vide en usage réel. Ses 9 tests passaient.
3. **Une preuve peut se tromper de référentiel.** Le « `pnpm check` exit 0 » du 15/08 était mesuré
   sur un arbre `git archive`, qui applique lui aussi la conversion de fin de ligne. La vérité du
   dépôt, ce sont les **blobs** : 14 erreurs préexistantes.

**Vérifie tes correctifs par mutation** : casse volontairement la garde, et regarde si un test tombe.
Si aucun ne tombe, tu n'as pas de test.

## Pièges connus

- pgTAP dans le conteneur `ocean_rev2` (`bash scripts/run-pgtap.sh`). Docker hors PATH :
  `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"` et `export MSYS_NO_PATHCONV=1`.
- Vérifie que `plan` == nombre de tests émis dans chaque fichier pgTAP.
- `NEXT_PUBLIC_*` est inliné au build, y compris côté serveur : toute origine publique passe par une
  variable non préfixée (`SITE_URL`).
- `middleware.ts` s'appelle `proxy.ts` en Next 16. Un dossier préfixé `_` est exclu du routage.
- Serveur de dev sur PORT=3010. Ne tue jamais les serveurs des autres projets.
- Ne réintroduis jamais de données mockées.

## Rendu final attendu

- Le tableau des tickets avec leur statut RÉEL.
- Pour chaque ticket : le commit et la preuve.
- **La preuve du transfert** : le chemin réel de l'objet dans le Storage local, sa taille, son type,
  et la vignette associée. Une capture de l'écran qui l'affiche si tu peux.
- Ta décision sur l'ordre INSERT / transfert, et pourquoi.
- État final de `pnpm -w build`, `tsc --noEmit` (web et worker), les trois suites de tests,
  `pnpm check` mesuré **sur les blobs**, la suite pgTAP.
- Ce que tu as vu et volontairement PAS touché.
- Ce qui attend Étienne.
