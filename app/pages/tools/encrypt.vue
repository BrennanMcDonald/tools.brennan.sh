<script setup lang="ts">
definePageMeta({
  tool: {
    title: 'Encrypt a Message',
    description: 'Lock text behind a password with AES-256-GCM, then send the blob over any channel you like.',
    icon: 'i-lucide-lock',
    category: 'Security',
    keywords: ['aes', 'gcm', 'pbkdf2', 'decrypt', 'secret', 'share password', 'cipher', 'encryption'],
    order: 20
  }
})

const { copy } = useCopy()

const mode = ref<'encrypt' | 'decrypt'>('encrypt')
const tabs = [
  { label: 'Encrypt', value: 'encrypt', icon: 'i-lucide-lock' },
  { label: 'Decrypt', value: 'decrypt', icon: 'i-lucide-lock-open' }
]

const supported = ref(true)
onMounted(() => (supported.value = subtleAvailable()))

const message = ref('')
const password = ref('')
const showPassword = ref(false)
const iterations = ref(DEFAULT_PBKDF2_ITERATIONS)

const cipher = ref('')
const plain = ref('')
const busy = ref(false)
const error = ref('')

async function runEncrypt() {
  error.value = ''
  cipher.value = ''

  if (!message.value) return void (error.value = 'Nothing to encrypt yet.')
  if (password.value.length < 8) return void (error.value = 'Use a password of at least 8 characters.')

  busy.value = true
  try {
    cipher.value = await encryptText(message.value, password.value, iterations.value)
  } catch (thrown) {
    error.value = thrown instanceof Error ? thrown.message : 'Encryption failed.'
  } finally {
    busy.value = false
  }
}

async function runDecrypt() {
  error.value = ''
  plain.value = ''

  if (!cipher.value) return void (error.value = 'Paste an encrypted message first.')

  busy.value = true
  try {
    plain.value = await decryptText(cipher.value, password.value)
  } catch (thrown) {
    error.value = thrown instanceof Error ? thrown.message : 'Decryption failed.'
  } finally {
    busy.value = false
  }
}

function reset() {
  message.value = ''
  password.value = ''
  cipher.value = ''
  plain.value = ''
  error.value = ''
}

watch(mode, () => (error.value = ''))
</script>

<template>
  <ToolPage>
    <template #actions>
      <UButton icon="i-lucide-eraser" color="neutral" variant="ghost" size="sm" label="Clear" @click="reset" />
    </template>

    <UAlert
      v-if="!supported"
      icon="i-lucide-shield-alert"
      color="warning"
      variant="subtle"
      title="Web Crypto is unavailable"
      description="Encryption needs a secure context. Open this page over https or on localhost."
    />

    <UTabs v-model="mode" :items="tabs" :content="false" size="sm" class="w-full sm:max-w-xs" />

    <ToolPanel v-if="mode === 'encrypt'" title="Message" icon="i-lucide-file-text">
      <UTextarea
        v-model="message"
        :rows="6"
        placeholder="The secret you want to send…"
        class="w-full"
        :ui="{ base: 'text-sm' }"
      />
    </ToolPanel>

    <ToolPanel v-else title="Encrypted message" icon="i-lucide-file-lock">
      <UTextarea
        v-model="cipher"
        :rows="6"
        placeholder="Paste the TBE1… blob you received"
        class="w-full"
        :ui="{ base: 'font-mono text-xs' }"
      />
    </ToolPanel>

    <ToolPanel title="Password" icon="i-lucide-key">
      <div class="flex flex-col gap-3">
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Shared password"
          autocomplete="off"
          class="w-full"
          :ui="{ trailing: 'pe-1' }"
        >
          <template #trailing>
            <UButton
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>

        <div v-if="mode === 'encrypt'" class="flex flex-wrap items-center gap-3">
          <UFormField label="PBKDF2 iterations" class="w-48">
            <UInput v-model.number="iterations" type="number" min="100000" step="10000" class="w-full" />
          </UFormField>
          <p class="text-xs text-dimmed">Higher is slower to guess — and slower to open.</p>
        </div>

        <UButton
          :icon="mode === 'encrypt' ? 'i-lucide-lock' : 'i-lucide-lock-open'"
          :label="mode === 'encrypt' ? 'Encrypt' : 'Decrypt'"
          :loading="busy"
          :disabled="!supported"
          class="self-start"
          @click="mode === 'encrypt' ? runEncrypt() : runDecrypt()"
        />

        <p v-if="error" class="text-sm text-error">{{ error }}</p>
      </div>
    </ToolPanel>

    <ToolPanel v-if="mode === 'encrypt' && cipher" title="Send this" icon="i-lucide-send">
      <template #actions>
        <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" label="Copy" @click="copy(cipher)" />
      </template>

      <code class="block max-h-52 overflow-y-auto break-all rounded-lg bg-elevated/60 p-3 font-mono text-xs text-highlighted">
        {{ cipher }}
      </code>

      <template #footer>
        Share the password through a different channel than the message itself.
      </template>
    </ToolPanel>

    <ToolPanel v-if="mode === 'decrypt' && plain" title="Decrypted" icon="i-lucide-file-check">
      <template #actions>
        <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" label="Copy" @click="copy(plain)" />
      </template>

      <p class="whitespace-pre-wrap break-words text-sm text-highlighted">{{ plain }}</p>
    </ToolPanel>

    <ToolPanel title="How this works" icon="i-lucide-info">
      <ul class="flex flex-col gap-2 text-sm text-muted">
        <li class="flex gap-2">
          <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
          <span>Your password is stretched with PBKDF2-SHA256 ({{ iterations.toLocaleString() }} iterations) over a fresh 16-byte salt.</span>
        </li>
        <li class="flex gap-2">
          <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
          <span>The derived 256-bit key encrypts the text with AES-GCM, which also authenticates it — tampering makes decryption fail rather than return garbage.</span>
        </li>
        <li class="flex gap-2">
          <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
          <span>The blob is <code class="font-mono text-xs">magic · salt · nonce · iterations · ciphertext</code>, base64 encoded, so it carries everything needed to open it except the password.</span>
        </li>
        <li class="flex gap-2">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" />
          <span>Strength comes entirely from the password. A short one is guessable no matter how good the cipher is.</span>
        </li>
      </ul>
    </ToolPanel>
  </ToolPage>
</template>
