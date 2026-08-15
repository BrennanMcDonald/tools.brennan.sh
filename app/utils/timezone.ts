/** Time zone maths done entirely with `Intl` — no library, no data to keep fresh. */

export interface ZoneParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: string
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string) {
  let formatter = partsCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    })
    partsCache.set(timeZone, formatter)
  }
  return formatter
}

/** Wall-clock fields for an instant, as seen in `timeZone`. */
export function zoneParts(timeZone: string, at: Date): ZoneParts {
  const parts = partsFormatter(timeZone).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    // Some ICU builds emit "24" for midnight under h23.
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: get('weekday')
  }
}

/** Offset from UTC in minutes at `at` (positive east of Greenwich). */
export function zoneOffsetMinutes(timeZone: string, at: Date) {
  const { year, month, day, hour, minute } = zoneParts(timeZone, at)
  const asUtc = Date.UTC(year, month - 1, day, hour, minute)
  // Ignore seconds on both sides so the difference lands on whole minutes.
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000)
}

/** `+05:30`, `-08:00`, `UTC`. */
export function formatOffset(minutes: number) {
  if (!minutes) return 'UTC'
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${pad(abs / 60)}:${pad(abs % 60)}`
}

/** Short zone name such as `PDT`, `CEST`, `GMT+8`. */
export function zoneAbbreviation(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(at)
  return parts.find(part => part.type === 'timeZoneName')?.value ?? ''
}

/** `Los Angeles` from `America/Los_Angeles`. */
export function zoneLabel(timeZone: string) {
  return timeZone.split('/').pop()!.replace(/_/g, ' ')
}

/** Every IANA zone the browser knows, with a small fallback for old engines. */
export function listTimeZones(): string[] {
  const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  if (supported) {
    try {
      return supported('timeZone')
    } catch {
      // fall through
    }
  }

  return [
    'UTC',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Europe/Madrid',
    'Europe/Warsaw',
    'Europe/Athens',
    'Europe/Moscow',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Pacific/Auckland'
  ]
}

export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Milliseconds since epoch for a wall-clock time in a given zone. */
export function instantFromZonedTime(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
) {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute)
  // Two passes settle DST boundaries, where the first guess can be an hour off.
  let instant = guessUtc - zoneOffsetMinutes(timeZone, new Date(guessUtc)) * 60_000
  instant = guessUtc - zoneOffsetMinutes(timeZone, new Date(instant)) * 60_000
  return instant
}
