# Ticket LOT5-01 — Gate d'entrée : vérifier les 7 prérequis durs

## Ticket ID
`LOT5-01`

## Objectif
Vérifier, **sans écrire une ligne de code**, que les **sept prérequis durs** du Lot 5 sont soldés. Produire `docs/architecture/lot-5-entry-gate.md` listant chaque prérequis avec la commande lancée et sa sortie brute. **Aucun ticket LOT5-02+ ne démarre tant que ce rapport n'est pas vert ET qu'Étienne n'a pas donné le feu vert par écrit.**

## Pré-requis
- Aucun. C'est le premier ticket exécutable de la série (le `00-index.md` est un document, pas un ticket).

## 🛑 Pré-condition bloquante
- [ ] Étienne a écrit une **autorisation explicite** d'ouvrir le Lot 5 (ex. « feu vert Lot 5, vérifie les prérequis »).
- **Sans cette phrase d'autorisation dans la conversation, Codex NE FAIT RIEN et redemande.** Il ne présume jamais le consentement.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, section **Prérequis durs**.
- Le PRD classe « IA de rédaction » en **V2** (`docs/PRD.md` §4, colonne V2). Le Lot 5 est un lot **post-MVP assumé**. Il ne doit rien casser des Lots 0–4.
- Le Lot 5 s'exécute **après le Lot 3** (le Lot 4 — agenda — est orthogonal).
- **Décision actée #17** : pas de Redis/BullMQ. La file est Postgres `FOR UPDATE SKIP LOCKED` (`CLAUDE.md` §5).
- **Edge Functions interdites** pour tout travail long (2 s CPU / 400 s wall). Un run LLM dure 3 à 12 min.
- **Postiz : ABANDONNÉ.** Aucun connecteur, aucune mention.

## Fichiers autorisés (création uniquement)
- `docs/architecture/lot-5-entry-gate.md`

## Fichiers interdits
- `supabase/**`, `apps/**`, `packages/**`.
- `docs/superpowers/tickets/lot-5/**` (les tickets sont écrits, pas modifiés par ce ticket).
- Toute exécution de migration, toute connexion Supabase distante.

## Étapes attendues

Vérifier les 7 prérequis, dans l'ordre. Pour chacun : lancer la commande, coller la sortie brute dans le rapport, conclure ✅ ou ❌.

### P1 — Lot 0 exécuté
Le rapport d'exécution existe et atteste que tous les tests pgTAP passent.

### P2 — Dé-`L<string>` soldé (couture Pré-0)
Aucun `L<string>` dans les types de mock. `pick()` survit **uniquement** pour les libellés d'UI — vérifier manuellement les call-sites restants : ils doivent tous porter sur du libellé, jamais sur du contenu (`caption`, `title`, `bio`, `notes`).

### P3 — `zod` installé dans `packages/shared`

### P4 — `packages/shared` peuplé
`src/schemas/index.ts` ne doit plus valoir `export {}`.

### P5 — `apps/worker` existe et respecte le pattern de file
Le fichier d'entrée existe, un claim `for update skip locked` est présent, et **le pooler transaction 6543 n'apparaît nulle part** (Supavisor SESSION 5432 exclusivement).

### P6 — `brand_kits` + `content_pillars` (Lot 1)
Sans eux, `context_snapshot` est vide → le Creative Copy invente le ton de marque et ignore `bannedWords`. Le run coûterait ~1,75 $ pour produire du bruit.

### P7 — `approvals` + portail (Lot 3)
Sans eux, aucun run ne quitte `waiting_approval` : le brouillon existe, personne ne l'approuve.

### Rédaction du rapport
Structure imposée :
1. **Autorisation** — citer la phrase exacte d'Étienne.
2. **Tableau de synthèse** : P1→P7, ✅/❌.
3. **Détail par prérequis** : la commande, sa sortie brute, la conclusion.
4. **Verdict** : `GATE VERTE` ou `GATE ROUGE — Lot 5 bloqué sur : <liste>`.

**Un seul ❌ = STOP.** Consigner, remonter à Étienne. **Ne rien corriger dans ce ticket.**

## Critères d'acceptation
- [ ] `docs/architecture/lot-5-entry-gate.md` existe et **cite l'autorisation écrite d'Étienne**.
- [ ] Les 7 prérequis P1→P7 sont chacun documentés avec la commande lancée **et sa sortie réelle** (pas une paraphrase).
- [ ] Le rapport se termine par un verdict explicite : `GATE VERTE` ou `GATE ROUGE`.
- [ ] Aucun fichier hors `docs/architecture/` n'a été touché.
- [ ] Aucune migration exécutée, aucun projet Supabase distant contacté.
- [ ] Aucun prérequis manquant n'a été « corrigé » au passage.

## Commandes de validation
```powershell
# P1 — Lot 0 exécuté
Test-Path 'docs\architecture\lot-0-execution-report.md'
Select-String -Path 'docs\architecture\lot-0-execution-report.md' -Pattern 'not ok'   # attendu : aucun match

# P2 — dé-L<string> soldé
rg "L<string>" apps\web\lib\mocks\types            # attendu : aucun match
rg -c "pick\(" apps\web                            # inspecter manuellement les call-sites restants

# P3 — zod installé
Select-String -Path 'packages\shared\package.json' -Pattern '"zod"'

# P4 — packages/shared peuplé (ne doit PAS valoir "export {}")
Get-Content 'packages\shared\src\schemas\index.ts' -TotalCount 5

# P5 — apps/worker existe et respecte le pattern
Test-Path 'apps\worker\src\index.ts'
rg -i "for update skip locked" apps\worker\src     # attendu : au moins un match
rg "6543" apps\worker                              # attendu : aucun match

# P6 — Lot 1
rg "create table public.brand_kits|create table public.content_pillars" supabase\migrations

# P7 — Lot 3
rg "create table public.approvals" supabase\migrations

# Le rapport existe
Test-Path 'docs\architecture\lot-5-entry-gate.md'
```

## Risques / points d'attention
- **Le risque n°1 = ouvrir le Lot 5 sur un socle non soldé.** Un moteur d'IA qui écrit dans `content_items` alors que le front lit encore du `L<string>` produit des brouillons illisibles, donc non approuvables, donc **sans valeur observable**. Le Lot 5 « marcherait » et ne servirait à rien.
- **P5 est le prérequis le plus lourd.** `apps/worker/` n'existe pas aujourd'hui, et le `Dockerfile` racine ne construit que `apps/web` (`COPY apps/web/package.json`, `pnpm --filter web build`). Le Lot 2 devra livrer un **second Dockerfile** ET une **seconde app Coolify**. Si ce n'est pas fait, le Lot 5 n'a nulle part où tourner : les Edge Functions sont interdites (400 s wall) et la Server Action longue est rejetée.
- **P6 dépend du Lot 1.** C'est un bug produit, pas technique — mais il est bloquant pour la démo du ticket 13.
- **P7 dépend du Lot 3.** Sans `approvals`, la machine à états du run ne se referme jamais.
- **Ne PAS « corriger » un prérequis manquant dans ce ticket.** Consigner, STOP. Corriger reviendrait à écrire du code applicatif dans un ticket de vérification.
- Le `Dockerfile` du worker devra copier `packages/skills/package.json` **et** `packages/shared/package.json`, plus les `.md` dans l'image finale (aucun bundler ne trace un markdown). À signaler dans le rapport si `apps/worker` existe mais que son Dockerfile ne le fait pas.

## Résultat attendu
Un rapport de gate, vert ou rouge, qui autorise ou bloque l'ouverture du Lot 5.

## Message de commit suggéré
```
docs(lot-5): rapport de gate d'entree (prerequis durs P1-P7)

Verifie : Lot 0 execute, de-L<string> solde, zod installe, packages/shared
peuple, apps/worker existant (SKIP LOCKED, port 5432), brand_kits +
content_pillars (Lot 1), approvals (Lot 3).
Aucun code touche, aucune migration executee.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-02` démarre seulement si le rapport est **vert** et qu'Étienne l'a validé par écrit dans la conversation.
