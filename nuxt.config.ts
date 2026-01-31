// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/hints', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css', '@fortawesome/fontawesome-svg-core/styles.css'],
  app: {
    head: {
      title: 'Karaoke Search',
      htmlAttrs: {
        lang: 'en',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.png' },
      ],
    },
  },
})