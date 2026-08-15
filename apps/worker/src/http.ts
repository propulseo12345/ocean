// Transport HTTP du worker — un TYPE, pas une implémentation.
//
// Aucun module de publication n'appelle `fetch` global. Tous reçoivent une
// fonction `fetch`-compatible en paramètre de fabrique, pour une raison qui
// n'est pas cosmétique : sans app Meta ni identifiants TikTok, le SEUL moyen de
// prouver que le dialogue avec la plateforme est correct est de le rejouer
// contre un faux transport qui répond les formes documentées. Un `fetch` global
// rendrait le publisher intestable, et la phase 6 se réduirait à du code écrit
// mais jamais exécuté.
//
// `globalThis.fetch` (Node 22) satisfait ce type tel quel : la fabrique par
// défaut n'est pas une couche d'indirection, c'est le vrai réseau.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Tronque un corps de réponse avant de le mettre dans un message d'erreur.
 *
 * Les erreurs de fournisseur voyagent jusqu'à `publish_jobs.last_error`, que
 * l'app affiche. Un corps de 100 ko d'HTML (page d'erreur d'un proxy) y serait
 * illisible et gonflerait la ligne pour rien.
 */
export function truncateBody(body: string, max = 500): string {
  return body.length <= max ? body : `${body.slice(0, max)}…`
}

/**
 * Retire d'un texte les valeurs secrètes qu'on vient d'y envoyer.
 *
 * POURQUOI CE N'EST PAS DE LA PARANOÏA DÉCORATIVE
 * ------------------------------------------------
 * « Aucun token dans un log, jamais » est facile à tenir tant qu'on écrit les
 * logs soi-même. Le trou est ailleurs : le corps d'erreur du FOURNISSEUR. Meta
 * renvoie régulièrement l'URL appelée ou le paramètre fautif dans
 * `error.message`, et cette chaîne part telle quelle dans
 * `publish_jobs.last_error`, que l'app affiche. Un `?access_token=EAAG…` recopié
 * depuis une erreur est exactement la fuite que la règle 12 interdit — et elle
 * arrive par un chemin que personne ne relit.
 *
 * On ne devine pas ce qui ressemble à un token : on efface les valeurs qu'on
 * CONNAÎT, celles qu'on vient de mettre dans la requête. Les chaînes courtes
 * sont ignorées (une valeur de 5 caractères produirait des remplacements
 * absurdes dans un texte quelconque).
 */
export function redactSecrets(text: string, secrets: (string | null | undefined)[]): string {
  let out = text
  for (const secret of secrets) {
    if (!secret || secret.length < 8) continue
    out = out.split(secret).join("«redacted»")
  }
  return out
}
