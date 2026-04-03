import { SongFileHelper } from "~/helpers/songFileHelper"

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const songKey = typeof query.songKey === "string" ? query.songKey.trim() : ""

  if (!songKey) {
    throw createError({ statusCode: 400, message: "Missing songKey" })
  }

  const result = SongFileHelper.getFilePresence(songKey)
  if (!result.songFound) {
    throw createError({ statusCode: 404, message: `Song not found: ${songKey}` })
  }

  return {
    success: true,
    result,
  }
})
