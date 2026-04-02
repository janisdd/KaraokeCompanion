import { SongsIndexer } from "~/helpers/songsIndexer"

export function getAdminExecuteSongContext(songKey: string) {
  if (!songKey) {
    throw createError({ statusCode: 400, message: "Missing songKey" })
  }

  const song = SongsIndexer.getSongsMap().get(songKey)
  if (!song) {
    throw createError({ statusCode: 404, message: `Song not found: ${songKey}` })
  }

  const songRootDir = SongsIndexer.getSongRootMap().get(songKey)
  if (!songRootDir) {
    throw createError({ statusCode: 500, message: `Missing song root for: ${songKey}` })
  }

  return {
    song,
    songRootDir,
  }
}
