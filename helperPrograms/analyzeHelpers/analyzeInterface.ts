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
   * @param absoluteSongDirPath - The absolute path to the song directory
   * @param songDirName - The name of the song directory (every song has a dir with all files, this is last part of the absolute path)
   * @param inputFile - this is the file name inside the song directory that is the input file
   */
  analyze(absoluteSongDirPath: string, songDirName: string, inputFile: string): Promise<void>;
  // check if the results file exists
  hasRealResults(absoluteSongDirPath: string, songDirName: string): Promise<boolean>;
  // check if the results are cached in memory
  hasResults(absoluteSongDirPath: string, songDirName: string): boolean;
  loadResults(absoluteSongDirPath: string, songDirName: string): Promise<void>;
}