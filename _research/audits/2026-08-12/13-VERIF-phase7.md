# Verification adversariale — phase 7 (2026-08-15)

> Perimetre : commits `8f8e338`, `052f1cb`, `5b3c5ee`, `71eef5c`, `6db7894`, `bdde2c5`, `0769db1`
> (P7-1 a P7-10) + la part media de la phase 5 (`d9f6035`, `36cf8db`, migration 033).
> Methode : 6 angles d'attaque en lecture de code reel, execution effective des modules et des
> suites de tests, introspection du projet en ligne `hgdeopkmkwyoumsfggrm`.
> Chaque scenario a ete deroule pas a pas ; ce qui n'a pas pu etre deroule jusqu'au bout est
> marque INCERTAIN et n'est pas compte comme faille.

---

## Verdict

**La prise de controle de compte (P7-1) est REELLEMENT fermee.** Ce n'est pas un pansement : la
primitive de la faille a ete retiree du TYPE. `AcceptOutcome` (`apps/web/lib/invitations/accept.ts:60-72`)
n'a aucun membre capable de transporter un lien ou une session, `AcceptDeps` (`:74-90`) n'expose
aucune capacite de ce genre, et `admin.auth.admin.generateLink` n'existe plus nulle part ailleurs
que dans des commentaires. L'identite vient exclusivement de `supabase.auth.getUser()`
(`apps/web/app/api/invitations/accept/route.ts:43-49`), qui revalide le JWT cote Supabase.
Une quinzaine de variantes ont ete tentees pour re-obtenir la session d'autrui — jeton d'un tiers,
force brute, homoglyphes, `+alias`, U+212A, rejeu, course, compte deja existant, session non
confirmee : **toutes bloquees**. La mutation `if (false)` sur la garde `sameAddress`
(`accept.ts:137`) fait tomber les tests. L'invariant central tient.

**Mais quatre choses ne tiennent pas, et deux sont graves.**

1. **P7-8 n'est pas corrige.** `safeNext` s'echappe encore. Verifie par execution du module reel :
   `safeNext("/..//evil.tld")` renvoie `"//evil.tld"`, c'est-a-dire exactement la chaine que le
   correctif a ete ecrit pour refuser. 8 tests verts certifient un filtre inoperant. Le puits
   `app/(auth)/actions.ts:49` est exploitable aujourd'hui, sans authentification prealable, sur
   la page de connexion.

2. **Le correctif P7-1 prouve la POSSESSION de l'adresse, jamais l'INTENTION de rejoindre.** La
   route d'acceptation reste un GET a effet de bord, sans controle d'origine ni jeton anti-CSRF,
   sur des cookies `SameSite=Lax`. Une navigation top-level depuis un site tiers cree une adhesion
   dans le client de l'attaquant avec la session legitime de la victime.

3. **Le flux d'invitation legitime est un cul-de-sac dans ses DEUX branches.** Aucun invite ne peut
   aujourd'hui aboutir a une adhesion par le chemin nominal. Le defaut que le commit revendique
   avoir corrige (des jetons deposes dans un fragment que rien ne lit) est reintroduit tel quel
   dans le `redirectTo`.

4. **La revocation exigee par la regle 4 n'existe pas en base.** Verifie sur
   `hgdeopkmkwyoumsfggrm` : `invite_client_reviewer`, `revoke_client_invitation`,
   `remove_client_member`, `can_read_client_media` et `safe_uuid` sont **absentes de `pg_proc`**
   (seules `public.create_organization` et `private.can_write_client_media` existent). Les
   migrations 032 et 033 ne sont pas appliquees, et le front qui les appelle est deja merge sans
   garde : les boutons « revoquer » et « retirer » repondent PGRST202 → `db_error`.

Etat net : **la faille critique visee est morte ; le perimetre autour d'elle ne l'est pas, et un
correctif de la meme salve (P7-8) est inoperant.**

---

## Ce qui a ete attaque, et ce qui a tenu

### P7-1 — le coeur du correctif (ANGLES 1 et 2)

| Scenario | Resultat | Ou casse-t-il |
|---|---|---|
| Presenter le jeton de la victime depuis la session de l'attaquant | BLOQUE | `accept.ts:137` — `sameAddress` compare l'email de la SESSION a celui de l'invitation ; retour `wrong_account`, aucun appel a `bindMembership`, aucune bascule de compte proposee |
| Fabriquer une session par le jeton (le chemin historique) | BLOQUE | `accept.ts:60-72` + `:74-90` — la primitive est absente du type ; `route.ts:43-49` lit `getUser()` (revalidation serveur), jamais `getSession()` sur un cookie |
| Deviner / forcer le jeton | BLOQUE | `collaboration.ts:342` (`randomBytes(32)` = 256 bits) ; `accept.ts:97-99` recherche par sha256 ; `013_collaboration.sql:300` index unique sur `token_hash`. La comparaison a temps constant est un non-sujet : l'egalite porte sur le hash, pas sur le secret |
| Faire coincider deux adresses (casse, espaces, `+alias`, homoglyphe cyrillique, sous-chaine, U+212A) | BLOQUE | `accept.ts:93-95` — la normalisation n'ELARGIT que casse et espaces, l'egalite finale est exacte. U+212A est neutralise en amont par le `ToLower` Go de GoTrue |
| Rejouer un jeton consomme, expire ou revoque | BLOQUE | `accept.ts:101-105` — refus indistinct, aucune fuite sur CE QUI a echoue |
| Course entre deux acceptations concurrentes | BLOQUE | `route.ts:51-60` upsert `onConflict client_id,user_id` ; la contrainte `client_members_client_id_user_id_key` existe reellement en base (verifie) |
| Compte cible deja owner d'une org (oracle d'existence) | BLOQUE | `accept.ts:124-139` chemin de decision identique ; `route.ts:112-113` meme redirection dans les deux cas |
| Poser une ligne `client_members` sur un client d'une AUTRE org (PostgREST direct, ou via une invitation forgee consommee en service_role) | BLOQUE | `004_clients_members.sql:92-94` (`with check is_org_member(org_id)`) + FK composites `client_members_client_id_org_id_fkey` et `client_invitations_client_id_org_id_fkey`, verifiees vivantes en ligne. **C'est la regle 3 qui fait tout le travail ici** |
| UPDATE d'une invitation pour lui faire pointer le client d'une autre org | BLOQUE | La policy seule ne l'arrete PAS (`013:597-600` ne reevalue que `org_id`, et le grant UPDATE porte sur toutes les colonnes) — **seule la FK composite bloque** |
| Server Actions d'invitation avec un `clientId` d'une autre org ou un cookie `active_org_id` forge | BLOQUE | `_helpers.ts:21-32` (`requireClientInOrg`) ; `org-context.ts:82` — `memberships.find(...) ?? memberships[0]`, un cookie forge retombe sur une org dont on est reellement membre |

### P7-3 / P7-5 — flux de session et resolution de role (ANGLE 3)

| Scenario | Resultat | Ou casse-t-il |
|---|---|---|
| Reviewer tapant `/dashboard`, `/clients`, `/settings/accounts`, `/agenda`... | BLOQUE | `org-context.ts:78-80` `redirect('/onboarding')` ; 18 des 20 pages du groupe `(app)` rappellent `getActiveOrg` pour leur compte, les 2 restantes ne lisent aucune donnee serveur |
| Reviewer appelant directement une Server Action du groupe `(app)` (POST sur l'Action-Id) | BLOQUE | `_helpers.ts:22` → `org-context.ts:78` leve `NEXT_REDIRECT` AVANT le parse Zod et tout acces base. Les 4 fonctions sans garde vivent dans des modules `import "server-only"` sans `use server` : pas d'Action-Id, non adressables |
| Forger `active_org_id` pour lire une autre org | BLOQUE | `org-context.ts:73-82` — l'ensemble candidat est deja reduit aux orgs de l'utilisateur, doublement (filtre explicite + policy) |
| Boucle de redirection sur `/onboarding` | BLOQUE | `app/(auth)/onboarding/page.tsx:26-33` re-resout le role en tete de page ; les 4 cycles candidats testes convergent en 2-3 sauts |
| Revocation immediate (regle 4) cote donnees | BLOQUE | `dal.ts:17-22` `getUser()` = aller-retour reel a chaque requete ; `org-context.ts:122-128` relit `client_members` sous RLS ; aucun `unstable_cache`, aucun `revalidate` dans `app/` ni `lib/` ; `013:687-689` `submit_review_decision` reverifie `is_client_member` dans son corps |

### P5-10 / P5-5 — acces media du Reviewer (ANGLE 5)

| Scenario | Resultat | Ou casse-t-il |
|---|---|---|
| Reviewer du client 1 demandant une URL signee pour un media du client 2 de la MEME org | BLOQUE | `033:82` (voie agence : `is_org_member` faux par construction, regle 6) et `033:97` (voie reviewer : `is_client_member` resolu sur `ma.client_id`, la LIGNE, pas sur un segment de chemin) |
| Idem pour une AUTRE org | BLOQUE | Meme predicat. Non couvert par un test (voir plus bas) |
| Nom de fichier hostile (`../../autreOrg/x.jpg`, `%2e%2e`, unicode, segments en trop) | BLOQUE | Verifie empiriquement en ligne : `storage.foldername('org/cli/../../vic/f.jpg')` rend `{org,cli,..,..,vic}` — les `..` sont des segments litteraux ajoutes APRES les deux segments d'isolation. Pour decaler `[1]`/`[2]` il faudrait prefixer, ce qui fait echouer `is_org_member` |
| Chemin hors convention pour faire PLANTER la policy (`/a/b`, `org//cli`, `f.jpg`) | BLOQUE | `033:40-52` `private.safe_uuid` ne rattrape que `22P02` (le seul code que `text::uuid` peut lever) et retombe fail-closed. Confirme en ligne que le cast brut actuellement en prod leve bien une erreur 500 : la 033 transforme un DoS en refus propre |
| La 033 ouvre-t-elle une ECRITURE au Reviewer ? | BLOQUE | Verifie en ligne : une seule policy d'ecriture du schema `public` reference `is_client_member` (`content_comments_insert`, preexistante et bordee). Les 4 autres policies `storage.objects` sont intactes et exigent `is_org_member` |
| La 033 casse-t-elle les policies existantes, ou viole-t-elle la regle 23 ? | BLOQUE | `033:117-139` — aucun DELETE/TRUNCATE sur `storage.objects`, perimetre limite a `media_originals_select`, gardes `if exists` + `to_regclass`. Le `drop function ... (uuid, uuid, uuid)` de `033:67` est necessaire et correct : sans lui, le changement de signature aurait cree une SURCHARGE ambigue |

### P7-7 — revocation, re-invitation, retrait (ANGLE 6)

| Scenario | Resultat | Ou casse-t-il |
|---|---|---|
| Accepter une invitation revoquee, expiree, ou superseded par une re-invitation | BLOQUE | `accept.ts:101-105` + `032:67-71` et `032:131-139` |
| Se retrouver bloque en `already_invited` (le defaut d'origine) | BLOQUE | `032:131-147` — le UPDATE de supersession vise exactement le predicat de l'index partiel `client_invitations_pending_idx`, dans la meme transaction, avant l'INSERT. Les 5 etats candidats ont ete testes |
| Re-invitation reutilisant un ancien jeton | BLOQUE | `collaboration.ts:342-343` — `randomBytes` a chaque appel, aucun jeton accepte en entree |
| Membre d'une autre org / editor / reviewer tentant de revoquer | BLOQUE | `032:53-55`, `:108-110`, `:179-181` (`is_org_member` sur l'org resolue depuis la ressource) + `_helpers.ts:24-30` |
| Reviewer avec session active apres suppression de sa ligne `client_members` | BLOQUE | Aucune surface serveur ne survit : pages dynamiques (cookies), RLS reevaluee, `review_request_recipients` en cascade (`013:270`) |

**Ce qui donne le plus confiance dans ce dossier :** les FK composites de la regle 3 sont la seule
chose qui bloque plusieurs chemins (UPDATE d'invitation vers un autre client, insertion en
service_role d'une adhesion incoherente). Elles sont vivantes en production, verifiees. Si
quelqu'un les « simplifie » un jour en FK simples au motif que la policy suffit, deux failles
s'ouvrent le jour meme. A ecrire noir sur blanc.

---

## Ce qui ne tient pas

### 1. P7-8 — l'open redirect est TOUJOURS ouvert (critique)

**Verifie par execution**, pas par lecture. Sortie reelle du module `apps/web/lib/auth/safe-next.ts` :

```
"/..//evil.tld"              -> "//evil.tld"
"/.//evil.tld"               -> "//evil.tld"
"/%2e%2e//evil.tld"          -> "//evil.tld"
"/dashboard/../..//evil.tld" -> "//evil.tld"
"/..//evil.tld?x=1#y"        -> "//evil.tld?x=1#y"
"//evil.tld"                 -> "/dashboard"        (seule classe reellement fermee)
```

**Mecanique.** `safe-next.ts:55` teste `PROTOCOL_RELATIVE` sur `raw`, la chaine AVANT analyse.
`/..//evil.tld` n'a qu'une barre en tete : il passe. `safe-next.ts:59`, le parser WHATWG replie le
segment `..` (contre un chemin vide, no-op) puis empile le segment VIDE entre les deux barres →
`url.pathname === "//evil.tld"`. `safe-next.ts:65`, le « juge final » inspecte `url.origin`, qui
vaut toujours la sentinelle (l'hote a ete fixe par la base avant l'analyse du chemin) : il ne voit
rien. `safe-next.ts:68` renvoie ce pathname tel quel. **Le filtre est du mauvais cote du parser, et
c'est le parser qui fabrique la chaine interdite.** Le commentaire `:17-19` (« on n'essaie pas
d'enumerer les formes dangereuses ») est contredit par `:41`, qui est precisement une enumeration.

**Deroule complet du puits.** `https://app/login?next=/dashboard/../..//evil.tld` →
`components/auth/login-form.tsx:52` recopie `searchParams.get("next")` sans validation →
`:69` `<input type="hidden" name="next">` → la victime saisit son mot de passe →
`app/(auth)/actions.ts:49` `redirect(safeNext(formData.get("next"), "/auth/landing"))` =
`redirect("//evil.tld")`. Next 16.2.9 ne sanitise rien : `client/components/redirect.js` place
l'URL brute dans le digest ; sans JS `server/app-render/action-handler.js:817` pose
`Location: //evil.tld` ; avec JS `assign-location.js` resout `new URL("//evil.tld", canonicalUrl)`
= `https://evil.tld/`, `app-router-utils.js` `isExternalURL` → true → `completeHardNavigation`
(`segment-cache/navigation.js:262` ne bloque que `javascript:`). Pas de CSP, pas de `basePath`,
pas de `middleware.ts` racine.

**Ce qui EST protege, par accident et non par design :** `app/auth/callback/route.ts:25,28` et
`app/auth/landing/route.ts:23` concatenent `` `${origin}${next}` `` → `https://app//evil.tld`,
l'hote reste celui de l'app. Aucun test n'exprime cette difference, aucun commentaire ne la
mentionne : quiconque « simplifiera » ces concatenations en `NextResponse.redirect(next)` ouvrira
deux puits de plus. `actions.ts:191` (`updatePassword`) est la meme primitive, actuellement non
armee faute de champ `next` dans le formulaire — un correctif du point 3 ci-dessous l'armerait.

**Gravite.** Important, pas critique au sens fuite : aucun cookie, jeton ou donnee inter-tenant ne
part chez l'attaquant (la session Supabase est en cookie, et le seul flux porteur d'un code PKCE
passe par `/auth/callback`, qui est protege). L'impact est l'hameconnage post-authentification
depuis une origine authentique, juste apres la saisie du mot de passe — c'est-a-dire le scenario
P7-8 mot pour mot, declenchable par un lien, sans authentification prealable.

**Correctif (une ligne).** Valider la SORTIE, pas seulement l'entree :

```ts
const sortie = `${url.pathname}${url.search}${url.hash}`
return PROTOCOL_RELATIVE.test(sortie) ? fallback : sortie
```

Interdire la chaine `..` en entree serait un **second correctif inoperant** : `/.//evil.tld` n'en
contient pas.

---

### 2. P7-1 — CSRF : forcer l'adhesion avec la session de la victime (important)

**Scenario.** (1) L'attaquant s'inscrit (`/signup` public, `actions.ts:69`), cree une org
(`create_organization` est accordee a `authenticated` — reverifie en ligne :
`{postgres, authenticated, service_role}`), cree un client (`clients_insert` ne gate que sur
`is_org_member`). (2) Il invite `victime@x` ; `inviteReviewer` lui rend le jeton EN CLAIR
(`collaboration.ts:382`) et l'UI affiche l'URL complete (`reviewer-invite-dialog.tsx:71`).
(3) Il envoie a la victime un lien quelconque redirigeant vers
`https://app/api/invitations/accept?token=...`. (4) Navigation top-level : les cookies Supabase,
poses par `@supabase/ssr` sans override de `SameSite` (`lib/supabase/middleware.ts:30-32`, defaut
`lax`), partent. (5) `route.ts:43-49` lit la session de la VICTIME, `sameAddress` passe puisque
l'invitation vise justement son adresse, et `bindMembership` (`route.ts:51-60`) ecrit en
service_role, hors RLS.

**Ou.** `apps/web/app/api/invitations/accept/route.ts:20` — GET a effet de bord, aucun controle
`Origin` / `Sec-Fetch-Site` / `Referer`, aucun jeton anti-CSRF ; `/api/invitations` est un prefixe
public (`proxy.ts:21`) ; `lib/routes.ts:28` (`routes.acceptInvite`) pointe DIRECTEMENT sur la route
API — il n'existe aucune page de confirmation dans le flux.

**Gain verifie, pas suppose.** `private.shares_scope_with` branche (2) (`010:84-101`) devient vraie
pour l'attaquant, donc `profiles_select_shared` (`010:128-133`) lui ouvre la ligne `profiles` de la
victime. Butin reel : `full_name`, `initials`, `timezone`, UUID (l'email, il le connaissait deja
puisqu'il l'a saisi). Fuite inter-tenant, declenchee par un clic.

**Aggravants.** La victime ne peut pas se retirer elle-meme (`client_members_delete`,
`004:101-103`, exige d'etre membre de l'org de l'ATTAQUANT), et `remove_client_member` n'existe pas
en base. **Attenuant :** `landingFor` fait primer l'org sur le client, un owner ne sera donc pas
deroute vers `/portal` ; l'impact est maximal sur une victime Reviewer, dont le portail de
confiance affiche desormais un client entierement controle par l'attaquant.

**Pourquoi le correctif ne le voit pas.** L'invariant ecrit en tete de `accept.ts:26-30` — « une
adhesion n'est creee QUE si la requete porte deja une session dont l'email est EXACTEMENT celui de
l'invitation » — est **litteralement satisfait**. C'est justement pour cela qu'il est insuffisant :
la session de la victime le satisfait. Le correctif prouve la POSSESSION de l'adresse, jamais
l'INTENTION de rejoindre.

**Correctif.** Passer l'acceptation en POST derriere une page de confirmation explicite
(« rejoindre le client X ? »), verifier `Origin`/`Sec-Fetch-Site`, et permettre a un membre de
quitter un client de lui-meme.

---

### 3. Le flux d'invitation legitime est casse dans ses DEUX branches (critique fonctionnel)

**Branche « compte neuf ».** `route.ts:88` `inviteUserByEmail(email, { redirectTo })` avec
`redirectTo = origin + routes.acceptInvite(token)` (`route.ts:86`), c'est-a-dire la route
d'acceptation elle-meme. GoTrue verifie le lien puis redirige avec les jetons dans le FRAGMENT
(flux implicite : une invitation admin n'ouvre aucun `flow_state` PKCE). Or ce Route Handler ne lit
ni fragment ni `?code` : `exchangeCodeForSession` / `verifyOtp` n'existent QUE dans
`/auth/callback`. Et aucun client navigateur n'est monte nulle part — `lib/supabase/client.ts`
n'est importe par aucun fichier — donc `detectSessionInUrl` ne tourne jamais. Aucune session n'est
posee, la route reconclut `proof_required` et **renvoie un e-mail. Boucle infinie.**

**Branche « compte existant ».** `route.ts:93-97` passe bien par `/auth/callback?next=...`, mais
`app/(auth)/reset-password/page.tsx` **ne lit jamais `searchParams`** (verifie : la signature de
`ResetPasswordPage()` n'a aucun parametre) et `components/auth/reset-password-form.tsx` n'emet
**aucun champ `next`** (verifie : zero occurrence). `actions.ts:191` recoit donc
`formData.get("next") === null` → `/auth/landing` → l'invite atterrit sur `/onboarding`
(0 org, 0 client : l'adhesion n'est creee qu'au RETOUR sur la route d'acceptation). **Le jeton est
perdu, l'invitation reste `pending`.**

**Aggravation.** Le seul bouton de `/onboarding` est « creer mon organisation ». Si le client
invite le remplit — c'est l'action evidente — il devient owner d'une org fantome, et
`landing-rule.ts:26` (org > client) l'enverra sur `/dashboard` DEFINITIVEMENT, y compris apres
acceptation ulterieure de son invitation.

**Le comble.** C'est exactement le defaut que le commit revendique avoir corrige :
`accept.ts:41-43` decrit l'ancienne route comme deposant « ses jetons dans le FRAGMENT de l'URL,
que rien cote serveur ne lit ». Il est reintroduit tel quel dans `redirectTo`. Le commentaire
`route.ts:82-83` (« une fois la session ouverte, l'invite revient ici avec son jeton et l'adhesion
est creee ») est faux : rien entre GoTrue et cette route ne pose de cookie.

**Correctif.** Le bon motif existe deja a dix lignes de la — `requestPasswordReset`
(`actions.ts:162`) pointe son `redirectTo` sur `/auth/callback?next=...`. Faire pointer les DEUX
branches sur `/auth/callback?next=<accept encode UNE SEULE FOIS>`, et faire suivre `next` dans
`reset-password/page.tsx` + le formulaire (attention : cela armera le puits `actions.ts:191`, donc
corriger le point 1 d'abord).

---

### 4. La revocation de la regle 4 n'existe pas en base, et le front est merge sans garde (critique)

**Verifie en ligne sur `hgdeopkmkwyoumsfggrm`** (`pg_proc` × `pg_namespace`) :

| Fonction | Presente ? |
|---|---|
| `public.create_organization` | oui |
| `private.can_write_client_media` | oui |
| `public.invite_client_reviewer` | **non** |
| `public.revoke_client_invitation` | **non** |
| `public.remove_client_member` | **non** |
| `private.can_read_client_media` | **non** |
| `private.safe_uuid` | **non** |

Les migrations 032 et 033 sont ecrites, presentes dans `supabase/migrations/`, et **non appliquees**.
Consequences dures :

- `collaboration.ts:353` (`invite_client_reviewer`), `:404` (`revoke_client_invitation`), `:439`
  (`remove_client_member`) repondent PGRST202 → `{ ok:false, error:'db_error' }`. **Personne ne
  peut inviter, revoquer ni retirer un reviewer en ligne aujourd'hui.** Le commit `bdde2c5` a
  converti un INSERT qui fonctionnait en un appel RPC qui n'existe pas cote serveur.
- La regle 4 — « revoquer un Reviewer doit etre effectif IMMEDIATEMENT », raison d'etre du refus
  des claims JWT dans ce projet — **n'est pas implementee sur le systeme deploye**.
- L'UI correspondante est deja mergee : `reviewer-access-list.tsx:108-122` est rendu par
  `settings-shell`, sans feature flag, sans capability check, sans degradation. Un utilisateur qui
  clique « Retirer » obtient un toast d'erreur generique et croit a un bug transitoire.
- P5-10 est INTACT en production : `media_originals_select` porte encore
  `can_write_client_media((foldername(name))[1]::uuid, (foldername(name))[2]::uuid)` — verifie en
  ligne. Le Reviewer continue de valider sur la vignette 400 px.

Cote securite c'est fail-closed, donc pas une faille — mais cela signifie que **tout le correctif
P7-7 et les garanties de la regle 4 sont non verifies en conditions reelles**, et que les defauts
signales aux points 5 et 7 ci-dessous sont encore corrigeables a cout zero, AVANT application.

---

### 5. `public.profiles.email` est reinscriptible et sert de cle d'identite (important, latent)

**Verifie en ligne :** `information_schema.column_privileges` donne `UPDATE` sur la colonne
`profiles.email` a `authenticated` (et `anon`, sans effet : `profiles_update_own` exige
`id = auth.uid()`). Le grant `003_identity_orgs.sql:165` est table-level, sans liste de colonnes ;
la policy `003:135-138` n'epingle que `id`, en USING comme en WITH CHECK. Aucun trigger ne
resynchronise depuis `auth.users` (le seul trigger sur `profiles` est `profiles_set_updated_at`,
et `handle_new_user` est un AFTER INSERT). Aucun code applicatif n'ecrit cette colonne : les 4
call sites (`collaboration.ts:32`, `org-context.ts:91`, `org-context.ts:136`,
`notify-org.ts:105`) sont des SELECT. **La falsification est permanente**, et atteignable par un
simple PATCH PostgREST avec la cle anon publique.

**Le defaut de conception.** La REVOCATION est indexee sur un miroir que le sujet reecrit lui-meme
(`032:183` `select lower(email) from public.profiles where id = _user`), alors que
l'AUTHENTIFICATION est indexee sur `auth.users.email`, qu'il ne peut pas toucher
(`route.ts:43-49`). **Des que les deux divergent, `remove_client_member` vise la mauvaise adresse
pendant que `accept.ts` accepte encore la bonne.**

**Deroule.** (1) Le reviewer PATCHe son `profiles.email`. (2) Il demande a l'agence de « renvoyer
l'invitation » — geste de support banal, supporte par l'UI (`reviewer-access-list.tsx:100`) et
d'autant plus naturel que la liste d'acces affiche l'email issu de `profiles` (`pro.ts:927`), donc
l'adresse reelle du reviewer n'apparait nulle part. Le garde « deja membre » (`032:118-126`), qui
joint `client_members` a `profiles` sur `lower(p.email)`, ne le voit plus comme membre et laisse
creer un jeton VIVANT vers sa vraie boite. (3) L'agence le retire : `remove_client_member` supprime
bien l'adhesion (par `user_id`) mais revoque sur la mauvaise adresse (`032:197-204`). (4) Il rejoue
le lien : l'email d'AUTH n'a pas bouge, `sameAddress` passe, `bindMembership` recree l'adhesion.

**Corollaire sans attaquant :** `profiles.email` est NULLABLE. Si `v_email` est null, le
`if v_email is not null` (`032:197`) saute tout le balayage **et la RPC renvoie quand meme `true`**
(`032:206`) — l'UI affiche « membre retire » alors qu'un jeton vivant subsiste.

**Reserves honnetes.** L'etape (2) exige un geste de l'agence (le reviewer ne peut que le
solliciter) ; l'impact est borne (retour sur UN client dont il etait deja membre — pas de fuite
cross-tenant, pas de session forgee) ; et 032 n'etant pas deployee, c'est un defaut latent dans du
code en revue, pas une faille en ligne. Mais **la moitie habilitante (le grant) est LIVE**.

**Correctif.** `grant update (full_name, initials, timezone) on public.profiles to authenticated`
au lieu du grant table-level ; resoudre l'adresse sur `auth.users` cote SECURITY DEFINER ; et
balayer AUSSI `where accepted_user_id = _user` (la colonne existe, `013:290`). Ne renvoyer `true`
que si les deux gestes ont eu lieu.

**Consequence independante de la meme racine (mineur, latent) :** `notify-org.ts:105` lit
l'adresse de destination sur cette meme colonne, via le client service_role. Un attaquant a deux
comptes gratuits peut donc faire livrer un e-mail Brevo authentique, signe du domaine du produit,
a une adresse qu'il choisit, avec ~400 caracteres de texte controle (`collaboration.ts:183`).
Plafonne par : template Brevo fige, CTA construit en `siteOrigin() + routes.content(...)` donc non
controlable, dedoublonnage `notify-org.ts:63-73`. Inerte aujourd'hui (`BREVO_API_KEY` vide →
`notify-org.ts:77`). **A fermer AVANT de cabler Brevo, pas apres.**

---

### 6. `sendProofOfPossession` est un emetteur d'e-mails non authentifie et non limite (important)

**Scenario.** L'attaquant mint un jeton valide (org + client + invitation, tous gates seulement par
`is_org_member` de SA propre org), se deconnecte, puis appelle en boucle
`GET /api/invitations/accept?token=...`. Route publique (`proxy.ts:21`), pas de session →
`accept.ts:130-133` appelle `sendProofOfPossession` **avant toute authentification**.

- **Premier appel :** `route.ts:88` `inviteUserByEmail` CREE une ligne `auth.users` pour une
  adresse tierce, ce qui declenche `on_auth_user_created` (`003:77`) et cree un `profiles`.
- **Appels suivants :** l'invitation echoue (compte deja enregistre) et le code tombe sur
  `route.ts:93` `resetPasswordForEmail` — **un vrai e-mail de reinitialisation de mot de passe**,
  emis par le projet legitime, vers une adresse choisie par l'attaquant, autant de fois qu'il veut.

Aucun compteur, aucun cooldown, rien n'est ecrit sur l'invitation pour marquer l'envoi (`grep`
`rateLimit|throttle` sur `apps/web` : vide). **C'est l'interaction P7-1 × P7-2 qui rend le flot
illimite** : le jeton est deliberement conserve rejouable (correctif P7-2 assume), et chaque rejeu
declenche un envoi.

Ce n'est PAS une ATO — le secret part bien vers la boite de la victime, l'invariant central tient.
C'est un **amplificateur d'hameconnage** (la victime recoit un vrai reset d'un vrai domaine, juste
avant de recevoir le faux) et un **epuisement du quota e-mail** du projet, partage avec les magic
links et les resets de tout le monde. Seul frein actuel : les quotas SMTP Supabase — qui sautent
des que Brevo est cable.

**Note de conception :** `resetPasswordForEmail` (`route.ts:93`) est appelee avec le client serveur
lie aux cookies de la REQUETE, donc le `code_verifier` PKCE est ecrit chez l'appelant. L'attaquant
n'en tire rien (le `code` part chez la victime), mais **la victime qui clique n'a pas le verifier**
et l'echange echoue — ce qui aggrave le point 3.

**Correctif.** N'envoyer que sur POST authentifie par une action explicite de l'invite, ou au
minimum un compteur par invitation (`proof_sent_count` / `last_proof_sent_at`) et un plafond.

---

### 7. Migration 033 — la voie reviewer neutralise le mecanisme d'isolation de la regle 21 (important)

`033:93-99` :

```sql
or exists (
  select 1 from public.media_assets ma
  where ma.storage_path = _object_name
    and (select private.is_client_member(ma.client_id))
    and (select private.is_reviewer_visible_media(ma.id))
);
```

**`_org` et `_client` — c'est-a-dire les segments [1] et [2] du chemin, le mecanisme d'isolation de
la regle 21 — ne sont utilises que par la voie AGENCE (`033:82`). La voie reviewer les ignore
totalement.** Une ligne `media_assets` dont le `storage_path` pointe vers le prefixe d'un AUTRE
tenant ouvre donc la lecture de cet objet, parce que rien ne confronte le chemin a la ligne.

Chaine complete : `create_organization` (ouverte a tout `authenticated`) → client → auto-inscription
dans `client_members` (`004:92-94` : le WITH CHECK ne porte QUE sur `org_id`, rien n'interdit d'y
mettre son propre `user_id`) → INSERT direct dans `media_assets` par PostgREST avec un
`storage_path` arbitraire (`012:322-324` : le WITH CHECK est `is_org_member(org_id)` seul ;
**aucune contrainte, aucun trigger, aucun check ne relie `storage_path` a `org_id`/`client_id`** —
verifie en ligne) → `is_reviewer_visible_media` est vraie par sa seconde branche (`012:162-167` :
`source='depot_client' AND uploaded_by = auth.uid()`, qui ne demande ni contenu rattache, ni
statut, ni coherence de chemin).

**Le seul obstacle est l'index UNIQUE GLOBAL `media_assets_storage_path_idx`** (`012:65-67`,
confirme en ligne), qui fait echouer en 23505 la reclamation d'un chemin DEJA enregistre. Deux
reserves : (a) cet index protege la victime **en effet de bord de la deduplication**, il n'a jamais
ete concu comme frontiere de tenant, et une future migration qui le scope ou le rend non-unique
ouvrirait la faille sans que personne ne voie le rapport ; (b) il ne couvre pas les chemins
orphelins (televersement reussi + enregistrement rate, objet ecrit par le worker hors
`media_assets`, ou `storage_path` remis a NULL par la purge J+7 documentee en `012:30` — code de
purge introuvable a ce jour, donc fenetre theorique mais qui deviendra reelle). Le chemin d'un
media est par ailleurs connu de quiconque a recu une URL signee : elle le contient en clair.

**Correctif, une ligne, sans rien perdre du cas legitime :** ajouter
`and ma.org_id = _org and ma.client_id = _client` dans le `exists`. Pour un asset range selon la
convention, `safe_uuid(seg1) = ma.org_id` et `safe_uuid(seg2) = ma.client_id`, donc le cas normal
passe toujours ; une ligne plantee est refusee immediatement, sans dependre d'un index.

---

### 8. `recordUploadedAsset` n'oppose jamais le chemin au tenant (important)

`apps/web/lib/actions/media.ts:21` : `storagePath: z.string().min(1).max(1024)`. Rien d'autre.
`requireClientInOrg` (`_helpers.ts:22-32`) valide le CLIENT, jamais le CHEMIN, et le `storagePath`
est insere tel quel — alors que `orgId` et `d.clientId` sont disponibles sur place.

**Le comble :** la fonction faite pour ca existe, est testee, et est documentee mot pour mot pour
cet usage — `apps/web/lib/media/paths.ts:110-123`, « Utile cote serveur pour recouper qu'un chemin
fourni par le navigateur vise bien le tenant attendu — defense en profondeur ». **Elle n'est
importee par aucun fichier de production** : `grep` sur tout `apps/web` ne rend qu'une ligne,
`lib/media/paths.test.ts:11`. La defense en profondeur a ete ECRITE, TESTEE, puis jamais branchee.

**Correctif, deux lignes :**
```ts
const t = tenantOf(d.storagePath)
if (!t || t.orgId !== orgId || t.clientId !== d.clientId) return { ok:false, error:'invalid_path' }
```
(La porte PostgREST directe reste ouverte tant que le point 7 n'est pas corrige cote SQL.)

---

### 9. Les RPC de la 032 ne sont pas un goulot d'etranglement (important, latent)

**Verifie en ligne :** `authenticated` conserve `INSERT`, `UPDATE` et `DELETE` **table-level** sur
`public.client_invitations` (`013_collaboration.sql:636`, sans liste de colonnes — donc
`token_hash`, `accepted_at`, `revoked_at`, `status`, `role`, `expires_at` compris) et sur
`public.client_members` (`004:106`). 032 ajoute trois SECURITY DEFINER qui posent des invariants
mais **ne retire rien a la surface d'ecriture directe**.

Consequences, toutes deroulables dans son propre tenant :
- `PATCH {revoked_at:null, status:'pending'}` ressuscite une invitation « revoquee », `token_hash`
  inchange : l'ancien jeton, cense « mourir a l'instant » (`032:128-130`), revient.
- `PATCH {accepted_at:null}` rend rejouable une invitation consommee, contournant le refus explicite
  de `revoke_client_invitation` (`032:61-65`).
- `DELETE` efface toute trace apres usage. Aucun de ces gestes ne passe par une RPC, aucun ne laisse
  de journal.
- Invitation « fantome » a espace : le CHECK est `email = lower(email)` (`013:296`) — `lower()` ne
  trim PAS, donc `'moi@x.fr '` est une cle DISTINCTE dans l'index partiel, invisible au balayage de
  `remove_client_member` (`032:200-203`, `lower(email)` exact) **mais valide a l'acceptation**
  (`accept.ts:93-95` TRIM les deux cotes). Deux normalisations qui divergent ; tout ce qui vit dans
  l'ecart survit a la revocation.

Ce n'est pas une elevation inter-tenant (la policy + les FK composites tiennent) : **c'est une
primitive de PERSISTANCE**. Tout ce qu'on ecrit pendant qu'on est membre survit a l'expulsion,
parce que l'acceptation tourne en service_role et ne reverifie jamais l'appartenance de l'inviteur
(`route.ts:52-60`).

**Correctif.** `revoke insert, update, delete on public.client_invitations from authenticated` —
les trois RPC couvrent desormais tout le cycle de vie legitime. Et normaliser a l'ecriture :
`check email = lower(btrim(email))`, index sur `lower(btrim(email))`.

---

### 10. Defauts mineurs confirmes

- **`error=invite_other_account` est structurellement inaffichable.** `route.ts:118` redirige vers
  `/login?error=...`, mais `proxy.ts:50-55` intercepte `/login` des qu'une session existe — et cet
  etat n'est atteignable QUE session ouverte (`accept.ts:137-141`). Le parametre `error` est jete
  (`proxy.ts:53-54` ne reconstruit que `next`). Rendu mort a 100 % dans le commit qui l'ajoute
  (`login-form.tsx:34-36`). *Correction du rapport d'attaque : ce n'est PAS `052f1cb` qui cree le
  trou — `git show 052f1cb^:apps/web/proxy.ts` montre que l'ancien proxy effacait deja tout
  `url.search` sur `/login` ; 052f1cb ameliore ce hop. Et `error=auth` n'est concerne que dans le
  sous-cas « session valide », pas « session perimee » (qui donne `user=null`, donc pas
  d'interception).* Aucune propriete de securite ne tombe : etat fail-closed, le jeton n'est pas
  brule, un nouveau clic apres deconnexion donne `/login?invite=sent`, qui s'affiche. **Correctif :
  laisser passer `error` dans `proxy.ts:53-54`.**

- **Reviewer invite sur deux clients de deux orgs → 500 sur la fiche de detail.**
  `org-context.ts:144` retient `memberships[0]?.org_id` (et la requete `:122-127` n'a pas
  d'`.order()`, donc lequel n'est pas stable), puis
  `app/(portal)/portal/[contentId]/page.tsx:39` fait `(await getClient(reviewerCtx.orgId,
  content.clientId)) as Client` → `null` masque par le cast → `client.timezone` → TypeError.
  **C'est exactement le defaut P7-9 que `8f8e338` vient de corriger dans `portal/page.tsx:38`, et
  qui a ete laisse intact dans le fichier voisin.** Deux lignes plus bas, `getComments` et
  `getApprovals` recoivent le meme `orgId` errone et renverraient un fil vide sans le dire.
  Fail-closed (le filtre est trop strict, pas trop laxiste), aucune fuite, et les ecritures sont
  saines (`collaboration.ts:19-44` resout org/client depuis la ligne `content_items`). Mais le
  portail est inutilisable pour le profil normal d'un client travaillant avec deux freelances.

- **Un `org_role='admin'` peut retirer n'importe quel membre client, y compris l'owner.** Les trois
  RPC de 032 n'exigent que `is_org_member` (`032:179-181`), alors que `003:147-149` a explicitement
  juge, trois lignes plus haut dans le meme depot, qu'un admin ne devait pas toucher aux
  appartenances d'ORG. Asymetrie peut-etre voulue, mais non documentee. Au passage,
  `revokeInvitation` (`collaboration.ts:404-406`) exige un `clientId` que la RPC IGNORE : un
  parametre de controle qui ne controle rien.

- **Le retrait ne ferme pas les acces media derives.** Les vignettes viennent de `getPublicUrl` sur
  le bucket PUBLIC (`content-media.ts:60`) : un reviewer retire garde a vie tout ce qu'il a vu en
  400 px (par construction, regle 20 — pas un bug, mais a savoir). Les originaux restent lisibles
  jusqu'a 60 min apres le retrait (`content-media.ts:13`, `SIGNED_URL_TTL = 3600`) : une URL signee
  Storage n'est pas revocable, la policy n'est consultee qu'a la GENERATION. La regle 4 est donc
  fausse pendant une heure sur ce canal — et la 033 vient precisement d'OUVRIR ce canal au
  reviewer, sans que P7-7 en tienne compte.

- **`route.ts:66-73` jette le retour de l'UPDATE qui consomme l'invitation** : `bindMembership`
  renvoie `true` meme si l'invitation n'a jamais ete marquee `accepted`. La route annonce
  « accepted » pendant que le jeton reste vivant 14 jours. *Correctif : verifier l'erreur, renvoyer
  `unavailable` ; et ajouter `.is('revoked_at', null)` a l'UPDATE avec abandon si 0 ligne, ce qui
  ferme au passage la fenetre TOCTOU (~100 ms) entre `findInvitation` et `bindMembership`.*

- **`start_url: '/dashboard'`** (`app/manifest.ts:9`) : la PWA installee d'un Reviewer — persona
  prioritaire iOS — demarre a froid sur `/dashboard` et rebondit deux fois avant `/portal`.
  `landing/route.ts:21` laisse par ailleurs n'importe quel `next` court-circuiter la regle de role.
  Ferme (la garde finale `getActiveOrg` rattrape), mais l'affirmation « un seul endroit decide ou
  atterrit un compte » est fausse : quatre points en decident encore.

- **Aucune Server Action `switchOrg` n'existe.** `active_org_id` n'est ECRIT nulle part dans
  `apps/web` (seule occurrence hors commentaire : la lecture `org-context.ts:71`). Un owner
  multi-org ne peut pas choisir son org, et le repli `memberships[0]` est pris sur une requete sans
  `.order()` : l'org active peut basculer silencieusement entre deux requetes, et chaque ecriture
  injecte `org_id: ctx.org.id`. Donnees propres du meme compte, donc pas une fuite — bombe a
  retardement des qu'un freelance aura deux structures.

---

## Qualite des tests livres

**Etat reel de la suite** (execute) : `pnpm --filter web test` → **34 tests, 34 pass, 0 fail**.
*(Correction d'un rapport d'attaque : le fichier non suivi `lib/auth/__invariant-probe.test.ts` qui
aurait rendu la suite rouge n'existe plus dans l'arbre — `ls lib/auth/` ne rend que
`dal.ts, landing-rule.{ts,test.ts}, landing.ts, org-context.ts, safe-next.{ts,test.ts},
slug.{ts,test.ts}`.)*

### Les tests qui prouvent quelque chose

- **`lib/invitations/accept.test.ts` (6 tests) — le meilleur du lot.** Verifie par **mutation** sur
  une copie hors depot : remplacer `if (!sameAddress(...))` par `if (false)` (`accept.ts:137`) fait
  tomber 1 test ; restaurer le comportement d'AVANT (resoudre l'utilisateur par email sans session)
  en fait tomber 2, dont le test ATO principal. Ce ne sont pas des tests qui ne peuvent pas
  echouer. L'assertion `!("actionLink" in outcome) && !("redirect" in outcome) && !("session" in
  outcome)` (`accept.test.ts:87-90`) est le bon reflexe : elle fige **au niveau du TYPE** l'absence
  de la primitive de la faille, donc elle vise la cause et non le symptome.
- **`lib/auth/slug.test.ts` (6 tests)** : fonction pure, cas qui ne s'inventent pas depuis un
  fauteuil (NFD, troncature tombant sur un tiret, bornes des candidats). Le cas « ç » a corrige le
  test et non l'inverse — signature d'un test qui a reellement tourne.
- **`supabase/tests/033_reviewer_media_read.test.sql`, tests 5-7** : le couple 5/6 est un vrai
  avant/apres (le 6 ne pouvait pas passer avant `d9f6035`, la fonction n'existait pas), et le
  test 7 (`:130`) est le seul test de NON-sur-ouverture — il echouerait si quelqu'un remplacait le
  predicat par `is_client_member` nu. La limite est declaree honnetement en tete de fichier
  (`:9-12`).
- **`supabase/tests/032_invitation_lifecycle.test.sql`, test 1 (`:57-67`)** : execute l'INSERT nu et
  exige le 23505. Il prouve le DEFAUT lui-meme, pas la correction — c'est la bonne facon de faire.

### Les tests decoratifs

- **`lib/auth/safe-next.test.ts` — le cas d'ecole.** Son dernier test (`:80-97`) s'appelle « la
  sortie est TOUJOURS un chemin relatif interne » et porte **la BONNE assertion**
  (`assert.ok(!sortie.startsWith("//"))`, plus une re-resolution d'origine). Mais c'est une
  **ENUMERATION deguisee en invariant** : sa liste (`:81-89`) contient 7 entrees choisies a la main,
  toutes deja tuees par les gardes amont, et **aucune ne contient de dot-segment**. L'assertion ne
  peut jamais se declencher. Une seule entree ajoutee (`/..//evil.tld`) la fait passer au rouge
  immediatement. **8 tests verts certifient un filtre qui laisse encore sortir du domaine** — le
  motif exact de la migration 033 v1.
  Manque aussi : le fichier contient un **octet NUL a l'offset 1650 (ligne 56)**, ce qui fait
  classer le fichier en binaire par git — `git show 0769db1 -- ...safe-next.test.ts` n'affiche
  RIEN. Le test qui certifie un correctif de securite est **invisible en revue de code**, et la
  ligne qu'un humain lit `"/ //evil.tld"` teste en realite `"/\0//evil.tld"`.
- **`lib/media/paths.test.ts` (9 tests) — sur un module que personne n'importe.** Confirme :
  `grep` sur tout `apps/web` ne rend que `paths.test.ts:11`. Ces tests figent une convention
  appliquee nulle part. « Un nom de fichier ne peut PAS injecter de segment supplementaire »
  (`:30`) teste une fonction qu'aucun televersement n'appelle.
- **`032_invitation_lifecycle.test.sql` — la garantie NEUVE n'est jamais executee.** Le corps de
  `remove_client_member` fait deux choses : le DELETE (qui existait DEJA avant 032, via
  `client_members_delete`, `004:101-103`) et la revocation des invitations vivantes de la meme
  adresse (`032:197-204`), presentee dans la docstring comme la raison d'etre de la fonction. Or
  **au moment de l'appel (`test:171`), les lignes `:155-161` viennent d'asserter qu'il reste ZERO
  invitation vivante.** Le UPDATE de balayage tourne sur un ensemble vide, et les deux assertions
  qui suivent (`:171-186`) ne verifient que la disparition de la ligne `client_members`. **Supprimer
  tout le bloc `if v_email is not null then ... end if;` laisse les 14 tests verts.** Le test
  certifie la moitie qui existait deja et ignore la moitie ajoutee.
  Trois autres branches a zero test : le refus d'une invitation DEJA ACCEPTEE (`032:61-65`, mise en
  avant dans le message de commit), le garde de tenant de `revoke` (`032:53-55` — `invite` et
  `remove` ont le leur, pas `revoke`), et le garde « adresse deja membre » (`032:118-126`, cable
  jusqu'a l'UI mais jamais exerce : le seul `insert into client_members` arrive APRES les deux
  appels a `invite_client_reviewer`).

### Les trous structurels

1. **Aucun Route Handler de cette application ne peut etre teste.** Le glob
   (`apps/web/package.json:8` — `node --import tsx --test "lib/**/*.test.ts"`) exclut `app/`. Les 6
   tests de P7-1 portent uniquement sur `acceptInvitation`, fonction pure dont les 4 dependances
   sont stubees (`accept.test.ts:49-69`). `route.ts` n'est jamais charge, jamais importe.
   **Consequence concrete : on pourrait remettre `admin.auth.admin.generateLink` dans `route.ts` et
   rediriger dessus — les 6 tests resteraient verts.** La propriete demontree est « la fonction de
   decision est correcte », pas « la route est sure ». Or l'attaquant n'atteint que la route.
   Et de fait, **les defauts les plus serieux vivent TOUS dans `route.ts`** : `redirectTo` qui ne
   peut pas poser de session (`:86-88`), `next` perdu (`:93-97`), GET CSRFable (`:20`), erreur de
   l'UPDATE non verifiee (`:66-73`).
2. **Aucun test de consommateur pour `safeNext`.** La MEME valeur empoisonnee est inoffensive dans
   `/auth/callback` (concatenation d'origine) et letale dans `actions.ts` (`redirect` nu). Cette
   protection est **accidentelle** : rien ne l'exprime, rien n'empeche de la « nettoyer » demain.
3. **La policy `media_originals_select` n'est testee nulle part** — c'est pourtant elle qui cable
   `safe_uuid((storage.foldername(name))[1])`. Le cablage a change entre `d9f6035` et `36cf8db`, la
   couverture n'a pas bouge. C'est exactement le trou du precedent de la 033 v1.
4. **Trou regle 8 sur la 033** : le test n'instancie qu'UNE org et UN client. Le leak test exige
   par la regle 8 (« un Reviewer du client 1 ne voit JAMAIS le client 2 de la meme org ») n'existe
   pas ; le test 9 ne couvre qu'un etranger a l'org ET au client, c'est-a-dire le cas facile.
   Aucune seconde org.
5. **Zero test TypeScript pour P7-7** : `git show --name-only bdde2c5` ne contient aucun fichier de
   test sous `apps/web`. `revokeInvitation`, `removeClientMember` et `getClientAccess` sont livres
   nus, alors que P7-1 (meme salve) avait produit `accept.test.ts`.
6. **Zero test sur `resolveLanding`, `/auth/landing`, le proxy, `getActiveOrg`** — donc zero test
   de la revalidation du cookie (regle 10). Les defauts 3, 10 et l'absence de `switchOrg` sont tous
   invisibles a la suite livree.
7. **Les pgTAP tournent sur un schema que la prod n'a pas.** 032 et 033 ne sont pas appliquees, et
   la CI qui les ferait tourner n'a jamais tourne.
8. **Branche morte non attrapee** : l'action renvoie desormais `already_member`
   (`collaboration.ts:361`) alors que `reviewer-invite-dialog.tsx:61` et `wizard-shell.tsx:163`
   testent encore `already_invited`. L'utilisateur voit un message generique.

---

## Restes a traiter

Hors perimetre strict de la phase 7, mais revele par l'attaque :

1. **`create_organization` accordee a tout `authenticated`** (reconfirme en ligne). C'est
   l'amplificateur de la moitie des scenarios ci-dessus : deux comptes gratuits suffisent a devenir
   inviteur, a se fabriquer un client, a s'auto-inscrire dans `client_members`. En phase solo c'est
   une decision consciente ; a l'ouverture SaaS, c'est un multiplicateur de gravite. A tracer
   comme dette explicite.
2. **`client_members_insert` ne contraint que `org_id`** (`004:92-94`). Un membre d'org peut donc
   attacher n'importe quel compte existant a son client, **sans invitation ni consentement**,
   court-circuitant entierement la porte P7-1. Classe INCERTAIN et non CONTOURNEMENT parce que
   l'UUID v4 de la victime n'est pas enumerable (`profiles` est ferme par
   `profiles_select_own`/`_shared`) — **mais la CSRF du point 2 fournit precisement le chemin qui
   manque, en faisant faire l'insertion par la victime elle-meme.** Durcissement : n'autoriser cet
   INSERT qu'au service_role, ou exiger une invitation acceptee correspondante.
3. **`email_confirmed_at` n'est jamais consulte** (`route.ts:43-49`). La signature en base du projet
   en ligne (`confirmation_sent_at` NULL, `email_confirmed_at` = created_at + 24 ms) suggere une
   confirmation d'e-mail desactivee — non verifiable depuis ici (le MCP n'expose pas les reglages
   auth), donc INCERTAIN. Defense en profondeur bon marche : exiger `email_confirmed_at` non nul
   dans `currentIdentity` rendrait l'invariant vrai independamment d'un reglage de tableau de bord
   que personne ne relit.
4. **`siteOrigin()` retombe sur `x-forwarded-host` / `host`** (`lib/site-url.ts:56-64`) quand
   `SITE_URL` est absente, et la route d'acceptation s'en sert pour un `redirectTo` transmis a un
   tiers (GoTrue) ET pour des redirections de navigateur. Non exploitable si le runbook est
   respecte (`deploy/GO-LIVE-points-1-2.md:39` pose `SITE_URL` comme obligatoire), mais ces deux
   usages veulent `requireSiteOrigin()`, qui existe deja dans le meme fichier et leve plutot que de
   deviner.
5. **La purge J+7 des medias n'existe pas encore** (`supabase/functions/` absent). Quand elle sera
   ecrite, l'ordre des operations (supprimer l'objet PUIS nuller `storage_path`, jamais l'inverse,
   et jamais nuller si la suppression Storage a echoue) deviendra une **contrainte de securite** —
   ce que personne ne saura, puisque ce n'est ecrit nulle part. Le correctif du point 7 rend ce
   scenario sans objet.
6. **`revalidatePath('/portal')` (`collaboration.ts:449`) ne participe pas a l'immediatete de la
   revocation** : `/portal` est dynamique et par-utilisateur, cet appel ne peut pas invalider la
   page d'un AUTRE utilisateur. Inoffensif mais trompeur.
7. **`'editor'` n'apparait dans AUCUNE policy** des migrations (seulement `002_enums.sql:73`) :
   `client_role` est binaire dans les faits. Le role pose par une invitation forgee n'apporte donc
   rien aujourd'hui — mais cela cessera d'etre vrai le jour ou une policy le lira.
8. **`inviteReviewer` ne lit jamais `ctx.role`** (`collaboration.ts:336-364`). Sans consequence
   aujourd'hui (`org_role` ne vaut que `owner`|`admin`, `002_enums.sql:66-69`) ; devient une faille
   le jour ou un role `member`/`viewer` est ajoute a l'enum.

---

## Ordre de traitement propose

| # | Sujet | Cout | Bloquant go-live ? |
|---|---|---|---|
| 1 | `safeNext` : valider la sortie (point 1) | 1 ligne + 3 cas de test | **oui** |
| 2 | Faire aboutir une invitation legitime (point 3) | `redirectTo` → `/auth/callback?next=`, `next` dans `/reset-password` + formulaire | **oui** |
| 3 | Appliquer 032 puis 033, **apres** avoir integre les points 5, 7 et 9 | migration | **oui** (regle 4) |
| 4 | CSRF : POST + page de confirmation + `Origin` (point 2) | route + 1 page | **oui** |
| 5 | `grant update (full_name, initials, timezone)` sur `profiles` (point 5) | 1 ligne SQL | **oui** |
| 6 | `and ma.org_id = _org and ma.client_id = _client` dans 033 (point 7) | 1 ligne SQL | **oui** |
| 7 | Limiter `sendProofOfPossession` (point 6) | compteur + plafond | oui avant Brevo |
| 8 | `revoke insert, update, delete on client_invitations from authenticated` (point 9) | 1 ligne SQL | oui |
| 9 | Brancher `tenantOf` dans `recordUploadedAsset` (point 8) | 2 lignes | oui |
| 10 | `as Client` dans `portal/[contentId]/page.tsx` (point 10) | 3 lignes | non, mais 500 visible |
| 11 | Laisser passer `error` dans `proxy.ts` (point 10) | 1 ligne | non |
| 12 | Tests : sortir le glob de `lib/**`, tester `route.ts`, nourrir l'invariant `safeNext`, exercer le balayage de `remove_client_member`, ajouter une seconde org au pgTAP 033 | — | non, mais c'est ce qui a laisse passer 1, 3 et 7 |
