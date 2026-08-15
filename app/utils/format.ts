export function pad(value: number, length = 2) {
  return String(Math.floor(Math.abs(value))).padStart(length, '0')
}

/** `1:04:09` / `04:09` — used by the timer. */
export function formatClock(ms: number, forceHours = false) {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  return hours || forceHours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** `04:09.72` — used by the stopwatch. */
export function formatStopwatch(ms: number) {
  const total = Math.max(0, ms)
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const hundredths = Math.floor((total % 1000) / 10)
  const head = hours ? `${hours}:${pad(minutes)}` : pad(minutes)

  return `${head}:${pad(seconds)}.${pad(hundredths)}`
}

/** `2 days`, `7 hours`, `just now` — coarse, human-facing durations. */
export function formatRelative(ms: number) {
  const abs = Math.abs(ms)
  const units: Array<[number, string]> = [
    [31_536_000_000, 'year'],
    [2_592_000_000, 'month'],
    [604_800_000, 'week'],
    [86_400_000, 'day'],
    [3_600_000, 'hour'],
    [60_000, 'minute'],
    [1000, 'second']
  ]

  for (const [size, name] of units) {
    if (abs >= size) {
      const value = Math.round(abs / size)
      return `${value} ${name}${value === 1 ? '' : 's'}`
    }
  }

  return 'less than a second'
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
