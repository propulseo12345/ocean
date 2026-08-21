// Fabrication du slug d'organisation (ticket P7-4).
//
// LE DÉFAUT
// ---------
// `signUpWithPassword` construisait un slug à la volée et appelait
// `create_organization` SANS lire son retour (`await supabase.rpc(...)`, résultat
// jeté). Or `organizations.slug` est unique : deux personnes prénommées « Marie
// Dupont » produisent le même slug, la seconde reçoit un 23505 — et l'ancien code
// redirigeait quand même vers `/dashboard`, où `getActiveOrg` ne trouvait aucune
// organisation et renvoyait sur `/onboarding`, qui n'existait pas. Un 404 nu au
// bout d'une inscription réussie.
//
// La normalisation est isolée ici pour être testable : c'est elle qui décide si
// deux noms entrent en collision.

/** Longueur maximale du slug de base, avant suffixe de désambiguïsation. */
const LONGUEUR_MAX = 40

/** Diacritiques combinants, isolés par `normalize("NFD")`. */
const COMBINANTS = /[̀-ͯ]/g

/** Tout ce qui n'est ni lettre ASCII ni chiffre devient un séparateur. */
const NON_ALPHANUM = /[^a-z0-9]+/g

/**
 * Normalise un nom en slug : minuscules, sans diacritiques, séparateurs uniques.
 *
 * `normalize("NFD")` décompose « é » en « e » suivi d'un accent combinant, que
 * `COMBINANTS` retire — c'est ce qui fait de « Café Renard » un « cafe-renard »
 * et non un « caf-renard ».
 */
export function slugify(nom: string): string {
  const base = nom
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINANTS, "")
    .replace(NON_ALPHANUM, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LONGUEUR_MAX)
    // Le `slice` peut retomber sur un tiret en queue.
    .replace(/-+$/g, "")

  return base || "organisation"
}

/**
 * Suite de slugs à essayer, du plus propre au plus désambiguïsé.
 *
 * On ne demande PAS à la base « ce slug est-il libre ? » avant d'insérer : entre
 * la lecture et l'écriture, quelqu'un d'autre peut le prendre — et le ferait
 * précisément dans le cas qui nous intéresse, deux inscriptions simultanées. On
 * insère, et on réessaie sur collision : la contrainte unique est l'arbitre.
 */
export function slugCandidates(nom: string, tentatives = 5): string[] {
  const base = slugify(nom)
  const suite = [base]
  for (let i = 2; i <= tentatives; i++) {
    const suffixe = `-${i}`
    // Tronqué pour laisser la place au suffixe sans dépasser LONGUEUR_MAX.
    const tronque = base.slice(0, LONGUEUR_MAX - suffixe.length).replace(/-+$/g, "")
    suite.push(`${tronque}${suffixe}`)
  }
  return suite
}
