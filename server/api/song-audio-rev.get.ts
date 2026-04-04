import { Logger } from "~/helpers/logger"
import { resolveSongAudioFromKey } from "~/server/utils/resolveSongAudioFromKey"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const songKey = typeof query.songKey === "string" ? query.songKey.trim() : ""

  Logger.debug(`[SongAudioRev] songKey: ${songKey}`)

  const { mtimeMs, size } = await resolveSongAudioFromKey(songKey)

  setHeader(event, "Cache-Control", "private, no-store")

  return { rev: `${mtimeMs}-${size}` }
})
