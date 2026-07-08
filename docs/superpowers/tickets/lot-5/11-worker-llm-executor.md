# Ticket LOT5-11 — Worker : exécuteur LLM + idempotence des steps

## Ticket ID
`LOT5-11`

## Objectif
Insérer l'appel Anthropic entre les deux commits du step (structure posée au ticket 10). Implémenter à la lettre l'**idempotence de facturation** : `llm_call_started_at` commité **avant** l'appel HTTP, retry borné et tracé sur step orphelin, `maxRetries: 0` sur le SDK. **C'est le ticket où le premier dollar part.**

## Pré-requis
- `LOT5-10` committé, **et le test `kill -9` prouvé** (reaper requeue, aucun step dupliqué).

## 🛑 Pré-condition bloquante
- [ ] Étienne autorise explicitement la **première dépense LLM réelle** et fixe un **plafond de test** (ex. « feu vert LLM, plafond 20 $, un seul client de dev »).
- [ ] Le run de test cible **un client de développement**, jamais un client réel.
- **Sans cette autorisation, Codex écrit le code mais NE LANCE AUCUN RUN RÉEL.**

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **D-2**, **D-4**, **Task 11**.
- Règle 18 : appels HTTP **hors transaction**.
- Règle 24 : ≤ 250 lignes par fichier. Découper (`anthropic-client.ts`, `llm.ts`, `executor.ts`, `cost.ts`).

### Faits API Claude — vérifiés, à ne pas re-déduire
- Modèle : **`claude-opus-4-8`** — 1M contexte, 128 K output max, **$5 / $25 par M tokens**.
- **`thinking: { type: "adaptive" }` doit être explicite.** Omettre `thinking` = tourner **sans** thinking sur Opus 4.8.
- **`budget_tokens`, `temperature`, `top_p`, `top_k` renvoient 400** sur Opus 4.8. Ne pas les envoyer.
- Effort : `output_config: { effort: "high" | "xhigh" | … }` (défaut `high`).
- **Streaming obligatoire** au-dessus de ~16 000 `max_tokens` (sinon timeout HTTP du SDK). Nos steps sont à 32 000 → `client.messages.stream()` + `stream.finalMessage()`.
- **Structured outputs** : `output_config: { format: { type: "json_schema", schema } }` — **pas** l'ancien `output_format`. Les **prefills d'assistant renvoient 400**.
- `stop_reason === "refusal"` → erreur **permanente**, pas de retry.
- Prompt caching : `cache_control: { type: "ephemeral" }` sur le bloc `system`. **Minimum cacheable Opus 4.8 = 4096 tokens** — un `SKILL.md` court ne cachera pas, silencieusement.

### ⚠️ Le fait qui commande tout le ticket
**`/v1/messages` n'a AUCUNE idempotency key et aucun endpoint de relecture.** La surface est `POST /v1/messages`, `POST /v1/messages/count_tokens`, `POST /v1/messages/batches`.

La règle 15 de `CLAUDE.md` (« un job avec `publish_started_at` posé ne retry JAMAIS aveuglément — il interroge `GET /{container}?fields=status_code` ») **n'a pas d'équivalent ici.** Après un crash, on ne peut **pas** savoir si l'appel a été facturé.

## Fichiers autorisés
- `apps/worker/src/skills/anthropic-client.ts` (création)
- `apps/worker/src/skills/llm.ts` (création)
- `apps/worker/src/skills/executor.ts` (création)
- `apps/worker/src/skills/cost.ts` (création)
- `apps/worker/src/skills/steps.ts` (modification : remplacer le step factice)
- `apps/worker/src/observability/sentry.ts` (création ou modification : scrubbing)
- `apps/worker/package.json` (modification : `@anthropic-ai/sdk`)
- `pnpm-lock.yaml`

## Fichiers interdits
- `apps/web/**`, `packages/**`, `supabase/**`.
- **`@anthropic-ai/sdk` dans `apps/web` ou `packages/shared`.** Worker uniquement.
- Tout usage de `client.beta.agents` / `client.beta.sessions` (**Managed Agents**).

## Étapes attendues

### 1. Installer le SDK — worker uniquement
```powershell
pnpm add @anthropic-ai/sdk -F worker
```

### 2. `anthropic-client.ts` — la clé et `maxRetries: 0`
```ts
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

const env = z.object({
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-", "cle Anthropic invalide"),
}).parse(process.env)   // fail fast au boot, pas au premier run

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  maxRetries: 0,      // ← LA LIGNE LA PLUS IMPORTANTE DU FICHIER
  timeout: 600_000,   // 10 min ; on stream
})
```

> **`maxRetries: 0` est non négociable.** Le SDK retente les 429/5xx **deux fois** par défaut. Ces retries sont invisibles de `skill_run_steps.attempts` → double comptabilité. **Une seule source de vérité pour le retry : Postgres.**

### 3. `llm.ts` — l'appel
```ts
export interface LlmCallResult {
  messageId: string
  model: string
  text: string
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  stopReason: string | null
}

export async function callAgent(params: {
  system: string          // le SKILL.md, stable, cacheable
  userContent: string     // brief + context_snapshot + outputs amont — VOLATILE
  idempotencyKey: string
  effort: "high" | "xhigh"
  maxTokens: number
  outputSchema: Record<string, unknown>
}): Promise<LlmCallResult>
```

```ts
const stream = anthropic.messages.stream({
  model: "claude-opus-4-8",
  max_tokens: params.maxTokens,
  thinking: { type: "adaptive" },                    // explicite : sinon PAS de thinking
  output_config: {
    effort: params.effort,
    format: { type: "json_schema", schema: params.outputSchema },
  },
  system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
  metadata: { user_id: params.idempotencyKey },      // forensics de facturation, pas dédup
  messages: [{ role: "user", content: params.userContent }],
})
const msg = await stream.finalMessage()
if (msg.stop_reason === "refusal") throw new PermanentLlmError("refusal", msg.stop_details)
```

⚠️ **Ne jamais mettre `now()`, le `run_id` ou un compteur dans `system`** — le préfixe de cache est invalidé à chaque requête. Tout le volatile va dans `userContent`.

### 4. `executor.ts` — l'idempotence, à la lettre

```
pour chaque step, par step_index croissant :

  status = 'succeeded' → SKIP (déjà payé, déjà en base)
  status = 'skipped'   → SKIP
  status = 'failed'    → le run est failed. STOP.

  si llm_call_started_at IS NOT NULL :
    ├─ llm_message_id IS NOT NULL → la réponse a été persistée avant le crash.
    │      → marquer 'succeeded', continuer au step suivant.
    │
    └─ llm_message_id IS NULL     → l'appel est PARTI, la réponse n'est jamais revenue.
           ⚠ CET APPEL EST FACTURÉ ET PERDU. Irrécupérable : pas de GET /messages/{id}.
           → attempts += 1
           → journaliser { class: 'llm_call_orphaned', step_index, at: now() }
             dans skill_runs.error_history
           → si attempts >= 3 : step 'failed', run 'failed', notification owner
           → sinon : llm_call_started_at = NULL,
                     NOUVELLE llm_idempotency_key = sha256(runId:stepIndex:attempts),
                     retry

  sinon (premier passage) :
    1. UPDATE skill_run_steps SET status='running',
              llm_call_started_at = now(),
              llm_idempotency_key = sha256(runId:stepIndex:attempts)
       -- ⚠️ COMMIT ICI. L'appel HTTP est HORS TRANSACTION (règle 18).
    2. await callAgent(...)                              -- hors transaction
    3. UPDATE skill_run_steps SET status='succeeded',
              llm_message_id, llm_model, output,
              input_tokens, output_tokens,
              cache_creation_input_tokens, cache_read_input_tokens,
              cost_micros, finished_at = now()
       -- COMMIT
    4. renewLease()
```

**Politique de retry tranchée par Étienne : borné à 3, tracé. PAS de fail-closed.**
Un redeploy Coolify au mauvais moment ne doit pas exiger une intervention humaine. Pire cas : ~1,20 $ de perte sur un run à ~1,75 $.

> ⚠️ **Écart assumé à la règle 15.** Ce retry diffère *intentionnellement* du worker de publication. La règle 15 protège d'une **double publication chez un client** (catastrophe produit) et peut vérifier l'état distant. Ici il n'y a **rien à vérifier**, et le pire cas est un appel payé deux fois (~0,40 $). L'arbitrage coût/disponibilité s'inverse. **Écrire ce commentaire dans le code**, sinon un futur agent « corrigera » ce retry.

**Classification des erreurs :**
- Permanentes → `failed` **direct**, aucun retry : `400`, `401`, `403`, `413`, `stop_reason === "refusal"`.
- Transitoires → retry (backoff en SQL, `max_attempts = 3` sur le step) : `429`, `500`, `529`, `APIConnectionError`.
- Un `429` avec header `retry-after` → `run_at = now() + retry-after`. Ne pas doubler la peine.

### 5. Le step 0 — orchestration
`campaign_manager` produit le `task_manifest` (structured output, `taskManifestSchema` du ticket 04). Dans la **même transaction** que son passage à `succeeded` :
- `UPDATE skill_runs SET task_manifest = $1`
- `INSERT INTO skill_run_steps (…) status='pending', step_index = 1..N` pour chaque tâche

Les steps 1..N reçoivent, dans `userContent`, le brief + les `output` de leurs `dependsOn`.
Exécution **séquentielle** au Lot 5. Le champ `dependsOn` rend la parallélisation possible plus tard, sans migration.

### 6. `cost.ts` — la comptabilité
Utiliser `MODEL_PRICING` de `@ocean/skills/pricing`.

> ⚠️ **Piège** : `usage.input_tokens` est le **reliquat non-caché** seulement.
> Total entrée = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.
> Cache read ≈ 0,1× · cache write ≈ 1,25×.

`cost_micros` en **`bigint` de micro-dollars**, jamais en float. Agrégat sur `skill_runs.total_cost_micros` **recalculé par le worker en fin de run**, pas par un trigger.

### 7. `observability/sentry.ts` — scrubbing
Deux vecteurs de fuite : la **clé** (header `x-api-key`) et le **contenu des prompts** (le brief du client = donnée RGPD).

```ts
beforeSend(event) {
  for (const k of Object.keys(event.request?.headers ?? {})) {
    if (/^(x-api-key|authorization|anthropic-api-key)$/i.test(k)) {
      event.request.headers[k] = "[redacted]"
    }
  }
  if (event.request) event.request.data = undefined      // jamais de brief chez Sentry
  const scrub = (s: string) => s.replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted]")
  if (event.message) event.message = scrub(event.message)
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrub(ex.value)
  return event
}
```
`sendDefaultPii: false`. **Ne pas s'appuyer sur `sendDefaultPii` seul** (déprécié) — scruber activement.

Deux règles côté code, plus fiables que tout scrubbing :
- l'objet `Anthropic` n'est **jamais** passé à `Sentry.setExtra` / `captureContext` (il porte `apiKey` en propriété) ;
- on ne logue jamais `error.request` d'une `APIError` ; on logue `error.status`, `error.type`, `error.request_id`.

`skill_run_steps.last_error` suit la même discipline : `{ class, status, requestId }`, **jamais le prompt**.

## Critères d'acceptation
- [ ] `@anthropic-ai/sdk` figure dans `apps/worker/package.json` **et nulle part ailleurs**.
- [ ] `maxRetries: 0` sur le client Anthropic.
- [ ] `ANTHROPIC_API_KEY` validée par Zod **au boot** (fail fast), lue depuis `process.env` uniquement.
- [ ] `thinking: { type: "adaptive" }` est explicite. Aucun `temperature`, `top_p`, `top_k`, `budget_tokens`.
- [ ] `client.messages.stream()` (jamais `.create()` avec `max_tokens` 32 000).
- [ ] `output_config.format` avec le JSON Schema. Aucun prefill d'assistant.
- [ ] `system` = le `SKILL.md` avec `cache_control: { type: "ephemeral" }`. **Aucune interpolation volatile dans `system`.**
- [ ] `llm_call_started_at` est **commité avant** l'appel HTTP. L'appel est **hors transaction**.
- [ ] Un step avec `llm_call_started_at` posé et `llm_message_id` nul → `llm_call_orphaned` journalisé, retry borné à 3, **nouvelle** clé d'idempotence.
- [ ] Le commentaire d'écart à la règle 15 figure dans `executor.ts`.
- [ ] `stop_reason === "refusal"` → `failed` direct, aucun retry.
- [ ] `cost_micros` en `bigint`. Le total d'entrée somme **les trois** champs d'entrée.
- [ ] Sentry : headers redactés, `event.request.data = undefined`, `sk-ant-` scrubé.
- [ ] Aucun usage de `client.beta.agents` / `client.beta.sessions`.
- [ ] Aucun fichier > 250 lignes. Zéro `any`. `pnpm check` passe.

### Les deux tests qui comptent
- [ ] **`kill -9` entre `llm_call_started_at` et la réponse** → au redémarrage, le step est détecté orphelin, `llm_call_orphaned` est dans `error_history`, et **aucun `POST /v1/messages` n'est rejoué pour ce step avant l'incrément d'`attempts`**.
- [ ] **`usage.cache_read_input_tokens > 0` au 2ᵉ run** → le préfixe `system` est bien caché. S'il reste à zéro : soit le `SKILL.md` fait moins de 4096 tokens (attendu, à documenter), soit une valeur volatile s'est glissée dans `system` (bug — chercher un `Date.now()`).

## Commandes de validation
```powershell
# Le SDK est confine au worker
Select-String -Path 'apps\worker\package.json' -Pattern 'anthropic'
rg "@anthropic-ai/sdk" apps\web packages                # attendu : aucun match

# maxRetries: 0
rg "maxRetries: 0" apps\worker\src\skills\anthropic-client.ts

# La cle ne fuit pas
rg "ANTHROPIC_API_KEY" apps\web packages                # attendu : aucun match
rg "NEXT_PUBLIC_ANTHROPIC" .                            # attendu : aucun match

# Parametres interdits sur Opus 4.8
rg "temperature|top_p|top_k|budget_tokens" apps\worker\src\skills   # attendu : aucun match

# thinking explicite + streaming + structured outputs
rg 'thinking: \{ type: "adaptive" \}' apps\worker\src\skills
rg "messages.stream\(" apps\worker\src\skills
rg "output_config" apps\worker\src\skills
rg "output_format" apps\worker\src\skills               # attendu : aucun match (deprecie)

# Managed Agents interdits
rg "beta.agents|beta.sessions" apps\worker\src          # attendu : aucun match

# L'ordre commit -> appel HTTP -> commit
rg -A3 "llm_call_started_at = now\(\)" apps\worker\src\skills\executor.ts

# L'ecart a la regle 15 est documente dans le code
rg -i "regle 15|rule 15|ecart assume" apps\worker\src\skills\executor.ts

# Le cout est en bigint, le total d'entree somme les 3 champs
rg "cache_creation_input_tokens|cache_read_input_tokens" apps\worker\src\skills\cost.ts
rg "parseFloat|Number\(" apps\worker\src\skills\cost.ts # attendu : aucun match (pas de float pour de l'argent)

# Sentry scrubbing
rg "sk-ant-|redacted|request.data = undefined" apps\worker\src\observability\sentry.ts

pnpm check

# LE TEST 1 : crash entre llm_call_started_at et la reponse
pnpm --filter worker dev
# ... declencher un run, puis PENDANT un appel LLM :
Stop-Process -Name node -Force
pnpm --filter worker dev
# Attendu en base :
#   select step_index, status, llm_call_started_at, llm_message_id, attempts
#     from public.skill_run_steps order by step_index;
#   -> le step interrompu : llm_call_started_at non nul, llm_message_id NUL
#   select error_history from public.skill_runs;   -> contient 'llm_call_orphaned'
# Attendu dans les logs : AUCUN POST /v1/messages rejoue pour ce step avant attempts++

# LE TEST 2 : le prompt caching fonctionne
# Lancer deux runs successifs, verifier au 2e :
#   select cache_read_input_tokens from public.skill_run_steps where step_index = 1;
#   -> doit etre > 0 (sinon : SKILL.md < 4096 tokens, ou valeur volatile dans system)
```

## Risques / points d'attention
- **`maxRetries: 0` est la ligne la plus importante du lot.** Sans elle, le SDK retente les 429/5xx deux fois, invisiblement. Un step peut être facturé 3× sans que `attempts` bouge. Une seule source de vérité pour le retry : Postgres.
- **On ne peut PAS vérifier l'état distant d'un appel LLM.** Ce n'est pas un oubli, c'est une propriété de l'API. Ne pas envoyer un header `Idempotency-Key` en espérant qu'il soit honoré : il sera **ignoré silencieusement** — le pire des mondes.
- **Le commentaire d'écart à la règle 15 doit être dans le code**, pas seulement dans la doc. Un futur agent lira `executor.ts`, verra un retry là où `CLAUDE.md` dit « ne retry JAMAIS », et le « corrigera ». Le pire cas serait alors un run bloqué à chaque redeploy.
- **Le prompt caching échoue en silence.** Minimum cacheable Opus 4.8 = 4096 tokens. Un `SKILL.md` court ne cachera pas, sans erreur ni warning : `cache_creation_input_tokens: 0`. Vérifier `cache_read_input_tokens` au 2ᵉ run — c'est le seul signal.
- **`input_tokens` est un piège de facturation.** C'est le reliquat *non-caché*. Un calcul de coût qui l'utilise seul sous-estime massivement le total quand le cache fonctionne.
- **Managed Agents (`client.beta.agents`) est le piège le plus probable pour un futur contributeur** : le SDK propose littéralement cette API pour orchestrer 5 agents. Mais l'état du run vivrait chez Anthropic, et le reaper Ocean ne pourrait pas le reprendre. **Même motif que le rejet de Redis** (décision #17). Ocean orchestre, Anthropic infère.
- **Le brief du client est de la donnée RGPD.** Un événement Sentry embarquant `event.request.data` l'exfiltre. `skill_run_steps.last_error` ne doit jamais contenir le prompt.
- **Ne pas lancer de run réel sans l'autorisation et le plafond.** Un bug de boucle dans `executor.ts` peut enchaîner les appels.

## Résultat attendu
Un exécuteur LLM qui ne repaie jamais un step réussi, détecte et trace les appels orphelins, borne le retry à 3, et n'expose ni la clé ni les prompts.

## Message de commit suggéré
```
feat(lot-5): worker — executeur LLM + idempotence de facturation

@anthropic-ai/sdk confine a apps/worker. maxRetries: 0 (une seule source de
verite pour le retry : Postgres). llm_call_started_at commite AVANT l'appel HTTP,
hors transaction. Step orphelin (started_at pose, message_id nul) : jamais rejoue
en aveugle, journalise 'llm_call_orphaned', retry borne a 3 avec nouvelle cle.
Ecart assume a la regle 15 documente dans executor.ts : /v1/messages n'a ni
idempotency key ni endpoint de relecture, il n'y a rien a verifier.
Opus 4.8 : thinking adaptive explicite, streaming, structured outputs, prompt
caching sur le system. Scrubbing Sentry (cle + prompts).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. 🛑 `LOT5-12` démarre seulement après validation d'Étienne sur le run de test et son coût constaté.
