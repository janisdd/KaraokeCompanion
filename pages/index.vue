<script setup lang="ts">
defineOptions({
  name: "HomePage",
});
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-6 py-10">
    <div class="mx-auto flex max-w-4xl flex-col gap-10">
      <header class="space-y-3 text-center">
        <div class="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="UltraStar Info logo" style="width: 15rem;" />
        </div>
        <p class="text-sm text-slate-600">
          Pick a view to explore your songs or compare Spotify playlists.
        </p>
      </header>

      <section class="grid gap-6 md:grid-cols-2">
        <NuxtLink
          to="/markedSongsList"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950">
            Marked Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600">
            Review the songs you marked while browsing.
          </p>
        </NuxtLink>

        <NuxtLink
          to="/songs"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950">
            Browse Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600">
            Browse, filter, and read song metadata and lyrics.
          </p>
        </NuxtLink>

        <NuxtLink
          to="/localIntersect"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950">
            Spotify vs Local Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600">
            Match a Spotify playlist against your local UltraStar songs.
          </p>
        </NuxtLink>
        
        <NuxtLink
          to="/compare"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950">
            Spotify Playlist Compare
          </h2>
          <p class="mt-2 text-sm text-slate-600">
            Compare two playlists side by side. Dummy view for now.
          </p>
        </NuxtLink>

        
      </section>
    </div>
  </main>
</template>

