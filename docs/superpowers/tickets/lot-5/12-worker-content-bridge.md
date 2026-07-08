# Ticket LOT5-12 — Worker : pont artifacts → `content_items` + notifications

## Ticket ID
`LOT5-12`

## Objectif
Matérialiser les sorties du Creative Copy en `content_items` **en `draft`**, traçables par `skill_run_id`, dans la **même transaction** que l'insertion de l'artifact. Uploader les artifacts longs en Storage, notifier l'owner, et faire passer le run en `waiting_approval`.

## Pré-requis
- `LOT5-11` committé, run de test validé par Étienne (coût constaté).

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **Le pont skill → contenu** et **Task 12**.
- Le worker tourne en `service_role` → il **bypasse la RLS**. Toute la sécurité repose donc sur ce qu'il **injecte**, pas sur ce que la base filtre.

### La matrice à états — invariant produit
`docs/PRD.md` §5.B : « **toute transition absente est interdite** ». La transition `idea → draft` exige : « l'owner complète le minimum requis (**≥ 1 cible, légende ou média**) ».

Un `copy_asset` **porte** légende + hashtags + plateforme → le minimum est atteint à l'insertion. Le worker écrit donc **directement en `draft`**, avec sa `content_targets` associée, atomiquement.

> ⚠️ **Un `content_item` en `draft` sans aucune `content_target` violerait la matrice.** L'insertion du contenu et de sa cible est indissociable.

### Le périmètre de visibilité reviewer
`docs/PRD.md` §5.F : le reviewer voit `in_review | changes_requested | approved | scheduled | publishing | published | partially_published | failed`. **Jamais `idea` ni `draft`.** Un brouillon généré par l'IA est donc invisible du portail jusqu'à ce que l'owner l'envoie en revue. C'est voulu.

### Règles de storage
- Règle 20/21 : chemins = mécanisme d'isolation. `{org_id}/{client_id}/{skill_run_id}/{artifact_id}/…`
- **Règle 23 : jamais de `DELETE` SQL sur `storage.objects`.** API Storage uniquement.

## Fichiers autorisés
- `apps/worker/src/skills/bridge.ts` (création)
- `apps/worker/src/skills/artifacts.ts` (création : upload Storage)
- `apps/worker/src/skills/notify.ts` (création)
- `apps/worker/src/skills/executor.ts` (modification : appeler le pont après le dernier step)
- `supabase/functions/skill-watchdog/**` (création, optionnel — voir étape 5)

## Fichiers interdits
- `apps/web/**`, `packages/**`.
- `supabase/migrations/**` (figées au ticket 09).

## Étapes attendues

### 1. `bridge.ts` — la matérialisation, atomique

Pour chaque `copy_asset` produit par le step `creative_copy`, **dans une seule transaction** :

```sql
-- 1. l'artifact
insert into public.skill_artifacts
  (org_id, client_id, skill_run_id, skill_run_step_id, kind, content, mime_type)
values ($orgId, $clientId, $runId, $stepId, 'copy_asset', $asset, 'application/json')
returning id;

-- 2. le contenu, en draft
insert into public.content_items
  (org_id, client_id, title, caption, hashtags, format, status, skill_run_id, created_by)
values ($orgId, $clientId, $title, $caption, $hashtags, $format, 'draft', $runId, $createdBy)
returning id;

-- 3. la cible : sans elle, 'draft' violerait la matrice §5.B
insert into public.content_targets
  (org_id, client_id, content_item_id, platform, status)
values ($orgId, $clientId, $contentItemId, $platform, 'pending');

-- 4. le lien retour
update public.skill_artifacts
set materialized_content_item_id = $contentItemId
where id = $artifactId;
```

> ⚠️ **`org_id` et `client_id` sont injectés depuis `skill_runs`, JAMAIS depuis le JSON du LLM.**
> Le modèle peut halluciner un UUID. La FK composite `(client_id, org_id) → clients(id, org_id)` fait échouer (`23503`) tout mismatch — mais ne pas lui laisser l'occasion. Les schémas Zod du ticket 04 n'acceptent d'ailleurs ni `orgId` ni `clientId`.

Re-valider chaque asset par `copyAssetSchema` (`@ocean/shared/schemas`) **avant** l'insertion. Defense in depth : le structured output d'Anthropic garantit la forme, Zod la re-vérifie.

### 2. `artifacts.ts` — inline XOR storage
- Contenu < 8 Ko (un post, le `task_manifest`) → **inline** en `content jsonb`.
- Contenu long (rapport de campagne markdown, calendrier CSV) → **Storage**, chemin `{org_id}/{client_id}/{skill_run_id}/{artifact_id}.{ext}`, `storage_path` renseigné, `content` à `null`.
- La contrainte `check (num_nonnulls(content, storage_path) = 1)` refuse tout autre cas (`23514`).

Upload via l'**API Storage** (client Supabase en `service_role`), jamais par `insert into storage.objects`.
Purge d'un run annulé : **API Storage** également. **Jamais de `DELETE` SQL** (règle 23 — fichiers orphelins).

### 3. Clôture du run
```sql
update public.skill_runs
set status = 'waiting_approval',
    total_input_tokens = <somme des steps>,
    total_output_tokens = <somme des steps>,
    total_cost_micros = <somme des steps>,
    finished_at = now()
where id = $runId;
```
Agrégat **recalculé par le worker**, pas par un trigger (un trigger sur `skill_run_steps` serait à déboguer et coûterait à chaque écriture).

### 4. `notify.ts`
```sql
insert into public.notifications
  (org_id, client_id, recipient_user_id, type, title, body, channels, audience, href, payload)
values ($orgId, $clientId, $createdBy, 'skill_run_completed', …, '{in_app,email}', 'owner',
        '/clients/' || $clientId || '/skills/' || $runId, jsonb_build_object('run_id', $runId));
```
Sur échec : `type = 'skill_run_failed'`, canal **email garanti** (Brevo), comme `publish-failed`.

### 5. `waiting_approval → completed`
**Lecture paresseuse au tick suivant**, pas un trigger sur `content_items`.

```sql
update public.skill_runs r
set status = 'completed'
where r.status = 'waiting_approval'
  and not exists (
    select 1 from public.content_items ci
    where ci.skill_run_id = r.id and ci.status in ('draft','in_review')
  );
```
> Un trigger `AFTER UPDATE ON content_items` coupleraient le Lot 3 au Lot 5 **sur la table la plus chaude du produit**, et paierait un coût à chaque édition de contenu. La lecture paresseuse coûte une requête par tick.

### 6. Watchdog (optionnel mais recommandé)
`pg_cron` (1×/5 min) : run en `running` avec `lease_expires_at < now() - interval '15 minutes'` → Edge Function → email Brevo à Étienne. Même pattern que le watchdog `publish_jobs`.
> Les Edge Functions sont **autorisées ici** : c'est de la surveillance, pas du travail long. « pg_cron trop fragile pour publier, parfait pour surveiller. »

## Critères d'acceptation
- [ ] Chaque `copy_asset` produit **dans une seule transaction** : 1 `skill_artifact` + 1 `content_item` (`status = 'draft'`) + ≥ 1 `content_target` + le lien retour `materialized_content_item_id`.
- [ ] **Aucun `content_item` en `draft` sans `content_target`** (invariant matrice §5.B).
- [ ] `org_id` et `client_id` proviennent de `skill_runs`, jamais du JSON du LLM. Vérifiable à la lecture du code.
- [ ] Chaque asset est re-validé par `copyAssetSchema` avant insertion.
- [ ] Artifacts : `content` XOR `storage_path`, jamais les deux, jamais aucun.
- [ ] Upload et purge via l'**API Storage**. `rg "delete from storage.objects"` → aucun match.
- [ ] Le chemin Storage respecte `{org_id}/{client_id}/{skill_run_id}/…`.
- [ ] `skill_runs.total_cost_micros` est recalculé par le worker en fin de run (pas de trigger).
- [ ] Notification `skill_run_completed` (in-app + email) ; `skill_run_failed` sur échec.
- [ ] `waiting_approval → completed` par **lecture paresseuse**, aucun trigger sur `content_items`.
- [ ] Aucun fichier > 250 lignes. Zéro `any`. `pnpm check` passe.

### Le test qui compte
- [ ] Lancer un run de test → vérifier en base que les `content_items` créés sont en **`draft`**, portent `skill_run_id`, ont chacun une `content_target`, et **n'apparaissent pas** dans la requête du portail reviewer (statuts `in_review`+).

## Commandes de validation
```powershell
# Le tenant vient du run, pas du LLM
rg -B2 -A2 "insert into public.content_items" apps\worker\src\skills\bridge.ts
rg "asset.orgId|asset.clientId|output.org_id|output.client_id" apps\worker\src\skills   # attendu : aucun match

# Re-validation Zod
rg "copyAssetSchema" apps\worker\src\skills\bridge.ts

# Le contenu part en draft, avec sa cible
rg "'draft'" apps\worker\src\skills\bridge.ts
rg "content_targets" apps\worker\src\skills\bridge.ts

# Regle 23
rg "delete from storage.objects" apps\worker                # attendu : aucun match
rg "storage.from\(|\.remove\(" apps\worker\src\skills\artifacts.ts

# Pas de trigger sur content_items
rg "create trigger.*content_items" supabase\migrations       # attendu : uniquement set_updated_at (Lot 0)

# Agregat recalcule par le worker
rg "total_cost_micros" apps\worker\src\skills

pnpm check

# LE TEST : apres un run
#   select id, status, skill_run_id from public.content_items where skill_run_id is not null;
#     -> tous en 'draft'
#   select ci.id, count(ct.id) from public.content_items ci
#     left join public.content_targets ct on ct.content_item_id = ci.id
#     where ci.skill_run_id is not null group by 1;
#     -> aucun a 0
#   -- vue reviewer : les brouillons ne doivent PAS apparaitre
#   select count(*) from public.content_items
#     where client_id = '<client du reviewer>' and status in ('in_review','approved','scheduled');
```

## Risques / points d'attention
- **`org_id`/`client_id` depuis le LLM = faille.** Le modèle peut halluciner un UUID. La FK composite rattrape (`23503`), mais un `insert` qui échoue à mi-transaction laisse un run en `running` sans steps cohérents. Injecter depuis `skill_runs`, point.
- **Un `content_item` en `draft` sans `content_target` viole la matrice §5.B.** Le PRD est catégorique : « toute transition absente est interdite », et `idea → draft` exige « ≥ 1 cible, légende ou média ». L'insertion du contenu et de sa cible est **indissociable** — même transaction, ou rien.
- **Le reviewer ne doit jamais voir un `draft`.** §5.F. Si un brouillon IA apparaît au portail, c'est que le statut est faux. Le vérifier explicitement dans le test.
- **`on delete set null` sur le pont.** Supprimer un run d'IA ne détruit **jamais** du contenu approuvé. Ne pas « optimiser » en `cascade`.
- **Jamais de `DELETE` SQL sur `storage.objects`** (règle 23) : ça laisse des fichiers orphelins que plus rien ne référence. API Storage, lots de 100.
- **Pas de trigger sur `content_items`.** C'est la table la plus chaude du produit (studio, grille, calendrier, portail). Un trigger de clôture de run y ajouterait un coût à chaque édition, et coupleraient Lot 3 et Lot 5. La lecture paresseuse au tick suffit.
- **Le run reste bloqué en `waiting_approval` si le Lot 3 n'est pas là.** C'est le prérequis P7 : sans `approvals`, personne ne fait sortir un contenu de `draft`. Ce n'est pas un bug du Lot 5.
- **Les Edge Functions sont autorisées pour le watchdog**, et **uniquement** pour ça. Une Edge Function qui appellerait le LLM violerait la décision actée (400 s wall).

## Résultat attendu
Un run qui produit des brouillons réels, traçables, avec leurs cibles, invisibles du portail jusqu'à l'envoi en revue — et un owner notifié.

## Message de commit suggéré
```
feat(lot-5): worker — pont artifacts vers content_items + notifications

Chaque copy_asset materialise, dans une seule transaction : skill_artifact +
content_item ('draft') + content_target + lien retour. org_id/client_id injectes
depuis skill_runs, jamais du JSON LLM ; re-validation Zod (defense in depth).
Un draft sans cible violerait la matrice PRD §5.B : insertion indissociable.
Artifacts inline XOR storage, upload/purge par l'API Storage (regle 23).
Cloture waiting_approval -> completed par lecture paresseuse au tick, pas de
trigger sur content_items (table la plus chaude du produit).
Notifications skill_run_completed / _failed (email garanti sur echec).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-13` démarre seulement une fois ce commit fait.
