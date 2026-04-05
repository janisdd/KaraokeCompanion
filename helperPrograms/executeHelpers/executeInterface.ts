import path from "path"
import fs from "fs"
import { Logger } from "../../helpers/logger"

/**
 * in contrast to analyze helpers, execute helpers are used to execute a command on a song directory
 * before running an execute helper we keep a copy of the initial audio file with an `_original` suffix
 * the helper then operates on the current file name so sidecar files that reference the audio file name stay valid
 */
export interface ExecuteHelper {
  readonly logPrefix: string
  // should be unique
  readonly executorKey: string
  // name for ui
  readonly displayName: string

  getScriptPath(): string
  /**
   * 
   * @param songsRootDir - The absolute path to the songs root directory
   * @param songDirName - The name of the song directory (every song has a dir with all files, this is last part of the absolute path)
   * @param fileNameWithExtension - the file name inside the song directory that is the input file
   * @param params - the parameters for the execute helper (use zod to validate the params)
   */
  execute(songsRootDir: string, songDirName: string, fileNameWithExtension: string, params: any): Promise<void>
}

export function resolveExecuteHelperScriptPath(
  helperDirName: string,
  currentDirPath: string,
  scriptFileName: string,
): string {
  const cwdScriptPath = path.join(
    process.cwd(),
    "helperPrograms",
    "executeHelpers",
    helperDirName,
    scriptFileName,
  )

  if (fs.existsSync(cwdScriptPath)) {
    return cwdScriptPath
  }

  return path.join(currentDirPath, scriptFileName)
}

// we keep a backup of the initial audio file before the current file gets modified
export const executeOriginalFileNameSuffix = "_original"

type ExecuteFilePaths = {
  originalFilePath: string
  currentFilePath: string
}

export function prepareOriginalCopyAndGetExecutionFilePaths(
  songsRootDir: string,
  songDirName: string,
  fileNameWithExtension: string,
): ExecuteFilePaths {
  const fileExtension = path.extname(fileNameWithExtension)
  const fileBaseName = path.basename(fileNameWithExtension, fileExtension)
  const originalFilePath = path.join(songsRootDir, songDirName, fileBaseName + executeOriginalFileNameSuffix + fileExtension)

  // when we don't have an original already, use the current file as original
  const currentFilePath = path.join(songsRootDir, songDirName, fileBaseName + fileExtension)

  if (!fs.existsSync(originalFilePath)) {
    Logger.log(`[ExecuteHelperInterface] preparing original copy for '${currentFilePath}'`)
    fs.copyFileSync(currentFilePath, originalFilePath)
  }

  return {
    originalFilePath,
    currentFilePath,
  }
}

export function getTempExecutionFilePath(executionFilePath: string): string {
  const executionFileExtension = path.extname(executionFilePath)
  const executionFileBaseName = path.basename(executionFilePath, executionFileExtension)
  const outputFileBaseName = executionFileBaseName.endsWith(executeOriginalFileNameSuffix)
    ? executionFileBaseName.slice(0, -executeOriginalFileNameSuffix.length)
    : executionFileBaseName

  return path.join(
    path.dirname(executionFilePath),
    `${outputFileBaseName}.tmp${executionFileExtension}`,
  )
}

// POSIX rename replaces an existing destination; on Windows rename/move onto an existing file fails (EPERM / access denied).
function replaceFileWithTempOutput(tempPath: string, finalPath: string) {
  if (process.platform === "win32") {
    fs.copyFileSync(tempPath, finalPath)
    fs.unlinkSync(tempPath)
    return
  }
  fs.renameSync(tempPath, finalPath)
}

export async function executeWithTempFileSwap(
  songsRootDir: string,
  songDirName: string,
  fileNameWithExtension: string,
  executeFn: (sourceFilePath: string, tempExecutionFilePath: string) => Promise<void>,
): Promise<string> {
  const {
    originalFilePath,
    currentFilePath,
  } = prepareOriginalCopyAndGetExecutionFilePaths(
    songsRootDir,
    songDirName,
    fileNameWithExtension,
  )
  const tempExecutionFilePath = getTempExecutionFilePath(originalFilePath)

  try {
    await executeFn(originalFilePath, tempExecutionFilePath)
    replaceFileWithTempOutput(tempExecutionFilePath, currentFilePath)
    return currentFilePath
  } catch (error) {
    if (fs.existsSync(tempExecutionFilePath)) {
      fs.unlinkSync(tempExecutionFilePath)
    }

    throw error
  }
}