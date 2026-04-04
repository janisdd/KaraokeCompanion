import { AllOnlineSongsIndexer } from "~/helpers/allOnlineSongsIndexer"
import { Logger } from "~/helpers/logger"
import { runLocalSongsIndexing } from "~/helpers/runLocalSongsIndexing"
import { SongsIndexer } from "~/helpers/songsIndexer"

export type ReindexLocalSongsResponse = {
  success: boolean
  songCount: number
}

const logPrefix = "[AdminReindexLocalSongs]"

export default defineEventHandler(async () => {
  try {
    await runLocalSongsIndexing({ logPrefix, resetBeforeIndex: true })
  } catch (error) {
    Logger.error(
      `${logPrefix} Failed to reindex local songs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to reindex local songs",
    })
  }

  AllOnlineSongsIndexer.connectSongInfosWithExistingAndDownloadedSongs()

  const response: ReindexLocalSongsResponse = {
    success: true,
    songCount: SongsIndexer.getSongsMap().size,
  }

  return response
})
