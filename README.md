# tools.brennan.sh

A personal collection of small, fast, browser-only tools. No accounts, no backend, no analytics —
every tool does its work on the device, and the whole site pre-renders to static files.

Built with [Nuxt 4](https://nuxt.com), [Nuxt UI 4](https://ui.nuxt.com) and Tailwind CSS 4.

## Tools

| Tool | What it does |
| --- | --- |
| **Hash & Checksum** | SHA-1/256/384/512 of text or a whole file, HMAC signing, and checksum comparison for verifying downloads |
| **Encrypt a Message** | AES-256-GCM + PBKDF2 password encryption, producing a self-describing base64 blob you can paste anywhere |
| **JWT Inspector** | Decodes header and claims, humanises `exp`/`iat`/`nbf`, and really verifies HMAC, RSA and ECDSA signatures |
| **TOTP Codes** | Live 2FA codes from a base32 secret, plus secret generation, `otpauth://` links and code checking |
| **Secrets & Keys** | API keys, UUIDs, AES keys and ECDSA/RSA/Ed25519 key pairs exported as PEM |
| **Cron Explainer** | Plain-English reading of a cron expression and its next runs in your own time zone |
| **Diff Checker** | Line diff with word-level highlighting, split or unified, whitespace and case insensitive modes |
| **Time Zone Planner** | A day laid out across cities with working-hour overlap, for picking a meeting time |
| **Timer & Stopwatch** | Countdown with presets and a lap stopwatch, accurate even when the tab is backgrounded |
| **Randomizer** | Numbers, dice notation, coin flips, shuffles and team splits from the cryptographic RNG |

## Adding a tool

A tool is just a page that declares its own metadata — there is no registry to update. The sidebar,
the home grid and the search all read from the route metadata.

1. Create `app/pages/tools/<slug>.vue`
2. Declare the tool in `definePageMeta`
3. Wrap the content in `<ToolPage>`

```vue
<script setup lang="ts">
definePageMeta({
  tool: {
    title: 'My Tool',
    description: 'One line describing what it does.',
    icon: 'i-lucide-wand',        // any lucide icon
    category: 'Developer',        // groups it in the sidebar
    keywords: ['search', 'terms'],
    order: 10                     // position within the category
  }
})
</script>

<template>
  <ToolPage>
    <ToolPanel title="Input" icon="i-lucide-pencil">
      …
    </ToolPanel>
  </ToolPage>
</template>
```

Shared building blocks:

- `<ToolPage>` — page shell; reads title, description and icon from the route metadata
- `<ToolPanel>` — a titled card with `actions` and `footer` slots
- `useStored()` / `useStoredValue()` — refs persisted to localStorage without hydration mismatches
- `useCopy()` — clipboard write with a toast and a fallback for older browsers
- `app/utils/*` — pure logic (crypto, cron, diff, timezone, random, formatting), auto-imported

Category order lives in `app/composables/useTools.ts`.

## Development

```bash
yarn install
yarn dev        # http://localhost:3000
yarn generate   # static build into .output/public
yarn preview
```

Only run one dev server per checkout — two Nuxt processes sharing the same `.nuxt` directory will
overwrite each other's generated auto-imports.

## Notes

- Web Crypto (hashing, encryption, key generation) requires a secure context: https or localhost.
- Icons are bundled at build time from `@iconify-json/lucide`, so nothing is fetched at runtime.
- Fonts are self-hosted through `@nuxtjs/google-fonts`.
