<script setup lang="ts">
import type { HashAlgorithm } from '~/utils/crypto'

definePageMeta({
  tool: {
    title: 'JWT Inspector',
    description: 'Decode a token, read its claims in local time, and actually verify the signature — HMAC, RSA or ECDSA.',
    icon: 'i-lucide-badge-check',
    category: 'Security',
    keywords: ['jwt', 'json web token', 'bearer', 'claims', 'hs256', 'rs256', 'es256', 'decode', 'verify'],
    order: 30
  }
})

const { copy } = useCopy()

const token = ref('')
const secret = ref('')
const secretIsBase64 = ref(false)
const publicKey = ref('')
const verification = ref<{ state: 'valid' | 'invalid' | 'error'; message: string } | null>(null)
const verifying = ref(false)

const segments = computed(() => token.value.trim().split('.'))

function decodeSegment(segment?: string) {
  if (!segment) return null
  try {
    return JSON.parse(fromUtf8(fromBase64(segment))) as Record<string, unknown>
  } catch {
    return null
  }
}

const header = computed(() => decodeSegment(segments.value[0]))
const payload = computed(() => decodeSegment(segments.value[1]))

const shape = computed(() => {
  if (!token.value.trim()) return 'empty'
  if (segments.value.length !== 3) return 'malformed'
  if (!header.value || !payload.value) return 'undecodable'
  return 'ok'
})

const algorithm = computed(() => String(header.value?.alg ?? '').toUpperCase())
const family = computed(() => {
  if (algorithm.value.startsWith('HS')) return 'hmac'
  if (algorithm.value.startsWith('RS') || algorithm.value.startsWith('PS')) return 'rsa'
  if (algorithm.value.startsWith('ES')) return 'ecdsa'
  if (algorithm.value === 'NONE') return 'none'
  return 'unknown'
})

const hashFor = computed<HashAlgorithm>(() => {
  const bits = algorithm.value.slice(2)
  return bits === '384' ? 'SHA-384' : bits === '512' ? 'SHA-512' : 'SHA-256'
})

const pretty = (value: unknown) => JSON.stringify(value, null, 2)

/* ---------------------------------------------------------------- claims */

const TIME_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at'])

const claims = computed(() => {
  if (!payload.value) return []

  return Object.entries(payload.value).map(([key, value]) => {
    if (TIME_CLAIMS.has(key) && typeof value === 'number') {
      const date = new Date(value * 1000)
      const delta = date.getTime() - Date.now()
      return {
        key,
        value: String(value),
        detail: `${date.toLocaleString()} · ${delta < 0 ? `${formatRelative(delta)} ago` : `in ${formatRelative(delta)}`}`
      }
    }

    return {
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      detail: ''
    }
  })
})

const expiry = computed(() => {
  const exp = payload.value?.exp
  if (typeof exp !== 'number') return null
  const remaining = exp * 1000 - Date.now()
  return remaining <= 0
    ? { expired: true, label: `Expired ${formatRelative(remaining)} ago` }
    : { expired: false, label: `Valid for another ${formatRelative(remaining)}` }
})

const notYetValid = computed(() => {
  const nbf = payload.value?.nbf
  return typeof nbf === 'number' && nbf * 1000 > Date.now()
})

/* ------------------------------------------------------------ signature */

watch([token, secret, publicKey, secretIsBase64], () => (verification.value = null))

async function verify() {
  verification.value = null

  if (shape.value !== 'ok') return
  const [headerPart, payloadPart, signaturePart] = segments.value
  const signed = utf8(`${headerPart}.${payloadPart}`)

  verifying.value = true
  try {
    const signature = fromBase64(signaturePart!)

    if (family.value === 'hmac') {
      const key = secretIsBase64.value ? fromBase64(secret.value) : utf8(secret.value)
      const expectedSignature = await hmac(hashFor.value, key, signed)
      const matches = toBase64(expectedSignature, true) === signaturePart!.replace(/=+$/, '')
      verification.value = matches
        ? { state: 'valid', message: `Signature is valid for ${algorithm.value}.` }
        : { state: 'invalid', message: 'Signature does not match this secret.' }
      return
    }

    if (family.value === 'rsa' || family.value === 'ecdsa') {
      const der = pemToDer(publicKey.value)
      const importParams = family.value === 'rsa'
        ? { name: algorithm.value.startsWith('PS') ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5', hash: hashFor.value }
        : { name: 'ECDSA', namedCurve: algorithm.value === 'ES384' ? 'P-384' : algorithm.value === 'ES512' ? 'P-521' : 'P-256' }

      const key = await crypto.subtle.importKey('spki', der, importParams, false, ['verify'])
      const verifyParams = family.value === 'rsa'
        ? (algorithm.value.startsWith('PS') ? { name: 'RSA-PSS', saltLength: Number(hashFor.value.slice(4)) / 8 } : { name: 'RSASSA-PKCS1-v1_5' })
        : { name: 'ECDSA', hash: hashFor.value }

      const valid = await crypto.subtle.verify(verifyParams, key, signature, signed)
      verification.value = valid
        ? { state: 'valid', message: `Signature is valid for ${algorithm.value}.` }
        : { state: 'invalid', message: 'Signature does not match this public key.' }
      return
    }

    verification.value = { state: 'error', message: `${algorithm.value || 'This algorithm'} cannot be verified here.` }
  } catch (thrown) {
    verification.value = { state: 'error', message: thrown instanceof Error ? thrown.message : 'Verification failed.' }
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <ToolPage wide>
    <ToolPanel title="Token" icon="i-lucide-key-square">
      <template #actions>
        <UButton icon="i-lucide-eraser" color="neutral" variant="ghost" size="xs" label="Clear" @click="token = ''" />
      </template>

      <UTextarea
        v-model="token"
        :rows="4"
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
        class="w-full"
        :ui="{ base: 'font-mono text-xs break-all' }"
      />

      <div v-if="shape === 'malformed'" class="mt-2 text-sm text-error">
        A JWT has three dot-separated parts; this one has {{ segments.length }}.
      </div>
      <div v-else-if="shape === 'undecodable'" class="mt-2 text-sm text-error">
        The header or payload is not valid base64url-encoded JSON.
      </div>

      <div v-else-if="shape === 'ok'" class="mt-3 flex flex-wrap items-center gap-2">
        <UBadge :label="algorithm || 'unknown alg'" color="neutral" variant="subtle" />
        <UBadge v-if="header?.typ" :label="String(header.typ)" color="neutral" variant="subtle" />
        <UBadge v-if="header?.kid" :label="`kid: ${header.kid}`" color="neutral" variant="subtle" />
        <UBadge
          v-if="expiry"
          :label="expiry.label"
          :color="expiry.expired ? 'error' : 'success'"
          variant="subtle"
          :icon="expiry.expired ? 'i-lucide-clock-alert' : 'i-lucide-clock'"
        />
        <UBadge v-if="notYetValid" label="Not valid yet" color="warning" variant="subtle" icon="i-lucide-hourglass" />
        <UBadge v-if="family === 'none'" label="alg: none — unsigned" color="error" variant="subtle" icon="i-lucide-shield-off" />
      </div>
    </ToolPanel>

    <div v-if="shape === 'ok'" class="grid gap-4 lg:grid-cols-2">
      <ToolPanel title="Header" icon="i-lucide-braces">
        <template #actions>
          <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" @click="copy(pretty(header))" />
        </template>
        <pre class="overflow-x-auto font-mono text-xs text-highlighted">{{ pretty(header) }}</pre>
      </ToolPanel>

      <ToolPanel title="Payload" icon="i-lucide-braces">
        <template #actions>
          <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" @click="copy(pretty(payload))" />
        </template>
        <pre class="overflow-x-auto font-mono text-xs text-highlighted">{{ pretty(payload) }}</pre>
      </ToolPanel>
    </div>

    <ToolPanel v-if="shape === 'ok' && claims.length" title="Claims" icon="i-lucide-list-checks" flush>
      <ul class="divide-y divide-default">
        <li v-for="claim in claims" :key="claim.key" class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
          <span class="w-24 shrink-0 font-mono text-xs text-dimmed">{{ claim.key }}</span>
          <span class="min-w-0 flex-1 break-all text-sm text-highlighted">{{ claim.value }}</span>
          <span v-if="claim.detail" class="text-xs text-muted">{{ claim.detail }}</span>
        </li>
      </ul>
    </ToolPanel>

    <ToolPanel v-if="shape === 'ok'" title="Verify signature" icon="i-lucide-shield-check">
      <div class="flex flex-col gap-3">
        <template v-if="family === 'hmac'">
          <UFormField label="Shared secret" :description="`Signed with ${algorithm}`">
            <UInput v-model="secret" placeholder="your-256-bit-secret" class="w-full" :ui="{ base: 'font-mono' }" />
          </UFormField>
          <USwitch v-model="secretIsBase64" label="Secret is base64 encoded" size="sm" />
        </template>

        <template v-else-if="family === 'rsa' || family === 'ecdsa'">
          <UFormField label="Public key (PEM)" :description="`Signed with ${algorithm} — paste the SPKI public key`">
            <UTextarea
              v-model="publicKey"
              :rows="5"
              placeholder="-----BEGIN PUBLIC KEY-----"
              class="w-full"
              :ui="{ base: 'font-mono text-xs' }"
            />
          </UFormField>
        </template>

        <p v-else class="text-sm text-muted">
          {{ algorithm || 'This token' }} cannot be checked here — only HMAC, RSA and ECDSA are supported.
        </p>

        <UButton
          icon="i-lucide-shield-check"
          label="Verify"
          class="self-start"
          :loading="verifying"
          :disabled="family === 'none' || family === 'unknown'"
          @click="verify"
        />

        <UAlert
          v-if="verification"
          :icon="verification.state === 'valid' ? 'i-lucide-shield-check' : 'i-lucide-shield-x'"
          :color="verification.state === 'valid' ? 'success' : verification.state === 'invalid' ? 'error' : 'warning'"
          variant="subtle"
          :title="verification.message"
        />
      </div>

      <template #footer>
        Decoding is not verification — anyone can read a JWT's payload. Only the signature check tells you it is genuine.
      </template>
    </ToolPanel>
  </ToolPage>
</template>
