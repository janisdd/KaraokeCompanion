import { Logger } from "~/helpers/logger"
import { SongsAnalyzerIndexer } from "~/helpers/songsAnalyzerIndexer"

export type LoadExistingAnalyzeResultsResponse = {
  success: boolean
}

export default defineEventHandler(async () => {
  try {
    await SongsAnalyzerIndexer.loadExistingAnalyzeResults()
  } catch (error) {
    Logger.error(
      `[AdminLoadExistingAnalyzeResults] Failed to load existing analyze results: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to load existing analyze results",
    })
  }

  const response: LoadExistingAnalyzeResultsResponse = {
    success: true,
  }

  return response
})
