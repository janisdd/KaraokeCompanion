<script setup lang="ts">
import AdminSongListView from "./AdminSongListView.vue";

defineOptions({
  name: "ManageSongsPage",
});

definePageMeta({
  title: "Manage Songs",
});
</script>

<template>
  <AdminSongListView />
</template>
