# GUARD-P2 — Add content_targets status transition guard

**Statut** : à traiter **après** les blockers P0/P1 (non implémenté dans la passe `fix(db): repair content status guard and pgTAP assertions`).
**Priorité** : P2 — pas un bloqueur de merge, mais une faille réelle du modèle métier.
**Découvert** : review de merge readiness du 2026-07-08.

## Problème

La garde de transition (migration `008`) protège `content_items.status`. Elle ne
protège **rien** sur `content_targets`.

`content_targets` n'a qu'un seul trigger — `content_targets_set_updated_at` — et sa
policy `content_targets_update` autorise tout membre de l'org à écrire n'importe
quelle colonne :

```sql
create policy content_targets_update on public.content_targets
for update to authenticated
using ((select private.is_org_member(org_id)))
with check ((select private.is_org_member(org_id)));
```

Conséquence : un `PATCH /rest/v1/content_targets` suffit à fabriquer une
publication fictive.

```http
PATCH /rest/v1/content_targets?id=eq.<uuid>
{"status":"published","external_post_id":"17841400000000000","permalink":"https://instagram.com/p/fake"}
```

L'item parent reste bloqué en `draft` par la garde `008`, mais la cible affiche
`published` avec un permalink. Le portail client, la grille de feed et l'agrégat
de statut lisent `content_targets`. Le mensonge est visible côté client.

## Rappel du modèle (ne pas confondre les deux étages)

```
content_items.status    = état métier global   (garde 008 ✅)
content_targets.status  = état de publication par plateforme  (aucune garde ❌)
```

Protéger l'un sans l'autre ne protège pas l'invariant « pas de publication sans
approbation ». Un utilisateur ne peut pas passer l'item en `published` — il peut
quand même marquer chaque cible comme publiée.

## Objectif

Empêcher un membre org d'écrire directement, depuis PostgREST :

- `content_targets.status` → `published`, `publishing`, `pushed_to_platform`, `failed`
- `content_targets.external_post_id`
- `content_targets.permalink`
- `content_targets.published_at`

Ces colonnes appartiennent au worker. Elles constatent un fait externe ; elles
ne le décrètent pas.

## Approche recommandée

Symétrique de `008`. Trigger `before update` sur `content_targets`, même ancre de
bypass — `coalesce(current_setting('request.jwt.claims', true), '') = ''` ou
`role = 'service_role'`.

Deux différences avec `008` :

1. **Pas de `update of status`** : il faut aussi intercepter les écritures de
   `external_post_id` / `permalink` / `published_at`, même quand `status` ne bouge
   pas. Sinon on protège l'étiquette et pas le contenu.
2. **Garder l'INSERT en tête.** `content_targets_insert` n'exige que
   `is_org_member(org_id)` : un `POST {"status":"published"}` naît publié, exactement
   le trou fermé sur `content_items` par le commit `85f3076`. Ajouter
   `and status in ('pending','queued')` au `with check`.

## Critères d'acceptation

- [ ] Un membre org ne peut pas `UPDATE content_targets SET status='published'` via PostgREST → `42501`.
- [ ] Un membre org ne peut pas écrire `external_post_id`, `permalink` ou `published_at`.
- [ ] Un membre org ne peut pas `INSERT` une cible déjà en `published` / `pushed_to_platform`.
- [ ] Le worker (connexion directe, aucun `request.jwt.claims`) peut tout écrire.
- [ ] Les transitions légitimes côté utilisateur restent possibles (annulation d'une cible : `pending` → `canceled`).
- [ ] Test pgTAP dédié, avec **mutation testing** : supprimer le trigger doit faire virer le test au rouge.

## Pièges connus (payés une fois, pas deux)

- `session_user` n'est **pas** une fonction schéma-qualifiable — `pg_catalog.session_user` ne compile pas.
- `SET ROLE` change `current_user`, pas `session_user` : ne jamais ancrer un bypass dessus.
- `set_config(guc, null, true)` laisse la **chaîne vide**, pas `NULL` — tester `coalesce(…, '') = ''`.
- `throws_ok(sql, errcode, errmsg, description)` : la 3ᵉ position est le message, pas la description.
- Une transaction pgTAP avortée (`ERROR`) n'émet **aucun** `not ok`. Compter les assertions émises vs le plan, sinon un test mort passe pour vert.

## Hors périmètre

Rien d'autre. Pas de Skills, pas de Postiz, pas de refonte du modèle social,
pas de nouvelle migration au-delà de celle qui porte le trigger.
