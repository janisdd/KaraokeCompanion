import path from "path"
import { fileURLToPath } from "url"
import { Logger } from "../../../helpers/logger"
import type { AnalyzeHelper } from "../analyzeInterface"
import fs from "fs"
import { execFile } from "child_process"
import { z } from "zod"

const currentDirPath = path.dirname(fileURLToPath(import.meta.url))

/**
 @example {
  "input_i": "-13.95",
  "input_tp": "1.33",
  "input_lra": "9.60",
  "input_thresh": "-24.27",
  "output_i": "-22.37",
  "output_tp": "-4.79",
  "output_lra": "6.40",
  "output_thresh": "-32.43",
  "normalization_type": "dynamic",
  "target_offset": "-1.63"
}
 */
const loudnessAnalyzeResultSchema = z.object({
  input_i: z.string(),
  input_tp: z.string(),
  input_lra: z.string(),
  input_thresh: z.string(),
  output_i: z.string(),
  output_tp: z.string(),
  output_lra: z.string(),
  output_thresh: z.string(),
  normalization_type: z.string(),
  target_offset: z.string(),
})

type LoudnessAnalyzeResult = z.infer<typeof loudnessAnalyzeResultSchema>

const storedLoudnessAnalyzeResultSchema = loudnessAnalyzeResultSchema.extend({
  version: z.literal("1").default("1"),
})

export const analyzeLoudness = {
  logPrefix: "[AnalyzeLoudness]",
  resultsFileName: "loudness.json",
  resultsMap: new Map<string, LoudnessAnalyzeResult>(),

  getScriptPath(): string {
    return path.join(currentDirPath, "analyze_loudnes.py")
  },

  async analyze(songsRootDir: string, songDirWithFileWithExtension: string, songDirName: string): Promise<void> {
    const songDirPath = path.join(songsRootDir, songDirName)
    const inputFilePath = path.join(songsRootDir, songDirWithFileWithExtension)
    const resultsFilePath = path.join(songDirPath, analyzeLoudness.resultsFileName)
    const pythonScriptPath = analyzeLoudness.getScriptPath()

    const intputFileName = path.basename(songDirWithFileWithExtension)

    Logger.log(`${analyzeLoudness.logPrefix} analyzing loudness for '${intputFileName}'`)

    const result = await new Promise<LoudnessAnalyzeResult>((resolve, reject) => {
      Logger.debug(`${analyzeLoudness.logPrefix} running command: python3 ${pythonScriptPath} ${inputFilePath}`)
      execFile("python3", [pythonScriptPath, inputFilePath], (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `${analyzeLoudness.logPrefix} Failed to run loudness analyzer for '${intputFileName}': ${stderr || error.message}`,
            ),
          )
          return
        }

        try {
          resolve(loudnessAnalyzeResultSchema.parse(JSON.parse(stdout)))
        } catch (parseError) {
          reject(
            new Error(
              `${analyzeLoudness.logPrefix} Failed to parse analyzer output for '${intputFileName}': ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            ),
          )
        }
      })
    })

    analyzeLoudness.resultsMap.set(songDirPath, result)
    const storedResult = storedLoudnessAnalyzeResultSchema.parse(result)
    fs.writeFileSync(resultsFilePath, JSON.stringify(storedResult, null, 2))
  },
  hasRealResult: async (songsRootDir: string, songDirName: string): Promise<boolean> => {
    const resultsFilePath = path.join(songsRootDir, songDirName, analyzeLoudness.resultsFileName);
    return fs.existsSync(resultsFilePath)
  },
  hasResult: (songsRootDir: string, songDirName: string): boolean => {
    return analyzeLoudness.resultsMap.has(path.join(songsRootDir, songDirName));
  },
  loadResult: async (songsRootDir: string, songDirName: string): Promise<void> => {
    const songDirPath = path.join(songsRootDir, songDirName)
    const resultsFilePath = path.join(songDirPath, analyzeLoudness.resultsFileName)
    const storedResults = storedLoudnessAnalyzeResultSchema.parse(JSON.parse(fs.readFileSync(resultsFilePath, "utf-8")))
    const { version: _version, ...results } = storedResults
    analyzeLoudness.resultsMap.set(songDirPath, results)
  }
} satisfies AnalyzeHelper;