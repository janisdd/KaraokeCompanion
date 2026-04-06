import path from "path"
import fs from "fs"
import type { SongInfo } from "../../types/song"
import { ConfigHelper } from "../../helpers/configHelper"
import { Logger } from "../../helpers/logger"
import { SongsIndexer } from "../../helpers/songsIndexer"

// this is only required on windows but to make the behavior consistent we always do it
const STOP_AND_RESUME_SONG_PREVIEW_FOR_EXECUTE_HELPERS = true

/** POST /stopSongPreview and POST /startSongPreview */
export type CompanionSongPreviewRequest = {
  title: string
  artist: string
}

export type CompanionOkResponse = {
  ok: true
}

export type CompanionErrorResponse = {
  ok: false
  error: string
}

export type CompanionSongPreviewResponse = CompanionOkResponse | CompanionErrorResponse

function findSongInfoBySongDirName(songDirName: string): SongInfo | null {
  for (const info of SongsIndexer.getSongsMap().values()) {
    if (info.songDirName === songDirName) {
      return info
    }
  }
  return null
}

async function postCompanionSongPreview(
  endpointPath: "/stopSongPreview" | "/startSongPreview",
  song: Pick<SongInfo, "title" | "artist">,
): Promise<CompanionSongPreviewResponse | null> {
  const url = ConfigHelper.getUltraStarCompanionRequestUrl(endpointPath)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: song.title,
        artist: song.artist,
      } satisfies CompanionSongPreviewRequest),
    })
    const data = (await response.json()) as CompanionSongPreviewResponse
    if (!response.ok) {
      Logger.error(
        `[ExecuteHelperInterface] ${endpointPath} HTTP ${response.status}: ${JSON.stringify(data)}`,
      )
      return data
    }
    if (!data || typeof data !== "object" || !("ok" in data)) {
      Logger.error(`[ExecuteHelperInterface] ${endpointPath} invalid JSON body`)
      return null
    }
    if (data.ok === false) {
      Logger.error(`[ExecuteHelperInterface] ${endpointPath}: ${data.error}`)
    }
    return data
  } catch (err) {
    Logger.error(`[ExecuteHelperInterface] ${endpointPath} request failed: ${err}`)
    return null
  }
}

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function canOpenFileForWrite(filePath: string): { ok: true } | { ok: false, error: unknown } {
  let fileDescriptor: number | null = null
  try {
    fileDescriptor = fs.openSync(filePath, "r+")
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error,
    }
  } finally {
    if (fileDescriptor !== null) {
      fs.closeSync(fileDescriptor)
    }
  }
}

async function waitForWindowsFileHandleRelease(filePath: string, waitMs: number): Promise<void> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }

    const openResult = canOpenFileForWrite(filePath)
    if (openResult.ok) {
      Logger.log(`[ExecuteHelperInterface] file handle is released for '${filePath}'`)
      return
    }

    Logger.log(`[ExecuteHelperInterface] file handle not released for '${filePath}' (attempt ${attempt + 1}), error: ${getErrorMessage(openResult.error)}`)

    lastError = openResult.error
  }

  throw new Error(
    `Timed out waiting for Windows to release the file handle for '${filePath}': ${getErrorMessage(lastError)}`,
  )
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

  const previewSong =
    STOP_AND_RESUME_SONG_PREVIEW_FOR_EXECUTE_HELPERS
      ? findSongInfoBySongDirName(songDirName)
      : null

  // executeFn only writes the temp path; the file preview may use stays untouched until replace
  let shouldRestartSongPreviewAfterReplace = false

  try {
    await executeFn(originalFilePath, tempExecutionFilePath)
    if (previewSong) {
      await postCompanionSongPreview("/stopSongPreview", previewSong)
      shouldRestartSongPreviewAfterReplace = true
    }
    const waitMs = ConfigHelper.getWaitToReplaceFileForExecuteHelpersInMs()
    // we only need this on windows, but to make the behavior consistent we always do it
    await waitForWindowsFileHandleRelease(currentFilePath, waitMs)
    // if (process.platform === "win32") {
    //   await waitForWindowsFileHandleRelease(currentFilePath, waitMs)
    // } else if (waitMs > 0) {
    //   await new Promise((resolve) => setTimeout(resolve, waitMs))
    // }
    replaceFileWithTempOutput(tempExecutionFilePath, currentFilePath)
    return currentFilePath
  } catch (error) {
    if (fs.existsSync(tempExecutionFilePath)) {
      fs.unlinkSync(tempExecutionFilePath)
    }

    throw error
  } finally {
    if (previewSong && shouldRestartSongPreviewAfterReplace) {
      await postCompanionSongPreview("/startSongPreview", previewSong)
    }
  }
}