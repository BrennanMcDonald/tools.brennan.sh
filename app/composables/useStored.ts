import type { Ref } from 'vue'

/**
 * A ref backed by localStorage. Reads happen after mount so pre-rendered HTML
 * and the first client render always agree (no hydration mismatch).
 */
export function useStored<T>(key: string, initial: T) {
  const storageKey = `tools.brennan.sh:${key}`
  const state = ref<T>(initial) as Ref<T>

  onMounted(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) state.value = { ...(initial as object), ...JSON.parse(raw) } as T
    } catch {
      // corrupt or unavailable storage — fall back to the default
    }

    watch(
      state,
      (value) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(value))
        } catch {
          // quota or private mode — persistence is best effort
        }
      },
      { deep: true }
    )
  })

  return state
}

/** Same as `useStored`, but for values that are not plain objects (arrays, numbers, strings). */
export function useStoredValue<T>(key: string, initial: T) {
  const storageKey = `tools.brennan.sh:${key}`
  const state = ref<T>(initial) as Ref<T>

  onMounted(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) state.value = JSON.parse(raw) as T
    } catch {
      // ignore
    }

    watch(
      state,
      (value) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(value))
        } catch {
          // ignore
        }
      },
      { deep: true }
    )
  })

  return state
}
