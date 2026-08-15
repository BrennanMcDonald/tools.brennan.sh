<script setup lang="ts">
import type { DiceResult } from '~/utils/random'

definePageMeta({
  tool: {
    title: 'Randomizer',
    description: 'Numbers, dice, coin flips, shuffles and team splits — all from the browser’s cryptographic RNG.',
    icon: 'i-lucide-dices',
    category: 'Random',
    keywords: ['random number', 'dice', 'roll', 'coin flip', 'shuffle', 'picker', 'raffle', 'teams'],
    order: 10
  }
})

const { copy } = useCopy()

const mode = ref<'numbers' | 'dice' | 'coin' | 'list'>('numbers')
const tabs = [
  { label: 'Numbers', value: 'numbers', icon: 'i-lucide-hash' },
  { label: 'Dice', value: 'dice', icon: 'i-lucide-dices' },
  { label: 'Coin', value: 'coin', icon: 'i-lucide-circle-dollar-sign' },
  { label: 'List', value: 'list', icon: 'i-lucide-list' }
]

/* --------------------------------------------------------------- numbers */

const numberOptions = useStored('random.numbers', { min: 1, max: 100, count: 1, unique: true, sorted: false })
const numbers = ref<number[]>([])

const numberRange = computed(() => Math.abs(numberOptions.value.max - numberOptions.value.min) + 1)
const tooFewValues = computed(() => numberOptions.value.unique && numberOptions.value.count > numberRange.value)

function drawNumbers() {
  const { min, max, count, unique, sorted } = numberOptions.value
  const total = Math.max(1, Math.min(1000, Math.floor(count) || 1))

  let drawn: number[]
  if (unique) {
    const pool = Array.from({ length: Math.min(numberRange.value, 100_000) }, (_, index) => Math.min(min, max) + index)
    drawn = sample(pool, total)
  } else {
    drawn = Array.from({ length: total }, () => randomInt(min, max))
  }

  numbers.value = sorted ? [...drawn].sort((a, b) => a - b) : drawn
}

/* ------------------------------------------------------------------ dice */

const notation = ref('2d6')
const rolls = ref<Array<{ notation: string; result: DiceResult }>>([])
const diceError = ref('')

const dicePresets = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', '2d6', '4d6+2']

function roll(expression = notation.value) {
  notation.value = expression
  const result = rollDice(expression)

  if (!result) {
    diceError.value = `Could not read “${expression}”. Try something like 2d6+3.`
    return
  }

  diceError.value = ''
  rolls.value = [{ notation: expression, result }, ...rolls.value].slice(0, 8)
}

/* ------------------------------------------------------------------ coin */

const coinCount = ref(1)
const flips = ref<Array<'H' | 'T'>>([])
const coinTally = computed(() => ({
  heads: flips.value.filter(flip => flip === 'H').length,
  tails: flips.value.filter(flip => flip === 'T').length
}))

function flipCoins() {
  const total = Math.max(1, Math.min(500, Math.floor(coinCount.value) || 1))
  flips.value = Array.from({ length: total }, () => (randomInt(0, 1) ? 'H' : 'T'))
}

/* ------------------------------------------------------------------ list */

const listInput = useStoredValue('random.list', 'Ada\nGrace\nAlan\nKatherine\nLinus')
const teamCount = ref(2)
const pickCount = ref(1)
const listResult = ref<{ kind: 'picked' | 'shuffled' | 'teams'; picked?: string[]; teams?: string[][] } | null>(null)

const items = computed(() =>
  listInput.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
)

function pickFromList() {
  listResult.value = { kind: 'picked', picked: sample(items.value, Math.max(1, Math.floor(pickCount.value) || 1)) }
}

function shuffleList() {
  listResult.value = { kind: 'shuffled', picked: shuffle(items.value) }
}

function makeTeams() {
  listResult.value = { kind: 'teams', teams: splitIntoGroups(items.value, teamCount.value) }
}

const resultText = computed(() => {
  if (!listResult.value) return ''
  if (listResult.value.kind === 'teams') {
    return (listResult.value.teams ?? [])
      .map((team, index) => `Team ${index + 1}: ${team.join(', ')}`)
      .join('\n')
  }
  return (listResult.value.picked ?? []).join('\n')
})
</script>

<template>
  <ToolPage>
    <UTabs v-model="mode" :items="tabs" :content="false" size="sm" />

    <!-- Numbers -->
    <template v-if="mode === 'numbers'">
      <ToolPanel title="Random numbers" icon="i-lucide-hash">
        <div class="grid gap-3 sm:grid-cols-3">
          <UFormField label="Minimum">
            <UInput v-model.number="numberOptions.min" type="number" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField label="Maximum">
            <UInput v-model.number="numberOptions.max" type="number" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField label="How many" :error="tooFewValues ? 'Range is too small for unique draws' : undefined">
            <UInput v-model.number="numberOptions.count" type="number" inputmode="numeric" min="1" class="w-full" />
          </UFormField>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-4">
          <USwitch v-model="numberOptions.unique" label="No repeats" />
          <USwitch v-model="numberOptions.sorted" label="Sort results" />
          <UButton
            icon="i-lucide-shuffle"
            label="Draw"
            class="ms-auto"
            :disabled="tooFewValues"
            @click="drawNumbers"
          />
        </div>
      </ToolPanel>

      <ToolPanel v-if="numbers.length" title="Result" icon="i-lucide-sparkles">
        <template #actions>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            label="Copy"
            @click="copy(numbers.join(', '))"
          />
        </template>

        <p v-if="numbers.length === 1" class="tabular text-center text-6xl font-semibold text-primary">
          {{ numbers[0] }}
        </p>
        <div v-else class="flex flex-wrap gap-1.5">
          <span
            v-for="(value, index) in numbers"
            :key="index"
            class="tabular rounded-md bg-elevated px-2.5 py-1 text-sm font-medium text-highlighted"
          >
            {{ value }}
          </span>
        </div>
      </ToolPanel>
    </template>

    <!-- Dice -->
    <template v-else-if="mode === 'dice'">
      <ToolPanel title="Dice roller" icon="i-lucide-dices" description="Standard notation: 2d6+3, 4d6, d20 − 1">
        <form class="flex gap-2" @submit.prevent="roll()">
          <UInput v-model="notation" placeholder="2d6+3" class="flex-1" :ui="{ base: 'font-mono' }" />
          <UButton type="submit" icon="i-lucide-dices" label="Roll" />
        </form>

        <p v-if="diceError" class="mt-2 text-sm text-error">{{ diceError }}</p>

        <div class="mt-3 flex flex-wrap gap-1.5">
          <UButton
            v-for="preset in dicePresets"
            :key="preset"
            :label="preset"
            color="neutral"
            variant="outline"
            size="xs"
            @click="roll(preset)"
          />
        </div>
      </ToolPanel>

      <ToolPanel v-if="rolls.length" title="Rolls" icon="i-lucide-history" flush>
        <ul class="divide-y divide-default">
          <li v-for="(entry, index) in rolls" :key="index" class="flex flex-wrap items-center gap-3 px-4 py-3">
            <span
              class="tabular text-2xl font-semibold"
              :class="index === 0 ? 'text-primary' : 'text-highlighted'"
            >
              {{ entry.result.total }}
            </span>
            <span class="font-mono text-xs text-dimmed">{{ entry.notation }}</span>

            <div class="ms-auto flex flex-wrap items-center gap-1">
              <span
                v-for="(value, valueIndex) in entry.result.groups.flatMap(group => group.values)"
                :key="valueIndex"
                class="tabular flex size-7 items-center justify-center rounded-md bg-elevated text-xs font-medium text-toned"
              >
                {{ Math.abs(value) }}
              </span>
              <span v-if="entry.result.modifier" class="ps-1 text-xs text-muted">
                {{ entry.result.modifier > 0 ? '+' : '−' }}{{ Math.abs(entry.result.modifier) }}
              </span>
            </div>
          </li>
        </ul>
      </ToolPanel>
    </template>

    <!-- Coin -->
    <template v-else-if="mode === 'coin'">
      <ToolPanel title="Coin flip" icon="i-lucide-circle-dollar-sign">
        <div class="flex items-end gap-3">
          <UFormField label="How many flips" class="flex-1 sm:max-w-40">
            <UInput v-model.number="coinCount" type="number" inputmode="numeric" min="1" class="w-full" />
          </UFormField>
          <UButton icon="i-lucide-refresh-cw" label="Flip" @click="flipCoins" />
        </div>

        <template v-if="flips.length">
          <div class="mt-5 flex items-center justify-center gap-8">
            <div class="text-center">
              <p class="tabular text-3xl font-semibold text-highlighted">{{ coinTally.heads }}</p>
              <p class="text-xs uppercase tracking-wider text-dimmed">heads</p>
            </div>
            <div class="text-center">
              <p class="tabular text-3xl font-semibold text-highlighted">{{ coinTally.tails }}</p>
              <p class="text-xs uppercase tracking-wider text-dimmed">tails</p>
            </div>
          </div>

          <div v-if="flips.length > 1" class="mt-4 flex flex-wrap justify-center gap-1">
            <span
              v-for="(flip, index) in flips"
              :key="index"
              class="flex size-7 items-center justify-center rounded-full text-xs font-semibold"
              :class="flip === 'H' ? 'bg-primary/15 text-primary' : 'bg-elevated text-toned'"
            >
              {{ flip }}
            </span>
          </div>
        </template>
      </ToolPanel>
    </template>

    <!-- List -->
    <template v-else>
      <ToolPanel title="Your list" icon="i-lucide-list" description="One entry per line">
        <UTextarea v-model="listInput" :rows="7" class="w-full" :ui="{ base: 'font-mono text-sm' }" />

        <div class="mt-3 flex flex-wrap items-end gap-2">
          <UFormField label="Pick" class="w-24">
            <UInput v-model.number="pickCount" type="number" min="1" class="w-full" />
          </UFormField>
          <UButton icon="i-lucide-target" label="Pick winners" :disabled="!items.length" @click="pickFromList" />

          <UFormField label="Teams" class="w-24">
            <UInput v-model.number="teamCount" type="number" min="2" class="w-full" />
          </UFormField>
          <UButton
            icon="i-lucide-users"
            label="Split teams"
            color="neutral"
            variant="subtle"
            :disabled="!items.length"
            @click="makeTeams"
          />

          <UButton
            icon="i-lucide-shuffle"
            label="Shuffle"
            color="neutral"
            variant="ghost"
            :disabled="!items.length"
            @click="shuffleList"
          />
        </div>

        <p class="mt-2 text-xs text-dimmed">{{ plural(items.length, 'entry', 'entries') }}</p>
      </ToolPanel>

      <ToolPanel v-if="listResult" title="Result" icon="i-lucide-sparkles">
        <template #actions>
          <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" label="Copy" @click="copy(resultText)" />
        </template>

        <div v-if="listResult.kind === 'teams'" class="grid gap-3 sm:grid-cols-2">
          <div v-for="(team, index) in listResult.teams" :key="index" class="rounded-lg bg-elevated/60 p-3">
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-dimmed">Team {{ index + 1 }}</p>
            <ul class="flex flex-col gap-0.5 text-sm text-highlighted">
              <li v-for="member in team" :key="member">{{ member }}</li>
            </ul>
          </div>
        </div>

        <ol v-else class="flex flex-col gap-1 text-sm">
          <li
            v-for="(entry, index) in listResult.picked"
            :key="index"
            class="flex items-center gap-2 rounded-md px-2 py-1.5"
            :class="listResult.kind === 'picked' ? 'bg-primary/10 text-primary' : 'text-highlighted odd:bg-elevated/50'"
          >
            <span class="tabular w-6 text-xs text-dimmed">{{ index + 1 }}</span>
            <span class="font-medium">{{ entry }}</span>
          </li>
        </ol>
      </ToolPanel>
    </template>
  </ToolPage>
</template>
