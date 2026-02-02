<script setup lang="ts">
defineOptions({
  name: "ComparePlaylistsPage",
});

definePageMeta({
  title: "Spotify Playlist Compare",
});

type CompareResponse = {
  intersectionTracks?: Array<{ name: string; artist: string } | null>;
  playlistCache?: {
    playlistA: { updatedAt: string; source: "cache" | "fresh" };
    playlistB: { updatedAt: string; source: "cache" | "fresh" };
  };
};

type CompareTrack = { name: string; artist: string };

const playListUrl1 = useState("compare-playlist-url-1", () => "");
const playListUrl2 = useState("compare-playlist-url-2", () => "");
const compareResult = useState<CompareResponse | null>(
  "compare-playlist-result",
  () => null
);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

const comparePlaylists = async () => {
  submitError.value = null;
  compareResult.value = null;
  isSubmitting.value = true;

  try {
    const response = await $fetch<CompareResponse>("/api/comparePlaylists", {
      method: "POST",
      body: {
        playListUrl1: playListUrl1.value.trim(),
        playListUrl2: playListUrl2.value.trim(),
      },
    });
    compareResult.value = response;
  } catch (error: any) {
    submitError.value =
      error?.data?.message ?? error?.message ?? "Failed to compare playlists.";
  } finally {
    isSubmitting.value = false;
  }
};

const formatCacheTime = (iso: string | undefined) => {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const isFormValid = computed(() => {
  return playListUrl1.value.trim().length > 0 && playListUrl2.value.trim().length > 0;
});

const sharedTracks = computed<CompareTrack[]>(() => {
  const raw = compareResult.value?.intersectionTracks ?? [];
  return raw.filter((track): track is CompareTrack => {
    return !!track?.name && !!track?.artist;
  });
});
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
    <div class="mx-auto max-w-4xl space-y-6">
      <header class="space-y-2">
        <h1 class="hidden text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:block">
          Spotify Playlist Compare
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Provide two Spotify playlist URLs to compare them.
          <!-- does not work with playlists from spotify itself-->
          <b>The playlists must be public and custom playlists!</b>
        </p>
      </header>

      <section class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <form class="space-y-4" @submit.prevent="comparePlaylists">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Playlist A URL
              <input
                v-model.trim="playListUrl1"
                type="url"
                placeholder="https://open.spotify.com/playlist/..."
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-600"
              />
            </label>
            <label class="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Playlist B URL
              <input
                v-model.trim="playListUrl2"
                type="url"
                placeholder="https://open.spotify.com/playlist/..."
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-600"
              />
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
              :disabled="!isFormValid || isSubmitting"
            >
              {{ isSubmitting ? "Comparing..." : "Compare Playlists" }}
            </button>
            <span v-if="submitError" class="text-sm text-rose-600 dark:text-rose-300">
              {{ submitError }}
            </span>
            <span
              v-else-if="compareResult"
              class="text-sm text-emerald-600 dark:text-emerald-300"
            >
              Found {{ compareResult.intersectionTracks?.length ?? 0 }} shared tracks.
            </span>
          </div>
          <div
            v-if="compareResult?.playlistCache"
            class="mt-3 text-xs text-slate-500 dark:text-slate-400"
          >
            <p>
              Playlist A {{ compareResult.playlistCache.playlistA.source === "cache" ? "cache used" : "downloaded" }} at
              {{ formatCacheTime(compareResult.playlistCache.playlistA.updatedAt) }}.
            </p>
            <p>
              Playlist B {{ compareResult.playlistCache.playlistB.source === "cache" ? "cache used" : "downloaded" }} at
              {{ formatCacheTime(compareResult.playlistCache.playlistB.updatedAt) }}.
            </p>
          </div>
        </form>

        <div
          v-if="isSubmitting"
          class="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400"
          role="status"
          aria-live="polite"
        >
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
            aria-hidden="true"
          ></span>
          <span>Loading results...</span>
        </div>

        <div v-if="compareResult" class="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
            Shared Tracks
          </h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ sharedTracks.length }} track(s) found.
          </p>

          <div v-if="sharedTracks.length" class="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full border-collapse text-left text-sm text-slate-700 dark:text-slate-200">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th class="px-4 py-3 font-semibold">Track</th>
                  <th class="px-4 py-3 font-semibold">Artist</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="track in sharedTracks"
                  :key="`${track.artist}-${track.name}`"
                  class="border-t border-slate-200 dark:border-slate-700"
                >
                  <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {{ track.name }}
                  </td>
                  <td class="px-4 py-3">
                    {{ track.artist }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No shared tracks found for these playlists.
          </p>
        </div>
      </section>
    </div>
  </main>
</template>
