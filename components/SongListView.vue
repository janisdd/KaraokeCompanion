<script setup lang="ts">
import { AgGridVue } from "ag-grid-vue3";
import {
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import type { PropType } from "vue";
import { defineComponent, h, resolveComponent, shallowRef } from "vue";
import type { SongInfo } from "~~/types/song";
import { useSongListView } from "~~/composables/useSongListView";


const props = defineProps<{
  title: string;
  totalCount: number;
  songs: SongInfo[] | null | undefined;
  stateKeyPrefix: string;
  audioStorageKey: string;
  isLoading: boolean;
  hasError: boolean;
  emptyMessage: string;
}>();

const { isMarkedSong, toggleMarkedSong, markedSongKeys } = useMarkedSongs();

const songSource = computed(() => props.songs ?? []);
const isDark = useState<boolean>("isDarkMode", () => false);
const agThemeMode = computed(() => (isDark.value ? "dark" : "light"));

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
  getSongTextPreview,
  isActiveAudioPlaying,
  lyricsQuery,
  metadataQuery,
  playerTime,
  progressPercent,
  searchMode,
  selectedSongKey,
  selectedSongName,
  selectedSongText,
  sortedSongs,
  stopActiveAudio,
  toggleAudioPlayback,
  toggleSongText,
} = useSongListView({
  songs: songSource,
  stateKeyPrefix: props.stateKeyPrefix,
  audioStorageKey: props.audioStorageKey,
});

const rowHeight = 48;
const gridApi = shallowRef<GridApi | null>(null);

const onGridReady = (event: GridReadyEvent) => {
  gridApi.value = event.api;
};

const refreshGrid = (refreshSort = false) => {
  if (!gridApi.value) {
    return;
  }
  gridApi.value.refreshCells({ force: true });
  if (refreshSort) {
    gridApi.value.refreshClientSideRowModel("sort");
  }
};

const sendSongToBackend = async (song: SongInfo) => {
  try {
    await $fetch("/api/sendSong", {
      method: "POST",
      body: { songId: song.id },
    });
  } catch (error) {
    console.error("Failed to send song", error);
  }
};

const MarkCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<SongInfo>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon");
    return () => {
      const song = props.params.data;
      if (!song) {
        return null;
      }
      const key = getSongKey(song);
      return h("input", {
        type: "checkbox",
        class: "h-4 w-4 accent-slate-700 dark:accent-slate-300",
        checked: isMarkedSong(key),
        "aria-label": `Mark ${song.artist} - ${song.title}`,
        onChange: () => toggleMarkedSong(key),
      });
    };
  },
});

const AudioCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<SongInfo>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon");
    return () => {
      const song = props.params.data;
      if (!song) {
        return null;
      }
      const audioFile = getAudioFile(song);
      if (!audioFile) {
        return h("span", { class: "text-slate-400 dark:text-slate-500" }, "—");
      }
      const isActive =
        activeAudioKey.value === getSongKey(song) && isActiveAudioPlaying.value;
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
      type: Object as PropType<ICellRendererParams<SongInfo>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon");
    return () => {
      const song = props.params.data;
      if (!song) {
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

const makeTextCell = (className: string) =>
  defineComponent({
    props: {
      params: {
        type: Object as PropType<ICellRendererParams<SongInfo>>,
        required: true,
      },
    },
    setup(props) {
      return () =>
        h(
          "span",
          { class: `song-cell-2lines ${className}` },
          props.params.value ?? "—",
        );
    },
  });

const PreviewCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<SongInfo>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon");
    return () => {
      const song = props.params.data;
      if (!song) {
        return null;
      }
      const key = getSongKey(song);
      return h("div", { class: "flex items-center gap-2" }, [
        h(
          "button",
          {
            type: "button",
            class:
              "inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            "aria-label":
              selectedSongKey.value === key ? "Hide song text" : "Show song text",
            onClick: () => toggleSongText(song),
          },
          [
            h(FontAwesomeIcon as any, {
              icon: "fa-solid fa-book",
            }),
          ],
        ),
        h(
          "span",
          { class: "song-cell-2lines song-cell-preview text-slate-600 dark:text-slate-300" },
          getSongTextPreview(song),
        ),
      ]);
    };
  },
});

const centerCellStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const columnDefs = computed<ColDef<SongInfo>[]>(() => [
  {
    headerName: "Mark",
    colId: "mark",
    width: 70,
    sortable: true,
    valueGetter: (params) =>
      params.data && isMarkedSong(getSongKey(params.data)) ? 1 : 0,
    cellRenderer: MarkCell,
  },
  {
    headerName: "Title",
    field: "title",
    // minWidth: 90,
    width: 160,
    // flex: 1,
    cellRenderer: makeTextCell("song-cell-title"),
  },
  {
    headerName: "Artist",
    field: "artist",
    width: 140,
    // flex: 1,
    cellRenderer: makeTextCell("song-cell-artist"),
  },
  {
    headerName: "Audio",
    colId: "audio",
    width: 70,
    sortable: false,
    cellStyle: centerCellStyle,
    valueGetter: (params) => (params.data && getAudioFile(params.data) ? 1 : 0),
    cellRenderer: AudioCell,
  },
  {
    headerName: "Send",
    colId: "send",
    width: 70,
    sortable: false,
    cellStyle: centerCellStyle,
    headerTooltip: "Select song in Ultra Star", // this onl works if the song is in the current list of songs
    valueGetter: (params) => (params.data ? 1 : 0),
    cellRenderer: SendCell,
  },
  {
    headerName: "Language",
    field: "language",
    width: 100,
    // flex: 1,
    valueFormatter: (params) => params.value ?? "—",
    cellRenderer: makeTextCell("song-cell-language"),
  },
  {
    headerName: "Year",
    field: "year",
    width: 80,
    valueFormatter: (params) => params.value ?? "—",
  },
  {
    headerName: "Genre",
    field: "genre",
    width: 140,
    valueFormatter: (params) => params.value ?? "—",
    cellRenderer: makeTextCell("song-cell-genre"),
  },
  {
    headerName: "Song text preview",
    colId: "preview",
    minWidth: 220,
    maxWidth: 220,
    // flex: 2,
    sortable: false,
    valueGetter: (params) =>
      params.data ? getSongTextPreview(params.data) : "—",
    cellRenderer: PreviewCell,
  },
]);

const defaultColDef: ColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
};

const scrollToActiveSongInList = () => {
  if (!process.client || !activeSong.value || !gridApi.value) {
    return;
  }

  const targetKey = getSongKey(activeSong.value);
  const index = sortedSongs.value.findIndex(
    (song) => getSongKey(song) === targetKey,
  );
  if (index === -1) {
    return;
  }

  gridApi.value.ensureIndexVisible(index, "middle");
};

watch([activeAudioKey, isActiveAudioPlaying, selectedSongKey], () => {
  refreshGrid();
});

watch([searchMode, lyricsQuery], () => {
  refreshGrid();
});

watch(
  markedSongKeys,
  () => {
    refreshGrid(true);
  },
  { deep: true },
);
</script>

<template>
  <main
    class="box-border h-[calc(100vh-3rem)] overflow-hidden bg-slate-50 px-3 pt-6 sm:px-6 sm:pt-8 dark:bg-slate-950"
    :class="activeSong ? 'pb-28' : 'pb-8'"
  >
    <div class="mx-auto flex h-full max-w-5xl flex-col gap-2 md:gap-6">
      <header class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-2">
            <h1 class="hidden text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:block">
              {{ title }}
            </h1>
          </div>
        </div>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex w-full flex-col gap-3 md:max-w-2xl">
          <div class="flex flex-wrap items-center gap-3">
            <fieldset class="m-0 flex flex-wrap items-center gap-4 border-0 p-0 text-xs text-slate-600 dark:text-slate-300">
              <label class="flex items-center gap-2">
                <input v-model="searchMode" type="radio" value="metadata" />
                Search metadata
              </label>
              <label class="flex items-center gap-2">
                <input v-model="searchMode" type="radio" value="lyrics" />
                Search song text
              </label>
            </fieldset>
            <slot name="search-mode-actions" />
          </div>
          <div class="flex flex-col gap-2 md:flex-row">
            <label
              v-if="searchMode === 'metadata'"
              class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span class="text-slate-500 dark:text-slate-400">Metadata</span>
              <input
                v-model="metadataQuery"
                type="search"
                placeholder="Title, artist, year, genre, language"
                class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>
            <label
              v-else
              class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span class="text-slate-500 dark:text-slate-400">Text</span>
              <input
                v-model="lyricsQuery"
                type="search"
                placeholder="Lyrics or words from the song text"
                class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>
          </div>
        </div>
        <div class="flex items-center gap-2 md:flex-col md:items-end md:gap-1">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Showing {{ sortedSongs.length }} of {{ totalCount }}
          </p>
          <slot name="header-actions" />
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col">
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
        <div v-else class="flex min-h-0 flex-1 flex-col">
          <div
            v-if="selectedSongText"
            class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm pt-20"
            role="dialog"
            aria-modal="true"
          >
            <div class="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <div class="mb-2 flex items-start justify-between gap-3">
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
              <div class="max-h-[60vh] overflow-y-auto pr-1">
                <p class="whitespace-pre-wrap break-words">{{ selectedSongText }}</p>
              </div>
            </div>
          </div>
          <div
            v-if="songSource.length"
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <AgGridVue
              class="ag-theme-quartz h-full w-full text-sm text-slate-700 dark:text-slate-200"
              :columnDefs="columnDefs"
              :theme="themeQuartz"
              :data-ag-theme-mode="agThemeMode"
              :defaultColDef="defaultColDef"
              :rowData="sortedSongs"
              :rowHeight="rowHeight"
              @grid-ready="onGridReady"
            />
          </div>

          <div
            v-else
            class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            {{ emptyMessage }}
          </div>
        </div>
      </div>
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

<style scoped>
.song-cell-2lines {
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.25rem;
  max-height: 2.5rem;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.song-cell-title {
  max-width: 28rem;
}

.song-cell-artist {
  max-width: 20rem;
}

.song-cell-language {
  max-width: 12rem;
}

.song-cell-genre {
  max-width: 16rem;
}

.song-cell-preview {
  max-width: 28rem;
}

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

:global(.dark .ag-theme-quartz) {
  --ag-background-color: rgb(2 6 23 / var(--tw-bg-opacity, 1));
  --ag-odd-row-background-color: rgb(2 6 23 / var(--tw-bg-opacity, 1));
  --ag-header-background-color: rgb(2 6 23 / var(--tw-bg-opacity, 1));
}
</style>
