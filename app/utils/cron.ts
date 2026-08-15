/** Standard 5-field cron: minute, hour, day-of-month, month, day-of-week. */

export interface ParsedCron {
  minutes: number[]
  hours: number[]
  daysOfMonth: number[]
  months: number[]
  daysOfWeek: number[]
  /** Vixie cron ORs day-of-month with day-of-week when both are restricted. */
  domRestricted: boolean
  dowRestricted: boolean
}

export type CronResult =
  | { ok: true; cron: ParsedCron }
  | { ok: false; error: string; fieldIndex?: number }

export const CRON_FIELDS = ['minute', 'hour', 'day of month', 'month', 'day of week'] as const

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *'
}

export const CRON_PRESETS = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Hourly on the hour', expression: '0 * * * *' },
  { label: 'Daily at 09:00', expression: '0 9 * * *' },
  { label: 'Weekdays at 08:30', expression: '30 8 * * 1-5' },
  { label: 'Weekly, Sunday 03:00', expression: '0 3 * * 0' },
  { label: 'First of the month', expression: '0 0 1 * *' },
  { label: 'Every 6 hours', expression: '0 */6 * * *' }
]

interface FieldSpec {
  min: number
  max: number
  names?: string[]
}

const SPECS: FieldSpec[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12, names: MONTH_NAMES },
  { min: 0, max: 6, names: DAY_NAMES }
]

function parseValue(token: string, spec: FieldSpec, index: number) {
  const lower = token.toLowerCase()

  if (spec.names) {
    const named = spec.names.indexOf(lower)
    if (named !== -1) return named + spec.min
  }

  if (!/^\d+$/.test(token)) return null

  let value = Number(token)
  // Both 0 and 7 mean Sunday.
  if (index === 4 && value === 7) value = 0
  if (value < spec.min || value > spec.max) return null

  return value
}

function parseField(text: string, index: number): number[] | string {
  const spec = SPECS[index]!
  const name = CRON_FIELDS[index]!
  const values = new Set<number>()

  for (const part of text.split(',')) {
    if (!part) return `Empty value in the ${name} field`

    const [rangeText, stepText, ...rest] = part.split('/')
    if (rest.length) return `Too many "/" in the ${name} field`

    let step = 1
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText) || Number(stepText) < 1) return `"${stepText}" is not a valid step in the ${name} field`
      step = Number(stepText)
    }

    let start: number
    let end: number

    if (rangeText === '*' || rangeText === '?') {
      start = spec.min
      end = spec.max
    } else {
      const bounds = rangeText!.split('-')
      if (bounds.length > 2) return `"${rangeText}" is not a valid range in the ${name} field`

      const from = parseValue(bounds[0]!, spec, index)
      if (from === null) return `"${bounds[0]}" is out of range in the ${name} field (${spec.min}–${spec.max})`
      start = from

      if (bounds.length === 2) {
        const to = parseValue(bounds[1]!, spec, index)
        if (to === null) return `"${bounds[1]}" is out of range in the ${name} field (${spec.min}–${spec.max})`
        end = to
      } else {
        // "5/10" means "from 5 to the end, every 10"; a bare "5" is just 5.
        end = stepText === undefined ? start : spec.max
      }
    }

    if (end < start) {
      // Wrap-around ranges such as FRI-MON.
      for (let value = start; value <= spec.max; value += step) values.add(value)
      for (let value = spec.min; value <= end; value += step) values.add(value)
      continue
    }

    for (let value = start; value <= end; value += step) values.add(value)
  }

  if (!values.size) return `The ${name} field matches nothing`

  return [...values].sort((a, b) => a - b)
}

export function parseCron(input: string): CronResult {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return { ok: false, error: 'Enter a cron expression' }

  const expression = MACROS[trimmed] ?? trimmed
  if (trimmed.startsWith('@') && !MACROS[trimmed]) {
    return { ok: false, error: `Unknown macro "${trimmed}". Try @daily, @hourly, @weekly, @monthly or @yearly.` }
  }

  const fields = expression.split(/\s+/)
  if (fields.length === 6) {
    return { ok: false, error: 'This looks like a 6-field expression with seconds. Drop the first field for standard cron.' }
  }
  if (fields.length !== 5) {
    return { ok: false, error: `Expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}` }
  }

  const parsed: number[][] = []
  for (let index = 0; index < 5; index++) {
    const result = parseField(fields[index]!, index)
    if (typeof result === 'string') return { ok: false, error: result, fieldIndex: index }
    parsed.push(result)
  }

  return {
    ok: true,
    cron: {
      minutes: parsed[0]!,
      hours: parsed[1]!,
      daysOfMonth: parsed[2]!,
      months: parsed[3]!,
      daysOfWeek: parsed[4]!,
      domRestricted: fields[2] !== '*' && fields[2] !== '?',
      dowRestricted: fields[4] !== '*' && fields[4] !== '?'
    }
  }
}

function dayMatches(cron: ParsedCron, date: Date) {
  const dom = cron.daysOfMonth.includes(date.getDate())
  const dow = cron.daysOfWeek.includes(date.getDay())

  if (cron.domRestricted && cron.dowRestricted) return dom || dow
  if (cron.domRestricted) return dom
  if (cron.dowRestricted) return dow
  return true
}

/** The next `count` local times the expression fires, starting after `from`. */
export function nextCronRuns(cron: ParsedCron, from = new Date(), count = 10): Date[] {
  const runs: Date[] = []
  const cursor = new Date(from.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const horizon = from.getFullYear() + 50
  let guard = 0

  while (runs.length < count && guard++ < 1_000_000 && cursor.getFullYear() <= horizon) {
    if (!cron.months.includes(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1)
      cursor.setHours(0, 0, 0, 0)
      continue
    }

    if (!dayMatches(cron, cursor)) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(0, 0, 0, 0)
      continue
    }

    if (!cron.hours.includes(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0)
      continue
    }

    if (!cron.minutes.includes(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0)
      continue
    }

    runs.push(new Date(cursor.getTime()))
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0)
  }

  return runs
}

/** Returns the common step if the values form an even series, otherwise null. */
function detectStep(values: number[], min: number, max: number) {
  if (values.length < 2 || values[0] !== min) return null

  const step = values[1]! - values[0]!
  for (let i = 1; i < values.length; i++) {
    if (values[i]! - values[i - 1]! !== step) return null
  }

  // The series has to run out at the top of the range, not stop early.
  return values[values.length - 1]! + step > max ? step : null
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function describeTime(cron: ParsedCron) {
  const everyMinute = cron.minutes.length === 60
  const everyHour = cron.hours.length === 24

  if (everyMinute && everyHour) return 'Every minute'

  const minuteStep = detectStep(cron.minutes, 0, 59)
  const hourStep = detectStep(cron.hours, 0, 23)

  if (minuteStep && everyHour) return `Every ${minuteStep} minutes`

  if (cron.minutes.length === 1 && cron.hours.length === 1) {
    return `At ${pad(cron.hours[0]!)}:${pad(cron.minutes[0]!)}`
  }

  if (cron.minutes.length === 1 && hourStep) {
    return `At minute ${cron.minutes[0]} past every ${hourStep}${hourStep === 1 ? '' : 'th'} hour`
  }

  if (cron.minutes.length === 1 && cron.hours.length <= 6) {
    return `At ${joinList(cron.hours.map(hour => `${pad(hour)}:${pad(cron.minutes[0]!)}`))}`
  }

  const minutePart = everyMinute
    ? 'Every minute'
    : minuteStep
      ? `Every ${minuteStep} minutes`
      : `At minute ${joinList(cron.minutes.map(String))}`

  if (everyHour) return `${minutePart} of every hour`
  if (hourStep) return `${minutePart} past every ${hourStep}th hour`

  return `${minutePart} past hour ${joinList(cron.hours.map(String))}`
}

function describeDays(cron: ParsedCron) {
  const parts: string[] = []

  if (cron.dowRestricted) {
    const days = cron.daysOfWeek.map(day => DAY_LABELS[day]!)
    const isWeekdays = cron.daysOfWeek.join() === '1,2,3,4,5'
    const isWeekend = cron.daysOfWeek.join() === '0,6'
    parts.push(isWeekdays ? 'on weekdays' : isWeekend ? 'on weekends' : `on ${joinList(days)}`)
  }

  if (cron.domRestricted) {
    const step = detectStep(cron.daysOfMonth, 1, 31)
    parts.push(step ? `every ${step} days` : `on day ${joinList(cron.daysOfMonth.map(String))} of the month`)
  }

  const joiner = cron.domRestricted && cron.dowRestricted ? ' or ' : ' '
  const days = parts.join(joiner)

  if (cron.months.length === 12) return days

  const months = joinList(cron.months.map(month => MONTH_LABELS[month - 1]!))
  return days ? `${days} in ${months}` : `in ${months}`
}

/** A plain-English sentence for the expression. */
export function describeCron(cron: ParsedCron) {
  const days = describeDays(cron)
  return days ? `${describeTime(cron)}, ${days}` : describeTime(cron)
}
