# Ticket LOT5-07 — Tests pgTAP Lot 5 en **brouillon**

## Ticket ID
`LOT5-07`

## Objectif
Écrire les **leak tests pgTAP** des tables Lot 5 et du pont `content_items.skill_run_id`. Neuf assertions minimum, dont **deux couvrent le trigger de garde** — le seul mécanisme du lot qui échappe à `get_advisors`. **Aucun test n'est exécuté** ici : on écrit du SQL relu au ticket 08, joué au ticket 09.

## Pré-requis
- `LOT5-06` committé (les 6 migrations en brouillon existent).

## Contexte minimal à donner à Codex
- Gabarit exact à répliquer : `supabase/tests/006_content_core.test.sql`.
- Squelette imposé :
  ```sql
  begin;
  create extension if not exists pgtap with schema extensions;
  select plan(N);
  -- seed complet : auth.users, organizations, organization_members, clients, client_members, …
  set local role authenticated;
  set local request.jwt.claim.sub = '<uuid>';
  set local "request.jwt.claims" = '{"sub":"<uuid>","role":"authenticated"}';
  -- assertions …
  reset role;
  select * from finish();
  rollback;
  ```
- **Pas de helper partagé.** Chaque fichier réinjecte son propre seed complet. Zéro fonction utilitaire, zéro `_setup.sql`. C'est la convention du repo.
- **Convention d'UUID** : `X0000000-0000-4000-8000-0000000000NN` où `X` encode l'entité (`0` = user, `1` = organization, `2` = client, `3` = platform_connection, `4` = social_account, `5` = content_item) et `NN` = le numéro de la migration testée. Emails de seed : `lot5-0NN-owner-a@example.test`.
- **Double écriture de la claim** (`request.jwt.claim.sub` legacy **et** `request.jwt.claims` JSON) pour que `auth.uid()` résolve.
- Le Reviewer est un **vrai user sans appartenance org**, uniquement dans `client_members`.

**Le point crucial :**
Le trigger `private.skill_runs_guard_queue_columns()` lit le rôle depuis `current_setting('request.jwt.claims', true)::jsonb ->> 'role'`. Les assertions qui le testent **doivent** poser `set local "request.jwt.claims" = '{"sub":"…","role":"authenticated"}'` — pas seulement `set local role authenticated`.

## Fichiers autorisés (création uniquement)
- `supabase/tests/0NN_skill_runs.test.sql`
- `supabase/tests/0NN_content_items_skill_run.test.sql`

(`0NN` = le numéro de la migration correspondante, écrit au ticket 06.)

## Fichiers interdits
- `supabase/migrations/**` (figées au ticket 06).
- `apps/**`, `packages/**`, `docs/**`.
- Toute exécution : pas de `supabase test db`, pas de `supabase start`, pas de `pg_prove`. **On écrit, on ne joue pas.**

## Étapes attendues

### 1. `0NN_skill_runs.test.sql` — `plan(9)`

**Seed** (dans cet ordre) : 3 `auth.users` (owner A, owner B, reviewer), 2 `organizations`, 2 `organization_members`, 3 `clients` (A1, A2 sous org A ; B1 sous org B), 1 `client_members` (reviewer → A1), 1 ligne `skills` (le catalogue est seedé par la migration, mais le test doit pouvoir s'y référer), 3 `skill_runs` (A1, A2, B1) avec `status = 'queued'`, 2 `skill_run_steps`, 2 `skill_artifacts`.

**Assertions** (les libellés doivent être explicites) :

1. **`results_eq` — org B ne lit pas les runs d'org A**
   Rôle = owner B. `select count(*) from public.skill_runs where org_id = '<org A>'` → `0`.

2. **`results_eq` — reviewer client 1 lit les runs de son client**
   Rôle = reviewer. `where client_id = '<client A1>'` → `1`.

3. **`results_eq` — reviewer client 1 ne lit pas les runs du client 2**
   Rôle = reviewer. `where client_id = '<client A2>'` → `0`.

4. **`throws_ok '42501'` — `authenticated` ne peut pas insérer un `skill_run_step`**
   Rôle = owner A. `insert into public.skill_run_steps (…)`. Aucun grant `insert` → `42501`.
   > Poser `grant select on public.skill_run_steps to authenticated;` **avant** ne change rien : sans grant `insert`, l'insertion échoue. Ne pas ajouter de grant dans le test.

5. **`throws_ok '42501'` — le trigger de garde bloque `claimed_at`**
   Rôle = owner A, avec `"request.jwt.claims"` posé (`role: authenticated`).
   `update public.skill_runs set claimed_at = now() where id = '<run A1>'` → `42501`.

6. **`throws_ok '42501'` — le trigger de garde bloque `status = 'completed'`**
   Même rôle. `update public.skill_runs set status = 'completed' …` → `42501`.
   (Vérifier au passage qu'un `update … set status = 'canceled'` **passe** : c'est la seule transition autorisée à l'owner.)

7. **`throws_ok '23505'` — un seul run actif par `(client, skill)`**
   Rôle = owner A. Insérer un 2ᵉ `skill_run` `queued` sur le même `(client_id, skill_id)` → viole `skill_runs_active_per_client_skill_idx`.

8. **`throws_ok '23514'` — artifact avec `content` ET `storage_path`**
   Rôle = `service_role` (ou hors RLS). Viole `check (num_nonnulls(content, storage_path) = 1)`.
   Tester aussi le cas **ni l'un ni l'autre** → même `23514`.

9. **`results_eq` — un `authenticated` ne lit pas les artifacts d'un autre client**
   Rôle = reviewer (client A1). `select count(*) from public.skill_artifacts where client_id = '<client A2>'` → `0`.

### 2. `0NN_content_items_skill_run.test.sql` — `plan(2)`

**Seed** : 2 orgs, 2 clients (A1 sous org A, B1 sous org B), 2 `skill_runs` (un par client), 1 `content_item` sous A1.

1. **`throws_ok '23503'` — cross-client par FK composite**
   Rôle = owner A. `update public.content_items set skill_run_id = '<run du client B1>' where id = '<content_item A1>'` → la FK composite `(skill_run_id, client_id)` échoue en `23503`.

2. **`lives_ok` — le pont légitime fonctionne**
   `update public.content_items set skill_run_id = '<run du client A1>' where id = '<content_item A1>'` → passe.

### 3. Ne pas casser l'existant
Les tests `006_content_core.test.sql` ne doivent **pas** être modifiés. Vérifier (sans les exécuter) que l'`alter table content_items add column skill_run_id` ne les casse pas :
- les 3 `insert into public.content_items (…)` **nomment leurs colonnes** ✅
- `plan(6)` inchangé ✅
- le `throws_ok('23503')` porte sur `content_targets`, pas `content_items` ✅

Le consigner dans le message de commit.

## Critères d'acceptation
- [ ] Les 2 fichiers existent, nommés `0NN_skill_runs.test.sql` et `0NN_content_items_skill_run.test.sql`.
- [ ] Chaque fichier suit le squelette `begin; … plan(N); … reset role; select * from finish(); rollback;`.
- [ ] `plan(9)` et `plan(2)` — le nombre d'assertions correspond exactement.
- [ ] Chaque fichier réinjecte son **seed complet** (aucun helper partagé, aucune dépendance à un autre test).
- [ ] Les UUID suivent la convention `X0000000-…-0000000000NN`.
- [ ] Les assertions 5 et 6 posent `set local "request.jwt.claims" = '{"sub":"…","role":"authenticated"}'` — sinon le trigger de garde ne lit pas le rôle.
- [ ] L'assertion 6 vérifie **aussi** qu'un `status = 'canceled'` passe (la seule transition autorisée).
- [ ] Aucun `grant` n'est ajouté dans les tests pour contourner une absence de policy.
- [ ] `supabase/tests/006_content_core.test.sql` est **inchangé**.
- [ ] Aucun fichier sous `supabase/migrations/`, `apps/`, `packages/`.
- [ ] **Aucun test n'a été exécuté.**

## Commandes de validation
```powershell
# Les 2 fichiers existent
Get-ChildItem -LiteralPath 'supabase\tests' -Filter '*skill*' | Select-Object Name

# Le squelette est respecte
Select-String -Path 'supabase\tests\*skill*.test.sql' -Pattern 'begin;|select plan\(|reset role;|rollback;'

# Le trigger de garde est bien teste (42501) et la FK composite (23503)
rg "42501" supabase\tests\*skill_runs.test.sql          # attendu : au moins 3 matchs (assertions 4,5,6)
rg "23503" supabase\tests\*content_items_skill_run.test.sql
rg "23505|23514" supabase\tests\*skill_runs.test.sql

# La claim JSON est posee pour les tests du trigger
rg 'request.jwt.claims' supabase\tests\*skill_runs.test.sql

# Le test 006 existant n'a pas bouge
git diff --exit-code supabase/tests/006_content_core.test.sql

# Aucun grant de contournement
rg "^grant" supabase\tests\*skill*.test.sql             # attendu : aucun match

# Rien n'a ete execute (aucun conteneur supabase local)
supabase status                                          # attendu : "not running" ou equivalent
```

## Risques / points d'attention
- **Le trigger de garde est le point aveugle du lot.** Il n'est pas une policy → `get_advisors` ne le signalera jamais. Les assertions 5 et 6 sont donc **le seul filet** contre une double facturation LLM déclenchée par un owner (volontairement ou par bug d'UI). Ne pas les sacrifier si le `plan(N)` est pénible à tenir.
- **Le trigger lit le rôle depuis la claim JSON, pas depuis `current_user`.** Un test qui pose seulement `set local role authenticated` sans la claim verra le trigger considérer le rôle comme absent → comportement imprévisible. Poser les deux.
- **`throws_ok` teste une erreur, `results_eq` teste une absence de ligne.** Une policy RLS manquante ne lève pas d'erreur : elle renvoie 0 ligne. Utiliser `results_eq(… count(*) …, 0)` pour la lecture, `throws_ok` pour les contraintes (`23503`, `23505`, `23514`) et les grants (`42501`).
- **L'assertion 4 ne doit pas ajouter de `grant`.** Les tests `005`/`006` font `grant select on … _secrets to authenticated` **exprès**, pour prouver que la RLS tient même avec le grant. Ici, c'est l'inverse : c'est l'absence de `grant insert` qu'on teste. Ne pas la neutraliser.
- **Ne PAS exécuter les tests.** `supabase test db` est le ticket 09, après feu vert. Écrire du SQL de test, c'est écrire du texte.
- Si `plan(9)` s'avère faux (une assertion en produit deux), corriger le `plan(N)`, jamais retirer une assertion.

## Résultat attendu
Deux fichiers de leak test pgTAP en brouillon, couvrant l'isolation org/client, l'absence d'écriture cliente sur les steps, le trigger de garde, l'anti-doublon, le XOR inline/storage, et la FK composite du pont.

## Message de commit suggéré
```
test(lot-5-draft): tests pgTAP leak-test Lot 5 (skill_runs + pont content_items)

plan(9) sur skill_runs : isolation org A/B, isolation reviewer client 1/2,
authenticated ne peut pas insérer de step (42501), trigger de garde bloque
claimed_at et status='completed' (42501) mais laisse passer 'canceled',
anti-doublon (23505), artifact inline XOR storage (23514).
plan(2) sur le pont : FK composite cross-client (23503) + cas legitime.
Verifie : 006_content_core.test.sql inchange (colonnes nommees, plan(6)).
NON execute.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-08` démarre seulement une fois ce commit fait.
