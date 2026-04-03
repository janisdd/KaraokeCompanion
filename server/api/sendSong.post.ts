import { ConfigHelper } from "~/helpers/configHelper"
import { Logger } from "~/helpers/logger"
import { SongsIndexer } from "~/helpers/songsIndexer"

// this type is used to forward the song to the ultra star app (we are the companion app)
type UltraStarCompanionForwardRequest = {
  title: string
  artist: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ songKey?: string }>(event)
  const songKey = body?.songKey?.trim()

  if (!songKey) {
    Logger.error("Missing songKey")
    throw createError({ statusCode: 400, message: "Missing songKey" })
  }

  const song = SongsIndexer.getSongsMap().get(songKey)
  if (!song) {
    Logger.error(`Song not found: ${songKey}`)
    throw createError({ statusCode: 404, message: "Song not found" })
  }

  const port = ConfigHelper.getUltraStarCompanionPort()
  if (!port) {
    Logger.error("Ultra Star Companion port not set")
    throw createError({ statusCode: 500, message: "Ultra Star Companion port not set" })
  }

  const payload: UltraStarCompanionForwardRequest = {
    title: song.title,
    artist: song.artist,
  }

  const response = await fetch(`http://localhost:${port}/selectSong`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    Logger.error(`Failed to forward song: ${response.status} ${response.statusText}`)
    throw createError({
      statusCode: 502,
      message: `Failed to forward song: ${response.status} ${response.statusText}`,
    })
  }

  return { ok: true }
})
