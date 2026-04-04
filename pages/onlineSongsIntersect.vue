<script setup lang="ts">
import { AgGridVue } from "ag-grid-vue3";
import {
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import { defineComponent, h, resolveComponent, shallowRef, type PropType } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useMarkedSongs } from "~~/composables/useMarkedSongs";
import {
  getExistingStatusClass,
  getExistingStatusLabel,
  resolveExistingStatus,
  useOnlineSongDownloads,
} from "~~/composables/useOnlineSongDownloads";
import {
  scrollToGridSong,
  useSongListAudioPlayback,
} from "~~/composables/useSongListAudioPlayback";
import { useSongs } from "~~/composables/useSongs";
import type { ExistingStatus, OnlineSongsIndexResponse } from "~/types/onlineSongs";
import type { SongInfo } from "~~/types/song";

defineOptions({
  name: "ComparePlaylistOnlinePage",
});

definePageMeta({
  title: "Spotify vs Online Songs",
});

type CompareMode = "strict" | "lax";

type MatchResult = {
  spotify: { name: string; artist: string };
  online: { key: string; songId: string; songName: string; artist: string };
  localSong: SongInfo | null;
  existingStatus: ExistingStatus;
};

type CompareResponse = {
  matches?: Array<{
    spotify: { name: string; artist: string };
    online: { key: string; songId: string; songName: string; artist: string };
  }>;
  playlistCache?: { updatedAt: string; source: "cache" | "fresh" };
};

const compareModeOptions: Array<{
  value: CompareMode;
  label: string;
  description: string;
}> = [
  {
    value: "strict",
    label: "Strict",
    description: "Exact title and artist matches after trimming and normalization.",
  },
  {
    value: "lax",
    label: "Lax",
    description: "Title and artist can match if one normalized value contains the other.",
  },
];

const playListUrl = useState("compare-online-playlist-url", () => "");
const {
  isMarkedSong,
  toggleMarkedSong,
  markedSongKeys,
  setMarkedSongKeys,
  isMarkedSongsAuthenticated,
} = useMarkedSongs();
const compareMode = useState<CompareMode>(
  "compare-online-playlist-mode",
  () => "strict",
);
const compareResult = useState<CompareResponse | null>(
  "compare-online-playlist-result",
  () => null,
);
const forceRefresh = useState("compare-online-force-refresh", () => false);
const searchQuery = useState("compare-online-search-query", () => "");
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const isDark = useState<boolean>("isDarkMode", () => false);
const agThemeMode = computed(() => (isDark.value ? "dark" : "light"));
const gridApi = shallowRef<GridApi<MatchResult> | null>(null);

const {
  data: onlineSongsIndexResponse,
  refresh: refreshOnlineSongsIndex,
} = await useFetch<OnlineSongsIndexResponse>("/api/onlineSongsIndex");

const { songs: existingSongs, refresh: refreshExistingSongs } = useSongs();

const {
  cancelDownload,
  closeQueuePanel,
  completedDownloadCount,
  currentDownloadSongLabel,
  downloadError,
  downloadStatusMessage,
  downloadStatusTone,
  isDownloadingSong,
  isQueueFinished,
  isQueuedSong,
  isWaitingForRefreshSong,
  maxQueuedDownloads,
  queueDownload,
  queueProgressPercent,
  queuedDownloadCount,
  totalTrackedDownloads,
} = useOnlineSongDownloads<MatchResult>({
  getDownloadSong: (match) => ({
    ...match.online,
    existingStatus: match.existingStatus,
  }),
  refreshOnlineSongs: refreshOnlineSongsIndex,
  refreshExistingSongs,
});

const {
  activeAudioKey,
  activeCoverUrl,
  activeSong,
  currentTimeLabel,
  duration,
  durationLabel,
  getAudioFile,
  isActiveAudioPlaying,
  playerTime,
  progressPercent,
  stopActiveAudio,
  toggleAudioPlayback,
} = useSongListAudioPlayback({
  audioStorageKey: "compare-online-audio",
  getSongKey: (song) => song.key,
  getSongRowId: (song) => `compare-online-song-${encodeURIComponent(song.key)}`,
});

const onGridReady = (event: GridReadyEvent<MatchResult>) => {
  gridApi.value = event.api;
};

const comparePlaylist = async () => {
  submitError.value = null;
  compareResult.value = null;
  isSubmitting.value = true;

  try {
    const response = await $fetch<CompareResponse>("/api/onlineSongsIntersect", {
      method: "POST",
      body: {
        playListUrl: playListUrl.value.trim(),
        forceRefresh: forceRefresh.value,
        compareMode: compareMode.value,
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

const existingSongsByKey = computed(() => {
  return new Map(existingSongs.value.map((song) => [song.key, song]));
});

const onlineSongsByKey = computed(() => {
  return new Map(
    (onlineSongsIndexResponse.value?.data ?? []).map((song) => [song.key, song]),
  );
});

const matches = computed<MatchResult[]>(() => {
  return (compareResult.value?.matches ?? []).map((match) => {
    const localSong = existingSongsByKey.value.get(match.online.key) ?? null;
    const indexedOnlineSong = onlineSongsByKey.value.get(match.online.key);

    return {
      ...match,
      localSong,
      existingStatus: resolveExistingStatus({
        hasExistingSong: Boolean(localSong),
        backendIndexed: indexedOnlineSong?.indexed ?? false,
        backendDownloading: indexedOnlineSong?.downloading ?? false,
        songId: match.online.songId,
        isDownloadingSong,
        isWaitingForRefreshSong,
      }),
    };
  });
});

const filteredMatches = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return matches.value;
  }

  return matches.value.filter((match) => {
    const haystack = [
      match.online.songName,
      match.online.artist,
      match.spotify.name,
      match.spotify.artist,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});

const selectedCompareMode = computed(
  () =>
    compareModeOptions.find((option) => option.value === compareMode.value) ??
    compareModeOptions[0],
);

const sendSongToBackend = async (song: SongInfo) => {
  try {
    await $fetch("/api/ultrastar/sendSong", {
      method: "POST",
      body: { songKey: song.key },
    });
  } catch (error) {
    console.error("Failed to send song", error);
  }
};

const MarkCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<MatchResult>>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const match = props.params.data;
      const song = match?.localSong;
      if (!match) {
        return null;
      }
      if (song && !isMarkedSongsAuthenticated.value) {
        return null;
      }
      if (!song) {
        if (match.existingStatus !== "no") {
          return null;
        }

        const isQueued = isQueuedSong(match.online.songId);
        const isDownloading = isDownloadingSong(match.online.songId);
        return h(
          "button",
          {
            type: "button",
            class:
              isDownloading
                ? "inline-flex h-8 w-8 items-center justify-center rounded-md border border-sky-400 bg-sky-100 text-sm text-sky-800 shadow-sm transition hover:border-sky-500 hover:bg-sky-200 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:border-sky-600 dark:hover:bg-sky-950/80"
                : isQueued
                  ? "inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-sm text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950/30"
                  : "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
            disabled:
              !isQueued && queuedDownloadCount.value >= maxQueuedDownloads.value,
            "aria-label": isQueued
              ? `Cancel download for ${match.online.artist} - ${match.online.songName}`
              : `Queue download for ${match.online.artist} - ${match.online.songName}`,
            title: isQueued
              ? `Cancel download for ${match.online.artist} - ${match.online.songName}`
              : `Queue download for ${match.online.artist} - ${match.online.songName}`,
            onClick: () =>
              isQueued ? cancelDownload(match.online) : queueDownload(match),
          },
          [
            h(FontAwesomeIcon, {
              icon: isQueued
                ? "fa-solid fa-xmark"
                : "fa-solid fa-cloud-arrow-down",
            }),
          ],
        );
      }
      return h("input", {
        type: "checkbox",
        class: "h-4 w-4 accent-slate-700 dark:accent-slate-300",
        checked: isMarkedSong(song.key),
        "aria-label": `Mark ${song.artist} - ${song.title}`,
        onChange: () => toggleMarkedSong(song.key),
      });
    };
  },
});

const ExistingStatusCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<MatchResult>>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const match = props.params.data;
      if (!match) {
        return null;
      }

      return h(
        "span",
        {
          class: getExistingStatusClass(match.existingStatus),
        },
        getExistingStatusLabel(match.existingStatus),
      );
    };
  },
});

const AudioCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<MatchResult>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon");
    return () => {
      const match = props.params.data;
      const song = match?.localSong;
      if (!match || !song) {
        return null;
      }
      const audioFile = getAudioFile(song);
      if (!audioFile) {
        return h("span", { class: "text-slate-400 dark:text-slate-500" }, "—");
      }
      const isActive =
        activeAudioKey.value === song.key && isActiveAudioPlaying.value;
      return h(
        "button",
        {
          type: "button",
          class:
            "inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
          "aria-label": isActive ? "Pause audio" : "Play audio",
          onClick: () => toggleAudioPlayback(song),
        },
        [
          h(FontAwesomeIcon as any, {
            icon: isActive ? "fa-solid fa-pause" : "fa-solid fa-play",
          }),
        ],
      );
    };
  },
});

const SendCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<MatchResult>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon");
    return () => {
      const match = props.params.data;
      const song = match?.localSong;
      if (!match || !song) {
        return null;
      }
      return h(
        "button",
        {
          type: "button",
          class:
            "inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
          "aria-label": "Send song",
          onClick: () => sendSongToBackend(song),
        },
        [
          h(FontAwesomeIcon as any, {
            icon: "fa-solid fa-paper-plane",
          }),
        ],
      );
    };
  },
});

const centerCellStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const columnDefs: ColDef<MatchResult>[] = [
  {
    headerName: "Mark",
    colId: "mark",
    width: 70,
    cellStyle: centerCellStyle,
    valueGetter: (params) => {
      const match = params.data;
      if (!match) {
        return 0;
      }
      return match.localSong || match.existingStatus === "no" ? 1 : 0;
    },
    cellRenderer: MarkCell,
  },
  {
    headerName: "Existing",
    field: "existingStatus",
    width: 90,
    cellStyle: centerCellStyle,
    valueFormatter: (params) =>
      getExistingStatusLabel((params.value as ExistingStatus) ?? "no"),
    cellRenderer: ExistingStatusCell,
  },
  {
    headerName: "Online title",
    valueGetter: (params) => params.data?.online.songName ?? "",
    width: 220,
    sort: "asc",
  },
  {
    headerName: "Online artist",
    valueGetter: (params) => params.data?.online.artist ?? "",
    width: 200,
  },
  {
    headerName: "Audio",
    colId: "audio",
    width: 70,
    sortable: false,
    cellStyle: centerCellStyle,
    valueGetter: (params) => {
      const song = params.data?.localSong;
      if (!song) {
        return 0;
      }
      return getAudioFile(song) ? 1 : 0;
    },
    cellRenderer: AudioCell,
  },
  {
    headerName: "Send",
    colId: "send",
    width: 70,
    sortable: false,
    cellStyle: centerCellStyle,
    headerTooltip: "Select song in Ultra Star",
    valueGetter: (params) => (params.data?.localSong ? 1 : 0),
    cellRenderer: SendCell,
  },
  {
    headerName: "Spotify track",
    valueGetter: (params) => params.data?.spotify.name ?? "",
    width: 220,
  },
  {
    headerName: "Spotify artist",
    valueGetter: (params) => params.data?.spotify.artist ?? "",
    width: 200,
  },
];

const defaultColDef: ColDef<MatchResult> = {
  sortable: true,
  resizable: true,
  comparator: (valueA, valueB) => {
    return String(valueA ?? "").localeCompare(String(valueB ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  },
};

const rowHeight = 48;

const markableMatchesCount = computed(
  () => filteredMatches.value.filter((match) => !!match.localSong).length,
);

const markAllMatches = () => {
  const matchIds = filteredMatches.value.flatMap((match) =>
    match.localSong ? [match.localSong.key] : [],
  );
  if (!matchIds.length) {
    return;
  }
  setMarkedSongKeys([...markedSongKeys.value, ...matchIds]);
};

const scrollToActiveSongInList = () => {
  scrollToGridSong({
    gridApi: gridApi.value,
    songKey: activeSong.value?.key,
    getRowSongKey: (row) => row.localSong?.key,
  });
};
</script>

<template>
  <main
    class="min-h-screen bg-slate-50 px-3 pt-6 sm:px-6 sm:pt-8 dark:bg-slate-950"
    :class="activeSong ? 'pb-28' : 'pb-10'"
  >
    <div class="mx-auto max-w-5xl space-y-4">
      <header class="space-y-2">
        <h1 class="hidden text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:block">
          Spotify Playlist vs Online Songs
        </h1>
        <details
          class="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <summary
            class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            About this page
          </summary>
          <p class="mt-3">
            Provide a Spotify playlist URL to find matches in the indexed online songs.
            Only title and artist are compared.
            <b>The playlist must be public and a custom playlist!</b>
          </p>
        </details>
      </header>

      <section class="text-sm text-slate-600 dark:text-slate-300">
        <form class="space-y-4" @submit.prevent="comparePlaylist">
          <div class="space-y-2">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
              <label class="min-w-0 flex-1 space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Playlist URL
                <input
                  v-model.trim="playListUrl"
                  type="url"
                  placeholder="https://open.spotify.com/playlist/..."
                  class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-600"
                />
              </label>
              <div class="shrink-0 space-y-2">
                <span class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Comparison mode
                </span>
                <div
                  class="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
                  role="radiogroup"
                  aria-label="Comparison mode"
                >
                  <label
                    v-for="option in compareModeOptions"
                    :key="option.value"
                    class="cursor-pointer"
                  >
                    <input
                      v-model="compareMode"
                      type="radio"
                      name="compare-mode"
                      class="sr-only"
                      :value="option.value"
                    />
                    <span
                      class="inline-flex rounded-lg px-4 py-2 text-sm font-medium transition"
                      :class="
                        compareMode === option.value
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      "
                    >
                      {{ option.label }}
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ selectedCompareMode.description }}
            </p>
          </div>

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
              {{ isSubmitting ? "Comparing..." : "Compare with Online Songs" }}
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
          v-if="queuedDownloadCount > 0 || completedDownloadCount > 0"
          class="mt-6 space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <div class="flex flex-col gap-1">
              <span>Download queue</span>
              <span
                v-if="currentDownloadSongLabel"
                class="text-xs text-slate-500 dark:text-slate-400"
              >
                Current: {{ currentDownloadSongLabel }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span>{{ queueProgressPercent }}%</span>
              <button
                v-if="isQueueFinished"
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Close download queue"
                title="Close download queue"
                @click="closeQueuePanel"
              >
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              class="h-full rounded-full bg-sky-500 transition-all"
              :style="{ width: `${queueProgressPercent}%` }"
            />
          </div>
          <p
            v-if="downloadStatusMessage"
            class="text-sm"
            :class="
              downloadStatusTone === 'warning'
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-emerald-700 dark:text-emerald-300'
            "
          >
            {{ downloadStatusMessage }}
          </p>
        </div>

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
            {{ matches.length }} track(s) matched between Spotify and online songs using
            {{ compareMode }} mode.
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
                :disabled="!markableMatchesCount"
                @click="markAllMatches"
              >
                Mark all songs
              </button>
              <span v-if="queuedDownloadCount > 0 || completedDownloadCount > 0">
                Queue: {{ completedDownloadCount }}/{{ totalTrackedDownloads }}
                completed, {{ queuedDownloadCount }} queued
              </span>
              <span v-if="downloadError" class="text-red-600 dark:text-red-400">
                {{ downloadError }}
              </span>
              <span
                v-if="downloadStatusMessage"
                :class="
                  downloadStatusTone === 'warning'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                "
              >
                {{ downloadStatusMessage }}
              </span>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Showing {{ filteredMatches.length }} of {{ matches.length }}
              </p>
            </div>
            <div
              class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            >
              <AgGridVue
                class="ag-theme-quartz w-full text-sm text-slate-700 dark:text-slate-200"
                :theme="themeQuartz"
                :data-ag-theme-mode="agThemeMode"
                :columnDefs="columnDefs"
                :defaultColDef="defaultColDef"
                :rowData="filteredMatches"
                :rowHeight="rowHeight"
                :getRowId="(params) => `${params.data.online.key}-${params.data.spotify.name}-${params.data.spotify.artist}`"
                domLayout="autoHeight"
                @grid-ready="onGridReady"
              />
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No matches found for this playlist.
          </p>
        </div>
      </section>
    </div>

    <SongPlayerBar
      v-if="activeSong"
      :activeSong="activeSong"
      :activeCoverUrl="activeCoverUrl"
      :currentTimeLabel="currentTimeLabel"
      :durationLabel="durationLabel"
      :isActiveAudioPlaying="isActiveAudioPlaying"
      :duration="duration"
      :progressPercent="progressPercent"
      v-model:playerTime="playerTime"
      :onScrollToSong="scrollToActiveSongInList"
      :onTogglePlayback="toggleAudioPlayback"
      :onStopPlayback="stopActiveAudio"
    />
  </main>
</template>
