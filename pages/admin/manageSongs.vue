<script setup lang="ts">
import AdminSongListView from "./AdminSongListView.vue"
import type {
  AnalyzeResultKey,
  AnalyzeResultsSongEntry,
  AnalyzeResultsResponse,
  RunAnalyzeResponse,
} from "~/types/analyzeResults"

defineOptions({
  name: "ManageSongsPage",
})

definePageMeta({
  title: "Manage Songs",
})

const { data: analyzerResultsResponse } =
  await useFetch<AnalyzeResultsResponse>("/api/admin/analyzers")

const analyzerResults = ref<AnalyzeResultsSongEntry[]>(
  analyzerResultsResponse.value?.data ?? [],
)
const activeAnalyzeRequestKey = ref<string | null>(null)
const analyzerActionError = ref<string | null>(null)

const selectedAnalyzerResultTitle = ref("")
const selectedAnalyzerResultContent = ref<string | null>(null)
const selectedSongInfoTitle = ref("")
const selectedSongInfoContent = ref<string | null>(null)

const showAnalyzerResult = (payload: { title: string; content: string }) => {
  selectedAnalyzerResultTitle.value = payload.title
  selectedAnalyzerResultContent.value = payload.content
}

const showSongInfo = (payload: { title: string; content: string }) => {
  selectedSongInfoTitle.value = payload.title
  selectedSongInfoContent.value = payload.content
}

const clearAnalyzerResult = () => {
  selectedAnalyzerResultTitle.value = ""
  selectedAnalyzerResultContent.value = null
}

const clearSongInfo = () => {
  selectedSongInfoTitle.value = ""
  selectedSongInfoContent.value = null
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
  } catch (error) {
    analyzerActionError.value = getFetchErrorMessage(error)
  } finally {
    activeAnalyzeRequestKey.value = null
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

    <AdminSongListView
      :analyzerResults="analyzerResults"
      :activeAnalyzeRequestKey="activeAnalyzeRequestKey"
      @show-analyzer-result="showAnalyzerResult"
      @show-song-info="showSongInfo"
      @run-analyzer="runAnalyzer"
    />
  </div>
</template>
