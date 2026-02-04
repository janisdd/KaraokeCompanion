<script setup lang="ts">
import { useSongs } from "~~/composables/useSongs";
import type { SongInfo } from "~~/types/song";

defineOptions({
  name: "MarkedSongsListPage",
});

definePageMeta({
  title: "Marked Songs",
});

const { songs, pending, error } = useSongs();
const { markedSongKeys, unmarkAllSongs } = useMarkedSongs();

const getSongKey = (song: SongInfo) => song.id;

const markedSongs = computed(() => {
  if (!songs.value || !markedSongKeys.value.length) {
    return [];
  }

  const markedKeySet = new Set(markedSongKeys.value);
  return songs.value.filter((song) => markedKeySet.has(getSongKey(song)));
});

const totalCount = computed(() => markedSongs.value.length);

const confirmUnmarkAll = () => {
  if (!process.client) {
    return;
  }

  const shouldUnmark = window.confirm(
    "Unmark all songs from the marked list?",
  );
  if (shouldUnmark) {
    unmarkAllSongs();
  }
};

const sendCompanionPlaylist = async () => {
  if (!markedSongs.value.length) {
    return;
  }

  try {
    await $fetch("/api/companionPlaylist", {
      method: "POST",
      body: { songIds: markedSongs.value.map((song) => song.id) },
    });
  } catch (error) {
    console.error("Failed to send companion playlist", error);
  }
};
</script>

<template>
  <SongListView
    title="Marked Songs"
    :total-count="totalCount"
    :songs="markedSongs"
    state-key-prefix="marked-songs"
    audio-storage-key="marked-songs"
    :is-loading="pending"
    :has-error="Boolean(error)"
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
