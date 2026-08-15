/** Line and word diffing via longest common subsequence. */

export type DiffKind = 'equal' | 'add' | 'remove' | 'change'

export interface WordPart {
  type: 'equal' | 'add' | 'remove'
  text: string
}

export interface DiffSide {
  line: number
  text: string
  parts?: WordPart[]
}

export interface DiffRow {
  kind: DiffKind
  left?: DiffSide
  right?: DiffSide
}

export interface DiffResult {
  rows: DiffRow[]
  stats: { added: number; removed: number; changed: number; unchanged: number }
  /** True when the inputs were too large for an exact diff. */
  approximate: boolean
}

export interface DiffOptions {
  ignoreWhitespace?: boolean
  ignoreCase?: boolean
}

/** Roughly 8 MB of DP table — beyond this we fall back to a block diff. */
const MAX_CELLS = 2_000_000

type Op = { type: 'equal' | 'remove' | 'add'; a?: number; b?: number }

function lcsOps(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  const width = m + 1
  const table = new Int32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] = a[i] === b[j]
        ? table[(i + 1) * width + j + 1]! + 1
        : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!)
    }
  }

  const ops: Op[] = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', a: i++, b: j++ })
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      ops.push({ type: 'remove', a: i++ })
    } else {
      ops.push({ type: 'add', b: j++ })
    }
  }

  while (i < n) ops.push({ type: 'remove', a: i++ })
  while (j < m) ops.push({ type: 'add', b: j++ })

  return ops
}

/** Word-level diff used to highlight what changed inside a modified line. */
export function diffWords(left: string, right: string) {
  const split = (text: string) => text.split(/(\s+)/).filter(token => token !== '')
  const a = split(left)
  const b = split(right)

  if (a.length * b.length > MAX_CELLS) {
    return {
      left: [{ type: 'remove', text: left }] as WordPart[],
      right: [{ type: 'add', text: right }] as WordPart[]
    }
  }

  const ops = lcsOps(a, b)
  const leftParts: WordPart[] = []
  const rightParts: WordPart[] = []

  for (const op of ops) {
    if (op.type === 'equal') {
      push(leftParts, 'equal', a[op.a!]!)
      push(rightParts, 'equal', b[op.b!]!)
    } else if (op.type === 'remove') {
      push(leftParts, 'remove', a[op.a!]!)
    } else {
      push(rightParts, 'add', b[op.b!]!)
    }
  }

  return { left: leftParts, right: rightParts }
}

function push(parts: WordPart[], type: WordPart['type'], text: string) {
  const last = parts[parts.length - 1]
  if (last && last.type === type) last.text += text
  else parts.push({ type, text })
}

export function diffText(leftText: string, rightText: string, options: DiffOptions = {}): DiffResult {
  const left = leftText.split('\n')
  const right = rightText.split('\n')

  const normalize = (line: string) => {
    let value = line
    if (options.ignoreWhitespace) value = value.trim().replace(/\s+/g, ' ')
    if (options.ignoreCase) value = value.toLowerCase()
    return value
  }

  const a = left.map(normalize)
  const b = right.map(normalize)
  const approximate = a.length * b.length > MAX_CELLS

  const ops: Op[] = approximate ? blockOps(a, b) : lcsOps(a, b)

  // Collapse runs of remove+add into paired "change" rows so both sides line up.
  const rows: DiffRow[] = []
  const stats = { added: 0, removed: 0, changed: 0, unchanged: 0 }

  let index = 0
  while (index < ops.length) {
    const op = ops[index]!

    if (op.type === 'equal') {
      rows.push({
        kind: 'equal',
        left: { line: op.a! + 1, text: left[op.a!]! },
        right: { line: op.b! + 1, text: right[op.b!]! }
      })
      stats.unchanged++
      index++
      continue
    }

    const removals: number[] = []
    const additions: number[] = []
    while (index < ops.length && ops[index]!.type !== 'equal') {
      const current = ops[index]!
      if (current.type === 'remove') removals.push(current.a!)
      else additions.push(current.b!)
      index++
    }

    const pairs = Math.min(removals.length, additions.length)
    for (let i = 0; i < pairs; i++) {
      const leftIndex = removals[i]!
      const rightIndex = additions[i]!
      const words = diffWords(left[leftIndex]!, right[rightIndex]!)
      rows.push({
        kind: 'change',
        left: { line: leftIndex + 1, text: left[leftIndex]!, parts: words.left },
        right: { line: rightIndex + 1, text: right[rightIndex]!, parts: words.right }
      })
      stats.changed++
    }

    for (const leftIndex of removals.slice(pairs)) {
      rows.push({ kind: 'remove', left: { line: leftIndex + 1, text: left[leftIndex]! } })
      stats.removed++
    }

    for (const rightIndex of additions.slice(pairs)) {
      rows.push({ kind: 'add', right: { line: rightIndex + 1, text: right[rightIndex]! } })
      stats.added++
    }
  }

  return { rows, stats, approximate }
}

/**
 * Fallback for very large inputs: keep the matching head and tail, treat the
 * middle as one replaced block. Cheap, and still readable.
 */
function blockOps(a: string[], b: string[]): Op[] {
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++

  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++

  const ops: Op[] = []
  for (let i = 0; i < head; i++) ops.push({ type: 'equal', a: i, b: i })
  for (let i = head; i < a.length - tail; i++) ops.push({ type: 'remove', a: i })
  for (let j = head; j < b.length - tail; j++) ops.push({ type: 'add', b: j })
  for (let i = 0; i < tail; i++) ops.push({ type: 'equal', a: a.length - tail + i, b: b.length - tail + i })

  return ops
}
