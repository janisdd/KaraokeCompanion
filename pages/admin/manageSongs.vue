<script setup lang="ts">
import AdminSongListView from "./AdminSongListView.vue"
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
  RunExecuteResponse,
} from "~/types/executeHelpers"

defineOptions({
  name: "ManageSongsPage",
})

definePageMeta({
  title: "Manage Songs",
})

const { data: analyzerResultsResponse } =
  await useFetch<AnalyzeResultsResponse>("/api/admin/analyzers")
const { data: normalLoudnessResponse } =
  await useFetch<NormalLoudnessResponse>("/api/admin/normalLoudness")

const analyzerResults = ref<AnalyzeResultsSongEntry[]>(
  analyzerResultsResponse.value?.data ?? [],
)
const activeAnalyzeRequestKey = ref<string | null>(null)
const analyzerActionError = ref<string | null>(null)
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
const toolsActionError = ref<string | null>(null)

const normalLoudness = computed(() => normalLoudnessResponse.value?.data ?? null)
const targetLoudness = computed(() =>
  normalLoudness.value === null ? null : -normalLoudness.value,
)

const getSongLoudnessGuidance = (songKey: string) => {
  const analyzerEntry = analyzerResults.value.find(
    (entry) => entry.songKey === songKey,
  )
  const loudnessResult = analyzerEntry?.results.analyzeLoudness
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
  toolsActionError.value = null
}

const clearLoudnessWarning = () => {
  selectedLoudnessWarning.value = null
}

const getAnalyzeRequestKey = (songKey: string, analyzerKey: AnalyzeResultKey) =>
  `${songKey}::${analyzerKey}`

const getFetchErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "Failed to run analyzer"
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
    "Failed to run analyzer"
  )
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
</script>

<template>
  <div>
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
      <div class="flex max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
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
        </div>
      </div>
    </div>

    <AdminSongListView
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
        <div
          class="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
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
            <div class="flex flex-wrap items-center justify-end gap-2">
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
              class="text-right text-xs text-slate-500 dark:text-slate-400"
            >
              {{ loudnessWarningCount }} songs exceed the current tolerance
            </p>
          </div>
        </div>
      </template>
    </AdminSongListView>
  </div>
</template>
