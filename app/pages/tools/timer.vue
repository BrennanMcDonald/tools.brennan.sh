<script setup lang="ts">
import { defineShortcuts } from '@nuxt/ui/composables/defineShortcuts'

definePageMeta({
  tool: {
    title: 'Timer & Stopwatch',
    description: 'Countdown timers with presets and a lap stopwatch — accurate even when the tab is in the background.',
    icon: 'i-lucide-timer',
    category: 'Time',
    keywords: ['pomodoro', 'countdown', 'alarm', 'laps', 'interval', 'egg timer'],
    order: 10
  }
})

const mode = ref<'timer' | 'stopwatch'>('timer')
const tabs = [
  { label: 'Timer', value: 'timer', icon: 'i-lucide-hourglass' },
  { label: 'Stopwatch', value: 'stopwatch', icon: 'i-lucide-timer-reset' }
]

/* ------------------------------------------------------------------ timer */

const settings = useStored('timer', { hours: 0, minutes: 25, seconds: 0, sound: true, notify: false })

const durationMs = computed(
  () => ((clampInt(settings.value.hours, 0, 99) * 60 + clampInt(settings.value.minutes, 0, 59)) * 60
    + clampInt(settings.value.seconds, 0, 59)) * 1000
)

const remaining = ref(durationMs.value)
const running = ref(false)
const finished = ref(false)

let endsAt = 0
let ticker: ReturnType<typeof setInterval> | undefined

watch(durationMs, (value) => {
  if (!running.value) {
    remaining.value = value
    finished.value = false
  }
})

const progress = computed(() => {
  if (!durationMs.value) return 0
  return Math.min(1, Math.max(0, 1 - remaining.value / durationMs.value))
})

function tick() {
  const left = endsAt - Date.now()
  if (left <= 0) {
    remaining.value = 0
    running.value = false
    finished.value = true
    stopTicker()
    releaseWakeLock()
    ring()
  } else {
    remaining.value = left
  }
}

function stopTicker() {
  clearInterval(ticker)
  ticker = undefined
}

function startTimer() {
  if (!durationMs.value) return
  if (remaining.value <= 0) remaining.value = durationMs.value

  finished.value = false
  endsAt = Date.now() + remaining.value
  running.value = true
  stopTicker()
  ticker = setInterval(tick, 100)
  requestWakeLock()
  primeAudio()
}

function pauseTimer() {
  running.value = false
  remaining.value = Math.max(0, endsAt - Date.now())
  stopTicker()
  releaseWakeLock()
}

function toggleTimer() {
  running.value ? pauseTimer() : startTimer()
}

function resetTimer() {
  running.value = false
  finished.value = false
  remaining.value = durationMs.value
  stopTicker()
  releaseWakeLock()
}

function bump(ms: number) {
  if (running.value) {
    endsAt = Math.max(Date.now(), endsAt + ms)
    tick()
  } else {
    remaining.value = Math.max(0, remaining.value + ms)
  }
}

const presets = [
  { label: 'Pomodoro', minutes: 25 },
  { label: 'Short break', minutes: 5 },
  { label: 'Long break', minutes: 15 },
  { label: '1 min', minutes: 1 },
  { label: '10 min', minutes: 10 },
  { label: '45 min', minutes: 45 }
]

function applyPreset(minutes: number) {
  stopTicker()
  running.value = false
  finished.value = false
  settings.value.hours = Math.floor(minutes / 60)
  settings.value.minutes = minutes % 60
  settings.value.seconds = 0
  remaining.value = minutes * 60 * 1000
  releaseWakeLock()
}

function clampInt(value: unknown, min: number, max: number) {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return min
  return Math.min(max, Math.max(min, parsed))
}

/* ------------------------------------------------------- alarm & wake lock */

let audio: AudioContext | undefined

function primeAudio() {
  if (!settings.value.sound) return
  try {
    audio ||= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
  } catch {
    audio = undefined
  }
}

function ring() {
  if (settings.value.sound) {
    try {
      primeAudio()
      if (audio) {
        for (let i = 0; i < 3; i++) {
          const at = audio.currentTime + i * 0.45
          const osc = audio.createOscillator()
          const gain = audio.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(i === 2 ? 660 : 880, at)
          gain.gain.setValueAtTime(0.0001, at)
          gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38)
          osc.connect(gain).connect(audio.destination)
          osc.start(at)
          osc.stop(at + 0.4)
        }
      }
    } catch {
      // audio is a nicety, never a failure
    }
  }

  if (settings.value.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('Timer finished', { body: 'Your countdown reached zero.', tag: 'tools-timer' })
    } catch {
      // some browsers only allow notifications from a service worker
    }
  }
}

async function toggleNotify(enabled: boolean) {
  if (!enabled || typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission()
    if (result !== 'granted') settings.value.notify = false
  } else if (Notification.permission === 'denied') {
    settings.value.notify = false
  }
}

let wakeLock: { release: () => Promise<void> } | null = null

async function requestWakeLock() {
  try {
    const api = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<typeof wakeLock> } }).wakeLock
    if (api) wakeLock = await api.request('screen')
  } catch {
    wakeLock = null
  }
}

function releaseWakeLock() {
  if (running.value || swRunning.value) return
  wakeLock?.release().catch(() => {})
  wakeLock = null
}

function onVisibility() {
  if (document.visibilityState !== 'visible') return
  if (running.value) {
    tick()
    requestWakeLock()
  }
  if (swRunning.value) requestWakeLock()
}

/* -------------------------------------------------------------- stopwatch */

const swElapsed = ref(0)
const swRunning = ref(false)
const laps = ref<number[]>([])

let swStartedAt = 0
let swTicker: ReturnType<typeof setInterval> | undefined

function startStopwatch() {
  swStartedAt = Date.now() - swElapsed.value
  swRunning.value = true
  clearInterval(swTicker)
  swTicker = setInterval(() => (swElapsed.value = Date.now() - swStartedAt), 47)
  requestWakeLock()
}

function pauseStopwatch() {
  swRunning.value = false
  swElapsed.value = Date.now() - swStartedAt
  clearInterval(swTicker)
  swTicker = undefined
  releaseWakeLock()
}

function toggleStopwatch() {
  swRunning.value ? pauseStopwatch() : startStopwatch()
}

function resetStopwatch() {
  pauseStopwatch()
  swElapsed.value = 0
  laps.value = []
}

function addLap() {
  if (!swRunning.value && !swElapsed.value) return
  laps.value.unshift(swElapsed.value)
}

/** Newest first, each with the split since the previous lap. */
const lapRows = computed(() => {
  const ordered = [...laps.value].reverse()
  const rows = ordered.map((total, index) => ({
    index: index + 1,
    total,
    split: total - (ordered[index - 1] ?? 0)
  }))

  const splits = rows.map(row => row.split)
  const fastest = splits.length > 1 ? Math.min(...splits) : undefined
  const slowest = splits.length > 1 ? Math.max(...splits) : undefined

  return rows
    .map(row => ({ ...row, fastest: row.split === fastest, slowest: row.split === slowest }))
    .reverse()
})

/* --------------------------------------------------------------- wiring */

const headTitle = computed(() => {
  if (mode.value === 'timer' && running.value) return `${formatClock(remaining.value)} · Timer`
  if (mode.value === 'stopwatch' && swRunning.value) return `${formatStopwatch(swElapsed.value)} · Stopwatch`
  return undefined
})

defineShortcuts({
  space: () => (mode.value === 'timer' ? toggleTimer() : toggleStopwatch()),
  l: () => mode.value === 'stopwatch' && addLap(),
  r: () => (mode.value === 'timer' ? resetTimer() : resetStopwatch())
})

onMounted(() => document.addEventListener('visibilitychange', onVisibility))

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  stopTicker()
  clearInterval(swTicker)
  running.value = false
  swRunning.value = false
  releaseWakeLock()
  audio?.close().catch(() => {})
})

const CIRCUMFERENCE = 2 * Math.PI * 45
</script>

<template>
  <ToolPage :head-title="headTitle">
    <UTabs v-model="mode" :items="tabs" :content="false" size="sm" class="w-full sm:max-w-xs" />

    <!-- Timer ------------------------------------------------------------ -->
    <template v-if="mode === 'timer'">
      <ToolPanel>
        <div class="flex flex-col items-center gap-6">
          <div class="relative w-full max-w-[17rem]">
            <svg viewBox="0 0 100 100" class="w-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke-width="6" class="stroke-elevated" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke-width="6"
                stroke-linecap="round"
                :stroke-dasharray="CIRCUMFERENCE"
                :stroke-dashoffset="CIRCUMFERENCE * (1 - progress)"
                :class="finished ? 'stroke-error' : 'stroke-primary'"
                class="transition-[stroke-dashoffset] duration-100 ease-linear"
              />
            </svg>

            <div class="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span
                class="tabular text-4xl font-semibold tracking-tight sm:text-5xl"
                :class="finished ? 'text-error' : 'text-highlighted'"
              >
                {{ formatClock(remaining) }}
              </span>
              <span class="text-xs text-muted">
                {{ finished ? 'Time is up' : running ? 'Running' : remaining === durationMs ? 'Ready' : 'Paused' }}
              </span>
            </div>
          </div>

          <div class="flex w-full flex-wrap items-center justify-center gap-2">
            <UButton
              :icon="running ? 'i-lucide-pause' : 'i-lucide-play'"
              :label="running ? 'Pause' : remaining === durationMs || finished ? 'Start' : 'Resume'"
              size="lg"
              :disabled="!durationMs"
              class="min-w-32 justify-center"
              @click="toggleTimer"
            />
            <UButton icon="i-lucide-rotate-ccw" label="Reset" color="neutral" variant="subtle" size="lg" @click="resetTimer" />
            <UButton icon="i-lucide-plus" label="1 min" color="neutral" variant="ghost" size="lg" @click="bump(60_000)" />
          </div>

          <p class="text-center text-xs text-dimmed">
            <UKbd value="space" /> start or pause · <UKbd value="R" /> reset
          </p>
        </div>
      </ToolPanel>

      <div class="grid gap-4 sm:grid-cols-2">
        <ToolPanel title="Duration" icon="i-lucide-sliders-horizontal">
          <div class="flex items-end gap-2">
            <UFormField
              v-for="unit in (['hours', 'minutes', 'seconds'] as const)"
              :key="unit"
              :label="unit.charAt(0).toUpperCase() + unit.slice(1)"
              class="flex-1"
            >
              <UInput
                v-model.number="settings[unit]"
                type="number"
                inputmode="numeric"
                min="0"
                :max="unit === 'hours' ? 99 : 59"
                :disabled="running"
                class="w-full"
                :ui="{ base: 'tabular text-center' }"
              />
            </UFormField>
          </div>

          <div class="mt-4 flex flex-wrap gap-1.5">
            <UButton
              v-for="preset in presets"
              :key="preset.label"
              :label="preset.label"
              color="neutral"
              variant="outline"
              size="xs"
              @click="applyPreset(preset.minutes)"
            />
          </div>
        </ToolPanel>

        <ToolPanel title="When it finishes" icon="i-lucide-bell">
          <div class="flex flex-col gap-3">
            <USwitch v-model="settings.sound" label="Play a chime" description="Three short tones, generated locally." />
            <USwitch
              v-model="settings.notify"
              label="System notification"
              description="Needs permission from your browser."
              @update:model-value="toggleNotify"
            />
            <p class="text-xs text-dimmed">
              The screen is kept awake while a timer runs, on browsers that support it.
            </p>
          </div>
        </ToolPanel>
      </div>
    </template>

    <!-- Stopwatch -------------------------------------------------------- -->
    <template v-else>
      <ToolPanel>
        <div class="flex flex-col items-center gap-5">
          <span class="tabular text-5xl font-semibold tracking-tight text-highlighted sm:text-6xl">
            {{ formatStopwatch(swElapsed) }}
          </span>

          <div class="flex flex-wrap items-center justify-center gap-2">
            <UButton
              :icon="swRunning ? 'i-lucide-pause' : 'i-lucide-play'"
              :label="swRunning ? 'Stop' : swElapsed ? 'Resume' : 'Start'"
              size="lg"
              class="min-w-32 justify-center"
              @click="toggleStopwatch"
            />
            <UButton
              icon="i-lucide-flag"
              label="Lap"
              color="neutral"
              variant="subtle"
              size="lg"
              :disabled="!swRunning && !swElapsed"
              @click="addLap"
            />
            <UButton
              icon="i-lucide-rotate-ccw"
              label="Reset"
              color="neutral"
              variant="ghost"
              size="lg"
              :disabled="!swElapsed"
              @click="resetStopwatch"
            />
          </div>

          <p class="text-center text-xs text-dimmed">
            <UKbd value="space" /> start or stop · <UKbd value="L" /> lap · <UKbd value="R" /> reset
          </p>
        </div>
      </ToolPanel>

      <ToolPanel v-if="lapRows.length" :title="`Laps (${lapRows.length})`" icon="i-lucide-flag" flush>
        <ul class="divide-y divide-default">
          <li
            v-for="lap in lapRows"
            :key="lap.index"
            class="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span class="w-10 shrink-0 text-xs font-medium text-dimmed">#{{ lap.index }}</span>
            <span class="tabular flex-1 font-medium text-highlighted">{{ formatStopwatch(lap.split) }}</span>
            <UBadge v-if="lap.fastest" label="fastest" color="success" variant="subtle" size="sm" />
            <UBadge v-else-if="lap.slowest" label="slowest" color="warning" variant="subtle" size="sm" />
            <span class="tabular w-24 text-end text-xs text-muted">{{ formatStopwatch(lap.total) }}</span>
          </li>
        </ul>
      </ToolPanel>
    </template>
  </ToolPage>
</template>
