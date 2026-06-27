<script setup lang="ts">
import { AgGridVue } from "ag-grid-vue3";
import {
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import { defineComponent, h, shallowRef, type PropType } from "vue";
import type { OnlineSongInfo } from "~/helpers/allOnlineSongsIndexer";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import type { ExistingStatus, OnlineSongsIndexResponse } from "~/types/onlineSongs";
import type { SongInfoCatalog } from "~/types/song"
import { useSongs } from "~~/composables/useSongs";
import {
  scrollToGridSong,
  useSongListAudioPlayback,
} from "~~/composables/useSongListAudioPlayback";
import {
  getExistingStatusClass,
  getExistingStatusLabel,
  resolveExistingStatus,
  useOnlineSongDownloads,
} from "~~/composables/useOnlineSongDownloads";
import { useMarkedSongs } from "~~/composables/useMarkedSongs";

defineOptions({
  name: "BrowseOnlineSongsIndexPage",
});

definePageMeta({
  title: "Browse Online Songs",
});

type OnlineSongRow = OnlineSongInfo & {
  existingStatus: ExistingStatus
  existingSong: SongInfoCatalog | null
  language: SongInfoCatalog["language"]
  year: SongInfoCatalog["year"]
  genre: SongInfoCatalog["genre"]
  audioAvailable: boolean
}

const searchQuery = ref("");
const { minimumSearchChars } = useSearchMinimumChars()
const isDark = useState<boolean>("isDarkMode", () => false);
const agThemeMode = computed(() => (isDark.value ? "dark" : "light"));
const trimmedSearchQuery = computed(() => searchQuery.value.trim())
const isSearchQueryTooShort = computed(() => {
  return (
    minimumSearchChars.value > 0 &&
    trimmedSearchQuery.value.length > 0 &&
    trimmedSearchQuery.value.length < minimumSearchChars.value
  )
})

const {
  data: response,
  pending,
  error,
  refresh: refreshOnlineSongsIndex,
} = useFetch<OnlineSongsIndexResponse>("/api/onlineSongsIndex");

const isInitialOnlineSongsLoading = computed(
  () => pending.value && !response.value && !error.value,
)

const showOnlineSongsGrid = computed(
  () => Boolean(response.value) && !error.value,
);

const getOnlineSongRowId = (params: GetRowIdParams<OnlineSongRow>) =>
  params.data?.key ?? "";

const {
  songs: existingSongs,
  pending: existingSongsPending,
  error: existingSongsError,
  refresh: refreshExistingSongs,
} = useSongs();

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
} = useOnlineSongDownloads<OnlineSongRow>({
  getDownloadSong: (song) => song,
  refreshOnlineSongs: refreshOnlineSongsIndex,
  refreshExistingSongs,
});

const {
  isMarkedSong,
  toggleMarkedSong,
  isMarkedSongsAuthenticated,
} = useMarkedSongs();

const {
  activeAudioKey,
  activeCoverUrl,
  activeSong,
  currentTimeLabel,
  duration,
  durationLabel,
  isActiveAudioPlaying,
  playerTime,
  progressPercent,
  stopActiveAudio,
  toggleAudioPlayback,
} = useSongListAudioPlayback({
  audioStorageKey: "browse-online-songs",
  getSongKey: (song) => song.key,
  getSongRowId: (song) => `browse-online-song-${encodeURIComponent(song.key)}`,
});

const gridApi = shallowRef<GridApi | null>(null);

const onGridReady = (event: GridReadyEvent) => {
  gridApi.value = event.api;
};

const existingSongsByKey = computed(() => {
  return new Map(existingSongs.value.map((song) => [song.key, song]));
});

const onlineSongs = computed<OnlineSongRow[]>(() => {
  return (response.value?.data ?? []).map((song) => {
    const existingSong = existingSongsByKey.value.get(song.key) ?? null;
    const existingStatus = resolveExistingStatus({
      hasExistingSong: Boolean(existingSong),
      backendIndexed: song.indexed,
      backendDownloading: song.downloading,
      songId: song.songId,
      isDownloadingSong,
      isWaitingForRefreshSong,
    });

    return {
      ...song,
      existingStatus,
      existingSong,
      language: existingSong?.language ?? null,
      year: existingSong?.year ?? null,
      genre: existingSong?.genre ?? null,
      audioAvailable: Boolean(existingSong?.audioFileName),
    };
  });
});

const scrollToActiveSongInList = () => {
  scrollToGridSong({
    gridApi: gridApi.value,
    songKey: activeSong.value?.key,
    getRowSongKey: (row) => row.existingSong?.key,
  });
};

const filteredSongs = computed(() => {
  const query = trimmedSearchQuery.value.toLowerCase();
  if (!query) {
    return onlineSongs.value;
  }
  if (query.length < minimumSearchChars.value) {
    return onlineSongs.value;
  }

  return onlineSongs.value.filter((song) => {
    return `${song.artist} ${song.songName}`.toLowerCase().includes(query);
  });
});

const centerCellStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const MarkCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<OnlineSongRow>>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const song = props.params.data;
      if (!song) {
        return null;
      }

      if (song.existingSong && !isMarkedSongsAuthenticated.value) {
        return null;
      }

      if (!song.existingSong) {
        if (song.existingStatus !== "no") {
          return null;
        }

        const isQueued = isQueuedSong(song.songId);
        const isDownloading = isDownloadingSong(song.songId);
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
              ? `Cancel download for ${song.artist} - ${song.songName}`
              : `Queue download for ${song.artist} - ${song.songName}`,
            title: isQueued
              ? `Cancel download for ${song.artist} - ${song.songName}`
              : `Queue download for ${song.artist} - ${song.songName}`,
            onClick: () => (isQueued ? cancelDownload(song) : queueDownload(song)),
          },
          [
            h(FontAwesomeIcon, {
              icon: isQueued ? "fa-solid fa-xmark" : "fa-solid fa-cloud-arrow-down",
            }),
          ],
        );
      }

      const existingSong = song.existingSong;
      return h("input", {
        type: "checkbox",
        class: "h-4 w-4 accent-slate-700 dark:accent-slate-300",
        checked: isMarkedSong(existingSong.key),
        "aria-label": `Mark ${existingSong.artist} - ${existingSong.title}`,
        onChange: () => toggleMarkedSong(existingSong.key),
      });
    };
  },
});

const AudioCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<OnlineSongRow>>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const song = props.params.data;
      const existingSong = song?.existingSong;
      if (!song || !existingSong || !song.audioAvailable) {
        return h("span", { class: "text-slate-400 dark:text-slate-500" }, "—");
      }

      const isActive =
        activeAudioKey.value === existingSong.key && isActiveAudioPlaying.value;

      return h(
        "button",
        {
          type: "button",
          class:
            "inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
          "aria-label": isActive ? "Pause audio" : "Play audio",
          onClick: () => toggleAudioPlayback(existingSong),
        },
        [
          h(FontAwesomeIcon, {
            icon: isActive ? "fa-solid fa-pause" : "fa-solid fa-play",
          }),
        ],
      );
    };
  },
});

const ExistingStatusCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<OnlineSongRow>>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const song = props.params.data;
      if (!song) {
        return null;
      }

      const status = song.existingStatus;
      return h(
        "span",
        {
          class: getExistingStatusClass(status),
        },
        getExistingStatusLabel(status),
      );
    };
  },
});

const columnDefs: ColDef<OnlineSongRow>[] = [
  {
    headerName: "Mark",
    colId: "mark",
    width: 70,
    sortable: false,
    resizable: false,
    cellStyle: centerCellStyle,
    valueGetter: (params) => {
      const song = params.data;
      if (!song) {
        return 0;
      }

      return song.existingSong || song.existingStatus === "no" ? 1 : 0;
    },
    cellRenderer: MarkCell,
    suppressMovable: true,
  },
  {
    headerName: "Artist",
    field: "artist",
    minWidth: 220,
    sort: "asc",
    suppressMovable: true,
    resizable: true,
  },
  {
    headerName: "Song",
    field: "songName",
    minWidth: 220,
    suppressMovable: true,
    resizable: true,
  },
  {
    headerName: "Existing",
    field: "existingStatus",
    width: 120,
    cellStyle: centerCellStyle,
    valueFormatter: (params) =>
      getExistingStatusLabel((params.value as ExistingStatus) ?? "no"),
    cellRenderer: ExistingStatusCell,
    suppressMovable: true,
    resizable: true,
  },
  {
    headerName: "Language",
    field: "language",
    width: 100,
    valueFormatter: (params) => params.value ?? "—",
    suppressMovable: true,
    resizable: true,
  },
  {
    headerName: "Year",
    field: "year",
    width: 80,
    valueFormatter: (params) => params.value ?? "—",
    suppressMovable: true,
    resizable: true,
  },
  {
    headerName: "Audio",
    colId: "audio",
    width: 70,
    sortable: false,
    cellStyle: centerCellStyle,
    valueGetter: (params) => (params.data?.audioAvailable ? 1 : 0),
    cellRenderer: AudioCell,
    suppressMovable: true,
    resizable: true,
  },
  {
    headerName: "Genre",
    field: "genre",
    width: 140,
    valueFormatter: (params) => params.value ?? "—",
    suppressMovable: true,
    resizable: true,
  },
];

const defaultColDef: ColDef<OnlineSongRow> = {
  sortable: true,
  resizable: true,
  comparator: (valueA, valueB) => {
    return String(valueA ?? "").localeCompare(String(valueB ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  },
};
</script>

<template>
  <main
    class="box-border h-[calc(100vh-3rem)] overflow-hidden bg-slate-50 px-3 pt-6 sm:px-6 sm:pt-8 dark:bg-slate-950"
    :class="activeSong ? 'pb-28' : 'pb-8'"
  >
    <div class="mx-auto flex h-full max-w-5xl flex-col gap-2 md:gap-6">
      <header>
        <h1
          class="hidden text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:block"
        >
          Browse Online Songs
        </h1>
      </header>

      <section class="flex min-h-0 flex-1 flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex w-full flex-col md:max-w-2xl">
            <div class="flex items-start gap-2 md:max-w-md">
              <div class="w-full">
                <label
                  class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span class="text-slate-500 dark:text-slate-400">Search</span>
                  <input
                    v-model="searchQuery"
                    type="search"
                    placeholder="Search artists or songs..."
                    class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>
                <p
                  v-if="isSearchQueryTooShort"
                  class="mt-1 text-xs text-slate-500 dark:text-slate-400"
                >
                  Enter at least {{ minimumSearchChars }} characters to start filtering.
                </p>
              </div>
              <PageAboutInfo>
                <p>
                  Search the indexed online songs by artist or song name. The download queue
                  stays in sync when you switch between views, and active downloads continue
                  in the backend while the local song list refresh catches up.
                </p>
              </PageAboutInfo>
            </div>
          </div>
          <div class="flex items-center gap-2 md:flex-col md:items-end md:gap-1">
            <p
              v-if="pending && !response"
              class="text-xs text-slate-500 dark:text-slate-400"
            >
              Loading online songs...
            </p>
            <p
              v-else-if="pending"
              class="text-xs text-slate-500 dark:text-slate-400"
            >
              Refreshing online songs...
            </p>
            <p
              v-else-if="existingSongsPending"
              class="text-xs text-slate-500 dark:text-slate-400"
            >
              Loading existing songs...
            </p>
            <p
              v-else-if="error"
              class="text-xs text-red-600 dark:text-red-400"
            >
              Failed to load online songs.
            </p>
            <p
              v-else-if="existingSongsError"
              class="text-xs text-red-600 dark:text-red-400"
            >
              Failed to load existing songs.
            </p>
            <p v-else class="text-xs text-slate-500 dark:text-slate-400">
              Showing {{ filteredSongs.length }} of {{ onlineSongs.length }}
            </p>
          </div>
        </div>

        <div
          v-if="
            (queuedDownloadCount > 0 || completedDownloadCount > 0)
              || downloadError
              || downloadStatusMessage
          "
          class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400"
        >
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
        </div>

        <div
          v-if="queuedDownloadCount > 0 || completedDownloadCount > 0"
          class="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
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
          v-if="isInitialOnlineSongsLoading"
          class="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          role="status"
          aria-live="polite"
        >
          <div class="flex flex-col items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span
              class="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
              aria-hidden="true"
            ></span>
            <span>Loading online songs...</span>
          </div>
        </div>

        <div
          v-else-if="showOnlineSongsGrid"
          class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        >
          <AgGridVue
            class="ag-theme-quartz h-full w-full text-sm text-slate-700 dark:text-slate-200"
            :theme="themeQuartz"
            :data-ag-theme-mode="agThemeMode"
            :columnDefs="columnDefs"
            :defaultColDef="defaultColDef"
            :getRowId="getOnlineSongRowId"
            :rowData="filteredSongs"
            @grid-ready="onGridReady"
          />
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
