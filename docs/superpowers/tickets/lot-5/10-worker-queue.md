# Ticket LOT5-10 — Worker : file `skill_runs` (claim / lease / reaper) — **SANS LLM**

## Ticket ID
`LOT5-10`

## Objectif
Implémenter la **file** `skill_runs` dans `apps/worker` : claim atomique `FOR UPDATE SKIP LOCKED`, lease de 10 minutes, heartbeat, reaper avec backoff. **Zéro appel réseau, zéro SDK Anthropic.** Un step factice remplace l'appel LLM. On prouve la mécanique de reprise **avant** de dépenser un dollar.

## Pré-requis
- `LOT5-09` committé : les tables existent en base locale, tous les tests pgTAP sont verts.
- `apps/worker` existe et tourne (prérequis P5, vérifié au ticket 01).

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **D-1** et **Task 10**.
- Patron du claim : `CLAUDE.md` §5 (« Claim atomique — cœur de la file »), tel qu'implémenté pour `publish_jobs` au Lot 2.
- **Règle 17** : connexion worker = Supavisor mode **SESSION port 5432**. Jamais le pooler transaction 6543 (casse les advisory locks). Horloge = `now()` Postgres, jamais l'horloge du process.
- **Règle 18** : appels HTTP **hors transaction**. Backoff exponentiel + jitter.
- **Règle 24** : fichier ≤ 250 lignes. Découper.
- Style Biome : double quotes, `semicolons: "asNeeded"`, indent 2, `lineWidth: 100`, zéro `any`.

**Pourquoi ce ticket n'appelle pas le LLM.**
Un run coûte ~1,75 $. La mécanique de reprise (claim, lease, reaper, `attempts`) doit être **prouvée sur du gratuit** avant qu'un seul appel soit facturé. Si le reaper requeue mal, on ne veut pas le découvrir avec la facture.

## Fichiers autorisés (création uniquement, sauf mention)
- `apps/worker/src/skills/queue.ts` — claim, heartbeat, transitions
- `apps/worker/src/skills/reaper.ts` — reprise des leases expirés
- `apps/worker/src/skills/steps.ts` — matérialisation et itération des steps
- `apps/worker/src/skills/tick.ts` — la boucle
- `apps/worker/src/index.ts` (modification : brancher le tick skills sur la boucle existante)
- `apps/worker/package.json` (modification : dépendances `@ocean/shared`, `@ocean/skills`)

## Fichiers interdits
- **`@anthropic-ai/sdk`** — c'est le ticket 11. Ne pas l'installer.
- `apps/web/**`, `packages/**`, `supabase/**`.
- Toute clé API, tout secret, tout `.env` réel.

## Étapes attendues

### 1. Brancher les packages
`apps/worker/package.json` : `"@ocean/shared": "workspace:*"`, `"@ocean/skills": "workspace:*"`.
Appeler `assertCatalogIntegrity()` (ticket 05) **au démarrage**. Une erreur = le worker ne démarre pas.

> ⚠️ **Dockerfile.** Le `Dockerfile` racine ne copie que `apps/web/package.json`. Le Dockerfile du worker devra copier `packages/skills/package.json` **et** `packages/shared/package.json`, plus **les `.md` du catalogue** dans l'image finale — aucun bundler ne trace un markdown. Le signaler s'il n'est pas conforme.

### 2. `queue.ts` — claim atomique
```sql
update public.skill_runs
set status = 'running',
    claimed_at = now(),
    lease_expires_at = now() + interval '10 minutes',
    worker_id = $1,
    attempts = attempts + 1,
    started_at = coalesce(started_at, now())
where id = (
  select id from public.skill_runs
  where status = 'queued' and run_at <= now() and attempts < max_attempts
  order by run_at, created_at
  for update skip locked
  limit 1
)
returning id, org_id, client_id, skill_slug, skill_version, input, context_snapshot, attempts;
```
Lease **10 minutes** (et non 2 min comme `publish_jobs`) : un step LLM à `effort: xhigh` peut légitimement durer 5 minutes.

Signature :
```ts
export interface ClaimedSkillRun {
  id: string
  orgId: string
  clientId: string
  skillSlug: string
  skillVersion: number
  input: Record<string, unknown>
  contextSnapshot: Record<string, unknown>
  attempts: number
}
export async function claimSkillRun(pool: Pool, workerId: string): Promise<ClaimedSkillRun | null>
```

### 3. `queue.ts` — heartbeat
```ts
export async function renewLease(pool: Pool, runId: string, workerId: string): Promise<boolean>
```
`update … set lease_expires_at = now() + interval '10 minutes' where id = $1 and worker_id = $2`.
Appelé toutes les **60 s** pendant l'exécution d'un step, et à chaque transition de step. Retourne `false` si le run a été volé par le reaper — dans ce cas, le worker **abandonne immédiatement** (un autre worker l'a repris).

### 4. `reaper.ts` — reprise des leases expirés, backoff en SQL
```sql
update public.skill_runs
set status = case when attempts >= max_attempts then 'failed'::public.skill_run_status
                  else 'queued'::public.skill_run_status end,
    claimed_at = null,
    lease_expires_at = null,
    worker_id = null,
    run_at = now() + (interval '1 second' * least(300, power(2, attempts) * 15))
                   + (interval '1 second' * floor(random() * 20)),
    last_error = case when attempts >= max_attempts
                      then jsonb_build_object('class','lease_expired','at',now())
                      else last_error end,
    error_history = error_history || jsonb_build_object('class','lease_expired','at',now())
where status = 'running' and lease_expires_at < now()
returning id, status;
```
Backoff exponentiel + jitter, **calculé en SQL** (horloge Postgres, règle 17).

### 5. `steps.ts` — itération, sans appel réseau
- Lire les steps du run par `step_index` croissant.
- `status = 'succeeded'` ou `'skipped'` → **skip**, ne jamais rejouer.
- `status = 'failed'` → le run est `failed`. STOP.
- Sinon → exécuter (ici : le **step factice**).

**Step factice** (ce ticket uniquement) :
```
UPDATE skill_run_steps SET status='running', llm_call_started_at=now(),
       llm_idempotency_key = <sha256(runId:stepIndex:attempts)>     -- COMMIT
-- (pas d'appel réseau)
UPDATE skill_run_steps SET status='succeeded', llm_message_id='fake',
       output='{}'::jsonb, finished_at=now()                        -- COMMIT
```
La structure des deux commits est **exactement** celle que le ticket 11 réutilisera. Seul l'appel HTTP entre les deux est absent. C'est volontaire : le ticket 11 n'aura qu'à l'insérer.

**Commit après chaque step**, puis `renewLease()`.

### 6. `tick.ts` — la boucle
Greffer sur le tick existant (5 s) du worker : `reaper()` puis `claimSkillRun()`. Ne pas créer une seconde boucle.

Un run sans step (premier passage) : matérialiser un step 0 factice `campaign_manager`, puis passer le run à `completed`.

## Critères d'acceptation
- [ ] `apps/worker` dépend de `@ocean/shared` et `@ocean/skills` (`workspace:*`).
- [ ] `assertCatalogIntegrity()` est appelée au démarrage ; une erreur empêche le boot.
- [ ] Le claim utilise `for update skip locked`, `limit 1`, `order by run_at, created_at`, et filtre `attempts < max_attempts`.
- [ ] Le lease est de **10 minutes**, renouvelé toutes les 60 s.
- [ ] `renewLease()` retourne `false` si le run a changé de `worker_id` → le worker abandonne.
- [ ] Le reaper calcule le backoff **en SQL** (`power(2, attempts) * 15`, plafonné à 300 s, + jitter).
- [ ] Un step `succeeded` ou `skipped` n'est **jamais** rejoué.
- [ ] Le step factice pose `llm_call_started_at` **puis commit** avant la « fin » de l'appel — la structure à deux commits est en place.
- [ ] **`@anthropic-ai/sdk` n'est PAS installé.** Aucun appel réseau.
- [ ] `rg "6543" apps/worker` → aucun match.
- [ ] Aucun fichier > 250 lignes. Zéro `any`. `pnpm check` passe.

### Le test qui compte
- [ ] **`kill -9` du worker entre le claim et la fin du run** → au redémarrage, le reaper requeue le run, `attempts` est incrémenté, **aucun step n'est dupliqué**, et le step déjà `succeeded` n'est pas rejoué.

## Commandes de validation
```powershell
# Le SDK n'est pas la
Select-String -Path 'apps\worker\package.json' -Pattern 'anthropic'    # attendu : aucun match
rg "anthropic" apps\worker\src                                          # attendu : aucun match

# Aucun appel reseau
rg "fetch\(|https://|axios" apps\worker\src\skills                      # attendu : aucun match

# Le pooler transaction n'apparait nulle part
rg "6543" apps\worker                                                   # attendu : aucun match

# Le claim est atomique
rg -i "for update skip locked" apps\worker\src\skills\queue.ts

# Le lease est de 10 minutes
rg "interval '10 minutes'" apps\worker\src\skills

# Le backoff est en SQL, pas en JS
rg "power\(2, attempts\)" apps\worker\src\skills\reaper.ts
rg "Math.pow|\*\* attempts" apps\worker\src\skills                      # attendu : aucun match

# Regle 24 + zero any
Get-ChildItem -Recurse -Path 'apps\worker\src\skills' -Include *.ts | ForEach-Object { $n=(Get-Content $_ | Measure-Object -Line).Lines; if ($n -gt 250) { "$($_.Name): $n lignes" } }
rg ": any|as any" apps\worker\src\skills                                # attendu : aucun match

pnpm check

# LE TEST : crash entre claim et fin
pnpm --filter worker dev
# ... enfiler un run (INSERT manuel en base locale), attendre le claim, puis :
Stop-Process -Name node -Force
pnpm --filter worker dev
# Attendu : le reaper requeue, attempts = 2, aucun step duplique.
# Verifier en base :
#   select id, status, attempts, worker_id from public.skill_runs;
#   select skill_run_id, step_index, status, count(*) from public.skill_run_steps group by 1,2,3;
```

## Risques / points d'attention
- **Ne pas installer le SDK Anthropic ici.** La tentation est réelle (« autant tout faire d'un coup »). Mais si le reaper requeue mal ou si le claim n'est pas atomique, on le découvrira avec une facture, pas avec un test. Le step factice a **exactement** la structure du vrai step : le ticket 11 n'aura qu'à insérer l'appel HTTP entre les deux commits.
- **Le lease de 10 min n'est pas une coquille.** `publish_jobs` utilise 2 min parce qu'un `POST /media_publish` est rapide. Un step LLM à `effort: xhigh` peut durer 5 minutes. Un lease trop court fait voler le run par le reaper **pendant** un appel payé.
- **`renewLease()` doit vérifier `worker_id`.** Sinon deux workers exécutent le même run en parallèle et paient deux fois. Le `and worker_id = $2` est la garde.
- **Le backoff en SQL, pas en JS.** Règle 17 : horloge = `now()` Postgres. Un backoff calculé sur `Date.now()` dérive entre workers et casse la reproductibilité.
- **Un step `succeeded` ne se rejoue jamais.** C'est l'invariant qui, au ticket 11, évitera de repayer les steps 0–2 quand le crash survient au step 3.
- **Ne pas créer une seconde boucle.** Le worker a déjà son tick 5 s pour `publish_jobs`. Greffer `reaper()` + `claimSkillRun()` dessus. Deux boucles = deux horloges = deux sources de vérité.
- **Dockerfile** : vérifier que le worker copie `packages/skills` **et ses `.md`**. Un `SKILL.md` absent de l'image, c'est un run qui échoue en production après avoir démarré.

## Résultat attendu
Une file `skill_runs` opérationnelle et prouvée : claim atomique, lease renouvelé, reaper avec backoff, reprise après `kill -9` sans duplication. **Aucun dollar dépensé.**

## Message de commit suggéré
```
feat(lot-5): worker — file skill_runs (claim / lease / reaper), sans LLM

Claim atomique FOR UPDATE SKIP LOCKED, lease 10 min (un step xhigh dure 5 min),
heartbeat 60 s avec garde worker_id, reaper + backoff exponentiel calcule en SQL.
Step factice a deux commits : la structure exacte du vrai step, sans l'appel HTTP.
assertCatalogIntegrity() en fail-fast au boot. Aucun SDK Anthropic, aucun appel
reseau. Reprise apres kill -9 verifiee : requeue, attempts++, zero duplication.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-11` démarre seulement une fois ce commit fait **et** le test `kill -9` prouvé.
