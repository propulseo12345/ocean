# Brief de session — 15/08/2026

Session d'exécution autonome et longue. Une autre session pilote et vérifie ticket par ticket.
Branche `chore/phase-0-outillage` (non poussée — droits GitHub côté Étienne). Continue dessus.

## Où en est le projet

- **Phases 0, 2 (partielle), 3, 4 : faites.** CI réparée, `PUBLISHERS_MODE`, santé du worker,
  logs, ancre d'idempotence déplacée sur `content_targets`, statut `needs_verification`,
  fencing `worker_id`, timeouts, reaper qui terminalise, quota local, `syncPublishQueue` +
  trigger filet, `approval_mode` opposable.
- **Phase 5 : partielle.** `next.config` corrigé, réconciliation par diff, plus de destruction
  de médias au save, `applyCrop` n'invente plus de mesures. **L'upload n'existe toujours pas.**
- État vérifié le 15/08 : `pnpm --filter worker test` → 40/40, `tsc --noEmit` web → 0 erreur.
- Le commit `a4d031d` est un `wip(portal)` d'une session antérieure (annotations client,
  notifications agence). Tu vas toucher au portail : regarde ce qu'il contient et dis dans ton
  rapport ce que tu en fais.

⚠ Les rapports de `_research/audits/2026-08-12/` décrivent l'état au **12/08**. Beaucoup de code
a bougé : vérifie toujours dans le code avant de te fier à un numéro de ligne d'un rapport.

---

# BLOC 0 — Appliquer les migrations 023 → 031 en production (porte bloquante)

**Étienne autorise explicitement l'écriture sur le projet `hgdeopkmkwyoumsfggrm` (Socean) via le
MCP Supabase, pour ce bloc et pour lui seul.** Cette autorisation ne s'étend pas au reste de la
session : après le BLOC 0, on revient à la règle habituelle (aucune écriture en ligne).

## État de départ, relevé le 15/08 avant la session

- `list_migrations` → **22 lignes, `001` à `022`**, versions numériques courtes (pas de timestamp).
- `get_advisors(security)` → **15 lints**, tous connus et voulus :
  - 3 INFO `rls_enabled_no_policy` sur `calendar_account_secrets`,
    `platform_connection_secrets`, `social_account_secrets` — c'est le deny-all de la règle 11.
  - 11 WARN `SECURITY DEFINER` (1 × 0028 sur `get_report_share` pour `anon`, 10 × 0029 pour
    `authenticated` : `cancel_publish_jobs`, `create_organization`, `enqueue_publish_jobs`,
    `get_report_share`, `mark_all_notifications_read`, `mark_notification_read`,
    `mark_target_published_manually`, `request_target_retry`, `submit_review_decision`,
    `touch_client_member_seen`).
  - 1 WARN `auth_leaked_password_protection` (à activer par Étienne dans le dashboard).

## Ce qu'il faut appliquer, dans cet ordre exact

| Ordre | Fichier | Migration | Prérequis |
|---|---|---|---|
| 1 | `deploy/18_migration_023.sql` | `023_target_publish_anchor` | 020 |
| 2 | `deploy/19_migration_024_etape1_enums.sql` | `024_needs_verification` (1/2) | 023 |
| 3 | `deploy/20_migration_024_etape2.sql` | `024_needs_verification` (2/2) | étape 1 **committée** |
| 4 | `deploy/21_migration_025.sql` | `025_enqueue_no_terminal_targets` | 023 + 024 |
| 5 | `deploy/22_migration_026.sql` | `026_target_delete_guard` | 023 |
| 6 | `deploy/23_migration_027.sql` | `027_cancel_claimed_jobs` | 023 |
| 7 | `deploy/24_migration_028.sql` | `028_manual_publish_cancels_job` | 024 |
| 8 | `deploy/25_migration_029.sql` | `029_publish_queue_safety_net` | 023 |
| 9 | `deploy/26_migration_030.sql` | `030_approval_mode_gate` | 024 |
| 10 | `deploy/27_migration_031.sql` | `031_scheduled_at_bounds` | aucun |

## Les quatre pièges de ce bloc

1. **La 024 est scindée en deux envois pour une raison de fond.** `ALTER TYPE … ADD VALUE` ne
   peut pas être utilisé dans la même transaction que celle qui l'ajoute. **Ne fusionne jamais
   les étapes 1 et 2**, et vérifie que l'étape 1 est bien committée avant d'envoyer l'étape 2.
2. **Le ledger utilise des versions courtes (`001`…`022`), pas des timestamps.** Si
   `apply_migration` du MCP inscrit une version au format timestamp, tu casses la cohérence avec
   `supabase/migrations/`. **Vérifie ce que le MCP écrit réellement dans
   `supabase_migrations.schema_migrations` après la première migration**, et si le format
   diverge, applique le DDL avec `execute_sql` puis inscris la ligne de ledger à la main —
   c'est ce qu'a fait `deploy/17_ledger_catchup.sql`, prends-le comme modèle. Objectif final :
   **31 lignes, `001` → `031`**, avec les noms identiques aux fichiers de `supabase/migrations/`.
3. **Le code déployé en production est ANCIEN** : la branche n'est pas poussée, l'app en ligne
   tourne sur le code d'avant la phase 3. Après ce bloc, la production aura un schéma en avance
   sur son code. Conséquences à anticiper et à vérifier : `030` rend `approval_mode` opposable
   (une transition vers « programmé » sans validation sera refusée), `031` borne `scheduled_at`
   (une date passée sera refusée), `029` pose un trigger filet sur la file, `026` passe une FK en
   `restrict`. C'est **voulu** — ce sont des durcissements — mais l'UI ancienne peut désormais
   afficher des erreurs sur des gestes qui passaient avant. Étienne est seul utilisateur et
   aucun client réel n'est branché : le risque est accepté. Note dans ton rapport tout parcours
   que tu identifies comme désormais bloqué.
4. **Pas de rollback simple.** Lis chaque fichier `deploy/` **en entier avant de l'envoyer**, et
   vérifie qu'il correspond bien à son homologue de `supabase/migrations/` (un `diff` logique,
   pas seulement le titre).

## Procédure

1. `list_migrations` et `get_advisors(security)` → confirme la baseline ci-dessus. **Si l'état
   de départ diffère, ARRÊTE-TOI et rends compte** : quelqu'un a touché la base entre-temps.
2. Pour chaque ligne du tableau, dans l'ordre : lire le fichier → l'appliquer → vérifier
   immédiatement que les objets attendus existent (`execute_sql` en lecture sur `pg_proc`,
   `pg_trigger`, `pg_constraint`, `pg_enum` selon le cas) → passer à la suivante.
   **Une migration qui échoue arrête le bloc.** Ne tente pas de « réparer en avançant ».
3. À la fin : `list_migrations` (attendu `001` → `031`), `get_advisors(security)` comparé à la
   baseline. Tout nouveau lint doit être **expliqué** : de nouvelles RPC `SECURITY DEFINER`
   ajouteront des WARN 0029, ce qui est normal **si et seulement si** elles vérifient
   l'appartenance à l'org en interne. Un lint `rls_enabled_no_policy` sur une table qui n'est
   pas un `*_secrets`, ou un `rls_disabled_in_public`, est une **anomalie** : arrête-toi.
4. Vérifie que l'application en ligne répond toujours :
   `https://socean.54-36-180-115.sslip.io/api/health` → 200.
5. Consigne le résultat dans `.planning/ACTION-PLAN.md` (bloc « migrations appliquées », avec la
   date, la liste, le delta d'advisors et les vérifications faites).

**Critère de sortie du BLOC 0** : ledger à 31 lignes, delta d'advisors entièrement expliqué,
`/api/health` à 200. Tant que ce n'est pas atteint, **ne commence aucun lot de code**.

---

# LOT A — Phase 7 : les portes d'entrée (priorité absolue)

Le portail de validation client — argument commercial central — n'ouvre jamais de session. Et la
même route est une **prise de contrôle de compte, sur une application déjà déployée**. C'est la
faille la plus grave du dépôt.

Détail vérifié : `_research/audits/2026-08-12/09-securite.md` et `11-go-live.md`.

- **P7-1** — ATO sur `/api/invitations/accept` : la route résout le compte existant **par email**
  puis redirige vers un `generateLink`. Aucune preuve de possession. Comme `create_organization`
  est accordée à `authenticated` (confirmé par les advisors), n'importe quel compte peut inviter
  `owner@victime` et ouvrir sa session.
  *Ne rustine pas : le flux doit exiger une preuve de possession de l'adresse. Écris ta décision
  de conception dans le message de commit.*
- **P7-2** — La même route ne crée **jamais** de session pour le vrai destinataire : les jetons
  arrivent dans le fragment d'URL, que personne ne lit, et le token est brûlé au passage (non
  rejouable). Piste : `token_hash` + `/auth/callback`.
- **P7-3** — `/onboarding` n'existe pas : 404 nu pour tout compte sans organisation, donc **tout
  Reviewer**, à chaque retour via `/login`. Le proxy redirige inconditionnellement vers
  `/dashboard` en effaçant `next`.
- **P7-4** — Aucune route `/signup` : `signUpWithPassword` est écrite et n'a aucun appelant. Le
  retour de `create_organization` n'est pas testé (collision de slug avalée).
- **P7-5** — Un point unique de résolution de rôle après authentification. `/dashboard` est en dur
  à trois endroits (proxy, `signInWithPassword`, `updatePassword`), et un Reviewer n'y a rien à
  faire.
- **P7-6** — Le Reviewer est créé **sans mot de passe** alors que le login est password-only, et
  `signInWithOtp` n'existe nulle part. ⚠ `CLAUDE.md` prescrit magic link desktop / OTP mobile, le
  code fait password : c'est un **arbitrage produit**. Propose, argumente, **ne tranche pas seul**
  si ta solution change l'expérience de connexion d'Étienne.
- **P7-7** — Une invitation ratée est définitive : l'index unique partiel ignore `expires_at`,
  `revoked_at` n'est jamais écrit, aucune liste, aucune ré-invitation, et **aucun retrait de
  `client_members`** (la règle 4 exige une révocation immédiate, il n'y a pas de bouton).
- **P7-8** — Open redirect sur `next` : `//evil.tld` passe le `startsWith("/")`, depuis un domaine
  authentique et après une connexion réussie.
- **P7-9** — Le portail plante (`TypeError`) si la liste de clients est vide — atteignable en deux
  clics depuis la landing.
- **P7-10** — Le wizard de création de client jette le token d'invitation (seule copie en clair)
  puis affiche un succès : l'invitation suivante échoue en `already_invited`.

**Critère de sortie** : depuis un compte neuf, créer une organisation, inviter un reviewer et —
en simulant la réception de l'email — ouvrir une session reviewer qui atterrit sur le portail.
Et un test prouve qu'un token d'invitation ne peut pas ouvrir la session d'une autre adresse.

---

# LOT B — Phase 5 : faire entrer les médias

Il n'existe **aucun chemin d'upload** : zéro `<input type="file">` dans `apps/web`, la drop-zone
de `upload-dialog.tsx` est un `<button>` qui jette `e.dataTransfer`, et `recordUploadedAsset` —
complète et validée Zod — n'a aucun appelant. Instagram refusant tout post sans média, c'est ce
lot qui rend la publication possible.

- **P5-5** — `lib/media/` + upload TUS (`tus-js-client`, chunks de **6 Mo exactement**) vers
  `media-originals` (privé), chemin `{org_id}/{client_id}/{media_asset_id}/…` (règle 21).
- **P5-6** — Conversion JPEG côté client (PNG/**HEIC** — photos iPhone, c'est la cible
  prioritaire) et vignette WebP ~400 px → `media-thumbs`.
- **P5-7** — Une vraie zone de dépôt + sélecteur de fichier, dans la médiathèque et le composer.
- **P5-8** — Brancher les Server Actions écrites et sans appelant : `recordUploadedAsset`,
  `attachMedia`, `deleteAsset`, `updateAssetAlt`. La médiathèque ne persiste aujourd'hui ni
  l'alt-text ni les suppressions (`useState` + toast).
- **P5-9** — Appliquer réellement l'intention de recadrage enregistrée par `applyCrop`.
- **P5-10** — Le Reviewer ne peut pas obtenir d'URL signée (`can_write_client_media` exige
  `is_org_member`) : il valide sur une vignette de 400 px, et l'erreur est avalée.
- **P5-11** — Le portail rend un `<Image>` pour une vidéo — **aucun** `<video>` dans `apps/web`.
  Un Reel est approuvé à l'aveugle par le client.

**Comment tester** : monte un stack Supabase **local** (`supabase start`, comme la CI) et
travaille contre lui. **Jamais** contre le projet en ligne — l'autorisation du BLOC 0 ne couvre
ni Storage ni les données.

**Critère de sortie** : un fichier déposé depuis le navigateur arrive dans `media-originals` au
bon chemin, sa vignette dans `media-thumbs`, et il s'affiche dans la grille, le studio **et** le
portail.

---

# LOT C — Phase 8 : OAuth propre (seulement s'il reste du temps)

Ne commence ce lot que si A et B sont finis et verts.

Connecter Meta pour un client rattache aujourd'hui **toutes** les Pages et comptes Instagram du
compte connecté à ce client-là, avec leurs tokens, et rien ne permet de détacher.

- **P8-1** — Écran de sélection des sous-comptes.
- **P8-2** — Détachement + révocation du secret dans le Vault (aucun `.delete()` nulle part, pas
  de `delete_integration_secret` : passif RGPD).
- **P8-3** — Échange long-lived Meta (`fb_exchange_token` = 0 occurrence : les tokens meurent en
  une heure).
- **P8-4** — `tokens/refresh.ts` réel, appel HTTP **hors** du verrou (règle 18 — le plan actuel,
  en commentaire, place le POST dans la transaction).
- **P8-5** — State OAuth durci : `exp`, nonce à usage unique, lien de session, et le
  `codeVerifier` PKCE ne doit pas être lisible dedans.
- **P8-6** — Scope `pages_manage_posts` (sans lui la publication sur Page est refusée, et Meta ne
  rétro-accorde pas un scope), et stocker les scopes **accordés**, pas ceux demandés.
- **P8-7** — `needs_reauth` est écrit sur `platform_connections`, table que le web ne lit jamais :
  les 11 surfaces qui testent `social_accounts.status` sont mortes, dont la garde de
  programmation du preflight.

---

## Règles de travail — non négociables

- **Un commit par ticket**, dans l'ordre. Pas de commit fourre-tout.
- **Ne déborde pas.** Si tu vois autre chose, note-le en fin de rapport.
- **Après le BLOC 0, plus aucune écriture en ligne** (schéma, données, Storage). Tes nouvelles
  migrations vont dans `supabase/migrations/032_*.sql` et suivantes, avec le fichier `deploy/`
  correspondant.
- **Toute migration a son test pgTAP.** La suite complète doit rester verte — rejoue-la à la fin
  de chaque lot.
- **Sur le lot A, tout correctif de sécurité a son test** : un test qui échoue avant le correctif
  et passe après. Sans ça, tu n'as pas prouvé que tu as fermé la faille.
- **Jamais `biome check --write` sur tout le repo** : cible tes fichiers, mesure sur un arbre LF
  (`git archive`).
- **Preuve avant affirmation.** Commande lancée, sortie réelle collée.
- Si un ticket s'avère plus gros ou plus risqué que prévu, **arrête-toi et explique**.

## Protocole

Après chaque ticket : vérifie, commit, puis mets à jour `.planning/ACTION-PLAN.md` (tableaux de
suivi des phases 7, 5-suite et 8, format identique aux précédents).

## Pièges connus — ne les redécouvre pas

- Biome sous Windows : erreurs CRLF environnementales, la CI Linux est propre.
- pgTAP dans le conteneur `ocean_rev2` (`bash scripts/run-pgtap.sh`). Docker hors PATH :
  `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"` et
  `export MSYS_NO_PATHCONV=1`. Le runner saute les `*_storage.sql`.
- Vérifie que `plan` == nombre de tests émis dans chaque fichier pgTAP.
- `NEXT_PUBLIC_*` est inliné au build, y compris côté serveur : toute origine publique passe par
  une variable non préfixée (`SITE_URL`).
- Un dossier préfixé `_` est privé chez Next : exclu du routage.
- `middleware.ts` s'appelle `proxy.ts` en Next 16.
- Serveur de dev sur PORT=3010. Ne tue jamais les serveurs des autres projets.
- Ne réintroduis jamais de données mockées.

## Rendu final attendu

- Le résultat du **BLOC 0** : ledger avant/après, delta d'advisors expliqué, parcours désormais
  bloqués côté code ancien.
- Le tableau des tickets avec leur statut RÉEL (dis-le si un ticket n'est pas fait).
- Pour chaque ticket : le commit et la preuve.
- État final de `pnpm -w build`, `tsc --noEmit` (web et worker), `pnpm --filter worker test`,
  `pnpm check` (arbre LF), la suite pgTAP complète.
- **Ta décision de conception sur P7-1** (comment tu établis la preuve de possession) et sur P7-6
  si tu as touché au mode de connexion.
- Ce que tu as fait du `wip(portal)` `a4d031d`.
- Ce que tu as vu et volontairement PAS touché.
- Ce qui attend Étienne : décisions produit, accès manquants.
