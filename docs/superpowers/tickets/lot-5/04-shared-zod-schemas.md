# Ticket LOT5-04 — Schémas Zod partagés (`packages/shared`)

## Ticket ID
`LOT5-04`

## Objectif
Installer `zod` dans `packages/shared` et y peupler les **types de domaine** (miroirs des enums DB Lot 5) et les **schémas Zod** consommés par la Server Action (validation du brief) et par le worker (re-validation des sorties LLM).

## Pré-requis
- `LOT5-03` committé (`packages/skills` scaffoldé).
- `LOT5-02` : les noms d'enums sont figés par le dictionnaire validé.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **Task 4**.
- État actuel : `packages/shared/package.json` a **zéro dépendance** ; `src/types/domain.ts` contient 6 unions de string ; `src/schemas/index.ts` vaut `export {}`.
- `CLAUDE.md` règle 27 : « Server Actions Zod-validées avec parsing strict ». Règle 25 : zéro `any`.
- Convention existante de `src/types/domain.ts` : des unions littérales, pas des enums TS.

**Décision actée (D-3) : la source de vérité du contrat d'entrée est Zod, pas JSON Schema.**
Le `inputSchema` du `skill.json` (JSON Schema) sert à `output_config.format` côté API Anthropic. Le miroir Zod sert à la Server Action. **On dérive le JSON Schema depuis Zod, jamais l'inverse.** Le ticket 05 pose un test de parité entre les deux.

## Fichiers autorisés
- `packages/shared/package.json` (modification : ajout de `zod`)
- `packages/shared/src/types/domain.ts` (modification : ajout des enums Lot 5)
- `packages/shared/src/schemas/index.ts` (remplacement de `export {}`)
- `packages/shared/src/schemas/skills.ts` (création)
- `pnpm-lock.yaml` (conséquence de `pnpm add`)

## Fichiers interdits
- `apps/**`, `supabase/**`.
- `packages/skills/**` (c'est le ticket 03, puis 05).
- `packages/shared/src/types/*` autre que `domain.ts`.

## Étapes attendues

### 1. Installer zod
```powershell
pnpm add zod -F @ocean/shared
```
Aucune autre dépendance. Pas de `react-hook-form`, pas de `@hookform/resolvers` (ticket 13 s'il en a besoin).

### 2. Étendre `src/types/domain.ts`
Ajouter les miroirs **exacts** des enums DB (mêmes valeurs, même ordre) :
```ts
export type SkillAgent =
  | "campaign_manager" | "research" | "data_analysis" | "content_strategy" | "creative_copy"

export type SkillRunStatus =
  | "queued" | "running" | "waiting_approval" | "completed" | "failed" | "canceled"

export type SkillStepStatus =
  | "pending" | "running" | "succeeded" | "failed" | "skipped"

export type SkillArtifactKind =
  | "task_manifest" | "campaign_report" | "content_calendar" | "copy_asset" | "research_note"
```
> ⚠️ **Ne jamais exporter `L<T>` depuis `packages/shared`.** Les types Lot 5 sont des miroirs 1:1 des colonnes SQL : `title: string | null`, jamais `{ fr, en }`. `content_items.caption` est du `text`.

### 3. Créer `src/schemas/skills.ts`

**`startSkillRunSchema`** — le brief, validé par la Server Action :
```ts
export const startSkillRunSchema = z.object({
  clientId: z.string().uuid(),
  skillSlug: z.literal("marketing_team_campaign"),
  objective: z.string().min(10).max(2000),
  horizonDays: z.number().int().min(7).max(90),
  audience: z.string().max(1000).optional(),
  platforms: z.array(z.enum(["instagram", "facebook", "tiktok", "newsletter"])).min(1),
}).strict()
```
`skillSlug` est un **littéral**, pas une chaîne libre : c'est ce qui empêche le web de demander un skill arbitraire.

**`taskManifestSchema`** — la sortie du step 0 (Campaign Manager) :
```ts
export const taskManifestSchema = z.object({
  tasks: z.array(z.object({
    agent: z.enum(["research", "data_analysis", "content_strategy", "creative_copy"]),
    index: z.number().int().min(1),
    instructions: z.string().min(1).max(4000),
    dependsOn: z.array(z.number().int().min(0)).default([]),
  })).min(1).max(8),
}).strict()
```

**`copyAssetSchema`** — un asset de copy, matérialisé en `content_items` :
```ts
export const copyAssetSchema = z.object({
  pillarId: z.string().uuid().nullable(),
  platform: z.enum(["instagram", "facebook", "tiktok", "newsletter"]),
  format: z.enum(["post", "carousel", "reel", "story"]),
  title: z.string().max(200).nullable(),
  caption: z.string().min(1).max(2200),
  hashtags: z.array(z.string().max(60)).max(30).default([]),
}).strict()
```
> ⚠️ **`caption` est un `string`, pas un `L<string>`.** Le LLM génère une langue, la DB stocke du `text`.
> ⚠️ Le schéma **n'accepte aucun `orgId` ni `clientId`** venu du LLM. Le worker les injecte depuis `skill_runs`.

**`campaignReportSchema`**, **`contentCalendarSchema`**, **`researchNoteSchema`** — sorties des autres agents, `.strict()` partout.

Exporter aussi les types inférés (`z.infer<typeof …>`).

### 4. `src/schemas/index.ts`
Remplacer `export {}` par `export * from "./skills"`.

### 5. Vérifier les exports du package
`packages/shared/package.json` expose déjà `"./schemas": "./src/schemas/index.ts"`. Ne pas ajouter de sous-chemin nouveau sans nécessité.

## Critères d'acceptation
- [ ] `zod` figure dans `packages/shared/package.json` et dans `pnpm-lock.yaml`.
- [ ] `src/types/domain.ts` exporte `SkillAgent`, `SkillRunStatus`, `SkillStepStatus`, `SkillArtifactKind`, avec des valeurs **strictement identiques** aux enums du dictionnaire (ticket 02).
- [ ] `src/schemas/index.ts` ne vaut plus `export {}`.
- [ ] `startSkillRunSchema` utilise `z.literal` pour `skillSlug` et `.strict()`.
- [ ] `copyAssetSchema.caption` est `z.string()`, **pas** un objet `{fr, en}`.
- [ ] **Aucun schéma n'accepte `orgId` ni `clientId` en provenance du LLM.**
- [ ] Aucun `L<T>` exporté depuis `packages/shared`.
- [ ] Zéro `any`. Tous les schémas `.strict()`.
- [ ] `pnpm check` passe.

## Commandes de validation
```powershell
# zod installe
Select-String -Path 'packages\shared\package.json' -Pattern '"zod"'

# schemas/index.ts n'est plus un stub
Get-Content 'packages\shared\src\schemas\index.ts'   # ne doit pas valoir "export {}"

# Les 4 enums Lot 5 sont la
rg "SkillAgent|SkillRunStatus|SkillStepStatus|SkillArtifactKind" packages\shared\src\types\domain.ts

# Aucun L<T> exporte
rg "L<" packages\shared\src                          # attendu : aucun match

# Aucun schema n'accepte un tenant venu du LLM
rg "orgId|clientId" packages\shared\src\schemas\skills.ts   # seul clientId de startSkillRunSchema (saisi par l'UI) est admis

# Tous les schemas sont stricts
rg -c "\.strict\(\)" packages\shared\src\schemas\skills.ts

# Zero any
rg ": any|as any" packages\shared\src                # attendu : aucun match

pnpm check
```

## Risques / points d'attention
- **Le piège `L<string>`.** Le front stocke encore du `{fr, en}` pour le contenu de démo (70 fichiers). C'est une commodité de mock, pas un type DB : `content_items.caption` est `text`. Si un schéma Lot 5 acceptait `{fr, en}`, on cuirait la commodité dans le contrat. **Prérequis P2** : la couture dé-`L<string>` doit être soldée.
- **Ne jamais accepter `org_id`/`client_id` d'une sortie LLM.** Le modèle peut halluciner un UUID. Le worker les injecte depuis `skill_runs` ; la FK composite `(client_id, org_id) → clients(id, org_id)` fait échouer (`23503`) tout mismatch — mais mieux vaut ne pas lui laisser l'occasion.
- **`.strict()` partout.** Un `additionalProperties` non contraint laisse le modèle glisser des champs inattendus dans le JSON.
- **Le `skillSlug` est un littéral.** Une `z.string()` permettrait au web de demander l'exécution d'un skill arbitraire — et donc, si le worker résolvait un chemin depuis cette valeur, une path traversal.
- Ne pas installer `react-hook-form` ici : le formulaire est le ticket 13, et il n'est pas dit qu'il en ait besoin.

## Résultat attendu
`packages/shared` expose les enums de domaine Lot 5 et les schémas Zod stricts, prêts à typer la Server Action et à re-valider les sorties LLM.

## Message de commit suggéré
```
feat(lot-5): schemas zod partages + enums de domaine Skills

zod installe dans @ocean/shared. domain.ts : SkillAgent, SkillRunStatus,
SkillStepStatus, SkillArtifactKind (miroirs 1:1 des enums DB).
schemas/skills.ts : startSkillRunSchema (skillSlug litteral), taskManifestSchema,
copyAssetSchema (caption: string, jamais L<string>). Tous .strict().
Aucun schema n'accepte org_id/client_id venu du LLM.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-05` démarre seulement une fois ce commit fait.
