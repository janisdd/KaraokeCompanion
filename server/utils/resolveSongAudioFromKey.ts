import fs from "fs"
import { SongFileHelper } from "~/helpers/songFileHelper"
import { SongsIndexer } from "~/helpers/songsIndexer"

export type ResolvedSongAudio = {
  resolvedPath: string
  mtimeMs: number
  size: number
}

/**
 * Resolves the on-disk mp3 for a song key (same rules as GET /api/song-audio).
 */
export async function resolveSongAudioFromKey(
  songKey: string,
): Promise<ResolvedSongAudio> {
  const trimmedKey = songKey.trim()
  if (!trimmedKey) {
    throw createError({ statusCode: 400, message: "Missing songKey" })
  }

  const song = SongsIndexer.getSongsMap().get(trimmedKey)
  if (!song) {
    throw createError({ statusCode: 404, message: "Song not found" })
  }

  const audioPath = song.audioFileName?.trim() ?? ""
  if (!audioPath) {
    throw createError({ statusCode: 404, message: "Audio file not available" })
  }
  if (!audioPath.toLowerCase().endsWith(".mp3")) {
    throw createError({ statusCode: 400, message: "Invalid audio file" })
  }

  const songRoot = SongsIndexer.getSongRootMap().get(trimmedKey)
  if (!songRoot) {
    throw createError({ statusCode: 404, message: "Song root not found" })
  }

  const resolvedPath = SongFileHelper.resolveSongFilePath(
    songRoot,
    song.songDirName,
    song.audioFileName,
  )
  if (!resolvedPath) {
    throw createError({ statusCode: 403, message: "Invalid audio path" })
  }

  try {
    await fs.promises.access(resolvedPath)
  } catch {
    throw createError({ statusCode: 404, message: "Audio file not found" })
  }

  const stat = await fs.promises.stat(resolvedPath)
  if (!stat.isFile()) {
    throw createError({ statusCode: 404, message: "Audio file not found" })
  }

  return {
    resolvedPath,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  }
}
