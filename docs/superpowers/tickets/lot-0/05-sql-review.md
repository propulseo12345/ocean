# Ticket LOT0-05 — Relire le SQL avec checklist (revue, sans exécution)

## Ticket ID
`LOT0-05`

## Objectif
Relire **tout le SQL brouillon** (migrations 001→007 + tests pgTAP) avec une checklist de sécurité multi-tenant, et produire un **rapport de revue** pour Étienne. Ce ticket **ne modifie rien** et **n'exécute rien** : il vérifie, liste, et prépare la décision d'exécution (ticket 06).

## Pré-requis
- Tickets **LOT0-03** (migrations) et **LOT0-04** (tests) committés.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md`, **Task 7**.
- Anti-patterns interdits de référence : `CLAUDE.md` §8.
- Ce ticket est **read-only sur le SQL** : si une anomalie est trouvée, elle est **consignée dans le rapport**, pas corrigée ici (la correction sera un aller-retour explicite, pas une modification silencieuse).

## Fichiers autorisés
- **Lecture seule** : `supabase/migrations/*.sql`, `supabase/tests/*.sql`, `docs/architecture/lot-0-db-dictionary.md`.
- **Création uniquement** : `docs/architecture/lot-0-sql-review.md` (le rapport de revue).

## Fichiers interdits
- Toute **modification** de `supabase/migrations/**` ou `supabase/tests/**` (revue only).
- `apps/**`, `packages/**`.

## Étapes attendues
1. **Scan des patterns dangereux** :
   ```powershell
   rg "disable row level security|delete from storage.objects|NEXT_PUBLIC.*SERVICE|expired|MemberRole|linkIdentity|6543" supabase packages apps/web
   ```
   Attendu : **aucun** match dans le SQL/contrats neufs. Tout match doit être expliqué dans le rapport.
2. **Vérifier l'ordre des migrations** :
   ```powershell
   Get-ChildItem -LiteralPath 'supabase\migrations' | Sort-Object Name | Select-Object Name
   ```
   Attendu exactement :
   ```text
   001_extensions_schema_utils.sql
   002_enums.sql
   003_identity_orgs.sql
   004_clients_members.sql
   005_accounts_shell.sql
   006_content_core.sql
   007_notifications_push.sql
   ```
3. **Passer la checklist ci-dessous** table par table.
4. **Produire `docs/architecture/lot-0-sql-review.md`** avec les sections : fichiers créés, tables couvertes, tables reportées connues, décisions ouvertes, résultat des scans, et la liste explicite des **commandes NON exécutées** (`supabase db push`, `supabase migration up`, remote link).
5. **STOP** — attendre l'approbation explicite d'Étienne avant toute exécution (ticket 06).

## Checklist de revue (à cocher dans le rapport)
- [ ] Chaque table métier a `org_id uuid not null` (sauf `profiles`).
- [ ] Chaque table fille de Client a `client_id`.
- [ ] RLS activée dans la migration qui crée la table (100% des tables).
- [ ] `clients` : `unique(id, org_id)`. `content_items` : `unique(id, client_id)`.
- [ ] FK composites de `content_targets` présentes et pointant vers les paires `(id, client_id)`.
- [ ] `platform_connection_secrets` + `social_account_secrets` : RLS ON, **0 policy**.
- [ ] Toutes les policies : `TO authenticated`, appels wrappés `(select fn())`, via helpers `private.*` (aucune jointure inter-tenant).
- [ ] Helpers `private.*` définis après leurs tables sources.
- [ ] `handle_new_user` écrit uniquement dans `profiles` ; `profiles` sans `org_id` ni rôle.
- [ ] Enums sans `expired` ni `MemberRole`.
- [ ] Aucun `disable row level security`, aucun `6543`, aucun `linkIdentity`, aucun `DELETE FROM storage.objects`.
- [ ] Chaque migration RLS a un test pgTAP jumeau couvrant au moins un scénario org A vs org B.

## Critères d'acceptation
- [ ] `docs/architecture/lot-0-sql-review.md` existe et contient les 6 sections attendues.
- [ ] Les deux scans (patterns dangereux + ordre des fichiers) sont exécutés et leurs résultats reportés.
- [ ] La checklist est intégralement renseignée (chaque item : OK / anomalie décrite).
- [ ] Le rapport liste explicitement les commandes d'exécution **non lancées**.
- [ ] **Aucune** modification de `supabase/migrations/**` ni `supabase/tests/**`.

## Commandes de validation
```powershell
# Le rapport existe
Test-Path 'docs\architecture\lot-0-sql-review.md'

# Le SQL n'a pas été modifié par la revue
git diff --exit-code supabase

# Scan de sécurité reproductible (doit être sans match)
rg "disable row level security|linkIdentity|6543|MemberRole|expired" supabase
```

## Risques / points d'attention
- **Ne rien « corriger au passage »** : ce ticket décrit les problèmes, il ne les patche pas. Une correction = décision d'Étienne, puis retour au ticket 03/04.
- **Faux sentiment de sécurité** : un scan `rg` sans match ne prouve pas l'isolation ; la checklist manuelle table par table reste obligatoire.
- **C'est un gate 🛑** : le rapport se termine par un STOP explicite. Codex ne franchit pas vers l'exécution.

## Résultat attendu
Un rapport de revue complet et honnête (anomalies incluses si présentes), **en attente de l'autorisation explicite d'Étienne** pour exécuter.

## Message de commit suggéré
```
docs(lot-0): rapport de revue SQL Lot 0 (checklist multi-tenant)

Revue read-only des migrations 001-007 + tests pgTAP. Scans sécurité,
ordre des migrations, checklist RLS/FK/secrets. Rien exécuté.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## 🛑 Gate
Après commit du rapport, **STOP**. Ne pas enchaîner sur le ticket 06. Attendre le « feu vert » explicite d'Étienne.
