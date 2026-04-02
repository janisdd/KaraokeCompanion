import path from "path"
import fs from "fs"

/**
 * in contrast to analyze helpers, execute helpers are used to execute a command on a song directory
 * currently we always execute on the original file as input and output the result in a different file
 * this way the analyzer is always related to the original file and never the result file
 */
export interface ExecuteHelper {
  readonly logPrefix: string

  getScriptPath(): string
  /**
   * 
   * @param absoluteSongDirPath - The absolute path to the song directory
   * @param songDirName - The name of the song directory (every song has a dir with all files, this is last part of the absolute path)
   * @param inputFile - this is the file name inside the song directory that is the input file
   * @param params - the parameters for the execute helper (use zod to validate the params)
   */
  execute(absoluteSongDirPath: string, songDirName: string, inputFile: string, params: any): Promise<void>
}

// we keep the original file and name, when we execute a helper, create a copy or reuse an existing result file
export const executeResultFileNameSuffix = "_result"


export function prepareAndGetResultFilePath(absoluteSongDirPath: string, songDirName: string, inputFileWithExtension: string): string {
  const songDirPath = path.join(absoluteSongDirPath, songDirName)
  const inputFilePath = path.join(songDirPath, inputFileWithExtension)
  const resultFilePath = path.join(songDirPath, path.basename(inputFileWithExtension, path.extname(inputFileWithExtension)) + executeResultFileNameSuffix + path.extname(inputFileWithExtension))
  
  // check if the result file exists
  if (fs.existsSync(resultFilePath)) {
    // then apply execute helper to the result file
    return resultFilePath
  }

  // copy the input file to the result file
  fs.copyFileSync(inputFilePath, resultFilePath)
  return resultFilePath
  
}

export function getTempResultFilePath(resultFilePath: string): string {
  const resultFileExtension = path.extname(resultFilePath)
  const resultFileBaseName = path.basename(resultFilePath, resultFileExtension)

  return path.join(
    path.dirname(resultFilePath),
    `${resultFileBaseName}.tmp${resultFileExtension}`,
  )
}

export async function executeWithTempResultFile(
  absoluteSongDirPath: string,
  songDirName: string,
  inputFileWithExtension: string,
  executeFn: (resultFilePath: string, tempResultFilePath: string) => Promise<void>,
): Promise<string> {
  const resultFilePath = prepareAndGetResultFilePath(
    absoluteSongDirPath,
    songDirName,
    inputFileWithExtension,
  )
  const tempResultFilePath = getTempResultFilePath(resultFilePath)

  try {
    await executeFn(resultFilePath, tempResultFilePath)
    fs.renameSync(tempResultFilePath, resultFilePath)
    return resultFilePath
  } catch (error) {
    if (fs.existsSync(tempResultFilePath)) {
      fs.unlinkSync(tempResultFilePath)
    }

    throw error
  }
}