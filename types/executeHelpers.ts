import type { ChangeRelativeLoudnessParams } from "~/helperPrograms/executeHelpers/changeRelativeLoudness/changeRelativeLoudness"
import type { LoudnessAnalyzeResult } from "~/helperPrograms/analyzeHelpers/loudness/analyze_loudness"

export type RunChangeRelativeLoudnessRequest = {
  songKey: string
  params: ChangeRelativeLoudnessParams
}

export type RunMatchLoudnessTwoPassByTargetRequest = {
  songKey: string
  params: {
    targetLufsI: number
  }
}

export type RunMatchLoudnessTwoPassByReferenceRequest = {
  songKey: string
  params: {
    referenceAnalysis: LoudnessAnalyzeResult
  }
}

export type RunExecuteResponse = {
  success: boolean
}
