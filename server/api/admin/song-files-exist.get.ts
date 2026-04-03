import { SongFileHelper, type SongFilePresenceResult } from "~/helpers/songFileHelper"
import { SongsIndexer } from "~/helpers/songsIndexer"

export default defineEventHandler(() => {
  const results: Record<string, SongFilePresenceResult> = {}

  for (const songKey of SongsIndexer.getSongsMap().keys()) {
    results[songKey] = SongFileHelper.getFilePresence(songKey)
  }

  return {
    success: true,
    indexingFinished: SongsIndexer.isIndexingFinished(),
    count: Object.keys(results).length,
    results,
  }
})
