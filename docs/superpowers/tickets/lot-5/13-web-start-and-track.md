# Ticket LOT5-13 — Web : Server Action `startSkillRun` + suivi Realtime

## Ticket ID
`LOT5-13`

## Objectif
Permettre à l'owner de lancer une campagne depuis l'UI et d'en suivre l'avancement en temps réel. **C'est la première Server Action du repo** (`grep 'use server'` = 0 aujourd'hui) : elle devient le **gabarit de référence** pour tous les Lots.

## Pré-requis
- `LOT5-12` committé (le worker produit des brouillons réels).
- **`apps/web/lib/supabase/{server,client}.ts` existe** (Lot 0 côté web). **Si absent → STOP**, ce ticket ne peut pas s'écrire.

## 🛑 Pré-condition bloquante
Ce ticket se termine par une **démo end-to-end validée par Étienne** :
brief → run → 5 steps en Realtime → N brouillons visibles au studio → envoi en revue.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **Task 13**.
- Pattern imposé (`CLAUDE.md` §3 et §7, `_research/audits/2026-07-07/11b-couche-data-et-contrats.md`) :
  ```
  'use server'
  → getActiveOrg()  en 1re ligne        → null = UNAUTHORIZED
  → check rôle owner/admin              → sinon FORBIDDEN
  → schema.parse(input)                 → Zod strict
  → insert { ...parsed, org_id: ctx.org.id }   ← INJECTION OBLIGATOIRE
  → revalidateTag / revalidatePath
  ```
- `apps/web/lib/auth/org-context.ts` expose déjà `getActiveOrg()` → `{ org, role, user }` et `getReviewerContext()`.
- La façade données est `apps/web/lib/data/index.ts` (`import "server-only"`).
- Style Biome : double quotes, `semicolons: "asNeeded"`, indent 2, `lineWidth: 100`, zéro `any`.
- Fichier ≤ 250 lignes.

**Ce que le web n'importe JAMAIS :**
- `@anthropic-ai/sdk` — le worker est la seule app qui parle à Anthropic.
- `@ocean/skills/loader` — il importe `node:fs`, qui partirait dans le bundle client.
  Le web importe `@ocean/skills/catalog` et `@ocean/skills/manifest` (isomorphes).

## Fichiers autorisés
- `apps/web/lib/actions/skills.ts` (création)
- `apps/web/app/(app)/clients/[clientId]/skills/page.tsx` (création)
- `apps/web/app/(app)/clients/[clientId]/skills/[runId]/page.tsx` (création)
- `apps/web/components/app/skills/**` (création : formulaire de brief, timeline des steps, liste d'artifacts)
- `apps/web/lib/data/skills.ts` (création : getters `cache(async …)` derrière la façade)
- `apps/web/package.json` (modification : `@ocean/skills`, `@ocean/shared`)

## Fichiers interdits
- `apps/worker/**`, `packages/**`, `supabase/**`.
- **`@anthropic-ai/sdk`** dans `apps/web`.
- **`@ocean/skills/loader`** dans `apps/web`.
- Toute lecture de `ANTHROPIC_API_KEY`.

## Étapes attendues

### 1. `lib/actions/skills.ts` — la Server Action de référence

```ts
"use server"

import { revalidateTag } from "next/cache"
import { startSkillRunSchema } from "@ocean/shared/schemas"
import { getActiveOrg } from "@/lib/auth/org-context"
import { createServerClient } from "@/lib/supabase/server"

export type StartSkillRunResult =
  | { ok: true; runId: string }
  | { ok: false; code: "UNAUTHORIZED" | "FORBIDDEN" | "INVALID_INPUT" | "RUN_ALREADY_ACTIVE" }

export async function startSkillRun(input: unknown): Promise<StartSkillRunResult>
```

Corps, dans cet ordre exact :
1. `const ctx = await getActiveOrg()` — `null` → `UNAUTHORIZED`.
2. `if (ctx.role !== "owner" && ctx.role !== "admin")` → `FORBIDDEN`.
3. `const parsed = startSkillRunSchema.safeParse(input)` — échec → `INVALID_INPUT`.
4. Résoudre `skill_id` + `skill_version` par un `select` sur `skills` (le `skillSlug` est un **littéral Zod**, pas une chaîne libre).
5. Construire `context_snapshot` = `{ brandKit, contentPillars }`, lus **avec les policies RLS de l'utilisateur** (client `createServerClient()`, jamais `service_role`). Defense in depth.
6. `insert into skill_runs (…, org_id: ctx.org.id, created_by: ctx.user.id, status: 'queued')`
   — **`org_id` injecté depuis le contexte, jamais depuis `input`.**
7. Le code Postgres `23505` (violation de `skill_runs_active_per_client_skill_idx`) → `RUN_ALREADY_ACTIVE`.
8. `revalidateTag(\`client:${parsed.data.clientId}:skill-runs\`)`.
9. **Ne rien attendre.** Le run est `queued` ; le worker le prendra au tick suivant.

> ⚠️ **Le double-clic est gratuit à protéger.** L'index unique partiel renvoie `23505` → `RUN_ALREADY_ACTIVE`. Un run coûte ~1,75 $ : ne pas le laisser partir deux fois.

### 2. `lib/data/skills.ts` — les getters
Derrière la façade, signature conforme à la cible : `async`, `orgId` en 1er param, `clientId` explicite (anti-IDOR), `cache()`.
```ts
export const getSkillRuns = cache(async (orgId: string, clientId: string) => …)
export const getSkillRun = cache(async (orgId: string, clientId: string, runId: string) => …)
export const getSkillRunSteps = cache(async (orgId: string, clientId: string, runId: string) => …)
export const getSkillArtifacts = cache(async (orgId: string, clientId: string, runId: string) => …)
```

### 3. `skills/page.tsx` — le formulaire de brief
Server Component. Charge `SKILL_CATALOG` depuis `@ocean/skills/catalog` pour afficher nom, description et construire le formulaire depuis `inputSchema`.
Le formulaire (Client Component) appelle `startSkillRun`. Mapper les 4 codes d'erreur vers des messages clairs.

### 4. `skills/[runId]/page.tsx` — le suivi
Server Component pour le premier rendu (steps, artifacts), puis **abonnement Supabase Realtime sur `skill_runs`** (Client Component).

> ⚠️ **S'abonner à `skill_runs` uniquement.** `skill_run_steps` n'est **pas** publiée en Realtime : ses colonnes `input`/`output` sont volumineuses et contiennent de la donnée client — les diffuser sur le fil serait une fuite. Sur événement `skill_runs`, re-fetcher les steps par requête classique (la RLS filtre).

Affichage : la timeline des 5 agents (`pending → running → succeeded`), le coût courant (`total_cost_micros` → dollars), et les artifacts téléchargeables.

### 5. Téléchargement des artifacts
- `content` inline → rendu direct.
- `storage_path` → **URL signée** générée côté serveur (bucket privé). Jamais d'URL publique.

### 6. Le pont vers le studio
Depuis la page de run, un lien vers les `content_items` générés (`?skillRunId=<runId>`).
**Ne pas créer de bouton « matérialiser »** : le worker a déjà écrit les brouillons (ticket 12). Le rôle du web est de les montrer, pas de les créer.

## Critères d'acceptation
- [ ] `startSkillRun` suit **exactement** l'ordre : `getActiveOrg()` → check rôle → `parse` Zod → injection `org_id` → `revalidateTag`.
- [ ] `org_id` provient de `ctx.org.id`, **jamais** de `input`. Vérifiable à la lecture.
- [ ] `context_snapshot` est lu avec les policies RLS de l'utilisateur, **pas** en `service_role`.
- [ ] `23505` est mappé vers `RUN_ALREADY_ACTIVE` (protection double-clic).
- [ ] La Server Action **n'attend pas** le résultat du run.
- [ ] Realtime abonné à **`skill_runs` seulement**, jamais `skill_run_steps`.
- [ ] Les artifacts en Storage sont servis par **URL signée**.
- [ ] Aucun bouton « créer les brouillons » : ils existent déjà.
- [ ] `apps/web` n'importe ni `@anthropic-ai/sdk`, ni `@ocean/skills/loader`.
- [ ] `ANTHROPIC_API_KEY` n'apparaît nulle part dans `apps/web`.
- [ ] Aucun fichier > 250 lignes. Zéro `any`. `pnpm check` passe. `pnpm -C apps/web build` vert.

### La démo qui compte
- [ ] Brief saisi → run `queued` → les 5 steps passent en Realtime → N brouillons apparaissent au studio en **`draft`**, portant `skill_run_id`.
- [ ] Vérifier en base : chaque brouillon a ≥ 1 `content_target`.
- [ ] Vérifier au portail reviewer : **aucun brouillon visible** (règle §5.F — le reviewer ne voit jamais `draft`).
- [ ] Envoyer un brouillon en revue → il apparaît au portail.
- [ ] Double-cliquer « Lancer » → le 2ᵉ clic renvoie `RUN_ALREADY_ACTIVE`, aucun 2ᵉ run créé.

## Commandes de validation
```powershell
# La cle et le SDK ne fuient jamais cote web
rg "ANTHROPIC_API_KEY" apps\web packages          # attendu : aucun match
rg "@anthropic-ai/sdk" apps\web                   # attendu : aucun match
rg "NEXT_PUBLIC_ANTHROPIC" .                      # attendu : aucun match

# node:fs ne part pas dans le bundle client
rg "@ocean/skills/loader" apps\web                # attendu : aucun match

# Le gabarit Server Action est respecte
rg -A6 '"use server"' apps\web\lib\actions\skills.ts
rg "getActiveOrg\(\)" apps\web\lib\actions\skills.ts
rg "org_id: ctx.org.id" apps\web\lib\actions\skills.ts
rg "input.orgId|input.org_id" apps\web\lib\actions\skills.ts    # attendu : aucun match

# Protection double-clic
rg "23505|RUN_ALREADY_ACTIVE" apps\web\lib\actions\skills.ts

# Realtime : skill_runs seulement
rg "skill_run_steps" apps\web\components\app\skills             # aucun .channel() dessus
rg "\.channel\(" apps\web\components\app\skills

# URL signee pour les artifacts prives
rg "createSignedUrl" apps\web

# Regle 24 + zero any
Get-ChildItem -Recurse -Path 'apps\web\lib\actions','apps\web\components\app\skills' -Include *.ts,*.tsx | ForEach-Object { $n=(Get-Content $_ | Measure-Object -Line).Lines; if ($n -gt 250) { "$($_.Name): $n lignes" } }
rg ": any|as any" apps\web\lib\actions apps\web\components\app\skills   # attendu : aucun match

pnpm check
pnpm -C apps/web build
```

## Risques / points d'attention
- **C'est la première Server Action du repo.** Elle sera copiée. Si elle oublie l'injection `org_id` ou le check de rôle, le pattern fautif se propagera à tous les Lots. La relire deux fois.
- **`org_id` ne vient JAMAIS de `input`.** Un client untrusted peut poster n'importe quel UUID. Le contexte serveur (`getActiveOrg()`) est la seule source. Règle 10 : « Active org en contexte […] jamais depuis client untrusted ».
- **`context_snapshot` lu en RLS utilisateur, pas en `service_role`.** Le worker n'a pas à vérifier qu'un owner a le droit de lire le `brand_kit` de son client : la Server Action l'a déjà fait, avec les policies. Utiliser `service_role` ici, c'est perdre cette garantie.
- **Le double-clic coûte 1,75 $.** L'index unique partiel `skill_runs_active_per_client_skill_idx` existe exactement pour ça. Mapper `23505`, ne pas le laisser remonter en erreur 500.
- **Ne pas publier `skill_run_steps` en Realtime.** Ses colonnes `input`/`output` contiennent le brief du client et les sorties du LLM — de la donnée RGPD, volumineuse, diffusée à chaque changement. S'abonner au run, re-fetcher les steps.
- **Ne pas importer `@ocean/skills/loader` côté web.** Il importe `node:fs`. La séparation `catalog`/`manifest` (isomorphes) vs `loader` (Node) est un invariant de bundle **et** de sécurité (path traversal).
- **Ne pas créer de bouton « matérialiser les brouillons ».** Le worker les a déjà écrits, atomiquement, dans la même transaction que les artifacts (ticket 12). Un bouton côté web dupliquerait les états et rendrait l'idempotence à refaire.
- **Le bucket est privé.** Une URL publique permanente sur un rapport de campagne non validé serait une fuite. URL signée, générée côté serveur.
- Si `apps/web/lib/supabase/` n'existe pas (Lot 0 côté web non fait), **STOP** : ce ticket n'a pas de fondation.

## Résultat attendu
Un parcours complet dans Ocean : brief de campagne → run suivi en temps réel → brouillons dans le studio → envoi en revue → approbation → publication par le worker existant. **Sans jamais quitter Ocean, sans Postiz, sans seconde source de vérité.**

## Message de commit suggéré
```
feat(lot-5): web — Server Action startSkillRun + suivi Realtime

Premiere Server Action du repo, gabarit de reference : getActiveOrg() en L1,
check role owner/admin, parse Zod strict, org_id injecte depuis le contexte
(jamais depuis input), revalidateTag. 23505 -> RUN_ALREADY_ACTIVE (un run coute
~1,75 $, le double-clic est gratuit a protéger).
context_snapshot lu avec les policies RLS de l'utilisateur (defense in depth).
Realtime sur skill_runs uniquement : skill_run_steps porte le brief client.
Artifacts prives servis par URL signee. Aucun bouton "materialiser" : le worker
a deja ecrit les brouillons. apps/web n'importe ni le SDK Anthropic ni le loader.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. 🛑 Fin de la série `LOT5` — après validation de la démo end-to-end par Étienne.
