# Brief de session — 16/08/2026

Session d'exécution autonome et longue. Une autre session pilote et vérifie ticket par ticket.
Branche `chore/phase-0-outillage` (non poussée — droits GitHub côté Étienne). Continue dessus.

## Où en est le projet

Phases 0, 2 (partielle), 3, 4 faites. Phase 5 partielle. **Phase 7 livrée, puis vérifiée par une
passe adversariale** dont le rapport est `_research/audits/2026-08-12/13-VERIF-phase7.md` — **lis-le
en entier avant de commencer, c'est le cœur de ta mission.**

Ce que la vérification a établi :

- ✅ **La prise de contrôle de compte (P7-1) est réellement fermée.** La primitive a été retirée du
  *type* : `AcceptOutcome` ne peut plus transporter de lien ni de session, `generateLink` n'existe
  plus. Une quinzaine de variantes ont échoué. Le test a été validé par mutation. **N'y touche pas
  sans nécessité, et si tu dois y toucher, refais tourner la mutation.**
- ❌ **Quatre choses ne tiennent pas.** Elles sont ton LOT 0.

**Migrations 032 et 033 : appliquées en production le 15/08** (par la session de pilotage, avec
vérification complète — voir `.planning/ACTION-PLAN.md`). Le ledger est à **33 lignes, `001`→`033`**.
Les RPC `revoke_client_invitation`, `invite_client_reviewer`, `remove_client_member`,
`private.can_read_client_media` et `private.safe_uuid` **existent désormais en base**.

⚠ **Après ce brief, plus aucune écriture en ligne.** L'autorisation donnée était bornée aux
migrations 032/033. Toute nouvelle migration va dans `supabase/migrations/034_*.sql` et suivantes,
avec son fichier `deploy/`.

⚠ Les rapports d'audit du 12/08 décrivent un état largement dépassé. Le seul document à jour sur la
sécurité est `13-VERIF-phase7.md`. Vérifie toujours dans le code.

---

# LOT 0 — Ce que la vérification a démoli (bloquant, à faire en premier)

## V-1 — L'open redirect n'est pas corrigé (critique)

**Vérifié par exécution du module réel**, pas par lecture :

```
safeNext("/..//evil.tld")              -> "//evil.tld"
safeNext("/.//evil.tld")               -> "//evil.tld"
safeNext("/%2e%2e//evil.tld")          -> "//evil.tld"
safeNext("/dashboard/../..//evil.tld") -> "//evil.tld"
```

**Mécanique** : `lib/auth/safe-next.ts:55` teste le motif protocol-relative sur `raw`, la chaîne
**avant** analyse. `/..//evil.tld` n'a qu'une barre en tête, il passe. Le parser WHATWG replie
ensuite le `..` contre un chemin vide (no-op) puis empile le segment **vide** entre les deux barres :
`url.pathname` devient `//evil.tld`. Le juge final (`:65`) inspecte `url.origin`, qui vaut toujours
la sentinelle. `:68` renvoie le pathname tel quel. **Le filtre est du mauvais côté du parser, et
c'est le parser qui fabrique la chaîne interdite.**

**Puits exploitable aujourd'hui, sans authentification préalable** :
`/login?next=/dashboard/../..//evil.tld` → `login-form.tsx:52` recopie sans validation → `:69` champ
caché → la victime saisit son mot de passe → `(auth)/actions.ts:49` `redirect("//evil.tld")`.

**Correctif — valider la SORTIE, pas l'entrée** :

```ts
const sortie = `${url.pathname}${url.search}${url.hash}`
return PROTOCOL_RELATIVE.test(sortie) ? fallback : sortie
```

Interdire `..` en entrée serait un **second correctif inopérant** : `/.//evil.tld` n'en contient pas.

**Le test doit être refait, il est décoratif** :
- `lib/auth/safe-next.test.ts` contient un **octet NUL à la ligne 56** : git classe le fichier en
  binaire, `git show` n'affiche rien, et la ligne qu'un humain lit `"/ //evil.tld"` teste en réalité
  `"/\0//evil.tld"`. **Retire cet octet.**
- Son dernier test porte la bonne assertion mais sur une **énumération de 7 cas choisis à la main,
  tous déjà tués par les gardes amont, aucun avec dot-segment**. Remplace-la par une propriété
  vérifiée sur un corpus généré (dot-segments, encodages simples et doubles, backslash, NUL,
  tabulation, `@`, `javascript:`, `data:`, chaînes vides).

**Vérifie aussi les consommateurs.** `app/auth/callback/route.ts:25,28` et
`app/auth/landing/route.ts:23` sont protégés **par accident** : ils concatènent `` `${origin}${next}` ``.
Aucun test n'exprime cette différence — quiconque « simplifiera » en `NextResponse.redirect(next)`
ouvrira deux puits. Écris le test qui fige ça.

## V-2 — Le flux d'invitation légitime est un cul-de-sac dans ses DEUX branches (critique)

Aucun invité ne peut aboutir aujourd'hui.

**Branche « compte neuf »** : `route.ts:88` appelle `inviteUserByEmail(email, { redirectTo })` avec
`redirectTo` = la route d'acceptation elle-même. GoTrue redirige avec les jetons dans le
**fragment** (flux implicite : une invitation admin n'ouvre aucun `flow_state` PKCE). Or ce Route
Handler ne lit ni fragment ni `?code`, et **aucun client navigateur n'est monté nulle part**
(`lib/supabase/client.ts` n'a aucun importeur), donc `detectSessionInUrl` ne tourne jamais. La route
reconclut `proof_required` et **renvoie un e-mail : boucle infinie**. C'est exactement le défaut que
le commit revendiquait d'avoir corrigé, réintroduit dans le `redirectTo`.

**Branche « compte existant »** : le passage par `/auth/callback?next=…` est correct, mais
`app/(auth)/reset-password/page.tsx` **ne lit jamais `searchParams`** (sa signature n'a aucun
paramètre) et `reset-password-form.tsx` n'émet **aucun champ `next`**. `actions.ts:191` reçoit donc
`null` → `/auth/landing` → l'invité atterrit sur `/onboarding` sans org ni client. **Jeton perdu,
invitation toujours `pending`.**

⚠ En corrigeant la branche « compte existant », tu armes `updatePassword` comme puits d'open
redirect : **fais V-1 d'abord.**

**Dépendance côté Étienne** : le gabarit d'e-mail Supabase doit pointer sur
`/auth/callback?token_hash={{ .TokenHash }}&type=invite`. C'est du dashboard, pas du code. Écris le
code qui fonctionne avec ce gabarit, et note dans ton rapport que le réglage reste à faire.

## V-3 — CSRF : forcer l'adhésion avec la session de la victime (important)

Le correctif prouve la **possession** de l'adresse, jamais l'**intention** de rejoindre.
`api/invitations/accept/route.ts:20` est un **GET à effet de bord**, sans contrôle `Origin` /
`Sec-Fetch-Site` / `Referer`, sans jeton anti-CSRF, sur des cookies `SameSite=Lax`. Une navigation
top-level depuis un site tiers crée une adhésion dans le client de l'attaquant avec la session
légitime de la victime.

**Gain vérifié, pas supposé** : `private.shares_scope_with` devient vraie, donc
`profiles_select_shared` ouvre à l'attaquant la ligne `profiles` de la victime (`full_name`,
`initials`, `timezone`, UUID). Fuite inter-tenant en un clic.

**Aggravant** : la victime **ne peut pas se retirer elle-même** — `client_members_delete` exige
d'être membre de l'org de l'attaquant.

**Correctif** : acceptation en **POST** derrière une page de confirmation explicite (« rejoindre le
client X ? »), vérification `Origin`/`Sec-Fetch-Site`, et **un membre doit pouvoir quitter un client
de lui-même** (nouvelle RPC, migration `034`).

## V-4 — Brancher le front sur les RPC qui existent enfin

Les migrations 032/033 sont appliquées. Vérifie que les chemins qui les appellent fonctionnent
réellement de bout en bout : révocation d'invitation, ré-invitation, retrait d'un membre, et
l'obtention d'une URL signée par un Reviewer. Le front avait été mergé sans garde alors que les RPC
n'existaient pas — assure-toi qu'il n'en reste aucun appel mort ni aucun message d'erreur générique
qui masquerait un vrai échec.

**Critère de sortie du LOT 0** : (a) `safeNext` ne rend plus jamais une chaîne qui commence par `//`,
prouvé par une propriété et non par une liste ; (b) une invitation envoyée aboutit à une session
reviewer sur le portail ; (c) la route d'acceptation refuse une requête cross-site ; (d) un membre
peut se retirer lui-même.

---

# LOT 1 — Upload des médias (phase 5, la partie qui manque)

Il n'existe **aucun chemin d'upload** : zéro `<input type="file">`, la drop-zone est un `<button>`
qui jette `e.dataTransfer`, `recordUploadedAsset` n'a aucun appelant, et `lib/media/paths.ts` fige
une convention que personne n'importe. Instagram refusant tout post sans média, c'est ce lot qui
rend la publication possible.

## Débloquer l'environnement d'abord (la session précédente a buté ici)

Le CLI Supabase n'est pas installé, et `supabase/config.toml` déclare les ports **par défaut**
(54321/54322) — occupés par le stack d'un autre projet qu'il est **interdit de tuer**.

1. Utilise `npx supabase@latest …` plutôt qu'une installation globale.
2. Décale les ports d'Ocean dans `supabase/config.toml` (api, db, shadow, studio, inbucket) vers une
   plage libre, par exemple 544xx.
3. ⚠ **Aligne `.github/workflows/ci.yml`** : il contient
   `postgresql://postgres:postgres@127.0.0.1:54322/postgres` **en dur**. Changer `config.toml` sans
   toucher la CI la casserait — et c'est le seul gate qui protège tout le reste.
4. Vérifie qu'après ton changement, `supabase start` monte sans collision **et** que le job `db` de
   la CI reste cohérent.

## Les tickets

- **P5-5** — `lib/media/` + upload TUS (`tus-js-client`, chunks de **6 Mo exactement**) vers
  `media-originals` (privé), chemin `{org_id}/{client_id}/{media_asset_id}/…` (règle 21).
- **P5-6** — Conversion JPEG côté client (PNG/**HEIC** — photos iPhone, cible prioritaire) et
  vignette WebP ~400 px → `media-thumbs`.
- **P5-7** — Une vraie zone de dépôt + sélecteur de fichier, dans la médiathèque et le composer.
- **P5-9** — Appliquer réellement l'intention de recadrage enregistrée par `applyCrop`.
- **P5-11** — Le portail rend un `<Image>` pour une vidéo (aucun `<video>` dans `apps/web`) : un Reel
  est approuvé à l'aveugle. *(À vérifier : le commit `52531d1` prétend l'avoir traité.)*

**Critère de sortie** : un fichier déposé depuis le navigateur arrive dans `media-originals` au bon
chemin, sa vignette dans `media-thumbs`, et il s'affiche dans la grille, le studio **et** le portail.
Pas de « code écrit mais jamais exécuté » — si tu ne peux pas transférer un octet, dis-le et arrête,
comme l'a fait la session précédente.

---

# LOT 2 — OAuth propre (phase 8, seulement si LOT 0 et LOT 1 sont finis et verts)

Connecter Meta pour un client rattache aujourd'hui **toutes** les Pages et comptes Instagram du
compte connecté, avec leurs tokens, et rien ne permet de détacher.

- **P8-1** — Écran de sélection des sous-comptes.
- **P8-2** — Détachement + révocation du secret dans le Vault (aucun `.delete()` nulle part : passif
  RGPD).
- **P8-3** — Échange long-lived Meta (`fb_exchange_token` = 0 occurrence : les tokens meurent en une
  heure).
- **P8-4** — `tokens/refresh.ts` réel, appel HTTP **hors** du verrou (règle 18).
- **P8-5** — State OAuth durci : `exp`, nonce à usage unique, lien de session, `codeVerifier` PKCE
  non lisible.
- **P8-6** — Scope `pages_manage_posts` (Meta ne rétro-accorde pas un scope), et stocker les scopes
  **accordés**, pas ceux demandés.
- **P8-7** — `needs_reauth` est écrit sur `platform_connections`, table que le web ne lit jamais :
  les 11 surfaces qui testent `social_accounts.status` sont mortes.

---

## Règles de travail — non négociables

- **Un commit par ticket**, dans l'ordre. Pas de commit fourre-tout.
- **Aucune écriture en ligne** (schéma, données, Storage). Migrations dans `034_*` et suivantes.
- **Toute migration a son test pgTAP.** La suite doit rester verte (338 ok / 0 not ok au 15/08).
- **Tout correctif de sécurité a un test qui échoue AVANT et passe APRÈS.** Vérifie-le par mutation,
  comme l'a fait `accept.test.ts` — c'est la seule preuve qui vaut. La leçon de cette semaine :
  8 tests verts ont certifié un filtre inopérant, et 9 autres un correctif qui ne corrigeait rien.
- **Méfie-toi des tests qui énumèrent.** Un test qui liste des cas connus ne prouve rien sur les cas
  inconnus. Préfère une propriété.
- **Jamais `biome check --write` sur tout le repo** : cible tes fichiers, mesure sur un arbre LF.
- **Preuve avant affirmation.** Commande lancée, sortie réelle collée.
- Si un ticket s'avère plus gros ou plus risqué que prévu, **arrête-toi et explique**.

## Protocole

Après chaque ticket : vérifie, commit, puis mets à jour `.planning/ACTION-PLAN.md` au format des
tableaux existants.

## Pièges connus

- Biome sous Windows : erreurs CRLF environnementales, la CI Linux est propre.
- pgTAP dans le conteneur `ocean_rev2` (`bash scripts/run-pgtap.sh`). Docker hors PATH :
  `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"` et `export MSYS_NO_PATHCONV=1`.
  Le runner saute les `*_storage.sql`.
- Vérifie que `plan` == nombre de tests émis dans chaque fichier pgTAP.
- `NEXT_PUBLIC_*` est inliné au build, y compris côté serveur : toute origine publique passe par une
  variable non préfixée (`SITE_URL`).
- Un dossier préfixé `_` est privé chez Next : exclu du routage.
- `middleware.ts` s'appelle `proxy.ts` en Next 16.
- Serveur de dev sur PORT=3010. Ne tue jamais les serveurs des autres projets.
- Ne réintroduis jamais de données mockées.

## Rendu final attendu

- Le tableau des tickets avec leur statut RÉEL.
- Pour chaque ticket : le commit et la preuve.
- **Pour V-1 : la sortie réelle de `safeNext` sur le corpus hostile, avant et après.**
- État final de `pnpm -w build`, `tsc --noEmit` (web et worker), `pnpm --filter worker test`,
  `pnpm --filter web test`, `pnpm check` (arbre LF), la suite pgTAP complète.
- Ta décision de conception sur V-3 (comment tu établis l'intention de rejoindre).
- Ce que tu as vu et volontairement PAS touché.
- Ce qui attend Étienne : gabarit d'e-mail Supabase, décisions produit, accès manquants.
