<script setup lang="ts">
definePageMeta({
  tool: {
    title: 'Cron Explainer',
    description: 'Read a cron expression in plain English and see exactly when it fires next, in your own time zone.',
    icon: 'i-lucide-calendar-clock',
    category: 'Developer',
    keywords: ['crontab', 'schedule', 'cron expression', 'next run', 'kubernetes cronjob', 'timer'],
    order: 10
  }
})

const { copy } = useCopy()

const expression = useStoredValue('cron.expression', '30 8 * * 1-5')
const now = ref(new Date())

let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => (ticker = setInterval(() => (now.value = new Date()), 30_000)))
onUnmounted(() => clearInterval(ticker))

const parsed = computed(() => parseCron(expression.value))
const description = computed(() => (parsed.value.ok ? describeCron(parsed.value.cron) : ''))
const runs = computed(() => (parsed.value.ok ? nextCronRuns(parsed.value.cron, now.value, 8) : []))

const fields = computed(() => {
  const parts = expression.value.trim().toLowerCase().split(/\s+/)
  return CRON_FIELDS.map((name, index) => ({
    name,
    value: parts.length === 5 ? parts[index] ?? '' : '',
    invalid: !parsed.value.ok && parsed.value.fieldIndex === index
  }))
})

const summary = computed(() =>
  runs.value.map(run => run.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })).join('\n')
)

const timeZoneName = computed(() => localTimeZone())
</script>

<template>
  <ToolPage>
    <ToolPanel title="Expression" icon="i-lucide-terminal">
      <template #actions>
        <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" @click="copy(expression)" />
      </template>

      <UInput
        v-model="expression"
        placeholder="*/5 * * * *"
        autocomplete="off"
        spellcheck="false"
        size="xl"
        class="w-full"
        :ui="{ base: 'font-mono tracking-wide' }"
      />

      <div class="mt-3 grid grid-cols-5 gap-1.5">
        <div
          v-for="field in fields"
          :key="field.name"
          class="rounded-md px-2 py-1.5 text-center"
          :class="field.invalid ? 'bg-error/10 ring ring-error/30' : 'bg-elevated/60'"
        >
          <p class="truncate font-mono text-sm text-highlighted">{{ field.value || '—' }}</p>
          <p class="truncate text-[10px] uppercase tracking-wide text-dimmed">{{ field.name }}</p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        <UButton
          v-for="preset in CRON_PRESETS"
          :key="preset.expression"
          :label="preset.label"
          color="neutral"
          variant="outline"
          size="xs"
          @click="expression = preset.expression"
        />
      </div>
    </ToolPanel>

    <UAlert
      v-if="!parsed.ok"
      icon="i-lucide-circle-alert"
      color="error"
      variant="subtle"
      :title="parsed.error"
    />

    <template v-else>
      <ToolPanel>
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-message-square-quote" class="mt-0.5 size-5 shrink-0 text-primary" />
          <p class="text-lg font-medium text-highlighted">{{ description }}</p>
        </div>
      </ToolPanel>

      <ToolPanel title="Next runs" :description="timeZoneName" icon="i-lucide-calendar-days" flush>
        <template #actions>
          <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" label="Copy" @click="copy(summary)" />
        </template>

        <ul v-if="runs.length" class="divide-y divide-default">
          <li v-for="(run, index) in runs" :key="index" class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
            <span class="tabular w-6 shrink-0 text-xs text-dimmed">{{ index + 1 }}</span>
            <span class="min-w-0 flex-1 text-sm font-medium text-highlighted">
              {{ run.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
            </span>
            <span class="text-xs text-muted">in {{ formatRelative(run.getTime() - now.getTime()) }}</span>
          </li>
        </ul>

        <p v-else class="px-4 py-6 text-center text-sm text-muted">
          This expression never fires — check that the day and month can actually occur.
        </p>
      </ToolPanel>
    </template>

    <ToolPanel title="Syntax" icon="i-lucide-book-open" flush>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[30rem] text-sm">
          <thead>
            <tr class="border-b border-default text-start text-xs uppercase tracking-wider text-dimmed">
              <th class="px-4 py-2 text-start font-medium">Syntax</th>
              <th class="px-4 py-2 text-start font-medium">Meaning</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="row in [
              { syntax: '*', meaning: 'Every value' },
              { syntax: '5', meaning: 'That exact value' },
              { syntax: '1-5', meaning: 'A range, inclusive' },
              { syntax: '*/15', meaning: 'Every 15th value, starting at the lowest' },
              { syntax: '1,15,30', meaning: 'A list of values' },
              { syntax: '9-17/2', meaning: 'Every 2nd value inside a range' },
              { syntax: 'mon-fri', meaning: 'Names work for weekdays and months' },
              { syntax: '@daily', meaning: 'Shorthand for 0 0 * * *' }
            ]" :key="row.syntax">
              <td class="px-4 py-2 font-mono text-xs text-primary">{{ row.syntax }}</td>
              <td class="px-4 py-2 text-muted">{{ row.meaning }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        When both day-of-month and day-of-week are restricted, cron runs on days matching <em>either</em> one — a
        classic source of surprise schedules.
      </template>
    </ToolPanel>
  </ToolPage>
</template>
