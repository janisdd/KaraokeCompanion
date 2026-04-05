import { SongsIndexer } from "~/helpers/songsIndexer"

export default defineEventHandler(async () => {
  try {
    const songs = Array.from(SongsIndexer.getSongsMap().values())
    return songs.map(({ songTextAsWords: _words, ...rest }) => rest)
  } catch {
    return []
  }
})
