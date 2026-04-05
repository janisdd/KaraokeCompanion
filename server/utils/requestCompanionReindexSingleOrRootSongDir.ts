import { ConfigHelper } from "~/helpers/configHelper"
import { Logger } from "~/helpers/logger"
import { z } from "zod"

const defaultLogPrefix = "[CompanionReindexSingleSongDir]"

export type ReindexSingleSongDirPayload = {
  singleSongDirName: string
}

export const companionQueuedReindexResponseSchema = z.object({
  ok: z.literal(true),
  queued: z.literal(true),
  alreadyQueued: z.boolean(),
  queueLength: z.number(),
})

export const companionErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
})

export const companionReindexResponseSchema = z.discriminatedUnion("ok", [
  companionQueuedReindexResponseSchema,
  companionErrorResponseSchema,
])

export type CompanionQueuedReindexResponse = z.infer<
  typeof companionQueuedReindexResponseSchema
>
export type CompanionErrorResponse = z.infer<
  typeof companionErrorResponseSchema
>
export type ReindexSingleSongDirResponse = z.infer<
  typeof companionReindexResponseSchema
>

export type ReindexRootDirPayload = {
  songsRootDirName: string
}

export type ReindexRootDirResponse = ReindexSingleSongDirResponse

const defaultRootLogPrefix = "[CompanionReindexRootDir]"

function parseCompanionReindexResponse(
  raw: unknown,
  logPrefix: string,
): ReindexSingleSongDirResponse {
  const result = companionReindexResponseSchema.safeParse(raw)
  if (!result.success) {
    Logger.error(
      `${logPrefix} Invalid companion response: ${result.error.message}`,
    )
    throw createError({
      statusCode: 502,
      message: "Failed to parse companion response",
    })
  }
  return result.data
}

/**
 * Asks Ultra Star Companion to queue a full reindex for one songs root directory.
 */
export async function requestCompanionReindexRootDir(
  songsRootDirName: string,
  options: { logPrefix?: string } = {},
): Promise<ReindexRootDirResponse> {
  const logPrefix = options.logPrefix ?? defaultRootLogPrefix

  const payload: ReindexRootDirPayload = {
    songsRootDirName,
  }

  let fetchResponse: Response
  try {
    fetchResponse = await fetch(
      ConfigHelper.getUltraStarCompanionRequestUrl("/reindexRootDir"),
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
    Logger.error(`${logPrefix} Companion reindex root failed: ${detail}`)
    throw createError({
      statusCode: 502,
      message: `Failed to reindex songs root directory: ${detail}`,
    })
  }

  let raw: unknown
  try {
    raw = await fetchResponse.json()
  } catch (error) {
    Logger.error(
      `${logPrefix} Failed to read companion response JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw createError({
      statusCode: 502,
      message: "Failed to parse companion response",
    })
  }

  return parseCompanionReindexResponse(raw, logPrefix)
}

/**
 * Asks Ultra Star Companion to reindex a single song folder under the configured roots.
 */
export async function requestCompanionReindexSingleSongDir(
  singleSongDirName: string,
  options: { logPrefix?: string } = {},
): Promise<ReindexSingleSongDirResponse> {
  const logPrefix = options.logPrefix ?? defaultLogPrefix

  const payload: ReindexSingleSongDirPayload = {
    singleSongDirName,
  }

  let fetchResponse: Response
  try {
    fetchResponse = await fetch(
      ConfigHelper.getUltraStarCompanionRequestUrl("/reindexSingleSongDir"),
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

  let raw: unknown
  try {
    raw = await fetchResponse.json()
  } catch (error) {
    Logger.error(
      `${logPrefix} Failed to read companion response JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw createError({
      statusCode: 502,
      message: "Failed to parse companion response",
    })
  }

  return parseCompanionReindexResponse(raw, logPrefix)
}
