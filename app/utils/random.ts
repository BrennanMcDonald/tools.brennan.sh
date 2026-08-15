/**
 * Randomness helpers built on `crypto.getRandomValues` with rejection sampling,
 * so every outcome is equally likely (`Math.random() % n` is not).
 */

function randomWord() {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0]!
}

/** Uniform integer in `[min, max]`, both inclusive. */
export function randomInt(min: number, max: number) {
  const lo = Math.ceil(Math.min(min, max))
  const hi = Math.floor(Math.max(min, max))
  const range = hi - lo + 1

  if (range <= 1) return lo

  if (range > 2 ** 32) {
    // Wider than one 32-bit draw: build a 53-bit float instead.
    const high = randomWord() * 2 ** 21
    const low = randomWord() >>> 11
    return lo + Math.floor(((high + low) / 2 ** 53) * range)
  }

  // Discard the tail that would bias the modulo.
  const limit = Math.floor(2 ** 32 / range) * range
  let value = randomWord()
  while (value >= limit) value = randomWord()

  return lo + (value % range)
}

/** Fisher–Yates, returning a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/** `count` items, either without replacement (default) or with. */
export function sample<T>(items: readonly T[], count: number, allowRepeats = false): T[] {
  if (!items.length || count <= 0) return []
  if (allowRepeats) return Array.from({ length: count }, () => items[randomInt(0, items.length - 1)]!)
  return shuffle(items).slice(0, Math.min(count, items.length))
}

/** Split a list into `groups` as-even-as-possible random teams. */
export function splitIntoGroups<T>(items: readonly T[], groups: number): T[][] {
  const count = Math.max(1, Math.floor(groups))
  const pool = shuffle(items)
  const result: T[][] = Array.from({ length: count }, () => [])
  pool.forEach((item, index) => result[index % count]!.push(item))
  return result
}

export interface DiceGroup {
  die: number
  values: number[]
}

export interface DiceResult {
  groups: DiceGroup[]
  modifier: number
  total: number
}

/**
 * Parses and rolls standard dice notation: `d20`, `2d6+3`, `4d6 + 1d8 - 2`.
 * Returns `null` when the notation cannot be understood.
 */
export function rollDice(notation: string): DiceResult | null {
  const cleaned = notation.trim().toLowerCase().replace(/\s+/g, '')
  if (!cleaned) return null

  // Split into signed terms: "2d6+3" -> ["+2d6", "+3"]
  const terms = cleaned.replace(/^([^+-])/, '+$1').match(/[+-][^+-]+/g)
  if (!terms) return null

  const groups: DiceGroup[] = []
  let modifier = 0

  for (const term of terms) {
    const sign = term[0] === '-' ? -1 : 1
    const body = term.slice(1)

    const dice = body.match(/^(\d*)d(\d+)$/)
    if (dice) {
      const count = dice[1] ? Number(dice[1]) : 1
      const die = Number(dice[2])
      if (!count || !die || count > 200 || die > 1000) return null
      const values = Array.from({ length: count }, () => sign * randomInt(1, die))
      groups.push({ die, values })
      continue
    }

    const constant = body.match(/^\d+$/)
    if (!constant) return null
    modifier += sign * Number(body)
  }

  if (!groups.length && !modifier) return null

  const total = groups.reduce((sum, group) => sum + group.values.reduce((a, b) => a + b, 0), 0) + modifier

  return { groups, modifier, total }
}
