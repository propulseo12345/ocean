# Ticket LOT5-03 — Scaffold `packages/skills` (catalogue + 5 `SKILL.md`)

## Ticket ID
`LOT5-03`

## Objectif
Créer le package `@ocean/skills` : le **catalogue de skills sur disque**, versionné par git. Contient le manifeste `skill.json` du skill `marketing_team_campaign` et les 5 `SKILL.md` de ses agents. **Aucun appel LLM, aucune dépendance réseau, aucun SDK.**

## Pré-requis
- `LOT5-02` terminé, dictionnaire validé par Étienne (décisions D-1 et D-2 tranchées).

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **D-3** et **Task 3**.
- Convention `exports` par sous-chemin à répliquer : `packages/shared/package.json` (pas de barrel racine, pas de `main`, pas de build step — exports pointant directement sur les sources `.ts`).
- `pnpm-workspace.yaml` contient **déjà** `- "packages/*"` → **ne pas le modifier**, juste vérifier.
- Style Biome : double quotes, `semicolons: "asNeeded"`, indent 2 espaces, `lineWidth: 100`, zéro `any`.

**Pourquoi `packages/skills/` et pas ailleurs :**
- Pas `apps/worker/src/skills/` : le web a besoin des métadonnées (nom, description, `inputSchema`) pour construire et valider le formulaire de brief. L'enterrer dans le worker force une duplication ou un import croisé entre apps.
- Pas `/skills` à la racine : hors du champ `packages/*` de `pnpm-workspace.yaml` → pas de résolution par nom, pas d'`exports`.
- Pas `packages/shared` : `shared` ne contient que types et schémas, sans I/O. Le loader importe `node:fs` — il serait bundlé pour le navigateur.

**La séparation dure `./manifest` / `./loader` est le point clé :**
`apps/web` importe `./manifest` (isomorphe, zéro `fs`) et jamais `./loader` (Node uniquement).

## Fichiers autorisés (création uniquement)
- `packages/skills/package.json`
- `packages/skills/tsconfig.json`
- `packages/skills/src/manifest.ts`
- `packages/skills/src/loader.ts`
- `packages/skills/src/pricing.ts`
- `packages/skills/src/index.ts`
- `packages/skills/marketing_team_campaign/skill.json`
- `packages/skills/marketing_team_campaign/agents/campaign_manager/SKILL.md`
- `packages/skills/marketing_team_campaign/agents/research/SKILL.md`
- `packages/skills/marketing_team_campaign/agents/data_analysis/SKILL.md`
- `packages/skills/marketing_team_campaign/agents/content_strategy/SKILL.md`
- `packages/skills/marketing_team_campaign/agents/creative_copy/SKILL.md`

## Fichiers interdits
- `pnpm-workspace.yaml` (contient déjà `packages/*`).
- `packages/shared/**` (c'est le ticket 04).
- `supabase/**`, `apps/**`.
- Toute installation de dépendance (`zod` arrive au ticket 04, le SDK Anthropic au ticket 11).

## Étapes attendues

### 1. `package.json`
```json
{
  "name": "@ocean/skills",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./manifest": "./src/manifest.ts",
    "./loader": "./src/loader.ts",
    "./pricing": "./src/pricing.ts",
    "./catalog": "./src/index.ts"
  }
}
```
Aucune dépendance à ce stade.

### 2. `src/manifest.ts` — types, **isomorphe, zéro `node:fs`**
Décrit la forme du `skill.json`. Les enums de domaine (`SkillAgent`) viendront de `@ocean/shared` au ticket 04 ; pour l'instant, les déclarer localement et laisser un commentaire `// TODO(LOT5-04): importer depuis @ocean/shared/types/domain`.

Types attendus : `SkillDeliverableFormat`, `SkillAgentDefinition` (`id`, `markdown`, `effort`, `maxTokens`, `produces`, `delegatesTo?`, `dependsOn?`), `SkillDefinition` (`slug`, `version`, `name`, `description`, `model`, `orchestrator`, `agents`, `deliverables`, `inputSchema`).

Tous les champs en `readonly`.

### 3. `src/loader.ts` — Node uniquement, garde anti-path-escape
```ts
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))   // packages/skills/src

/** Résout le dossier d'un skill depuis son slug. Lève si le chemin s'échappe du catalogue. */
export function resolveSkillDir(slug: string): string {
  const root = path.resolve(PACKAGE_ROOT, "..")
  const dir = path.resolve(root, slug)
  if (!dir.startsWith(root + path.sep)) throw new Error("SKILL_PATH_ESCAPE")
  return dir
}

/** Lit un SKILL.md. Le chemin relatif provient du skill.json, jamais d'une valeur utilisateur. */
export async function readSkillMarkdown(slug: string, relativePath: string): Promise<string> {
  const resolved = path.normalize(path.join(resolveSkillDir(slug), relativePath))
  if (!resolved.startsWith(resolveSkillDir(slug) + path.sep)) throw new Error("SKILL_PATH_ESCAPE")
  return readFile(resolved, "utf8")
}
```

### 4. `src/pricing.ts`
`MODEL_PRICING` en **micro-dollars par million de tokens**, jamais en float (c'est de l'argent).
Opus 4.8 : `5_000_000` micro-$ / M tokens en entrée, `25_000_000` en sortie. Prévoir `cacheRead` (≈ 0,1×) et `cacheWrite` (≈ 1,25×).
Exporter une fonction `computeCostMicros(usage, model): bigint`.

> ⚠️ **Piège** : `usage.input_tokens` est le **reliquat non-caché** seulement. Le total d'entrée = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. Le commenter dans le code.

### 5. `src/index.ts`
`SKILL_CATALOG` : registry **statique** (import du `skill.json` par `import … with { type: "json" }` ou re-déclaration typée). Zéro `fs`. C'est ce que `apps/web` importera.

### 6. `marketing_team_campaign/skill.json`
Champs : `slug`, `version`, `name`, `description`, `model: "claude-opus-4-8"`, `orchestrator: "campaign_manager"`, `agents[]` (5 entrées avec `id`, `markdown`, `effort`, `maxTokens`, `produces`, `dependsOn`), `deliverables[]`, `inputSchema` (JSON Schema, `additionalProperties: false`).

`inputSchema` minimal : `objective` (string, 10–2000), `horizon_days` (integer, 7–90), `audience` (string, ≤ 1000), `platforms` (array d'enum `instagram|facebook|tiktok|newsletter`, min 1). `required: ["objective", "horizon_days"]`.

Effort : `xhigh` pour `campaign_manager`, `high` pour les autres. `maxTokens` : 32000 partout, 64000 pour `creative_copy`.

### 7. Les 5 `SKILL.md`
Chacun ≤ 250 lignes, avec un front-matter YAML (`slug`, `name`, `dependsOn`, `produces`) puis les sections `# Rôle`, `# Format de sortie`, `# Interdits`.

**Règles de rédaction, non négociables :**
- ⚠️ **Aucun placeholder `{{BRAND_KIT}}` / `{{CONTENT_PILLARS}}` dans le corps.** Le contexte de marque est injecté dans le **tour `user`**, jamais dans le `system` — sinon le préfixe de cache est invalidé à chaque run. Le `SKILL.md` doit dire : « les contraintes de marque te sont fournies dans le message utilisateur ».
- ⚠️ **Aucune interpolation de date, de `run_id` ou de compteur.** Le `SKILL.md` doit être **byte-identique entre les runs** — c'est ce qui le rend cacheable.
- ⚠️ **Jamais de clé API, jamais de secret.** Le skill `claude-api` est catégorique : ce qui entre dans le `system` persiste dans l'historique.
- Le `creative_copy` doit exiger : **une seule langue** (celle du brief), **jamais** d'objet `{fr, en}`, aucun mot de `bannedWords`, aucune plateforme absente de `platforms`.
- Chaque agent répond **uniquement** avec un objet JSON conforme au schéma qui lui sera fourni (structured outputs).

### 8. Vérifier, ne pas modifier
`pnpm-workspace.yaml` couvre déjà `packages/*`. Le vérifier, ne rien changer.

## Critères d'acceptation
- [ ] `packages/skills/package.json` existe, `"name": "@ocean/skills"`, `"type": "module"`, exports par sous-chemin, **zéro dépendance**.
- [ ] `src/manifest.ts` **n'importe aucun module `node:*`**.
- [ ] `src/loader.ts` contient la garde `SKILL_PATH_ESCAPE` sur `resolveSkillDir` **et** sur `readSkillMarkdown`.
- [ ] `src/pricing.ts` exprime les coûts en `bigint` de micro-dollars, avec le commentaire sur `input_tokens` (reliquat non-caché).
- [ ] `marketing_team_campaign/skill.json` liste les 5 agents avec `markdown`, `effort`, `maxTokens`, `produces`.
- [ ] Les 5 `SKILL.md` existent, chacun ≤ 250 lignes.
- [ ] **Aucun `{{`, aucune date, aucun `run_id`, aucun `sk-ant-` dans un `SKILL.md`.**
- [ ] `pnpm-workspace.yaml` est inchangé.
- [ ] `pnpm check` passe (Biome : formatage + zéro `any`).
- [ ] Aucun fichier hors `packages/skills/` n'a été touché.

## Commandes de validation
```powershell
# Le package existe et n'a aucune dependance
Get-Content 'packages\skills\package.json'
Select-String -Path 'packages\skills\package.json' -Pattern '"dependencies"'   # attendu : aucun match

# manifest.ts est isomorphe : aucun node:*
Select-String -Path 'packages\skills\src\manifest.ts' -Pattern 'node:'         # attendu : aucun match

# La garde anti-path-escape est presente
Select-String -Path 'packages\skills\src\loader.ts' -Pattern 'SKILL_PATH_ESCAPE'

# Les 5 SKILL.md existent
Get-ChildItem -Recurse -Path 'packages\skills\marketing_team_campaign\agents' -Filter 'SKILL.md' | Measure-Object

# Aucun placeholder, aucune date, aucun secret dans les SKILL.md
rg "\{\{|sk-ant-|new Date|Date\.now" packages\skills\marketing_team_campaign     # attendu : aucun match

# Aucun fichier > 250 lignes
Get-ChildItem -Recurse -Path 'packages\skills' -Include *.md,*.ts | ForEach-Object { $n=(Get-Content $_ | Measure-Object -Line).Lines; if ($n -gt 250) { "$($_.Name): $n lignes" } }

# Le workspace n'a pas bouge
git diff --exit-code pnpm-workspace.yaml

# Biome
pnpm check
```

## Risques / points d'attention
- **Le piège du prompt caching.** Un `{{BRAND_KIT}}` interpolé dans le `system` change le préfixe à chaque run → `cache_read_input_tokens` reste à zéro, silencieusement, et chaque run repaie le préfixe plein tarif. Le contexte va dans le tour `user`, après le breakpoint.
- **Minimum cacheable Opus 4.8 = 4096 tokens.** Un `SKILL.md` trop court **ne cachera pas**, sans erreur ni avertissement. Ce n'est pas bloquant ici, mais à vérifier au ticket 11 (`usage.cache_read_input_tokens > 0` au 2ᵉ run).
- **La séparation `./manifest` / `./loader` est un invariant de sécurité et de bundle.** Si `apps/web` importe `./loader`, `node:fs` part dans le bundle client. Un verrou CI le vérifiera au ticket 13.
- **Ne pas installer `zod` ici.** Le `inputSchema` du `skill.json` est du JSON Schema brut ; son miroir Zod arrive au ticket 04. Le test de parité entre les deux est le ticket 05.
- **Path traversal** : `resolveSkillDir` est la seule fonction autorisée à construire un chemin. Ne jamais concaténer `manifest_path` venu de la base.

## Résultat attendu
Un package `@ocean/skills` autonome, sans dépendance, contenant le catalogue disque et son loader sécurisé. Rien ne s'exécute encore.

## Message de commit suggéré
```
chore(lot-5): scaffold packages/skills (catalogue + 5 SKILL.md)

@ocean/skills : exports par sous-chemin, separation manifest (isomorphe) /
loader (node:fs, garde SKILL_PATH_ESCAPE). Skill marketing_team_campaign :
skill.json + 5 SKILL.md. Contexte de marque injecte dans le tour user,
jamais dans le system (prompt caching). Zero dependance.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-04` démarre seulement une fois ce commit fait.
