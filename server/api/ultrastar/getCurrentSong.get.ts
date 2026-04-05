import { ConfigHelper } from "~/helpers/configHelper"
import { Logger } from "~/helpers/logger"
import { SongKeyHelper } from "~/helpers/songKeyHelper"
import { SongsIndexer } from "~/helpers/songsIndexer"

type UltraStarCurrentSongResponse = {
  playing: boolean
  // we only need those fields for the song key calculation
  song: {
    artist?: string
    title?: string
  } | null
}

export default defineEventHandler(async () => {
  const response = await fetch(
    ConfigHelper.getUltraStarCompanionRequestUrl("/currentSong"),
    {
      method: "GET",
    },
  )

  if (!response.ok) {
    Logger.error(`Failed to get current song: ${response.status} ${response.statusText}`)
    throw createError({
      statusCode: 502,
      message: `Failed to get current song: ${response.status} ${response.statusText}`,
    })
  }

  let data: UltraStarCurrentSongResponse
  try {
    data = (await response.json()) as UltraStarCurrentSongResponse
  } catch {
    Logger.error("Invalid JSON from Ultra Star currentSong")
    throw createError({ statusCode: 502, message: "Invalid response from Ultra Star companion" })
  }

  Logger.debug(`Current Ultra Star song response: ${JSON.stringify(data)}`)

  const playing = Boolean(data.playing)
  const artist = data.song?.artist?.trim()
  const title = data.song?.title?.trim()

  if (!playing || !artist || !title) {
    return { playing, song: null }
  }

  const songKey = SongKeyHelper.getKey(artist, title)
  const song = SongsIndexer.getSongsMap().get(songKey)

  if (!song) {
    Logger.error(`Current UltraStar song not in indexer: ${songKey}`)
    throw createError({ statusCode: 404, message: "Song not found" })
  }

  return { playing, song }
})
