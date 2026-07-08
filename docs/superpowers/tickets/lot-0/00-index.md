# Lot 0 — Index des tickets (exécution Codex, un par un)

> **But** : découper le plan `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md` en tickets atomiques, exécutables **un seul à la fois** dans Codex avec un contexte minimal.
>
> **Règle d'or de cette série** : on **prépare** Lot 0 (dictionnaire + scaffold + SQL brouillon + tests pgTAP brouillon + relecture). On **n'exécute AUCUNE migration** et on ne connecte **aucun** Supabase distant tant qu'Étienne n'a pas donné le feu vert (ticket 06 uniquement).

## Contexte du repo (vérifié le 2026-07-07)

- `supabase/` : **absent** → à scaffolder (ticket 02).
- `packages/` : **absent** → `packages/shared` à scaffolder (ticket 02).
- `pnpm-workspace.yaml` : contient **déjà** `- "packages/*"` → **ne pas le modifier** (juste vérifier).
- `docs/architecture/` : **absent** → créé par le ticket 01.
- Mocks de référence : `apps/web/lib/mocks/types/` (`core.ts`, `collab.ts`, `library.ts`, `pro.ts`, `index.ts`).
- Audit source : `_research/audits/2026-07-07/11*.md` (11, 11a, 11b, 11c, 11d).

## Ordre d'exécution (STRICTEMENT séquentiel)

| # | Ticket | Fichier | Type | Gate |
|---|--------|---------|------|------|
| 01 | Figer le dictionnaire DB corrigé | [01-db-dictionary.md](01-db-dictionary.md) | Doc | 🛑 Validation Étienne |
| 02 | Scaffold `supabase/` + `packages/shared` | [02-scaffold-supabase-shared.md](02-scaffold-supabase-shared.md) | Scaffold | — |
| 03 | Migrations Lot 0 en **brouillon** (001→007) | [03-migrations-draft.md](03-migrations-draft.md) | SQL brouillon | — |
| 04 | Tests pgTAP en **brouillon** | [04-pgtap-draft.md](04-pgtap-draft.md) | SQL test brouillon | — |
| 05 | Relire le SQL avec checklist | [05-sql-review.md](05-sql-review.md) | Revue | 🛑 Validation Étienne |
| 06 | Exécuter les migrations **après feu vert** | [06-migration-execution.md](06-migration-execution.md) | Exécution | 🛑 Autorisation explicite requise |

## Ce qu'il ne faut SURTOUT PAS paralléliser

Cette série est une **chaîne de dépendances**. Aucun ticket ne peut démarrer avant que le précédent soit committé et (le cas échéant) validé.

- **01 → 02** : le scaffold des enums/types `packages/shared` dépend des noms figés dans le dictionnaire.
- **02 → 03** : impossible d'écrire une migration dans `supabase/migrations/` avant que le dossier existe.
- **03 → 04** : chaque test pgTAP cible une table précise d'une migration ; écrire les tests avant les migrations = tests sans cible.
- **05 → 06** : l'exécution ne démarre **jamais** sans le rapport de revue **et** le « feu vert » explicite d'Étienne.

Les **gates 🛑** (01, 05, 06) sont des points d'arrêt durs : Codex s'arrête, rend son livrable, et **attend** une réponse humaine. Il ne les franchit pas de sa propre initiative.

## Interdits transverses (valables pour TOUS les tickets 01→05)

- ❌ Aucune modification de code applicatif (`apps/web/**`, `apps/worker/**`).
- ❌ Aucune exécution de migration (`supabase db push`, `supabase migration up`, `supabase link`, `supabase start` réel contre un projet distant).
- ❌ Aucune connexion à un Supabase distant, aucun remote GitHub, aucun secret réel.
- ❌ Aucune installation de dépendance réseau non prévue par le ticket.
- ❌ Ne pas revert les changements non liés du worktree (ils appartiennent à Étienne).

## Convention de commit

Un commit **par ticket**, en fin de ticket, avec le message suggéré fourni dans chaque fichier. Format : `docs(lot-0): …`, `chore(lot-0): …`, `feat(lot-0-draft): …`. Ne jamais committer un ticket à moitié fait.
