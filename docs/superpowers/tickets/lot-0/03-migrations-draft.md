# Ticket LOT0-03 — Migrations Lot 0 en **brouillon** (001 → 007)

## Ticket ID
`LOT0-03`

## Objectif
Écrire les **7 fichiers de migration SQL en brouillon** dans `supabase/migrations/`, dans l'ordre de dépendances (extensions → enums → identité/orgs → clients/membres → comptes → contenu → notifications). **Aucune migration n'est exécutée.** On produit du SQL relu ensuite (ticket 05) et exécuté seulement après feu vert (ticket 06).

## Pré-requis
- Tickets **LOT0-01** (dictionnaire validé) et **LOT0-02** (scaffold committé) terminés.
- `supabase/migrations/` existe et ne contient que `.gitkeep`.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md`, **Tasks 3, 4, 5, 6** (parties migrations uniquement — les tests pgTAP sont le ticket 04).
- Source de vérité des tables/noms : `docs/architecture/lot-0-db-dictionary.md` (ticket 01).
- **Règles multi-tenant NON négociables** (extraites de `CLAUDE.md` §2) :
  1. Toute table métier a `org_id uuid not null` dénormalisé ; toute table fille de Client a aussi `client_id`.
  2. RLS activée sur 100% des tables **dans la même migration** qui les crée.
  3. FK composites : `unique(id, org_id)` sur `clients`, `unique(id, client_id)` sur `content_items` — une ligne fille ne peut physiquement pas pointer un autre tenant.
  4. Policies via helpers `private.*` SECURITY DEFINER, wrappées `(select fn())`, `TO authenticated`.
  5. Tables `*_secrets` = **deny-all** : `enable row level security` + **zéro policy**.
  6. `profiles` : ni `org_id`, ni rôle. `handle_new_user` insère UNIQUEMENT dans `profiles`.

## Fichiers autorisés (création uniquement)
- `supabase/migrations/001_extensions_schema_utils.sql`
- `supabase/migrations/002_enums.sql`
- `supabase/migrations/003_identity_orgs.sql`
- `supabase/migrations/004_clients_members.sql`
- `supabase/migrations/005_accounts_shell.sql`
- `supabase/migrations/006_content_core.sql`
- `supabase/migrations/007_notifications_push.sql`

## Fichiers interdits
- `supabase/tests/**` → c'est le ticket 04, pas celui-ci.
- `packages/**`, `apps/**`, `docs/architecture/**`.
- `supabase/config.toml` (figé au ticket 02).

## Étapes attendues (une par migration, dans l'ordre)

### 001 — Extensions + schéma `private` + util
Doit contenir :
```sql
create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

### 002 — Enums
Créer les enums (13) : `platform, content_format, media_type, content_status, target_status, account_status, integration_provider, approval_mode, org_role, client_role, notification_channel, notification_audience, notification_type`.
- **Interdits de valeur** : ne PAS inclure `expired` ni `MemberRole` (divergences mock-only).

### 003 — Identité & organisations
Dans l'ordre : `organizations`, `profiles`, `organization_members`, fonction `handle_new_user` (insert **uniquement** dans `profiles`), puis helper `private.is_org_member(_org uuid)` (SECURITY DEFINER, lit `organization_members`).
- `profiles` : ni `org_id` ni rôle.
- RLS activée sur les 3 tables, policies `TO authenticated` wrappées `(select …)`.

### 004 — Clients & membres client
`clients` (+ `unique(id, org_id)`), `client_members` (+ `org_id`, FK vers `clients(id, org_id)`, `unique(client_id, user_id)`), puis helper `private.is_client_member(_client uuid)`.
- Policy type imposée :
  ```sql
  create policy clients_select on public.clients
  for select to authenticated
  using ((select private.is_org_member(org_id)));
  ```

### 005 — Coquille comptes (accounts shell)
`platform_connections`, `platform_connection_secrets`, `social_accounts`, `social_account_secrets`.
- Invariant deny-all imposé sur les `*_secrets` :
  ```sql
  alter table public.social_account_secrets enable row level security;
  -- aucune policy pour les utilisateurs authenticated
  ```
  (idem `platform_connection_secrets`)

### 006 — Cœur contenu
`content_items` (+ `unique(id, client_id)`), `content_targets`, `content_labels`, `content_item_labels`.
- FK composites imposées :
  ```text
  content_targets(content_item_id, client_id) references content_items(id, client_id)
  content_targets(social_account_id, client_id) references social_accounts(id, client_id)
  ```
- RLS lecture : `using ((select private.is_org_member(org_id)) or (select private.is_client_member(client_id)))`
- RLS écriture : `with check ((select private.is_org_member(org_id)))`

### 007 — Notifications & push
`notifications`, `push_subscriptions`.
- Push subscriptions user-scoped :
  ```sql
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()))
  ```
- Notifications : le destinataire lit les siennes ; pas de token client capable d'écrire des notifications arbitraires (création serveur/service role plus tard).

## Critères d'acceptation
- [ ] Les 7 fichiers `001…007_*.sql` existent, nommés exactement comme ci-dessus.
- [ ] Chaque table métier créée porte `org_id uuid not null` (sauf `profiles` qui n'en a pas).
- [ ] Chaque table fille de Client porte aussi `client_id`.
- [ ] Chaque migration qui crée une table **active la RLS dans le même fichier**.
- [ ] `clients` a `unique(id, org_id)` ; `content_items` a `unique(id, client_id)`.
- [ ] `platform_connection_secrets` et `social_account_secrets` ont RLS activée et **aucune** `create policy`.
- [ ] Les helpers `private.is_org_member` / `private.is_client_member` sont définis **après** leurs tables sources.
- [ ] `handle_new_user` n'écrit que dans `profiles`.
- [ ] Aucune policy ne fait de jointure vers une autre table tenant (helpers uniquement).
- [ ] Aucun fichier sous `supabase/tests/`, `apps/`, `packages/`.

## Commandes de validation
```powershell
# Les 7 migrations sont là, dans l'ordre
Get-ChildItem -LiteralPath 'supabase\migrations' -Filter '*.sql' | Sort-Object Name | Select-Object Name

# Chaque *_secrets active la RLS mais n'a AUCUNE policy
Select-String -Path 'supabase\migrations\005_accounts_shell.sql' -Pattern 'enable row level security|create policy'

# Aucune valeur mock interdite dans les enums
Select-String -Path 'supabase\migrations\002_enums.sql' -Pattern 'expired|MemberRole'   # attendu : aucun match

# Aucune désactivation de RLS nulle part
rg "disable row level security" supabase\migrations   # attendu : aucun match

# Le pooler transaction (6543) ne doit apparaître nulle part
rg "6543" supabase\migrations   # attendu : aucun match
```

## Risques / points d'attention
- **Ordre = sécurité** : un helper `private.*` référencé avant l'existence de sa table = migration cassée. Respecter l'ordre 001→007 strictement.
- **Deny-all des secrets** : la moindre `create policy` sur une table `*_secrets` est une faille (token exposable côté client). Zéro policy, c'est intentionnel.
- **FK composites** : sans `unique(id, client_id)` sur `content_items`, la FK composite de `content_targets` ne peut pas être créée → ordre et contraintes doivent coller.
- **Ne PAS exécuter** : pas de `supabase db push`, pas de `supabase migration up`, pas de `supabase start` contre un projet réel. On écrit du texte SQL, on ne le joue pas.
- **Fichier ≤ 250 lignes** (règle 24) : si une migration dépasse, la garder lisible mais ne pas la scinder hors de la numérotation imposée.

## Résultat attendu
7 migrations SQL en brouillon, cohérentes et ordonnées, **non exécutées**, prêtes pour les tests pgTAP (04) puis la revue (05).

## Message de commit suggéré
```
feat(lot-0-draft): migrations SQL Lot 0 en brouillon (001->007)

Extensions, enums, identité/orgs, clients/membres, comptes, contenu,
notifications. RLS + FK composites + helpers private.*. NON exécuté.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. Le ticket 04 démarre seulement une fois ce commit fait.
