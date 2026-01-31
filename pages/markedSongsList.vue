<script setup lang="ts">
import type { SongInfo } from "~~/types/song";
import { useSongAudioPlayback } from "~~/composables/useSongAudioPlayback";

defineOptions({
  name: "MarkedSongsListPage",
});

const { data: songs, pending, error } = await useFetch<SongInfo[]>("/api/songs");
const { markedSongKeys, isMarkedSong, toggleMarkedSong, unmarkAllSongs } =
  useMarkedSongs();

type SortKey = "title" | "artist" | "year" | "genre" | "language";
type SortDirection = "asc" | "desc";

const sortKey = useState<SortKey>("marked-songs-sort-key", () => "title");
const sortDirection = useState<SortDirection>(
  "marked-songs-sort-direction",
  () => "asc",
);
type SearchMode = "metadata" | "lyrics";

const searchMode = useState<SearchMode>(
  "marked-songs-search-mode",
  () => "metadata",
);
const metadataQuery = useState("marked-songs-metadata-query", () => "");
const lyricsQuery = useState("marked-songs-lyrics-query", () => "");
const selectedSongKey = useState<string | null>(
  "marked-songs-selected-key",
  () => null,
);
const selectedSongText = useState<string | null>(
  "marked-songs-selected-text",
  () => null,
);
const selectedSongName = useState<string | null>(
  "marked-songs-selected-name",
  () => null,
);

const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = "asc";
};

const getSongKey = (song: SongInfo) =>
  `${song.title}-${song.artist}-${song.year ?? ""}`;

const markedSongs = computed(() => {
  if (!songs.value || !markedSongKeys.value.length) {
    return [];
  }

  const markedKeySet = new Set(markedSongKeys.value);
  return songs.value.filter((song) => markedKeySet.has(getSongKey(song)));
});

const filteredSongs = computed(() => {
  const source = markedSongs.value;
  if (!source.length) {
    return [];
  }

  const query =
    searchMode.value === "lyrics"
      ? lyricsQuery.value.trim().toLowerCase()
      : metadataQuery.value.trim().toLowerCase();
  if (!query) {
    return source;
  }

  return source.filter((song) => {
    const haystack =
      searchMode.value === "lyrics"
        ? (song.songText ?? song.songTextAsWords.join(" ")).toLowerCase()
        : [
            song.title,
            song.artist,
            song.year == null ? "" : String(song.year),
            song.genre ?? "",
            song.language ?? "",
          ]
            .join(" ")
            .toLowerCase();

    return haystack.includes(query);
  });
});

const sortedSongs = computed(() => {
  const source = filteredSongs.value;
  if (!source.length) {
    return [];
  }

  const direction = sortDirection.value === "asc" ? 1 : -1;

  return [...source].sort((left, right) => {
    const leftValue = left[sortKey.value];
    const rightValue = right[sortKey.value];

    if (leftValue == null && rightValue == null) {
      return 0;
    }
    if (leftValue == null) {
      return 1;
    }
    if (rightValue == null) {
      return -1;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * direction;
  });
});

const getSongText = (song: SongInfo) =>
  song.songTextAsWords?.join(" ").trim() || "";

const getLyricsPreview = (song: SongInfo, query: string) => {
  const text = getSongText(song);
  const trimmedQuery = query.trim();
  if (!text || !trimmedQuery) {
    return "";
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  if (matchIndex === -1) {
    return "";
  }

  const context = 15;
  const start = Math.max(0, matchIndex - context);
  const end = Math.min(text.length, matchIndex + trimmedQuery.length + context);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";

  return `${prefix}${text.slice(start, end)}${suffix}`;
};

const getSongTextPreview = (song: SongInfo) => {
  if (searchMode.value === "lyrics") {
    const preview = getLyricsPreview(song, lyricsQuery.value);
    if (preview) {
      return preview;
    }
  }

  const words = song.songTextAsWords?.slice(0, 5).join(" ");
  if (words) {
    return `${words}...`;
  }

  const fallbackText = song.songText
    ? song.songText.split(/\s+/).slice(0, 5).join(" ")
    : "";

  return fallbackText ? `${fallbackText}...` : "—";
};

const toggleSongText = (song: SongInfo) => {
  const key = getSongKey(song);
  if (selectedSongKey.value === key) {
    selectedSongKey.value = null;
    selectedSongText.value = null;
    return;
  }

  selectedSongKey.value = key;
  selectedSongName.value = `${song.artist} - ${song.title}`;
  selectedSongText.value = getSongText(song) || "No song text available.";
};

const clearSongText = () => {
  selectedSongKey.value = null;
  selectedSongText.value = null;
  selectedSongName.value = null;
};

const getAudioFile = (song: SongInfo) => {
  const audioFile = song.audioFile?.trim();
  if (!audioFile) {
    return null;
  }

  if (!audioFile.toLowerCase().endsWith(".mp3")) {
    return null;
  }

  return `/api/song-audio?path=${encodeURIComponent(audioFile)}`;
};

const { activeAudioKey, isActiveAudioPlaying, toggleAudioPlayback } =
  useSongAudioPlayback({
    storageKey: "marked-songs",
    getSongKey,
    getAudioFile,
  });

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
  <main class="min-h-screen bg-slate-50 px-6 py-8">
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-2">
            <h1 class="text-3xl font-semibold tracking-tight text-slate-900">
              Marked songs
            </h1>
            <p class="text-sm text-slate-600">
              Found {{ markedSongs.length }} marked song(s).
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            :disabled="markedSongs.length === 0"
            @click="confirmUnmarkAll"
          >
            Unmark all
          </button>
        </div>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex w-full flex-col gap-3 md:max-w-2xl">
          <fieldset class="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label class="flex items-center gap-2">
              <input v-model="searchMode" type="radio" value="metadata" />
              Search metadata
            </label>
            <label class="flex items-center gap-2">
              <input v-model="searchMode" type="radio" value="lyrics" />
              Search song text
            </label>
          </fieldset>
          <div class="flex flex-col gap-2 md:flex-row">
            <label class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md">
              <span class="text-slate-500">Metadata</span>
              <input
                v-model="metadataQuery"
                type="search"
                placeholder="Title, artist, year, genre, language"
                class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
                @focus="searchMode = 'metadata'"
              />
            </label>
            <label class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md">
              <span class="text-slate-500">Text</span>
              <input
                v-model="lyricsQuery"
                type="search"
                placeholder="Lyrics or words from the song text"
                class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
                @focus="searchMode = 'lyrics'"
              />
            </label>
          </div>
        </div>
        <p class="text-xs text-slate-500">
          Showing {{ sortedSongs.length }} of {{ markedSongs.length }}
        </p>
      </div>

      <div
        v-if="pending"
        class="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm"
      >
        Loading songs…
      </div>
      <div
        v-else-if="error"
        class="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700"
      >
        Failed to load songs.
      </div>
      <div v-else>
        <div
          v-if="selectedSongText"
          class="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm"
        >
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Song text
              </div>
              <div class="text-sm font-semibold text-slate-900">
                {{ selectedSongName }}
              </div>
            </div>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close song text"
              @click="clearSongText"
            >
              ×
            </button>
          </div>
          <p class="whitespace-pre-wrap break-all">{{ selectedSongText }}</p>
        </div>
        <div
          v-if="markedSongs.length"
          class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div class="max-h-[70vh] overflow-auto">
            <table class="min-w-full text-left text-sm text-slate-700">
              <thead
                class="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                <tr>
                  <th class="px-4 py-3">Mark</th>
                  <th class="px-4 py-3">
                    <button
                      type="button"
                      class="flex w-full items-center gap-1 text-left"
                      @click="toggleSort('title')"
                    >
                      Title
                      <span v-if="sortKey === 'title'">
                        {{ sortDirection === 'asc' ? '▲' : '▼' }}
                      </span>
                    </button>
                  </th>
                  <th class="px-4 py-3">
                    <button
                      type="button"
                      class="flex w-full items-center gap-1 text-left"
                      @click="toggleSort('artist')"
                    >
                      Artist
                      <span v-if="sortKey === 'artist'">
                        {{ sortDirection === 'asc' ? '▲' : '▼' }}
                      </span>
                    </button>
                  </th>
                  <th class="px-4 py-3">
                    <button
                      type="button"
                      class="flex w-full items-center gap-1 text-left"
                      @click="toggleSort('year')"
                    >
                      Year
                      <span v-if="sortKey === 'year'">
                        {{ sortDirection === 'asc' ? '▲' : '▼' }}
                      </span>
                    </button>
                  </th>
                  <th class="px-4 py-3">
                    <button
                      type="button"
                      class="flex w-full items-center gap-1 text-left"
                      @click="toggleSort('genre')"
                    >
                      Genre
                      <span v-if="sortKey === 'genre'">
                        {{ sortDirection === 'asc' ? '▲' : '▼' }}
                      </span>
                    </button>
                  </th>
                  <th class="px-4 py-3">
                    <button
                      type="button"
                      class="flex w-full items-center gap-1 text-left"
                      @click="toggleSort('language')"
                    >
                      Language
                      <span v-if="sortKey === 'language'">
                        {{ sortDirection === 'asc' ? '▲' : '▼' }}
                      </span>
                    </button>
                  </th>
                  <th class="px-4 py-3">Audio</th>
                  <th class="px-4 py-3">Song text preview</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="song in sortedSongs"
                  :key="getSongKey(song)"
                  class="odd:bg-white even:bg-slate-50/60 hover:bg-slate-100/60"
                >
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-slate-700"
                      :checked="isMarkedSong(getSongKey(song))"
                      :aria-label="`Mark ${song.artist} - ${song.title}`"
                      @change="toggleMarkedSong(getSongKey(song))"
                    />
                  </td>
                  <td class="px-4 py-3 font-medium text-slate-900">
                    {{ song.title }}
                  </td>
                  <td class="px-4 py-3">{{ song.artist }}</td>
                  <td class="px-4 py-3">{{ song.year ?? '—' }}</td>
                  <td class="px-4 py-3">{{ song.genre ?? '—' }}</td>
                  <td class="px-4 py-3">{{ song.language ?? '—' }}</td>
                  <td class="px-4 py-3">
                    <button
                      v-if="getAudioFile(song)"
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      :aria-label="activeAudioKey === getSongKey(song) && isActiveAudioPlaying ? 'Pause audio' : 'Play audio'"
                      @click="toggleAudioPlayback(song)"
                    >
                      {{
                        activeAudioKey === getSongKey(song) &&
                        isActiveAudioPlaying
                          ? '⏸'
                          : '▶'
                      }}
                    </button>
                    <span v-else class="text-slate-400">—</span>
                  </td>
                  <td class="px-4 py-3 text-slate-600">
                    <div class="flex items-center gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        class="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        @click="toggleSongText(song)"
                        :aria-label="selectedSongKey === getSongKey(song) ? 'Hide song text' : 'Show song text'"
                      >
                        {{ selectedSongKey === getSongKey(song) ? '▾' : '▸' }}
                      </button>
                      <span class="max-w-[18rem] truncate align-middle">
                        {{ getSongTextPreview(song) }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          v-else
          class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
        >
          No marked songs yet.
        </div>
      </div>
    </div>
  </main>
</template>
