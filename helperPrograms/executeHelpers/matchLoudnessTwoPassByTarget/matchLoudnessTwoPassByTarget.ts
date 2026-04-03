import path from "path"
import { fileURLToPath } from "url"
import { Logger } from "../../../helpers/logger"
import { execFile } from "child_process"
import { z } from "zod"
import { executeWithTempFileSwap, resolveExecuteHelperScriptPath, type ExecuteHelper } from "../executeInterface"
import { loudnessAnalyzeResultSchema, type LoudnessAnalyzeResult } from "../../analyzeHelpers/loudness/analyze_loudness"

const currentDirPath = path.dirname(fileURLToPath(import.meta.url))
const helperDirName = "matchLoudnessTwoPassByTarget"
const pythonScriptFileName = "matchLoudnessTwoPassByTarget.py"

export type MatchLoudnessTwoPassByTargetParams = {
  analysis: LoudnessAnalyzeResult
  targetLufsI: number
}

const matchLoudnessTwoPassByTargetParamsSchema = z.object({
  analysis: loudnessAnalyzeResultSchema,
  targetLufsI: z.number(),
})

export const matchLoudnessTwoPassByTarget = {
  executorKey: "matchLoudnessTwoPassByTarget",
  displayName: "Match loudness (two-pass, target LUFS)",
  logPrefix: "[MatchLoudnessTwoPassByTarget]",

  getScriptPath(): string {
    return resolveExecuteHelperScriptPath(helperDirName, currentDirPath, pythonScriptFileName)
  },

  async execute(songsRootDir: string, songDirWithFileWithExtension: string, songDirName: string, params: MatchLoudnessTwoPassByTargetParams): Promise<void> {
    const pythonScriptPath = matchLoudnessTwoPassByTarget.getScriptPath()
    const {
      analysis: targetAnalysis,
      targetLufsI,
    } = matchLoudnessTwoPassByTargetParamsSchema.parse(params)

    await executeWithTempFileSwap(
      songsRootDir,
      songDirWithFileWithExtension,
      songDirName,
      async (sourceFilePath, tempExecutionFilePath) => {
        Logger.log(
          `${matchLoudnessTwoPassByTarget.logPrefix} matching loudness to target I=${targetLufsI} LUFS for '${sourceFilePath}'`,
        )

        await new Promise<void>((resolve, reject) => {
          execFile(
            "python3",
            [pythonScriptPath, sourceFilePath, JSON.stringify(targetAnalysis), String(targetLufsI), tempExecutionFilePath],
            (error, stdout, stderr) => {
              if (error) {
                reject(
                  new Error(
                    `${matchLoudnessTwoPassByTarget.logPrefix} Failed to run two-pass loudness matcher: ${stderr || stdout || error.message}`,
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

