import { AllOnlineSongsIndexer } from "~/helpers/allOnlineSongsIndexer"
import { Logger } from "~/helpers/logger"
import { SongsIndexer } from "~/helpers/songsIndexer"
import { requestCompanionReindexSingleSongDir } from "~/server/utils/requestCompanionReindexSingleSongDir"
import { z } from "zod"

const bodySchema = z.object({
  songKey: z.string().min(1),
})

export type ReindexSingleSongResponse = {
  success: boolean
  singleSongDirName: string
}

const logPrefix = "[AdminReindexSingleSong]"

export default defineEventHandler(async (event) => {
  const rawBody = await readBody<unknown>(event)
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: parsed.error.message,
    })
  }

  const { songKey } = parsed.data
  const song = SongsIndexer.getSongsMap().get(songKey)
  if (!song) {
    throw createError({
      statusCode: 404,
      message: `Song not found: ${songKey}`,
    })
  }

  const songsRootDirPath = SongsIndexer.getSongRootMap().get(songKey)
  if (!songsRootDirPath) {
    throw createError({
      statusCode: 500,
      message: `Song root not found for key: ${songKey}`,
    })
  }

  const plainFromIndex = AllOnlineSongsIndexer.getPlainOnlineSongInfo(songKey)
  if (!plainFromIndex) {
    throw createError({
      statusCode: 500,
      message: `Song not found in online songs index: ${songKey}`,
    })
  }

  await requestCompanionReindexSingleSongDir(song.songDirName, {
    logPrefix,
  })

  const updated = await SongsIndexer.reindexSingleSongDir(
    songsRootDirPath,
    song.songDirName,
  )
  if (!updated) {
    Logger.error(
      `${logPrefix} Local reindex failed for dir ${song.songDirName} under ${songsRootDirPath}`,
    )
    throw createError({
      statusCode: 500,
      message:
        "Companion reindex succeeded but updating the local song index failed (missing .txt, duplicate key, or unreadable folder)",
    })
  }

  // after file reindex, song data might have changed (e.g. song name)
  // song key must stay the same after reindex
  const reindexedSong = SongsIndexer.getSongsMap().get(songKey)
  if (!reindexedSong) {
    Logger.error(
      `${logPrefix} Reindexed song not found: ${songKey}`,
    )
    throw createError({
      statusCode: 500,
      message: `Reindexed song not found after file reindex: ${songKey}`,
    })
  }

  // update the online songs index with the new song info (single song reindex is enough)
  AllOnlineSongsIndexer.addSingOnlineSongInfoToIndex({
    key: songKey,
    songId: plainFromIndex.songId,
    songName: reindexedSong.title,
    artist: reindexedSong.artist
  })

  const response: ReindexSingleSongResponse = {
    success: true,
    singleSongDirName: song.songDirName,
  }

  return response
})
