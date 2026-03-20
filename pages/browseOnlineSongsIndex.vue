<script setup lang="ts">
import { AgGridVue } from "ag-grid-vue3";
import {
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { defineComponent, h, type PropType } from "vue";
import type { OnlineSongInfo } from "~/helpers/allOnlineSongsIndexer";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import type { SongInfo } from "~/types/song";
import { useSongs } from "~~/composables/useSongs";
import { useSongListAudioPlayback } from "~~/composables/useSongListAudioPlayback";

defineOptions({
  name: "BrowseOnlineSongsIndexPage",
});

definePageMeta({
  title: "Browse Online Songs",
});

type OnlineSongsIndexResponse = {
  success: boolean;
  data: OnlineSongInfo[];
};

type QueuedDownload = {
  song: OnlineSongInfo;
  overwriteExisting: boolean;
  status: "queued" | "downloading";
  controller?: AbortController;
};

type ExistingStatus = "no" | "indexed" | "downloaded";

type OnlineSongRow = OnlineSongInfo & {
  existingStatus: ExistingStatus;
  existingSong: SongInfo | null;
  language: SongInfo["language"];
  year: SongInfo["year"];
  genre: SongInfo["genre"];
  audioAvailable: boolean;
};

const MAX_QUEUED_DOWNLOADS = 5;

const searchQuery = ref("");
const downloadError = ref<string | null>(null);
const downloadQueue = ref<QueuedDownload[]>([]);
const completedDownloadCount = ref(0);
const isProcessingQueue = ref(false);
const isDark = useState<boolean>("isDarkMode", () => false);
const agThemeMode = computed(() => (isDark.value ? "dark" : "light"));

const {
  data: response,
  pending,
  error,
} = await useFetch<OnlineSongsIndexResponse>("/api/onlineSongsIndex");

const {
  songs: existingSongs,
  pending: existingSongsPending,
  error: existingSongsError,
} = useSongs();

const {
  activeAudioKey,
  isActiveAudioPlaying,
  toggleAudioPlayback,
} = useSongListAudioPlayback({
  audioStorageKey: "browse-online-songs",
  getSongKey: (song) => song.key,
  getSongRowId: (song) => `browse-online-song-${encodeURIComponent(song.key)}`,
});

const existingSongsByKey = computed(() => {
  return new Map(existingSongs.value.map((song) => [song.key, song]));
});

const onlineSongs = computed<OnlineSongRow[]>(() => {
  return (response.value?.data ?? []).map((song) => {
    const existingSong = existingSongsByKey.value.get(song.key) ?? null;
    const existingStatus: ExistingStatus = existingSong
      ? "indexed"
      : song.existingOrAlreadyDownloaded
        ? "downloaded"
        : "no";

    return {
      ...song,
      existingStatus,
      existingSong,
      language: existingSong?.language ?? null,
      year: existingSong?.year ?? null,
      genre: existingSong?.genre ?? null,
      audioAvailable: Boolean(existingSong?.audioFile),
    };
  });
});

const filteredSongs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return onlineSongs.value;
  }

  return onlineSongs.value.filter((song) => {
    return `${song.artist} ${song.songName}`.toLowerCase().includes(query);
  });
});

const queuedDownloadCount = computed(() => downloadQueue.value.length);
const totalTrackedDownloads = computed(
  () => queuedDownloadCount.value + completedDownloadCount.value,
);
const isQueueFinished = computed(
  () =>
    completedDownloadCount.value > 0 &&
    queuedDownloadCount.value === 0 &&
    !isProcessingQueue.value,
);
const queueProgressPercent = computed(() => {
  if (!totalTrackedDownloads.value) {
    return 0;
  }

  return Math.round((completedDownloadCount.value / totalTrackedDownloads.value) * 100);
});

const isQueuedSong = (songId: string) =>
  downloadQueue.value.some((item) => item.song.songId === songId);

const isDownloadingSong = (songId: string) =>
  downloadQueue.value.some(
    (item) => item.song.songId === songId && item.status === "downloading",
  );

const resetQueueProgressIfIdle = () => {
  if (!downloadQueue.value.length && !isProcessingQueue.value) {
    completedDownloadCount.value = 0;
  }
};

const removeQueuedSong = (songId: string) => {
  downloadQueue.value = downloadQueue.value.filter((item) => item.song.songId !== songId);
};

const confirmOverwriteDownload = (song: OnlineSongRow) => {
  if (song.existingStatus === "no") {
    return true;
  }

  const existingLabel =
    song.existingStatus === "indexed" ? "already indexed locally" : "already downloaded";

  if (!process.client) {
    return false;
  }

  return window.confirm(
    `${song.artist} - ${song.songName} is ${existingLabel}.\n\nDo you want to overwrite the existing song files?`,
  );
};

const processDownloadQueue = async () => {
  if (isProcessingQueue.value) {
    return;
  }

  const nextItem = downloadQueue.value.find((item) => item.status === "queued");
  if (!nextItem) {
    isProcessingQueue.value = false;
    return;
  }

  isProcessingQueue.value = true;
  nextItem.status = "downloading";
  const controller = new AbortController();
  nextItem.controller = controller;

  try {
    await $fetch("/api/onlineSongsDownload", {
      method: "POST",
      body: {
        songs: [nextItem.song],
        overwriteExisting: nextItem.overwriteExisting,
      },
      signal: controller.signal,
    });
    completedDownloadCount.value += 1;
  } catch (error: any) {
    if (error?.name !== "AbortError") {
      downloadError.value =
        error?.data?.message ?? error?.message ?? "Failed to download song.";
      console.error("Failed to download online song", error);
    }
  } finally {
    removeQueuedSong(nextItem.song.songId);
    isProcessingQueue.value = false;
    if (downloadQueue.value.length) {
      void processDownloadQueue();
    }
  }
};

const queueDownload = (song: OnlineSongRow) => {
  if (isQueuedSong(song.songId)) {
    return;
  }

  if (!downloadQueue.value.length) {
    completedDownloadCount.value = 0;
  }

  if (downloadQueue.value.length >= MAX_QUEUED_DOWNLOADS) {
    downloadError.value = `You can queue at most ${MAX_QUEUED_DOWNLOADS} downloads at a time.`;
    return;
  }

  const overwriteExisting = confirmOverwriteDownload(song);
  if (!overwriteExisting && song.existingStatus !== "no") {
    return;
  }

  downloadError.value = null;
  downloadQueue.value = [
    ...downloadQueue.value,
    { song, overwriteExisting, status: "queued" },
  ];
  void processDownloadQueue();
};

const cancelDownload = (song: OnlineSongInfo) => {
  const queuedItem = downloadQueue.value.find((item) => item.song.songId === song.songId);
  if (!queuedItem) {
    return;
  }

  if (queuedItem.status === "downloading") {
    queuedItem.controller?.abort();
  }

  removeQueuedSong(song.songId);
  resetQueueProgressIfIdle();
};

const closeQueuePanel = () => {
  if (!isQueueFinished.value) {
    return;
  }

  completedDownloadCount.value = 0;
  downloadError.value = null;
};

const DownloadCell = defineComponent({
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

      const isQueued = isQueuedSong(song.songId);
      const isDownloading = isDownloadingSong(song.songId);
      const isRetry = song.existingStatus !== "no";
      const actionLabel = isRetry ? "Retry download" : "Queue download";
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
            !isQueued && queuedDownloadCount.value >= MAX_QUEUED_DOWNLOADS,
          "aria-label": isQueued
            ? `Cancel download for ${song.artist} - ${song.songName}`
            : `${actionLabel} for ${song.artist} - ${song.songName}`,
          title: isQueued
            ? `Cancel download for ${song.artist} - ${song.songName}`
            : `${actionLabel} for ${song.artist} - ${song.songName}`,
          onClick: () => (isQueued ? cancelDownload(song) : queueDownload(song)),
        },
        [
          h(FontAwesomeIcon, {
            icon: isQueued
              ? "fa-solid fa-xmark"
              : isRetry
                ? "fa-solid fa-rotate-right"
                : "fa-solid fa-cloud-arrow-down",
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

const getExistingStatusLabel = (status: ExistingStatus) => {
  switch (status) {
    case "indexed":
      return "Indexed";
    case "downloaded":
      return "Downloaded";
    default:
      return "No";
  }
};

const getExistingStatusClass = (status: ExistingStatus) => {
  switch (status) {
    case "indexed":
      return "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "downloaded":
      return "inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
    default:
      return "inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
};

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
    headerName: "Download",
    colId: "download",
    width: 60,
    sortable: false,
    resizable: false,
    cellStyle: centerCellStyle,
    valueGetter: (params) => (params.data ? 1 : 0),
    cellRenderer: DownloadCell,
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
  <main class="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="space-y-2">
        <h1
          class="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
        >
          Browse Online Songs
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Search the indexed online songs by artist or song name.
        </p>
      </header>

      <section class="space-y-4">
        <label class="block space-y-2">
          <span
            class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Search
          </span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search artists or songs..."
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-600"
          />
        </label>

        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400"
        >
          <span v-if="pending">Loading online songs...</span>
          <span v-else-if="existingSongsPending">Loading existing songs...</span>
          <span v-else-if="error">Failed to load online songs.</span>
          <span v-else-if="existingSongsError">Failed to load existing songs.</span>
          <span v-else>{{ filteredSongs.length }} song(s) found.</span>
          <span v-if="queuedDownloadCount > 0 || completedDownloadCount > 0">
            Queue: {{ completedDownloadCount }}/{{ totalTrackedDownloads }}
            completed, {{ queuedDownloadCount }} queued
          </span>
          <span v-if="downloadError" class="text-red-600 dark:text-red-400">
            {{ downloadError }}
          </span>
        </div>

        <div
          v-if="queuedDownloadCount > 0 || completedDownloadCount > 0"
          class="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>Download queue</span>
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
        </div>

        <div
          v-if="!pending && !error"
          class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="h-[60vh] min-h-[24rem]">
            <AgGridVue
              class="ag-theme-quartz h-full w-full text-sm text-slate-700 dark:text-slate-200"
              :theme="themeQuartz"
              :data-ag-theme-mode="agThemeMode"
              :columnDefs="columnDefs"
              :defaultColDef="defaultColDef"
              :rowData="filteredSongs"
            />
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
