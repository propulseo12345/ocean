# Ticket LOT5-09 — Exécuter les migrations (SEULEMENT après feu vert)

## Ticket ID
`LOT5-09`

## Objectif
Appliquer les migrations Lot 5 et lancer les tests pgTAP **contre une base Supabase locale**, puis vérifier l'absence de fuite multi-tenant (`get_advisors`). **Ce ticket ne démarre QUE si Étienne a explicitement donné le feu vert** après le rapport de revue (ticket 08).

## 🛑 Pré-condition bloquante
- [ ] Le rapport `docs/architecture/lot-5-sql-review.md` (ticket 08) est produit, verdict **REVUE VERTE**.
- [ ] Étienne a écrit une **autorisation explicite** d'exécuter (ex. « feu vert Lot 5, exécute les migrations »).
- **Sans cette phrase d'autorisation dans la conversation, Codex NE FAIT RIEN et redemande.** Il ne présume jamais le consentement.

## Pré-requis
- `LOT5-08` committé, verdict vert.
- Docker disponible localement (Supabase CLI démarre une base en conteneur).

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-08-lot-5-skills-engine.md`, **Task 9**.
- Précédent exact : `docs/superpowers/tickets/lot-0/06-migration-execution.md`.
- **Cible = Supabase LOCAL uniquement** (`supabase start`, base Docker locale). **Interdiction absolue** de toucher un projet distant : pas de `supabase link`, pas de `supabase db push`, aucun host `db.*.supabase.co`.
- Après migration : lancer `get_advisors` (MCP Supabase ou CLI) et **exiger un résultat clean** sur la catégorie sécurité.
- ⚠️ **Le Lot 0 doit avoir été exécuté** (prérequis P1, vérifié au ticket 01). Les migrations Lot 5 s'appliquent par-dessus 001→007 et les migrations des Lots 1–3.

## Fichiers autorisés
- **Lecture** : `supabase/migrations/*.sql`, `supabase/tests/*.sql`.
- **Création uniquement** : `docs/architecture/lot-5-execution-report.md` (journal : commandes lancées, sortie pgTAP, sortie advisors).
- **Correctifs SQL** : autorisés **uniquement** si un test échoue, et **uniquement** après accord d'Étienne sur le correctif proposé — sinon consigner l'échec et STOP.

## Fichiers interdits
- `apps/**`, `packages/**`.
- Toute configuration pointant vers un Supabase **distant**.

## Étapes attendues

1. **Re-confirmer le feu vert** dans la conversation. Absent → STOP immédiat.
2. Démarrer la base **locale** : `supabase start`. Vérifier qu'**aucun lien distant** n'est actif (`supabase status` : pas de `API URL` pointant vers `*.supabase.co`).
3. Appliquer les migrations en local : `supabase db reset` (rejoue `migrations/` dans l'ordre, **local only**).
   - ⚠️ Surveiller le fichier `*_skill_notification_types.sql` : sur PG 15, `ALTER TYPE … ADD VALUE` doit être **seul dans sa transaction**. Un échec ici signale que le ticket 06 a mélangé des instructions.
4. Lancer les tests pgTAP : `supabase test db`.
   - **Exiger `plan(9)` et `plan(2)` verts sur les nouveaux fichiers.**
   - **Exiger que les tests existants passent toujours**, en particulier `006_content_core.test.sql` (`plan(6)`) après l'`alter table content_items`. **Le prouver ligne par ligne dans le rapport**, pas en résumé.
5. Lancer `get_advisors` (sécurité + performance). Exiger **0 alerte critique** de fuite/RLS.
   - ⚠️ **`get_advisors` ne verra pas le trigger de garde** (ce n'est pas une policy). Son silence sur ce point ne prouve rien : c'est le test pgTAP (assertions 5 et 6) qui l'atteste. Le rappeler dans le rapport.
6. Vérifier le catalogue : `pnpm skills:check` (le `input_schema` seedé doit correspondre à `expected-seed.ts`).
7. Écrire `docs/architecture/lot-5-execution-report.md` :
   - la phrase d'autorisation d'Étienne, citée ;
   - `supabase status` (preuve d'absence de lien distant) ;
   - chaque commande lancée et sa sortie brute ;
   - **le résultat de CHAQUE assertion pgTAP** (`ok` / `not ok`), pour les nouveaux fichiers **et** pour `006` ;
   - la sortie `get_advisors` ;
   - un verdict.
8. Si tout est vert → commit du rapport. **Si un test échoue → STOP**, consigner, remonter à Étienne. **Pas de correctif silencieux.**

## Critères d'acceptation
- [ ] L'autorisation explicite d'Étienne est présente et **citée dans le rapport**.
- [ ] Les migrations sont appliquées sur base **locale** (preuve : sortie `supabase status` sans projet distant lié).
- [ ] **Tous** les tests pgTAP passent — aucun `not ok`, y compris les tests des Lots 0–3.
- [ ] `006_content_core.test.sql` : les 6 assertions passent après l'`alter table`, prouvé ligne par ligne.
- [ ] Les assertions 5 et 6 du test `skill_runs` passent → **le trigger de garde fonctionne**.
- [ ] `get_advisors` : 0 alerte critique sécurité.
- [ ] `pnpm skills:check` passe (catalogue disque ≡ seed SQL).
- [ ] `docs/architecture/lot-5-execution-report.md` existe et contient les sorties **brutes**, pas des paraphrases.
- [ ] Aucun fichier sous `apps/` ou `packages/` n'a été touché.
- [ ] Aucune commande n'a visé un projet Supabase distant.

## Commandes de validation
```powershell
# 0. Aucun lien distant
supabase status

# 1. Migrations
supabase db reset

# 2. Tests pgTAP — aucun "not ok"
supabase test db

# 3. Le trigger de garde a bien ete exerce
#    (les assertions 5 et 6 doivent apparaitre en "ok" dans la sortie ci-dessus)

# 4. Advisors — 0 alerte critique securite
#    via MCP Supabase : get_advisors(type=security)

# 5. Catalogue en phase avec le seed
pnpm skills:check

# 6. Le rapport existe et cite l'autorisation
Test-Path 'docs\architecture\lot-5-execution-report.md'
Select-String -Path 'docs\architecture\lot-5-execution-report.md' -Pattern 'feu vert|autorisation'

# 7. Rien n'a bouge cote applicatif
git status --short apps packages     # attendu : vide
```

## Risques / points d'attention
- **Ne jamais présumer le consentement.** L'absence de la phrase d'autorisation = STOP, et on redemande. C'est la règle la plus importante de ce ticket.
- **Local uniquement.** Un `supabase db push` sur un projet distant applique des migrations non testées à une base réelle. Vérifier `supabase status` **avant** toute commande d'écriture.
- **Le silence de `get_advisors` sur le trigger de garde ne prouve rien.** `get_advisors` inspecte les policies et la RLS. Le trigger est un `BEFORE UPDATE` : il lui est invisible. **Seules les assertions 5 et 6 du test pgTAP attestent qu'un owner ne peut pas écrire `status = 'completed'` sur un run en cours.** Si elles sont rouges, la faille de double facturation est ouverte — STOP, quoi que dise `get_advisors`.
- **`ALTER TYPE … ADD VALUE` en transaction.** Si `supabase db reset` échoue sur `*_skill_notification_types.sql`, c'est que le fichier contient autre chose que les deux `alter type`. Retour ticket 06.
- **Un test rouge → STOP.** Pas de correctif silencieux, pas de « je corrige vite fait ». Consigner l'échec, proposer le correctif, attendre l'accord d'Étienne, puis un nouveau commit sur `LOT5-06`.
- **`006_content_core.test.sql` doit être prouvé, pas supposé.** L'`alter table content_items add column skill_run_id` est réputé inoffensif (colonne nullable, inserts nommant leurs colonnes). Le rapport doit montrer les 6 `ok`.

## Résultat attendu
Une base locale portant le schéma Lot 5, tous les leak tests verts, `get_advisors` clean, et un journal d'exécution reproductible.

## Message de commit suggéré
```
feat(lot-5): execution des migrations Lot 5 (base locale) + rapport

supabase db reset + supabase test db : tous les tests pgTAP verts, y compris
006_content_core (plan(6)) apres l'alter table content_items.
Assertions 5 et 6 vertes : le trigger de garde bloque bien claimed_at et
status='completed' pour un owner (get_advisors ne le voit pas).
get_advisors : 0 alerte critique securite. pnpm skills:check vert.
Local uniquement, aucun projet distant contacte.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. `LOT5-10` démarre seulement une fois ce commit fait — le worker ne peut pas claim une table qui n'existe pas.
