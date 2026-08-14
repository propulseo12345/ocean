import type { Instrumentation } from "next"

// Point d'entrée d'instrumentation du serveur Next (Next 16). Sans Sentry — il
// arrivera dans la passe observabilité dédiée — ceci est le « minimum vital » :
// faire en sorte qu'une erreur serveur laisse UNE TRACE.
//
// État avant : `grep -rn 'console\.'` sur apps/web renvoyait 0 occurrence. Le
// conteneur web ne produisait strictement aucun log applicatif. Quand un Server
// Component lève en production (colonne manquante après migration, RLS qui
// refuse), Next masque le message et n'imprime qu'un digest — que personne ne
// collectait. Ni stack, ni digest à l'écran, ni event, ni ligne dans les logs
// Coolify : le seul moyen de diagnostiquer était de reproduire en local, à
// l'aveugle.
//
// Le `digest` est la clé : c'est le MÊME identifiant que celui affiché à
// l'utilisateur par les error boundaries. Il relie « l'écran d'erreur qu'a vu le
// client » à « la ligne de log du serveur ».
//
// Format volontairement identique à celui du worker (JSON une ligne) : les deux
// apps deviennent lisibles de la même façon dans Coolify, et parsables le jour où
// on branche un collecteur.

// `console.error` et non `process.stderr.write` : ce fichier est aussi bundlé
// pour l'Edge Runtime (le proxy y tourne), où les API Node ne sont pas
// disponibles. `console.error` existe dans les deux runtimes et sort sur stderr
// côté Node — donc dans les logs Coolify.
function line(level: "error", message: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ level, message, ...fields, at: new Date().toISOString() }))
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const err = error as Error & { digest?: string }
  line("error", "server error", {
    // Le digest est le seul lien avec ce que l'utilisateur a sous les yeux.
    digest: err.digest ?? null,
    name: err.name,
    detail: err.message,
    // Chemin de la ROUTE (/clients/[clientId]/grid), pas l'URL concrète : pas
    // d'identifiant client dans les logs.
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    method: request.method,
    stack: err.stack,
  })
}
