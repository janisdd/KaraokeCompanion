import path from "path";
import { Logger } from "../../../helpers/logger";
import type { AnalyzeHelper } from "../analyzeInterface";
import fs from "fs";
import { execFile } from "child_process";
import { z } from "zod";

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
  version: z.string(),
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

export const analyzeLoudness = {
  logPrefix: "[AnalyzeLoudness]",
  resultsFileName: "loudness.json",
  resultsMap: new Map<string, LoudnessAnalyzeResult>(),

  getScriptPath(): string {
    return path.join(__dirname, "analyze_loudnes.py")
  },

  async analyze(absoluteSongDirPath: string, songDirName: string, inputFile: string): Promise<void> {
    const songDirPath = path.join(absoluteSongDirPath, songDirName)
    const inputFilePath = path.join(songDirPath, inputFile)
    const resultsFilePath = path.join(songDirPath, analyzeLoudness.resultsFileName)
    const pythonScriptPath = analyzeLoudness.getScriptPath()

    Logger.log(`${analyzeLoudness.logPrefix} analyzing loudness for ${inputFilePath}`)

    const result = await new Promise<LoudnessAnalyzeResult>((resolve, reject) => {
      execFile("python3", [pythonScriptPath, inputFilePath], (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `${analyzeLoudness.logPrefix} Failed to run loudness analyzer: ${stderr || error.message}`,
            ),
          )
          return
        }

        try {
          resolve(loudnessAnalyzeResultSchema.parse(JSON.parse(stdout)))
        } catch (parseError) {
          reject(
            new Error(
              `${analyzeLoudness.logPrefix} Failed to parse analyzer output: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            ),
          )
        }
      })
    })

    analyzeLoudness.resultsMap.set(songDirPath, result)
    fs.writeFileSync(resultsFilePath, JSON.stringify(result, null, 2))
  },
  hasRealResults: async (absoluteSongDirPath: string, songDirName: string): Promise<boolean> => {
    const resultsFilePath = path.join(absoluteSongDirPath, songDirName, analyzeLoudness.resultsFileName);
    return fs.existsSync(resultsFilePath)
  },
  hasResults: (absoluteSongDirPath: string, songDirName: string): boolean => {
    return analyzeLoudness.resultsMap.has(path.join(absoluteSongDirPath, songDirName));
  },
  loadResults: async (absoluteSongDirPath: string, songDirName: string): Promise<void> => {
    const songDirPath = path.join(absoluteSongDirPath, songDirName)
    const resultsFilePath = path.join(songDirPath, analyzeLoudness.resultsFileName)
    const results = loudnessAnalyzeResultSchema.parse(JSON.parse(fs.readFileSync(resultsFilePath, "utf-8")))
    analyzeLoudness.resultsMap.set(songDirPath, results)
  }
} satisfies AnalyzeHelper;