<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: []; expand: [] }>()

const route = useRoute()
const { tools, categories } = useTools()

const query = ref('')

const matches = computed(() => filterTools(tools.value, query.value))

const groups = computed(() =>
  categories.value
    .map(group => ({ name: group.name, tools: group.tools.filter(tool => matches.value.includes(tool)) }))
    .filter(group => group.tools.length > 0)
)

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-2">
    <UInput
      v-if="!collapsed"
      v-model="query"
      icon="i-lucide-search"
      placeholder="Search tools"
      size="sm"
      autocomplete="off"
      :ui="{ trailing: 'pe-1' }"
      :data-tool-search="true"
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

    <UButton
      v-else
      icon="i-lucide-search"
      color="neutral"
      variant="ghost"
      block
      aria-label="Search tools"
      @click="emit('expand')"
    />

    <nav class="flex flex-col gap-3 overflow-y-auto" aria-label="Tools">
      <NuxtLink
        v-slot="{ href, navigate }"
        to="/"
        custom
      >
        <a
          :href="href"
          :class="[
            'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors',
            collapsed && 'justify-center px-0',
            isActive('/') ? 'bg-elevated text-highlighted' : 'text-toned hover:bg-elevated/60 hover:text-highlighted'
          ]"
          :title="collapsed ? 'All tools' : undefined"
          @click="navigate($event); emit('navigate')"
        >
          <UIcon name="i-lucide-layout-grid" class="size-4.5 shrink-0" />
          <span v-if="!collapsed" class="truncate">All tools</span>
        </a>
      </NuxtLink>

      <div v-for="group in groups" :key="group.name" class="flex flex-col gap-0.5">
        <p
          v-if="!collapsed"
          class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-dimmed"
        >
          {{ group.name }}
        </p>
        <USeparator v-else class="my-1" />

        <NuxtLink
          v-for="tool in group.tools"
          :key="tool.path"
          v-slot="{ href, navigate }"
          :to="tool.path"
          custom
        >
          <a
            :href="href"
            :class="[
              'group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
              collapsed && 'justify-center px-0',
              isActive(tool.path)
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-toned hover:bg-elevated/60 hover:text-highlighted'
            ]"
            :title="collapsed ? tool.title : undefined"
            :aria-current="isActive(tool.path) ? 'page' : undefined"
            @click="navigate($event); emit('navigate')"
          >
            <UIcon :name="tool.icon" class="size-4.5 shrink-0" />
            <span v-if="!collapsed" class="truncate">{{ tool.title }}</span>
          </a>
        </NuxtLink>
      </div>

      <p v-if="!groups.length" class="px-2 py-6 text-center text-sm text-dimmed">
        Nothing matches “{{ query }}”.
      </p>
    </nav>
  </div>
</template>
