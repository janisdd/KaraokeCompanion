<script setup lang="ts">
import type { SongInfo } from "~~/types/song";

defineOptions({
  name: "MarkedSongsListPage",
});

const { data: songs, pending, error } = await useFetch<SongInfo[]>("/api/songs");
const { markedSongKeys, unmarkAllSongs } = useMarkedSongs();

const getSongKey = (song: SongInfo) =>
  `${song.title}-${song.artist}-${song.year ?? ""}`;

const markedSongs = computed(() => {
  if (!songs.value || !markedSongKeys.value.length) {
    return [];
  }

  const markedKeySet = new Set(markedSongKeys.value);
  return songs.value.filter((song) => markedKeySet.has(getSongKey(song)));
});

const totalCount = computed(() => markedSongs.value.length);
const subtitle = computed(
  () => `Found ${totalCount.value} marked song(s).`,
);

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
</script>

<template>
  <SongListView
    title="Marked Songs"
    :subtitle="subtitle"
    :total-count="totalCount"
    :songs="markedSongs"
    state-key-prefix="marked-songs"
    audio-storage-key="marked-songs"
    :is-loading="pending"
    :has-error="Boolean(error)"
    empty-message="No marked songs yet."
  >
    <template #header-actions>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        :disabled="markedSongs.length === 0"
        @click="confirmUnmarkAll"
      >
        Unmark all
      </button>
    </template>
  </SongListView>
</template>
