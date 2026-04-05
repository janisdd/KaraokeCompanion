import type { SongInfo } from "~/types/song"
import { ConfigHelper } from "~/helpers/configHelper"
import { SongsIndexer } from "~/helpers/songsIndexer"

type UltraStarCompanionPlaylistPayload = {
  songs: Array<{
    title: string
    artist: string
  }>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ songKeys?: string[] }>(event)
  const songKeys = body?.songKeys

  if (!Array.isArray(songKeys) || songKeys.length === 0) {
    throw createError({ statusCode: 400, message: "Missing songKeys" })
  }

  const songs = songKeys
    .map((songKey) => SongsIndexer.getSongsMap().get(songKey))
    .filter((song): song is SongInfo => Boolean(song))

  const payload: UltraStarCompanionPlaylistPayload = {
    songs: songs.map((song) => ({
      title: song.title,
      artist: song.artist,
    })),
  }

  // console.log("Companion playlist songs", payload.songs)

  const response = await fetch(
    ConfigHelper.getUltraStarCompanionRequestUrl("/setCompanionPlaylist"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  )

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: `Failed to set companion playlist: ${response.status} ${response.statusText}`,
    })
  }

  return { ok: true, count: songs.length }
})
