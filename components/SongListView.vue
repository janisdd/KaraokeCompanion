<script setup lang="ts">
import type { SongInfo } from "~~/types/song";
import { useSongListView } from "~~/composables/useSongListView";

const props = defineProps<{
  title: string;
  subtitle: string;
  totalCount: number;
  songs: SongInfo[] | null | undefined;
  stateKeyPrefix: string;
  audioStorageKey: string;
  isLoading: boolean;
  hasError: boolean;
  emptyMessage: string;
}>();

const { isMarkedSong, toggleMarkedSong } = useMarkedSongs();

const songSource = computed(() => props.songs ?? []);

const {
  activeAudioKey,
  activeCoverUrl,
  activeSong,
  clearSongText,
  currentTimeLabel,
  duration,
  durationLabel,
  getAudioFile,
  getSongKey,
  getSongRowId,
  getSongTextPreview,
  isActiveAudioPlaying,
  lyricsQuery,
  metadataQuery,
  playerTime,
  progressPercent,
  scrollToActiveSong,
  searchMode,
  selectedSongKey,
  selectedSongName,
  selectedSongText,
  sortDirection,
  sortKey,
  sortedSongs,
  stopActiveAudio,
  toggleAudioPlayback,
  toggleSongText,
  toggleSort,
} = useSongListView({
  songs: songSource,
  stateKeyPrefix: props.stateKeyPrefix,
  audioStorageKey: props.audioStorageKey,
});
</script>

<template>
  <main
    class="min-h-screen bg-slate-50 px-6 pt-8 dark:bg-slate-950"
    :class="activeSong ? 'pb-28' : 'pb-8'"
  >
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-2">
            <h1 class="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {{ title }}
            </h1>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              {{ subtitle }}
            </p>
          </div>
          <slot name="header-actions" />
        </div>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex w-full flex-col gap-3 md:max-w-2xl">
          <fieldset class="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
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
            <label
              class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span class="text-slate-500 dark:text-slate-400">Metadata</span>
              <input
                v-model="metadataQuery"
                type="search"
                placeholder="Title, artist, year, genre, language"
                class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                @focus="searchMode = 'metadata'"
              />
            </label>
            <label
              class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span class="text-slate-500 dark:text-slate-400">Text</span>
              <input
                v-model="lyricsQuery"
                type="search"
                placeholder="Lyrics or words from the song text"
                class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                @focus="searchMode = 'lyrics'"
              />
            </label>
          </div>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ sortedSongs.length }} of {{ totalCount }}
        </p>
      </div>

      <div
        v-if="isLoading"
        class="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        Loading songs…
      </div>
      <div
        v-else-if="hasError"
        class="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
      >
        Failed to load songs.
      </div>
      <div v-else>
        <div
          v-if="selectedSongText"
          class="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <div class="mb-2 flex items-center justify-between gap-3">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Song text
              </div>
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {{ selectedSongName }}
              </div>
            </div>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Close song text"
              @click="clearSongText"
            >
              <font-awesome-icon icon="fa-solid fa-xmark" />
            </button>
          </div>
          <p class="whitespace-pre-wrap break-all">{{ selectedSongText }}</p>
        </div>
        <div
          v-if="songSource.length"
          class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="max-h-[70vh] overflow-auto">
            <table class="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
              <thead
                class="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr
                  v-for="song in sortedSongs"
                  :key="getSongKey(song)"
                  :id="getSongRowId(song)"
                  class="odd:bg-white even:bg-slate-50/60 hover:bg-slate-100/60 dark:odd:bg-slate-900 dark:even:bg-slate-900/70 dark:hover:bg-slate-800/70"
                >
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-slate-700 dark:accent-slate-300"
                      :checked="isMarkedSong(getSongKey(song))"
                      :aria-label="`Mark ${song.artist} - ${song.title}`"
                      @change="toggleMarkedSong(getSongKey(song))"
                    />
                  </td>
                  <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
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
                      class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      :aria-label="activeAudioKey === getSongKey(song) && isActiveAudioPlaying ? 'Pause audio' : 'Play audio'"
                      @click="toggleAudioPlayback(song)"
                    >
                      <font-awesome-icon
                        :icon="
                          activeAudioKey === getSongKey(song) && isActiveAudioPlaying
                            ? 'fa-solid fa-pause'
                            : 'fa-solid fa-play'
                        "
                      />
                    </button>
                    <span v-else class="text-slate-400 dark:text-slate-500">—</span>
                  </td>
                  <td class="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <div class="flex items-center gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        class="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
          class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        >
          {{ emptyMessage }}
        </div>
      </div>
    </div>

    <div
      v-if="activeSong"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div class="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-3">
        <div class="flex items-start gap-3">
          <div class="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
            <img
              v-if="activeCoverUrl"
              :src="activeCoverUrl"
              :alt="`${activeSong.title} cover`"
              class="h-full w-full object-cover"
              loading="lazy"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-500"
            >
              <font-awesome-icon icon="fa-solid fa-music" />
            </div>
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>Now playing</span>
                  <button
                    type="button"
                    class="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label="Scroll to song in list"
                    @click="scrollToActiveSong"
                  >
                    <font-awesome-icon icon="fa-solid fa-location-arrow" />
                  </button>
                </div>
                <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {{ activeSong.title }} — {{ activeSong.artist }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {{ currentTimeLabel }} / {{ durationLabel }}
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  :aria-label="isActiveAudioPlaying ? 'Pause audio' : 'Play audio'"
                  @click="toggleAudioPlayback(activeSong)"
                >
                  <font-awesome-icon
                    :icon="isActiveAudioPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play'"
                  />
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Close audio player"
                  @click="stopActiveAudio"
                >
                  <font-awesome-icon icon="fa-solid fa-xmark" />
                </button>
              </div>
            </div>
            <input
              v-model.number="playerTime"
              type="range"
              min="0"
              :max="duration || 0"
              step="0.1"
              class="player-range w-full"
              :disabled="!duration"
              :style="{ '--progress': `${progressPercent}%` }"
              aria-label="Audio progress"
            />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.player-range {
  -webkit-appearance: none;
  appearance: none;
  height: 0.4rem;
  border-radius: 9999px;
  background: #e2e8f0;
  outline: none;
}

:global(.dark) .player-range {
  background: #334155;
}

.player-range::-webkit-slider-runnable-track {
  height: 0.4rem;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    #1f8dd6 0%,
    #1f8dd6 var(--progress, 0%),
    #e2e8f0 var(--progress, 0%),
    #e2e8f0 100%
  );
}

:global(.dark) .player-range::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right,
    #1f8dd6 0%,
    #1f8dd6 var(--progress, 0%),
    #334155 var(--progress, 0%),
    #334155 100%
  );
}

.player-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 0;
  height: 0;
  border: none;
  box-shadow: none;
}

.player-range::-moz-range-track {
  height: 0.4rem;
  border-radius: 9999px;
  background: #e2e8f0;
}

:global(.dark) .player-range::-moz-range-track {
  background: #334155;
}

.player-range::-moz-range-thumb {
  width: 0;
  height: 0;
  border: none;
  background: transparent;
}

.player-range::-moz-range-progress {
  height: 0.4rem;
  border-radius: 9999px;
  background: #1f8dd6;
}

.player-range:disabled {
  background: #e2e8f0;
}

:global(.dark) .player-range:disabled {
  background: #334155;
}
</style>
