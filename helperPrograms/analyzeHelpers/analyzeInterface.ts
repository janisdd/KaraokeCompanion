import fs from "fs"
import path from "path"

/**
 * the idea is that every analyze helper can be run on every song and it will analyze the audio file and store the results in a file (json)
 * this is intended for long running analysis that we want to only run once and then store the results
 */
export function resolveAnalyzeHelperScriptPath(
  helperDirName: string,
  currentDirPath: string,
  scriptFileName: string,
): string {
  const cwdScriptPath = path.join(
    process.cwd(),
    "helperPrograms",
    "analyzeHelpers",
    helperDirName,
    scriptFileName,
  )

  if (fs.existsSync(cwdScriptPath)) {
    return cwdScriptPath
  }

  return path.join(currentDirPath, scriptFileName)
}

export interface AnalyzeHelper<T> {
  // should be unique
  readonly analyzerKey: string
  // name for ui
  readonly displayName: string
  readonly logPrefix: string
  // the file (name) where the result is stored
  readonly resultsFileName: string
  // key is the full path to the song directory (songsRootDir + songDirName)
  // cache results for each song
  resultsMap: Map<string, T>
  getScriptPath(): string
  /**
   * 
   * @param songsRootDir - The absolute path to the song directory
   * @param songDirName - The name of the song directory (every song has a dir with all files, this is last part of the absolute path)
   * @param fileNameWithExtension - the audio file name inside the song directory
   * @param useOriginalFile - when true, prefer the `_original` audio file copy if it exists
   */
  analyze(
    songsRootDir: string,
    songDirName: string,
    fileNameWithExtension: string,
    useOriginalFile?: boolean,
  ): Promise<void>
  // check if the results file exists
  hasRealResult(songsRootDir: string, songDirName: string): Promise<boolean>
  // check if the results are cached in memory
  hasResult(songsRootDir: string, songDirName: string): boolean
  getResult(songsRootDir: string, songDirName: string): T | undefined
  loadResult(songsRootDir: string, songDirName: string): Promise<void>
}