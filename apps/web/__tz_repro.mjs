function dateFromKey(key) {
  return new Date(`${key}T12:00:00.000Z`)
}

function keyFromParts(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function keyFromUtcDate(d) {
  return keyFromParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function addDaysKey(key, days) {
  const d = dateFromKey(key)
  d.setUTCDate(d.getUTCDate() + days)
  return keyFromUtcDate(d)
}

function startOfWeekKey(key) {
  const dow = dateFromKey(key).getUTCDay()
  return addDaysKey(key, dow === 0 ? -6 : 1 - dow)
}

function endOfWeekKey(key) {
  return addDaysKey(startOfWeekKey(key), 6)
}

function daysBetweenInclusive(start, end) {
  const days = []
  let cursor = start
  while (cursor <= end) {
    days.push(cursor)
    cursor = addDaysKey(cursor, 1)
  }
  return days
}

function monthGridKeys(cursor) {
  const first = keyFromParts(cursor.year, cursor.month, 1)
  const lastDay = new Date(Date.UTC(cursor.year, cursor.month + 1, 0, 12)).getUTCDate()
  const last = keyFromParts(cursor.year, cursor.month, lastDay)
  return daysBetweenInclusive(startOfWeekKey(first), endOfWeekKey(last))
}

function weekGridKeys(anchorKey) {
  const start = startOfWeekKey(anchorKey)
  return daysBetweenInclusive(start, addDaysKey(start, 6))
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
console.log(
  "TZ =",
  process.env.TZ,
  "| getTimezoneOffset(June, min) =",
  new Date("2026-06-11T12:00:00Z").getTimezoneOffset()
)

console.log("\n--- monthGridKeys(June 2026) first 8 keys ---")
const grid = monthGridKeys({ year: 2026, month: 5 })
console.log(grid.slice(0, 8).join("  "))

console.log("\n--- weekGridKeys('2026-06-11') (Thu 11 June) : column -> key ---")
const wk = weekGridKeys("2026-06-11")
wk.forEach((k, i) => {
  const realDow = new Date(`${k}T12:00:00Z`).getUTCDay()
  const realName = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][realDow]
  console.log(`  col ${WEEKDAY_LABELS[i]}  -> ${k}  (that date is really a ${realName})`)
})
const idx = wk.indexOf("2026-06-11")
console.log(
  `\n11 June (a Thursday) sits under column: ${
    idx >= 0 ? WEEKDAY_LABELS[idx] : "ABSENT FROM GRID"
  }  (correct = Jeu)`
)
