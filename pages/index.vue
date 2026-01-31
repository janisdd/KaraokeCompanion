<script setup lang="ts">
defineOptions({
  name: "HomePage",
});
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
    <div class="mx-auto flex max-w-4xl flex-col gap-10">
      <header class="space-y-3 text-center">
        <div class="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="UltraStar Info logo" style="width: 15rem;" />
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Pick a view to explore your songs or compare Spotify playlists.
        </p>
      </header>

      <section class="grid gap-6 md:grid-cols-2">
        <NuxtLink
          to="/markedSongsList"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Marked Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Review the songs you marked while browsing.
          </p>
        </NuxtLink>

        <NuxtLink
          to="/browseSongs"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Browse Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Browse, filter, and read song metadata and lyrics.
          </p>
        </NuxtLink>

        <NuxtLink
          to="/localSongsIntersect"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Spotify vs Local Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Match a Spotify playlist against your local UltraStar songs.
          </p>
        </NuxtLink>
        
        <NuxtLink
          to="/compareSpotifyPlaylists"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Spotify Playlist Compare
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Compare two playlists side by side. Dummy view for now.
          </p>
        </NuxtLink>

        
      </section>
    </div>
  </main>
</template>

