import { AllOnlineSongsIndexer } from "~/helpers/allOnlineSongsIndexer"
import { Logger } from "~/helpers/logger"
import { runLocalSongsIndexing } from "~/helpers/runLocalSongsIndexing"
import { SongsIndexer } from "~/helpers/songsIndexer"

export type ReindexSongsResponse = {
  success: boolean
  songCount: number
}

const logPrefix = "[AdminReindexSongs]"

export default defineEventHandler(async () => {
  try {
    await runLocalSongsIndexing({ logPrefix, resetBeforeIndex: true })
  } catch (error) {
    Logger.error(
      `${logPrefix} Failed to reindex songs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to reindex songs",
    })
  }

  AllOnlineSongsIndexer.connectSongInfosWithExistingAndDownloadedSongs()

  const response: ReindexSongsResponse = {
    success: true,
    songCount: SongsIndexer.getSongsMap().size,
  }

  return response
})
