/** Clipboard write with a toast, falling back to a hidden textarea on older browsers. */
export function useCopy() {
  const toast = useToast()
  const copied = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string, label = 'Copied') {
    let ok = false

    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = text
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        ok = document.execCommand('copy')
        document.body.removeChild(el)
      } catch {
        ok = false
      }
    }

    toast.add(
      ok
        ? { title: label, icon: 'i-lucide-clipboard-check', color: 'success', duration: 1500 }
        : { title: 'Could not copy', icon: 'i-lucide-clipboard-x', color: 'error' }
    )

    if (ok) {
      copied.value = text
      clearTimeout(timer)
      timer = setTimeout(() => (copied.value = null), 1500)
    }

    return ok
  }

  onScopeDispose(() => clearTimeout(timer))

  return { copy, copied }
}
