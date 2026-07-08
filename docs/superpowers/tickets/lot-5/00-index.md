# Lot 5 — Index des tickets (exécution Codex, un par un)

> **But** : découper le plan `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md` en tickets atomiques, exécutables **un seul à la fois** dans Codex avec un contexte minimal.
>
> **Règle d'or de cette série** : le Lot 5 est un lot **post-MVP** (le PRD §4 classe « IA de rédaction » en V2). Il s'exécute **après le Lot 3**. Rien ne démarre tant que la **gate d'entrée (ticket 01)** n'est pas verte et qu'Étienne n'a pas donné le feu vert.

## Contexte du repo (vérifié le 2026-07-08)

- `apps/worker/` : **absent** → livré au Lot 2. **Prérequis dur du Lot 5.**
- `packages/skills/` : **absent** → scaffoldé au ticket 03.
- `packages/shared` : squelette (`src/schemas/index.ts` = `export {}`, zod **non installé**).
- `apps/web` : **zéro** Server Action (`grep 'use server'` = 0), pas de `lib/supabase/`.
- `supabase/migrations/` : 001→007 (Lot 0) **jamais exécutées** — gate `LOT0-06` non franchie.
- `pnpm-workspace.yaml` : contient **déjà** `- "packages/*"` → **ne pas le modifier** (juste vérifier).
- `Dockerfile` racine : ne construit que `apps/web` (`COPY apps/web/package.json`, `pnpm --filter web build`).
- Aucun `.github/` : **pas de CI**. Les leak tests pgTAP ne tournent nulle part. Dette **antérieure** au Lot 5.
- Aucune dépendance IA dans `pnpm-lock.yaml`.
- Gabarit de ticket de référence : `docs/superpowers/tickets/lot-0/03-migrations-draft.md`.

## Décisions structurantes (déjà actées, ne pas rouvrir)

- **Postiz : abandonné.** Aucun connecteur. Motif : décision actée #17 (« Redis = seconde source de vérité de l'état des jobs — le scénario classique de double publication ») + PRD §5.E (« toute la programmation passe par notre worker, uniformément »). Ocean refuse déjà l'ordonnanceur *natif de Meta* ; un ordonnanceur tiers est a fortiori exclu.
- **Managed Agents / `client.beta.agents` + `sessions` : interdits.** Le SDK Anthropic les propose littéralement pour ce cas d'usage — mais l'état du run vivrait chez Anthropic et le reaper Ocean ne pourrait pas le reprendre. **Même motif que le rejet de Redis.** Ocean orchestre, Anthropic infère.
- **4 tables neuves seulement** : `skills`, `skill_runs`, `skill_run_steps`, `skill_artifacts`, plus `content_items.skill_run_id`. Tout le reste existe déjà (`content_items`, `content_targets`, `approvals`, `social_accounts`, `platform_connections`).
- **Le LLM tourne dans `apps/worker`**, via la file `skill_runs` (`FOR UPDATE SKIP LOCKED` + lease + reaper). Les Edge Functions (400 s wall), la Server Action longue et `after()` sont rejetés.
- **Clé Anthropic en variable d'env du worker**, pas en Vault. Elle appartient à Propul'SEO, il y en a une pour l'instance, pas de refresh, pas d'enjeu RGPD — aucune des propriétés qui justifient le pattern `*_secrets`.

## Ordre d'exécution (STRICTEMENT séquentiel)

| # | Ticket | Fichier | Type | Gate |
|---|--------|---------|------|------|
| 01 | Gate d'entrée : vérifier les 7 prérequis durs | [01-entry-gate.md](01-entry-gate.md) | Vérification | 🛑 Autorisation explicite requise |
| 02 | Figer le dictionnaire DB Lot 5 | [02-db-dictionary.md](02-db-dictionary.md) | Doc | 🛑 Validation Étienne |
| 03 | Scaffold `packages/skills` (catalogue + 5 `SKILL.md`) | [03-scaffold-skills-package.md](03-scaffold-skills-package.md) | Scaffold | — |
| 04 | Schémas Zod partagés (`packages/shared`) | [04-shared-zod-schemas.md](04-shared-zod-schemas.md) | Code | — |
| 05 | Loader typé + registry + tests de parité | [05-skill-loader.md](05-skill-loader.md) | Code | — |
| 06 | Migrations Lot 5 en **brouillon** | [06-migrations-draft.md](06-migrations-draft.md) | SQL brouillon | — |
| 07 | Tests pgTAP Lot 5 en **brouillon** | [07-pgtap-draft.md](07-pgtap-draft.md) | SQL test brouillon | — |
| 08 | Relire le SQL avec checklist | [08-sql-review.md](08-sql-review.md) | Revue | 🛑 Validation Étienne |
| 09 | Exécuter les migrations **après feu vert** | [09-migration-execution.md](09-migration-execution.md) | Exécution | 🛑 Autorisation explicite requise |
| 10 | Worker : file `skill_runs` — **SANS LLM** | [10-worker-queue.md](10-worker-queue.md) | Code | — |
| 11 | Worker : exécuteur LLM + idempotence | [11-worker-llm-executor.md](11-worker-llm-executor.md) | Code | 🛑 Validation Étienne (1ʳᵉ dépense) |
| 12 | Worker : pont artifacts → `content_items` | [12-worker-content-bridge.md](12-worker-content-bridge.md) | Code | — |
| 13 | Web : Server Action + suivi Realtime | [13-web-start-and-track.md](13-web-start-and-track.md) | Code | 🛑 Validation Étienne (démo E2E) |

## Ce qu'il ne faut SURTOUT PAS paralléliser

Cette série est une **chaîne de dépendances**. Aucun ticket ne peut démarrer avant que le précédent soit committé et (le cas échéant) validé.

- **01 → 02** : si un prérequis manque, le dictionnaire fige un contrat qui ne pourra pas s'exécuter.
- **02 → 06** : les noms de tables/colonnes du SQL viennent du dictionnaire validé.
- **03 → 04 → 05** : le registry type le loader ; les schémas Zod typent le registry.
- **05 → 06** : le test de parité `skill.json.inputSchema` ↔ `skills.input_schema` est un contrat que la migration doit honorer.
- **06 → 07** : chaque test pgTAP cible une table précise d'une migration ; écrire les tests avant = tests sans cible.
- **08 → 09** : l'exécution ne démarre **jamais** sans le rapport de revue **et** le feu vert explicite d'Étienne.
- **09 → 10** : le worker ne peut pas claim une table qui n'existe pas.
- **10 → 11** : la file doit être prouvée (claim, lease, reaper, `kill -9`) **avant** qu'un seul dollar soit dépensé en LLM.
- **11 → 12** : le pont matérialise ce que l'exécuteur produit.
- **12 → 13** : le front affiche ce que le worker écrit.

Les **gates 🛑** (01, 02, 08, 09, 11, 13) sont des points d'arrêt durs : Codex s'arrête, rend son livrable, et **attend** une réponse humaine. Il ne les franchit pas de sa propre initiative.

## Interdits transverses (valables pour TOUS les tickets 01→09)

- ❌ Aucune modification de code applicatif (`apps/web/**`, `apps/worker/**`).
- ❌ Aucune exécution de migration (`supabase db push`, `supabase migration up`, `supabase link`, `supabase start` contre un projet distant).
- ❌ Aucune connexion à un Supabase distant, aucun remote GitHub, aucun secret réel.
- ❌ **Aucun appel LLM réel.** Le premier est autorisé au ticket 11, après gate.
- ❌ Aucune installation de dépendance réseau non prévue par le ticket.
- ❌ Ne pas revert les changements non liés du worktree (ils appartiennent à Étienne).

## Interdits transverses (valables pour TOUTE la série)

- ❌ `@anthropic-ai/sdk` dans `apps/web` ou `packages/shared`. **Worker uniquement** (ticket 11).
- ❌ `ANTHROPIC_API_KEY` lue ailleurs que dans `apps/worker`. Jamais en `NEXT_PUBLIC_*`.
- ❌ `client.beta.agents` / `client.beta.sessions` (Managed Agents) — seconde source de vérité.
- ❌ Le pooler transaction `6543`. Supavisor **SESSION port 5432** exclusivement.
- ❌ `disable row level security`, même « pour tester ».
- ❌ `delete from storage.objects` en SQL. API Storage uniquement (règle 23).
- ❌ Un fichier applicatif > 250 lignes. Zéro `any` (Biome `noExplicitAny: error`).

## Convention de commit

Un commit **par ticket**, en fin de ticket, avec le message suggéré fourni dans chaque fichier. Format : `docs(lot-5): …`, `chore(lot-5): …`, `feat(lot-5-draft): …`, `feat(lot-5): …`. Ne jamais committer un ticket à moitié fait.
