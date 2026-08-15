import type { ToolEntry } from '~/types/tools'

/** Categories render in this order; anything else is appended alphabetically. */
const CATEGORY_ORDER = ['Time', 'Developer', 'Text', 'Random', 'Security']

export interface ToolCategory {
  name: string
  tools: ToolEntry[]
}

function categoryRank(name: string) {
  const index = CATEGORY_ORDER.indexOf(name)
  return index === -1 ? CATEGORY_ORDER.length : index
}

/**
 * Reads every route that declares `tool` metadata. No central registry to keep
 * in sync — the pages *are* the registry.
 */
export function useTools() {
  const router = useRouter()

  const tools = computed<ToolEntry[]>(() =>
    router
      .getRoutes()
      .filter(route => route.meta?.tool && !route.meta.tool.hidden)
      .map(route => ({ path: route.path, ...route.meta.tool! }))
      .sort(
        (a, b) =>
          categoryRank(a.category) - categoryRank(b.category)
          || a.category.localeCompare(b.category)
          || (a.order ?? 100) - (b.order ?? 100)
          || a.title.localeCompare(b.title)
      )
  )

  const categories = computed<ToolCategory[]>(() => {
    const groups: ToolCategory[] = []
    for (const tool of tools.value) {
      const group = groups.find(g => g.name === tool.category)
      if (group) group.tools.push(tool)
      else groups.push({ name: tool.category, tools: [tool] })
    }
    return groups
  })

  return { tools, categories }
}

/** Case-insensitive match across title, description, category and keywords. */
export function filterTools(tools: ToolEntry[], query: string): ToolEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools

  const terms = q.split(/\s+/)
  return tools.filter((tool) => {
    const haystack = [tool.title, tool.description, tool.category, ...(tool.keywords ?? [])]
      .join(' ')
      .toLowerCase()
    return terms.every(term => haystack.includes(term))
  })
}
