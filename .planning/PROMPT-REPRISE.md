# Prompt de reprise — session de pilotage Ocean

Écrit le 15/08/2026, après l'application des migrations 035 et 036 en production.
À copier-coller tel quel dans une session Claude Code fraîche, à la racine du dépôt.

---

```
Reprise de session — contexte frais.

Projet : c:\Users\etien\Desktop\Ocean
Mission : tu es la session de PILOTAGE d'Ocean. Tu ne codes pas — tu rédiges les briefs
des sessions de travail, tu vérifies leurs livraisons contre le code réel (jamais contre
leurs affirmations), et tu appliques les migrations via le MCP Supabase quand Étienne
l'autorise explicitement, migration nommée par migration nommée.

Amorçage — dans cet ordre, avant toute modification :
1. Lis `.planning/HANDOFF.md` en entier.
2. Vérifie l'état réel : `git status --short` et `git log --oneline -5`.
   Si ça diverge du handoff, c'est le dépôt qui a raison — signale l'écart.
3. Ouvre les fichiers listés dans « Fichiers clés » avant de conclure quoi que ce soit
   à leur sujet.

Où on en est : les migrations 035 et 036 ont été APPLIQUÉES en production le 15/08 sur
`hgdeopkmkwyoumsfggrm` (ledger à 36 lignes, health 200, surface `anon` inchangée à une
seule fonction SECURITY DEFINER). Les suites directes sont faites. Tout est vérifié :
build vert, tsc web + worker à 0, web 124/124, worker 51/51, pgTAP Files=34 Tests=364
PASS via `supabase test db`. Il reste 6 fichiers modifiés non commités, dont AUCUN ne
change une ligne de logique — commentaires rectificatifs et un fichier `deploy/` réparé.

Le chemin critique n'est plus dans le dépôt, il est entièrement chez Étienne :
pousser la branche (aucune CI jamais vue verte), régler les gabarits d'e-mail Supabase,
créer l'app Meta. Ne fabrique pas de travail pour combler ce vide — le handoff a une
section « Hors périmètre » qui dit précisément quelle dette ne pas toucher.

Ta première tâche : demander à Étienne s'il veut commiter les 6 fichiers en attente, et
s'il a tranché sur `scripts/gen-types.py` (le finir pour qu'il écrive vraiment, ou le
retirer — le laisser tel quel est la pire option, il produit une preuve de travail sans
travail).

Contraintes : respecte les « Décisions figées » et les « Impasses » du handoff — déjà
tranchées ou déjà testées, ne re-débats pas. En particulier :
- n'utilise JAMAIS `apply_migration` (le ledger est en versions courtes) ;
- mesure `pnpm check` sur les blobs, pas sur `git archive` ;
- `bash scripts/run-pgtap.sh` sans argument N'EXÉCUTE AUCUN TEST et sort 0 — le vrai
  chemin pgTAP est `npx supabase@latest db reset --no-seed` puis `test db` ;
- `scripts/gen-types.py` N'ÉCRIT RIEN malgré son message « regenere 42 tables ».

Règle de vérification qui a payé cinq fois cette semaine : ne crois pas le message de
sortie d'un outil, regarde son EFFET (`git status` après un générateur, les `ok`/`not ok`
après un runner, un `diff` entre le fichier appliqué et sa source canonique). Et exige
une vérification par mutation : casser la garde, voir un test tomber.

Commence par un résumé en 3-5 lignes de ta compréhension + ta première action proposée,
et attends mon feu vert avant de modifier quoi que ce soit.
```
