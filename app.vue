<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <header class="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NuxtLink to="/" class="flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <!-- <img src="/logo.png" alt="UltraStar Info logo" style="width: 3rem;" /> -->
          <span>Karaoke Search</span>
        </NuxtLink>
        <nav class="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <NuxtLink
            to="/markedSongsList"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Marked Songs
          </NuxtLink>
          <NuxtLink
            to="/browseSongs"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Browse Songs
          </NuxtLink>
          <NuxtLink
            to="/localSongsIntersect"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Spotify vs Local
          </NuxtLink>
          <NuxtLink
            to="/compareSpotifyPlaylists"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
          Spotify Playlist Compare
          </NuxtLink>
          <button
            type="button"
            class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Show QR code"
            title="Show QR code"
            @click="isQrModalOpen = true"
          >
            <font-awesome-icon icon="fa-solid fa-qrcode" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleDarkMode"
          >
            <font-awesome-icon :icon="isDark ? 'sun' : 'moon'" class="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>

    <main class="pt-12">
      <NuxtPage />
    </main>

    <div
      v-if="isQrModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-6 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="QR code"
      @click.self="isQrModalOpen = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">App URL QR Code</h2>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close QR modal"
            @click="isQrModalOpen = false"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-5 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 dark:border-slate-700 dark:bg-slate-800">
          <div
            v-if="isQrCodeLoading"
            class="flex h-64 w-64 items-center justify-center rounded-lg bg-white text-sm font-semibold uppercase tracking-wide text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500"
          >
            Generating...
          </div>
          <div
            v-else-if="qrCodeError"
            class="flex h-64 w-64 items-center justify-center rounded-lg bg-white text-sm font-semibold text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-300"
          >
            {{ qrCodeError }}
          </div>
          <div v-else-if="qrCodeDataUrl" class="flex flex-col items-center gap-3">
            <img
              :src="qrCodeDataUrl"
              :alt="qrCodeUrl ? `QR code for ${qrCodeUrl}` : 'QR code'"
              class="h-64 w-64 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ qrCodeUrl }}
            </p>
          </div>
          <div
            v-else
            class="flex h-64 w-64 items-center justify-center rounded-lg bg-white text-sm font-semibold uppercase tracking-wide text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500"
          >
            QR Code
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QRCode from "qrcode";

const isDark = useState('isDarkMode', () => false)
const isQrModalOpen = ref(false)
const qrCodeDataUrl = ref<string | null>(null)
const qrCodeUrl = ref<string | null>(null)
const isQrCodeLoading = ref(false)
const qrCodeError = ref<string | null>(null)

const applyDarkClass = (value: boolean) => {
  if (!process.client) return
  document.documentElement.classList.toggle('dark', value)
}

const initTheme = () => {
  if (!process.client) return
  const storedTheme = localStorage.getItem('theme')
  if (storedTheme === 'dark' || storedTheme === 'light') {
    isDark.value = storedTheme === 'dark'
  } else if (window.matchMedia) {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyDarkClass(isDark.value)
}

const toggleDarkMode = () => {
  isDark.value = !isDark.value
}

const loadQrCode = async () => {
  if (!process.client) {
    return
  }

  isQrCodeLoading.value = true
  qrCodeError.value = null
  try {
    const response = await $fetch<{ url: string }>('/api/app-url')
    qrCodeUrl.value = response.url
    qrCodeDataUrl.value = await QRCode.toDataURL(response.url, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
  } catch (error) {
    console.error('Failed to generate QR code', error)
    qrCodeError.value = 'Failed to generate QR code.'
    qrCodeDataUrl.value = null
  } finally {
    isQrCodeLoading.value = false
  }
}

onMounted(() => {
  initTheme()
})

watch(isQrModalOpen, (isOpen) => {
  if (isOpen) {
    loadQrCode()
  }
})

watch(isDark, (value) => {
  if (!process.client) return
  localStorage.setItem('theme', value ? 'dark' : 'light')
  applyDarkClass(value)
})
</script>
