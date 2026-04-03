import { ConfigHelper } from "./configHelper"
import { Logger } from "./logger"
import { SongsAnalyzerIndexer } from "./songsAnalyzerIndexer"
import { SongsIndexer } from "./songsIndexer"

export type RunLocalSongsIndexingOptions = {
  logPrefix: string
  // When true, build into a staging index and swap only when the full scan succeeds
  resetBeforeIndex?: boolean
}

// Scans all ULTRA_START_SONGS_DIR_PATH* directories and loads cached analyze helper results
export async function runLocalSongsIndexing(
  options: RunLocalSongsIndexingOptions,
): Promise<void> {
  const { logPrefix, resetBeforeIndex = false } = options
  const songsDirPaths = ConfigHelper.getUltraStarSongsDirPaths()

  if (songsDirPaths.length === 0) {
    Logger.error(`${logPrefix} ULTRA_START_SONGS_DIR_PATH* is not set`)
    throw new Error("No UltraStar song directories configured")
  }

  const useStaging = resetBeforeIndex
  if (useStaging) {
    SongsIndexer.beginStagingIndex()
  }

  try {
    Logger.log(`${logPrefix} Now indexing songs in ${songsDirPaths.length} dirs`)
    for (const dirPath of songsDirPaths) {
      Logger.log(`${logPrefix} Now indexing songs in ${dirPath}`)
      await SongsIndexer.indexFilesInDirectory(dirPath)
      Logger.log(`${logPrefix} Songs indexed successfully for ${dirPath}`)
    }
    Logger.log(
      `${logPrefix} All Songs indexed successfully for ${songsDirPaths.length} dirs`,
    )

    if (useStaging) {
      SongsIndexer.commitStagingIndex()
    }

    Logger.log(`${logPrefix} Total songs indexed: ${SongsIndexer.getSongsMap().size}`)
    await SongsAnalyzerIndexer.loadExistingAnalyzeResults()
    Logger.log(`${logPrefix} Existing analyze helper results loaded`)
  } catch (error) {
    if (useStaging) {
      SongsIndexer.discardStagingIndex()
    }
    throw error
  }
}
