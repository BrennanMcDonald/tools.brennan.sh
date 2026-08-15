<script setup lang="ts">
const appConfig = useAppConfig()
const { tools, categories } = useTools()

const query = ref('')
const matches = computed(() => filterTools(tools.value, query.value))

const groups = computed(() =>
  categories.value
    .map(group => ({ name: group.name, tools: group.tools.filter(tool => matches.value.includes(tool)) }))
    .filter(group => group.tools.length > 0)
)

// No `title` here: the global titleTemplate falls back to the site name.
useSeoMeta({
  description: 'A small collection of fast, private, offline-friendly everyday tools.'
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <section class="flex flex-col gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">
        {{ appConfig.site.tagline }}
      </h1>
      <p class="max-w-2xl text-sm text-muted sm:text-base">
        Everything here runs locally in your browser — nothing you type is uploaded, and every tool
        keeps working offline once the page has loaded.
      </p>

      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="Search tools…"
        size="lg"
        autocomplete="off"
        class="max-w-md"
      >
        <template v-if="query" #trailing>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Clear search"
            @click="query = ''"
          />
        </template>
      </UInput>
    </section>

    <section v-for="group in groups" :key="group.name" class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-dimmed">{{ group.name }}</h2>
        <USeparator class="flex-1" />
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard v-for="tool in group.tools" :key="tool.path" :tool="tool" />
      </div>
    </section>

    <p v-if="!groups.length" class="rounded-xl bg-default py-12 text-center text-sm text-muted ring ring-default">
      No tools match “{{ query }}”.
    </p>
  </div>
</template>
