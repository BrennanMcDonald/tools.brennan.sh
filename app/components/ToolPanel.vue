<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  icon?: string
  /** Remove the inner padding when the content manages its own (tables, editors). */
  flush?: boolean
}>()
</script>

<template>
  <section class="overflow-hidden rounded-xl bg-default ring ring-default">
    <header
      v-if="title || $slots.actions || $slots.header"
      class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default px-4 py-3"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <UIcon v-if="icon" :name="icon" class="size-4 shrink-0 text-muted" />
        <div class="min-w-0">
          <h2 v-if="title" class="truncate text-sm font-semibold text-highlighted">{{ title }}</h2>
          <p v-if="description" class="truncate text-xs text-muted">{{ description }}</p>
        </div>
      </div>

      <slot name="header" />

      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
      </div>
    </header>

    <div :class="flush ? '' : 'p-4'">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="border-t border-default px-4 py-3 text-xs text-muted">
      <slot name="footer" />
    </footer>
  </section>
</template>
