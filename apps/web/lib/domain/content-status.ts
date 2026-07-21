import type { ContentStatus } from "@/lib/domain"

// LA matrice de transition de statut, côté code.
//
// Elle est le MIROIR EXACT de la garde SQL `private.content_items_guard_status_transition`
// (migration 008, amendée par 016). La base reste la source de vérité — ce
// module existe pour que l'UI propose exactement ce que la base acceptera,
// plutôt que de découvrir un 42501 au moment du clic.
//
// Pourquoi ce fichier : la matrice était auparavant recopiée dans TROIS listes
// codées en dur de `board-kanban.tsx` (TO_REVIEW_FROM, TO_DRAFT_FROM,
// TO_SCHEDULED_FROM). Elles avaient dérivé — `approved -> in_review` et
// `changes_requested -> in_review` y étaient proposés alors que 008 les refuse,
// et `draft -> idea` était proposé alors qu'il n'existait pas en base. Une
// matrice dupliquée n'est pas une matrice : c'est une divergence en attente.
//
// ⚠️ Toute modification ici DOIT être accompagnée de la migration SQL
// correspondante, et couverte par `supabase/tests/016_transitions.test.sql`.

/** Statuts posés par le WORKER seul. Interdits à `authenticated` (008). */
export const WORKER_ONLY_STATUSES: ContentStatus[] = [
  "publishing",
  "published",
  "partially_published",
  "failed",
]

/** Transitions légales, par statut source. Miroir de 008 + 016. */
export const STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  idea: ["draft", "scheduled", "canceled"],
  // 016 : `idea` ajouté (conflit C3).
  draft: ["idea", "in_review", "approved", "scheduled", "canceled"],
  in_review: ["changes_requested", "approved", "draft", "canceled"],
  changes_requested: ["draft", "approved", "canceled"],
  approved: ["scheduled", "draft", "canceled"],
  scheduled: ["approved", "draft", "canceled"],
  publishing: [],
  published: [],
  partially_published: ["scheduled", "canceled"],
  failed: ["scheduled", "draft", "canceled"],
  canceled: ["draft"],
}

/** Une transition directe est-elle légale ? (un no-op l'est toujours) */
export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  if (from === to) return true
  if (WORKER_ONLY_STATUSES.includes(to)) return false
  return STATUS_TRANSITIONS[from].includes(to)
}

/** Intentions exprimables depuis l'UI (colonne kanban, bouton, menu). */
export type StatusIntent =
  | "send_to_review"
  | "back_to_draft"
  | "back_to_idea"
  | "schedule"
  | "approve"
  | "cancel"

/**
 * Chemin à emprunter pour réaliser une intention, par statut de départ.
 *
 * Les chemins sont DÉCLARÉS UN PAR UN, jamais calculés par un plus-court-chemin
 * sur la matrice. Un parcours automatique trouverait par exemple
 * `in_review -> approved -> scheduled` et FABRIQUERAIT une approbation cliente
 * que personne n'a donnée — exactement ce que la garde 008 existe pour empêcher.
 * Un statut absent d'une intention n'est pas un oubli : c'est un refus.
 */
export const INTENT_PATHS: Record<StatusIntent, Partial<Record<ContentStatus, ContentStatus[]>>> = {
  // C1 : `changes_requested -> in_review` passe par draft (2 updates), et le
  // chemin crée une nouvelle version côté action.
  send_to_review: {
    idea: ["draft", "in_review"],
    draft: ["in_review"],
    changes_requested: ["draft", "in_review"],
    // C2 : `approved` volontairement ABSENT. Renvoyer en revue un contenu déjà
    // approuvé doit être un geste explicite (repasser en brouillon d'abord),
    // sinon on efface une approbation cliente par un glisser-déposer.
  },
  back_to_draft: {
    idea: ["draft"],
    in_review: ["draft"],
    changes_requested: ["draft"],
    approved: ["draft"],
    scheduled: ["draft"],
    failed: ["draft"],
    canceled: ["draft"],
  },
  // C3 : autorisé en base par 016.
  back_to_idea: {
    draft: ["idea"],
  },
  schedule: {
    idea: ["scheduled"],
    draft: ["scheduled"],
    approved: ["scheduled"],
    failed: ["scheduled"],
    partially_published: ["scheduled"],
  },
  // Réservé aux clients en `approvalMode: 'auto'` (vérifié par l'action).
  // `idea` absent : approuver une idée sans contenu n'a pas de sens.
  approve: {
    draft: ["approved"],
    in_review: ["approved"],
    changes_requested: ["approved"],
    scheduled: ["approved"],
  },
  cancel: {
    idea: ["canceled"],
    draft: ["canceled"],
    in_review: ["canceled"],
    changes_requested: ["canceled"],
    approved: ["canceled"],
    scheduled: ["canceled"],
    partially_published: ["canceled"],
    failed: ["canceled"],
  },
}

/**
 * Suite d'updates à appliquer pour réaliser `intent` depuis `from`.
 * `null` = intention non réalisable depuis ce statut (l'UI doit le dire, pas
 * tenter et échouer). `[]` = déjà à l'état voulu.
 */
export function pathFor(intent: StatusIntent, from: ContentStatus): ContentStatus[] | null {
  return INTENT_PATHS[intent][from] ?? null
}

/** L'intention est-elle proposable depuis ce statut ? (pour griser un bouton) */
export function canApplyIntent(intent: StatusIntent, from: ContentStatus): boolean {
  return pathFor(intent, from) !== null
}

// Auto-contrôle au chargement : chaque étape déclarée dans INTENT_PATHS doit
// être une transition légale de la matrice. Sans ça, une intention mal écrite
// ne se révélerait qu'au premier 42501 en production, sur l'action d'un client.
for (const [intent, paths] of Object.entries(INTENT_PATHS)) {
  for (const [from, steps] of Object.entries(paths)) {
    let cursor = from as ContentStatus
    for (const step of steps as ContentStatus[]) {
      if (!canTransition(cursor, step)) {
        throw new Error(
          `INTENT_PATHS incoherent : l'intention "${intent}" depuis "${from}" emprunte ` +
            `"${cursor}" -> "${step}", que la matrice 008/016 refuse.`
        )
      }
      cursor = step
    }
  }
}
