<script setup lang="ts">
import AdminSongListView from "./AdminSongListView.vue"
import VueSelect from "vue-select"
import "vue-select/dist/vue-select.css"
import type { AdminSessionResponse } from "~/server/api/admin/session.get"
import type { LoadExistingAnalyzeResultsResponse } from "~/server/api/admin/loadExistingAnalyzeResults.post"
import type { ReindexLocalSongsResponse } from "~/server/api/admin/reindexLocalSongs.post"
import type { NormalLoudnessResponse } from "~/server/api/admin/normalLoudness.get"
import type {
  AnalyzeResultKey,
  AnalyzeResultsSongEntry,
  AnalyzeResultsResponse,
  LoudnessWarning,
  RunAnalyzeResponse,
} from "~/types/analyzeResults"
import type {
  RunChangeRelativeLoudnessRequest,
  RunMatchLoudnessTwoPassByReferenceRequest,
  RunMatchLoudnessTwoPassByTargetRequest,
  RunExecuteResponse,
} from "~/types/executeHelpers"
import type { SongInfo } from "~/types/song"

defineOptions({
  name: "ManageSongsPage",
})

definePageMeta({
  title: "Manage Songs",
})

const {
  data: adminSessionResponse,
  pending: adminSessionPending,
  refresh: refreshAdminSession,
} = await useFetch<AdminSessionResponse>("/api/admin/session", {
  key: "admin-manage-session",
})

const isAdminAuthenticated = computed(
  () => adminSessionResponse.value?.data.authenticated === true,
)

const { data: analyzerResultsResponse, refresh: refreshAnalyzerResults } =
  await useFetch<AnalyzeResultsResponse>("/api/admin/analyzers", {
    key: "admin-manage-analyzers",
    immediate: false,
  })

const { data: normalLoudnessResponse, refresh: refreshNormalLoudness } =
  await useFetch<NormalLoudnessResponse>("/api/admin/normalLoudness", {
    key: "admin-manage-normal-loudness",
    immediate: false,
  })

const adminSongsCatalogKey = "admin-manage"

const { songs, refresh: refreshSongs } = useSongs({
  autoFetch: false,
  stateKey: adminSongsCatalogKey,
})

watch(
  isAdminAuthenticated,
  (authenticated) => {
    if (authenticated) {
      void refreshAnalyzerResults()
      void refreshNormalLoudness()
      void refreshSongs()
    }
  },
  { immediate: true },
)

const analyzerResults = ref<AnalyzeResultsSongEntry[]>(
  analyzerResultsResponse.value?.data ?? [],
)

watch(
  () => analyzerResultsResponse.value?.data,
  (data) => {
    if (data) {
      analyzerResults.value = data
    }
  },
  { immediate: true },
)

const adminPassword = ref("")
const adminLoginError = ref("")
const isAdminLoginSubmitting = ref(false)

const showAdminLoginModal = computed(
  () => adminSessionPending.value || !isAdminAuthenticated.value,
)

const activeAnalyzeRequestKey = ref<string | null>(null)
const analyzerActionError = ref<string | null>(null)
const isLoadExistingAnalyzeResultsRunning = ref(false)
const isReindexLocalSongsRunning = ref(false)
const isLoudnessToolsExpanded = ref(false)
const loudnessTolerance = ref(5)
const loudnessWarningsBySong = ref<Record<string, LoudnessWarning>>({})
const loudnessWarningCount = ref<number | null>(null)

const selectedAnalyzerResultTitle = ref("")
const selectedAnalyzerResultContent = ref<string | null>(null)
const selectedSongInfoTitle = ref("")
const selectedSongInfoContent = ref<string | null>(null)
const selectedSongTools = ref<{ songKey: string; title: string } | null>(null)
const selectedLoudnessWarning = ref<LoudnessWarning | null>(null)
const changeRelativeLoudnessDbChange = ref(0)
const isChangeRelativeLoudnessRunning = ref(false)
const matchLoudnessTwoPassTargetLufsI = ref(0)
const isMatchLoudnessTwoPassRunning = ref(false)
const selectedReferenceSongKey = ref<string | null>(null)
const isMatchLoudnessTwoPassByReferenceRunning = ref(false)
const toolsActionError = ref<string | null>(null)

const normalLoudness = computed(() => normalLoudnessResponse.value?.data ?? null)
const targetLoudness = computed(() => normalLoudness.value)
const songsByKey = computed(() => {
  return new Map((songs.value ?? []).map((song) => [song.key, song]))
})

const getSongAnalysis = (songKey: string) => {
  return analyzerResults.value.find((entry) => entry.songKey === songKey)?.results.analyzeLoudness
}

const getSongLoudnessGuidance = (songKey: string) => {
  const loudnessResult = getSongAnalysis(songKey)
  if (!loudnessResult) {
    return null
  }

  const measuredLoudness = Number.parseFloat(loudnessResult.input_i)
  if (Number.isNaN(measuredLoudness) || targetLoudness.value === null) {
    return null
  }

  return {
    measuredLoudness,
    recommendedDbChange: targetLoudness.value - measuredLoudness,
    targetLoudness: targetLoudness.value,
  }
}

const selectedSongLoudnessGuidance = computed(() => {
  if (!selectedSongTools.value) {
    return null
  }

  return getSongLoudnessGuidance(selectedSongTools.value.songKey)
})

const selectedSongAnalysis = computed(() => {
  if (!selectedSongTools.value) {
    return null
  }

  return getSongAnalysis(selectedSongTools.value.songKey) ?? null
})

type ReferenceSongOption = {
  songKey: string
  label: string
  analysis: NonNullable<AnalyzeResultsSongEntry["results"]["analyzeLoudness"]>
}

const referenceSongOptions = computed<ReferenceSongOption[]>(() => {
  return analyzerResults.value.flatMap((entry) => {
    const analysis = entry.results.analyzeLoudness
    if (!analysis) {
      return []
    }

    const song = songsByKey.value.get(entry.songKey)
    const measuredLoudness = Number.parseFloat(analysis.input_i)
    const loudnessLabel = Number.isNaN(measuredLoudness)
      ? analysis.input_i
      : measuredLoudness.toFixed(2)
    const songLabel = song
      ? `${song.title} - ${song.artist}`
      : entry.songKey

    return [{
      songKey: entry.songKey,
      label: `${songLabel} (${loudnessLabel} LUFS)`,
      analysis,
    }]
  })
})

const selectedReferenceSongOption = computed(() => {
  if (!selectedReferenceSongKey.value) {
    return null
  }

  return referenceSongOptions.value.find((option) => option.songKey === selectedReferenceSongKey.value) ?? null
})

const getReferenceSongOptionKey = (option: ReferenceSongOption) => option.songKey

const formatSignedNumber = (value: number, digits = 1) => {
  const roundedValue = value.toFixed(digits)
  return value > 0 ? `+${roundedValue}` : roundedValue
}

const showAnalyzerResult = (payload: { title: string; content: string }) => {
  selectedAnalyzerResultTitle.value = payload.title
  selectedAnalyzerResultContent.value = payload.content
}

const showSongInfo = (payload: { title: string; content: string }) => {
  selectedSongInfoTitle.value = payload.title
  selectedSongInfoContent.value = payload.content
}

const showSongTools = (payload: { songKey: string; title: string }) => {
  selectedSongTools.value = payload
  changeRelativeLoudnessDbChange.value = Number(
    getSongLoudnessGuidance(payload.songKey)?.recommendedDbChange.toFixed(1) ?? "0",
  )
  matchLoudnessTwoPassTargetLufsI.value = targetLoudness.value ?? 0
  selectedReferenceSongKey.value = null
  toolsActionError.value = null
}

const showLoudnessWarning = (warning: LoudnessWarning) => {
  selectedLoudnessWarning.value = warning
}

const clearAnalyzerResult = () => {
  selectedAnalyzerResultTitle.value = ""
  selectedAnalyzerResultContent.value = null
}

const clearSongInfo = () => {
  selectedSongInfoTitle.value = ""
  selectedSongInfoContent.value = null
}

const clearSongTools = () => {
  selectedSongTools.value = null
  changeRelativeLoudnessDbChange.value = 0
  isChangeRelativeLoudnessRunning.value = false
  matchLoudnessTwoPassTargetLufsI.value = 0
  isMatchLoudnessTwoPassRunning.value = false
  selectedReferenceSongKey.value = null
  isMatchLoudnessTwoPassByReferenceRunning.value = false
  toolsActionError.value = null
}

const clearLoudnessWarning = () => {
  selectedLoudnessWarning.value = null
}

const getAnalyzeRequestKey = (songKey: string, analyzerKey: AnalyzeResultKey) =>
  `${songKey}::${analyzerKey}`

const getFetchErrorMessage = (error: unknown, fallback = "Failed to fetch data") => {
  if (!error || typeof error !== "object") {
    return fallback
  }

  const fetchError = error as {
    data?: { message?: string }
    statusMessage?: string
    message?: string
  }

  return (
    fetchError.data?.message ||
    fetchError.statusMessage ||
    fetchError.message ||
    fallback
  )
}

const CURRENT_SONG_POLL_INTERVAL_MS = 5000

type UltraStarCurrentSongResponse = {
  playing: boolean
  song: SongInfo | null
}

const isUltraStarCurrentSongExpanded = ref(false)
const ultraStarCurrentSongPending = ref(false)
const ultraStarCurrentSongTitle = ref<string | null>(null)
const ultraStarCurrentSongArtist = ref<string | null>(null)
const ultraStarCurrentSongError = ref<string | null>(null)

let ultraStarCurrentSongIntervalId: ReturnType<typeof setInterval> | null = null

const refreshUltraStarCurrentSong = async () => {
  if (!isUltraStarCurrentSongExpanded.value) {
    return
  }

  ultraStarCurrentSongPending.value = true
  ultraStarCurrentSongError.value = null
  try {
    const data = await $fetch<UltraStarCurrentSongResponse>("/api/ultrastar/getCurrentSong")
    ultraStarCurrentSongTitle.value = data.song?.title ?? null
    ultraStarCurrentSongArtist.value = data.song?.artist ?? null
  } catch (error: unknown) {
    ultraStarCurrentSongTitle.value = null
    ultraStarCurrentSongArtist.value = null
    ultraStarCurrentSongError.value = getFetchErrorMessage(error, "Could not load current song")
  } finally {
    ultraStarCurrentSongPending.value = false
  }
}

watch(isUltraStarCurrentSongExpanded, (expanded) => {
  if (ultraStarCurrentSongIntervalId !== null) {
    clearInterval(ultraStarCurrentSongIntervalId)
    ultraStarCurrentSongIntervalId = null
  }

  if (!expanded) {
    ultraStarCurrentSongPending.value = false
    ultraStarCurrentSongTitle.value = null
    ultraStarCurrentSongArtist.value = null
    ultraStarCurrentSongError.value = null
    return
  }

  void refreshUltraStarCurrentSong()
  ultraStarCurrentSongIntervalId = setInterval(() => {
    void refreshUltraStarCurrentSong()
  }, CURRENT_SONG_POLL_INTERVAL_MS)
}, { immediate: true })

onUnmounted(() => {
  if (ultraStarCurrentSongIntervalId !== null) {
    clearInterval(ultraStarCurrentSongIntervalId)
  }
})

const isUltraStarControlsExpanded = ref(false)
const ultraStarControlsError = ref<string | null>(null)
const isStartSelectedUltraStarSongRunning = ref(false)
const isCloseUltraStarScoreScreenRunning = ref(false)
const isCancelUltraStarCurrentSongRunning = ref(false)
const isTogglePauseUltraStarCurrentSongRunning = ref(false)

const startSelectedUltraStarSong = async () => {
  ultraStarControlsError.value = null
  isStartSelectedUltraStarSongRunning.value = true
  try {
    await $fetch("/api/admin/ultrastar/startSelectedSong", {
      method: "POST",
    })
  } catch (error: unknown) {
    ultraStarControlsError.value = getFetchErrorMessage(error, "Could not start selected song")
  } finally {
    isStartSelectedUltraStarSongRunning.value = false
  }
}

const closeUltraStarScoreScreen = async () => {
  ultraStarControlsError.value = null
  isCloseUltraStarScoreScreenRunning.value = true
  try {
    await $fetch("/api/admin/ultrastar/closeScoreScreen", {
      method: "POST",
    })
  } catch (error: unknown) {
    ultraStarControlsError.value = getFetchErrorMessage(error, "Could not close score screen")
  } finally {
    isCloseUltraStarScoreScreenRunning.value = false
  }
}

const cancelUltraStarCurrentSong = async () => {
  const cancelMessage =
    ultraStarCurrentSongTitle.value && ultraStarCurrentSongArtist.value
      ? `Cancel the current song (“${ultraStarCurrentSongTitle.value}” · ${ultraStarCurrentSongArtist.value})?`
      : "Cancel the current song in UltraStar?"

  if (!window.confirm(cancelMessage)) {
    return
  }

  ultraStarControlsError.value = null
  isCancelUltraStarCurrentSongRunning.value = true
  try {
    await $fetch("/api/admin/ultrastar/cancelCurrentSong", {
      method: "POST",
    })
  } catch (error: unknown) {
    ultraStarControlsError.value = getFetchErrorMessage(error, "Could not cancel current song")
  } finally {
    isCancelUltraStarCurrentSongRunning.value = false
  }
}

const togglePauseUltraStarCurrentSong = async () => {
  ultraStarControlsError.value = null
  isTogglePauseUltraStarCurrentSongRunning.value = true
  try {
    await $fetch("/api/admin/ultrastar/togglePauseCurrentSong", {
      method: "POST",
    })
  } catch (error: unknown) {
    ultraStarControlsError.value = getFetchErrorMessage(error, "Could not toggle pause current song")
  } finally {
    isTogglePauseUltraStarCurrentSongRunning.value = false
  }
}

const submitAdminLogin = async () => {
  adminLoginError.value = ""
  isAdminLoginSubmitting.value = true

  try {
    await $fetch<AdminSessionResponse>("/api/admin/login", {
      method: "POST",
      body: { password: adminPassword.value },
    })
    adminPassword.value = ""
    await refreshAdminSession()
  } catch (error) {
    adminLoginError.value = getFetchErrorMessage(error)
  } finally {
    isAdminLoginSubmitting.value = false
  }
}

const logoutAsAdmin = async () => {
  try {
    await $fetch("/api/admin/logout", { method: "POST" })
  } catch (error) {
    analyzerActionError.value = getFetchErrorMessage(error)
    return
  }

  adminLoginError.value = ""
  await clearNuxtData("admin-manage-analyzers")
  await clearNuxtData("admin-manage-normal-loudness")
  await clearNuxtData("admin-song-files-exist")
  await refreshAdminSession()
  analyzerResults.value = []
}

const upsertAnalyzerResult = (entry: AnalyzeResultsSongEntry) => {
  const existingIndex = analyzerResults.value.findIndex(
    (currentEntry) =>
      currentEntry.songKey === entry.songKey &&
      currentEntry.songDirName === entry.songDirName,
  )

  if (existingIndex === -1) {
    analyzerResults.value.push(entry)
    return
  }

  analyzerResults.value[existingIndex] = entry
}

const compareLoudnessAgainstTarget = () => {
  if (targetLoudness.value === null) {
    return
  }

  const tolerance = Number.isFinite(loudnessTolerance.value) && loudnessTolerance.value >= 0
    ? loudnessTolerance.value
    : 0

  const warnings: Record<string, LoudnessWarning> = {}

  for (const entry of analyzerResults.value) {
    const loudnessResult = entry.results.analyzeLoudness
    if (!loudnessResult) {
      continue
    }

    const measuredLoudness = Number.parseFloat(loudnessResult.input_i)
    if (Number.isNaN(measuredLoudness)) {
      continue
    }

    const difference = measuredLoudness - targetLoudness.value
    const absoluteDifference = Math.abs(difference)
    if (absoluteDifference <= tolerance) {
      continue
    }

    warnings[entry.songKey] = {
      songKey: entry.songKey,
      songLabel: entry.songKey,
      measuredLoudness,
      targetLoudness: targetLoudness.value,
      difference,
      absoluteDifference,
      status: difference > 0 ? "too loud" : "too quiet",
    }
  }

  loudnessWarningsBySong.value = warnings
  loudnessWarningCount.value = Object.keys(warnings).length
  loudnessTolerance.value = tolerance
}

const runAnalyzer = async (payload: {
  songKey: string
  analyzerKey: AnalyzeResultKey
}) => {
  analyzerActionError.value = null
  activeAnalyzeRequestKey.value = getAnalyzeRequestKey(
    payload.songKey,
    payload.analyzerKey,
  )

  try {
    const response = await $fetch<RunAnalyzeResponse>("/api/admin/analyze", {
      method: "POST",
      body: payload,
    })

    upsertAnalyzerResult(response.data)
    if (loudnessWarningCount.value !== null) {
      compareLoudnessAgainstTarget()
    }
  } catch (error) {
    analyzerActionError.value = getFetchErrorMessage(error)
  } finally {
    activeAnalyzeRequestKey.value = null
  }
}

const loadExistingAnalyzeResults = async () => {
  if (isLoadExistingAnalyzeResultsRunning.value || isReindexLocalSongsRunning.value) {
    return
  }

  if (!window.confirm("Load existing analyzer results from disk now?")) {
    return
  }

  analyzerActionError.value = null
  isLoadExistingAnalyzeResultsRunning.value = true

  try {
    await $fetch<LoadExistingAnalyzeResultsResponse>("/api/admin/loadExistingAnalyzeResults", {
      method: "POST",
    })
    await refreshAnalyzerResults()
    analyzerResults.value = analyzerResultsResponse.value?.data ?? []
    if (loudnessWarningCount.value !== null) {
      compareLoudnessAgainstTarget()
    }
  } catch (error) {
    analyzerActionError.value = getFetchErrorMessage(error)
  } finally {
    isLoadExistingAnalyzeResultsRunning.value = false
  }
}

const reindexAllLocalSongs = async () => {
  if (isReindexLocalSongsRunning.value || isLoadExistingAnalyzeResultsRunning.value) {
    return
  }

  if (
    !window.confirm(
      "Re-scan all UltraStar song folders on the server? This may take a long time. The current song list stays in use until the scan completes.",
    )
  ) {
    return
  }

  analyzerActionError.value = null
  isReindexLocalSongsRunning.value = true

  try {
    const response = await $fetch<ReindexLocalSongsResponse>("/api/admin/reindexLocalSongs", {
      method: "POST",
    })
    if (!response.success) {
      throw new Error( "Failed to reindex local songs")
    }
    await refreshSongs()
    await refreshAnalyzerResults()
    analyzerResults.value = analyzerResultsResponse.value?.data ?? []
    if (loudnessWarningCount.value !== null) {
      compareLoudnessAgainstTarget()
    }
  } catch (error) {
    analyzerActionError.value = getFetchErrorMessage(error)
  } finally {
    isReindexLocalSongsRunning.value = false
  }
}

const runChangeRelativeLoudness = async () => {
  if (!selectedSongTools.value || isChangeRelativeLoudnessRunning.value) {
    return
  }

  toolsActionError.value = null
  isChangeRelativeLoudnessRunning.value = true

  try {
    const payload: RunChangeRelativeLoudnessRequest = {
      songKey: selectedSongTools.value.songKey,
      params: {
        dbChange: changeRelativeLoudnessDbChange.value,
      },
    }

    await $fetch<RunExecuteResponse>("/api/admin/execute/changeRelativeLoudness", {
      method: "POST",
      body: payload,
    })
  } catch (error) {
    toolsActionError.value = getFetchErrorMessage(error)
  } finally {
    isChangeRelativeLoudnessRunning.value = false
  }
}

const runMatchLoudnessTwoPassByTarget = async () => {
  if (!selectedSongTools.value || isMatchLoudnessTwoPassRunning.value) {
    return
  }

  toolsActionError.value = null
  isMatchLoudnessTwoPassRunning.value = true

  try {
    const payload: RunMatchLoudnessTwoPassByTargetRequest = {
      songKey: selectedSongTools.value.songKey,
      params: {
        targetLufsI: matchLoudnessTwoPassTargetLufsI.value,
      },
    }

    await $fetch<RunExecuteResponse>("/api/admin/execute/matchLoudnessTwoPassByTarget", {
      method: "POST",
      body: payload,
    })
  } catch (error) {
    toolsActionError.value = getFetchErrorMessage(error)
  } finally {
    isMatchLoudnessTwoPassRunning.value = false
  }
}

const runMatchLoudnessTwoPassByReference = async () => {
  if (
    !selectedSongTools.value ||
    !selectedSongAnalysis.value ||
    !selectedReferenceSongOption.value ||
    isMatchLoudnessTwoPassByReferenceRunning.value
  ) {
    return
  }

  toolsActionError.value = null
  isMatchLoudnessTwoPassByReferenceRunning.value = true

  try {
    const payload: RunMatchLoudnessTwoPassByReferenceRequest = {
      songKey: selectedSongTools.value.songKey,
      params: {
        referenceAnalysis: selectedReferenceSongOption.value.analysis,
      },
    }

    await $fetch<RunExecuteResponse>("/api/admin/execute/matchLoudnessTwoPassByReference", {
      method: "POST",
      body: payload,
    })
  } catch (error) {
    toolsActionError.value = getFetchErrorMessage(error)
  } finally {
    isMatchLoudnessTwoPassByReferenceRunning.value = false
  }
}
</script>

<template>
  <div>
    <div
      v-if="showAdminLoginModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <div
        class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <h2
          id="admin-login-title"
          class="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Admin sign-in
        </h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Enter the site admin password to use this page.
        </p>

        <div
          v-if="adminSessionPending"
          class="mt-4 text-sm text-slate-600 dark:text-slate-300"
        >
          Checking session…
        </div>

        <button
          v-if="adminSessionPending"
          type="button"
          class="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="void navigateTo('/')"
        >
          Back to home
        </button>

        <form
          v-else
          class="mt-4 space-y-3"
          @submit.prevent="submitAdminLogin"
        >
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Password
            <input
              v-model="adminPassword"
              type="password"
              autocomplete="current-password"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-500"
            />
          </label>

          <p
            v-if="adminLoginError"
            class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
          >
            {{ adminLoginError }}
          </p>

          <button
            type="submit"
            class="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            :disabled="isAdminLoginSubmitting"
          >
            {{ isAdminLoginSubmitting ? "Signing in…" : "Sign in" }}
          </button>

          <button
            type="button"
            class="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="void navigateTo('/')"
          >
            Back to home
          </button>
        </form>
      </div>
    </div>

    <div
      v-if="analyzerActionError"
      class="mx-auto mt-4 max-w-5xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
    >
      {{ analyzerActionError }}
    </div>

    <div
      v-if="selectedAnalyzerResultContent"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Analyzer result
            </div>
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ selectedAnalyzerResultTitle }}
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close analyzer result"
            @click="clearAnalyzerResult"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <textarea
          :value="selectedAnalyzerResultContent"
          readonly
          class="min-h-[20rem] w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
      </div>
    </div>

    <div
      v-if="selectedSongInfoContent"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Song info
            </div>
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ selectedSongInfoTitle }}
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close song info"
            @click="clearSongInfo"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <textarea
          :value="selectedSongInfoContent"
          readonly
          class="min-h-[20rem] w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
      </div>
    </div>

    <div
      v-if="selectedLoudnessWarning"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Loudness warning
            </div>
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ selectedLoudnessWarning.songLabel }}
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close loudness warning"
            @click="clearLoudnessWarning"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <div class="space-y-3">
          <p class="text-sm text-slate-700 dark:text-slate-200">
            This song is
            <span class="font-semibold">{{ selectedLoudnessWarning.status }}</span>
            by
            <span class="font-semibold">
              {{ selectedLoudnessWarning.absoluteDifference.toFixed(2) }} LUFS
            </span>
            compared with the target loudness.
          </p>
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Measured
              </dt>
              <dd class="mt-1 font-mono text-slate-900 dark:text-slate-100">
                {{ selectedLoudnessWarning.measuredLoudness.toFixed(2) }} LUFS
              </dd>
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Target
              </dt>
              <dd class="mt-1 font-mono text-slate-900 dark:text-slate-100">
                {{ selectedLoudnessWarning.targetLoudness.toFixed(2) }} LUFS
              </dd>
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Difference
              </dt>
              <dd class="mt-1 font-mono text-slate-900 dark:text-slate-100">
                {{ selectedLoudnessWarning.difference > 0 ? "+" : "" }}{{ selectedLoudnessWarning.difference.toFixed(2) }}
                LUFS
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <div
      v-if="selectedSongTools"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="flex max-h-[calc(100vh-1rem)] w-full max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tools
            </div>
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ selectedSongTools.title }}
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close song tools"
            @click="clearSongTools"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <div class="space-y-4">
          <section class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div class="mb-3">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Change relative loudness
              </h2>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Apply a dB change directly to this song's audio file. Example:
                `+3` is louder, `-3` is quieter.
              </p>
              <p
                v-if="selectedSongLoudnessGuidance"
                class="mt-2 text-xs text-slate-600 dark:text-slate-300"
              >
                Measured loudness:
                <span class="font-medium">
                  {{ selectedSongLoudnessGuidance.measuredLoudness.toFixed(2) }} LUFS
                </span>
                . To reach the reference loudness of
                <span class="font-medium">
                  {{ selectedSongLoudnessGuidance.targetLoudness.toFixed(2) }} LUFS
                </span>
                , start with
                <span class="font-semibold">
                  {{ formatSignedNumber(selectedSongLoudnessGuidance.recommendedDbChange) }} dB
                </span>
                in the field below.
              </p>
              <p
                v-else
                class="mt-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Run the loudness analyzer for this song to get a suggested dB value.
              </p>
            </div>

            <div class="flex flex-col gap-3 md:flex-row md:items-end">
              <label
                class="flex w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  dB change
                </span>
                <input
                  v-model.number="changeRelativeLoudnessDbChange"
                  type="number"
                  step="0.1"
                  class="w-full border-none bg-transparent text-right text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>

              <button
                type="button"
                class="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                :disabled="isChangeRelativeLoudnessRunning"
                @click="runChangeRelativeLoudness"
              >
                <span
                  v-if="isChangeRelativeLoudnessRunning"
                  class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
                  aria-hidden="true"
                />
                <span>
                  {{ isChangeRelativeLoudnessRunning ? "Sending" : "Send" }}
                </span>
              </button>
            </div>

            <p
              v-if="toolsActionError"
              class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
            >
              {{ toolsActionError }}
            </p>
          </section>

          <section class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div class="mb-3">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Match loudness by target LUFS
              </h2>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Run the two-pass loudness matcher with an explicit integrated loudness target.
                This requires an existing loudness analysis for the song.
              </p>
              <p
                v-if="selectedSongLoudnessGuidance"
                class="mt-2 text-xs text-slate-600 dark:text-slate-300"
              >
                Measured loudness:
                <span class="font-medium">
                  {{ selectedSongLoudnessGuidance.measuredLoudness.toFixed(2) }} LUFS
                </span>
                . The default reference target (good loudness) is
                <span class="font-medium">
                  {{ selectedSongLoudnessGuidance.targetLoudness.toFixed(2) }} LUFS
                </span>
                .
              </p>
              <p
                v-else
                class="mt-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Run the loudness analyzer for this song before using this tool.
              </p>
            </div>

            <div class="flex flex-col gap-3 md:flex-row md:items-end">
              <label
                class="flex w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  Target LUFS
                </span>
                <input
                  v-model.number="matchLoudnessTwoPassTargetLufsI"
                  type="number"
                  step="0.1"
                  class="w-full border-none bg-transparent text-right text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>

              <button
                type="button"
                class="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                :disabled="!selectedSongLoudnessGuidance || isMatchLoudnessTwoPassRunning"
                @click="runMatchLoudnessTwoPassByTarget"
              >
                <span
                  v-if="isMatchLoudnessTwoPassRunning"
                  class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
                  aria-hidden="true"
                />
                <span>
                  {{ isMatchLoudnessTwoPassRunning ? "Sending" : "Send" }}
                </span>
              </button>
            </div>

            <p
              v-if="toolsActionError"
              class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
            >
              {{ toolsActionError }}
            </p>
          </section>

          <section class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div class="mb-3">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Match loudness by reference song
              </h2>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Run the two-pass loudness matcher using the loudness analysis from another song as the reference.
                Only songs with loudness analysis are available in the dropdown.
              </p>
              <p
                v-if="selectedSongAnalysis"
                class="mt-2 text-xs text-slate-600 dark:text-slate-300"
              >
                Measured loudness:
                <span class="font-medium">
                  {{ Number.parseFloat(selectedSongAnalysis.input_i).toFixed(2) }} LUFS
                </span>
                .
                <template v-if="selectedReferenceSongOption">
                  Reference:
                  <span class="font-medium">
                    {{ selectedReferenceSongOption.label }}
                  </span>
                  .
                </template>
              </p>
              <p
                v-else
                class="mt-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Run the loudness analyzer for this song before using this tool.
              </p>
            </div>

            <div class="flex flex-col gap-3 md:flex-row md:items-end">
              <label
                class="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <span class="text-slate-500 dark:text-slate-400">
                  Reference song
                </span>
                <VueSelect
                  v-model="selectedReferenceSongKey"
                  :options="referenceSongOptions"
                  :reduce="getReferenceSongOptionKey"
                  :appendToBody="true"
                  label="label"
                  placeholder="Select a reference song"
                  class="reference-song-select"
                />
              </label>

              <button
                type="button"
                class="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                :disabled="!selectedSongAnalysis || !selectedReferenceSongOption || isMatchLoudnessTwoPassByReferenceRunning"
                @click="runMatchLoudnessTwoPassByReference"
              >
                <span
                  v-if="isMatchLoudnessTwoPassByReferenceRunning"
                  class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
                  aria-hidden="true"
                />
                <span>
                  {{ isMatchLoudnessTwoPassByReferenceRunning ? "Sending" : "Send" }}
                </span>
              </button>
            </div>

            <p
              v-if="toolsActionError"
              class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
            >
              {{ toolsActionError }}
            </p>
          </section>
        </div>
      </div>
    </div>

    <AdminSongListView
      :songs-catalog-key="adminSongsCatalogKey"
      :defer-song-fetch="adminSessionPending || !isAdminAuthenticated"
      :admin-authenticated="isAdminAuthenticated"
      :analyzerResults="analyzerResults"
      :activeAnalyzeRequestKey="activeAnalyzeRequestKey"
      :loudnessWarningsBySong="loudnessWarningsBySong"
      @show-analyzer-result="showAnalyzerResult"
      @show-loudness-warning="showLoudnessWarning"
      @show-song-info="showSongInfo"
      @show-song-tools="showSongTools"
      @run-analyzer="runAnalyzer"
    >
      <template #header-below-title>
        <details
          class="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm md:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <summary class="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
            About loudness stats and tools
          </summary>
          <p class="mt-2">
            Loudness stats are always calculated from the original audio files.
            the tools only work with the original audio files.
          </p>
        </details>
      </template>
      <template #header-actions>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            :disabled="isReindexLocalSongsRunning || isLoadExistingAnalyzeResultsRunning"
            @click="reindexAllLocalSongs"
          >
            <span
              v-if="isReindexLocalSongsRunning"
              class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
              aria-hidden="true"
            />
            <span>
              {{ isReindexLocalSongsRunning ? "Reindexing local songs" : "Reindex all local songs (not in usdx) and analyzer results" }}
            </span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            :disabled="isLoadExistingAnalyzeResultsRunning || isReindexLocalSongsRunning"
            @click="loadExistingAnalyzeResults"
          >
            <span
              v-if="isLoadExistingAnalyzeResultsRunning"
              class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
              aria-hidden="true"
            />
            <span>
              {{ isLoadExistingAnalyzeResultsRunning ? "Loading analyzer results" : "Reload analyzer results" }}
            </span>
          </button>
          <button
            v-if="isAdminAuthenticated && !adminSessionPending"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="logoutAsAdmin"
          >
            Logout as admin
          </button>
        </div>
      </template>
      <template #above-search>
        <div
          class="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <div class="flex flex-col gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
            <button
              type="button"
              class="inline-flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-left font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100"
              :aria-expanded="isUltraStarCurrentSongExpanded"
              @click="isUltraStarCurrentSongExpanded = !isUltraStarCurrentSongExpanded"
            >
              <span>Current UltraStar song</span>
              <font-awesome-icon
                :icon="isUltraStarCurrentSongExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                class="text-slate-400 dark:text-slate-500"
              />
            </button>

            <div v-if="isUltraStarCurrentSongExpanded" class="flex flex-col gap-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Updates every {{ CURRENT_SONG_POLL_INTERVAL_MS / 1000 }} seconds while this section is open.
              </p>
              <p
                v-if="ultraStarCurrentSongPending"
                class="text-xs text-slate-500 dark:text-slate-400"
              >
                Loading…
              </p>
              <p
                v-else-if="ultraStarCurrentSongError"
                class="text-xs text-red-600 dark:text-red-400"
              >
                {{ ultraStarCurrentSongError }}
              </p>
              <p
                v-else-if="ultraStarCurrentSongTitle && ultraStarCurrentSongArtist"
                class="text-sm text-slate-800 dark:text-slate-100"
              >
                <span class="font-medium">{{ ultraStarCurrentSongTitle }}</span>
                <span class="text-slate-500 dark:text-slate-400"> · {{ ultraStarCurrentSongArtist }}</span>
              </p>
              <p
                v-else
                class="text-xs text-slate-500 dark:text-slate-400"
              >
                Nothing playing
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
            <button
              type="button"
              class="inline-flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-left font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100"
              :aria-expanded="isUltraStarControlsExpanded"
              @click="isUltraStarControlsExpanded = !isUltraStarControlsExpanded"
            >
              <span>Controls</span>
              <font-awesome-icon
                :icon="isUltraStarControlsExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                class="text-slate-400 dark:text-slate-500"
              />
            </button>

            <div v-if="isUltraStarControlsExpanded" class="flex flex-col gap-2">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Song selection for start happens in UltraStar. These actions call the companion app on the server.
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  :disabled="
                    adminSessionPending
                    || !isAdminAuthenticated
                    || isStartSelectedUltraStarSongRunning
                    || isCloseUltraStarScoreScreenRunning
                    || isCancelUltraStarCurrentSongRunning
                    || isTogglePauseUltraStarCurrentSongRunning
                  "
                  @click="startSelectedUltraStarSong"
                >
                  <span
                    v-if="isStartSelectedUltraStarSongRunning"
                    class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
                    aria-hidden="true"
                  />
                  <font-awesome-icon
                    v-else
                    icon="fa-solid fa-play"
                    class="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300"
                    aria-hidden="true"
                  />
                  <span>{{ isStartSelectedUltraStarSongRunning ? "Starting…" : "Start selected song" }}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  :disabled="
                    adminSessionPending
                    || !isAdminAuthenticated
                    || isStartSelectedUltraStarSongRunning
                    || isCloseUltraStarScoreScreenRunning
                    || isCancelUltraStarCurrentSongRunning
                    || isTogglePauseUltraStarCurrentSongRunning
                  "
                  @click="closeUltraStarScoreScreen"
                >
                  <span
                    v-if="isCloseUltraStarScoreScreenRunning"
                    class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
                    aria-hidden="true"
                  />
                  <font-awesome-layers>
                    <font-awesome-icon icon="fa-solid fa-chart-simple" class="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                    <font-awesome-icon icon="fa-solid fa-slash" class="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                  </font-awesome-layers>
                  <span>{{ isCloseUltraStarScoreScreenRunning ? "Closing…" : "Close score screen" }}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  :disabled="
                    adminSessionPending
                    || !isAdminAuthenticated
                    || isStartSelectedUltraStarSongRunning
                    || isCloseUltraStarScoreScreenRunning
                    || isCancelUltraStarCurrentSongRunning
                    || isTogglePauseUltraStarCurrentSongRunning
                  "
                  @click="togglePauseUltraStarCurrentSong"
                >
                  <span
                    v-if="isTogglePauseUltraStarCurrentSongRunning"
                    class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
                    aria-hidden="true"
                  />
                  <font-awesome-icon
                    v-else
                    icon="fa-solid fa-pause"
                    class="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300"
                    aria-hidden="true"
                  />
                  <span>{{ isTogglePauseUltraStarCurrentSongRunning ? "Toggling pause…" : "Toggle pause current song" }}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  :disabled="
                    adminSessionPending
                    || !isAdminAuthenticated
                    || isStartSelectedUltraStarSongRunning
                    || isCloseUltraStarScoreScreenRunning
                    || isCancelUltraStarCurrentSongRunning
                    || isTogglePauseUltraStarCurrentSongRunning
                  "
                  @click="cancelUltraStarCurrentSong"
                >
                  <span
                    v-if="isCancelUltraStarCurrentSongRunning"
                    class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300"
                    aria-hidden="true"
                  />
                  <font-awesome-icon
                    v-else
                    icon="fa-solid fa-ban"
                    class="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300"
                    aria-hidden="true"
                  />
                  <span>{{ isCancelUltraStarCurrentSongRunning ? "Cancelling…" : "Cancel current song" }}</span>
                </button>

              </div>
              <p
                v-if="ultraStarControlsError"
                class="text-xs text-red-600 dark:text-red-400"
              >
                {{ ultraStarControlsError }}
              </p>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-left font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100"
            :aria-expanded="isLoudnessToolsExpanded"
            @click="isLoudnessToolsExpanded = !isLoudnessToolsExpanded"
          >
            <span>Loudness tolerance</span>
            <font-awesome-icon
              :icon="isLoudnessToolsExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
              class="text-slate-400 dark:text-slate-500"
            />
          </button>

          <div v-if="isLoudnessToolsExpanded" class="flex flex-col gap-2">
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Compare each song’s measured loudness to the target loudness and flag songs that differ by more than this tolerance.
              Higher tolerance shows fewer warnings.
            </p>
            <div class="flex flex-wrap items-center justify-start gap-2">
              <label
                class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <span class="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  Tolerance (LUFS)
                </span>
                <input
                  v-model.number="loudnessTolerance"
                  type="number"
                  step="0.1"
                  min="0"
                  class="w-20 border-none bg-transparent text-right text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                :disabled="targetLoudness === null"
                @click="compareLoudnessAgainstTarget"
              >
                Compare to {{ targetLoudness === null ? "target" : `${targetLoudness} LUFS` }}
              </button>
            </div>
            <p
              v-if="loudnessWarningCount !== null"
              class="text-xs text-slate-500 dark:text-slate-400"
            >
              {{ loudnessWarningCount }} songs exceed the current tolerance
            </p>
          </div>
        </div>
      </template>
    </AdminSongListView>
  </div>
</template>

<style>
.reference-song-select {
  --vs-controls-color: rgb(100 116 139);
  --vs-border-color: transparent;
  --vs-dropdown-bg: rgb(255 255 255);
  --vs-dropdown-color: rgb(15 23 42);
  --vs-dropdown-option-color: rgb(15 23 42);
  --vs-dropdown-option-bg: rgb(248 250 252);
  --vs-dropdown-option--active-bg: rgb(226 232 240);
  --vs-dropdown-option--active-color: rgb(15 23 42);
  --vs-search-input-color: rgb(15 23 42);
  --vs-selected-color: rgb(15 23 42);
}

.reference-song-select .vs__dropdown-toggle {
  border: none;
  padding: 0;
  min-height: 2rem;
}

.reference-song-select .vs__selected-options {
  padding: 0;
}

.reference-song-select .vs__search,
.reference-song-select .vs__selected {
  margin: 0;
  padding: 0;
  color: rgb(15 23 42);
}

.reference-song-select .vs__actions {
  padding-right: 0;
}

.reference-song-select .vs__dropdown-menu {
  border: 1px solid rgb(226 232 240);
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgb(15 23 42 / 0.1);
}

/* When `appendToBody` is enabled, the dropdown list is moved to `body`,
   so we also need global overrides (not just scoped CSS vars). */
.vs__dropdown-menu {
  border: 1px solid rgb(226 232 240) !important;
  border-radius: 0.5rem !important;
  background: rgb(255 255 255) !important;
  color: rgb(15 23 42) !important;
  box-shadow: 0 10px 15px -3px rgb(15 23 42 / 0.1) !important;
}

.vs__search {
  color: rgb(15 23 42) !important;
}

.vs__dropdown-option {
  background: rgb(248 250 252) !important;
  color: rgb(15 23 42) !important;
}

.vs__dropdown-option--highlight {
  background: rgb(226 232 240) !important;
  color: rgb(15 23 42) !important;
}

.dark .reference-song-select {
  --vs-controls-color: rgb(148 163 184);
  --vs-border-color: transparent;
  --vs-dropdown-bg: rgb(15 23 42);
  --vs-dropdown-color: rgb(241 245 249);
  --vs-dropdown-option-color: rgb(241 245 249);
  --vs-dropdown-option-bg: rgb(15 23 42);
  --vs-dropdown-option--active-bg: rgb(30 41 59);
  --vs-dropdown-option--active-color: rgb(241 245 249);
  --vs-search-input-color: rgb(241 245 249);
  --vs-selected-color: rgb(241 245 249);
}

.dark .reference-song-select .vs__search,
.dark .reference-song-select .vs__selected {
  color: rgb(241 245 249);
}

.dark .reference-song-select .vs__dropdown-menu {
  border-color: rgb(51 65 85);
  box-shadow: 0 10px 15px -3px rgb(2 6 23 / 0.45);
}

.dark .vs__dropdown-menu {
  border-color: rgb(51 65 85) !important;
  background: rgb(15 23 42) !important;
  color: rgb(241 245 249) !important;
  box-shadow: 0 10px 15px -3px rgb(2 6 23 / 0.45) !important;
}

.dark .vs__search {
  color: rgb(241 245 249) !important;
}

.dark .vs__dropdown-option {
  background: rgb(15 23 42) !important;
  color: rgb(241 245 249) !important;
}

.dark .vs__dropdown-option--highlight {
  background: rgb(30 41 59) !important;
  color: rgb(241 245 249) !important;
}
</style>
