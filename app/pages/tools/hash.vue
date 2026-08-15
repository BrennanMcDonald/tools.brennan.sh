<script setup lang="ts">
import type { HashAlgorithm } from '~/utils/crypto'

definePageMeta({
  tool: {
    title: 'Hash & Checksum',
    description: 'SHA digests of text or a whole file, HMAC signing, and a constant-time checksum comparison.',
    icon: 'i-lucide-fingerprint',
    category: 'Security',
    keywords: ['sha256', 'sha1', 'sha512', 'md5', 'checksum', 'hmac', 'digest', 'verify download', 'integrity'],
    order: 10
  }
})

const { copy } = useCopy()

const mode = ref<'text' | 'file' | 'hmac'>('text')
const tabs = [
  { label: 'Text', value: 'text', icon: 'i-lucide-type' },
  { label: 'File', value: 'file', icon: 'i-lucide-file-digit' },
  { label: 'HMAC', value: 'hmac', icon: 'i-lucide-key-round' }
]

const supported = ref(true)
onMounted(() => (supported.value = subtleAvailable()))

const uppercase = ref(false)
const expected = ref('')

/* ------------------------------------------------------------------ text */

const text = ref('')
const textDigests = ref<Array<{ algorithm: HashAlgorithm; value: string }>>([])

watchEffect(async () => {
  if (mode.value !== 'text' || !supported.value) return
  const input = text.value
  const results = await Promise.all(
    HASH_ALGORITHMS.map(async algorithm => ({ algorithm, value: await hashText(algorithm, input) }))
  )
  textDigests.value = results
})

/* ------------------------------------------------------------------ file */

const file = ref<File | null>(null)
const fileDigests = ref<Array<{ algorithm: HashAlgorithm; value: string }>>([])
const hashing = ref(false)
const fileError = ref('')
const dragging = ref(false)

async function hashSelectedFile(selected: File | null | undefined) {
  file.value = selected ?? null
  fileDigests.value = []
  fileError.value = ''
  if (!selected) return

  hashing.value = true
  try {
    const buffer = await selected.arrayBuffer()
    fileDigests.value = await Promise.all(
      HASH_ALGORITHMS.map(async algorithm => ({ algorithm, value: toHex(await digest(algorithm, buffer)) }))
    )
  } catch {
    fileError.value = 'Could not read that file — it may be too large for this browser.'
  } finally {
    hashing.value = false
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  hashSelectedFile(event.dataTransfer?.files?.[0])
}

function onPick(event: Event) {
  hashSelectedFile((event.target as HTMLInputElement).files?.[0])
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['kB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/* ------------------------------------------------------------------ hmac */

const hmacKey = ref('')
const hmacMessage = ref('')
const hmacAlgorithm = ref<HashAlgorithm>('SHA-256')
const hmacResult = ref('')

watchEffect(async () => {
  if (mode.value !== 'hmac' || !supported.value) return
  if (!hmacKey.value && !hmacMessage.value) {
    hmacResult.value = ''
    return
  }
  hmacResult.value = toHex(await hmac(hmacAlgorithm.value, utf8(hmacKey.value), utf8(hmacMessage.value)))
})

/* --------------------------------------------------------------- display */

const digests = computed(() => (mode.value === 'file' ? fileDigests.value : textDigests.value))

function display(value: string) {
  return uppercase.value ? value.toUpperCase() : value
}

/** Comparison ignores case and whitespace — checksums get pasted messily. */
const expectedMatch = computed(() => {
  const target = expected.value.trim().toLowerCase().replace(/\s/g, '')
  if (!target) return null
  return digests.value.some(entry => entry.value === target) ? 'match' : 'mismatch'
})
</script>

<template>
  <ToolPage>
    <UAlert
      v-if="!supported"
      icon="i-lucide-shield-alert"
      color="warning"
      variant="subtle"
      title="Web Crypto is unavailable"
      description="Hashing needs a secure context. Open this page over https or on localhost."
    />

    <UTabs v-model="mode" :items="tabs" :content="false" size="sm" class="w-full sm:max-w-md" />

    <ToolPanel v-if="mode === 'text'" title="Text" icon="i-lucide-type">
      <UTextarea
        v-model="text"
        :rows="5"
        placeholder="Anything you type is hashed as you go — nothing leaves the page."
        class="w-full"
        :ui="{ base: 'font-mono text-sm' }"
      />
      <p class="mt-2 text-xs text-dimmed">{{ plural(text.length, 'character') }} · UTF-8 encoded</p>
    </ToolPanel>

    <ToolPanel v-else-if="mode === 'file'" title="File" icon="i-lucide-file-digit" description="Verify a download without uploading it anywhere">
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
        :class="dragging ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <UIcon name="i-lucide-upload" class="size-6 text-dimmed" />
        <span class="text-sm text-toned">
          <span class="font-medium text-highlighted">Choose a file</span> or drop it here
        </span>
        <span v-if="file" class="text-xs text-muted">{{ file.name }} · {{ formatBytes(file.size) }}</span>
        <input type="file" class="hidden" @change="onPick">
      </label>

      <p v-if="hashing" class="mt-3 flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" /> Hashing…
      </p>
      <p v-if="fileError" class="mt-3 text-sm text-error">{{ fileError }}</p>
    </ToolPanel>

    <ToolPanel v-else title="HMAC" icon="i-lucide-key-round" description="Keyed hash, as used for webhook signatures">
      <div class="flex flex-col gap-3">
        <UFormField label="Secret key">
          <UInput v-model="hmacKey" placeholder="shared secret" class="w-full" :ui="{ base: 'font-mono' }" />
        </UFormField>

        <UFormField label="Message">
          <UTextarea v-model="hmacMessage" :rows="4" class="w-full" :ui="{ base: 'font-mono text-sm' }" />
        </UFormField>

        <UFormField label="Algorithm">
          <USelect v-model="hmacAlgorithm" :items="HASH_ALGORITHMS" class="w-full sm:w-48" />
        </UFormField>

        <div v-if="hmacResult" class="rounded-lg bg-elevated/60 p-3">
          <div class="flex items-start gap-2">
            <code class="min-w-0 flex-1 break-all font-mono text-sm text-highlighted">{{ display(hmacResult) }}</code>
            <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" @click="copy(display(hmacResult))" />
          </div>
        </div>
      </div>
    </ToolPanel>

    <ToolPanel v-if="mode !== 'hmac' && digests.length" title="Digests" icon="i-lucide-fingerprint" flush>
      <template #actions>
        <USwitch v-model="uppercase" label="Uppercase" size="sm" />
      </template>

      <ul class="divide-y divide-default">
        <li v-for="entry in digests" :key="entry.algorithm" class="flex items-start gap-3 px-4 py-3">
          <span class="w-20 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wider text-dimmed">
            {{ entry.algorithm }}
          </span>
          <code
            class="min-w-0 flex-1 break-all font-mono text-sm"
            :class="expectedMatch && entry.value === expected.trim().toLowerCase().replace(/\s/g, '')
              ? 'text-success'
              : 'text-highlighted'"
          >
            {{ display(entry.value) }}
          </code>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Copy ${entry.algorithm}`"
            @click="copy(display(entry.value), `${entry.algorithm} copied`)"
          />
        </li>
      </ul>

      <template #footer>
        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="expected"
            placeholder="Paste an expected checksum to compare…"
            size="sm"
            class="min-w-0 flex-1"
            :ui="{ base: 'font-mono text-xs' }"
          />
          <UBadge
            v-if="expectedMatch === 'match'"
            icon="i-lucide-check"
            label="Checksum matches"
            color="success"
            variant="subtle"
          />
          <UBadge
            v-else-if="expectedMatch === 'mismatch'"
            icon="i-lucide-x"
            label="No match"
            color="error"
            variant="subtle"
          />
        </div>
      </template>
    </ToolPanel>
  </ToolPage>
</template>
