# Ticket LOT0-01 — Figer le dictionnaire DB corrigé

## Ticket ID
`LOT0-01`

## Objectif
Créer **un seul fichier de documentation** figeant le contrat de base de données Lot 0 (tables, corrections du plan initial, tables reportées, décisions ouvertes). Ce document devient la **source de vérité** que les migrations SQL (ticket 03) devront respecter. **Aucun SQL, aucun code.**

## Contexte minimal à donner à Codex
- Le repo Ocean n'a pas encore de `supabase/` ni de `packages/shared`. On fige d'abord le contrat DB avant tout code.
- Plan source : `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md`, **Task 1**.
- Le contenu exact du document est déjà spécifié dans le plan source (section « Task 1 → Step 1 »). Codex doit le reproduire fidèlement, en vérifiant qu'aucune table Lot 0 du PRD ne manque.
- Règles multi-tenant à refléter dans le dictionnaire : chaque table métier a `org_id uuid not null` dénormalisé ; les tables filles de Client ont aussi `client_id` ; les tables `*_secrets` sont deny-all (RLS activée, zéro policy) ; `profiles` n'a **ni** `org_id` **ni** rôle.
- Références à consulter en lecture seule : `docs/PRD.md`, `docs/ANALYSE-LANCEMENT.md`, `_research/audits/2026-07-07/11a-mapping-mocks-vers-db.md`, `apps/web/lib/mocks/types/*.ts`.

## Fichiers autorisés (création uniquement)
- `docs/architecture/lot-0-db-dictionary.md` (le dossier `docs/architecture/` n'existe pas encore, le créer)

## Fichiers interdits
- Tout fichier sous `supabase/` (ne pas créer le dossier à ce stade)
- Tout fichier sous `packages/`
- Tout fichier sous `apps/`
- Toute migration `.sql`
- `pnpm-workspace.yaml` et toute config racine

## Étapes attendues
1. Créer `docs/architecture/lot-0-db-dictionary.md` en reproduisant les sections définies dans le plan source (Task 1 → Step 1) : `Status`, `Corrections to Claude Code Plan`, `Lot 0 Tables`, `Deferred Tables`, `Open Decisions`.
2. Vérifier que **toutes** les tables Lot 0 listées ci-dessous figurent dans la section « Lot 0 Tables ».
3. Vérifier la couverture PRD avec :
   ```powershell
   Select-String -Path 'docs\PRD.md' -Pattern 'platform_connections|content_targets|push_subscriptions|publish_jobs|unified_agenda' -Context 1,1
   ```
   → chaque table Lot 0 trouvée doit être présente dans le dictionnaire ; les tables non-Lot 0 (ex. `publish_jobs`, `unified_agenda`) doivent apparaître en « Deferred » avec leur lot cible.
4. **NE PAS écrire de SQL.** S'arrêter et rendre le document pour validation Étienne.

## Tables Lot 0 attendues dans le dictionnaire (16)
`organizations`, `profiles`, `organization_members`, `clients`, `client_members`, `platform_connections`, `platform_connection_secrets`, `social_accounts`, `social_account_secrets`, `content_items`, `content_targets`, `notifications`, `push_subscriptions`, `content_labels`, `content_item_labels`.

## Critères d'acceptation
- [ ] Le fichier `docs/architecture/lot-0-db-dictionary.md` existe.
- [ ] Il contient les 5 sections : Status / Corrections / Lot 0 Tables / Deferred Tables / Open Decisions.
- [ ] La section « Status » indique explicitement qu'aucune migration n'a été exécutée.
- [ ] Les 16 tables Lot 0 listées ci-dessus sont présentes.
- [ ] La section « Deferred Tables » place `publish_jobs` en Lot 2, `review_requests`/`comments`/`approvals` en Lot 3, `calendar_*`/`unified_agenda` en Lot 4.
- [ ] Les corrections clés sont présentes : helpers `private.*` créés après leurs tables ; `client_members` après `clients` avec FK `clients(id, org_id)` ; `platform_connections`/`social_accounts` avant `content_targets` ; `publish_jobs` porte `social_account_id` ; `review_requests` via tables de jointure (pas `reviewer_ids uuid[]`) ; `imported_posts` dédup sur `(social_account_id, external_id)`.
- [ ] **Aucun** fichier `.sql` créé. **Aucun** fichier hors `docs/architecture/`.

## Commandes de validation
```powershell
# Le fichier existe
Test-Path 'docs\architecture\lot-0-db-dictionary.md'

# Les 16 tables Lot 0 sont citées
Select-String -Path 'docs\architecture\lot-0-db-dictionary.md' -Pattern 'organizations|profiles|organization_members|clients|client_members|platform_connections|platform_connection_secrets|social_accounts|social_account_secrets|content_items|content_targets|notifications|push_subscriptions|content_labels|content_item_labels'

# Aucun SQL n'a été créé par ce ticket
Test-Path 'supabase'   # doit renvoyer False
```

## Risques / points d'attention
- **Piège du sur-scope** : ne pas commencer à écrire des migrations « pendant qu'on y est ». Ce ticket produit UNIQUEMENT le document.
- **Divergence mocks vs DB** : les mocks contiennent des valeurs qui ne doivent PAS finir en base (ex. statut `expired`, `MemberRole`). Le dictionnaire fige les noms DB canoniques, pas les noms de mocks.
- **`profiles`** ne doit jamais recevoir de `org_id` ni de rôle dans le dictionnaire (règle multi-tenant stricte).

## Résultat attendu
Un document de contrat DB revu, prêt à servir de référence aux migrations, **en attente de validation Étienne**. Codex s'arrête ici (gate 🛑).

## Message de commit suggéré
```
docs(lot-0): fige le dictionnaire DB corrigé (contrat Lot 0)

Source de vérité des tables Lot 0, corrections du plan, tables reportées
et décisions ouvertes. Aucune migration exécutée.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## 🛑 Gate
Après commit, **STOP**. Ne pas enchaîner sur le ticket 02. Attendre qu'Étienne confirme le dictionnaire et tranche les décisions ouvertes.
