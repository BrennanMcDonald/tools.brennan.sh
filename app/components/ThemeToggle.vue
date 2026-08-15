<script setup lang="ts">
import { useColorMode } from '#imports'

/**
 * Three-state theme control: light, dark, or follow the OS.
 * `preference` is what the user picked; `value` is what is actually rendered.
 */
const colorMode = useColorMode()

const options = [
  { value: 'light', icon: 'i-lucide-sun', label: 'Light' },
  { value: 'dark', icon: 'i-lucide-moon', label: 'Dark' },
  { value: 'system', icon: 'i-lucide-monitor', label: 'System' }
] as const

const preference = computed({
  get: () => colorMode.preference,
  set: (value: string) => (colorMode.preference = value)
})
</script>

<template>
  <!-- Rendered client-side only: the server has no way to know the stored preference. -->
  <ClientOnly>
    <div
      class="flex items-center gap-0.5 rounded-lg bg-elevated/60 p-0.5 ring ring-default"
      role="radiogroup"
      aria-label="Color theme"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="preference === option.value"
        :aria-label="option.label"
        :title="`${option.label} theme`"
        :class="[
          'flex size-7 items-center justify-center rounded-md transition-colors',
          preference === option.value
            ? 'bg-default text-highlighted shadow-sm'
            : 'text-dimmed hover:text-highlighted'
        ]"
        @click="preference = option.value"
      >
        <UIcon :name="option.icon" class="size-4" />
      </button>
    </div>

    <template #fallback>
      <div class="h-8 w-[6.5rem] rounded-lg bg-elevated/60 ring ring-default" />
    </template>
  </ClientOnly>
</template>
