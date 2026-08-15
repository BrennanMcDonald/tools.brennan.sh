<script setup lang="ts">
definePageMeta({
  tool: {
    title: 'Diff Checker',
    description: 'Compare two blocks of text line by line, with word-level highlighting inside the lines that changed.',
    icon: 'i-lucide-git-compare',
    category: 'Developer',
    keywords: ['diff', 'compare', 'text difference', 'merge', 'changes', 'patch'],
    order: 20
  }
})

const { copy } = useCopy()

const left = useStoredValue('diff.left', '')
const right = useStoredValue('diff.right', '')
const options = useStored('diff.options', { ignoreWhitespace: false, ignoreCase: false, split: true, onlyChanges: false })

const result = computed(() =>
  diffText(left.value, right.value, {
    ignoreWhitespace: options.value.ignoreWhitespace,
    ignoreCase: options.value.ignoreCase
  })
)

const rows = computed(() =>
  options.value.onlyChanges ? result.value.rows.filter(row => row.kind !== 'equal') : result.value.rows
)

const identical = computed(() => left.value.length > 0 && result.value.stats.added + result.value.stats.removed + result.value.stats.changed === 0)

function swap() {
  const previous = left.value
  left.value = right.value
  right.value = previous
}

function clear() {
  left.value = ''
  right.value = ''
}

/** A unified patch-style dump, handy for pasting into a review. */
const unified = computed(() =>
  result.value.rows
    .flatMap((row) => {
      if (row.kind === 'equal') return [`  ${row.left?.text ?? ''}`]
      if (row.kind === 'add') return [`+ ${row.right?.text ?? ''}`]
      if (row.kind === 'remove') return [`- ${row.left?.text ?? ''}`]
      return [`- ${row.left?.text ?? ''}`, `+ ${row.right?.text ?? ''}`]
    })
    .join('\n')
)

const rowClasses = {
  equal: '',
  add: 'bg-success/10',
  remove: 'bg-error/10',
  change: 'bg-warning/10'
} as const

const partClasses = {
  equal: '',
  add: 'bg-success/25 rounded-xs',
  remove: 'bg-error/25 rounded-xs'
} as const
</script>

<template>
  <ToolPage wide>
    <template #actions>
      <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="ghost" size="sm" label="Swap" @click="swap" />
      <UButton icon="i-lucide-eraser" color="neutral" variant="ghost" size="sm" label="Clear" @click="clear" />
    </template>

    <div class="grid gap-4 lg:grid-cols-2">
      <ToolPanel title="Original" icon="i-lucide-file-text">
        <UTextarea
          v-model="left"
          :rows="10"
          placeholder="Paste the first version here"
          class="w-full"
          :ui="{ base: 'font-mono text-xs' }"
        />
      </ToolPanel>

      <ToolPanel title="Changed" icon="i-lucide-file-diff">
        <UTextarea
          v-model="right"
          :rows="10"
          placeholder="Paste the second version here"
          class="w-full"
          :ui="{ base: 'font-mono text-xs' }"
        />
      </ToolPanel>
    </div>

    <ToolPanel flush>
      <template #header>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <UBadge :label="`+${result.stats.added}`" color="success" variant="subtle" size="sm" />
          <UBadge :label="`−${result.stats.removed}`" color="error" variant="subtle" size="sm" />
          <UBadge :label="`~${result.stats.changed}`" color="warning" variant="subtle" size="sm" />
          <span class="text-xs text-dimmed">{{ plural(result.stats.unchanged, 'line') }} unchanged</span>
        </div>
      </template>

      <template #actions>
        <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" label="Copy patch" @click="copy(unified)" />
      </template>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-default px-4 py-3">
        <USwitch v-model="options.split" label="Side by side" size="sm" />
        <USwitch v-model="options.onlyChanges" label="Only changes" size="sm" />
        <USwitch v-model="options.ignoreWhitespace" label="Ignore whitespace" size="sm" />
        <USwitch v-model="options.ignoreCase" label="Ignore case" size="sm" />
      </div>

      <UAlert
        v-if="result.approximate"
        icon="i-lucide-info"
        color="warning"
        variant="subtle"
        class="m-4"
        title="Large input"
        description="These files are big enough that the exact diff would be slow, so matching head and tail lines are kept and the middle is shown as one replaced block."
      />

      <p v-if="identical" class="px-4 py-8 text-center text-sm text-success">
        <UIcon name="i-lucide-check" class="size-4 align-text-bottom" /> The two sides are identical.
      </p>

      <p v-else-if="!rows.length" class="px-4 py-8 text-center text-sm text-muted">
        Paste text into both boxes to see the differences.
      </p>

      <!-- split view -->
      <div v-else-if="options.split" class="overflow-x-auto">
        <div class="min-w-[42rem] divide-y divide-default font-mono text-xs">
          <div v-for="(row, index) in rows" :key="index" class="grid grid-cols-2">
            <div class="flex gap-2 border-e border-default px-3 py-1" :class="row.left ? rowClasses[row.kind === 'add' ? 'equal' : row.kind] : 'bg-elevated/40'">
              <span class="tabular w-8 shrink-0 select-none text-end text-dimmed">{{ row.left?.line ?? '' }}</span>
              <span class="min-w-0 whitespace-pre-wrap break-all text-toned">
                <template v-if="row.left?.parts">
                  <span v-for="(part, partIndex) in row.left.parts" :key="partIndex" :class="partClasses[part.type]">{{ part.text }}</span>
                </template>
                <template v-else>{{ row.left?.text }}</template>
              </span>
            </div>

            <div class="flex gap-2 px-3 py-1" :class="row.right ? rowClasses[row.kind === 'remove' ? 'equal' : row.kind] : 'bg-elevated/40'">
              <span class="tabular w-8 shrink-0 select-none text-end text-dimmed">{{ row.right?.line ?? '' }}</span>
              <span class="min-w-0 whitespace-pre-wrap break-all text-toned">
                <template v-if="row.right?.parts">
                  <span v-for="(part, partIndex) in row.right.parts" :key="partIndex" :class="partClasses[part.type]">{{ part.text }}</span>
                </template>
                <template v-else>{{ row.right?.text }}</template>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- unified view -->
      <div v-else class="divide-y divide-default font-mono text-xs">
        <template v-for="(row, index) in rows" :key="index">
          <div v-if="row.kind !== 'add'" class="flex gap-2 px-3 py-1" :class="rowClasses[row.kind === 'change' ? 'remove' : row.kind]">
            <span class="w-4 shrink-0 select-none text-dimmed">{{ row.kind === 'equal' ? ' ' : '−' }}</span>
            <span class="tabular w-8 shrink-0 select-none text-end text-dimmed">{{ row.left?.line ?? '' }}</span>
            <span class="min-w-0 whitespace-pre-wrap break-all text-toned">{{ row.left?.text }}</span>
          </div>

          <div v-if="row.kind === 'add' || row.kind === 'change'" class="flex gap-2 px-3 py-1" :class="rowClasses.add">
            <span class="w-4 shrink-0 select-none text-dimmed">+</span>
            <span class="tabular w-8 shrink-0 select-none text-end text-dimmed">{{ row.right?.line ?? '' }}</span>
            <span class="min-w-0 whitespace-pre-wrap break-all text-toned">{{ row.right?.text }}</span>
          </div>
        </template>
      </div>
    </ToolPanel>
  </ToolPage>
</template>
