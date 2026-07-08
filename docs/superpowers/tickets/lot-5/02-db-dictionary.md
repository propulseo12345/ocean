# Ticket LOT5-02 — Figer le dictionnaire DB Lot 5

## Ticket ID
`LOT5-02`

## Objectif
Produire `docs/architecture/lot-5-db-dictionary.md` : le **contrat DB** des 4 tables neuves, des 3 enums, du 3ᵉ bucket Storage et de l'`alter table content_items`. Faire **trancher par écrit** les deux décisions structurantes (`skills` sans `org_id`, bucket dédié). **Aucun SQL n'est écrit dans ce ticket** — c'est un document.

## Pré-requis
- **`LOT5-01` terminé, rapport `GATE VERTE`, validé par Étienne.**

## 🛑 Pré-condition bloquante
Ce ticket se termine par une **gate de validation**. Codex produit le dictionnaire, s'arrête, et attend l'accord écrit d'Étienne sur les deux décisions ouvertes ci-dessous.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, sections **Décisions d'architecture actées** et **Task 2**.
- Source de vérité du schéma existant : `docs/architecture/lot-0-db-dictionary.md` + `supabase/migrations/001→007`.
- Gabarit du document : `docs/architecture/lot-0-db-dictionary.md` (sections `Status`, `Tables`, `Deferred`, `Open Decisions`).

**Règles multi-tenant NON négociables** (extraites de `CLAUDE.md` §2) :
1. Toute table **métier** a `org_id uuid not null` dénormalisé ; toute table fille de Client a aussi `client_id`.
2. RLS activée sur 100 % des tables, **dans la migration qui les crée**.
3. FK composites : une ligne fille ne peut physiquement pas pointer un autre tenant.
4. Policies via helpers `private.*` SECURITY DEFINER, wrappées `(select fn())`, `TO authenticated`.
5. Tables `*_secrets` = deny-all : RLS activée + **zéro policy**.

**Faits vérifiés sur le schéma existant, à ne pas re-déduire :**
- `content_items` a `unique (id, client_id)` — **il n'a PAS `unique (id, org_id)`**. La seule clé de jointure composite disponible est donc `client_id`.
- `notifications` (migration 007) : `grant select` seul pour `authenticated`, écriture réservée au `service_role`, **aucune policy insert/update/delete**. C'est le **précédent canonique** d'une table écrite par le serveur et seulement lue par le client.
- `private.has_org_access(uuid)` est créée dans `007_notifications_push.sql` (disponible pour toute migration ultérieure).
- `supabase/config.toml` : `major_version = 15`.

## Fichiers autorisés (création uniquement)
- `docs/architecture/lot-5-db-dictionary.md`

## Fichiers interdits
- `supabase/**` (le SQL est le ticket 06).
- `apps/**`, `packages/**`.
- `CLAUDE.md` (les ajouts d'anti-patterns sont *proposés* dans le dictionnaire, appliqués plus tard).

## Étapes attendues

### 1. Section `Status`
« Draft for Etienne review. No migration has been executed. » + rappel que le Lot 5 est post-MVP (PRD §4, colonne V2).

### 2. Section `Tables Lot 5` — décrire en prose (pas de DDL)

**`skills`** — catalogue système.
- Colonnes : `id`, `slug` (unique, `check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9_]*$')`), `version integer`, `name`, `description`, `manifest_path` (avec `check` de forme), `input_schema jsonb`, `is_enabled boolean`, timestamps.
- **`org_id` ABSENT.** RLS ON, `select … using (is_enabled)`, **zéro policy write**. Seed par migration.

**`skill_runs`** — la file.
- `org_id` + `client_id` (tous deux `not null`), `skill_id` (FK `restrict`), `skill_slug` + `skill_version` (résolus au run → reproductibilité), `status`, `input jsonb`, `context_snapshot jsonb` (brand kit + piliers figés : le worker ne relit pas `brand_kits`), `task_manifest jsonb`.
- Colonnes de file : `run_at`, `claimed_at`, `lease_expires_at`, `worker_id`, `attempts`.
- Comptabilité : `total_input_tokens`, `total_output_tokens`, `total_cost_micros bigint` (**jamais de float pour de l'argent**).
- `last_error jsonb`, `error_history jsonb`, `created_by`, `canceled_by`.
- FK composite `(client_id, org_id) → clients(id, org_id)`.
- **`unique (id, client_id)`** ← clé structurante, cible des FK composites filles **et** du pont vers `content_items`.

**`skill_run_steps`** — un step par agent.
- `org_id` + `client_id` (règle 1, sans exception), `skill_run_id`, `step_index`, `agent_slug`, `status`.
- **Idempotence** : `llm_call_started_at` (l'analogue de `publish_started_at`), `llm_idempotency_key text unique`, `llm_message_id`, `llm_model`.
- `input jsonb`, `output jsonb`, tokens (**les 4 champs `usage`**), `cost_micros bigint`, `attempts`, `last_error`.
- FK composites `(client_id, org_id) → clients(id, org_id)` et `(skill_run_id, client_id) → skill_runs(id, client_id)`.
- `unique (skill_run_id, step_index)`, `check (status <> 'succeeded' or llm_message_id is not null)`.
- **RLS ON, policy SELECT seule, `grant select` seul pour `authenticated`** (précédent `notifications`).

**`skill_artifacts`** — les livrables.
- `org_id` + `client_id`, `skill_run_id`, `skill_run_step_id` (nullable), `kind`, `title`, `mime_type`.
- **`content jsonb` XOR `storage_path text`** — `check (num_nonnulls(content, storage_path) = 1)`. Le contenu court (< 8 Ko) reste inline ; le contenu long va en Storage.
- `materialized_content_item_id` : le pont, FK composite vers `content_items(id, client_id)`.
- `check` sur la forme du `storage_path` : `{org_id}/{client_id}/{skill_run_id}/…`.

### 3. Section `Enums`
- `skill_run_status` : `queued | running | waiting_approval | completed | failed | canceled`
- `skill_step_status` : `pending | running | succeeded | failed | skipped`
- `skill_artifact_kind` : `task_manifest | campaign_report | content_calendar | copy_asset | research_note`
- Extension de `notification_type` : `skill_run_completed`, `skill_run_failed` — **dans une migration séparée, seule dans son fichier** (PG 15 : `ALTER TYPE … ADD VALUE` n'est pas utilisable dans la même transaction que son usage).

### 4. Section `Storage`
Bucket **privé** `skill-artifacts` (3ᵉ bucket). Justifier : rétention et MIME distincts des médias de publication ; ne pas polluer `media-originals`, dont la purge J+7 est gouvernée par la logique média du Lot 1. Chemin `{org_id}/{client_id}/{skill_run_id}/…`, policies via `storage.foldername()`, **aucune policy write pour `authenticated`**. Jamais de `DELETE` SQL sur `storage.objects` (règle 23).

### 5. Section `Le pont vers content_items`
```
alter table public.content_items add column skill_run_id uuid;   -- NULLABLE
alter table public.content_items add constraint content_items_skill_run_fk
  foreign key (skill_run_id, client_id) references public.skill_runs (id, client_id)
  on delete set null;
```
Justifier : `on delete set null` (pas `cascade`) — supprimer un run d'IA ne doit **jamais** détruire du contenu approuvé. Cohérent avec `created_by … on delete set null` déjà présent sur `content_items`.
Expliquer pourquoi une FK simple `references skill_runs(id)` est **insuffisante** : elle laisserait un `content_item` du client A pointer un `skill_run` du client B.

### 6. Section `Le trigger de garde`
Décrire `private.skill_runs_guard_queue_columns()` : `BEFORE UPDATE`, `security definer`, `set search_path = ''`. Il refuse, pour tout rôle ≠ `service_role` :
- toute transition de `status` autre que `* → canceled` ;
- toute modification de `claimed_at`, `lease_expires_at`, `worker_id`, `attempts`, `total_cost_micros`, `org_id`, `client_id`.

**Pourquoi** : une policy `for update … using (is_org_member(org_id))` laisserait un owner écrire `status = 'completed'` sur un run en cours → **double facturation LLM**. Postgres n'a pas de policy par colonne et Ocean n'utilise pas `grant update(col)`.
⚠️ **Ce trigger n'est pas une policy → `get_advisors` ne le verra pas.** Un test pgTAP `throws_ok('42501')` est obligatoire (ticket 07) et doit figurer dans la checklist de revue (ticket 08).

### 7. Section `Realtime`
`alter publication supabase_realtime add table public.skill_runs;` — **`skill_runs` seulement**. Pas `skill_run_steps` : les colonnes `input`/`output` sont volumineuses et contiennent de la donnée client. Le front s'abonne au run et lit les steps par requête classique (RLS filtre).

### 8. Section `Open Decisions` — les deux décisions à faire trancher

**D-1 · `skills` sans `org_id` — la seule entorse à la règle 1.**
Présenter les deux options et la recommandation :
- *Catalogue global (recommandé)* : un skill est du **code + prompt versionné par git**, pas de la donnée tenant. C'est un référentiel, comme `pg_enum`. Précédent : les 13 enums de `002_enums.sql` sont globaux et `grant usage … to authenticated`.
- *`org_id not null` sur `skills`* : rendrait `manifest_path` **writable par le tenant**. Le worker le résout en chemin disque → **path traversal**. Le `check (manifest_path ~ '^skills/…')` mitige, un référentiel non-écrivable **supprime** la faille. Obligerait aussi à N copies identiques du catalogue.
- Demander une phrase de validation explicite : « `skills` reste un catalogue global, validé ».

**D-2 · 3ᵉ bucket `skill-artifacts`.**
Les règles 20/21 actent 2 buckets (`media-originals`, `media-thumbs`). Demander validation du 3ᵉ, avec sa justification (rétention, MIME, chemin d'isolation distincts).

### 9. Section `Anti-patterns à ajouter à CLAUDE.md §8` (proposition, non appliquée)
- ❌ « Edge Function qui appelle un LLM » → même cause que « Edge Function qui publie » (400 s wall).
- ❌ « Managed Agents / `client.beta.agents` + `sessions` pour faire propre » → l'état du run vivrait chez Anthropic ; le reaper Ocean ne pourrait pas le reprendre. **Même motif que le rejet de Redis** (décision #17). C'est le piège le plus probable pour un futur contributeur : le SDK propose littéralement cette API pour ce cas d'usage.

### 10. Section `À ajouter à CLAUDE.md §5` (proposition)
L'**écart assumé à la règle 15** : un step LLM orphelin est retenté (borné à 3), là où un `publish_job` avec `publish_started_at` posé ne l'est jamais. Motif : `/v1/messages` n'a pas d'idempotency key ni d'endpoint de relecture — il n'y a **rien à vérifier**. Le pire cas est un appel payé deux fois (~0,40 $), pas une double publication chez un client. **Sans cette note, un futur agent « corrigera » le code.**

## Critères d'acceptation
- [ ] `docs/architecture/lot-5-db-dictionary.md` existe, structuré comme `lot-0-db-dictionary.md`.
- [ ] Les 4 tables sont décrites en **prose**, avec leurs colonnes clés, FK composites et contraintes `check`. **Aucun bloc DDL exécutable.**
- [ ] `skills` est explicitement documentée comme **référentiel système sans `org_id`**, avec la justification path-traversal.
- [ ] `skill_run_steps` est documentée avec **zéro policy write**, précédent `notifications` cité.
- [ ] `skill_runs` porte `unique (id, client_id)`, et le document explique **pourquoi** (`content_items` n'a pas `unique(id, org_id)`).
- [ ] Le trigger de garde est décrit, **avec la mention explicite qu'il échappe à `get_advisors`**.
- [ ] La section `Open Decisions` pose D-1 et D-2 et demande une validation écrite.
- [ ] Les propositions d'ajout à `CLAUDE.md` §5 et §8 figurent dans le document (sans modifier `CLAUDE.md`).
- [ ] Le document est ajouté à la table `CLAUDE.md` §13 (proposition écrite, pas appliquée).
- [ ] Aucun fichier hors `docs/architecture/` n'a été touché.

## Commandes de validation
```powershell
# Le document existe
Test-Path 'docs\architecture\lot-5-db-dictionary.md'

# Aucun DDL executable ne s'y est glisse
Select-String -Path 'docs\architecture\lot-5-db-dictionary.md' -Pattern 'create table public\.'   # attendu : aucun match (prose uniquement)

# Les deux decisions ouvertes sont posees
Select-String -Path 'docs\architecture\lot-5-db-dictionary.md' -Pattern 'Open Decisions|catalogue global|skill-artifacts'

# Le trigger de garde et son angle mort sont documentes
Select-String -Path 'docs\architecture\lot-5-db-dictionary.md' -Pattern 'get_advisors'

# Rien n'a bouge ailleurs
git status --short | Select-String -NotMatch 'docs/architecture/lot-5-db-dictionary.md'
```

## Risques / points d'attention
- **La règle 1 est absolue dans `CLAUDE.md`** (« Sans exception »). Un relecteur — humain ou agent — va tiquer sur `skills` sans `org_id`. C'est **exactement** pourquoi ce ticket est une gate : la décision doit être écrite, justifiée, et validée par Étienne. Sans ça, un futur contributeur « corrigera » la table et rouvrira la path traversal.
- **Ne pas confondre table métier et référentiel.** `skills` est un miroir de fichiers versionnés par git, identique pour tous les tenants. Y mettre `org_id` n'isole rien : il n'y a rien à isoler.
- **`content_items` n'a pas `unique (id, org_id)`.** Ne pas l'inventer. Le dictionnaire doit refléter le schéma réel de la migration 006, pas le schéma qu'on souhaiterait.
- **Ne PAS écrire de SQL exécutable** dans ce document. La tentation est forte ; c'est le ticket 06.
- Ne pas modifier `CLAUDE.md` : les ajouts §5 et §8 sont **proposés** ici, appliqués dans un ticket ultérieur ou par Étienne.

## Résultat attendu
Un dictionnaire DB Lot 5 relu et validé, qui sert de source de vérité unique aux migrations du ticket 06.

## Message de commit suggéré
```
docs(lot-5): fige le dictionnaire DB (4 tables + 3 enums + pont content_items)

skills = referentiel systeme sans org_id (justifie : path traversal).
skill_run_steps = select-only pour authenticated (precedent notifications).
skill_runs porte unique(id, client_id) : content_items n'a pas unique(id, org_id).
Trigger de garde des colonnes de file (echappe a get_advisors -> test pgTAP).
Propositions d'ajout a CLAUDE.md §5 (ecart regle 15) et §8 (anti-patterns).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. 🛑 `LOT5-03` démarre seulement après validation écrite d'Étienne sur **D-1** et **D-2**.
