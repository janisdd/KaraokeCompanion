/**
 * the idea is that every analyze helper can be run on every song and it will analyze the audio file and store the results in a file (json)
 * this is intended for long running analysis that we want to only run once and then store the results
 */
export interface AnalyzeHelper {
  readonly logPrefix: string;
  readonly resultsFileName: string;
  // key is the full path to the song directory
  // cache results for each song
  resultsMap: Map<string, any>;
  getScriptPath(): string;
  /**
   * 
   * @param songsRootDir - The absolute path to the song directory
   * @param songDirWithFileWithExtension - the full path to the song directory with the file name with extension (including the song directory name and the file name with extension)
   * @param songDirName - The name of the song directory (every song has a dir with all files, this is last part of the absolute path)
   */
  analyze(songsRootDir: string, songDirWithFileWithExtension: string, songDirName: string): Promise<void>;
  // check if the results file exists
  hasRealResult(songsRootDir: string, songDirName: string): Promise<boolean>;
  // check if the results are cached in memory
  hasResult(songsRootDir: string, songDirName: string): boolean;
  loadResult(songsRootDir: string, songDirName: string): Promise<void>;
}