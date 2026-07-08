# GUARD-15 — Harnais pgTAP local qui ne ment pas

**Statut** : à traiter séparément. Ne pas mélanger au fix P0/P1.
**Priorité** : P2 outillage. Aucun impact schéma.
**Découvert** : review de merge readiness du 2026-07-08.

## Problème

Le réflexe naturel pour lire une sortie pgTAP est :

```bash
psql < test.sql | grep "not ok"
```

Ce réflexe est faux, et il produit exactement le faux vert qu'on cherche à éviter.

Une transaction pgTAP qui avorte (`ERROR:`) **arrête l'émission des assertions**.
Aucune ligne `ok`, aucune ligne `not ok`. Le `grep` ne trouve rien. La sortie
ressemble à un succès.

Vécu pendant cette review : `009` mourait sur `permission denied for table
notifications` dès l'assertion 3. Le comptage naïf a affiché **« 55 assertions,
0 échec »** alors que 5 assertions n'avaient jamais tourné.

## Ce qu'il faut vérifier

Trois conditions, pas une :

1. Aucune ligne `^ERROR:` dans la sortie.
2. Aucun `not ok`.
3. **`plan` déclaré == nombre d'assertions réellement émises.**

La troisième est celle qui attrape la transaction avortée.

## État de la CI

`supabase test db` s'appuie sur `pg_prove`, qui **détecte** le mismatch
plan/assertions et sort non-zéro. Le job `db` de `.github/workflows/ci.yml` est
donc correct — ce n'est pas lui qui était faible.

Le trou est **local** : quand on itère hors CI (conteneur jetable `ocean_pgtap`,
protocole en mémoire persistante), on n'a pas `pg_prove` sous la main et on
retombe sur le `grep`. C'est là qu'un test mort passe pour vert.

## Objectif

Committer un harnais local reproductible qui applique les trois vérifications, et
le documenter comme la seule façon d'affirmer « les tests passent » hors CI.

Emplacement suggéré : `supabase/tests/run-local.sh` (ou `scripts/`).

## Comportement attendu

```
FICHIER                                    PLAN EMISES  OK NOTOK  STATUT
003_identity_orgs.test.sql                    9      9   9     0  OK
009_notifications_read_and_org_plan.test.sql  7      2   2     0  ERROR x1 (tx avortee) / PLAN!=EMISES
----------------------------------------------------------------
RESULTAT : ROUGE
```

- Sortie non-zéro dès qu'une des trois conditions casse.
- En cas d'échec, afficher les lignes `ERROR:` / `caught:` / `wanted:` / `died:`.
- Ne dépend pas de `pg_prove` (indisponible dans le conteneur jetable).

## Critères d'acceptation

- [ ] Le harnais sort non-zéro sur une transaction avortée, même sans aucun `not ok`.
- [ ] Le harnais sort non-zéro sur `plan != emises`.
- [ ] Sur la suite actuelle (001→009) : `60/60 VERT`, sortie zéro.
- [ ] Test du harnais lui-même : injecter volontairement un `ERROR` dans un test → le harnais doit virer au rouge.
- [ ] Le protocole en mémoire persistante (`ocean-tester-pgtap-localement`) référence le harnais et non plus un `grep`.

## Bonus recommandé — mutation testing

Un test vert est une hypothèse, pas une preuve. Ajouter une cible qui mute la
garde et vérifie que la suite vire au rouge. Les quatre mutants utilisés pendant
la review, tous tués :

| Mutation appliquée à `private.content_items_guard_status_transition()` | Attendu |
|---|---|
| trigger supprimé | ≥1 échec |
| corps remplacé par `return new` | ≥1 échec |
| ancre de bypass = `session_user` | ≥1 échec |
| ancre de bypass = `IS NULL` | ≥1 échec |

Sans cette étape, on ne sait pas si le vert vient de la garde ou d'un bypass.
C'est précisément ce qui avait masqué P0-2.

## Hors périmètre

Pas de refonte des tests. Pas de nouvelle assertion métier. Outillage seulement.
