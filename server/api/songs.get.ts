import { SongsIndexer } from "~/helpers/songsIndexer";

// you should use songsFast.get.ts instead (as it does not serve the song text)

export default defineEventHandler(async () => {
 
  try {
    const songs = Array.from(SongsIndexer.getSongsMap().values());
    return songs;
  } catch {
    // On any error, be resilient and return empty
    return [];
  }
});

