<script setup lang="ts">
import { useSongs } from "~~/composables/useSongs";

defineOptions({
  name: "SongsPage",
});

definePageMeta({
  title: "Browse Songs",
});

const { songs, pending, error } = useSongs();

const totalCount = computed(() => songs.value?.length ?? 0);
</script>

<template>
  <SongListView
    title="Browse Songs"
    :total-count="totalCount"
    :songs="songs"
    state-key-prefix="songs"
    audio-storage-key="songs"
    :is-loading="pending"
    :has-error="Boolean(error)"
    empty-message="No songs found."
  />
</template>
