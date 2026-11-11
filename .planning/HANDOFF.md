# Handoff — 2026-08-15 — Pilotage Ocean (vérification + migrations)

## Mission

Tu es la **session de pilotage** d'Ocean, pas une session d'exécution. Tu ne codes pas : tu
rédiges les briefs des sessions de travail, tu **vérifies leurs livraisons contre le code réel**
(jamais contre leurs affirmations), et tu appliques les migrations en production via le MCP
Supabase quand Étienne l'autorise explicitement.

Origine : un audit senior 11 dimensions du 12/08 (`_research/audits/2026-08-12/`) a conclu « pas
encore utilisable en réel, 9 chantiers bloquants ». Le plan qui en découle est
`.planning/ACTION-PLAN.md`. Les phases 0, 2 (partielle), 3, 4, 5, 7 et 8 sont livrées.

## État git

`chore/phase-0-outillage` @ `83f7099` — le lot qui traînait est **soldé** en deux commits le
15/08 en fin de journée :

| Commit | Contenu |
|---|---|
| `d9b7f14` | les 6 fichiers en attente : rectificatifs de commentaires (`expired`, en-tête de `types.ts`, les 2 RPC de 035) + `deploy/31_migration_035.sql` régénéré. **Aucune ligne de logique.** `deploy/31` vérifié **identique à sa source canonique hors commentaires** — 39 lignes SQL de part et d'autre, comparaison ordonnée. |
| `83f7099` | **`scripts/gen-types.py` retiré** (décision d'Étienne), et les 6 emplacements suivis par git qui le référençaient, dans 4 fichiers. Aucune CI, aucun `package.json`, aucun Dockerfile ne l'appelait. `tsc` web : 0. |

⚠ **Restent non suivis par git, par choix d'Étienne** : `.planning/HANDOFF.md` (ce fichier) et
`.planning/PROMPT-REPRISE.md`. Ils n'existent que sur le disque de la machine — un clone propre
ne les a pas, et la CI ne les verra jamais.

⚠ **La branche n'a JAMAIS été poussée** : le compte GitHub des sessions (`Propulseo`) n'a que la
lecture sur `propulseo12345/ocean`. **Aucun run de CI n'a donc jamais été observé au vert**, alors
que c'était le critère de sortie de la phase 0. C'est une action Étienne.

## Plan

- [x] Audit senior 11 dimensions + synthèse (`_research/audits/2026-08-12/00-SYNTHESE.md`)
- [x] Plan d'action fusionné audit + vision produit (`.planning/ACTION-PLAN.md`)
- [x] Phase 0 — outillage, CI réparée, `PUBLISHERS_MODE`
- [x] Phases 3 et 4 — sûreté du moteur de publication, synchronisation app ↔ file
- [x] Phase 7 — portes d'entrée, **puis vérifiée par une passe adversariale**
      (`_research/audits/2026-08-12/13-VERIF-phase7.md` : ATO réellement fermée, 4 défauts trouvés
      et corrigés le lendemain)
- [x] Phase 5 — médias : upload TUS livré, **critère atteint** (un octet réellement transféré)
- [x] Phase 8 — OAuth : 7/7 tickets, **critère NON atteignable** sans app Meta réelle
- [x] Migrations 035 et 036 — **APPLIQUÉES EN LIGNE le 15/08/2026**, ledger à 36, health 200
- [x] Suites directes : `deploy/31_` régénéré, commentaires périmés corrigés, tout re-vérifié
- [ ] Phase 6 — publishers réels (bloquée : app Meta)
- [ ] Phase 9 — refermer le cercle / métriques (bloquée : API + `post_metrics` vide)

## Prochaine action

**Il n'y a plus rien à faire depuis le dépôt sur le chemin critique.** Les trois prochaines choses
sont des actions Étienne, dans cet ordre :

1. **Pousser `chore/phase-0-outillage`** — le compte `Propulseo` n'a que la lecture
   (`propulseo12345/ocean`). Aucun run de CI n'a jamais été observé vert, alors que c'était le
   critère de sortie de la phase 0. Tout le reste est mesuré en local.
2. **Régler les gabarits d'e-mail Supabase** (`deploy/GABARITS-EMAIL-supabase.md`). Tant qu'ils
   pointent sur `{{ .ConfirmationURL }}`, aucune invitation Reviewer n'aboutit, quel que soit
   l'état du code.
3. **Créer l'app Meta** — elle débloque la phase 6 et le critère de sortie de la phase 8.

✅ **Tranché le 15/08/2026 — `scripts/gen-types.py` est retiré** (commit `83f7099`).
`apps/web/lib/supabase/types.ts` assume sa tenue **manuelle**, et son en-tête le dit désormais.
Le finir aurait supposé couvrir aussi les RPC (le script écartait les clés `rpc.`) et les enums,
sans quoi la première régénération réelle aurait **détruit** le bloc `Functions` écrit à la main.
Dette connue et assumée : 41 tables typées contre 42 en ligne, `publish_jobs` manque — sans effet
tant que le web ne touche la file que par RPC.

### Protocole migrations (éprouvé 032/033/034/035/036 — à reproduire à l'identique)

1. Lire le SQL **en entier** (jamais appliquer un SQL non lu). **Lire aussi la source canonique
   `supabase/migrations/` et la comparer** : c'est ainsi qu'on a vu que `deploy/31_` était corrompu.
2. Pré-vol : dépendances (fonctions `private.*`, colonnes, enums) + état du ledger + **baseline
   `anon`** relevée AVANT.
3. Appliquer avec `execute_sql` — **jamais `apply_migration`** (voir Contexte non évident).
4. Vérifier : `prosecdef`, `proconfig` (search_path figé), grants (**`anon` ne doit avoir
   `EXECUTE` sur rien de nouveau**), objets créés, `get_advisors`, ledger.
5. `curl https://socean.54-36-180-115.sslip.io/api/health` → 200.
6. Tracer dans `.planning/ACTION-PLAN.md` (tableau de contrôles pré-vol + après).

⚠ **Un `alter type … add value`** passe **seul dans sa transaction**. Ne jamais le fusionner.

## Décisions figées (ne pas re-débattre)

- **Rien n'est appliqué au code sans validation d'Étienne.** L'audit et le pilotage sont read-only
  sur le code produit.
- **Aucune écriture sur `hgdeopkmkwyoumsfggrm`** hors autorisation explicite et bornée. Chaque
  autorisation vaut pour les migrations nommées, et pour elles seules.
- **P7-6 (mode de connexion Reviewer)** : password-only maintenant, `signInWithOtp` ajouté avant le
  premier vrai client. Tranché avec Étienne.
- **Le domaine `sslip.io` est un prérequis technique, pas marketing** : il sera gelé dans 8 redirect
  URIs OAuth et tous les e-mails clients.
- **Le worker reste en `dry-run`/`stub`** tant que les publishers réels ne sont pas branchés ;
  `PUBLISHERS_MODE` n'a pas de valeur par défaut et le worker refuse de démarrer sans.

## Impasses / déjà essayé sans succès

- **`git archive` ne donne PAS un arbre LF fiable** : il applique lui aussi la conversion de fin de
  ligne. Le « `pnpm check` exit 0 » du 15/08 était mesuré sur le mauvais référentiel. La vérité du
  dépôt, ce sont **les blobs** — mesurer sur eux.
- **Ne pas relancer l'audit senior via `resumeFromRunId`** : le resume ne rejoue pas depuis le cache
  comme annoncé, il re-tourne les dimensions (~27 min chacune, 53 M tokens sur le run du 13/08).
- **`args` passé à l'outil Workflow arrive sérialisé en string**, pas en objet : `args.date` est
  `undefined` et tous les défauts partent en fallback. Mettre les valeurs en dur dans le script.
- **Le CLI `supabase` n'est pas installé** → utiliser `npx supabase@latest`. Les ports par défaut
  (5432x) sont occupés par le projet `preventionelectrique`, **qu'il est interdit de tuer** ; Ocean
  tourne désormais sur **544xx**, et `.github/workflows/ci.yml` a été aligné.

## Fichiers clés

- `.planning/ACTION-PLAN.md` — le plan (3 portes, 10 phases) + **tous les tableaux de suivi ticket
  par ticket avec commits et preuves**. C'est le document vivant.
- `.planning/BRIEF-REPRISE-2026-08.md` — vision produit d'Étienne (le « cercle », 7 piliers,
  chemin critique Meta). Sa section 12 est un addendum de corrections issu de l'audit.
- `.planning/SESSION-BRIEF-2026-08-{15,16,17}.md` — les briefs des sessions d'exécution passées
  (format à reproduire pour les suivants).
- `_research/audits/2026-08-12/00-SYNTHESE.md` — verdict d'audit et backlog dédupliqué.
- `_research/audits/2026-08-12/13-VERIF-phase7.md` — **la seule source à jour sur la sécurité** ;
  les 11 autres rapports décrivent l'état du 12/08, largement dépassé.
- `deploy/GABARITS-EMAIL-supabase.md` — la procédure que doit exécuter Étienne.
- `deploy/31_migration_035.sql`, `deploy/32_migration_036.sql` — ⚠ **déjà appliquées** en ligne le
  15/08/2026 (ledger à 36). Ces fichiers ne sont plus que des copies de rejeu ; leur en-tête le dit.

## Contexte non évident

- **Projet Supabase : `hgdeopkmkwyoumsfggrm`** (nom « Socean », eu-west-1). Le MCP y a accès.
- **Ledger : versions COURTES (`001`…`034`), pas des timestamps.** `apply_migration` du MCP
  inscrirait un timestamp et casserait la cohérence avec `supabase/migrations/`. Utiliser
  `execute_sql` pour le DDL, puis
  `insert into supabase_migrations.schema_migrations (version, name) values ('0NN','nom')`.
- **Baseline de sécurité** : `anon` ne doit avoir `EXECUTE` que sur **une seule** fonction
  `SECURITY DEFINER` (`get_report_share`). Si ce compte monte après une migration, c'est une
  anomalie — la faille Vault de 021 venait exactement de là (les default privileges Supabase
  accordent `EXECUTE` à `anon` sur toute fonction créée dans `public` ; `revoke from public` seul
  ne suffit pas).
- App en ligne : `https://socean.54-36-180-115.sslip.io` — Coolify `54.36.180.115:8000`,
  app web uuid `eiennb096iitmlnyn6smbc9x`. **Aucune app worker n'existe.**
- Le code déployé en production est **plus ancien** que la branche locale : la base a un schéma en
  avance sur son code. Effet visible et voulu : un client en `approval_mode = required` refuse
  désormais une programmation sans validation (ce n'est pas un bug).

## Trois faux positifs payés cette semaine — à opposer à toute livraison

1. **Un test qui énumère ne prouve rien.** 8 tests verts certifiaient un filtre d'open redirect
   inopérant : aucun cas de la liste ne contenait de dot-segment.
2. **Un test peut certifier un correctif qui ne corrige rien.** La migration 033 v1 lisait un
   segment de chemin toujours vide en usage réel ; ses 9 tests passaient.
3. **Une preuve peut se tromper de référentiel** (le `pnpm check` ci-dessus).

→ Exiger systématiquement une **vérification par mutation** : casser la garde, voir un test tomber.

## Commandes de vérification

Toutes re-passées le 15/08/2026 après l'application des migrations :

```bash
pnpm -w build                   # ✅ Compiled successfully in 3.8s
pnpm --filter web exec tsc --noEmit      # ✅ 0
pnpm --filter worker exec tsc --noEmit   # ✅ 0
pnpm --filter web test          # ✅ 124/124
pnpm --filter worker test       # ✅ 51/51
curl -s -o /dev/null -w "%{http_code}\n" https://socean.54-36-180-115.sslip.io/api/health   # ✅ 200
```

### ⚠ pgTAP : `bash scripts/run-pgtap.sh` NE TESTE RIEN

La commande figurait ici avec la mention « 364 tests, 34 fichiers ». **C'est faux.** Lire
`scripts/run-pgtap.sh:9` et `:36` : le **premier argument est `UPTO`** (défaut **`011`**) et les
**arguments suivants sont les fichiers de test**. Sans argument, le script rejoue les migrations
001→011 et exécute **zéro test** — puis sort **0**. Vérifié : log complet, `not ok` = 0 parce que
`ok` = 0 aussi. Le 364 venait d'ailleurs (`supabase test db`), pas de ce script.

Le vrai chemin, celui du job `db` de la CI (`.github/workflows/ci.yml:46-55`) :

```bash
export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"; export MSYS_NO_PATHCONV=1
npx supabase@latest start          # ports 544xx, cf. supabase/config.toml
npx supabase@latest db reset --no-seed
npx supabase@latest test db        # ✅ Files=34, Tests=364, Result: PASS (15/08, chaîne 001→036)
```

`run-pgtap.sh` reste utile pour cibler **un** test vite (`bash scripts/run-pgtap.sh 036
036_account_status_disconnected.test.sql`), mais il saute les `*_storage.sql` et ne remplace pas
`supabase test db`.

## Hors périmètre

- **Ne pas coder.** Si un correctif est nécessaire, rédiger un brief de session d'exécution.
- **Ne pas lancer de session de travail pour de la dette de confort** (`AccountStatus.expired` mort,
  marge de 10 jours dupliquée web/worker, `packages/shared` vide). Ce serait du mouvement, pas de
  l'avancement : le chemin critique est désormais entièrement chez Étienne.
- Phases 6 et 9 : bloquées par des identifiants et des données réelles.

## Trois faux positifs de plus, tous trouvés le 15/08 en voulant simplement « faire les suites »

Ils partagent une forme : **un artefact qui affirme un travail qu'il n'accomplit pas.**

4. **`deploy/31_migration_035.sql` était corrompu** — détail ci-dessous.
5. **`scripts/gen-types.py` n'écrivait rien.** Il imprimait `regenere 42 tables: …`, sortait 0, et
   `git status` sur `types.ts` restait vide. Sa fonction `emit()` n'était jamais appelée. Le fichier
   `types.ts` portait pourtant « Ne pas editer a la main » : il est intégralement manuel.
   → **Retiré le 15/08/2026** (`83f7099`) ; l'en-tête de `types.ts` dit maintenant la vérité.
6. **`bash scripts/run-pgtap.sh` sans argument n'exécute aucun test** et sort 0 (voir la section
   des commandes). Il figurait dans ce handoff comme la preuve des « 364 tests ».

→ Le réflexe qui les attrape tous les trois : **ne pas croire le message de sortie, regarder
l'effet**. `git status` après un générateur, `ok`/`not ok` comptés après un runner, un `diff` entre
le fichier appliqué et sa source.

## Quatrième faux positif, attrapé à temps le 15/08

**`deploy/31_migration_035.sql` était corrompu** : un fragment orphelin (corps de fonction sans son
en-tête `create or replace function`) en tête de SQL — erreur de syntaxe garantie dès la première
ligne exécutable. Les **10 tests pgTAP de la 035 passaient**, parce qu'ils mesurent
`supabase/migrations/`, jamais `deploy/`. Encore une preuve qui ne porte pas sur le référentiel
livré, exactement comme le `pnpm check` sur `git archive`.

→ **Ne jamais appliquer un fichier `deploy/` sans le differ contre sa source canonique.** La 035 a
été appliquée depuis `supabase/migrations/`, et `deploy/31_` a été régénéré.

## ⚠ Non vérifié

- Les gabarits d'e-mail Supabase ne sont **pas** confirmés comme réglés : tant qu'ils pointent sur
  `{{ .ConfirmationURL }}`, aucune invitation n'aboutit, quel que soit l'état du code.
- Le critère de sortie de la phase 8 (« deux clients, deux Pages, sans mélange ») **n'a jamais été
  exercé contre Meta** — les tests prouvent les décisions, pas le dialogue avec le fournisseur.
- ~~Les chiffres de tests ci-dessus viennent du rapport de la session du 15/08.~~ **Re-mesurés
  directement par le pilotage le 15/08 en fin de journée, après les commits `d9b7f14` et
  `83f7099` : web 124/124 et worker 51/51, `exit 0` des deux côtés, plus `tsc` web à 0.** Les
  « web 47/47 / worker 40/40 » qui figuraient ici étaient **périmés** — chiffres d'une session
  antérieure, contredits par la section « Commandes de vérification » du même document.
  Restent non re-mesurés par le pilotage : `pnpm -w build` et les 364 tests pgTAP.
