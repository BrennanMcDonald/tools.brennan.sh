<script setup lang="ts">
definePageMeta({
  tool: {
    title: 'Time Zone Planner',
    description: 'Line up a day across cities, see who is still awake, and copy a meeting time everyone can read.',
    icon: 'i-lucide-globe',
    category: 'Time',
    keywords: ['timezone', 'meeting', 'utc', 'offset', 'world clock', 'standup', 'overlap'],
    order: 20
  }
})

const { copy } = useCopy()

const settings = useStored('timezones', { workStart: 9, workEnd: 17, hour12: false })
const extraZones = useStoredValue<string[]>('timezones.list', ['America/New_York', 'Europe/London', 'Asia/Tokyo'])

const homeZone = ref('UTC')
const dateValue = ref('')
const selectedHour = ref(9)
const zoneQuery = ref('')

const allZoneNames = shallowRef<string[]>([])

onMounted(() => {
  homeZone.value = localTimeZone()
  allZoneNames.value = listTimeZones()

  const now = new Date()
  const parts = zoneParts(homeZone.value, now)
  dateValue.value = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  selectedHour.value = parts.hour
})

const zones = computed(() => [homeZone.value, ...extraZones.value.filter(zone => zone !== homeZone.value)])

const referenceDate = computed(() => {
  const [year, month, day] = dateValue.value.split('-').map(Number)
  if (!year || !month || !day) return null
  return { year, month, day }
})

/** One instant per hour of the reference day, anchored to the home zone. */
const hourInstants = computed(() => {
  const date = referenceDate.value
  if (!date) return []
  return Array.from({ length: 24 }, (_, hour) =>
    instantFromZonedTime(homeZone.value, date.year, date.month, date.day, hour)
  )
})

type Slot = 'work' | 'fringe' | 'sleep'

function slotFor(hour: number): Slot {
  const { workStart, workEnd } = settings.value
  if (hour >= workStart && hour < workEnd) return 'work'
  if (hour >= workStart - 2 && hour < workEnd + 4) return 'fringe'
  return 'sleep'
}

const rows = computed(() =>
  zones.value.map((zone) => {
    const cells = hourInstants.value.map((instant) => {
      const parts = zoneParts(zone, new Date(instant))
      return { hour: parts.hour, day: parts.day, month: parts.month, slot: slotFor(parts.hour) }
    })

    const reference = new Date(hourInstants.value[selectedHour.value] ?? Date.now())
    const parts = zoneParts(zone, reference)
    const offset = zoneOffsetMinutes(zone, reference)
    const homeOffset = zoneOffsetMinutes(homeZone.value, reference)

    return {
      zone,
      label: zoneLabel(zone),
      abbreviation: zoneAbbreviation(zone, reference),
      offset: formatOffset(offset),
      difference: (offset - homeOffset) / 60,
      cells,
      selected: parts,
      isHome: zone === homeZone.value
    }
  })
)

/** How many zones are inside working hours for each column. */
const overlapScores = computed(() =>
  hourInstants.value.map((_, hour) => rows.value.filter(row => row.cells[hour]?.slot === 'work').length)
)

const bestScore = computed(() => Math.max(0, ...overlapScores.value))

function formatHour(hour: number) {
  if (!settings.value.hour12) return `${pad(hour)}:00`
  const suffix = hour < 12 ? 'am' : 'pm'
  const value = hour % 12 === 0 ? 12 : hour % 12
  return `${value}${suffix}`
}

const summary = computed(() =>
  rows.value
    .map(row => `${formatHour(row.selected.hour)} ${row.abbreviation} (${row.label})`)
    .join(' · ')
)

const zoneOptions = computed(() => {
  const query = zoneQuery.value.trim().toLowerCase()
  const available = allZoneNames.value.filter(zone => !zones.value.includes(zone))
  const matches = query ? available.filter(zone => zone.toLowerCase().includes(query)) : available
  return matches.slice(0, 50)
})

function addZone(zone: string) {
  if (!zone || zones.value.includes(zone)) return
  extraZones.value = [...extraZones.value, zone]
  zoneQuery.value = ''
}

function removeZone(zone: string) {
  extraZones.value = extraZones.value.filter(entry => entry !== zone)
}

function jumpToToday() {
  const parts = zoneParts(homeZone.value, new Date())
  dateValue.value = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  selectedHour.value = parts.hour
}

const slotClasses: Record<Slot, string> = {
  work: 'bg-success/25 text-highlighted',
  fringe: 'bg-warning/20 text-toned',
  sleep: 'bg-elevated/70 text-dimmed'
}
</script>

<template>
  <ToolPage wide>
    <template #actions>
      <UButton icon="i-lucide-copy" color="neutral" variant="subtle" size="sm" label="Copy time" @click="copy(summary)" />
    </template>

    <ToolPanel>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Date" class="w-44">
          <UInput v-model="dateValue" type="date" class="w-full" />
        </UFormField>

        <UButton icon="i-lucide-calendar-clock" label="Now" color="neutral" variant="subtle" @click="jumpToToday" />

        <UFormField label="Working hours" class="flex-1 min-w-52">
          <div class="flex items-center gap-2">
            <UInput v-model.number="settings.workStart" type="number" min="0" max="23" class="w-20" />
            <span class="text-sm text-dimmed">to</span>
            <UInput v-model.number="settings.workEnd" type="number" min="1" max="24" class="w-20" />
          </div>
        </UFormField>

        <USwitch v-model="settings.hour12" label="12-hour" class="pb-2" />
      </div>
    </ToolPanel>

    <ToolPanel flush>
      <template #header>
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <UIcon name="i-lucide-clock" class="size-4 shrink-0 text-muted" />
          <h2 class="truncate text-sm font-semibold text-highlighted">
            {{ formatHour(selectedHour) }} in {{ zoneLabel(homeZone) }}
          </h2>
        </div>
      </template>

      <div class="overflow-x-auto">
        <div class="min-w-[52rem] p-4">
          <!-- hour ruler -->
          <div class="mb-1 flex items-center gap-3">
            <div class="w-40 shrink-0" />
            <div class="grid flex-1 gap-px" style="grid-template-columns: repeat(24, minmax(0, 1fr))">
              <button
                v-for="hour in 24"
                :key="hour"
                type="button"
                class="rounded-t-sm py-1 text-[10px] tabular transition-colors"
                :class="selectedHour === hour - 1 ? 'bg-primary text-inverted' : 'text-dimmed hover:bg-elevated'"
                @click="selectedHour = hour - 1"
              >
                {{ hour - 1 }}
              </button>
            </div>
          </div>

          <!-- one row per zone -->
          <div class="flex flex-col gap-1">
            <div v-for="row in rows" :key="row.zone" class="flex items-center gap-3">
              <div class="flex w-40 shrink-0 items-center gap-1.5">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ row.label }}
                    <UIcon v-if="row.isHome" name="i-lucide-house" class="size-3 text-dimmed" />
                  </p>
                  <p class="truncate text-[11px] text-dimmed">
                    {{ row.abbreviation }} · {{ row.offset }}
                    <span v-if="!row.isHome">({{ row.difference >= 0 ? '+' : '' }}{{ row.difference }}h)</span>
                  </p>
                </div>
                <UButton
                  v-if="!row.isHome"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Remove ${row.label}`"
                  @click="removeZone(row.zone)"
                />
              </div>

              <div class="grid flex-1 gap-px" style="grid-template-columns: repeat(24, minmax(0, 1fr))">
                <button
                  v-for="(cell, index) in row.cells"
                  :key="index"
                  type="button"
                  class="tabular rounded-sm py-1.5 text-[11px] transition-all"
                  :class="[
                    slotClasses[cell.slot],
                    selectedHour === index ? 'ring-2 ring-primary ring-inset font-semibold' : 'hover:brightness-110'
                  ]"
                  :title="`${cell.hour}:00 in ${row.label}`"
                  @click="selectedHour = index"
                >
                  {{ cell.hour }}
                </button>
              </div>
            </div>
          </div>

          <!-- overlap meter -->
          <div class="mt-2 flex items-center gap-3">
            <p class="w-40 shrink-0 text-[11px] uppercase tracking-wider text-dimmed">Overlap</p>
            <div class="grid flex-1 gap-px" style="grid-template-columns: repeat(24, minmax(0, 1fr))">
              <div
                v-for="(score, index) in overlapScores"
                :key="index"
                class="h-1.5 rounded-full"
                :class="score && score === bestScore ? 'bg-primary' : score ? 'bg-primary/30' : 'bg-elevated'"
                :title="`${score} of ${rows.length} in working hours`"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-success/40" /> working hours</span>
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-warning/30" /> early or late</span>
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-elevated" /> asleep</span>
        </div>
      </template>
    </ToolPanel>

    <div class="grid gap-4 lg:grid-cols-2">
      <ToolPanel title="Selected time" icon="i-lucide-calendar-check">
        <ul class="flex flex-col gap-2">
          <li v-for="row in rows" :key="row.zone" class="flex items-baseline gap-3">
            <span class="tabular w-20 shrink-0 text-lg font-semibold text-highlighted">
              {{ formatHour(row.selected.hour) }}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm text-toned">{{ row.label }}</span>
            <span class="shrink-0 text-xs text-dimmed">{{ row.selected.weekday }} {{ row.selected.day }}</span>
          </li>
        </ul>
      </ToolPanel>

      <ToolPanel title="Add a city" icon="i-lucide-plus" description="Search the IANA time zone list">
        <UInput v-model="zoneQuery" icon="i-lucide-search" placeholder="Berlin, Kolkata, Auckland…" class="w-full" />

        <div class="mt-3 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          <button
            v-for="zone in zoneOptions"
            :key="zone"
            type="button"
            class="flex items-center justify-between rounded-md px-2 py-1.5 text-start text-sm text-toned transition-colors hover:bg-elevated hover:text-highlighted"
            @click="addZone(zone)"
          >
            <span class="truncate">{{ zone.replace(/_/g, ' ') }}</span>
            <UIcon name="i-lucide-plus" class="size-4 shrink-0 text-dimmed" />
          </button>

          <p v-if="!zoneOptions.length" class="px-2 py-4 text-center text-sm text-dimmed">No matching zones.</p>
        </div>
      </ToolPanel>
    </div>
  </ToolPage>
</template>
