<script setup lang="ts">
import { useSongs } from "~~/composables/useSongs"
import type { SongInfoCatalog } from "~~/types/song"

defineOptions({
  name: "MarkedSongsListPage",
})

definePageMeta({
  title: "Marked Songs",
})

const { songs, pending, error } = useSongs()
const {
  markedSongKeys,
  unmarkAllSongs,
  hasResolvedMarkedSongsSession,
  isMarkedSongsAuthenticated,
  isMarkedSongsLoading,
  markedSongsErrorMessage,
} = useMarkedSongs()

const getSongKey = (song: SongInfoCatalog) => song.key

const markedSongs = computed(() => {
  if (!songs.value || !markedSongKeys.value.length) {
    return []
  }

  const markedKeySet = new Set(markedSongKeys.value)
  return songs.value.filter((song) => markedKeySet.has(getSongKey(song)))
})

const totalCount = computed(() => markedSongs.value.length)
const showLoginPrompt = computed(
  () =>
    hasResolvedMarkedSongsSession.value &&
    !isMarkedSongsAuthenticated.value &&
    !markedSongsErrorMessage.value,
)
const isPageLoading = computed(
  () =>
    pending.value ||
    !hasResolvedMarkedSongsSession.value ||
    (isMarkedSongsLoading.value && !showLoginPrompt.value),
)
const hasPageError = computed(
  () => Boolean(error.value) || Boolean(markedSongsErrorMessage.value),
)

const confirmUnmarkAll = () => {
  if (!process.client) {
    return
  }

  const shouldUnmark = window.confirm(
    "Unmark all songs from the marked list?",
  )
  if (shouldUnmark) {
    unmarkAllSongs()
  }
}

const sendCompanionPlaylist = async () => {
  if (!markedSongs.value.length) {
    return
  }

  try {
    await $fetch("/api/ultrastar/companionPlaylist", {
      method: "POST",
      body: { songKeys: markedSongs.value.map((song) => song.key) },
    })
  } catch (error) {
    console.error("Failed to send companion playlist", error)
  }
}
</script>

<template>
  <main
    v-if="showLoginPrompt"
    class="box-border h-[calc(100vh-3rem)] overflow-hidden bg-slate-50 px-3 pb-8 pt-6 sm:px-6 sm:pt-8 dark:bg-slate-950"
  >
    <div class="mx-auto flex h-full max-w-5xl flex-col gap-6">
      <header class="space-y-2">
        <h1 class="hidden text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:block">
          Marked Songs
        </h1>
      </header>

      <section
        class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Please log in to view and manage your marked songs.
        </p>
        <NuxtLink
          to="/users/usersList"
          class="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Go to login
        </NuxtLink>
      </section>
    </div>
  </main>

  <SongListView
    v-else
    title="Marked Songs"
    :total-count="totalCount"
    :songs="markedSongs"
    state-key-prefix="marked-songs"
    audio-storage-key="marked-songs"
    :is-loading="isPageLoading"
    :has-error="hasPageError"
    empty-message="No marked songs yet."
  >
    <template #search-mode-actions>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        :disabled="markedSongs.length === 0"
        @click="sendCompanionPlaylist"
      >
        <font-awesome-icon icon="fa-solid fa-paper-plane" class="mr-2" />
        <span>Set as companion playlist</span>
      </button>
    </template>
    <template #header-actions>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        :disabled="markedSongs.length === 0"
        @click="confirmUnmarkAll"
      >
        Unmark all
      </button>
    </template>
  </SongListView>
</template>
