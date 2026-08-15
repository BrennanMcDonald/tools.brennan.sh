<script setup lang="ts">
import type { ToolEntry } from '~/types/tools'

defineProps<{ tool: ToolEntry }>()
</script>

<template>
  <NuxtLink
    :to="tool.path"
    class="group flex items-start gap-3 rounded-xl bg-default p-4 ring ring-default transition-all hover:-translate-y-0.5 hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <span
      class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary"
    >
      <UIcon :name="tool.icon" class="size-5" />
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2">
        <span class="truncate text-sm font-semibold text-highlighted">{{ tool.title }}</span>
        <UIcon
          name="i-lucide-arrow-up-right"
          class="size-4 shrink-0 text-dimmed opacity-0 transition-opacity group-hover:opacity-100"
        />
      </span>
      <span class="mt-1 block text-sm text-muted">{{ tool.description }}</span>
    </span>
  </NuxtLink>
</template>
