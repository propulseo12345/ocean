# Lot 5 — Moteur de Skills IA · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter Ocean d'un moteur de skills IA multi-agents (« AI Marketing Team » : Campaign Manager orchestrateur + Research, Data Analysis, Content Strategy, Creative Copy) qui produit des `content_items` en `draft`, traçables, approuvables via le portail existant — sans introduire de seconde source de vérité pour l'état des jobs.

**Architecture:** Une file Postgres `skill_runs` (claim atomique `FOR UPDATE SKIP LOCKED` + lease + reaper) servie par `apps/worker`, la même app qui exécute `publish_jobs`. Le catalogue de skills vit sur disque (`packages/skills/`, versionné par git), la table `skills` en est un miroir seedé par migration. Un step = un `POST /v1/messages` sans état, contexte reconstruit depuis Postgres. **Ocean orchestre, Anthropic infère.**

**Tech Stack:** Supabase Postgres + RLS, pgTAP, `@anthropic-ai/sdk` (worker uniquement), TypeScript strict, pnpm workspaces, Biome, Next.js 16 App Router.

---

## Global Constraints

- **Placement** : Lot 5 s'exécute **après le Lot 3**. Le Lot 4 (agenda) est orthogonal. La gate d'entrée (`LOT5-01`) vérifie 7 prérequis durs et bloque si un seul manque.
- **Postiz : abandonné.** Aucun connecteur. Décision actée #17 (« Redis = seconde source de vérité de l'état des jobs — le scénario classique de double publication ») + PRD §5.E (« toute la programmation passe par notre worker, uniformément »).
- **Managed Agents / `client.beta.agents` + `sessions` : interdits.** L'état du run vivrait chez Anthropic, le reaper Ocean ne pourrait pas le reprendre. Même motif que le rejet de Redis. À ajouter aux anti-patterns `CLAUDE.md` §8.
- **Edge Functions interdites pour tout travail long** (2 s CPU / 400 s wall / 256 MB). Un run dure 3 à 12 min.
- **Server Action longue / Route Handler + `after()` : rejetés.** Pas de reprise après crash, idempotence inatteignable. Pattern fire-and-forget déjà rejeté au PRD §7.
- Toute table métier porte `org_id uuid not null` dénormalisé ; toute fille de Client porte aussi `client_id`. **Exception unique et documentée : `skills` (référentiel système).**
- RLS activée sur 100 % des tables, **dans la migration qui les crée**.
- Policies via helpers `private.*` SECURITY DEFINER, wrappées `(select fn())`, `TO authenticated`. Jamais `for all`, jamais de jointure vers une autre table tenant.
- FK composites obligatoires. `skill_runs` porte `unique (id, client_id)` — clé structurante du pont vers `content_items`.
- Appels HTTP **hors transaction**. Horloge = `now()` Postgres. Supavisor **SESSION port 5432**, jamais 6543.
- Fichier ≤ 250 lignes. Zéro `any` (Biome `noExplicitAny: error`). Biome, pas ESLint.
- Style Biome : double quotes, `semicolons: "asNeeded"`, indent 2 espaces, `lineWidth: 100`.
- **Valider le SQL avec Étienne avant exécution.** Aucune migration ne tourne sans feu vert explicite.
- Le worktree dirty appartient à Étienne ; ne pas revert les changements non liés.

---

## Prérequis durs (vérifiés par `LOT5-01`)

| # | Prérequis | Conséquence si absent |
|---|---|---|
| P1 | Lot 0 exécuté (`lot-0-execution-report.md`) | Les FK de `skill_runs` n'ont pas de cible. |
| P2 | Dé-`L<string>` soldé | Le brouillon IA est illisible → jamais approuvé → **le Lot 5 ne produit rien d'observable**. |
| P3 | `zod` installé dans `packages/shared` | Le brief entre non validé ; le LLM peut écrire un `client_id` arbitraire. |
| P4 | `packages/shared/src/schemas/index.ts` ≠ `export {}` | Worker et web dupliquent les types. |
| P5 | `apps/worker/` existe (Lot 2), claim `FOR UPDATE SKIP LOCKED`, port 5432 | **Le LLM n'a nulle part où s'exécuter.** |
| P6 | `brand_kits` + `content_pillars` (Lot 1) | `context_snapshot` vide → le Creative Copy invente le ton et ignore `bannedWords`. |
| P7 | `approvals` + portail (Lot 3) | Aucun run ne quitte `waiting_approval`. |

---

## File Structure

- Create `docs/architecture/lot-5-entry-gate.md` : rapport de gate d'entrée (P1→P7).
- Create `docs/architecture/lot-5-db-dictionary.md` : contrat DB Lot 5, décisions ouvertes.
- Create `docs/architecture/lot-5-sql-review.md` : rapport de revue SQL.
- Create `docs/architecture/lot-5-execution-report.md` : journal d'exécution des migrations.
- Create `packages/skills/**` : catalogue disque (`skill.json`, 5 `SKILL.md`, loader, registry, pricing).
- Modify `packages/shared/src/{types/domain.ts, schemas/index.ts}` : enums DB + schémas Zod.
- Create `supabase/migrations/0NN_skill_*.sql` : enums, catalogue, file, storage, alter `content_items`.
- Create `supabase/tests/0NN_skill_*.test.sql` : leak tests pgTAP.
- Create `apps/worker/src/skills/**` : file, exécuteur LLM, pont contenu.
- Create `apps/web/lib/actions/skills.ts` + `app/(app)/clients/[clientId]/skills/page.tsx`.

**Numérotation des migrations** : lire le dernier numéro présent dans `supabase/migrations/` et continuer. **Ne jamais hardcoder** — les Lots 1–4 ne sont pas écrits et absorberont 008–019.

---

## Décisions d'architecture actées

### D-1 · Le LLM s'exécute dans le worker, via la file `skill_runs`

Seule option qui satisfait simultanément : source de vérité unique (Postgres), reprise après crash (lease + reaper), non-double-facturation (idempotence structurelle). Une Server Action **enfile** (`INSERT … 'queued'`, < 50 ms) ; le front suit par **Supabase Realtime**. Le worker devient la **seule** app qui parle à Anthropic — `apps/web` n'importe jamais le SDK.

### D-2 · Idempotence de facturation — écart assumé à la règle 15

**`/v1/messages` n'a AUCUNE idempotency key et aucun endpoint de relecture.** La règle 15 (`publish_started_at` → « ne retry JAMAIS aveuglément ») dispose d'un `GET /{container}?fields=status_code` pour vérifier l'état distant. **Cette ligne n'a pas d'équivalent LLM.**

`llm_call_started_at` est l'analogue de `publish_started_at`, posé et **commité avant** l'appel HTTP.

```
si llm_call_started_at IS NOT NULL :
  ├─ llm_message_id IS NOT NULL → réponse persistée. 'succeeded'. Continuer.
  └─ llm_message_id IS NULL     → l'appel est PARTI, la réponse n'est jamais revenue.
         ⚠ CET APPEL EST FACTURÉ ET PERDU. Irrécupérable.
         → attempts += 1 ; journaliser 'llm_call_orphaned' dans error_history
         → si attempts >= 3 : step 'failed', run 'failed', notification owner
         → sinon : llm_call_started_at = NULL, NOUVELLE clé d'idempotence, retry
```

**Politique tranchée par Étienne : retry borné à 3, tracé. PAS de fail-closed.** Un redeploy Coolify au mauvais moment ne doit pas exiger une intervention humaine. Pire cas : ~1,20 $ de perte sur un run à ~1,75 $.

> ⚠️ **Écart assumé, à écrire dans `CLAUDE.md` §5.** Ce retry diffère *intentionnellement* de la règle 15. La règle 15 protège d'une **double publication chez un client** (catastrophe produit) et peut vérifier l'état distant. Ici il n'y a rien à vérifier, et le pire cas est **un appel LLM payé deux fois** (~0,40 $). L'arbitrage coût/disponibilité s'inverse. Un futur agent ne doit pas « corriger » ce code.

Trois filets structurels :
- `unique (llm_idempotency_key)` → deux workers ne peuvent pas payer deux fois le même step.
- `check (status <> 'succeeded' or llm_message_id is not null)` → impossible d'écrire un step « réussi » sans preuve d'appel.
- `metadata.user_id = llm_idempotency_key` passé à l'API : n'active aucune dédup (elle n'existe pas), mais permet de réconcilier un appel orphelin dans la console de facturation. Forensics, pas prévention.

**`maxRetries: 0` sur le client SDK.** Le SDK retente 429/5xx deux fois par défaut, invisiblement de `attempts`. Une seule source de vérité pour le retry : Postgres.

**Lease de 10 minutes** (pas 2 min comme `publish_jobs`) : un step à `effort: xhigh` peut durer 5 min. Heartbeat toutes les 60 s pendant un appel.

Erreur permanente (`400`, `401`, `403`, `stop_reason: "refusal"`) → `failed` **direct**. Erreur transitoire (`429`, `500`, `529`, `APIConnectionError`) → retry, backoff exponentiel + jitter en SQL. `max_attempts = 5` sur le run, `3` sur le step.

**Alternative écartée :** la Batches API *a* une ressource durable (`batch.id` interrogeable, `custom_id`, résultats 29 j) et coûte **−50 %**. Mais latence jusqu'à 24 h, et elle casse l'orchestration séquentielle (le CM doit lire Research avant de briefer Content Strategy). À réexaminer si les agents deviennent parallélisables.

### D-3 · Catalogue disque `packages/skills/`, table `skills` seedée par migration

- Pas `apps/worker/src/skills/` : le web a besoin des métadonnées (formulaire de brief).
- Pas `/skills` racine : hors du champ `packages/*` de `pnpm-workspace.yaml`.
- Pas `packages/shared` : le loader importe `node:fs`, qui serait bundlé pour le navigateur.
- **Séparation dure** `./manifest` (isomorphe) / `./loader` (Node). Verrou CI : `rg "@ocean/skills/loader" apps/web` → aucun match.

**Sync disque ↔ table : seed par migration `insert … on conflict do nothing`.** Pas de script `db:seed-skills` : ce serait une seconde source de vérité mouvante, hors `supabase/migrations`, et un `supabase db reset` en CI produirait un catalogue vide. Précédent : `002_enums.sql`.

⚠️ **Le worker ne construit JAMAIS un chemin disque depuis `skills.manifest_path`** (path traversal). Il résout par `skill_runs.skill_slug`, contraint en base par `check (slug ~ '^[a-z0-9_]+$')`, via un registry statique + garde anti-échappement.

**Délégation : un step persisté par agent.** Pas de sous-appels imbriqués (un crash perdrait 3 appels payés sans trace). Pas de `task_manifest.json` sur disque (perdu au redeploy, invisible du web, **seconde source de vérité de l'état du run**). Le manifest vit en DB : `skill_runs.task_manifest jsonb`, produit par le step 0, lu par le worker pour matérialiser les steps 1..N. Le worker commit après chaque step : un crash au step 3/6 reprend au step 3, **on ne repaye pas les steps 0–2**.

**Prompt caching** : le `SKILL.md` (stable) va dans `system` avec `cache_control: {type:"ephemeral"}` ; le brief et le `context_snapshot` (volatiles) vont dans le tour `user`, **après** le breakpoint. Ne jamais interpoler `now()` ni `run_id` dans le `system`. Minimum cacheable Opus 4.8 = **4096 tokens** : un `SKILL.md` court ne cachera pas, silencieusement — vérifier `usage.cache_read_input_tokens > 0` au 2ᵉ run.

### D-4 · Clé Anthropic : variable d'env du worker, pas Vault

Le pattern `*_secrets` + Vault existe pour des tokens **par tenant, OAuth, rotatifs, révocables individuellement** (règles 11–14). La clé Anthropic n'a aucune de ces propriétés : elle appartient à Propul'SEO, il y en a **une pour l'instance**, pas de refresh, pas d'enjeu RGPD. La mettre en Vault serait du cargo cult : on paierait la complexité sans obtenir l'isolation multi-tenant, et on **créerait un chemin de fuite** (une variable d'env n'est atteignable par aucune requête SQL). Même raisonnement que `BREVO_API_KEY` (CLAUDE.md §10).

`ANTHROPIC_API_KEY` injectée par Coolify dans le conteneur **`worker` uniquement**. `skill_runs.total_cost_micros` existe dès le Lot 5 pour rendre la bascule BYOK indolore plus tard — rien de construit aujourd'hui ne sera à défaire.

---

## Faits API Claude à figer (source : skill `claude-api`, cache 2026-06-24)

- Modèle : **`claude-opus-4-8`** — 1M contexte, 128 K output max, **$5 / $25 par M tokens**.
- **`thinking: { type: "adaptive" }` explicite.** Omettre `thinking` = tourner **sans** thinking sur Opus 4.8.
- `budget_tokens`, `temperature`, `top_p`, `top_k` renvoient **400** sur Opus 4.8.
- Effort : `output_config: { effort: "low"|"medium"|"high"|"xhigh"|"max" }` (défaut `high`).
- **Streaming obligatoire** au-dessus de ~16 000 `max_tokens` (sinon timeout HTTP du SDK).
- **Structured outputs** : `output_config: { format: { type: "json_schema", schema } }` — pas l'ancien `output_format`. **Les prefills d'assistant renvoient 400.**
- **Aucune idempotency key.** Le SDK retente `maxRetries: 2` par défaut → mettre `0`.
- `stop_reason === "refusal"` → erreur permanente, pas de retry.

**Piège Docker** : le `Dockerfile` racine ne copie que `apps/web/package.json`. Le Dockerfile du worker devra copier `packages/skills/package.json` **et** `packages/shared/package.json`, plus les `.md` dans l'image finale (aucun bundler ne trace un markdown).

---

## Tâches

### Task 1: Gate d'entrée — vérifier les 7 prérequis durs 🛑

> Correspondance tickets : `docs/superpowers/tickets/lot-5/00-index.md` est l'index ; les tickets exécutables sont `01-entry-gate.md` … `13-web-start-and-track.md`. La Task N de ce plan correspond au ticket `LOT5-N`.

**Files:** Create `docs/architecture/lot-5-entry-gate.md`

**Steps:**
- [ ] Re-confirmer l'autorisation écrite d'Étienne d'ouvrir le Lot 5. Absente → STOP.
- [ ] Vérifier P1→P7 avec les commandes PowerShell du ticket `LOT5-01`.
- [ ] Écrire le rapport : pour chaque prérequis, ✅/❌, la commande lancée, la sortie brute.
- [ ] **Un seul ❌ = STOP.** Ne rien corriger dans ce ticket.

### Task 2: Figer le dictionnaire DB Lot 5 🛑

**Files:** Create `docs/architecture/lot-5-db-dictionary.md`

**Steps:**
- [ ] Décrire les 4 tables neuves + les 3 enums + l'`alter table content_items`.
- [ ] **Faire trancher par écrit** l'absence d'`org_id` sur `skills` (seule entorse à la règle 1), en documentant la path traversal que l'alternative ouvrirait.
- [ ] Faire acter le 3ᵉ bucket `skill-artifacts` (privé, rétention et MIME distincts des médias).
- [ ] Lister les décisions ouvertes. Ajouter le document à la table `CLAUDE.md` §13.

### Task 3: Scaffold `packages/skills`

**Files:** Create `packages/skills/{package.json, src/*, marketing_team_campaign/*}`

**Steps:**
- [ ] `package.json` : `@ocean/skills`, `"type": "module"`, exports par sous-chemin (convention `@ocean/shared`, pas de barrel racine).
- [ ] `src/manifest.ts` (types, isomorphe), `src/loader.ts` (Node, `node:fs`, garde anti-path-escape), `src/pricing.ts` (`MODEL_PRICING`, micro-dollars en `bigint`).
- [ ] `marketing_team_campaign/skill.json` + les 5 `SKILL.md` (≤ 250 lignes chacun).
- [ ] **Aucun placeholder `{{BRAND_KIT}}` dans le `system`** : le contexte va dans le tour `user`.
- [ ] Aucune dépendance réseau. `pnpm-workspace.yaml` couvre déjà `packages/*` — ne pas le modifier.

### Task 4: Schémas Zod partagés

**Files:** Modify `packages/shared/{package.json, src/schemas/index.ts, src/types/domain.ts}`

**Steps:**
- [ ] `pnpm add zod -F @ocean/shared`.
- [ ] `src/types/domain.ts` : ajouter `SkillAgent`, `SkillRunStatus`, `SkillStepStatus`, `SkillArtifactKind`.
- [ ] `src/schemas/index.ts` : `startSkillRunSchema`, `taskManifestSchema`, `copyAssetSchema`, `campaignReportSchema`, `contentCalendarSchema`. Parsing strict (`additionalProperties: false`).
- [ ] **Ne jamais exporter `L<T>`.** Les types Lot 5 sont des miroirs 1:1 des colonnes SQL (`title: string | null`).

### Task 5: Loader typé + registry + tests de parité

**Files:** Modify `packages/skills/src/{index.ts, loader.ts}`, Create `packages/skills/*.test.ts`

**Steps:**
- [ ] `SKILL_REGISTRY` statique. `resolveSkillDir(slug)` avec garde `if (!dir.startsWith(root + path.sep)) throw new Error("SKILL_PATH_ESCAPE")`.
- [ ] Test (a) : chaque slug du registry a un dossier existant.
- [ ] Test (b) : `skill.json.inputSchema` ≡ la constante `EXPECTED_SEEDED_SCHEMA` que Task 5 recopiera. Contrat de parité (même stratégie que le test `fr.ts`/`en.ts` du plan i18n).
- [ ] Validation au démarrage (fail fast) : chaque `markdown` existe, `orchestrator ∈ agents`, `slug` unique.

### Task 6: Migrations Lot 5 en brouillon (non exécutées)

**Files:** Create `supabase/migrations/0NN_skill_*.sql`

**Steps:**
- [ ] Lire le dernier numéro présent, continuer. Ne pas hardcoder.
- [ ] `0NN_skill_enums.sql` : `skill_run_status`, `skill_step_status`, `skill_artifact_kind` + `grant usage on type … to authenticated, service_role`.
- [ ] `0NN_skills_catalog.sql` : table `skills` (sans `org_id`, commentaire SQL obligatoire), RLS ON, `select … using (is_enabled)`, **zéro policy write**, seed `on conflict do nothing`.
- [ ] `0NN_skill_runs.sql` : `skill_runs` (+ `unique (id, client_id)`), `skill_run_steps`, `skill_artifacts`, index, triggers `set_updated_at`, RLS, **trigger de garde `private.skill_runs_guard_queue_columns()`**.
- [ ] `0NN_skill_storage.sql` : bucket privé `skill-artifacts`, policies `storage.foldername()`, aucune policy write pour `authenticated`.
- [ ] `0NN_skill_notification_types.sql` : **seule dans son fichier** (contrainte PG 15) — `alter type public.notification_type add value if not exists 'skill_run_completed'` (+ `_failed`).
- [ ] `0NN_content_items_skill_run.sql` : `add column skill_run_id uuid` **nullable** + FK composite `(skill_run_id, client_id) → skill_runs(id, client_id) on delete set null`.
- [ ] Aucune migration ne contient `6543`, `disable row level security`, ni `delete from storage.objects`.

### Task 7: Tests pgTAP Lot 5 en brouillon

**Files:** Create `supabase/tests/0NN_skill_runs.test.sql`, `0NN_content_items_skill_run.test.sql`

**Steps:**
- [ ] Reprendre le squelette de `006_content_core.test.sql` (`begin; plan(N); … reset role; select * from finish(); rollback;`).
- [ ] UUID conventionnels : `X0000000-0000-4000-8000-0000000000NN`, `NN` = numéro de migration.
- [ ] 9 assertions minimum :
  1. org B ne lit pas les `skill_runs` d'org A
  2. reviewer client 1 lit ses runs, pas ceux du client 2
  3. `authenticated` ne peut pas insérer de `skill_run_steps` (`42501`)
  4. owner tentant `update skill_runs set claimed_at = now()` → `42501` (**le trigger**)
  5. owner tentant `update skill_runs set status = 'completed'` → `42501`
  6. 2ᵉ run actif sur le même `(client_id, skill_id)` → `23505`
  7. `content_item` du client A → `skill_run` du client B → `23503`
  8. `skill_artifact` avec `content` ET `storage_path` → `23514`
  9. `authenticated` ne lit pas les artifacts d'un autre client
- [ ] ⚠️ Les tests 4 et 5 exigent `set local "request.jwt.claims" = '{"sub":"…","role":"authenticated"}'` — le trigger lit `role` depuis ce claim.

### Task 8: Relire le SQL avec checklist 🛑

**Files:** Create `docs/architecture/lot-5-sql-review.md`

**Steps:**
- [ ] Reprendre la checklist de `lot-0-sql-review.md`, + 5 items neufs :
  (a) `skills` sans `org_id`, justification citée ;
  (b) `skill_run_steps` sans policy write (précédent `notifications`) ;
  (c) **le trigger de garde est présent ET couvert par un test pgTAP** — il n'est pas une policy, `get_advisors` ne le verra pas ;
  (d) `check` du chemin Storage aligné sur `{org}/{client}/{run}/` ;
  (e) `content_items.skill_run_id` nullable + FK composite par `client_id`.
- [ ] STOP. Attendre la validation d'Étienne, ou renvoyer en Task 5.

### Task 9: Exécuter les migrations après feu vert 🛑

**Files:** Create `docs/architecture/lot-5-execution-report.md`

**Steps:**
- [ ] Re-confirmer l'autorisation explicite. Absente → STOP immédiat.
- [ ] **Base locale uniquement** : `supabase start`, `supabase db reset`. Jamais `db push`, jamais `link`.
- [ ] `supabase test db` → aucun `not ok`. **Prouver ligne par ligne que les tests `006` existants passent toujours** après l'`alter table content_items`.
- [ ] `get_advisors` (sécurité + perf) → 0 alerte critique.
- [ ] Un test rouge → STOP, consigner, remonter. Pas de correctif silencieux.

### Task 10: Worker — file `skill_runs`, SANS LLM

**Files:** Create `apps/worker/src/skills/{queue.ts, reaper.ts, tick.ts}`

**Steps:**
- [ ] Claim atomique (`update … where id = (select id … for update skip locked limit 1) returning *`), lease 10 min, `attempts + 1`.
- [ ] Reaper : `status = 'running' and lease_expires_at < now()` → `queued` si `attempts < max_attempts`, sinon `failed`. Backoff exponentiel + jitter **en SQL**.
- [ ] Heartbeat : renouveler `lease_expires_at` toutes les 60 s.
- [ ] **Zéro appel réseau, zéro `@anthropic-ai/sdk`.** Insérer un step factice `succeeded` avec `llm_message_id = 'fake'`.
- [ ] Test : `kill -9` entre le claim et la fin → le reaper requeue, `attempts` incrémenté, **aucun step dupliqué**.
- [ ] `rg "6543" apps/worker` → aucun match. Fichier ≤ 250 lignes (découper `claim.ts` / `steps.ts` / `dispatch.ts` / `cost.ts`).

### Task 11: Worker — exécuteur LLM + idempotence 🛑

**Files:** Create `apps/worker/src/skills/{anthropic-client.ts, llm.ts, executor.ts}`

**Steps:**
- [ ] `pnpm add @anthropic-ai/sdk -F worker` — **ici seulement**, jamais dans `apps/web` ni `packages/shared`.
- [ ] `new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 600_000 })`. Valider l'env par Zod au boot (fail fast).
- [ ] Implémenter D-2 à la lettre : `llm_call_started_at` **commité avant** l'appel HTTP, hors transaction.
- [ ] `client.messages.stream()` (streaming obligatoire), `thinking: {type:"adaptive"}` explicite, `output_config: {effort, format}`. Aucun `temperature`/`top_p`/`budget_tokens`.
- [ ] `system` = le `SKILL.md` avec `cache_control: {type:"ephemeral"}`. Le brief va dans `messages`.
- [ ] `stop_reason === "refusal"` → `failed` direct, pas de retry.
- [ ] Comptabilité : les **4** champs `usage` (`input_tokens` est le reliquat *non-caché* seulement — total entrée = somme des trois champs d'entrée). `cost_micros` en `bigint`, jamais en float.
- [ ] Scrubbing Sentry : `beforeSend` redacte `x-api-key`/`authorization`, met `event.request.data = undefined`, scrube `/sk-ant-[A-Za-z0-9_-]+/g`. Ne jamais passer l'objet `Anthropic` à `Sentry.setExtra`.
- [ ] **DoD : `kill -9` entre `llm_call_started_at` et la réponse → le step est marqué orphelin, `llm_call_orphaned` journalisé, AUCUN second appel facturé sur ce step.**
- [ ] Vérifier `usage.cache_read_input_tokens > 0` au 2ᵉ run (sinon un `Date.now()` traîne dans le `system`).
- [ ] 🛑 Gate : Étienne autorise la première dépense réelle et fixe un plafond de test.

### Task 12: Worker — pont artifacts → `content_items`

**Files:** Create `apps/worker/src/skills/bridge.ts`

**Steps:**
- [ ] Pour chaque `copy_asset`, **dans la même transaction** : `INSERT skill_artifacts` + `INSERT content_items (status='draft', skill_run_id, created_by = skill_runs.created_by)` + `UPDATE skill_artifacts SET materialized_content_item_id`.
- [ ] **`org_id`/`client_id` injectés depuis `skill_runs`, jamais depuis le JSON du LLM.** La FK composite fait échouer (`23503`) tout mismatch, même si le modèle hallucine un `client_id`.
- [ ] Artifacts longs → bucket `skill-artifacts` via l'**API Storage**. Jamais de `DELETE` SQL sur `storage.objects` (règle 23).
- [ ] `UPDATE skill_runs SET status = 'waiting_approval'` + `INSERT notifications (type = 'skill_run_completed')`.
- [ ] `waiting_approval → completed` par **lecture paresseuse au tick suivant** (pas un trigger sur `content_items`, qui coupleraient Lot 3 et Lot 5 sur la table la plus chaude du produit).
- [ ] Watchdog `pg_cron` : run en retard > 15 min → Edge Function → email Brevo.

### Task 13: Web — Server Action + suivi Realtime 🛑

**Files:** Create `apps/web/lib/actions/skills.ts`, `apps/web/app/(app)/clients/[clientId]/skills/page.tsx`

**Steps:**
- [ ] **Première Server Action du repo** (`grep 'use server'` = 0 aujourd'hui) : elle devient le gabarit de référence.
- [ ] `getActiveOrg()` en 1re ligne → `null` = `UNAUTHORIZED`. Rôle `owner`/`admin` → sinon `FORBIDDEN`. `zod.parse` strict. **Injecter `org_id: ctx.org.id`**, jamais depuis `input`. `revalidateTag`.
- [ ] Construire `context_snapshot` (`brandKit`, `contentPillars`) **avec les policies RLS de l'utilisateur**, pas en service_role. Defense in depth.
- [ ] Le `unique index skill_runs_active_per_client_skill_idx` renvoie `23505` sur double-clic → mapper vers `RUN_ALREADY_ACTIVE`. Économise ~1,75 $ à chaque fois.
- [ ] Ne rien attendre : le run est `queued`. Suivi par **Supabase Realtime sur `skill_runs`** (pas `skill_run_steps` : prompts volumineux + donnée client sur le fil).
- [ ] Dépend de `apps/web/lib/supabase/` (Lot 0 côté web). Si absent → STOP.
- [ ] 🛑 Gate : démo end-to-end validée par Étienne (brief → run → 5 steps → N brouillons au studio → envoi en revue).

---

## Self-Review

- [ ] Aucune table ne manque `org_id` sauf `skills`, et cette exception est documentée en commentaire SQL + validée par écrit.
- [ ] Aucune policy `insert`/`update`/`delete` sur `skill_run_steps` pour `authenticated`.
- [ ] Le trigger de garde est présent **et** couvert par un test pgTAP `throws_ok('42501')` — il échappe à `get_advisors`.
- [ ] `content_items.skill_run_id` est nullable, FK composite par `client_id`, `on delete set null`.
- [ ] Les tests `006_content_core.test.sql` existants passent toujours.
- [ ] `rg "6543" supabase apps/worker` → aucun match.
- [ ] `rg "ANTHROPIC_API_KEY" apps/web packages` → aucun match.
- [ ] `rg "@ocean/skills/loader" apps/web` → aucun match (pas de `node:fs` côté client).
- [ ] `maxRetries: 0` sur le client Anthropic.
- [ ] `kill -9` entre `llm_call_started_at` et la réponse → aucun second appel facturé sur ce step.
- [ ] `pnpm check` (Biome) : 0 erreur, y compris `noExplicitAny`.
- [ ] Aucun fichier applicatif > 250 lignes.
