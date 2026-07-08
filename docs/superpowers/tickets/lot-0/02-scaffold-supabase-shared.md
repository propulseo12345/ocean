# Ticket LOT0-02 — Scaffold `supabase/` + `packages/shared`

## Ticket ID
`LOT0-02`

## Objectif
Créer l'**ossature de dossiers** nécessaire à la suite : `supabase/` (config + dossiers vides) et le workspace `packages/shared` (package.json + premiers enums de domaine + point d'entrée schemas). **Aucune migration, aucun code applicatif, aucune logique.** Juste des fichiers de structure.

## Pré-requis
- Le ticket **LOT0-01 est committé et validé par Étienne**. Le dictionnaire fige les noms d'enums repris ici.

## Contexte minimal à donner à Codex
- Plan source : `docs/superpowers/plans/2026-07-07-lot-0-supabase-prep.md`, **Task 2**.
- État vérifié du repo : `supabase/` **absent**, `packages/` **absent**.
- **IMPORTANT** : `pnpm-workspace.yaml` contient **déjà** `- "packages/*"`. **Ne pas le modifier.** Juste le lire pour confirmer.
- Le package `@ocean/shared` est un scaffold minimal : pas de dépendances réseau, pas de build step. Les types sont de simples `type` TypeScript alignés sur les noms DB.

## Fichiers autorisés (création uniquement)
- `supabase/config.toml`
- `supabase/migrations/.gitkeep`
- `supabase/tests/.gitkeep`
- `packages/shared/package.json`
- `packages/shared/src/types/domain.ts`
- `packages/shared/src/schemas/index.ts`

## Fichiers interdits
- `pnpm-workspace.yaml` → **lecture seule**, déjà correct, ne pas éditer.
- Toute migration `.sql` dans `supabase/migrations/` (le dossier reste vide, juste `.gitkeep`).
- Tout test `.sql` dans `supabase/tests/`.
- Tout fichier sous `apps/`.
- Toute modification de `docs/architecture/lot-0-db-dictionary.md` (figé au ticket 01).

## Étapes attendues
1. Lire `pnpm-workspace.yaml` et **confirmer** que `- "packages/*"` est présent. Si (et seulement si) absent, l'ajouter — sinon **ne rien changer**.
2. Créer `supabase/config.toml` : config projet **locale** minimale (id de projet local, pas de remote, pas de token). Aucune référence à un projet Supabase distant.
3. Créer les dossiers vides via `supabase/migrations/.gitkeep` et `supabase/tests/.gitkeep`.
4. Créer `packages/shared/package.json` (contenu exact ci-dessous).
5. Créer `packages/shared/src/types/domain.ts` (contenu exact ci-dessous).
6. Créer `packages/shared/src/schemas/index.ts` : fichier d'entrée minimal (peut être vide avec un commentaire d'en-tête, ou un `export {}`), rempli plus tard.
7. Vérifier que le build web n'est pas cassé (voir commandes). Si la résolution du workspace échoue faute de référencement, **le documenter** et ne pas ajouter de dépendance réseau.

## Contenus imposés

`packages/shared/package.json` :
```json
{
  "name": "@ocean/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./types/domain": "./src/types/domain.ts",
    "./schemas": "./src/schemas/index.ts"
  }
}
```

`packages/shared/src/types/domain.ts` :
```ts
export type Platform = "instagram" | "facebook" | "tiktok" | "newsletter" | "custom"
export type ContentFormat = "post" | "carousel" | "reel" | "story"
export type MediaType = "image" | "video"
export type AccountStatus = "connected" | "needs_reauth"
export type OrgRole = "owner" | "admin"
export type ClientRole = "reviewer" | "editor"
```

## Critères d'acceptation
- [ ] Les 6 fichiers autorisés existent.
- [ ] `supabase/migrations/` et `supabase/tests/` existent et ne contiennent QUE `.gitkeep`.
- [ ] `packages/shared/package.json` est identique au contenu imposé (`@ocean/shared`, `private: true`).
- [ ] `packages/shared/src/types/domain.ts` est identique au contenu imposé (6 types, valeurs en snake/lowercase DB).
- [ ] `pnpm-workspace.yaml` est **inchangé** (diff vide sur ce fichier).
- [ ] `AccountStatus` ne contient **pas** `expired` (divergence mock volontairement exclue).
- [ ] Aucune migration `.sql`, aucun fichier sous `apps/`.

## Commandes de validation
```powershell
# Structure présente
Test-Path 'supabase\config.toml'
Test-Path 'supabase\migrations\.gitkeep'
Test-Path 'supabase\tests\.gitkeep'
Test-Path 'packages\shared\package.json'
Test-Path 'packages\shared\src\types\domain.ts'

# Le workspace n'a pas été modifié
git diff --exit-code pnpm-workspace.yaml

# migrations/ ne contient que .gitkeep (aucun .sql)
Get-ChildItem -LiteralPath 'supabase\migrations' -Filter '*.sql'   # doit être vide

# Le build web n'est pas cassé (comportement inchangé)
pnpm -C apps/web build
```

## Risques / points d'attention
- **Ne pas toucher `pnpm-workspace.yaml`** : il est déjà correct. Un diff dessus = ticket à refuser.
- **`config.toml` local uniquement** : aucun `project_id` distant, aucun `access_token`, aucune section pointant vers `*.supabase.co`.
- **Pas de `supabase start` / `supabase link`** : ce ticket crée des fichiers, il ne lance ni ne connecte rien.
- Si `pnpm -C apps/web build` échoue à cause du nouveau package non référencé : consigner l'erreur dans le message de commit / une note, **ne pas** installer de dépendances pour « réparer ».

## Résultat attendu
Une ossature `supabase/` + `packages/shared` prête à recevoir les migrations (ticket 03), build web toujours vert.

## Message de commit suggéré
```
chore(lot-0): scaffold supabase/ et packages/shared

Config Supabase locale, dossiers migrations/tests vides, package
@ocean/shared avec premiers enums de domaine. Aucune migration.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Checkpoint Git
Commit unique en fin de ticket. Puis passer au ticket 03 (pas de gate humaine ici, mais le ticket 02 doit être **committé** avant de démarrer le 03).
