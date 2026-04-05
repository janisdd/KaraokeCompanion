import { SongsIndexer } from "~/helpers/songsIndexer"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const songKey = typeof query.songKey === "string" ? query.songKey.trim() : ""

  if (!songKey) {
    throw createError({ statusCode: 400, message: "Missing songKey" })
  }

  const song = SongsIndexer.getSongsMap().get(songKey)
  if (!song) {
    throw createError({ statusCode: 404, message: "Song not found" })
  }

  setHeader(event, "Content-Type", "application/json")
  setHeader(event, "Cache-Control", "private, no-store")
  return song.songTextAsWords
})
