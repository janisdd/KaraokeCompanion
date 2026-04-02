import path from "path"
import { fileURLToPath } from "url"
import { Logger } from "../../../helpers/logger"
import { execFile } from "child_process"
import { z } from "zod"
import { executeWithTempResultFile, type ExecuteHelper } from "../executeInterface"

const currentDirPath = path.dirname(fileURLToPath(import.meta.url))


const changeRelativeLoudnessParamsSchema = z.object({
  dbChange: z.number(),
})

export type ChangeRelativeLoudnessParams = z.infer<typeof changeRelativeLoudnessParamsSchema>

export const changeRelativeLoudness = {
  logPrefix: "[ChangeRelativeLoudness]",

  getScriptPath(): string {
    return path.join(currentDirPath, "changeRelativeLoudness.py")
  },

  async execute(absoluteSongDirPath: string, songDirName: string, inputFile: string, params: ChangeRelativeLoudnessParams): Promise<void> {
    const pythonScriptPath = changeRelativeLoudness.getScriptPath()
    const dbChange = changeRelativeLoudnessParamsSchema.parse(params).dbChange;

    await executeWithTempResultFile(
      absoluteSongDirPath,
      songDirName,
      inputFile,
      async (resultFilePath, tempResultFilePath) => {
        Logger.log(
          `${changeRelativeLoudness.logPrefix} changing loudness by ${dbChange} dB for ${resultFilePath}`,
        )

        await new Promise<void>((resolve, reject) => {
          execFile(
            "python3",
            [pythonScriptPath, resultFilePath, String(dbChange), tempResultFilePath],
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