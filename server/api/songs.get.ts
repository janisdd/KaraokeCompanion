import { Indexer } from "~/helpers/songsIndexer";
import fs from "fs";
import { ConfigHelper } from "~/helpers/configHelper";

const UltraStartSongsDirPath = ConfigHelper.getUltraStartSongsDirPath();

export default defineEventHandler(async () => {
 
  try {
    try {
      await fs.promises.access(UltraStartSongsDirPath);
    } catch {
      // Directory missing: return empty list
      return [];
    }
    console.log("Getting songs", UltraStartSongsDirPath)
    const songs = Array.from(Indexer.getSongsMap().values());
    return songs;
  } catch {
    // On any error, be resilient and return empty
    return [];
  }
});

