# Ticket LOT0-06 — Exécuter les migrations (SEULEMENT après feu vert)

## Ticket ID
`LOT0-06`

## Objectif
Appliquer les migrations Lot 0 et lancer les tests pgTAP **contre une base Supabase locale**, puis vérifier l'absence de fuite multi-tenant (`get_advisors`). **Ce ticket ne démarre QUE si Étienne a explicitement donné le feu vert** après le rapport de revue (ticket 05).

## 🛑 Pré-condition bloquante
- [ ] Le rapport `docs/architecture/lot-0-sql-review.md` (ticket 05) est produit **et** Étienne a écrit une **autorisation explicite** d'exécuter (ex. « feu vert Lot 0, exécute »).
- **Sans cette phrase d'autorisation dans la conversation, Codex NE FAIT RIEN et redemande.** Il ne présume jamais le consentement.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md`, contraintes globales + Task 7 Step 4.
- **Cible = Supabase LOCAL uniquement** (`supabase start` / base Docker locale). **Interdiction absolue** de toucher un projet distant : pas de `supabase link`, pas de `supabase db push` vers un projet cloud, pas de `db.*.supabase.co`.
- Connexion worker/tests = Supavisor **mode SESSION port 5432**, jamais le pooler transaction 6543 (casse les advisory locks).
- Après migration : lancer `get_advisors` (via MCP Supabase ou CLI) et exiger un résultat clean.

## Fichiers autorisés
- **Lecture** : `supabase/migrations/*.sql`, `supabase/tests/*.sql`.
- **Création uniquement** : `docs/architecture/lot-0-execution-report.md` (journal d'exécution : commandes lancées, sortie pgTAP, sortie advisors).
- **Correctifs SQL** : autorisés **uniquement** si un test échoue, et **uniquement** après accord d'Étienne sur le correctif — sinon consigner l'échec et STOP.

## Fichiers interdits
- `apps/**`, `packages/**`.
- Toute config pointant vers un Supabase **distant**.

## Étapes attendues
1. **Re-confirmer le feu vert** dans la conversation. Absent → STOP immédiat.
2. Démarrer la base **locale** : `supabase start` (Docker local). Vérifier qu'aucun lien distant n'est actif (`supabase status`).
3. Appliquer les migrations en local (ordre 001→007), via la commande locale appropriée (`supabase db reset` sur l'instance locale applique `migrations/` — **local only**).
4. Lancer les tests pgTAP : `supabase test db` (ou `pg_prove` contre la base locale).
5. Lancer `get_advisors` (sécurité + perf). Exiger **0 alerte critique** de fuite/RLS.
6. Écrire `docs/architecture/lot-0-execution-report.md` : commandes exécutées, résultat de chaque test pgTAP (pass/fail), sortie `get_advisors`.
7. Si tout est vert → commit du rapport. Si un test échoue → **STOP**, consigner, remonter à Étienne (pas de correctif silencieux).

## Critères d'acceptation
- [ ] Autorisation explicite d'Étienne présente et citée dans le rapport.
- [ ] Migrations appliquées sur base **locale** (preuve : sortie `supabase status` sans projet distant lié).
- [ ] **Tous** les tests pgTAP passent (aucun `not ok`).
- [ ] `get_advisors` : aucune alerte critique de RLS/fuite.
- [ ] `docs/architecture/lot-0-execution-report.md` créé avec les sorties réelles.
- [ ] Aucune commande n'a ciblé un projet Supabase distant.

## Commandes de validation
```powershell
# Confirmer qu'on est en local, pas lié à un projet distant
supabase status

# Rejouer les tests (doivent tous passer)
supabase test db

# Le rapport d'exécution existe
Test-Path 'docs\architecture\lot-0-execution-report.md'
```

## Risques / points d'attention
- **Le risque #1 = exécuter sans autorisation.** La pré-condition bloquante n'est pas décorative : pas de phrase d'Étienne → rien.
- **Distant vs local** : `supabase db push` pousse vers le **cloud** et est **INTERDIT** ici. On applique en local via reset/test. Vérifier `supabase status` avant toute application.
- **Port 6543** : ne jamais configurer la connexion sur le pooler transaction. SESSION 5432.
- **Échec pgTAP = signal, pas obstacle à contourner** : un test de fuite qui échoue révèle une vraie faille. On s'arrête et on remonte, on ne « fait pas passer » le test en désactivant une policy.
- **Idempotence / données** : base locale jetable uniquement. Aucune donnée client réelle, aucun token réel.

## Résultat attendu
Migrations Lot 0 appliquées en local, tests d'isolation multi-tenant tous verts, `get_advisors` clean, rapport d'exécution committé. Lot 0 prêt pour le câblage backend réel.

## Message de commit suggéré
```
feat(lot-0): applique et vérifie les migrations Lot 0 en local

Migrations 001-007 appliquées sur Supabase local, tests pgTAP verts,
get_advisors clean. Exécuté après feu vert explicite d'Étienne.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit du rapport d'exécution uniquement si **tout est vert**. En cas d'échec : pas de commit de « réparation » improvisée, on remonte à Étienne.
