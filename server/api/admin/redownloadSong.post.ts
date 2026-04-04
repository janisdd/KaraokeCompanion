import {
  AllOnlineSongsIndexer,
  onlineSongInfoPlainPartialKeySchema,
  type OnlineSongInfo,
} from "~/helpers/allOnlineSongsIndexer"
import { Logger } from "~/helpers/logger"
import { SongKeyHelper } from "~/helpers/songKeyHelper"
import { SongRedownloadHelper } from "~/helpers/songRedownloadHelper"
import { UsdbAnimuxHelper } from "~/helpers/songsDownloader/UsdbAnimuxHelper"
import { SongsIndexer } from "~/helpers/songsIndexer"
import { requestCompanionReindexSingleSongDir } from "~/server/utils/requestCompanionReindexSingleOrRootSongDir"
import type { OnlineSongsDownloadResponse } from "~/types/onlineSongs"
import { z } from "zod"

const redownloadSongBodySchema = z.object({
  song: onlineSongInfoPlainPartialKeySchema,
})

const logPrefix = "[AdminRedownloadSong]"

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event)
  const parsedBody = redownloadSongBodySchema.safeParse(body)
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      message: parsedBody.error.message,
    })
  }
  const song = parsedBody.data.song

  const key = song.key ?? SongKeyHelper.getKey(song.artist, song.songName)

  if (!AllOnlineSongsIndexer.hasPlainOnlineSongInfo(key)) {
    throw createError({
      statusCode: 404,
      message: "Song not found in online songs index",
    })
  }

  const plainFromIndex = AllOnlineSongsIndexer.getPlainOnlineSongInfo(key)
  if (!plainFromIndex || plainFromIndex.songId !== song.songId) {
    throw createError({
      statusCode: 400,
      message: "Song id does not match online songs index entry",
    })
  }

  const indexedLocally = SongsIndexer.hasSong(key)

  const onlineSong: OnlineSongInfo = {
    ...plainFromIndex,
    downloading: UsdbAnimuxHelper.isSongDownloadingOrDownloaded(
      plainFromIndex.songId,
    ),
    indexed: indexedLocally,
  }

  const response: OnlineSongsDownloadResponse = {
    ok: true,
    count: 1,
    reindexRequested: true,
    reindexError: null,
  }

  let downloadSucceeded = false
  try {
    await SongRedownloadHelper.copyIndexedSongDirToTrash(key)
    // keep new files in the indexed library folder when the song exists locally; otherwise use download dir
    await UsdbAnimuxHelper.downloadSong(onlineSong, true, !indexedLocally)
    downloadSucceeded = true
  } catch (error) {
    Logger.error(
      `Error redownloading song: ${error instanceof Error ? error.message : String(error)}`,
    )
    throw error
  } finally {
    // update the online songs index with the new song info
    // not needed because downloadSong does this already

    if (!downloadSucceeded) {
      response.reindexRequested = false
    } else {
      try {
        const indexedSong = SongsIndexer.getSongsMap().get(key)
        if (!indexedSong) {
          throw new Error(
            "Song missing from local index after redownload; cannot request single-song companion reindex",
          )
        }
        await requestCompanionReindexSingleSongDir(indexedSong.songDirName, {
          logPrefix,
        })
      } catch (error) {
        const reindexErrorMessage =
          error instanceof Error ? error.message : String(error)
        Logger.error(
          `${logPrefix} Failed to reindex single song in companion: ${reindexErrorMessage}`,
        )
        response.reindexRequested = false
        response.reindexError = reindexErrorMessage
      }
    }
  }

  return response
})
