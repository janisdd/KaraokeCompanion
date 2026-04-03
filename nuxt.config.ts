// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json'

const defaultMaxDownloadQueueSizeFrontend = 5
const parsedMaxDownloadQueueSizeFrontend = Number.parseInt(
  process.env.MAX_DOWNLOAD_QUEUE_SIZE_FRONTEND ?? '',
  10,
)
const maxDownloadQueueSizeFrontend = Number.isNaN(parsedMaxDownloadQueueSizeFrontend)
  ? defaultMaxDownloadQueueSizeFrontend
  : parsedMaxDownloadQueueSizeFrontend

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/hints', '@nuxtjs/tailwindcss', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css', '@fortawesome/fontawesome-svg-core/styles.css'],
  app: {
    head: {
      title: 'Karaoke Companion',
      htmlAttrs: {
        lang: 'en',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.png' },
      ],
      meta: [
        {
          name: 'default-theme-dark',
          content: String(process.env.IS_DEFAULT_PAGE_THEME_MODE_DARK === 'true'),
        },
      ],
    },
  },
  build: {
    transpile: ['@fortawesome/vue-fontawesome'],
  },
  runtimeConfig: {
    public: {
      defaultThemeDark: process.env.IS_DEFAULT_PAGE_THEME_MODE_DARK === 'true',
      appVersion: pkg.version,
      maxDownloadQueueSizeFrontend,
    },
  },
})