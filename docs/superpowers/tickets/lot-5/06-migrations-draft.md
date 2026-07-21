# Ticket LOT5-06 — Migrations Lot 5 en **brouillon**

## Ticket ID
`LOT5-06`

## Objectif
Écrire les **6 fichiers de migration SQL en brouillon** : enums, catalogue `skills`, file `skill_runs` (+ steps + artifacts + trigger de garde), bucket Storage, extension de `notification_type`, pont `content_items.skill_run_id`. **Aucune migration n'est exécutée.** On produit du SQL relu au ticket 08, exécuté après feu vert au ticket 09.

## Pré-requis
- `LOT5-02` : dictionnaire DB validé par Étienne (décisions D-1 `skills` sans `org_id`, D-2 3ᵉ bucket).
- `LOT5-05` : `EXPECTED_SEEDED_SCHEMA` figé — la migration du catalogue doit le recopier **à l'identique**.

## Contexte minimal à donner à Codex
- Source de vérité des noms : `docs/architecture/lot-5-db-dictionary.md` (ticket 02).
- Patron du DDL et des policies : `supabase/migrations/006_content_core.sql`.
- Patron d'une table écrite par le serveur, lue par le client : `supabase/migrations/007_notifications_push.sql` (`grant select` seul, **zéro policy write**).
- Patron des enums + grants : `supabase/migrations/002_enums.sql`.
- Helpers disponibles : `private.is_org_member(uuid)`, `private.is_client_member(uuid)`, `private.has_org_access(uuid)` — tous `language sql stable security definer set search_path = ''`.

**Règles multi-tenant NON négociables** (extraites de `CLAUDE.md` §2) :
1. Toute table **métier** a `org_id uuid not null` dénormalisé ; toute fille de Client a aussi `client_id`. **Exception unique, validée au ticket 02 : `skills` (référentiel système).**
2. RLS activée **dans la même migration** qui crée la table.
3. FK composites : une ligne fille ne peut physiquement pas pointer un autre tenant.
4. Policies via helpers `private.*`, wrappées `(select fn())`, `TO authenticated`. Jamais `for all`.
5. Aucune table `*_secrets` dans ce lot (la clé Anthropic est en variable d'env — décision D-4).

**Faits vérifiés, à ne pas re-déduire :**
- `content_items` a **`unique (id, client_id)`**, pas `unique (id, org_id)`. La FK du pont passe donc par `client_id`.
- `clients` a `unique (id, org_id)`.
- `supabase/config.toml` : `major_version = 15`.
- La plus grosse migration existante (`006`) fait 181 lignes. La règle 24 impose ≤ 250.

## Fichiers autorisés (création uniquement)
Les noms exacts dépendent de la numérotation (voir Étape 0). Format : `0NN_<slug>.sql`.
- `supabase/migrations/0NN_skill_enums.sql`
- `supabase/migrations/0NN_skills_catalog.sql`
- `supabase/migrations/0NN_skill_runs.sql`
- `supabase/migrations/0NN_skill_storage.sql`
- `supabase/migrations/0NN_skill_notification_types.sql`
- `supabase/migrations/0NN_content_items_skill_run.sql`

## Fichiers interdits
- `supabase/tests/**` → c'est le ticket 07.
- `supabase/config.toml` (figé).
- `apps/**`, `packages/**`, `docs/architecture/**`.

## Étapes attendues

### Étape 0 — Numérotation
```powershell
Get-ChildItem -LiteralPath 'supabase\migrations' -Filter '*.sql' | Sort-Object Name | Select-Object -Last 1
```
**Lire le dernier numéro présent et continuer.** **Ne jamais hardcoder `019`** : les Lots 1–4 ne sont pas écrits et absorberont 008–019. Les 6 fichiers se suivent dans l'ordre ci-dessous — l'ordre **est** la sécurité (un helper ou une FK référencé avant l'existence de sa cible casse la migration).

### 1 — `skill_enums`
Créer `skill_run_status`, `skill_step_status`, `skill_artifact_kind`.
`grant usage on type … to authenticated, service_role;` pour les trois.
**Ne PAS toucher à `notification_type` ici** (voir étape 5).

### 2 — `skills_catalog`
Table `skills`, **sans `org_id`**, avec un commentaire SQL en tête expliquant pourquoi (référentiel système, path traversal si `manifest_path` devient writable par le tenant).

Contraintes : `slug text not null unique`, `check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9_]*$')`, `unique (slug, version)`, `check (version > 0)`, `check (length(trim(name)) > 0)`, `check (manifest_path ~ '^skills/[a-z0-9_/-]+/skill\.json$')`.

RLS ON. **Une seule policy** :
```sql
create policy skills_select on public.skills
for select to authenticated
using (is_enabled);
```
**Aucune policy insert/update/delete.** `grant select on public.skills to authenticated;` + `grant select, insert, update, delete on public.skills to service_role;`

Seed `insert … on conflict (id) do nothing` du skill `marketing_team_campaign`, avec un `input_schema` **byte-identique** à `packages/skills/src/expected-seed.ts` (ticket 05).

### 3 — `skill_runs` (le cœur)
Trois tables + index + triggers + RLS + **le trigger de garde**. Si le fichier dépasse 250 lignes, sortir le trigger de garde dans un fichier `0NN_skill_runs_guard.sql` **immédiatement consécutif**.

**`skill_runs`** : `org_id`, `client_id`, `skill_id` (FK `on delete restrict`), `skill_slug`, `skill_version`, `status`, `input jsonb`, `context_snapshot jsonb`, `task_manifest jsonb`, colonnes de file (`run_at`, `claimed_at`, `lease_expires_at`, `worker_id`, `attempts`), comptabilité (`total_input_tokens`, `total_output_tokens`, `total_cost_micros bigint`), `last_error jsonb`, `error_history jsonb default '[]'`, `created_by`, `canceled_by`, timestamps.
- `foreign key (client_id, org_id) references public.clients(id, org_id) on delete cascade`
- **`unique (id, client_id)`** ← clé structurante
- `check (attempts >= 0 and attempts <= 5)`
- `check ((claimed_at is null and lease_expires_at is null and worker_id is null) or (claimed_at is not null and lease_expires_at is not null and worker_id is not null))`

**`skill_run_steps`** : `org_id`, `client_id`, `skill_run_id`, `step_index`, `agent_slug`, `status`, `input jsonb`, `output jsonb`, `llm_call_started_at`, `llm_idempotency_key text not null unique`, `llm_message_id`, `llm_model`, les **4** compteurs de tokens (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`), `cost_micros bigint`, `attempts`, `last_error`, timestamps.
- FK composites `(client_id, org_id) → clients(id, org_id)` et `(skill_run_id, client_id) → skill_runs(id, client_id) on delete cascade`
- `unique (id, client_id)`, `unique (skill_run_id, step_index)`
- **`check (status <> 'succeeded' or llm_message_id is not null)`** ← impossible d'écrire un step « réussi » sans preuve d'appel
- `check (attempts >= 0 and attempts <= 3)`

**`skill_artifacts`** : `org_id`, `client_id`, `skill_run_id`, `skill_run_step_id` (nullable), `kind`, `title`, `mime_type`, `content jsonb`, `storage_path text`, `size_bytes`, `materialized_content_item_id`.
- FK composites vers `clients`, `skill_runs(id, client_id)`, `skill_run_steps(id, client_id) on delete set null`, `content_items(id, client_id) on delete set null`
- **`check (num_nonnulls(content, storage_path) = 1)`** ← inline XOR storage
- `check (storage_path is null or storage_path like (org_id::text || '/' || client_id::text || '/' || skill_run_id::text || '/%'))`
- `check (kind = 'copy_asset' or materialized_content_item_id is null)`

**Index :**
```sql
create index skill_runs_claim_idx on public.skill_runs (run_at)
  where status = 'queued';
create index skill_runs_reaper_idx on public.skill_runs (lease_expires_at)
  where status = 'running';
-- anti-doublon : l'analogue de la regle 16
create unique index skill_runs_active_per_client_skill_idx
  on public.skill_runs (client_id, skill_id)
  where status in ('queued','running','waiting_approval');
create index skill_run_steps_run_idx on public.skill_run_steps (skill_run_id, step_index);
-- le filet : retrouver les appels payes et perdus
create index skill_run_steps_orphaned_idx on public.skill_run_steps (llm_call_started_at)
  where status = 'running' and llm_message_id is null;
create index skill_artifacts_run_kind_idx on public.skill_artifacts (skill_run_id, kind);
```

**Triggers `set_updated_at`** sur les trois tables.

**RLS + policies :**
- `skill_runs` : SELECT `is_org_member(org_id) or is_client_member(client_id)` ; INSERT/UPDATE/DELETE `is_org_member(org_id)`.
- `skill_run_steps` : **SELECT uniquement.** `grant select on public.skill_run_steps to authenticated;` — **aucune policy write** (précédent `notifications`).
- `skill_artifacts` : SELECT `is_org_member or is_client_member` ; UPDATE `is_org_member` (pour poser `materialized_content_item_id`). Pas d'INSERT/DELETE pour `authenticated`.
- `grant … to service_role` sur les trois.

**Le trigger de garde** — `private.skill_runs_guard_queue_columns()`, `BEFORE UPDATE`, `language plpgsql security definer set search_path = ''` :
- si `current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'` → `return new`
- refuse toute transition de `status` autre que `* → canceled` depuis `queued|running|waiting_approval`
- refuse toute modification de `claimed_at`, `lease_expires_at`, `worker_id`, `attempts`, `skill_id`, `input`, `context_snapshot`, `total_*`, `org_id`, `client_id`
- `raise exception … using errcode = '42501'`
- `revoke all on function … from public;`

**Realtime** : `alter publication supabase_realtime add table public.skill_runs;` — **`skill_runs` seulement**.

### 4 — `skill_storage`
Bucket **privé** `skill-artifacts` (`public = false`, `file_size_limit` 10 MiB, `allowed_mime_types` JSON/markdown/CSV/plain), `on conflict (id) do nothing`.
Policy `select` sur `storage.objects` via `storage.foldername(name)` : `[1]` = `org_id`, `[2]` = `client_id`.
**Aucune policy insert/update/delete pour `authenticated`** — le worker écrit en `service_role`.

### 5 — `skill_notification_types`
Fichier **contenant UNIQUEMENT** :
```sql
alter type public.notification_type add value if not exists 'skill_run_completed';
alter type public.notification_type add value if not exists 'skill_run_failed';
```
⚠️ **Contrainte PG 15** : une valeur ajoutée par `ALTER TYPE … ADD VALUE` n'est pas utilisable dans la même transaction. `supabase db reset` joue chaque fichier dans une transaction → toute autre instruction dans ce fichier casserait.

### 6 — `content_items_skill_run`
```sql
alter table public.content_items add column skill_run_id uuid;

alter table public.content_items add constraint content_items_skill_run_fk
  foreign key (skill_run_id, client_id)
  references public.skill_runs (id, client_id)
  on delete set null;

create index content_items_skill_run_id_idx
on public.content_items (skill_run_id)
where skill_run_id is not null;
```
Colonne **nullable** (la table peut être non vide en prod — pas de `not null` sans default). `on delete set null`, pas `cascade` : supprimer un run d'IA ne doit **jamais** détruire du contenu approuvé.

## Critères d'acceptation
- [ ] Les 6 fichiers existent, numérotés à la suite du dernier présent (aucun `019` hardcodé).
- [ ] `skills` n'a **pas** d'`org_id`, porte un commentaire SQL justificatif, et a **zéro policy write**.
- [ ] Le `input_schema` seedé est **byte-identique** à `packages/skills/src/expected-seed.ts`.
- [ ] `skill_runs` porte `unique (id, client_id)`.
- [ ] `skill_run_steps` a **une seule policy** (SELECT) et `grant select` seul pour `authenticated`.
- [ ] `skill_run_steps` porte `check (status <> 'succeeded' or llm_message_id is not null)` et `unique (llm_idempotency_key)`.
- [ ] `skill_artifacts` porte `check (num_nonnulls(content, storage_path) = 1)`.
- [ ] L'index unique partiel `skill_runs_active_per_client_skill_idx` existe.
- [ ] Le trigger `private.skill_runs_guard_queue_columns()` existe, lève `42501`, et est `security definer set search_path = ''`.
- [ ] `content_items.skill_run_id` est **nullable**, FK composite `(skill_run_id, client_id)`, `on delete set null`.
- [ ] Le fichier `*_skill_notification_types.sql` ne contient **que** les deux `alter type`.
- [ ] Aucune migration ne contient `6543`, `disable row level security`, ni `delete from storage.objects`.
- [ ] Chaque migration créant une table active la RLS **dans le même fichier**.
- [ ] Aucun fichier > 250 lignes.
- [ ] Aucun fichier sous `supabase/tests/`, `apps/`, `packages/`.

## Commandes de validation
```powershell
# Les 6 migrations sont la, dans l'ordre
Get-ChildItem -LiteralPath 'supabase\migrations' -Filter '*skill*' | Sort-Object Name | Select-Object Name

# skills n'a pas d'org_id
Select-String -Path 'supabase\migrations\*skills_catalog.sql' -Pattern 'org_id'        # attendu : aucun match

# skill_run_steps : une seule policy (select), aucune policy write
Select-String -Path 'supabase\migrations\*skill_runs.sql' -Pattern 'policy skill_run_steps'
rg "policy skill_run_steps_(insert|update|delete)" supabase\migrations                 # attendu : aucun match

# Le trigger de garde et son errcode
rg "skill_runs_guard_queue_columns|42501" supabase\migrations

# Les invariants d'idempotence
rg "llm_idempotency_key|status <> 'succeeded' or llm_message_id is not null" supabase\migrations

# Le fichier d'enum notification ne contient QUE les alter type
Get-Content 'supabase\migrations\*skill_notification_types.sql'

# Le pont : nullable + FK composite + set null
rg "add column skill_run_id uuid;|foreign key \(skill_run_id, client_id\)|on delete set null" supabase\migrations

# Interdits absolus
rg "6543" supabase\migrations                          # attendu : aucun match
rg "disable row level security" supabase\migrations    # attendu : aucun match
rg "delete from storage.objects" supabase\migrations   # attendu : aucun match

# Regle 24
Get-ChildItem -Path 'supabase\migrations' -Filter '*skill*' | ForEach-Object { $n=(Get-Content $_ | Measure-Object -Line).Lines; "$($_.Name): $n lignes" }

# Le catalogue disque et le seed n'ont pas diverge
pnpm skills:check
```

## Risques / points d'attention
- **L'ordre = la sécurité.** Un helper `private.*` ou une FK référencé avant l'existence de sa cible casse la migration. Respecter strictement l'ordre 1→6.
- **`ALTER TYPE … ADD VALUE` doit être seul dans son fichier.** Sur PG 15, la valeur n'est pas utilisable dans la transaction qui l'ajoute. `supabase db reset` joue chaque fichier en transaction.
- **Le trigger de garde n'est pas une policy → `get_advisors` ne le verra pas.** Sans lui, un owner peut écrire `status = 'completed'` ou `claimed_at = null` sur un run en cours d'exécution → **double facturation LLM**. Postgres n'a pas de policy par colonne, et Ocean n'utilise pas `grant update(col)`. Le test pgTAP du ticket 07 est le **seul** filet.
- **La FK du pont doit passer par `client_id`.** Une FK simple `references skill_runs(id)` laisserait un `content_item` du client A pointer un run du client B. `content_items` n'a que `unique (id, client_id)` — ne pas inventer un `unique (id, org_id)`.
- **`content_items.skill_run_id` doit être nullable.** Un `not null` sans default échouerait sur une table non vide en production.
- **Le seed de `skills` doit être idempotent** (`on conflict do nothing`) pour supporter un `supabase db reset` répété.
- **`total_cost_micros` en `bigint`, jamais en `numeric` ni en float.** C'est de l'argent.
- **Ne PAS exécuter.** Pas de `supabase db push`, pas de `supabase migration up`, pas de `supabase start` contre un projet réel. On écrit du texte SQL, on ne le joue pas.

## Résultat attendu
6 migrations SQL en brouillon, cohérentes et ordonnées, **non exécutées**, prêtes pour les tests pgTAP (07) puis la revue (08).

## Message de commit suggéré
```
feat(lot-5-draft): migrations SQL Lot 5 en brouillon

Enums, catalogue skills (sans org_id, zero policy write), file skill_runs
(+ steps select-only, + artifacts inline XOR storage), trigger de garde des
colonnes de file (42501), bucket prive skill-artifacts, extension de
notification_type (fichier isole, contrainte PG15), pont content_items.skill_run_id
(FK composite par client_id, on delete set null). NON execute.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-07` démarre seulement une fois ce commit fait.
