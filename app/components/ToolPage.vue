<script setup lang="ts">
/**
 * Page shell for a tool. Title, description and icon come from the page's own
 * `definePageMeta({ tool: ... })`, so each tool declares that information once.
 */
const props = defineProps<{
  title?: string
  description?: string
  icon?: string
  /** Use the wider container for tools with side-by-side panes. */
  wide?: boolean
  /** Overrides the browser tab title, e.g. a live countdown. */
  headTitle?: string
}>()

const route = useRoute()

const title = computed(() => props.title ?? route.meta.tool?.title ?? 'Tool')
const description = computed(() => props.description ?? route.meta.tool?.description ?? '')
const icon = computed(() => props.icon ?? route.meta.tool?.icon ?? 'i-lucide-wrench')

useHead({
  title: computed(() => props.headTitle || title.value),
  meta: [{ name: 'description', content: description.value }]
})
</script>

<template>
  <div :class="['mx-auto flex w-full flex-col gap-4 sm:gap-5', wide ? 'max-w-6xl' : 'max-w-4xl']">
    <div class="flex items-start gap-3">
      <span
        class="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring ring-primary/20 sm:flex"
      >
        <UIcon :name="icon" class="size-5" />
      </span>

      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-semibold tracking-tight text-highlighted sm:text-2xl">{{ title }}</h1>
        <p v-if="description" class="mt-1 text-sm text-muted">{{ description }}</p>
      </div>

      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </div>
</template>
