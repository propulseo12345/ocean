# Audit adversarial — Lot 5 (Skills) + guardrails SaaS

> Audit du 2026-07-08. Cible : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, les 13 tickets `docs/superpowers/tickets/lot-5/`, et les guardrails produits en amont.
> **Objectif : casser le plan avant que Codex ne l'exécute.** READ-ONLY, aucun code modifié.
>
> **Niveau de preuve.** Aucun Postgres n'est installé sur cette machine (`psql`, `docker`, `supabase` tous absents) : les bloquants B1 et B2 sont établis par **lecture du SQL + comportement Postgres documenté**, non par exécution. Les deux reposent sur des propriétés stables et vérifiables en une commande dès qu'une base locale existe — les commandes de vérification sont données avec chaque finding. **Étape 0 avant tout correctif : les reproduire.**

---

## Verdict : 🔴 ROUGE — ne pas laisser Codex exécuter les tickets 06→12 en l'état

Le plan Lot 5 est **d'une qualité rare sur la conception** : les 10 faits API Claude sont exacts, la séquence D-2 est bonne, la défense en profondeur du pont artifacts→content_items est exemplaire, les 7 gates sont cohérentes.

**Mais le DDL et les tickets worker ne sont pas exécutables.** Six bloquants, dont trois qui ne compilent même pas (`42703`, `23502`) et un qui empêche le worker de fonctionner *du tout*.

**Le plus dangereux n'est aucun des six** : `08-sql-review.md:61` déclare « le trigger de garde n'est pas une policy → `get_advisors` ne le verra pas ; **le test pgTAP est le seul filet** ». Or ce test pose systématiquement `request.jwt.claims = '{"role":"authenticated"}'` et **ne teste donc jamais le chemin du worker**. La revue SQL passera au vert sur un trigger qui bloque la production.

> Les deux affirmations les plus confiantes des tickets — « le trigger de garde est le seul filet » et « `ALTER TYPE ADD VALUE` est le risque à surveiller » — désignent respectivement **un trigger qui bloque le worker** et **le seul point du lot qui soit déjà correct**. Le budget de paranoïa est intégralement mal alloué.

---

## 1. Ce qui est vérifié et correct (ne pas y toucher)

### Faits API Claude — 9/9 exacts

Vérifiés contre la skill `claude-api` (source autoritaire). Le plan §125-134 est irréprochable :

| Fait du plan | Verdict |
|---|---|
| `claude-opus-4-8`, 1M contexte, 128K output, **$5/$25** par M tokens | ✅ |
| `thinking: {type:"adaptive"}` **explicite** — omettre = tourner sans thinking | ✅ piège réel |
| `budget_tokens` / `temperature` / `top_p` / `top_k` → **400** | ✅ |
| `output_config: {effort}`, défaut `high` | ✅ |
| Streaming obligatoire au-dessus de ~16 000 `max_tokens` | ✅ |
| `output_config: {format: {type:"json_schema"}}`, pas `output_format` | ✅ |
| Prefills assistant → **400** | ✅ |
| **Aucune idempotency key**, SDK `maxRetries: 2` → mettre `0` | ✅ |
| `stop_reason === "refusal"` → erreur permanente, pas de retry | ✅ |
| **Minimum cacheable Opus 4.8 = 4096 tokens** (silencieux si en dessous) | ✅ |

> Un plan qui a raison sur les dix, y compris sur le piège du minimum cacheable silencieux, mérite qu'on ne le réécrive pas.

### D-2 (idempotence LLM) — l'intention est juste, la séquence est bonne

La séquence commit-avant-HTTP / HTTP-hors-transaction / commit-après est le pattern de la règle 15, correctement adapté à une API sans endpoint de relecture. La prémisse fondatrice (`/v1/messages` n'a ni idempotency key ni endpoint de relecture) est **vérifiée exacte**. La politique « retry borné à 3, tracé, pas de fail-closed » est un arbitrage coût/disponibilité défendable.

**Mais l'un des trois « filets structurels » du plan est inopérant** — voir M5. Ce n'est pas la séquence qui est fausse, c'est ce que le plan croit qu'elle protège.

### Autres points validés

- **Injection `org_id`/`client_id` depuis `skill_runs`, jamais depuis le JSON du LLM** (ticket 12), avec la FK composite en filet. Exemplaire.
- **`skills` sans `org_id`** : justifié (path traversal si `manifest_path` devient writable par le tenant), documenté, tranché par écrit. Acceptable.
- **Clé Anthropic en env worker, pas Vault** : correct, motivé.
- **Les 7 gates 🛑** sont cohérentes entre plan et tickets (01, 02, 08, 09, 11×2, 13).
- **Chaîne de dépendance correcte** : la gate 01 bloquera, `apps/worker` n'existe pas (Lot 2).

---

## 2. Bloquants — le plan échouera à l'exécution

### 🔴 B1 — Le trigger de garde bloque le worker lui-même

**Le plus grave. Le Lot 5 ne démarrera pas.**

`06-migrations-draft.md:122` — le trigger `private.skill_runs_guard_queue_columns()` détecte le worker ainsi :

```sql
if current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' then
  return new;
end if;
```

`request.jwt.claims` est un GUC **injecté par PostgREST** à chaque requête HTTP. Or :

- `10-worker-queue.md:16` impose **Supavisor SESSION port 5432** — une connexion **Postgres directe** (`pg`/`postgres-js`), pas PostgREST.
- En connexion directe, `request.jwt.claims` **n'est jamais défini**.
- `current_setting('request.jwt.claims', true)` renvoie alors `NULL` → `NULL::jsonb ->> 'role'` renvoie `NULL` → `NULL = 'service_role'` vaut `NULL` → la branche `if` **ne se déclenche pas**.

Le trigger tombe donc dans le chemin bloquant et lève `42501` sur **tous** les UPDATE du worker :

- le claim (`set status='running', claimed_at, lease_expires_at, worker_id, attempts+1`)
- le heartbeat (`renewLease()`)
- le reaper (`→ queued`)
- la complétion (`waiting_approval → completed`, ticket 12 §5)

**Aucun de ces UPDATE ne passe.** Le ticket 10 échoue à la première exécution.

**Aggravant : le bug est structurellement intestable.** `07-pgtap-draft.md:22` pose systématiquement `set local "request.jwt.claims" = '{"role":"authenticated"}'`. Les assertions 4, 5 et 6 testent **uniquement le chemin bloquant**. Aucune assertion ne vérifie que `service_role` passe.

> C'est le même pattern que la faille `has_org_access` du Lot 0 : *les tests prouvent que la porte est fermée, jamais qu'elle s'ouvre pour celui qui a la clé.*

**Piège du correctif naïf.** Écrire `if current_user in ('service_role','postgres')` **est pire que le bug** : dans une fonction `SECURITY DEFINER`, `current_user` vaut le **propriétaire de la fonction** (`postgres`). La condition serait donc toujours vraie et **le trigger ne garderait plus rien pour personne**. Faille de sécurité.

Il faut `session_user` (le rôle réellement authentifié, non affecté par `SECURITY DEFINER` ni par `SET ROLE`) — mais sous PostgREST `session_user` vaut toujours `authenticator`, pour un `authenticated` comme pour un `service_role`. Aucun des deux seul ne suffit.

**Correctif — combiner les deux mondes :**

```sql
create or replace function private.skill_runs_guard_queue_columns()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_bypass boolean;
begin
  -- (a) worker en connexion Postgres directe (Supavisor SESSION :5432, pg/postgres-js).
  --     session_user vaut 'postgres'. current_user vaudrait le PROPRIÉTAIRE de la
  --     fonction (security definer) → inutilisable ici.
  -- (b) chemin PostgREST : session_user = 'authenticator' pour tous ; c'est la
  --     claim JWT qui discrimine. Sans (a), le worker est bloqué ; sans (b),
  --     une future Edge Function en service key le serait.
  -- ⚠️ NE JAMAIS remplacer session_user par current_user : sous security definer
  --    il vaut le propriétaire et la garde s'ouvre pour tout le monde.
  v_bypass :=
       pg_catalog.session_user in ('postgres', 'supabase_admin')
    or coalesce(
         pg_catalog.current_setting('request.jwt.claims', true)::jsonb ->> 'role',
         ''
       ) = 'service_role';

  if v_bypass then return new; end if;
  -- … garde existante, avec `is distinct from` (voir M4) …
end;
$$;
```

`pg_catalog.` qualifié partout : obligatoire avec `search_path = ''`.

**Alternative plus propre** (recommandée si Étienne veut simplifier) : **retirer `security definer`** du trigger. Un `BEFORE UPDATE` qui lit `OLD`/`NEW` et lève une exception n'a besoin d'aucun privilège élevé. `current_user` reflète alors le rôle appelant réel, et la garde devient `current_user in ('postgres','supabase_admin','service_role')`. Un seul test, lisible.

**Tests à ajouter (obligatoires, sinon le correctif régressera)** :
- `lives_ok` **sans aucun `request.jwt.claims`**, sous le rôle qui joue la migration → prouve le chemin worker.
- `throws_ok('42501')` sous `authenticated` → prouve la garde.
- `lives_ok` sur `status = 'canceled'` sous `authenticated` → prouve la seule transition permise.

**Le même bug frappera `publish_jobs`** (Lot 2) : le trigger de garde que j'ai proposé en guardrail (GUARD-11) reprend la détection par claim JWT. **Corriger les deux au même endroit, avant que le Lot 2 ne l'implémente.**

---

### 🔴 B2 — `on delete set null` sur FK composite → `23502` (PostgreSQL 15)

`supabase/config.toml:13` → `major_version = 15`.

**Occurrence 1** — `06-migrations-draft.md` étape 6 :

```sql
alter table public.content_items add constraint content_items_skill_run_fk
  foreign key (skill_run_id, client_id)
  references public.skill_runs (id, client_id)
  on delete set null;
```

Supprimer un `skill_run` déclenche l'action référentielle sur **toutes les colonnes de la FK** : `skill_run_id` **et** `client_id`. Or `content_items.client_id` est `not null` (`006_content_core.sql:4`).

→ **`23502 not_null_violation`. La suppression du run échoue.**

L'intention (« supprimer un run d'IA ne doit jamais détruire du contenu approuvé ») est juste ; l'implémentation la rend impossible.

**Occurrence 2 et 3** — même bug sur `skill_artifacts` (`06:91`), dont `client_id` est aussi `not null` :
- `(skill_run_step_id, client_id) → skill_run_steps(id, client_id) on delete set null`
- `(materialized_content_item_id, client_id) → content_items(id, client_id) on delete set null`

**Correctif — la clause existe en PG 15.**

`ON DELETE SET NULL (liste_de_colonnes)` a été **ajoutée dans PostgreSQL 15** (release notes : *« Allow `ON DELETE SET NULL`/`SET DEFAULT` to affect only a subset of the referencing columns »*). `config.toml` déclare `major_version = 15` → **la syntaxe est disponible**.

```sql
-- content_items
alter table public.content_items add constraint content_items_skill_run_fk
  foreign key (skill_run_id, client_id)
  references public.skill_runs (id, client_id)
  on delete set null (skill_run_id);   -- ← ne nullifie QUE skill_run_id

-- skill_artifacts
foreign key (skill_run_step_id, client_id)
  references public.skill_run_steps (id, client_id)
  on delete set null (skill_run_step_id),
foreign key (materialized_content_item_id, client_id)
  references public.content_items (id, client_id)
  on delete set null (materialized_content_item_id),
```

⚠️ **Dépendance de version à documenter** : un downgrade en PG 14 casse ces trois migrations. À écrire dans le dictionnaire DB.

> J'avais initialement daté cette clause de PG 16 — c'est faux, elle est bien en 15. Corrigé après vérification croisée.

---

### 🔴 B3 — `max_attempts` n'existe pas : le ticket 10 ne compile pas

**Trivialement vérifiable :**

```
rg -c "max_attempts" 06-migrations-draft.md   → 0
rg -c "max_attempts" 10-worker-queue.md       → 4
rg -c "max_attempts" 11-worker-llm-executor.md → 1
```

Le DDL du ticket 06 ne crée **aucune** colonne `max_attempts` — la borne est un `check (attempts >= 0 and attempts <= 5)` (run) et `<= 3` (step). Mais le claim (`10:56`) et le reaper (`10:90`) écrivent `attempts < max_attempts` / `attempts >= max_attempts`.

→ **`42703: column "max_attempts" does not exist`.** Le worker ne claim jamais.

**Aggravant — le CHECK crée un run zombie.** Le claim fait `attempts = attempts + 1`. À la 6ᵉ prise, `attempts` passe à 6 → **`23514 check_violation` à l'intérieur du claim atomique**. La transaction du tick rollback. Le run devient physiquement inclaimable, **et le reaper ne peut plus le passer à `failed`** (il devrait aussi écrire). Zombie permanent, worker en boucle de crash dessus.

**Correctif** — ajouter la colonne (recommandé, rend le retry configurable) :

```sql
-- skill_runs
attempts     integer not null default 0,
max_attempts integer not null default 5,
constraint skill_runs_max_attempts_bounds check (max_attempts between 1 and 5),
constraint skill_runs_attempts_bounds     check (attempts >= 0 and attempts <= max_attempts),

-- skill_run_steps : idem avec default 3, borne 1..3
```

Et **ajouter `max_attempts` à la liste des colonnes gardées par le trigger** — sinon un owner relance une facture LLM en écrivant `max_attempts = 99`.

### 🔴 B4 — `started_at` / `finished_at` absents du DDL

Même famille que B3. Le ticket 06 liste `run_at, claimed_at, lease_expires_at, worker_id, attempts` + « timestamps » (= `created_at`, `updated_at`). Mais :

- `10:53` : `started_at = coalesce(started_at, now())`
- `11:152`, `12:79` : `finished_at = now()`

Deux colonnes utilisées, jamais créées. **`42703`.**

```sql
started_at  timestamptz,
finished_at timestamptz,
constraint skill_runs_finished_after_started
  check (finished_at is null or started_at is null or finished_at >= started_at),
```

À ajouter aussi à la liste des colonnes gardées. Et `created_by`/`canceled_by` sont listés (`06:78`) **sans FK** → ajouter `references public.profiles(id) on delete set null` (colonne simple, `set null` sans liste est correct ici).

### 🔴 B5 — `llm_idempotency_key text not null unique` contredit le worker

Trois documents se contredisent :

| Source | Dit |
|---|---|
| `06:84` | `llm_idempotency_key text not null unique` |
| `02:62` | `text unique` (**nullable**) |
| `11` §5 | insère les steps 1..N en `pending` **sans clé** |
| `10` §6 | matérialise un step 0 **sans clé** |

Avec `not null`, ces INSERT lèvent **`23502`**.

Et la clé est **UPDATE-ée** (`11:145`), puis **ré-UPDATE-ée** au retry orphelin (`11:139`). Une colonne `not null unique` réécrite à chaque tentative n'est pas une clé d'idempotence.

**Correctif :**

```sql
llm_idempotency_key text,                                  -- nullable
constraint skill_run_steps_idem_key_uniq unique (llm_idempotency_key),
constraint skill_run_steps_idem_key_required
  check (status in ('pending','skipped') or llm_idempotency_key is not null),
```

`UNIQUE` tolère N valeurs `NULL` en PG (`NULLS DISTINCT` par défaut). **Ne pas** ajouter `nulls not distinct`. Trancher la divergence 02 ⟷ 06 ⟷ 08 **par écrit** avant l'exécution.

### 🔴 B6 — L'index unique actif verrouille le skill pendant `waiting_approval`

`06-migrations-draft.md:103-105` :

```sql
create unique index skill_runs_active_per_client_skill_idx
on public.skill_runs (client_id, skill_id)
where status in ('queued','running','waiting_approval');
```

`waiting_approval` est un état qui peut durer **des jours** (il attend qu'Étienne valide les brouillons dans le studio). Pendant tout ce temps :

- aucun nouveau run de ce skill n'est possible pour ce client (`23505`) ;
- et le trigger de garde interdit à `authenticated` de sortir de `waiting_approval` autrement que vers `canceled` (`06:123`).

L'owner est donc **contraint d'annuler** son run précédent (perdant la trace) pour en relancer un.

L'intention (« économise ~1,75 $ à chaque double-clic », `13-web-start-and-track.md`) est bonne. Mais elle ne vaut que pour `queued` et `running`, où le run est **réellement en cours de facturation**. Un run en `waiting_approval` a fini de coûter.

**Correctif :**

```sql
where status in ('queued','running')   -- retirer waiting_approval
```

Le ticket 13 mappe déjà `23505 → RUN_ALREADY_ACTIVE`, ce qui reste juste.

---

## 3. Majeurs — corriger avant d'exécuter

### 🟠 M1 — `waiting_approval → completed` : la condition est fausse

`12-worker-content-bridge.md:108-115` :

```sql
update public.skill_runs r set status = 'completed'
where r.status = 'waiting_approval'
  and not exists (
    select 1 from public.content_items ci
    where ci.skill_run_id = r.id and ci.status in ('draft','in_review')
  );
```

Trois défauts :

1. **`changes_requested` n'est pas couvert.** Le client a demandé des modifications → le contenu sort de `draft`/`in_review` → le run passe `completed` alors que le travail n'est pas fini.
2. **Un run stérile passe `completed`.** Si le LLM n'a produit aucun `content_item`, `not exists` est vrai immédiatement. Le run se déclare réussi sans rien avoir livré.
3. **Le soft-delete n'est pas filtré.** Un contenu `deleted_at` compte encore comme `draft`.

**Correctif :**

```sql
update public.skill_runs r set status = 'completed'
where r.status = 'waiting_approval'
  -- le run a produit au moins un contenu
  and exists (select 1 from public.content_items ci
              where ci.skill_run_id = r.id and ci.deleted_at is null)
  -- et aucun n'est encore en cours de traitement
  and not exists (
    select 1 from public.content_items ci
    where ci.skill_run_id = r.id
      and ci.deleted_at is null
      and ci.status in ('draft','in_review','changes_requested')
  );
```

Prévoir un statut terminal distinct pour le run stérile (`completed_empty`, ou `failed` + notification).

### 🟠 M2 — Le ticket 10 ne dit pas comment le worker se connecte

`rg "DATABASE_URL|createClient|service_role|postgres-js"` sur `10-worker-queue.md` → **aucun match**.

Le ticket impose « port 5432 » (règle 17) mais ne nomme ni la variable d'environnement, ni le driver, ni le rôle Postgres. C'est la **racine de B1** : personne n'a tranché « le worker parle-t-il à PostgREST ou à Postgres ? ».

**Correctif** : le ticket 10 doit spécifier explicitement `DATABASE_URL` (Supavisor session, `:5432`), le driver (`postgres-js` ou `pg`), et le rôle (`service_role` ou `postgres`). Sans ça, Codex improvisera — et improvisera probablement `createClient()` (PostgREST), ce qui viole la règle 17.

### 🟠 M5 — `unique (llm_idempotency_key)` ne protège **pas** de la double facturation. Le plan l'affirme.

`plans:90` : *« `unique (llm_idempotency_key)` → deux workers ne peuvent pas payer deux fois le même step. »*

**C'est faux.** Les steps sont créés par `INSERT … status='pending'` **sans clé** (`11:170`). La clé est ensuite posée par un `UPDATE` (`11:145`). Or `skill_run_steps` porte `unique (skill_run_id, step_index)` : deux workers sur le même step travaillent sur **la même ligne**. Un `UPDATE` qui écrit la valeur déjà présente **ne viole aucune contrainte unique**. L'index ne s'active jamais.

Ce qui empêche réellement la double facturation, c'est le **lease + la garde `worker_id`** du heartbeat. Et cette protection a un trou (M6).

**Correctifs :**

1. **Corriger l'affirmation dans le plan** — elle donne une fausse confiance :
   ```
   - `unique (llm_idempotency_key)` → garde-fou de collision (un bug de calcul ne peut pas
     réutiliser la clé d'un autre step). NE protège PAS de la double facturation : deux
     workers sur le même step UPDATE la même ligne. La protection anti-double-appel est
     le lease + la garde worker_id.
   ```

2. **Ajouter le vrai verrou** — un compare-and-swap atomique, gratuit :
   ```sql
   update public.skill_run_steps
   set status = 'running', llm_call_started_at = now(),
       llm_idempotency_key = $key, worker_id = $workerId
   where id = $stepId
     and status in ('pending','retrying')
     and llm_call_started_at is null      -- ← le CAS atomique
   returning id;
   -- rowCount = 0 → un autre worker a déjà démarré ce step. Abandonner, ne rien payer.
   ```

### 🟠 M6 — Heartbeat en erreur réseau ≠ lease perdu → double exécution possible

`10:80-85` : `renewLease(): Promise<boolean>`. Le ticket dit « retourne `false` si le run a changé de `worker_id` → le worker abandonne ». Mais **une erreur réseau ne retourne pas `false`, elle rejette**. Le ticket ne dit pas quoi en faire.

Scénario : W1 claim, exécute un appel Opus à `effort: xhigh` (plusieurs minutes). À t=300 s le heartbeat échoue — pas parce que le run est volé, mais parce que la connexion Postgres est morte (redémarrage Supavisor, `ECONNRESET`). Codex écrira l'une des deux implémentations, toutes deux fausses :

- `try { await renewLease() } catch { /* on retentera */ }` → le lease expire, le reaper requeue, **W2 reprend le step pendant que W1 attend toujours `finalMessage()`**. W1 revient et écrit `status='succeeded'` sur un step que W2 a repris. **Deux appels payés, écriture corrompue.**
- `renewLease` retourne `false` sur erreur → le worker abandonne à la première micro-coupure. Disponibilité en carton.

**Aggravant :** l'`UPDATE skill_run_steps SET status='succeeded'` (`11:149`) n'a **aucune garde `worker_id`** — la table ne porte même pas cette colonne. Rien n'empêche un zombie d'écraser le travail du repreneur.

**Correctif — trois états + fencing token :**

```ts
export type LeaseState = "renewed" | "lost" | "unknown"
// "renewed" : rowCount === 1
// "lost"    : rowCount === 0  → un autre worker détient le run. ABANDON IMMÉDIAT.
// "unknown" : la requête a rejeté (réseau). Retry 3× à 5 s (= 15 s ≪ lease de 600 s).
//             Trois "unknown" consécutifs → traiter comme "lost".
```

Et **ajouter `worker_id text` à `skill_run_steps`**, écrit au passage en `running`, avec garde sur l'écriture finale :

```sql
update public.skill_run_steps
set status='succeeded', llm_message_id=$1, …
where id = $2 and worker_id = $3 and status = 'running'
returning id;
-- rowCount = 0 → step volé. Journaliser 'step_stolen', abandonner. Ne pas throw.
```

C'est le **fencing token**. Le lease seul ne suffit jamais.

### 🟠 M7 — Le reaper : pas de `SKIP LOCKED`, pas de `LIMIT`

`10:88-102`. **Bonne nouvelle** : la race avec le heartbeat est correcte par construction. En `READ COMMITTED`, si le reaper commit d'abord, le heartbeat re-évalue son `WHERE worker_id = $2` sur la version committée (le reaper a mis `worker_id = null`) → 0 ligne → `lost` → le worker abandonne. Si le heartbeat commit d'abord, le reaper re-évalue `lease_expires_at < now()` → faux → 0 ligne.

**Mais cette correction repose entièrement sur `worker_id = null` dans le reaper, et ce n'est documenté nulle part.** Un futur agent qui « optimise » en gardant `worker_id` casse tout silencieusement.

Ce qui manque vraiment : `for update skip locked` + `limit`. Sans eux, deux workers qui reapent au même tick se bloquent sur les verrous de ligne. Avec 200 runs expirés (un incident Anthropic 529 qui a tout fait échouer), le second worker est gelé pendant tout le reap.

```sql
with expired as (
  select id from public.skill_runs
  where status = 'running' and lease_expires_at < now()
  order by lease_expires_at
  for update skip locked
  limit 20                       -- borner le tick de 5 s
)
update public.skill_runs r
set status = case when r.attempts >= r.max_attempts then 'failed' else 'queued' end,
    claimed_at = null, lease_expires_at = null,
    worker_id = null,            -- ⚠️ NE PAS RETIRER : c'est la garde qui fait perdre
                                 --    la course au heartbeat concurrent.
    run_at = now() + (interval '1 second' * least(300, power(2, r.attempts) * 15))
                   + (interval '1 second' * floor(random() * 20)),
    error_history = r.error_history || jsonb_build_object('class','lease_expired','at',now())
from expired e where r.id = e.id;
```

### 🟠 M8 — Le `check` de `skill_run_steps` autorise `succeeded` avec `output IS NULL`

`06:87` : `check (status <> 'succeeded' or llm_message_id is not null)`.

Il empêche `succeeded` sans preuve d'appel. Il n'empêche **pas** `succeeded` avec `output IS NULL` ni `cost_micros IS NULL`. Or le pont (ticket 12) fait `copyAssetSchema.parse(step.output)` → **throw sur `null`**, le run meurt en `running` après avoir tout payé. Et la comptabilité (`sum(cost_micros)`) devient silencieusement fausse.

```sql
check (
  status <> 'succeeded'
  or (llm_message_id is not null and output is not null
      and cost_micros is not null and finished_at is not null)
)
```

C'est l'invariant que le pont **et** la comptabilité supposent tous les deux, et que personne n'écrit.

### 🟠 M9 — Le `check` du chemin Storage autorise le path traversal

`06:93` : `check (storage_path is null or storage_path like (org_id::text || '/' || … || '/%'))`

`'{org}/{client}/{run}/../../other-org/leak.json'` **passe le CHECK** : le préfixe est bon, le `%` avale le reste. Et `storage.foldername()` split sur `/` → `[1]`/`[2]` restent corrects → **la policy du bucket autorise la lecture**. La faille est dans le CHECK, pas dans la policy.

Second problème : si `skill_run_id` était nullable, la concaténation vaudrait `NULL`, `x like NULL` vaudrait `NULL`, et **un CHECK qui vaut `NULL` passe** (seul `false` rejette). Le ticket ne pose jamais `skill_run_id uuid not null` sur `skill_artifacts`.

```sql
skill_run_id uuid not null,   -- sinon le check devient NULL ⇒ no-op silencieux
constraint skill_artifacts_storage_path_shape check (
  storage_path is null
  or storage_path ~ ('^' || org_id::text || '/' || client_id::text || '/'
                         || skill_run_id::text || '/[A-Za-z0-9._-]+$')
)
```

La classe de caractères **exclut `/`** et l'ancrage `^…$` rend le traversal impossible. Les UUID ne contiennent aucun métacaractère regex.

### 🟠 M10 — Le trigger doit utiliser `is distinct from`, pas `<>`

Piège classique, non mentionné par le ticket 06. `NULL <> NULL` vaut `NULL` → `if NULL then` ne prend pas la branche. Un owner pourrait poser `claimed_at = now()` sur un run où `claimed_at IS NULL` **sans être bloqué**.

Utiliser `new.claimed_at is distinct from old.claimed_at` partout. Et **tester ce cas** en pgTAP (`throws_ok` sur un run à `claimed_at IS NULL`).

### 🟠 M11 — Le pont Storage : orphelin invisible si rollback

`12:45` (« dans une seule transaction ») + `12:78` (upload API Storage) + `06:92` (`num_nonnulls(content, storage_path) = 1`, donc `storage_path` connu **à l'INSERT**) + le chemin contient `artifact_id` (qui n'existe **qu'après** l'INSERT) → **circularité**.

Résolue en générant l'UUID côté worker, mais alors : upload OK + transaction rollback → **fichier orphelin dans `skill-artifacts`, non référencé, non nettoyable par SQL (règle 23), invisible de tout inventaire.**

**Bonne nouvelle** : les deux chemins ne se croisent jamais. `check (kind = 'copy_asset' or materialized_content_item_id is null)` (`06:94`) → seuls les `copy_asset` matérialisent, et un `copy_asset` fait quelques centaines d'octets → **toujours inline**. Le pont transactionnel est légitime.

**Mais le ticket ne le dit pas**, et Codex lisant « dans une seule transaction » suivi de « upload via l'API Storage » écrira le mauvais code.

**Correctif minimal** — écrire en tête du ticket 12 :
> ⚠️ Le pont `copy_asset → content_items` est **toujours inline** (`content jsonb`). Aucun appel HTTP dans cette transaction : la règle 18 est respectée **par construction**, pas par vigilance. Les artifacts longs (`campaign_report`, `content_calendar`) ne matérialisent jamais de `content_item` et suivent le chemin upload-puis-insert, hors de toute transaction ouverte. **Ne jamais fusionner les deux chemins.**

**Correctif complet** (recommandé) — colonne `upload_state` (`inline` | `pending` | `uploaded`) + reaper d'artifacts : `upload_state='pending' and created_at < now() - interval '15 min'` → retry l'upload (chemin déterministe, `upsert:true`) ou purge. **Le fichier orphelin devient une ligne DB détectable**, pas un octet invisible.

### 🟠 M12 — `get_advisors` n'existe pas en local

`09:44` et `09:81` prescrivent `get_advisors` après la migration. Mais `config.toml:1` → `project_id = "ocean-local"`, aucun projet distant lié. **`get_advisors` est un endpoint Management API sur projet hébergé.** En local, il n'existe pas.

Le ticket 09 prescrit donc une vérification qui ne tournera pas. Équivalent local :

```sql
-- tables sans RLS
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- tables RLS sans policy (deny-all involontaire)
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

-- SECURITY DEFINER sans search_path figé
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef
  and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
```

La dernière requête aurait attrapé un `SECURITY DEFINER` mal configuré. **À mettre dans le ticket 09 en remplacement de `get_advisors`.**

### 🟠 M13 — Le `plan(9)` du ticket 07 est auto-contradictoire, et le plan réel est ~15

- `07:107` exige `plan(9)`. `07:74` impose « vérifier au passage qu'un `update … set status='canceled'` **passe** » → 10ᵉ assertion. **`supabase test db` échouera sur `Looks like you planned 9 tests but ran 10`.**
- **Aucune assertion sur `skills`** : personne ne teste qu'un `authenticated` ne peut pas écrire `manifest_path`. C'est *le* vecteur de path traversal, la justification même de D-1 (`skills` sans `org_id`). Le test le plus important du lot n'existe pas.
- **Aucune assertion sur `storage.objects`** : la policy `storage.foldername(name)[1] = org_id` n'est jamais testée. Un `[1]` au lieu de `[2]` passe la revue et fuit.
- **Aucune assertion** prouvant qu'un owner de l'org A ne lit pas les `skill_run_steps` de l'org B.
- **Assertion 4** : `throws_ok '42501'` sur `insert skill_run_steps`. Mais « pas de grant » et « pas de policy » donnent le **même SQLSTATE**. Le test ne distingue pas les deux causes → utiliser `throws_matching(…, 'permission denied')`.

### 🟠 M14 — `alter publication supabase_realtime` cassera `db reset`

`06:128`. La publication `supabase_realtime` **n'existe pas** dans une base locale fraîche avant que le service Realtime ne la crée. `supabase db reset` joue les migrations **avant** → `ERROR: publication "supabase_realtime" does not exist`. Aucune migration 001–007 ne touche à Realtime → ce serait la première, sans précédent dans le repo.

De plus, la publication diffuse **toutes les colonnes** par défaut — y compris `skill_runs.context_snapshot`, qui contient le brand kit du client. Le ticket 13 s'inquiète de `skill_run_steps.input/output` mais laisse passer `context_snapshot`. Incohérence.

```sql
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.skill_runs
  (id, org_id, client_id, status, attempts, total_cost_micros, updated_at);
```

### 🟠 M15 — Corrections mineures sur l'API Claude (ticket 11)

- **`timeout: 600_000` = durée exacte du lease (10 min).** Course serrée : si un heartbeat rate silencieusement, le reaper vole le run *pendant* l'appel. **Descendre à `480_000`** (8 min) pour garantir que l'appel meurt avant tout risque de vol.
- **`metadata: { user_id: idempotencyKey }`** (`11:110`) : la clé change à chaque retry → chaque appel ressemble à un utilisateur distinct. Anthropic utilise `metadata.user_id` pour la détection d'abus. Le plan l'appelle « forensics de facturation », mais la console n'expose pas ce champ. **Bénéfice spéculatif, risque de flag anti-abus.** Utiliser `sha256(orgId)`, stable par org.
- **`thinking.display` défaut `"omitted"` sur Opus 4.8** : les blocs `thinking` reviennent vides, **mais sont facturés en `output_tokens`**. `cost.ts` doit le savoir — ne pas s'étonner d'un coût supérieur à la longueur du JSON produit.
- **`cost.ts` interdit les floats mais ne donne pas la formule.** Codex écrira du float. La fournir :
  ```ts
  const INPUT_NANO = 5n, OUTPUT_NANO = 25n   // $5 / $25 par M tokens
  const nano = BigInt(u.input_tokens) * INPUT_NANO
    + BigInt(u.cache_creation_input_tokens) * INPUT_NANO * 125n / 100n  // 1.25×
    + BigInt(u.cache_read_input_tokens)     * INPUT_NANO * 10n  / 100n  // 0.10×
    + BigInt(u.output_tokens) * OUTPUT_NANO
  export const costMicros: bigint = nano / 1000n
  ```
- **Pas de `count_tokens` préventif.** Un `context_snapshot` trop gros → `413 request_too_large`, classé permanent (correct) — mais **après avoir payé le step 0**. `POST /v1/messages/count_tokens` est **gratuit** : valider avant le premier appel, `failed` immédiat si > 900 K, zéro dollar dépensé.

### 🟠 M3 — Aucun trigger de garde sur `skill_run_steps`

`skill_run_steps` porte `llm_call_started_at` et `llm_message_id` — les deux colonnes sur lesquelles repose **toute** l'idempotence D-2.

Elle est protégée par `grant select` seul (pas de policy write). C'est le précédent `notifications`, cohérent. Mais si un `grant update` fuit un jour (comme le test 005 le simule volontairement pour les secrets), `llm_call_started_at` devient falsifiable et l'idempotence saute.

**Recommandation** : ajouter un `check (llm_call_started_at is null or llm_idempotency_key is not null)` et, à terme, un trigger de garde symétrique. Mineur tant que les grants tiennent, mais la ceinture ne coûte rien.

---

## 4. Mineurs / vigilance

- **`skill_runs` : `check (attempts >= 0 and attempts <= 5)`** en dur, alors que `publish_jobs` (mon guardrail) utilise une colonne `max_attempts`. Divergence de convention entre les deux files. Pas un bug ; à harmoniser.
- **`check (storage_path like (org_id::text || '/' || ...))`** (`06:93`) : correct — un CHECK peut référencer plusieurs colonnes de la même ligne, et `NULL like ...` vaut `NULL`, donc la contrainte passe quand `storage_path is null`. Le `num_nonnulls(content, storage_path) = 1` garantit l'exclusivité. **Vérifié, pas de bug.**
- **`alter type notification_type add value`** isolé dans son propre fichier : correct pour PG 15 (non transactionnel). Le plan le signale (`06` étape 5). ✅
- **Le trigger de garde échappe à `get_advisors`** : le plan le dit explicitement (`08-sql-review.md` item (c)) et exige un test pgTAP. Lucidité rare. ✅ — mais voir B1 : le test existant teste le mauvais chemin.

---

## 5. Guardrails SaaS — état après cet audit

Rappel des trous du Lot 0 (audit précédent), toujours ouverts :

| ID | Sujet | Statut |
|---|---|---|
| GUARD-00 | `has_org_access` ferme le cross-org, laisse ouvert le **cross-client** ; le test 007 ne contient aucun `client_members` | 🔴 ouvert |
| GUARD-00-bis | Trigger de transition `content_items.status` — sans lui, `PATCH {"status":"published"}` saute l'approbation | 🔴 ouvert |
| GUARD-01 | `content_targets` sans aucune contrainte `UNIQUE` → chemin vers la double publication | 🔴 ouvert |
| GUARD-04 | Soft-delete non filtré par RLS + fuite portail (`getPortalContentItem`) | 🔴 ouvert |
| GUARD-05 | Aucune CI → les 5 fichiers pgTAP ne tournent nulle part | 🔴 ouvert |

**Correction d'un point de mon audit précédent** : les 2 P1 de `lot-0-sql-review.md` sont **déjà corrigés dans le working tree**, non commités (`git diff` sur 004, 007, test 007). Le rapport archivé dit « STOP » alors que le disque dit « corrigé ». C'est un risque en soi (un `git stash` réintroduit la fuite).

**Le trigger de garde `publish_jobs` que j'ai proposé (GUARD-11) est affecté par B1** — il utilise la même détection `request.jwt.claims`. À corriger avec `current_user` **avant** que le Lot 2 ne l'implémente.

---

## 6. Tickets correctifs à créer

Format : convention `docs/superpowers/tickets/lot-5/`.

### `LOT5-06b` — Corriger la détection `service_role` du trigger de garde 🛑🔴
- **Objectif** : remplacer `current_setting('request.jwt.claims',…)` par `current_user in ('service_role','postgres')` (+ claim JWT en filet), dans `skill_runs_guard_queue_columns()` **et** dans le futur `publish_jobs_guard()`.
- **Critères** : un `UPDATE skill_runs set claimed_at=now()` sous `set local role service_role` → **passe**. Sous `authenticated` → `42501`.
- **Tests minimums** : ajouter un `lives_ok` service_role à `07-pgtap-draft.md`. **Sans lui le correctif régressera.**
- **Risque couvert** : B1 — le worker ne peut ni claim, ni heartbeat, ni compléter. Le Lot 5 ne démarre pas.

### `LOT5-06c` — Remplacer les `on delete set null` sur FK composites 🛑🔴
- **Objectif** : PG 15 ne permet pas `on delete set null (colonne)`. Les 3 FK composites concernées mettraient `client_id` (NOT NULL) à NULL → `23502`.
- **Scope** : `content_items.skill_run_id`, `skill_artifacts.skill_run_step_id`, `skill_artifacts.materialized_content_item_id`.
- **Décision à trancher** : `on delete restrict` (recommandé) vs trigger `BEFORE DELETE`.
- **Tests minimums** : `lives_ok('delete from skill_runs where id = …')` après nettoyage ; ou `throws_ok('23503')` si `restrict`.
- **Risque couvert** : B2 — impossible de supprimer un `skill_run`, un `skill_run_step` ou un `content_item` lié.

### `LOT5-06d` — Retirer `waiting_approval` de l'index unique actif
- **Objectif** : `where status in ('queued','running')`. Un run en attente d'approbation ne coûte plus rien et ne doit pas verrouiller le skill.
- **Tests minimums** : 2 runs successifs, le 1er en `waiting_approval` → le 2e s'insère (`lives_ok`). Un 2e run pendant `running` → `23505`.
- **Risque couvert** : B3 — blocage produit potentiellement de plusieurs jours, sortie uniquement par `canceled`.

### `LOT5-12b` — Corriger la condition `waiting_approval → completed`
- **Objectif** : couvrir `changes_requested`, exiger au moins un `content_item` vivant, filtrer `deleted_at`.
- **Risque couvert** : M1 — run déclaré `completed` alors que le client a demandé des modifs, ou qu'aucun contenu n'a été produit.

### `LOT5-10b` — Spécifier la connexion DB du worker
- **Objectif** : nommer `DATABASE_URL` (Supavisor session `:5432`), le driver, et le rôle Postgres. Interdire explicitement `createClient()` (PostgREST) dans `apps/worker`.
- **Critères** : `rg "createClient|SUPABASE_URL" apps/worker` → aucun match. `rg "6543" apps/worker` → aucun match.
- **Risque couvert** : M2 — racine de B1. Sans spécification, Codex improvisera PostgREST.

---

## 7. Tableau récapitulatif

| Sév. | # | Fichier:ligne | Ce qui casse |
|---|---|---|---|
| 🔴 | B1 | `06:121-126` + `10:46-62` | Trigger de garde refuse le claim du worker (`request.jwt.claims` = NULL en connexion directe). **Le worker ne démarre jamais.** Le test pgTAP ne le voit pas. |
| 🔴 | B2 | `06` étape 6 + `06:91` (×3) | `on delete set null` sur FK composite → `23502` sur `client_id NOT NULL`. Run/step/contenu indestructibles. |
| 🔴 | B3 | `10:56,90` + `11` | `max_attempts` n'existe pas → `42703`. Et `check (attempts<=5)` → `23514` au 6ᵉ claim → run zombie. |
| 🔴 | B4 | `10:53`, `11:152`, `12:79` | `started_at` / `finished_at` utilisés, jamais créés → `42703`. |
| 🔴 | B5 | `06:84` ⟷ `02:62` ⟷ `11:170` | `llm_idempotency_key not null` mais les steps sont insérés sans clé → `23502`. Trois docs se contredisent. |
| 🔴 | B6 | `06:103-105` + `12:106` | Run coincé en `waiting_approval` → l'index unique bloque **à jamais** la relance du skill pour ce client. Aucun message, aucune Server Action `cancel`. |
| 🟠 | M5 | `plans:90` | `unique (llm_idempotency_key)` ne protège **pas** de la double facturation (UPDATE, pas INSERT). Le plan l'affirme. |
| 🟠 | M6 | `10:80-85` + `11:149` | Heartbeat en erreur réseau ≠ lease perdu. Pas de fencing sur l'écriture du step → zombie écrase le repreneur. Double exécution. |
| 🟠 | M7 | `10:88-102` | Reaper sans `SKIP LOCKED` ni `LIMIT` → contention. La correction de la race repose sur `worker_id = null`, non documenté. |
| 🟠 | M8 | `06:87` | `check` autorise `succeeded` avec `output IS NULL` → le pont crash après avoir tout payé. |
| 🟠 | M9 | `06:93` | Le `check` du chemin Storage autorise `../../other-org/` (path traversal). |
| 🟠 | M10 | `06:124` | Trigger doit utiliser `is distinct from`, pas `<>` (piège NULL). |
| 🟠 | M11 | `12:45` + `12:78` | Upload Storage + transaction : orphelin invisible si rollback. Évitable, mais le ticket ne le dit pas. |
| 🟠 | M12 | `09:44,81` | `get_advisors` n'existe pas en local (pas de projet distant lié). |
| 🟠 | M13 | `07:74` ⟷ `07:107` | `plan(9)` auto-contradictoire. Et aucun test sur `skills`, `storage.objects`, `skill_run_steps` cross-org. Plan réel ≈ 15. |
| 🟠 | M14 | `06:128` | `alter publication supabase_realtime` cassera `db reset` (publication inexistante en local). |
| 🟠 | M1 | `12:108-115` | `waiting_approval → completed` : `changes_requested` non couvert, run stérile passe `completed`, `deleted_at` ignoré. |
| 🟠 | M2 | `10` | Le ticket ne dit pas comment le worker se connecte. Racine de B1. |
| 🟠 | M15 | `11:71,110,176` | `timeout` = durée du lease ; `metadata.user_id` instable ; formule `cost.ts` absente ; pas de `count_tokens` préventif. |

**Deux tickets ne peuvent pas être exécutés tels quels : le 10 et le 12.** Le 11 est le mieux écrit des trois.

---

## 8. Ordre d'exécution recommandé

**Avant toute exécution SQL (le coût est nul maintenant) :**

1. **GUARD-09** — commiter les fixes P1 du Lot 0 (working tree, non commités)
2. **GUARD-00** — cross-client `notifications` + test avec `client_members`
3. **GUARD-00-bis** — trigger de transition `content_items.status`
4. **GUARD-01** — contraintes `UNIQUE` sur `content_targets`
5. **GUARD-04** — soft-delete RLS + fuite portail
6. **GUARD-05** — CI (valide rétroactivement 1→5)

**Avant d'ouvrir le Lot 5** (sa gate 01 est de toute façon rouge : `apps/worker`, `approvals`, `brand_kits` absents) :

7. **`LOT5-06b`** (détection `session_user`) — **et le même correctif dans GUARD-11 `publish_jobs`**
8. **`LOT5-06c`** (FK composites, `on delete set null (colonne)`)
9. **`LOT5-06e`** (`max_attempts`, `started_at`, `finished_at`, `llm_idempotency_key` nullable) — *sinon le ticket 10 ne compile pas*
10. **`LOT5-06d`** (index unique sans `waiting_approval`) + Server Action `cancelSkillRun`
11. `LOT5-10b` (connexion worker), `LOT5-11b` (fencing token + `LeaseState`)
12. `LOT5-12b` (condition de complétion), `LOT5-07b` (`plan(15)`, tests worker/`skills`/storage)

**Étape 0, avant tout** : installer un Postgres local (`supabase start`) et **reproduire B1 et B2**. Ce sont deux commandes.

---

## 9. Reproduire les bloquants (étape 0)

Sans Postgres, ces findings restent des lectures. Avec `supabase start`, ce sont deux commandes.

**Reproduire B1** (le trigger bloque le worker) — après avoir joué les migrations Lot 5 :

```bash
# Exactement ce que fait le worker : connexion Postgres directe, aucun PostgREST.
psql "$DATABASE_URL" -c \
  "update public.skill_runs set status='running', claimed_at=now(),
     lease_expires_at=now()+interval '10 min', worker_id='probe', attempts=attempts+1
   where id=(select id from public.skill_runs limit 1);"
# Attendu si le bug existe : ERROR 42501 — skill_runs: queue columns are worker-owned
# Attendu après correctif : UPDATE 1
```

**Reproduire B2** (`on delete set null` sur FK composite) :

```sql
insert into public.content_items (org_id, client_id, skill_run_id, …) values (…, '<run>');
delete from public.skill_runs where id = '<run>';
-- Attendu si le bug existe : ERROR 23502 null value in column "client_id"
-- Attendu après correctif : DELETE 1, et content_items.client_id reste NON NULL
```

**Reproduire B3** (`max_attempts`) — sans même une base :

```bash
rg -c "max_attempts" docs/superpowers/tickets/lot-5/06-migrations-draft.md   # → 0
rg -c "max_attempts" docs/superpowers/tickets/lot-5/10-worker-queue.md       # → 4
```

**Vérifier que le ticket 09 ne peut pas attraper ces bugs** : il ne teste ni le chemin worker, ni un `DELETE` de run, et `get_advisors` n'existe pas en local (M12).

---

## 10. Ce que cet audit dit du processus

Deux fois de suite, sur deux lots différents, le même angle mort :

- Lot 0 : `has_org_access` — le test ne crée aucun `client_members`, donc la fuite cross-client ne peut pas échouer.
- Lot 5 : le trigger de garde — le test pose toujours `role: authenticated`, donc le blocage du worker ne peut pas échouer.

**Règle à ajouter au CLAUDE.md §7** :

> Tout test d'une garde (policy, trigger, contrainte) doit couvrir **les deux chemins** : celui qui doit échouer (`throws_ok`) **et** celui qui doit passer (`lives_ok`). Un test qui ne prouve que le refus ne prouve rien sur l'autorisation.

C'est la seule règle de cet audit qui empêchera le prochain bug de la même famille.
