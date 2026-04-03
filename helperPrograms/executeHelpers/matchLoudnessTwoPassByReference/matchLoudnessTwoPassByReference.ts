import path from "path"
import { fileURLToPath } from "url"
import { Logger } from "../../../helpers/logger"
import { execFile } from "child_process"
import { z } from "zod"
import { executeWithTempFileSwap, resolveExecuteHelperScriptPath, type ExecuteHelper } from "../executeInterface"
import { loudnessAnalyzeResultSchema, type LoudnessAnalyzeResult } from "../../analyzeHelpers/loudness/analyze_loudness"

const currentDirPath = path.dirname(fileURLToPath(import.meta.url))
const helperDirName = "matchLoudnessTwoPassByReference"
const pythonScriptFileName = "matchLoudnessTwoPassByReference.py"

const matchLoudnessTwoPassByReferenceParamsSchema = z.object({
  analysis: loudnessAnalyzeResultSchema,
  referenceAnalysis: loudnessAnalyzeResultSchema,
})

export type MatchLoudnessTwoPassByReferenceParams = {
  analysis: LoudnessAnalyzeResult
  referenceAnalysis: LoudnessAnalyzeResult
}

export const matchLoudnessTwoPassByReference = {
  executorKey: "matchLoudnessTwoPassByReference",
  displayName: "Match loudness (two-pass, reference audio)",
  logPrefix: "[MatchLoudnessTwoPassByReference]",

  getScriptPath(): string {
    return resolveExecuteHelperScriptPath(helperDirName, currentDirPath, pythonScriptFileName)
  },

  async execute(
    songsRootDir: string,
    songDirWithFileWithExtension: string,
    songDirName: string,
    params: MatchLoudnessTwoPassByReferenceParams,
  ): Promise<void> {
    const pythonScriptPath = matchLoudnessTwoPassByReference.getScriptPath()
    const { analysis, referenceAnalysis } = matchLoudnessTwoPassByReferenceParamsSchema.parse(params)

    await executeWithTempFileSwap(
      songsRootDir,
      songDirWithFileWithExtension,
      songDirName,
      async (sourceFilePath, tempExecutionFilePath) => {
        Logger.log(
          `${matchLoudnessTwoPassByReference.logPrefix} matching loudness to reference analysis for '${sourceFilePath}'`,
        )

        await new Promise<void>((resolve, reject) => {
          execFile(
            "python3",
            [
              pythonScriptPath,
              sourceFilePath,
              JSON.stringify(analysis),
              JSON.stringify(referenceAnalysis),
              tempExecutionFilePath,
            ],
            (error, stdout, stderr) => {
              if (error) {
                reject(
                  new Error(
                    `${matchLoudnessTwoPassByReference.logPrefix} Failed to run two-pass loudness matcher: ${stderr || stdout || error.message}`,
                  ),
                )
                return
              }

              resolve()
            },
          )
        })
      },
    )
  },
} satisfies ExecuteHelper
