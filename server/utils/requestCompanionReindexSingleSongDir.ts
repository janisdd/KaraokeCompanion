import { ConfigHelper } from "~/helpers/configHelper"
import { Logger } from "~/helpers/logger"

const defaultLogPrefix = "[CompanionReindexSingleSongDir]"

export type ReindexSingleSongDirPayload = {
  singleSongDirName: string
}

/**
 * Asks Ultra Star Companion to reindex a single song folder under the configured roots.
 */
export async function requestCompanionReindexSingleSongDir(
  singleSongDirName: string,
  options: { logPrefix?: string } = {},
): Promise<void> {
  const logPrefix = options.logPrefix ?? defaultLogPrefix
  const port = ConfigHelper.getUltraStarCompanionPort()
  if (!port) {
    throw createError({
      statusCode: 500,
      message: "Ultra Star Companion port not set",
    })
  }

  const payload: ReindexSingleSongDirPayload = {
    singleSongDirName,
  }

  let fetchResponse: Response
  try {
    fetchResponse = await fetch(
      `http://localhost:${port}/reindexSingleSongDir`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    )
  } catch (error) {
    Logger.error(
      `${logPrefix} Failed to reach companion: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw createError({
      statusCode: 502,
      message: "Failed to reach Ultra Star Companion",
    })
  }

  if (!fetchResponse.ok) {
    const detail = `${fetchResponse.status} ${fetchResponse.statusText}`
    Logger.error(`${logPrefix} Companion reindex failed: ${detail}`)
    throw createError({
      statusCode: 502,
      message: `Failed to reindex song directory: ${detail}`,
    })
  }
}
