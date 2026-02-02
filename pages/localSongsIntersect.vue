<script setup lang="ts">
import { useMarkedSongs } from "~~/composables/useMarkedSongs";
import { useSongs } from "~~/composables/useSongs";
defineOptions({
  name: "ComparePlaylistLocalPage",
});

definePageMeta({
  title: "Spotify vs Local Songs",
});

type MatchResult = {
  spotify: { name: string; artist: string };
  local: { id: string; title: string; artist: string };
};

type CompareResponse = {
  matches?: MatchResult[];
  playlistCache?: { updatedAt: string; source: "cache" | "fresh" };
};

type SortKey =
  | "spotifyName"
  | "spotifyArtist"
  | "localTitle"
  | "localArtist";
type SortDirection = "asc" | "desc";

const { isMarkedSong, toggleMarkedSong, markedSongKeys, setMarkedSongKeys } =
  useMarkedSongs();
const playListUrl = useState("compare-local-playlist-url", () => "");
const compareResult = useState<CompareResponse | null>(
  "compare-local-playlist-result",
  () => null,
);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const forceRefresh = useState("compare-local-force-refresh", () => false);
const sortKey = useState<SortKey>("compare-local-sort-key", () => "spotifyName");
const sortDirection = useState<SortDirection>(
  "compare-local-sort-direction",
  () => "asc",
);
const searchQuery = useState("compare-local-search-query", () => "");

const comparePlaylist = async () => {
  submitError.value = null;
  compareResult.value = null;
  isSubmitting.value = true;

  try {
    const response = await $fetch<CompareResponse>("/api/comparePlaylistLocal", {
      method: "POST",
      body: {
        playListUrl: playListUrl.value.trim(),
        forceRefresh: forceRefresh.value,
      },
    });
    compareResult.value = response;
  } catch (error: any) {
    submitError.value =
      error?.data?.message ?? error?.message ?? "Failed to compare playlist.";
  } finally {
    isSubmitting.value = false;
  }
};

const formatCacheTime = (iso: string | undefined) => {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const isFormValid = computed(() => playListUrl.value.trim().length > 0);

const matches = computed<MatchResult[]>(() => {
  return compareResult.value?.matches ?? [];
});

const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = "asc";
};

const filteredMatches = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return matches.value;
  }

  return matches.value.filter((match) => {
    const haystack = [
      match.spotify.name,
      match.spotify.artist,
      match.local.title,
      match.local.artist,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});

const sortedMatches = computed(() => {
  const source = filteredMatches.value;
  if (!source.length) {
    return [];
  }

  const direction = sortDirection.value === "asc" ? 1 : -1;

  return [...source].sort((left, right) => {
    const getValue = (match: MatchResult) => {
      switch (sortKey.value) {
        case "spotifyName":
          return match.spotify.name;
        case "spotifyArtist":
          return match.spotify.artist;
        case "localTitle":
          return match.local.title;
        case "localArtist":
          return match.local.artist;
        default:
          return "";
      }
    };

    return (
      String(getValue(left)).localeCompare(String(getValue(right)), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction
    );
  });
});

const markAllMatches = () => {
  const matchIds = filteredMatches.value.map((match) => match.local.id);
  if (!matchIds.length) {
    return;
  }
  setMarkedSongKeys([...markedSongKeys.value, ...matchIds]);
};
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
    <div class="mx-auto max-w-4xl space-y-6">
      <header class="space-y-2">
        <h1 class="hidden text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:block">
          Spotify Playlist vs Local Songs
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Provide a Spotify playlist URL to find local UltraStar matches.
          <!-- does not work with playlists from spotify itself-->
          <b>The playlist must be public and a custom playlist!</b>
        </p>
      </header>

      <section
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        <form class="space-y-4" @submit.prevent="comparePlaylist">
          <label class="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Playlist URL
            <input
              v-model.trim="playListUrl"
              type="url"
              placeholder="https://open.spotify.com/playlist/..."
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-600"
            />
          </label>

          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <input v-model="forceRefresh" type="checkbox" />
              Re-download playlist
            </label>
            <button
              type="submit"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
              :disabled="!isFormValid || isSubmitting"
            >
              {{ isSubmitting ? "Comparing..." : "Compare with Local Songs" }}
            </button>
            <span v-if="submitError" class="text-sm text-rose-600 dark:text-rose-300">
              {{ submitError }}
            </span>
            <span v-else-if="compareResult" class="text-sm text-emerald-600 dark:text-emerald-300">
              Found {{ matches.length }} matching track(s).
            </span>
          </div>
          <div
            v-if="compareResult?.playlistCache"
            class="mt-3 text-xs text-slate-500 dark:text-slate-400"
          >
            Playlist {{ compareResult.playlistCache.source === "cache" ? "cache used" : "downloaded" }} at
            {{ formatCacheTime(compareResult.playlistCache.updatedAt) }}.
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
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Matches</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ matches.length }} track(s) matched between Spotify and local songs.
          </p>

          <div v-if="matches.length" class="mt-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <label class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <span class="text-slate-500 dark:text-slate-400">Search</span>
                <input
                  v-model="searchQuery"
                  type="search"
                  placeholder="Title or artist"
                  class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                :disabled="!filteredMatches.length"
                @click="markAllMatches"
              >
                Mark all songs
              </button>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Showing {{ sortedMatches.length }} of {{ matches.length }}
              </p>
            </div>
            <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <table class="w-full border-collapse text-left text-sm text-slate-700 dark:text-slate-200">
                <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th class="px-4 py-3 font-semibold">Mark</th>
                    <th class="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        class="flex w-full items-center gap-1 text-left"
                        @click="toggleSort('spotifyName')"
                      >
                        Spotify track
                        <span v-if="sortKey === 'spotifyName'">
                          {{ sortDirection === 'asc' ? '▲' : '▼' }}
                        </span>
                      </button>
                    </th>
                    <th class="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        class="flex w-full items-center gap-1 text-left"
                        @click="toggleSort('spotifyArtist')"
                      >
                        Spotify artist
                        <span v-if="sortKey === 'spotifyArtist'">
                          {{ sortDirection === 'asc' ? '▲' : '▼' }}
                        </span>
                      </button>
                    </th>
                    <th class="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        class="flex w-full items-center gap-1 text-left"
                        @click="toggleSort('localTitle')"
                      >
                        Local title
                        <span v-if="sortKey === 'localTitle'">
                          {{ sortDirection === 'asc' ? '▲' : '▼' }}
                        </span>
                      </button>
                    </th>
                    <th class="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        class="flex w-full items-center gap-1 text-left"
                        @click="toggleSort('localArtist')"
                      >
                        Local artist
                        <span v-if="sortKey === 'localArtist'">
                          {{ sortDirection === 'asc' ? '▲' : '▼' }}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="match in sortedMatches"
                    :key="`${match.spotify.artist}-${match.spotify.name}-${match.local.title}`"
                    class="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        class="h-4 w-4 accent-slate-700 dark:accent-slate-300"
                        :checked="isMarkedSong(match.local.id)"
                        :aria-label="`Mark ${match.local.artist} - ${match.local.title}`"
                        @change="() => toggleMarkedSong(match.local.id)"
                      />
                    </td>
                    <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {{ match.spotify.name }}
                    </td>
                    <td class="px-4 py-3">{{ match.spotify.artist }}</td>
                    <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {{ match.local.title }}
                    </td>
                    <td class="px-4 py-3">{{ match.local.artist }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No matches found for this playlist.
          </p>
        </div>
      </section>
    </div>
  </main>
</template>
