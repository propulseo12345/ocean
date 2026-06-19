// Diff de légendes entre versions : comparaison mot à mot (LCS) pour
// surligner ajouts et suppressions. Calcul léger — légendes courtes.

export type DiffKind = "same" | "added" | "removed"

export interface DiffSegment {
  kind: DiffKind
  text: string
}

/** Découpe en mots + espaces (les espaces restent des tokens à part). */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0)
}

/** Ajoute un segment en fusionnant avec le précédent s'il est de même nature. */
function push(out: DiffSegment[], kind: DiffKind, text: string): void {
  const last = out[out.length - 1]
  if (last && last.kind === kind) {
    last.text += text
  } else {
    out.push({ kind, text })
  }
}

/** Diff mot à mot entre deux textes (segments fusionnés par nature). */
export function diffWords(before: string, after: string): DiffSegment[] {
  const a = tokenize(before)
  const b = tokenize(after)

  // Table LCS (longest common subsequence) sur les tokens.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  )
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const out: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(out, "same", a[i])
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(out, "removed", a[i])
      i += 1
    } else {
      push(out, "added", b[j])
      j += 1
    }
  }
  while (i < a.length) {
    push(out, "removed", a[i])
    i += 1
  }
  while (j < b.length) {
    push(out, "added", b[j])
    j += 1
  }
  return out
}
