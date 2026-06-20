<script setup lang="ts">
defineOptions({
  name: "HomePage",
})

definePageMeta({
  title: "Karaoke Companion",
})

const { user, loggedIn } = useUserSession()
const loggedInUserName = computed(() => {
  const sessionUser = user.value
  if (!sessionUser || typeof sessionUser !== "object" || !("name" in sessionUser)) {
    return ""
  }

  const name = (sessionUser as { name: unknown }).name
  return typeof name === "string" ? name : ""
})
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
    <div class="mx-auto flex max-w-4xl flex-col gap-10">
      <header class="space-y-3 text-center">
        <div class="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="UltraStar Info logo" style="width: 15rem;" />
        </div>
      </header>

      <div v-if="loggedIn" class="text-center">
        <p class="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-5xl">
          <template v-if="loggedInUserName">
            Hello, {{ loggedInUserName }}
          </template>
          <template v-else>
            Welcome back
          </template>
        </p>
      </div>

      <section class="grid gap-6 md:grid-cols-2">
        <NuxtLink
          to="/browseLocalSongsIndex"
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
          to="/browseOnlineSongsIndex"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Browse Online Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Explore the indexed online songs with quick search and sorting.
          </p>
        </NuxtLink>

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
          to="/localSongsIntersect"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Playlist vs Local Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Match a Spotify playlist against your local UltraStar songs.
          </p>
        </NuxtLink>

        <NuxtLink
          to="/onlineSongsIntersect"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Playlist vs Online Songs
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Match a Spotify playlist against the indexed online songs.
          </p>
        </NuxtLink>

        <NuxtLink
          to="/users/usersList"
          class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <h2 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            Users
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Browse existing users, search them, and create new ones.
          </p>
        </NuxtLink>
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Admin section
        </h2>
        <div class="grid gap-6 md:grid-cols-2">
          <NuxtLink
            to="/admin/manageSongs"
            class="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <h3 class="text-lg font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
              Manage Songs
            </h3>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Browse, filter, and read song metadata and lyrics.
            </p>
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

