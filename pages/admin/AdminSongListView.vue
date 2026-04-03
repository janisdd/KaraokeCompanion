<script setup lang="ts">
import { AgGridVue } from "ag-grid-vue3"
import {
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type ValueGetterParams,
} from "ag-grid-community"
import type { PropType } from "vue"
import { defineComponent, h, resolveComponent, shallowRef } from "vue"
import { scrollToGridSong } from "~~/composables/useSongListAudioPlayback"
import { useSongListView } from "~~/composables/useSongListView"
import { useSongs } from "~~/composables/useSongs"
import type {
  AnalyzeResultKey,
  AnalyzeResultsMap,
  AnalyzeResultsSongEntry,
  LoudnessWarning,
} from "~/types/analyzeResults"
import { analyzeResultColumns } from "~/types/analyzeResults"
import type { SongInfo } from "~~/types/song"

defineOptions({
  name: "AdminSongListView",
})

const emit = defineEmits<{
  (event: "show-analyzer-result", payload: { title: string; content: string }): void
  (event: "show-loudness-warning", payload: LoudnessWarning): void
  (event: "show-song-info", payload: { title: string; content: string }): void
  (event: "show-song-tools", payload: { songKey: string; title: string }): void
  (event: "run-analyzer", payload: { songKey: string; analyzerKey: AnalyzeResultKey }): void
}>()

const props = withDefaults(
  defineProps<{
    title?: string
    emptyMessage?: string
    analyzerResults?: AnalyzeResultsSongEntry[]
    activeAnalyzeRequestKey?: string | null
    loudnessWarningsBySong?: Record<string, LoudnessWarning>
    showLyricsSearch?: boolean
  }>(),
  {
    title: "Manage Songs",
    emptyMessage: "No songs found.",
    analyzerResults: () => [],
    activeAnalyzeRequestKey: null,
    loudnessWarningsBySong: () => ({}),
    showLyricsSearch: true,
  },
)

const { songs, pending, error } = useSongs()
const totalCount = computed(() => songs.value?.length ?? 0)

const songSource = computed(() => songs.value ?? [])
const isDark = useState<boolean>("isDarkMode", () => false)
const agThemeMode = computed(() => (isDark.value ? "dark" : "light"))

const {
  activeAudioKey,
  activeCoverUrl,
  activeSong,
  currentTimeLabel,
  duration,
  durationLabel,
  getAudioFile,
  getSongKey,
  isActiveAudioPlaying,
  lyricsQuery,
  metadataQuery,
  playerTime,
  progressPercent,
  searchMode,
  sortedSongs,
  stopActiveAudio,
  toggleAudioPlayback,
} = useSongListView({
  songs: songSource,
  stateKeyPrefix: "admin-songs",
  audioStorageKey: "admin-songs",
})

const rowHeight = 48
const gridApi = shallowRef<GridApi | null>(null)

const onGridReady = (event: GridReadyEvent) => {
  gridApi.value = event.api
}

const refreshGrid = () => {
  if (!gridApi.value) {
    return
  }
  gridApi.value.refreshCells({ force: true })
}

const getAnalyzerEntryKey = (songKey: string, songDirName: string) =>
  `${songKey}::${songDirName}`

const getAnalyzeRequestKey = (songKey: string, analyzerKey: AnalyzeResultKey) =>
  `${songKey}::${analyzerKey}`

const analyzerResultsBySong = computed(() => {
  return new Map(
    props.analyzerResults.map((entry) => [
      getAnalyzerEntryKey(entry.songKey, entry.songDirName),
      entry,
    ]),
  )
})

const AudioCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<SongInfo>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon")
    return () => {
      const song = props.params.data
      if (!song) {
        return null
      }
      const audioFile = getAudioFile(song)
      if (!audioFile) {
        return h("span", { class: "text-slate-400 dark:text-slate-500" }, "—")
      }
      const isActive =
        activeAudioKey.value === getSongKey(song) && isActiveAudioPlaying.value
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
      )
    }
  },
})

type AnalyzerCellValue = {
  analyzerKey: AnalyzeResultKey
  analyzerLabel: string
  hasResult: boolean
  result?: AnalyzeResultsMap[AnalyzeResultKey]
  loudnessWarning?: LoudnessWarning
  songLabel: string
  songKey: string
  isAnalyzeRunning: boolean
  isAnalyzeDisabled: boolean
}

const analyzerButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"

const AnalyzerActionsCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<SongInfo, AnalyzerCellValue>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon")

    return () => {
      const value = props.params.value
      if (!value) {
        return null
      }

      const buttons = [
        h(
          "button",
          {
            type: "button",
            class: analyzerButtonClass,
            "aria-label": value.isAnalyzeRunning
              ? `Running ${value.analyzerLabel} analyzer`
              : `Run ${value.analyzerLabel} analyzer`,
            title: value.isAnalyzeRunning
              ? `Running ${value.analyzerLabel} analyzer`
              : `Run ${value.analyzerLabel} analyzer`,
            disabled: value.isAnalyzeDisabled,
            onClick: () => {
              if (
                value.hasResult &&
                !window.confirm(
                  `Re-run ${value.analyzerLabel} analyzer for ${value.songLabel}?`,
                )
              ) {
                return
              }

              emit("run-analyzer", {
                songKey: value.songKey,
                analyzerKey: value.analyzerKey,
              })
            },
          },
          value.isAnalyzeRunning
            ? h("span", {
                class:
                  "h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300",
                "aria-hidden": "true",
              })
            : h(FontAwesomeIcon as any, {
                icon: "fa-solid fa-terminal",
              }),
        ),
      ]

      if (value.hasResult) {
        buttons.push(
          h(
            "button",
            {
              type: "button",
              class: analyzerButtonClass,
              "aria-label": `Show ${value.analyzerLabel} result`,
              title: `Show ${value.analyzerLabel} result`,
              onClick: () =>
                emit("show-analyzer-result", {
                  title: `${value.analyzerLabel} result`,
                  content: `Song: ${value.songLabel}\n\n${JSON.stringify(value.result, null, 2)}`,
                }),
            },
            h(FontAwesomeIcon as any, {
              icon: "fa-solid fa-chart-simple",
            }),
          ),
        )
      }

      if (value.loudnessWarning) {
        buttons.push(
          h(
            "button",
            {
              type: "button",
              class: `${analyzerButtonClass} text-amber-600 dark:text-amber-400`,
              "aria-label": `Show loudness warning for ${value.songLabel}`,
              title: `${value.loudnessWarning.status}\nMeasured: ${value.loudnessWarning.measuredLoudness.toFixed(2)} LUFS\nDifference: ${value.loudnessWarning.difference > 0 ? "+" : ""}${value.loudnessWarning.difference.toFixed(2)} LUFS`,
              onClick: () =>
                (emit as any)("show-loudness-warning", {
                  ...value.loudnessWarning,
                  songLabel: value.songLabel,
                }),
            },
            h(FontAwesomeIcon as any, {
              icon: "fa-solid fa-triangle-exclamation",
            }),
          ),
        )
      }

      return h("div", { class: "flex min-w-[6.5rem] items-center justify-start gap-2" }, buttons)
    }
  },
})

const SongInfoCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<SongInfo>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon")

    return () => {
      const song = props.params.data
      if (!song) {
        return null
      }

      return h(
        "button",
        {
          type: "button",
          class: analyzerButtonClass,
          "aria-label": `Show info for ${song.artist} - ${song.title}`,
          title: `Show info for ${song.artist} - ${song.title}`,
          onClick: () =>
            emit("show-song-info", {
              title: `${song.artist} - ${song.title}`,
              content: JSON.stringify(song, null, 2),
            }),
        },
        h(FontAwesomeIcon as any, {
          icon: "fa-solid fa-circle-info",
        }),
      )
    }
  },
})

const SongToolsCell = defineComponent({
  props: {
    params: {
      type: Object as PropType<ICellRendererParams<SongInfo>>,
      required: true,
    },
  },
  setup(props) {
    const FontAwesomeIcon = resolveComponent("font-awesome-icon")

    return () => {
      const song = props.params.data
      if (!song) {
        return null
      }

      return h(
        "button",
        {
          type: "button",
          class: analyzerButtonClass,
          "aria-label": `Open tools for ${song.artist} - ${song.title}`,
          title: `Open tools for ${song.artist} - ${song.title}`,
          onClick: () =>
            emit("show-song-tools", {
              songKey: song.key,
              title: `${song.artist} - ${song.title}`,
            }),
        },
        h(FontAwesomeIcon as any, {
          icon: "fa-solid fa-wrench",
        }),
      )
    }
  },
})

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
        )
    },
  })

const centerCellStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

const columnDefs = computed<ColDef<SongInfo>[]>(() => [
  {
    headerName: "Title",
    field: "title",
    width: 160,
    cellRenderer: makeTextCell("song-cell-title"),
  },
  {
    headerName: "Artist",
    field: "artist",
    width: 140,
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
    headerName: "Info",
    colId: "info",
    width: 60,
    sortable: false,
    resizable: true,
    suppressMovable: true,
    cellStyle: centerCellStyle,
    cellRenderer: SongInfoCell,
  },
  {
    headerName: "Tools",
    colId: "tools",
    width: 70,
    sortable: false,
    resizable: true,
    suppressMovable: true,
    cellStyle: centerCellStyle,
    cellRenderer: SongToolsCell,
  },
  ...analyzeResultColumns.map((analyzer) => ({
    headerName: analyzer.label,
    colId: analyzer.key,
    width: 100,
    sortable: false,
    resizable: true,
    suppressMovable: true,
    cellStyle: centerCellStyle,
    valueGetter: (params: ValueGetterParams<SongInfo>): AnalyzerCellValue => {
      const song = params.data
      const requestKey = song
        ? getAnalyzeRequestKey(song.key, analyzer.key)
        : null
      const isAnalyzeRunning = props.activeAnalyzeRequestKey === requestKey
      const isAnalyzeDisabled = Boolean(props.activeAnalyzeRequestKey)

      if (!song) {
        return {
          analyzerKey: analyzer.key,
          analyzerLabel: analyzer.label,
          hasResult: false,
          loudnessWarning: undefined,
          result: undefined,
          songLabel: "Unknown song",
          songKey: "",
          isAnalyzeRunning,
          isAnalyzeDisabled,
        }
      }

      const analyzerEntry = analyzerResultsBySong.value.get(
        getAnalyzerEntryKey(song.key, song.songDirName),
      )

      return {
        analyzerKey: analyzer.key,
        analyzerLabel: analyzer.label,
        hasResult: Boolean(analyzerEntry?.results[analyzer.key]),
        loudnessWarning:
          analyzer.key === "analyzeLoudness"
            ? props.loudnessWarningsBySong[song.key]
            : undefined,
        result: analyzerEntry?.results[analyzer.key],
        songLabel: `${song.artist} - ${song.title}`,
        songKey: song.key,
        isAnalyzeRunning,
        isAnalyzeDisabled,
      }
    },
    cellRenderer: AnalyzerActionsCell,
  })),
])

const defaultColDef: ColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
}

const scrollToActiveSongInList = () => {
  scrollToGridSong({
    gridApi: gridApi.value,
    songKey: activeSong.value ? getSongKey(activeSong.value) : null,
    getRowSongKey: getSongKey,
  })
}

watch([activeAudioKey, isActiveAudioPlaying], () => {
  refreshGrid()
})

watch([searchMode, lyricsQuery], () => {
  refreshGrid()
})

watch(
  () => props.showLyricsSearch,
  (showLyricsSearch) => {
    if (!showLyricsSearch) {
      searchMode.value = "metadata"
    }
  },
  { immediate: true },
)

watch(analyzerResultsBySong, () => {
  refreshGrid()
})

watch(
  () => props.loudnessWarningsBySong,
  () => {
    refreshGrid()
  },
  { deep: true },
)

watch(
  () => props.activeAnalyzeRequestKey,
  () => {
    refreshGrid()
  },
)
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
            <slot name="header-below-title" />
          </div>
        </div>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex w-full flex-col gap-3 md:max-w-2xl">
          <div class="flex flex-wrap items-center gap-3">
            <fieldset
              v-if="showLyricsSearch"
              class="m-0 flex flex-wrap items-center gap-4 border-0 p-0 text-xs text-slate-600 dark:text-slate-300"
            >
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
              v-else-if="showLyricsSearch"
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
          v-if="pending"
          class="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Loading songs…
        </div>
        <div
          v-else-if="error"
          class="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
        >
          Failed to load songs.
        </div>
        <div v-else class="flex min-h-0 flex-1 flex-col">
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

::global(.dark .ag-theme-quartz) {
  --ag-background-color: rgb(2 6 23 / var(--tw-bg-opacity, 1));
  --ag-odd-row-background-color: rgb(2 6 23 / var(--tw-bg-opacity, 1));
  --ag-header-background-color: rgb(2 6 23 / var(--tw-bg-opacity, 1));
}
</style>
