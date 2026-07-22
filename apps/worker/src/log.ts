// Journalisation structurée (JSON une ligne) — jamais de token en clair (règle 12).
// Sur Coolify/Sentry, une ligne JSON est parsable et corrélable par job.

type Level = "info" | "warn" | "error"

function emit(level: Level, message: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({
    level,
    message,
    ...fields,
    // Horodatage process (repère de log ; la vérité métier reste now() Postgres).
    at: new Date().toISOString(),
  })
  if (level === "error") process.stderr.write(`${line}\n`)
  else process.stdout.write(`${line}\n`)
}

export const log = {
  info: (message: string, fields?: Record<string, unknown>) => emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit("error", message, fields),
}

/** Réduit une erreur en objet loggable sans secret ni stack verbeuse. */
export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.name, detail: err.message }
  return { error: "unknown", detail: String(err) }
}
