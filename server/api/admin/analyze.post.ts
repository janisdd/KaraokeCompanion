import { Logger } from "~/helpers/logger"
import { SongsIndexer } from "~/helpers/songsIndexer"
import {
  getAnalyzeHelperByKey,
  getAnalyzeResultsForSong,
} from "~/server/utils/analyzeResults"
import type {
  RunAnalyzeRequest,
  RunAnalyzeResponse,
} from "~/types/analyzeResults"

export default defineEventHandler(async (event) => {
  const body = await readBody<RunAnalyzeRequest>(event)
  const songKey = body?.songKey
  const analyzerKey = body?.analyzerKey

  if (!songKey) {
    throw createError({ statusCode: 400, message: "Missing songKey" })
  }

  if (!analyzerKey) {
    throw createError({ statusCode: 400, message: "Missing analyzerKey" })
  }

  const helper = getAnalyzeHelperByKey(analyzerKey)
  if (!helper) {
    throw createError({ statusCode: 404, message: `Unknown analyzer: ${analyzerKey}` })
  }

  const song = SongsIndexer.getSongsMap().get(songKey)
  if (!song) {
    throw createError({ statusCode: 404, message: `Song not found: ${songKey}` })
  }

  if (!song.audioFileName) {
    throw createError({ statusCode: 400, message: "Song has no audio file" })
  }

  const songRootDir = SongsIndexer.getSongRootMap().get(songKey)
  if (!songRootDir) {
    throw createError({ statusCode: 500, message: `Missing song root for: ${songKey}` })
  }

  try {
    await helper.analyze(songRootDir, song.songDirName, song.audioFileName)
  } catch (error) {
    Logger.error(
      `[AdminAnalyze] Failed to run ${analyzerKey} for ${songKey}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to run analyzer",
    })
  }

  const result = getAnalyzeResultsForSong(songKey)
  if (!result) {
    throw createError({
      statusCode: 500,
      message: `Analyzer ran but no result could be loaded for ${songKey}`,
    })
  }

  const response: RunAnalyzeResponse = {
    success: true,
    data: result,
  }

  return response
})
