# Lot 0 SQL Review - Ocean

> **Mis a jour le 2026-07-08.** Les anomalies de la revue initiale sont soldees.
> Six guardrails supplementaires ont ete appliques (audit
> `_research/audits/2026-07-08-audit-lot5-et-guardrails.md`).
> Le perimetre couvre desormais les migrations `001` a `009` et les tests `003` a `009`.
>
> **Aucune migration n'a ete executee.** Docker absent de la machine de revue :
> les tests pgTAP n'ont pas ete lances. La CI (`.github/workflows/ci.yml`) les
> executera au premier push.

## Statut : anomalies initiales soldees

| # | Anomalie de la revue initiale | Statut | Ou |
|---|---|---|---|
| P1 | `clients_select` bloque le portail reviewer | ✅ corrige | `004` + `or private.is_client_member(id)` |
| P1 | `notifications_select_own` n'isole pas par tenant | ✅ corrige | `007` + `private.has_org_access()` |
| P2 | `push_subscriptions` accepte un `org_id` arbitraire | ✅ corrige | `007`, conjonction sur les 5 policies |
| P2 | test `005` ne couvre pas org A vs org B | ✅ corrige | `plan(2)` -> `plan(6)` |
| P3 | `.gitkeep` dans l'ordre des migrations | cosmetique | ignore |

## Guardrails appliques apres la revue initiale

Six trous n'avaient ete releves par aucune revue. Le SQL n'ayant jamais ete
execute, le cout de correction etait nul.

| ID | Trou | Correctif |
|---|---|---|
| GUARD-00 | `has_org_access()` matche `client_members` sur `org_id`, pas `client_id` : un reviewer du client 1 lisait une notification du client 2 de la **meme org** (regle 8). Le test `007` ne creait **aucun** `client_members` -- le scenario ne pouvait pas echouer. | `007` : `is_client_member(client_id)` quand `client_id` est renseigne. Test `plan(6)` -> `plan(9)`. |
| GUARD-00-bis | `grant update on content_items to authenticated` sans garde : `PATCH {"status":"published"}` passait RLS et sautait l'approbation client. | `008` : trigger de transition, matrice PRD 5.B. Statuts d'execution reserves au worker. |
| GUARD-01 | `content_targets` n'avait **aucune** contrainte `UNIQUE` : deux cibles identiques auraient produit deux `publish_jobs` legitimes, chacun publiant. | `006` : `unique (id, client_id)` + index unique partiel `(content_item_id, social_account_id)`. |
| GUARD-02 | `organization_members_{insert,update,delete}` n'exigeaient que `is_org_member()` : un `admin` s'auto-promouvait `owner`. Les enums `org_role` / `client_role` n'etaient lus par aucune policy. | `003` : `private.is_org_owner()`. Test `plan(5)` -> `plan(9)`. |
| GUARD-04 | Le soft-delete n'etait filtre par aucune policy : un reviewer interrogeant PostgREST lisait `draft` et corbeille. La fuite passait aussi par `content_targets`. | `006` : `private.is_reviewer_visible_content()`, applique aux deux tables. |
| GUARD-05 | Aucune CI : les fichiers pgTAP ne tournaient nulle part. | `.github/workflows/ci.yml` : `db reset` + `test db` + equivalent local de `get_advisors` + anti-patterns. |
| GUARD-10 | `notifications.read_at` inatteignable (`grant select` seul, zero policy write). | `009` : RPC `mark_notification_read()`. |
| GUARD-14 | Billing non prepare sur la table racine. | `009` : `organizations.plan` + `seats`. Rien d'autre -- Stripe est en V2. |

## Ce que cette revue a appris

Deux fois de suite, sur deux lots, le meme angle mort : **les tests prouvaient
que la porte etait fermee, jamais qu'elle s'ouvrait pour celui qui a la cle.**

- `007` : aucun `client_members` -> la fuite cross-client ne pouvait pas echouer.
- Lot 5, trigger de garde : le test pose toujours `role: authenticated` -> le
  blocage du worker ne peut pas echouer.

**Regle a ajouter au `CLAUDE.md` section 7 :** tout test d'une garde (policy,
trigger, contrainte) doit couvrir **les deux chemins** -- celui qui doit echouer
(`throws_ok`) **et** celui qui doit passer (`lives_ok`). Un test qui ne prouve
que le refus ne prouve rien sur l'autorisation.

## Decision ouverte, non tranchee

- **Hard delete** : `clients`, `platform_connections`, `social_accounts`,
  `content_items`, `content_targets`, `content_labels`, `organization_members`
  et `client_members` exposent des policies `DELETE` a `authenticated`, alors
  que le schema porte `archived_at` / `deleted_at`. A arbitrer avec le PRD.
  Non modifie : ce n'est pas une faille, c'est un choix produit.

## Gate `LOT0-06`

**VERTE sous condition** : executer `supabase db reset` + `supabase test db` en
local (ou laisser la CI le faire) avant de considerer les migrations comme
validees. Aucune execution distante (`db push`, `link`) tant que la CI n'est
pas verte.

---

## Revue initiale (2026-07-07) -- conservee pour historique

## Fichiers crees

Fichier cree par ce ticket :

- `docs/architecture/lot-0-sql-review.md`

Fichiers Lot 0 relus, crees par les tickets precedents :

- `supabase/migrations/001_extensions_schema_utils.sql`
- `supabase/migrations/002_enums.sql`
- `supabase/migrations/003_identity_orgs.sql`
- `supabase/migrations/004_clients_members.sql`
- `supabase/migrations/005_accounts_shell.sql`
- `supabase/migrations/006_content_core.sql`
- `supabase/migrations/007_notifications_push.sql`
- `supabase/tests/003_identity_orgs.test.sql`
- `supabase/tests/004_clients_members.test.sql`
- `supabase/tests/005_accounts_shell.test.sql`
- `supabase/tests/006_content_core.test.sql`
- `supabase/tests/007_notifications_push.test.sql`

Contexte relu :

- `docs/PRD.md`
- `docs/ANALYSE-LANCEMENT.md`
- `docs/architecture/lot-0-db-dictionary.md`
- `docs/superpowers/tickets/lot-0/05-sql-review.md`
- `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md`

## Tables couvertes

| Table | Migration | Couverture revue |
| --- | --- | --- |
| `organizations` | `003` | RLS active, select/update par helper org. Pas d'`org_id` car racine tenant. |
| `profiles` | `003` | RLS active, scope utilisateur, pas d'`org_id`, pas de role. |
| `organization_members` | `003` | `org_id` present, RLS active via helper org et propre ligne utilisateur. |
| `clients` | `004` | `org_id` present, `unique(id, org_id)` present, RLS active. Anomalie reviewer sur select. |
| `client_members` | `004` | `org_id` + `client_id`, FK composite vers `clients(id, org_id)`, RLS active. |
| `platform_connections` | `005` | `org_id`, `unique(id, org_id)`, RLS active via helper org. Test org A/B manquant. |
| `platform_connection_secrets` | `005` | `org_id`, RLS active, zero policy, grants service role seulement. |
| `social_accounts` | `005` | `org_id` + `client_id`, FK composites, `unique(id, client_id)`, RLS active. Test org A/B manquant. |
| `social_account_secrets` | `005` | `org_id` + `client_id`, RLS active, zero policy, grants service role seulement. |
| `content_items` | `006` | `org_id` + `client_id`, `unique(id, client_id)`, RLS active, tests org/reviewer presents. |
| `content_targets` | `006` | `org_id` + `client_id`, FK composites vers `content_items(id, client_id)` et `social_accounts(id, client_id)`. |
| `content_labels` | `006` | `org_id` + `client_id`, `unique(id, client_id)`, RLS active. |
| `content_item_labels` | `006` | `org_id` + `client_id`, FK composites vers item et label. |
| `notifications` | `007` | `org_id`, `client_id` nullable avec FK composite. Anomalie RLS cross-org. |
| `push_subscriptions` | `007` | `org_id`, user-scoped RLS. Risque d'ecriture sous `org_id` arbitraire. |

## Tables reportees connues

- Lot 1 : `media_assets`, buckets/policies Storage, `content_pillars`, `recurring_slots`, `client_events`, `brand_kits`, `saved_views`, `library_assets`, `hashtag_groups`, `imported_posts`.
- Lot 2 : `publish_jobs`.
- Lot 3 : `review_requests`, `review_request_items`, `review_request_reviewers`, `comments`, `approvals`, `content_versions`, `activity_log`.
- Lot 4 : `calendar_accounts`, `calendar_account_secrets` ou references Vault, `calendar_calendars`, `calendar_events`, vue `unified_agenda` en `security_invoker = true`.

## Anomalies a corriger avant execution

### P1 - Reviewers exclus de `clients_select`

Reference : `supabase/migrations/004_clients_members.sql:68`.

La policy `clients_select` utilise seulement :

```sql
using ((select private.is_org_member(org_id)));
```

Le test `supabase/tests/004_clients_members.test.sql:62` attend pourtant qu'un reviewer voie son propre client via `client_members`. En l'etat, un reviewer n'a pas d'appartenance org et ne peut pas lire la ligne `clients` de son portail.

Attendu probable : ajouter un chemin reviewer limite au client courant, du type `or (select private.is_client_member(id))`, tout en gardant insert/update/delete reserves aux membres org.

### P1 - Notification cross-org visible si mal adressee

References : `supabase/migrations/007_notifications_push.sql:55`, `supabase/tests/007_notifications_push.test.sql:25`, `supabase/tests/007_notifications_push.test.sql:60`.

La policy `notifications_select_own` autorise :

```sql
using (recipient_user_id = (select auth.uid()));
```

Le test `007` cree volontairement une notification `org A` adressee au user de `org B` et attend `0`. Avec la policy actuelle, le recipient de `org B` passe le predicat `recipient_user_id = auth.uid()` et peut lire cette ligne cross-org.

Attendu probable : exiger a la fois le bon destinataire et un droit tenant, par exemple appartenance org pour notifications owner/ops, ou appartenance client quand `client_id` est renseigne.

### P2 - `push_subscriptions` accepte un `org_id` arbitraire

Reference : `supabase/migrations/007_notifications_push.sql:63`.

La policy d'insert verifie seulement `user_id = auth.uid()`. Un utilisateur authentifie peut donc inserer sa propre subscription sous un `org_id` dont il n'est pas membre, si l'UUID de l'org existe.

Ce n'est pas une lecture cross-tenant directe, mais c'est une pollution tenant et un risque de routage notification. Pour les reviewers, il faudra probablement un helper dedie qui valide l'acces a l'org via `organization_members` ou via au moins un `client_members` de cette org.

### P2 - Couverture pgTAP insuffisante pour la migration `005`

Reference : `supabase/tests/005_accounts_shell.test.sql:5`.

Le test `005` a seulement 2 assertions, toutes deux sur le deny-all des tables secrets. Il ne teste pas :

- org B ne peut pas lire `platform_connections` de org A ;
- org B ne peut pas lire `social_accounts` de org A ;
- un reviewer voit seulement les `social_accounts` de son client ;
- un reviewer ne voit pas les comptes d'un autre client de la meme org.

La checklist demande un scenario org A vs org B pour chaque migration RLS. `005` doit etre complete avant execution.

## Decisions ouvertes

- Hard delete : `clients`, `platform_connections`, `social_accounts`, `content_items`, `content_targets`, `content_labels`, `organization_members` et `client_members` exposent des policies `DELETE` au role `authenticated`. C'est a arbitrer avec le PRD, qui privilegie `archived_at` / `deleted_at` et une suppression definitive explicite.
- Divergence preview front : le scan large trouve encore `expired` et `MemberRole` dans `apps/web` mocks/types/i18n. Ce n'est pas dans le SQL, mais il faudra aligner les mocks front avec les enums DB (`needs_reauth`, `org_role`, `client_role`) avant branchement.
- Ordre des migrations : la presence de `.gitkeep` fait que la commande brute ne retourne pas exactement la liste attendue. Hors `.gitkeep`, l'ordre `001` -> `007` est correct.
- Dictionnaire DB : le mismatch "16 tables" vs 15 tables explicites reste documente dans `lot-0-db-dictionary.md`.

## Resultat des scans

### Scan dangereux large

Commande statique lancee :

```powershell
rg "disable row level security|delete from storage.objects|NEXT_PUBLIC.*SERVICE|expired|MemberRole|linkIdentity|6543" supabase packages apps/web
```

Resultat :

- Aucun match dans `supabase`.
- Aucun match `disable row level security`, `delete from storage.objects`, `NEXT_PUBLIC.*SERVICE`, `linkIdentity` ou `6543`.
- Matches dans `apps/web` uniquement, autour de `expired` et `MemberRole` dans les mocks/types/i18n de preview front. A traiter comme divergence de contrats mockes, pas comme faille SQL Lot 0.

Scan SQL pur :

```powershell
rg "disable row level security|delete from storage.objects|NEXT_PUBLIC.*SERVICE|expired|MemberRole|linkIdentity|6543" supabase
```

Resultat : aucun match.

### Ordre des migrations

Commande statique lancee :

```powershell
Get-ChildItem -LiteralPath 'supabase\migrations' | Sort-Object Name | Select-Object Name
```

Resultat observe :

```text
.gitkeep
001_extensions_schema_utils.sql
002_enums.sql
003_identity_orgs.sql
004_clients_members.sql
005_accounts_shell.sql
006_content_core.sql
007_notifications_push.sql
```

Interpretation : ordre SQL correct si on ignore `.gitkeep`, mais la sortie brute n'est pas exactement celle attendue par le ticket.

## Checklist

- OK - Chaque table metier a `org_id uuid not null`, sauf `profiles` et la racine tenant `organizations`.
- OK - Chaque table fille de Client a `client_id`; `notifications.client_id` est nullable car certaines notifications sont org-level.
- OK - RLS activee dans la migration qui cree chaque table.
- OK - `clients` a `unique(id, org_id)`.
- OK - `content_items` a `unique(id, client_id)`.
- OK - FK composites de `content_targets` presentes vers `content_items(id, client_id)` et `social_accounts(id, client_id)`.
- OK - `platform_connection_secrets` et `social_account_secrets` ont RLS ON et zero policy.
- PARTIEL - Les policies declarent `TO authenticated` et les appels helper sont wrappes. Exception a revoir : `notifications_select_own` n'utilise pas de helper tenant et fuit en cas de mauvais recipient ; `push_subscriptions` manque une validation d'acces org sur insert/update.
- OK - Helpers `private.is_org_member` et `private.is_client_member` definis apres leurs tables sources.
- OK - `handle_new_user` ecrit uniquement dans `profiles`; `profiles` n'a ni `org_id` ni role.
- OK - Enums SQL sans `expired` ni `MemberRole`.
- OK - Aucun `disable row level security`, aucun `6543`, aucun `linkIdentity`, aucun `DELETE FROM storage.objects` dans `supabase`.
- PARTIEL - Tests pgTAP jumeaux presents pour `003` a `007`, mais `005` ne couvre pas org A vs org B pour les tables non-secretes, et `007` expose une faille attendue sur les notifications.

## Commandes non executees

Conformement au ticket, ces commandes n'ont pas ete lancees :

- `supabase db push`
- `supabase migration up`
- `supabase db reset`
- `supabase test db`
- `supabase db test`
- `supabase db lint`
- `supabase db advisors`
- `get_advisors`
- `supabase link`
- tout remote link Supabase
- tout `psql`
- tout build applicatif `pnpm`

## STOP (leve le 2026-07-08)

~~Stop explicite LOT0-05.~~ Les anomalies P1/P2 sont corrigees et commitees
(voir le tableau en tete de document). Le `STOP` de la revue initiale n'a plus
d'objet.

Prochaine gate : `LOT0-06`. Avant toute execution Supabase distante, la CI doit
etre verte -- elle rejoue `db reset` + `test db` depuis une base vierge. Base
locale uniquement ; jamais `db push`, jamais `link`.
