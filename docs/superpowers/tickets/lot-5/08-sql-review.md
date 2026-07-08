# Ticket LOT5-08 — Relire le SQL avec checklist

## Ticket ID
`LOT5-08`

## Objectif
Relire les 6 migrations et les 2 tests pgTAP du Lot 5 contre une checklist, et produire `docs/architecture/lot-5-sql-review.md`. **Aucun SQL n'est corrigé dans ce ticket** : on consigne les anomalies, on classe P1/P2, et on s'arrête.

## Pré-requis
- `LOT5-06` committé (6 migrations en brouillon).
- `LOT5-07` committé (2 tests pgTAP en brouillon).

## 🛑 Pré-condition bloquante
Ce ticket se termine par une **gate**. Codex produit le rapport, s'arrête, et attend qu'Étienne le valide — ou renvoie en `LOT5-06`.

## Contexte minimal à donner à Codex
- Gabarit du rapport : `docs/architecture/lot-0-sql-review.md`.
- Le dictionnaire validé : `docs/architecture/lot-5-db-dictionary.md` (ticket 02) — c'est le contrat contre lequel on relit.
- Le patron canonique : `supabase/migrations/006_content_core.sql` (policies) et `007_notifications_push.sql` (table serveur-only).

## Fichiers autorisés (création uniquement)
- `docs/architecture/lot-5-sql-review.md`

## Fichiers interdits
- `supabase/**` — **ne rien corriger ici.** Une anomalie se consigne, elle ne se répare pas dans un ticket de revue.
- `apps/**`, `packages/**`.

## Étapes attendues

### Checklist héritée du Lot 0
- [ ] Chaque table métier porte `org_id uuid not null` ; chaque fille de Client porte aussi `client_id`.
- [ ] RLS activée dans la migration qui crée la table.
- [ ] Aucune policy ne fait de jointure vers une autre table tenant (helpers `private.*` uniquement).
- [ ] Chaque appel de helper est wrappé `(select private.fn(...))`.
- [ ] Chaque policy porte `TO authenticated`. Aucune `for all`.
- [ ] Les helpers `private.*` sont définis **après** leurs tables sources.
- [ ] Aucune valeur d'enum interdite (`expired`, `MemberRole`).
- [ ] `rg "6543"` → aucun match. `rg "disable row level security"` → aucun match.
- [ ] `rg "delete from storage.objects"` → aucun match.
- [ ] Aucun fichier > 250 lignes.

### Cinq items neufs, propres au Lot 5

**(a) `skills` sans `org_id`**
- [ ] La table porte un **commentaire SQL** justifiant l'exception (référentiel système ; `org_id` rendrait `manifest_path` writable par le tenant → path traversal résolue en chemin disque par le worker).
- [ ] La décision est **citée** depuis `lot-5-db-dictionary.md` §Open Decisions, avec la phrase de validation d'Étienne.
- [ ] **Zéro policy** `insert`/`update`/`delete` sur `skills` pour `authenticated`.
- [ ] Le `input_schema` seedé est byte-identique à `packages/skills/src/expected-seed.ts` (`pnpm skills:check` passe).

**(b) `skill_run_steps` sans policy write**
- [ ] Une seule policy : `select`. Aucune `insert`/`update`/`delete`.
- [ ] `grant select on public.skill_run_steps to authenticated;` — et rien d'autre.
- [ ] Le précédent `notifications` (migration 007) est cité dans le rapport.

**(c) ⚠️ Le trigger de garde est présent ET couvert par un test**
- [ ] `private.skill_runs_guard_queue_columns()` existe, `security definer`, `set search_path = ''`, `revoke all … from public`.
- [ ] Il refuse toute transition de `status` autre que `* → canceled` hors `service_role`.
- [ ] Il refuse toute modification de `claimed_at`, `lease_expires_at`, `worker_id`, `attempts`, `total_*`, `org_id`, `client_id`.
- [ ] Il lève `errcode = '42501'`.
- [ ] **Les assertions 5 et 6 du test pgTAP le couvrent explicitement**, avec `set local "request.jwt.claims"` posé.
- [ ] Le rapport indique noir sur blanc : **« ce trigger n'est pas une policy → `get_advisors` ne le verra jamais ; le test pgTAP est le seul filet »**.

**(d) Chemin Storage verrouillé**
- [ ] `check (storage_path is null or storage_path like (org_id::text || '/' || client_id::text || '/' || skill_run_id::text || '/%'))`.
- [ ] Bucket `skill-artifacts` : `public = false`.
- [ ] Policy `select` sur `storage.objects` via `storage.foldername(name)`, indices `[1]` = org, `[2]` = client.
- [ ] **Aucune policy** `insert`/`update`/`delete` pour `authenticated` sur ce bucket.

**(e) Le pont `content_items.skill_run_id`**
- [ ] Colonne **nullable** (pas de `not null` sans default sur une table potentiellement non vide).
- [ ] FK **composite** `(skill_run_id, client_id) → skill_runs(id, client_id)`.
- [ ] `on delete set null` (pas `cascade`) — supprimer un run ne détruit jamais du contenu approuvé.
- [ ] `skill_runs` porte bien `unique (id, client_id)`, sans quoi la FK ne peut pas être créée.
- [ ] Vérifier, **fichier ouvert**, que `supabase/tests/006_content_core.test.sql` n'est pas cassé : les 3 `insert into content_items` nomment leurs colonnes, `plan(6)` inchangé, le `throws_ok('23503')` porte sur `content_targets`.

### Invariants d'idempotence (spécifiques au Lot 5)
- [ ] `skill_run_steps.llm_idempotency_key` est `not null unique`.
- [ ] `check (status <> 'succeeded' or llm_message_id is not null)` est présent.
- [ ] L'index unique partiel `skill_runs_active_per_client_skill_idx` existe sur `(client_id, skill_id)` où `status in ('queued','running','waiting_approval')`.
- [ ] `total_cost_micros` et `cost_micros` sont des `bigint`, jamais des `numeric` ni des float.
- [ ] Le fichier `*_skill_notification_types.sql` ne contient **que** les deux `alter type … add value`.

### Rédaction du rapport
Structure : `Status` · `Anomalies P1` · `Anomalies P2` · `Décisions ouvertes` · `Verdict`.
Chaque anomalie : le fichier, la ligne, ce qui est écrit, ce qui devrait l'être, la règle `CLAUDE.md` violée.
Verdict : `REVUE VERTE — prêt pour exécution (LOT5-09)` ou `REVUE ROUGE — retour en LOT5-06 sur : <liste>`.

## Critères d'acceptation
- [ ] `docs/architecture/lot-5-sql-review.md` existe, structuré comme `lot-0-sql-review.md`.
- [ ] Les 10 items hérités **et** les 5 items neufs sont chacun cochés ou signalés en anomalie.
- [ ] Les invariants d'idempotence sont vérifiés un par un.
- [ ] Le rapport contient explicitement la phrase sur `get_advisors` et le trigger de garde.
- [ ] Chaque anomalie cite fichier + ligne + règle violée.
- [ ] Le rapport se termine par un verdict explicite.
- [ ] **Aucun fichier SQL n'a été modifié.**
- [ ] Aucun test n'a été exécuté.

## Commandes de validation
```powershell
# Le rapport existe
Test-Path 'docs\architecture\lot-5-sql-review.md'

# Le SQL n'a pas bouge
git diff --exit-code supabase/

# Les 5 items neufs sont traites
Select-String -Path 'docs\architecture\lot-5-sql-review.md' -Pattern 'get_advisors|org_id|skill_run_steps|storage_path|skill_run_id'

# Verifications independantes (le rapport doit dire la meme chose)
rg "policy skill_run_steps_(insert|update|delete)" supabase\migrations     # attendu : aucun match
rg "policy skills_(insert|update|delete)" supabase\migrations              # attendu : aucun match
rg "skill_runs_guard_queue_columns" supabase\migrations                    # attendu : 1 definition + 1 trigger
rg "42501" supabase\tests\*skill_runs.test.sql                             # attendu : >= 3
rg "bigint" supabase\migrations\*skill_runs.sql                            # cost_micros, total_cost_micros
git diff --exit-code supabase/tests/006_content_core.test.sql

# Le catalogue et le seed sont en phase
pnpm skills:check
```

## Risques / points d'attention
- **Ne rien corriger ici.** Un ticket de revue qui répare masque le fait qu'une migration validée était fausse. Consigner, classer, remonter. La correction retourne en `LOT5-06`, avec un nouveau commit.
- **Le trigger de garde est l'angle mort.** `get_advisors` inspecte les policies et les RLS, pas les triggers. Une revue qui « fait confiance à `get_advisors` » manquera la faille la plus coûteuse du lot : un owner qui écrit `status = 'completed'` sur un run en cours, et le worker qui repart de zéro sur un step déjà payé.
- **Vérifier `006_content_core.test.sql` fichier ouvert**, pas de tête. L'`alter table` est réputé inoffensif — le prouver, ligne par ligne, est le travail.
- **La FK composite est facile à rater.** Une FK simple `references skill_runs(id)` compile, passe `get_advisors`, et laisse un `content_item` du client A pointer un run du client B. Chercher explicitement `foreign key (skill_run_id, client_id)`.
- Si le verdict est rouge, **ne pas enchaîner sur `LOT5-09`**. La gate 09 exige le rapport **et** une autorisation explicite.

## Résultat attendu
Un rapport de revue SQL, vert ou rouge, qui autorise ou bloque l'exécution des migrations.

## Message de commit suggéré
```
docs(lot-5): rapport de revue SQL (checklist Lot 0 + 5 items Lot 5)

Verifie : skills sans org_id (justifie + zero policy write), skill_run_steps
select-only (precedent notifications), trigger de garde present ET couvert par
pgTAP (il echappe a get_advisors), chemin storage verrouille, pont content_items
en FK composite nullable on-delete-set-null. Invariants d'idempotence
(llm_idempotency_key unique, check succeeded=>message_id, index unique partiel,
cout en bigint). 006_content_core.test.sql verifie inchange.
Aucun SQL modifie.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. 🛑 `LOT5-09` démarre seulement si le verdict est **vert** et qu'Étienne a donné son feu vert par écrit.
