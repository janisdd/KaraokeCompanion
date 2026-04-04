import fs from "fs"
import { Logger } from "~/helpers/logger"
import { resolveSongAudioFromKey } from "~/server/utils/resolveSongAudioFromKey"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const songKey = typeof query.songKey === "string" ? query.songKey.trim() : ""

  Logger.debug(`[SongAudio] Getting audio for songKey: ${songKey}`)

  const { resolvedPath, mtimeMs, size: fileSize } =
    await resolveSongAudioFromKey(songKey)

  Logger.debug(`[SongAudio] Audio file: ${resolvedPath}`)

  const rangeHeader = getHeader(event, "range")
  const etag = `W/"${fileSize}-${mtimeMs}"`

  setHeader(event, "Content-Type", "audio/mpeg")
  setHeader(event, "Accept-Ranges", "bytes")
  setHeader(event, "Cache-Control", "private, no-store")
  setHeader(event, "ETag", etag)

  if (!rangeHeader || typeof rangeHeader !== "string") {
    setHeader(event, "Content-Length", fileSize)
    return sendStream(event, fs.createReadStream(resolvedPath))
  }

  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
  if (!match) {
    throw createError({ statusCode: 416, message: "Invalid range" })
  }

  const start = match[1] ? Number.parseInt(match[1], 10) : 0
  const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) {
    throw createError({ statusCode: 416, message: "Invalid range" })
  }

  const clampedEnd = Math.min(end, fileSize - 1)
  const chunkSize = clampedEnd - start + 1

  setResponseStatus(event, 206)
  setHeader(event, "Content-Range", `bytes ${start}-${clampedEnd}/${fileSize}`)
  setHeader(event, "Content-Length", chunkSize)
  return sendStream(event, fs.createReadStream(resolvedPath, { start, end: clampedEnd }))
})
