/**
 * A tool is just a page that declares `tool` metadata via `definePageMeta`.
 * The sidebar, the home grid and the search all read from that metadata, so
 * dropping a new file into `app/pages/tools/` is the only step needed to add one.
 */
export interface ToolMeta {
  /** Display name, e.g. "Cron Explainer". */
  title: string
  /** One-line description shown on cards and in search results. */
  description: string
  /** Any icon name available to `UIcon` — lucide is bundled, e.g. `i-lucide-timer`. */
  icon: string
  /** Group heading in the sidebar, e.g. "Time" or "Developer". */
  category: string
  /** Extra search terms that are not in the title or description. */
  keywords?: string[]
  /** Lower sorts first within a category. Defaults to 100. */
  order?: number
  /** Keep the page routable but out of the sidebar, home grid and search. */
  hidden?: boolean
}

export interface ToolEntry extends ToolMeta {
  path: string
}

declare module 'vue-router' {
  interface RouteMeta {
    tool?: ToolMeta
  }
}

export {}
