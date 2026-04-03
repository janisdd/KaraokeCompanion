import type { AnalyzeHelper } from "./analyzeHelpers/analyzeInterface"
import { analyzeLoudness } from "./analyzeHelpers/loudness/analyze_loudness"
import { changeRelativeLoudness } from "./executeHelpers/changeRelativeLoudness/changeRelativeLoudness"
import { matchLoudnessTwoPassByTarget } from "./executeHelpers/matchLoudnessTwoPassByTarget/matchLoudnessTwoPassByTarget"
import type { ExecuteHelper } from "./executeHelpers/executeInterface"

export const knownAnalyzeHelpers: readonly AnalyzeHelper[] = [
  analyzeLoudness,
]

export const knownExecuteHelpers: readonly ExecuteHelper[] = [
  changeRelativeLoudness,
  matchLoudnessTwoPassByTarget,
]