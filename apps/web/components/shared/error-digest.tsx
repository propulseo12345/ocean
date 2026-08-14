// Référence d'incident affichée sous un écran d'erreur.
//
// Next masque le message des erreurs serveur en production et n'expose qu'un
// `digest`. C'est le SEUL identifiant qui relie l'écran vu par l'utilisateur à la
// ligne de log du serveur (voir apps/web/instrumentation.ts, qui le journalise).
// Les error boundaries le recevaient et le jetaient : quand Étienne recevait
// « ça marche pas », il n'avait littéralement rien à chercher.
export function ErrorDigest({ digest }: { digest?: string }) {
  if (!digest) return null
  return (
    <p className="mt-3 font-mono text-muted-foreground/70 text-xs">
      Reference : <span className="select-all">{digest}</span>
    </p>
  )
}
