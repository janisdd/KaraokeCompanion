import type { AnalyzeHelper } from "./analyzeHelpers/analyzeInterface";
import { analyzeLoudness } from "./analyzeHelpers/loudness/analyze_loudness";

export const knownAnalyzeHelpers: readonly AnalyzeHelper[] = [
  analyzeLoudness,
]
