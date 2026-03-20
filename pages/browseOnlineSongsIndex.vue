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
  status: "queued" | "downloading";
  controller?: AbortController;
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

const onlineSongs = computed(() => response.value?.data ?? []);

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

const queueDownload = (song: OnlineSongInfo) => {
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

  downloadError.value = null;
  downloadQueue.value = [...downloadQueue.value, { song, status: "queued" }];
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
      type: Object as PropType<ICellRendererParams<OnlineSongInfo>>,
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
    };
  },
});

const centerCellStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const ExistingStatusCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<OnlineSongInfo>>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const song = props.params.data;
      if (!song) {
        return null;
      }

      const exists = song.existingOrAlreadyDownloaded;
      return h(
        "span",
        {
          class: exists
            ? "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            : "inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        },
        exists ? "Yes" : "No",
      );
    };
  },
});

const columnDefs: ColDef<OnlineSongInfo>[] = [
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
    field: "existingOrAlreadyDownloaded",
    width: 90,
    cellStyle: centerCellStyle,
    valueFormatter: (params) => (params.value ? "Yes" : "No"),
    cellRenderer: ExistingStatusCell,
    suppressMovable: true,
    resizable: true,
  },
];

const defaultColDef: ColDef<OnlineSongInfo> = {
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
          <span v-else-if="error">Failed to load online songs.</span>
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
