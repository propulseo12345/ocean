# Ticket LOT5-05 — Loader typé + registry + tests de parité

## Ticket ID
`LOT5-05`

## Objectif
Finaliser `@ocean/skills` : brancher les types de `@ocean/shared`, exposer un `SKILL_REGISTRY` statique typé, et poser **deux tests de contrat** qui empêchent la dérive entre le catalogue disque, le registry, et le futur seed SQL.

## Pré-requis
- `LOT5-03` committé (`packages/skills` scaffoldé).
- `LOT5-04` committé (`zod` + enums de domaine dans `@ocean/shared`).

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **D-3** et **Task 5**.
- **Le repo n'a AUCUN runner de tests JS aujourd'hui** (`package.json` racine : `dev`, `build`, `start`, `check`, `check:fix`, `format`). Les seuls tests sont pgTAP en SQL.
- **Décision : ne pas introduire Vitest/Jest dans ce ticket.** Écrire les tests comme un **script de validation exécutable** (`node --experimental-strip-types` ou un `.ts` lancé par `tsx` si déjà présent), invoqué par un script `skills:check`. Un runner de tests JS est un chantier à part, hors périmètre du Lot 5.
- Si un runner existe déjà au moment de l'exécution (le Lot 2 ou 3 a pu l'introduire), l'utiliser plutôt que le script maison. Le vérifier d'abord : `Select-String -Path package.json -Pattern '"test"'`.

**Le test de parité est un contrat inter-tickets.** Le ticket 06 écrira une migration qui seede `skills.input_schema`. Ce ticket pose la constante `EXPECTED_SEEDED_SCHEMA` que la migration devra recopier **à l'identique**. Si un dev modifie `skill.json` sans écrire la migration, le check casse.

## Fichiers autorisés
- `packages/skills/src/index.ts` (modification)
- `packages/skills/src/manifest.ts` (modification : importer `SkillAgent` depuis `@ocean/shared`)
- `packages/skills/src/loader.ts` (modification : validation au chargement)
- `packages/skills/src/expected-seed.ts` (création)
- `packages/skills/scripts/check-catalog.ts` (création)
- `packages/skills/package.json` (modification : dépendance `@ocean/shared`, script `check`)
- `package.json` racine (modification : script `skills:check`)

## Fichiers interdits
- `apps/**`, `supabase/**`.
- `packages/shared/**` (figé au ticket 04).
- Toute installation de runner de tests (Vitest, Jest, node:test wrapper…).

## Étapes attendues

### 1. Brancher `@ocean/shared`
`packages/skills/package.json` : `"dependencies": { "@ocean/shared": "workspace:*" }`.
`src/manifest.ts` : remplacer le `SkillAgent` local par un import depuis `@ocean/shared/types/domain`, et retirer le `// TODO(LOT5-04)`.

### 2. `SKILL_REGISTRY` statique — `src/index.ts`
```ts
import type { SkillDefinition } from "./manifest"
import marketingTeamCampaign from "../marketing_team_campaign/skill.json" with { type: "json" }

export const SKILL_REGISTRY: readonly SkillDefinition[] = [marketingTeamCampaign as SkillDefinition]
export const SKILL_SLUGS = SKILL_REGISTRY.map((s) => s.slug)
```
Zéro `fs`. C'est ce que `apps/web` importera via `@ocean/skills/catalog`.
> Si l'import JSON avec attributs pose problème au typecheck, re-déclarer la constante en TS et laisser le test de parité (§4) garantir qu'elle correspond au `skill.json`.

### 3. Validation au chargement (fail fast) — `src/loader.ts`
```ts
export async function assertCatalogIntegrity(): Promise<void>
```
Vérifie, pour chaque skill du registry :
- `resolveSkillDir(slug)` existe sur disque ;
- chaque `agents[].markdown` existe et est lisible ;
- `orchestrator` fait partie de `agents[].id` ;
- les `slug` sont uniques ;
- chaque `dependsOn` référence un `index` existant.

Le worker l'appellera **au démarrage**. Une erreur = le worker ne démarre pas (Coolify le voit, Sentry le reporte). Mieux vaut échouer au boot qu'au premier run facturé.

### 4. `src/expected-seed.ts` — le contrat de parité
```ts
/**
 * Copie EXACTE du `input_schema` que la migration `0NN_skills_catalog.sql` seedera
 * dans `public.skills`. Toute divergence casse `pnpm skills:check`.
 * Modifier ce fichier ET la migration, jamais l'un sans l'autre.
 */
export const EXPECTED_SEEDED_SCHEMA = { /* … le JSON Schema du skill.json … */ } as const
```

### 5. `scripts/check-catalog.ts`
Deux assertions, sortie non-zéro en cas d'échec :
- **(a) intégrité** : `await assertCatalogIntegrity()`.
- **(b) parité** : `JSON.stringify(skill.inputSchema)` **byte-identique** à `JSON.stringify(EXPECTED_SEEDED_SCHEMA)` (après tri des clés, pour éviter un faux négatif d'ordre).

Afficher un diff lisible en cas d'échec.

### 6. Scripts
`packages/skills/package.json` : `"scripts": { "check": "node --experimental-strip-types scripts/check-catalog.ts" }` (adapter au runtime disponible).
`package.json` racine : `"skills:check": "pnpm --filter @ocean/skills check"`.

## Critères d'acceptation
- [ ] `packages/skills` dépend de `@ocean/shared` (`workspace:*`).
- [ ] `src/manifest.ts` importe `SkillAgent` depuis `@ocean/shared/types/domain` ; le `TODO(LOT5-04)` a disparu.
- [ ] `src/index.ts` exporte `SKILL_REGISTRY` et `SKILL_SLUGS`, **sans importer `node:fs`**.
- [ ] `assertCatalogIntegrity()` vérifie : dossier, markdowns, `orchestrator ∈ agents`, unicité des slugs, `dependsOn` valides.
- [ ] `src/expected-seed.ts` existe et porte le commentaire « modifier ce fichier ET la migration ».
- [ ] `pnpm skills:check` passe et **échoue** si l'on modifie `skill.json` sans toucher `expected-seed.ts` (le vérifier en le cassant volontairement, puis en le réparant).
- [ ] Aucun runner de tests JS n'a été installé.
- [ ] `pnpm check` passe. Zéro `any`. Aucun fichier > 250 lignes.

## Commandes de validation
```powershell
# Le check passe
pnpm skills:check

# Il echoue si le catalogue derive : casser puis reparer
# (modifier temporairement skill.json -> pnpm skills:check doit sortir != 0)

# index.ts reste isomorphe
Select-String -Path 'packages\skills\src\index.ts' -Pattern 'node:'   # attendu : aucun match

# La dependance workspace est declaree
Select-String -Path 'packages\skills\package.json' -Pattern '@ocean/shared'

# Le TODO du ticket 04 a disparu
rg "TODO\(LOT5-04\)" packages\skills                                  # attendu : aucun match

# Aucun runner de tests n'a ete introduit
rg "vitest|jest" package.json packages\skills\package.json            # attendu : aucun match

# Aucun fichier > 250 lignes
Get-ChildItem -Recurse -Path 'packages\skills' -Include *.ts | ForEach-Object { $n=(Get-Content $_ | Measure-Object -Line).Lines; if ($n -gt 250) { "$($_.Name): $n lignes" } }

pnpm check
```

## Risques / points d'attention
- **Le test de parité est un contrat vers un ticket futur.** `EXPECTED_SEEDED_SCHEMA` fige aujourd'hui ce que la migration du ticket 06 devra seeder. C'est volontaire : sans ça, le catalogue disque et la table `skills` divergent silencieusement, et le front affiche un formulaire qui ne correspond plus au schéma que le LLM reçoit.
- **Ne pas introduire un runner de tests JS.** Le repo n'en a pas, la CI n'existe pas. Un script `skills:check` exécutable suffit et sera trivial à brancher en CI plus tard. Introduire Vitest ici, c'est ouvrir un chantier hors périmètre.
- **`assertCatalogIntegrity()` doit être appelée au boot du worker**, pas au premier run. Un `markdown` manquant découvert à l'heure H coûte un run avorté ; découvert au boot, il coûte un redémarrage.
- **`SKILL_REGISTRY` ne doit pas importer `loader.ts`.** Sinon `apps/web`, en important `@ocean/skills/catalog`, tirerait `node:fs` dans le bundle client. La frontière est : `catalog`/`manifest`/`pricing` = isomorphes ; `loader` = Node.
- **Le tri des clés dans le test de parité** évite un faux négatif : `JSON.stringify` n'ordonne pas les clés d'un objet littéral de la même façon qu'un `jsonb` re-sérialisé. Trier avant de comparer.

## Résultat attendu
Un catalogue typé, validé au boot, et un contrat de parité qui casse si le disque et le futur seed SQL divergent.

## Message de commit suggéré
```
feat(lot-5): loader typé, registry statique et tests de parité du catalogue

SKILL_REGISTRY isomorphe (zero node:fs). assertCatalogIntegrity() en fail-fast
au boot du worker. expected-seed.ts fige le input_schema que la migration
0NN_skills_catalog.sql devra recopier : pnpm skills:check casse en cas de derive.
Aucun runner de tests JS introduit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-06` démarre seulement une fois ce commit fait.
