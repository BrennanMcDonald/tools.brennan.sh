// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxtjs/google-fonts'],
  css: ['~/assets/css/main.css'],

  // @nuxt/ui bundles @nuxt/fonts; we self-host through @nuxtjs/google-fonts instead.
  ui: { fonts: false },

  colorMode: { preference: 'system', fallback: 'dark' },

  // Bundle every icon found in source so the site never calls the Iconify API.
  icon: {
    serverBundle: 'local',
    clientBundle: { scan: true, sizeLimitKb: 512 }
  },


  googleFonts: {
    families: { Inter: [400, 500, 600, 700], 'JetBrains Mono': [400, 500] },
    display: 'swap',
    download: true
  },

  app: {
    // Override with NUXT_APP_BASE_URL when hosting under a sub-path.
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'A small collection of fast, private, offline-friendly everyday tools.' },
        { name: 'theme-color', content: '#09090b' }
      ]
    }
  },

  // Everything runs client-side, so the whole site can be pre-rendered to static files.
  nitro: {
    prerender: { crawlLinks: true, routes: ['/', '/200.html', '/404.html'] }
  }
})
