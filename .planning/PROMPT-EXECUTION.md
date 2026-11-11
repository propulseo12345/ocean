# Prompt de lancement — session d'exécution autonome (phase 6)

Écrit le 15/08/2026 par la session de pilotage. À copier-coller tel quel dans une session
Claude Code fraîche, à la racine du dépôt. Conçu pour tourner **plusieurs heures sans
supervision**.

---

```
Session d'exécution AUTONOME et LONGUE sur Ocean. Étienne n'est pas disponible : il ne
répondra à aucune question pendant que tu travailles. Tu dois avancer seul, plusieurs
heures, et livrer.

Projet : c:\Users\etien\Desktop\Ocean

Amorçage, dans cet ordre :
1. `CLAUDE.md` en entier — les règles 15, 18, 19 et la §8 (anti-patterns) contraignent
   directement ton lot.
2. `.planning/SESSION-BRIEF-2026-08-18.md` — TON BRIEF. Six lots, du plus bloquant au
   plus optionnel. Il dit aussi précisément ce qui est hors de ta portée.
3. `.planning/HANDOFF.md` — l'état réel du projet et les impasses déjà payées.
4. `git status --short` et `git log --oneline -5`. Si ça diverge de ce qu'on te raconte,
   c'est le dépôt qui a raison.

Ta mission : la PHASE 6 (publishers réels), jusqu'où elle va sans app Meta — c'est-à-dire
loin. Tu écris le dialogue avec Instagram, Facebook et TikTok, testé contre un transport
HTTP injecté. Tu ne peux PAS émettre un vrai post et tu ne dois jamais le prétendre.

CE QUE TU PEUX FAIRE SANS DEMANDER (autonomie accordée par Étienne) :
- écrire et modifier du code dans `apps/worker` et `apps/web` ;
- créer des fichiers de migration `supabase/migrations/037_*.sql` et leur jumeau `deploy/` ;
- commiter sur la branche `chore/phase-0-outillage`, un commit atomique par ticket, en
  français, sans co-author ;
- lancer le stack Supabase local (ports 544xx), `db reset --no-seed`, `test db`.

CE QUE TU NE FAIS JAMAIS :
- écrire quoi que ce soit sur le projet Supabase EN LIGNE (`hgdeopkmkwyoumsfggrm`). Les
  migrations s'appliquent en production par la session de pilotage, sur autorisation
  d'Étienne. Toi tu livres des fichiers ;
- `git push` (le compte n'a que la lecture, ça échouera de toute façon) ;
- toucher au projet Supabase local `preventionelectrique` (ports 5432x) ;
- réintroduire des données mockées (`lib/mocks` a été supprimé volontairement) ;
- inventer une valeur par défaut pour `PUBLISHERS_MODE`.

MÉTHODE, non négociable — la session de pilotage vérifiera ton travail contre le code et
a rejeté cinq faux positifs cette semaine :
- Pour chaque garde que tu écris : VÉRIFICATION PAR MUTATION. Casse la garde, montre quel
  test tombe, remets-la. Un test qui passe avant ET après ton correctif ne prouve rien.
- Ne crois jamais le message de sortie d'un outil, regarde son EFFET. `git status` après
  un générateur, les `ok`/`not ok` comptés après un runner de tests.
- `bash scripts/run-pgtap.sh` sans argument N'EXÉCUTE AUCUN TEST et sort 0. Le vrai
  chemin est `npx supabase@latest db reset --no-seed` puis `npx supabase@latest test db`.
- `scripts/gen-types.py` a été supprimé : `apps/web/lib/supabase/types.ts` est MANUEL.
- Aucun token OAuth dans un log, jamais — y compris recopié depuis une erreur Meta.

RYTHME : travaille lot par lot. À la fin de chaque lot, lance la batterie complète
(build, tsc web + worker, tests web + worker, pgTAP) et commite si c'est vert. Ne
t'arrête pas pour demander l'avis d'Étienne : s'il te manque une décision, prends la plus
prudente, écris-la dans ton rapport sous « décisions prises seul », et continue. Si un lot
s'avère impossible, écris pourquoi et passe au suivant — ne reste pas bloqué, et ne réduis
pas le périmètre en silence.

LIVRABLE FINAL : mets à jour `.planning/ACTION-PLAN.md` (tableau de suivi ticket par
ticket, avec commit et preuve pour chacun, au format des phases 7 et 8), puis écris un
rapport de fin de session qui distingue trois choses :
  1. ce qui est fait et prouvé (avec la mutation qui le prouve),
  2. ce que tu as décidé seul et pourquoi,
  3. ce que tu n'as PAS couvert.
Le point 3 n'est pas optionnel. La limite de ce lot est connue d'avance et elle est
énorme : aucun octet n'aura transité vers Meta, aucun post n'existera. Un rapport qui ne
le dit pas sera rejeté entier.

Commence maintenant. Pas de résumé préalable, pas de demande de feu vert : lis, puis
attaque le LOT 1.
```
