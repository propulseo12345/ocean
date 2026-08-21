// Journal applicatif côté web, même format JSON une ligne que le worker
// (`apps/worker/src/log.ts`) et que `instrumentation.ts`. Les deux apps
// deviennent lisibles de la même façon dans Coolify, et parsables le jour où on
// branche un collecteur.
//
// `console.*` et non `process.stderr.write` : ce module peut être atteint depuis
// l'Edge Runtime (le proxy y tourne), où les API Node n'existent pas.
//
// ⚠ Ne JAMAIS passer ici un token, une légende ou une donnée client : des
// identifiants et des statuts, rien d'autre (règle 12, §10).

type Level = "info" | "warn" | "error"

function line(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const payload = JSON.stringify({ level, message, ...fields, at: new Date().toISOString() })
  if (level === "error") console.error(payload)
  else if (level === "warn") console.warn(payload)
  else console.log(payload)
}

export const log = {
  info: (message: string, fields?: Record<string, unknown>) => line("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => line("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => line("error", message, fields),
}
