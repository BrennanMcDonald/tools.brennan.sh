<script setup lang="ts">
import type { HashAlgorithm } from '~/utils/crypto'

definePageMeta({
  tool: {
    title: 'TOTP Codes',
    description: 'Turn a 2FA secret into live six-digit codes, or mint a new secret and otpauth link for your own service.',
    icon: 'i-lucide-smartphone',
    category: 'Security',
    keywords: ['2fa', 'totp', 'otp', 'authenticator', 'mfa', 'one time password', 'otpauth', 'rfc 6238'],
    order: 40
  }
})

const { copy } = useCopy()

const config = useStored('totp', {
  issuer: 'Example',
  account: 'me@example.com',
  digits: 6,
  period: 30,
  algorithm: 'SHA-1' as HashAlgorithm
})

// Deliberately not persisted: a 2FA secret should not linger in localStorage.
const secret = ref('')
const code = ref('')
const upcoming = ref('')
const remaining = ref(30)
const error = ref('')

const checkInput = ref('')
const checkResult = ref<'match' | 'mismatch' | null>(null)

let lastCounter = -1
let ticker: ReturnType<typeof setInterval> | undefined

const uri = computed(() =>
  secret.value
    ? otpauthUri({
        issuer: config.value.issuer,
        account: config.value.account,
        secret: secret.value,
        digits: config.value.digits,
        period: config.value.period,
        algorithm: config.value.algorithm
      })
    : ''
)

const progress = computed(() => remaining.value / config.value.period)

async function refresh(force = false) {
  const period = config.value.period
  remaining.value = secondsRemaining(period)

  const counter = Math.floor(Date.now() / 1000 / period)
  if (!force && counter === lastCounter) return
  lastCounter = counter

  if (!secret.value.trim()) {
    code.value = ''
    upcoming.value = ''
    error.value = ''
    return
  }

  try {
    const bytes = base32Decode(secret.value)
    if (!bytes.length) throw new Error('Enter a base32 secret')

    const options = { digits: config.value.digits, period, algorithm: config.value.algorithm }
    code.value = await totp(bytes, options)
    upcoming.value = await totp(bytes, { ...options, at: Date.now() + period * 1000 })
    error.value = ''
  } catch (thrown) {
    code.value = ''
    upcoming.value = ''
    error.value = thrown instanceof Error ? thrown.message : 'Could not read that secret'
  }
}

/** Paste an otpauth:// URI anywhere and it fills in every field. */
watch(secret, (value) => {
  const parsed = parseOtpauth(value.trim())
  if (parsed?.secret) {
    config.value.issuer = parsed.issuer ?? config.value.issuer
    config.value.account = parsed.account ?? config.value.account
    config.value.digits = parsed.digits ?? config.value.digits
    config.value.period = parsed.period ?? config.value.period
    config.value.algorithm = parsed.algorithm ?? config.value.algorithm
    secret.value = parsed.secret
    return
  }
  refresh(true)
})

watch(() => [config.value.digits, config.value.period, config.value.algorithm], () => refresh(true))

watch([checkInput, code], async () => {
  const entered = checkInput.value.replace(/\s/g, '')
  if (!entered || !secret.value.trim()) {
    checkResult.value = null
    return
  }

  try {
    const bytes = base32Decode(secret.value)
    const options = { digits: config.value.digits, period: config.value.period, algorithm: config.value.algorithm }
    // Accept the neighbouring steps too, the way real servers do.
    const window = await Promise.all(
      [-1, 0, 1].map(step => totp(bytes, { ...options, at: Date.now() + step * config.value.period * 1000 }))
    )
    checkResult.value = window.includes(entered) ? 'match' : 'mismatch'
  } catch {
    checkResult.value = null
  }
})

function newSecret() {
  secret.value = randomSecret()
}

const formattedCode = computed(() => {
  if (!code.value) return '––––––'
  const half = Math.ceil(code.value.length / 2)
  return `${code.value.slice(0, half)} ${code.value.slice(half)}`
})

onMounted(() => {
  refresh(true)
  ticker = setInterval(() => refresh(), 250)
})

onUnmounted(() => clearInterval(ticker))
</script>

<template>
  <ToolPage>
    <ToolPanel title="Secret" icon="i-lucide-key-round" description="Base32, or paste a whole otpauth:// link">
      <template #actions>
        <UButton icon="i-lucide-dices" color="neutral" variant="ghost" size="xs" label="Generate" @click="newSecret" />
      </template>

      <UInput
        v-model="secret"
        placeholder="JBSWY3DPEHPK3PXP"
        autocomplete="off"
        spellcheck="false"
        class="w-full"
        :ui="{ base: 'font-mono tracking-wider' }"
      />
      <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
      <p v-else class="mt-2 text-xs text-dimmed">Kept in memory only — nothing is written to storage.</p>
    </ToolPanel>

    <ToolPanel v-if="code" title="Current code" icon="i-lucide-smartphone">
      <div class="flex flex-col items-center gap-4">
        <div class="flex items-center gap-5">
          <div class="relative size-16 shrink-0">
            <svg viewBox="0 0 40 40" class="size-full -rotate-90">
              <circle cx="20" cy="20" r="17" fill="none" stroke-width="4" class="stroke-elevated" />
              <circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke-width="4"
                stroke-linecap="round"
                :stroke-dasharray="2 * Math.PI * 17"
                :stroke-dashoffset="2 * Math.PI * 17 * (1 - progress)"
                :class="remaining <= 5 ? 'stroke-warning' : 'stroke-primary'"
              />
            </svg>
            <span class="tabular absolute inset-0 flex items-center justify-center text-sm font-medium text-muted">
              {{ remaining }}
            </span>
          </div>

          <button
            type="button"
            class="tabular text-4xl font-semibold tracking-[0.15em] text-highlighted transition-opacity hover:opacity-70 sm:text-5xl"
            title="Copy code"
            @click="copy(code, 'Code copied')"
          >
            {{ formattedCode }}
          </button>
        </div>

        <p class="text-xs text-dimmed">Next: <span class="tabular font-medium text-muted">{{ upcoming }}</span></p>
      </div>
    </ToolPanel>

    <div class="grid gap-4 lg:grid-cols-2">
      <ToolPanel title="Settings" icon="i-lucide-settings-2">
        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Issuer">
              <UInput v-model="config.issuer" class="w-full" />
            </UFormField>
            <UFormField label="Account">
              <UInput v-model="config.account" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Digits">
              <USelect v-model.number="config.digits" :items="[6, 7, 8]" class="w-full" />
            </UFormField>
            <UFormField label="Period">
              <USelect v-model.number="config.period" :items="[30, 60]" class="w-full" />
            </UFormField>
            <UFormField label="Algorithm">
              <USelect v-model="config.algorithm" :items="['SHA-1', 'SHA-256', 'SHA-512']" class="w-full" />
            </UFormField>
          </div>

          <UFormField v-if="uri" label="otpauth link">
            <div class="flex gap-2">
              <UInput :model-value="uri" readonly class="min-w-0 flex-1" :ui="{ base: 'font-mono text-xs' }" />
              <UButton icon="i-lucide-copy" color="neutral" variant="subtle" @click="copy(uri)" />
            </div>
          </UFormField>
        </div>
      </ToolPanel>

      <ToolPanel title="Check a code" icon="i-lucide-shield-check" description="Accepts the previous and next step, like a real server">
        <UInput
          v-model="checkInput"
          placeholder="123456"
          inputmode="numeric"
          class="w-full"
          :ui="{ base: 'font-mono tracking-widest' }"
        />

        <div v-if="checkResult" class="mt-3">
          <UAlert
            v-if="checkResult === 'match'"
            icon="i-lucide-check"
            color="success"
            variant="subtle"
            title="Code accepted"
            description="It matches the current 90-second window."
          />
          <UAlert
            v-else
            icon="i-lucide-x"
            color="error"
            variant="subtle"
            title="Code rejected"
            description="Check the secret, the digits, or the clock on the device."
          />
        </div>
      </ToolPanel>
    </div>

    <ToolPanel title="What this is" icon="i-lucide-info">
      <p class="text-sm text-muted">
        TOTP (RFC 6238) hashes a shared secret together with the current 30-second counter and truncates the result to
        six digits. Same secret plus same clock equals the same code, which is why an authenticator works offline —
        and why a device with the wrong time fails to log in.
      </p>
    </ToolPanel>
  </ToolPage>
</template>
