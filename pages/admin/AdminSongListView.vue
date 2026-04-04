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
import { defineComponent, h, onMounted, onUnmounted, resolveComponent, shallowRef } from "vue"
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
import type {
  OnlineSongsDownloadResponse,
  OnlineSongsIndexResponse,
} from "~/types/onlineSongs"
import type { SongInfo } from "~~/types/song"

defineOptions({
  name: "AdminSongListView",
})

type SongFilesExistResult = {
  songKey: string
  songFound: boolean
  audioFile: boolean
  videoFile: boolean
  coverFile: boolean
}

type SongFilesExistResponse = {
  success: boolean
  indexingFinished: boolean
  count: number
  results: Record<string, SongFilesExistResult>
}

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
    adminAuthenticated?: boolean
    /** When true, do not auto-load `/api/songs` on mount (parent should call refresh after auth). */
    deferSongFetch?: boolean
    /** Must match parent `useSongs({ stateKey })` so search uses the same catalog bucket. */
    songsCatalogKey?: string
  }>(),
  {
    title: "Manage Songs",
    emptyMessage: "No songs found.",
    analyzerResults: () => [],
    activeAnalyzeRequestKey: null,
    loudnessWarningsBySong: () => ({}),
    adminAuthenticated: false,
    deferSongFetch: false,
    songsCatalogKey: undefined,
  },
)

const { songs, pending, error, refresh: refreshSongs } = useSongs({
  autoFetch: !props.deferSongFetch,
  stateKey: props.songsCatalogKey,
})
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
  metadataQuery,
  playerTime,
  progressPercent,
  sortedSongs,
  stopActiveAudio,
  toggleAudioPlayback,
} = useSongListView({
  songs: songSource,
  stateKeyPrefix: "admin-songs",
  audioStorageKey: "admin-songs",
  songsCatalogKey: props.songsCatalogKey,
})

const rowHeight = 48
const gridApi = shallowRef<GridApi | null>(null)

const selectedMissingFilesTitle = ref("")
const selectedMissingFilesContent = ref<string | null>(null)

const clearMissingFiles = () => {
  selectedMissingFilesTitle.value = ""
  selectedMissingFilesContent.value = null
}

type SongActionNotice = {
  variant: "error" | "warning"
  title: string
  message: string
}

const songActionNotice = ref<SongActionNotice | null>(null)

const showSongActionNotice = (payload: SongActionNotice) => {
  songActionNotice.value = payload
}

const clearSongActionNotice = () => {
  songActionNotice.value = null
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") {
    return
  }

  if (selectedMissingFilesContent.value) {
    event.preventDefault()
    clearMissingFiles()
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown)
})

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

const { data: songFilesExistResponse, refresh: refreshSongFilesExist } =
  useFetch<SongFilesExistResponse>("/api/admin/song-files-exist", {
    key: "admin-song-files-exist",
    immediate: false,
  })

const { data: onlineSongsIndexResponse, refresh: refreshOnlineSongsIndex } =
  useFetch<OnlineSongsIndexResponse>("/api/onlineSongsIndex", {
    key: "admin-online-songs-index",
    immediate: false,
  })

watch(
  () => props.adminAuthenticated,
  (authenticated) => {
    if (authenticated) {
      void refreshSongFilesExist()
      void refreshOnlineSongsIndex()
    }
  },
  { immediate: true },
)

const songFilesExistByKey = computed(() => {
  return songFilesExistResponse.value?.results ?? {}
})

const onlineSongKeysSet = computed(() => {
  const data = onlineSongsIndexResponse.value?.data
  if (!data) {
    return new Set<string>()
  }
  return new Set(data.map((entry) => entry.key))
})

const onlineSongPlainByKey = computed(() => {
  const data = onlineSongsIndexResponse.value?.data
  if (!data) {
    return new Map<
      string,
      { key: string; songId: string; songName: string; artist: string }
    >()
  }
  return new Map(
    data.map((entry) => [
      entry.key,
      {
        key: entry.key,
        songId: entry.songId,
        songName: entry.songName,
        artist: entry.artist,
      },
    ]),
  )
})

const reDownloadButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"

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

const getSendSongErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return undefined
  }
  const fetchError = error as {
    data?: { message?: string }
    statusMessage?: string
    message?: string
  }
  return fetchError.data?.message || fetchError.statusMessage || fetchError.message
}

const sendSongToBackend = async (song: SongInfo) => {
  try {
    await $fetch("/api/ultrastar/sendSong", {
      method: "POST",
      body: { songKey: song.key },
    })
  } catch (error) {
    const message = getSendSongErrorMessage(error)
    if (message) {
      console.error(`Failed to send song: ${message}`, error)
      return
    }
    console.error("Failed to send song", error)
  }
}

const redownloadingSongKeys = ref(new Set<string>())

const redownloadSongFromOnlineCatalog = async (song: SongInfo) => {
  const plain = onlineSongPlainByKey.value.get(song.key)
  if (!plain) {
    const message = `Missing online catalog entry for song key "${song.key}".`
    showSongActionNotice({
      variant: "error",
      title: "Redownload",
      message,
    })
    console.error("Missing online catalog entry for song", song.key)
    return
  }
  if (redownloadingSongKeys.value.has(song.key)) {
    return
  }
  redownloadingSongKeys.value = new Set([...redownloadingSongKeys.value, song.key])
  refreshGrid()
  try {
    const result = await $fetch<OnlineSongsDownloadResponse>(
      "/api/admin/redownloadSong",
      {
        method: "POST",
        body: { song: plain },
      },
    )
    void refreshSongs()
    void refreshSongFilesExist()
    void refreshOnlineSongsIndex()
    if (result.reindexError) {
      showSongActionNotice({
        variant: "warning",
        title: "Redownload finished",
        message: `Companion reindex failed:\n\n${result.reindexError}`,
      })
    }
  } catch (error) {
    const message = getSendSongErrorMessage(error)
    if (message) {
      showSongActionNotice({
        variant: "error",
        title: "Redownload failed",
        message,
      })
      console.error(`Failed to redownload song: ${message}`, error)
      return
    }
    const fallback =
      error instanceof Error ? error.message : "Something went wrong."
    showSongActionNotice({
      variant: "error",
      title: "Redownload failed",
      message: fallback,
    })
    console.error("Failed to redownload song", error)
  } finally {
    const next = new Set(redownloadingSongKeys.value)
    next.delete(song.key)
    redownloadingSongKeys.value = next
    refreshGrid()
  }
}

const reindexingSongKeys = ref(new Set<string>())

const reindexSingleSong = async (song: SongInfo) => {
  if (reindexingSongKeys.value.has(song.key)) {
    return
  }
  reindexingSongKeys.value = new Set([...reindexingSongKeys.value, song.key])
  refreshGrid()
  try {
    const result = await $fetch<OnlineSongsDownloadResponse>(
      "/api/admin/reindexSingleSongDir",
      {
        method: "POST",
        body: { songKey: song.key },
      },
    )
    void refreshSongs()
    void refreshSongFilesExist()
    void refreshOnlineSongsIndex()
    if (result.reindexError) {
      showSongActionNotice({
        variant: "warning",
        title: "Reindex finished",
        message: `Companion reindex failed:\n\n${result.reindexError}`,
      })
    }
    if (activeAudioKey.value === song.key) {
      stopActiveAudio()
    }
  } catch (error) {
    const message = getSendSongErrorMessage(error)
    if (message) {
      showSongActionNotice({
        variant: "error",
        title: "Reindex failed",
        message,
      })
      console.error(`Failed to reindex song: ${message}`, error)
      return
    }
    const fallback =
      error instanceof Error ? error.message : "Something went wrong."
    showSongActionNotice({
      variant: "error",
      title: "Reindex failed",
      message: fallback,
    })
    console.error("Failed to reindex song", error)
  } finally {
    const next = new Set(reindexingSongKeys.value)
    next.delete(song.key)
    reindexingSongKeys.value = next
    refreshGrid()
  }
}

const SendCell = defineComponent({
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
      )
    }
  },
})

const missingFilesButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"

const getMissingFilesLabels = (value: SongFilesExistResult | null) => {
  if (!value || !value.songFound) {
    return ["missing audio", "missing video", "missing cover"]
  }
  const missing: string[] = []
  if (!value.audioFile) missing.push("missing audio")
  if (!value.videoFile) missing.push("missing video")
  if (!value.coverFile) missing.push("missing cover")
  return missing
}

const buildMissingFilesDetails = (
  song: SongInfo,
  presence: SongFilesExistResult | null,
) => {
  const lines: string[] = []

  const joinSongDir = (filePath: string | null) => {
    const trimmed = filePath?.trim() ?? ""
    if (!trimmed) return `${song.songDirName}/(not set)`
    return `${song.songDirName}/${trimmed.replace(/^\/+/, "")}`
  }

  if (!presence || !presence.songFound) {
    lines.push(`audio missing: ${joinSongDir(song.audioFileName)}`)
    lines.push(`video missing: ${joinSongDir(song.videoFileName)}`)
    lines.push(`cover missing: ${joinSongDir(song.coverFileName)}`)
    return lines.join("\n")
  }

  if (!presence.audioFile) {
    lines.push(`audio missing: ${joinSongDir(song.audioFileName)}`)
  }
  if (!presence.videoFile) {
    lines.push(`video missing: ${joinSongDir(song.videoFileName)}`)
  }
  if (!presence.coverFile) {
    lines.push(`cover missing: ${joinSongDir(song.coverFileName)}`)
  }

  return lines.join("\n")
}

const FilesCell = defineComponent({
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

      const presence = songFilesExistByKey.value[song.key] ?? null
      const missing = getMissingFilesLabels(presence)
      if (missing.length === 0) {
        return null
      }

      const tooltip = missing.join("\n")
      const content = buildMissingFilesDetails(song, presence)

      return h(
        "button",
        {
          type: "button",
          class: missingFilesButtonClass,
          "aria-label": `Show missing files for ${song.artist} - ${song.title}`,
          title: tooltip,
          onClick: () => {
            selectedMissingFilesTitle.value = `${song.artist} - ${song.title}`
            selectedMissingFilesContent.value = content
          },
        },
        h(FontAwesomeIcon as any, {
          icon: "fa-solid fa-triangle-exclamation",
        }),
      )
    }
  },
})

const ReDownloadCell = defineComponent({
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
      if (!song || !onlineSongKeysSet.value.has(song.key)) {
        return null
      }

      const label = `${song.artist} - ${song.title}`
      const busy = redownloadingSongKeys.value.has(song.key)

      return h(
        "button",
        {
          type: "button",
          class: reDownloadButtonClass,
          disabled: busy,
          "aria-label": busy
            ? `Re-downloading ${label} from online catalog`
            : `Re-download ${label} from online catalog`,
          title: busy
            ? `Re-downloading ${label}…`
            : `Re-download ${label} from online catalog`,
          onClick: () => {
            if (
              !window.confirm(
                `Re-download this song from the online catalog?\n\n${label}`,
              )
            ) {
              return
            }
            void redownloadSongFromOnlineCatalog(song)
          },
        },
        busy
          ? h("span", {
              class:
                "h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300",
              "aria-hidden": "true",
            })
          : h(FontAwesomeIcon as any, {
              icon: "fa-solid fa-cloud-arrow-down",
            }),
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
              class: missingFilesButtonClass,
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

const ReindexCell = defineComponent({
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

      const busy = reindexingSongKeys.value.has(song.key)
      const label = `${song.artist} - ${song.title}`

      return h(
        "button",
        {
          type: "button",
          class: analyzerButtonClass,
          disabled: busy,
          "aria-label": busy ? `Reindexing ${label}` : `Reindex ${label} on companion`,
          title: busy ? `Reindexing ${label}…` : `Reindex ${label} on companion`,
          onClick: () => {
            if (
              !window.confirm(
                `Re-index this song on the companion?\n\n${label}`,
              )
            ) {
              return
            }
            void reindexSingleSong(song)
          },
        },
        busy
          ? h("span", {
              class:
                "h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300",
              "aria-hidden": "true",
            })
          : h(FontAwesomeIcon as any, {
              icon: "fa-solid fa-rotate",
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
    headerName: "Files",
    colId: "files",
    width: 70,
    sortable: true,
    resizable: true,
    suppressMovable: true,
    cellStyle: centerCellStyle,
    valueGetter: (params) => {
      const song = params.data
      if (!song) {
        return 0
      }
      const presence = songFilesExistByKey.value[song.key]
      if (!presence) {
        return 1
      }
      return presence.audioFile && presence.videoFile && presence.coverFile ? 0 : 1
    },
    cellRenderer: FilesCell,
  },
  {
    headerName: "Download",
    colId: "download",
    width: 100,
    sortable: false,
    resizable: true,
    suppressMovable: true,
    cellStyle: centerCellStyle,
    valueGetter: (params) => {
      const song = params.data
      if (!song) {
        return 0
      }
      return onlineSongKeysSet.value.has(song.key) ? 1 : 0
    },
    cellRenderer: ReDownloadCell,
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
    headerName: "Reindex",
    colId: "reindex",
    width: 90,
    sortable: false,
    resizable: true,
    suppressMovable: true,
    cellStyle: centerCellStyle,
    cellRenderer: ReindexCell,
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

watch(metadataQuery, () => {
  refreshGrid()
})

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

watch(songFilesExistResponse, () => {
  refreshGrid()
})

watch(onlineSongsIndexResponse, () => {
  refreshGrid()
})
</script>

<template>
  <div
    v-if="selectedMissingFilesContent"
    class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Missing files
          </div>
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {{ selectedMissingFilesTitle }}
          </div>
        </div>
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close missing files"
          @click="clearMissingFiles"
        >
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </button>
      </div>

      <textarea
        :value="selectedMissingFilesContent"
        readonly
        class="min-h-[10rem] w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      />
    </div>
  </div>

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

      <slot name="above-search" />

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex w-full flex-col gap-3 md:max-w-2xl">
          <div
            v-if="songActionNotice"
            :class="[
              'rounded-lg border p-3 shadow-sm',
              songActionNotice.variant === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
            ]"
            role="alert"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <div class="text-sm font-semibold">
                  {{ songActionNotice.title }}
                </div>
                <div class="whitespace-pre-wrap text-sm">
                  {{ songActionNotice.message }}
                </div>
              </div>
              <button
                type="button"
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-current opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                aria-label="Dismiss notice"
                @click="clearSongActionNotice"
              >
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <slot name="search-mode-actions" />
          </div>
          <div class="flex flex-col gap-2 md:flex-row">
            <label
              class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <span class="text-slate-500 dark:text-slate-400">Search</span>
              <input
                v-model="metadataQuery"
                type="search"
                placeholder="Title, artist, year, genre, language"
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
