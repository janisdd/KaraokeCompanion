import path from "path"
import { fileURLToPath } from "url"
import { Logger } from "../../../helpers/logger"
import { execFile } from "child_process"
import { z } from "zod"
import { executeWithTempFileSwap, resolveExecuteHelperScriptPath, type ExecuteHelper } from "../executeInterface"

const currentDirPath = path.dirname(fileURLToPath(import.meta.url))
const helperDirName = "changeRelativeLoudness"
const pythonScriptFileName = "changeRelativeLoudness.py"


const changeRelativeLoudnessParamsSchema = z.object({
  dbChange: z.number(),
})

export type ChangeRelativeLoudnessParams = z.infer<typeof changeRelativeLoudnessParamsSchema>

export const changeRelativeLoudness = {
  executorKey: "changeRelativeLoudness",
  displayName: "Change relative loudness",
  logPrefix: "[ChangeRelativeLoudness]",

  getScriptPath(): string {
    return resolveExecuteHelperScriptPath(helperDirName, currentDirPath, pythonScriptFileName)
  },

  async execute(songsRootDir: string, songDirWithFileWithExtension: string, songDirName: string, params: ChangeRelativeLoudnessParams): Promise<void> {
    const pythonScriptPath = changeRelativeLoudness.getScriptPath()
    const dbChange = changeRelativeLoudnessParamsSchema.parse(params).dbChange

    await executeWithTempFileSwap(
      songsRootDir,
      songDirWithFileWithExtension,
      songDirName,
      async (sourceFilePath, tempExecutionFilePath) => {
        Logger.log(
          `${changeRelativeLoudness.logPrefix} changing loudness by ${dbChange} dB for '${sourceFilePath}'`,
        )

        await new Promise<void>((resolve, reject) => {
          execFile(
            "python3",
            [pythonScriptPath, sourceFilePath, String(dbChange), tempExecutionFilePath],
            (error, stdout, stderr) => {
              if (error) {
                reject(
                  new Error(
                    `${changeRelativeLoudness.logPrefix} Failed to run loudness changer: ${stderr || stdout || error.message}`,
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
  }
} satisfies ExecuteHelper