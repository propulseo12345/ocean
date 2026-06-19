// Primitive partagée de conversion fuseau : une date/heure murale d'un fuseau
// donné → instant UTC (ISO). Sans dépendance (Intl + algorithme à double passe
// pour converger autour des transitions DST). Source unique pour le composer et
// le calendrier — toute divergence ici = décalage horaire silencieux.

function tzOffsetMs(utcDate: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcDate)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  )
  return asUtc - utcDate.getTime()
}

/** Instant UTC (ISO) correspondant à une date/heure murale dans un fuseau. */
export function zonedWallToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): string {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const offset = tzOffsetMs(new Date(guess), timeZone)
  const refined = tzOffsetMs(new Date(guess - offset), timeZone)
  return new Date(guess - refined).toISOString()
}
