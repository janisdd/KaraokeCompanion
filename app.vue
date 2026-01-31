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
  </div>
</template>

<script setup lang="ts">
const isDark = useState('isDarkMode', () => false)

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

onMounted(() => {
  initTheme()
})

watch(isDark, (value) => {
  if (!process.client) return
  localStorage.setItem('theme', value ? 'dark' : 'light')
  applyDarkClass(value)
})
</script>
