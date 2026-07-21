# Ticket LOT0-04 — Tests pgTAP en **brouillon**

## Ticket ID
`LOT0-04`

## Objectif
Écrire les **tests pgTAP « leak test » en brouillon** dans `supabase/tests/`, un fichier par migration porteuse de RLS. Ces tests prouvent l'isolation multi-tenant : un utilisateur d'une org ne voit/écrit jamais les données d'une autre, un Reviewer d'un client ne voit jamais un autre client, les secrets ne sont jamais lisibles. **Aucun test n'est exécuté ici** (pas de base live) — on écrit le SQL de test, il tournera au ticket 06.

## Pré-requis
- Ticket **LOT0-03** committé : les 7 migrations existent, les noms de tables/colonnes/policies sont figés.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md`, parties **tests** des Tasks 4, 5, 6.
- Cibles : les tables créées aux migrations `003`, `004`, `005`, `006`, `007`.
- Chaque test cible **exactement** les tables/policies de sa migration jumelle. Les noms doivent correspondre au SQL du ticket 03 (relire `supabase/migrations/00X_*.sql` avant d'écrire le test correspondant).
- Convention : `SET LOCAL role` + `request.jwt.claims` pour simuler des utilisateurs distincts (org A, org B, reviewer client 1, reviewer client 2), `plan(n)` / `finish()` pgTAP.

## Fichiers autorisés (création uniquement)
- `supabase/tests/003_identity_orgs.test.sql`
- `supabase/tests/004_clients_members.test.sql`
- `supabase/tests/005_accounts_shell.test.sql`
- `supabase/tests/006_content_core.test.sql`
- `supabase/tests/007_notifications_push.test.sql`

## Fichiers interdits
- `supabase/migrations/**` → figées au ticket 03, **lecture seule** ici.
- `packages/**`, `apps/**`, `docs/**`, `supabase/config.toml`.

## Étapes attendues (un fichier de test par migration)

### `004_clients_members.test.sql` — couvre :
```text
org member can see own clients
org B cannot see org A clients
reviewer can see own client through client_members
reviewer cannot see another client in same org
```

### `005_accounts_shell.test.sql` — couvre :
```text
authenticated cannot read social_account_secrets
authenticated cannot read platform_connection_secrets
```
(prouver le deny-all : aucune ligne visible même pour un membre de l'org)

### `006_content_core.test.sql` — couvre :
```text
org B cannot read org A content
reviewer client 1 cannot read client 2 content
reviewer cannot update content_items
cross-client content_target insert fails by FK composite
authenticated cannot read social_account_secrets
```

### `007_notifications_push.test.sql` — couvre :
```text
user cannot read another user's push subscription
recipient can read own notification
org B cannot read org A notification
```

### `003_identity_orgs.test.sql` — couvre (au minimum) :
```text
org member sees own organization
non-member cannot see another organization
profiles has no org_id / no role column exposed via policy
```

## Critères d'acceptation
- [ ] Les 5 fichiers `*.test.sql` existent, nommés d'après leur migration jumelle.
- [ ] Chaque fichier contient un `plan(n)` cohérent avec le nombre d'assertions et un `finish()` (ou `SELECT * FROM finish();`).
- [ ] Chaque scénario listé ci-dessus a une assertion correspondante.
- [ ] Les tests de `*_secrets` prouvent **0 ligne visible** pour un utilisateur authenticated (deny-all).
- [ ] Le test « cross-client content_target insert fails » attend une **erreur d'intégrité** (FK composite), pas un succès silencieux.
- [ ] Aucune modification des migrations.

## Commandes de validation
```powershell
# Les 5 tests sont là
Get-ChildItem -LiteralPath 'supabase\tests' -Filter '*.test.sql' | Sort-Object Name | Select-Object Name

# Chaque test a un plan pgTAP
Select-String -Path 'supabase\tests\*.test.sql' -Pattern 'plan\(|finish\(\)'

# Les scénarios anti-leak clés sont présents
Select-String -Path 'supabase\tests\006_content_core.test.sql' -Pattern 'org B cannot read|reviewer client 1|cross-client|social_account_secrets'

# Les migrations n'ont pas bougé
git diff --exit-code supabase\migrations
```

## Risques / points d'attention
- **Test sans cible** : c'est pour ça que ce ticket vient APRÈS le 03. Ne pas inventer de noms de tables/colonnes — les recopier depuis les migrations réelles.
- **Un secret « lisible » qui passe le test = faux négatif** : bien vérifier que l'assertion échoue si une policy fuit (tester la présence de 0 ligne, pas juste l'absence d'erreur).
- **Pas d'exécution** : `supabase test db` / `pg_prove` ne sont **pas** lancés dans ce ticket (pas de base live). On écrit uniquement le SQL de test.
- **Reviewer = vrai user Supabase Auth** scoped par `client_members` uniquement : le simuler avec un JWT sans appartenance org.

## Résultat attendu
5 fichiers de tests pgTAP en brouillon, couvrant l'isolation multi-tenant de chaque migration, **non exécutés**, prêts pour la revue (05).

## Message de commit suggéré
```
test(lot-0-draft): tests pgTAP leak-test en brouillon (003->007)

Isolation multi-tenant par migration : org A/B, reviewer client 1/2,
deny-all des *_secrets, FK composite content_targets. NON exécuté.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. Le ticket 05 démarre une fois ce commit fait.
