<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NuxtLink to="/" class="flex items-center gap-3 text-sm font-semibold text-slate-900">
          <!-- <img src="/logo.png" alt="UltraStar Info logo" style="width: 3rem;" /> -->
          <span>Karaoke Search</span>
        </NuxtLink>
        <nav class="flex items-center gap-3 text-sm text-slate-600">
          <NuxtLink
            to="/markedSongsList"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
          >
            Marked Songs
          </NuxtLink>
          <NuxtLink
            to="/songs"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
          >
            Browse Songs
          </NuxtLink>
          <NuxtLink
            to="/localIntersect"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
          >
            Spotify vs Local
          </NuxtLink>
          <NuxtLink
            to="/compare"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
          >
          Spotify Playlist Compare
          </NuxtLink>
        </nav>
      </div>
    </header>

    <NuxtPage />
  </div>
</template>
