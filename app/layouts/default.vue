<script setup lang="ts">
// Imported explicitly rather than relying on @nuxt/ui's generated auto-imports.
import { defineShortcuts } from '@nuxt/ui/composables/defineShortcuts'

const route = useRoute()
const appConfig = useAppConfig()

/**
 * One piece of state drives both breakpoints: below `lg` the sidebar renders as
 * a slideover (open/closed), above it as a rail (expanded/icon-only).
 */
const sidebarOpen = ref(true)

onMounted(() => {
  if (window.matchMedia('(min-width: 1024px)').matches) {
    sidebarOpen.value = localStorage.getItem('tools.brennan.sh:sidebar') !== 'collapsed'
  }

  watch(sidebarOpen, (open) => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      localStorage.setItem('tools.brennan.sh:sidebar', open ? 'expanded' : 'collapsed')
    }
  })
})

const currentTool = computed(() => route.meta.tool)

/** Focuses whichever copy of the sidebar search is actually on screen. */
function focusSearch() {
  sidebarOpen.value = true
  nextTick(() => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-tool-search]')]
    inputs.find(input => input.offsetParent !== null)?.focus()
  })
}

defineShortcuts({ '/': focusSearch })
</script>

<template>
  <div class="flex min-h-svh bg-elevated/30">
    <USidebar
      v-model:open="sidebarOpen"
      collapsible="icon"
      rail
      :menu="{ title: appConfig.site.name, description: appConfig.site.tagline }"
      :ui="{ header: 'px-3 gap-2', body: 'p-2 gap-1', footer: 'p-2 gap-1' }"
    >
      <template #header="{ state }">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2.5 py-3" :aria-label="appConfig.site.name">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-inverted">
            <UIcon name="i-lucide-wrench" class="size-4.5" />
          </span>
          <span v-if="state === 'expanded'" class="min-w-0 truncate">
            <span class="block truncate text-sm font-semibold text-highlighted">{{ appConfig.site.name }}</span>
            <span class="block truncate text-xs text-muted">{{ appConfig.site.tagline }}</span>
          </span>
        </NuxtLink>
      </template>

      <template #default="{ state, close }">
        <AppNav :collapsed="state === 'collapsed'" @navigate="close" @expand="focusSearch" />
      </template>

      <template #footer="{ state }">
        <div class="flex w-full items-center gap-1" :class="state === 'collapsed' && 'flex-col'">
          <UButton
            :to="appConfig.site.repo"
            target="_blank"
            icon="i-lucide-github"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Source on GitHub"
          />
          <span v-if="state === 'expanded'" class="ms-auto pe-1 text-[11px] text-dimmed">
            runs entirely in your browser
          </span>
        </div>
      </template>
    </USidebar>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1.5 border-b border-default bg-default/80 px-2 backdrop-blur-sm sm:px-4"
      >
        <UButton
          icon="i-lucide-panel-left"
          color="neutral"
          variant="ghost"
          aria-label="Toggle navigation"
          @click="sidebarOpen = !sidebarOpen"
        />

        <nav class="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <NuxtLink to="/" class="text-muted transition-colors hover:text-highlighted">Tools</NuxtLink>
          <template v-if="currentTool">
            <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
            <span class="truncate font-medium text-highlighted">{{ currentTool.title }}</span>
          </template>
        </nav>

        <div class="ms-auto flex items-center gap-2">
          <UBadge
            v-if="currentTool"
            :label="currentTool.category"
            color="neutral"
            variant="subtle"
            size="sm"
            class="max-sm:hidden"
          />
          <ThemeToggle />
        </div>
      </header>

      <main class="flex-1 px-3 py-5 sm:px-6 sm:py-7">
        <slot />
      </main>

      <footer class="border-t border-default px-4 py-4 text-center text-xs text-dimmed sm:px-6">
        No accounts, no tracking, no server — everything happens on your device.
      </footer>
    </div>
  </div>
</template>
