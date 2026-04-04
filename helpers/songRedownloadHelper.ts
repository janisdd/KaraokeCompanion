import path from "path"
import fs from "fs"
import { ConfigHelper } from "./configHelper"
import { Logger } from "./logger"
import { SongsIndexer } from "./songsIndexer"

// we know every song is represented as a directory (songDirName)
//  and in that dir there can be audio, video and cover files and at least a .txt file (which is the song notes and contains the meta data)

/* the redownload works as follows:
- when a song is redownloaded, it is copied to the redownload songs trash dir (the whole song dir is copied)
  - because we can redownload songs so often and we don't want to overwrite songs that are already in the trash dir,
    we change the song dir name to include _1, _2, _3, ...
- after that we can download the song again and safely overwrite the existing files
*/

export class SongRedownloadHelper {
  static ensureRedownloadSongsTrashDirExists() {
    const redownloadSongsTrashDir = ConfigHelper.getRedownloadSongsTrashDir()
    if (!fs.existsSync(redownloadSongsTrashDir)) {
      fs.mkdirSync(redownloadSongsTrashDir, { recursive: true })
    }
  }

  /**
   * If the song exists in the local SongsIndexer, copies its song directory into the redownload
   * trash dir using names `<songDirName>_1`, `<songDirName>_2`, ...
   * @returns absolute path to the trash copy, or null if there was nothing to back up
   */
  static async copyIndexedSongDirToTrash(songKey: string): Promise<string | null> {
    if (!SongsIndexer.hasSong(songKey)) {
      return null
    }
    const songInfo = SongsIndexer.getSongsMap().get(songKey)
    const songsRoot = SongsIndexer.getSongRootMap().get(songKey)
    if (!songInfo || !songsRoot) {
      return null
    }
    const srcDir = path.join(songsRoot, songInfo.songDirName)
    if (!fs.existsSync(srcDir)) {
      Logger.warn(
        `[SongRedownloadHelper] Indexed song dir missing on disk: ${srcDir}`,
      )
      return null
    }
    this.ensureRedownloadSongsTrashDirExists()
    const trashRoot = ConfigHelper.getRedownloadSongsTrashDir()
    const baseName = songInfo.songDirName
    let n = 1
    let destDir: string
    for (;;) {
      destDir = path.join(trashRoot, `${baseName}_${n}`)
      if (!fs.existsSync(destDir)) {
        break
      }
      n++
    }
    await fs.promises.cp(srcDir, destDir, { recursive: true })
    Logger.log(`[SongRedownloadHelper] Backed up song key ${songKey} dir to ${destDir}`)
    return destDir
  }
}