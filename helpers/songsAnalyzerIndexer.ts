import { knownAnalyzeHelpers } from "../helperPrograms/knownHelpers"
import { ConfigHelper } from "./configHelper"
import { Logger } from "./logger"
import { SongsIndexer } from "./songsIndexer"

const logPrefix = "[SongsAnalyzerIndexer]"

export class SongsAnalyzerIndexer {
  public static async loadExistingAnalyzeResults(): Promise<void> {
    if (knownAnalyzeHelpers.length === 0) {
      Logger.log(`${logPrefix} No analyze helpers registered`)
      return
    }

    const songs = Array.from(SongsIndexer.getSongsMap().values())
    const songRootMap = SongsIndexer.getSongRootMap()
    const loadTasks: Array<() => Promise<void>> = []

    Logger.log(
      `${logPrefix} Loading existing results for ${knownAnalyzeHelpers.length} analyze helper(s) across ${songs.length} indexed song(s)`,
    )

    for (const song of songs) {
      if (!song.audioFile) {
        Logger.debug(`${logPrefix} Skipping ${song.key} because it has no audio file`)
        continue
      }

      const songRootDir = songRootMap.get(song.key)
      if (!songRootDir) {
        Logger.warn(`${logPrefix} Missing song root dir for ${song.key}, skipping analyze helpers`)
        continue
      }

      for (const helper of knownAnalyzeHelpers) {
        loadTasks.push(async () => {
          if (helper.hasResult(songRootDir, song.songDirName)) {
            Logger.debug(`${logPrefix} ${helper.logPrefix} results already cached for '${song.songDirName}'`)
            return
          }

          if (!(await helper.hasRealResult(songRootDir, song.songDirName))) {
            Logger.debug(`${logPrefix} ${helper.logPrefix} no stored results for '${song.songDirName}'`)
            return
          }

          Logger.debug(`${logPrefix} ${helper.logPrefix} loading existing results for '${song.songDirName}'`)
          await helper.loadResult(songRootDir, song.songDirName)
        })
      }
    }

    if (loadTasks.length === 0) {
      Logger.log(`${logPrefix} No analyze tasks to load`)
      return
    }

    Logger.log(`${logPrefix} Running ${loadTasks.length} analyze load task(s) with ${ConfigHelper.getNumAnalyzeWorkers()} worker(s)`)

    let taskIndex = 0

    async function runWorker(): Promise<void> {
      while (taskIndex < loadTasks.length) {
        const currentTaskIndex = taskIndex
        taskIndex += 1

        Logger.log(`${logPrefix} Analyze load progress ${currentTaskIndex + 1}/${loadTasks.length} started`)
        await loadTasks[currentTaskIndex]()
      }
    }

    const workerCount = Math.min(ConfigHelper.getNumAnalyzeWorkers(), loadTasks.length)
    const workers: Promise<void>[] = []

    for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
      workers.push(runWorker())
    }

    await Promise.all(workers)
    Logger.log(`${logPrefix} Existing analyze results loaded`)
  }
}
