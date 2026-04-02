import type { LoudnessAnalyzeResult } from "~/helperPrograms/analyzeHelpers/loudness/analyze_loudness"

export type AnalyzeResultsMap = {
  analyzeLoudness?: LoudnessAnalyzeResult
}

export type AnalyzeResultColumn = {
  key: keyof AnalyzeResultsMap
  label: string
}

export const analyzeResultColumns: readonly AnalyzeResultColumn[] = [
  {
    key: "analyzeLoudness",
    label: "Loudness",
  },
]

export type AnalyzeResultKey = keyof AnalyzeResultsMap

export type AnalyzeResultsSongEntry = {
  songKey: string
  songDirName: string
  results: AnalyzeResultsMap
}

export type LoudnessWarning = {
  songKey: string
  songLabel: string
  measuredLoudness: number
  targetLoudness: number
  difference: number
  absoluteDifference: number
  status: "too loud" | "too quiet"
}

export type AnalyzeResultsResponse = {
  success: boolean
  data: AnalyzeResultsSongEntry[]
}

export type RunAnalyzeRequest = {
  songKey: string
  analyzerKey: AnalyzeResultKey
}

export type RunAnalyzeResponse = {
  success: boolean
  data: AnalyzeResultsSongEntry
}
