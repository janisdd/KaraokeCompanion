import dotenv, { config as loadEnv } from "dotenv";
import fs from "fs";
import path from "path";
import { Logger, LogLevels, parseLogLevel } from "../helpers/logger";
import { SongsIndexer } from "../helpers/songsIndexer";
import { knownAnalyzeHelpers } from "./knownHelpers";
import { ConfigHelper } from "../helpers/configHelper";


type CreateErrorInput = {
  statusCode?: number;
  message?: string;
};

type GlobalWithCreateError = typeof globalThis & {
  createError?: (input: CreateErrorInput) => Error;
};

const globalWithCreateError = globalThis as GlobalWithCreateError;

if (typeof globalWithCreateError.createError !== "function") {
  globalWithCreateError.createError = ({ statusCode, message }) => {
    const error = new Error(message ?? "Unknown error") as Error & {
      statusCode?: number;
    };
    error.statusCode = statusCode;
    return error;
  };
}

loadEnv();
dotenv.config({ path: "./secrets/.env" });


const logPrefix = "[RunAllHelpers]";

function setLoggerLevel(): void {
  const parsedLogLevel = parseLogLevel(process.env.LOG_LEVEL)
  const logLevel = parsedLogLevel ?? LogLevels.DEBUG
  Logger.setLogLevel(logLevel)

  if (!parsedLogLevel) {
    console.warn(`${logPrefix} LOG_LEVEL is not set, using DEBUG as default`)
  }
}

async function runAllAnalyzeHelpers(): Promise<void> {
  if (knownAnalyzeHelpers.length === 0) {
    Logger.log(`${logPrefix} No analyze helpers registered`);
    return;
  }

  const songs = Array.from(SongsIndexer.getSongsMap().values());
  const songRootMap = SongsIndexer.getSongRootMap();
  const analyzeTasks: Array<() => Promise<void>> = []

  Logger.log(
    `${logPrefix} Running ${knownAnalyzeHelpers.length} analyze helper(s) for ${songs.length} indexed song(s)`,
  );

  for (const song of songs) {
    if (!song.audioFileName) {
      Logger.debug(`${logPrefix} Skipping ${song.key} because it has no audio file`);
      continue;
    }

    const songRootDir = songRootMap.get(song.key);
    if (!songRootDir) {
      Logger.warn(`${logPrefix} Missing song root dir for ${song.key}, skipping analyze helpers`);
      continue;
    }

    const inputFileWithExtension = song.audioFileName

    for (const helper of knownAnalyzeHelpers) {
      analyzeTasks.push(async () => {
        if (await helper.hasRealResult(songRootDir, song.songDirName)) {
          Logger.debug(`${logPrefix} ${helper.logPrefix} loading existing results for '${song.songDirName}'`)
          // this loads the result and because we use zod, we check if the result is valid
          await helper.loadResult(songRootDir, song.songDirName)
          return
        }

        Logger.debug(`${logPrefix} ${helper.logPrefix} analyzing '${inputFileWithExtension}'`)
        await helper.analyze(songRootDir, song.songDirName, inputFileWithExtension)
      })
    }
  }

  if (analyzeTasks.length === 0) {
    Logger.log(`${logPrefix} No analyze tasks to run`)
    return
  }

  Logger.log(`${logPrefix} Running ${analyzeTasks.length} analyze task(s) with ${ConfigHelper.getNumAnalyzeWorkers()} worker(s)`)

  let taskIndex = 0
  let completedTaskCount = 0

  async function runWorker(): Promise<void> {
    while (taskIndex < analyzeTasks.length) {
      const currentTaskIndex = taskIndex
      taskIndex += 1

      Logger.log(`${logPrefix} Analyze progress ${currentTaskIndex + 1}/${analyzeTasks.length} started`)
      await analyzeTasks[currentTaskIndex]()
      completedTaskCount += 1
    }
  }

  const workerCount = Math.min(ConfigHelper.getNumAnalyzeWorkers(), analyzeTasks.length)
  const workers: Promise<void>[] = []

  for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
    workers.push(runWorker())
  }

  await Promise.all(workers)
}

async function main(): Promise<void> {
  const { ConfigHelper } = await import("../helpers/configHelper")

  if (!fs.existsSync("./secrets/.env")) {
    Logger.warn(`${logPrefix} Secrets file not found`);
  }

  const songsDirPaths = ConfigHelper.getUltraStarSongsDirPaths();

  if (songsDirPaths.length > 0) {
    Logger.log(`${logPrefix} found the following song dirs for ULTRA_START_SONGS_DIR_PATH*:`);
    for (const dirPath of songsDirPaths) {
      Logger.log(`${logPrefix} - ${dirPath}`);
    }
  } else {
    Logger.log(`${logPrefix} no song dirs found for ULTRA_START_SONGS_DIR_PATH*`);
  }

  setLoggerLevel();

  Logger.log(`${logPrefix} LOG_LEVEL set to ${parseLogLevel(process.env.LOG_LEVEL) ?? LogLevels.DEBUG}`);
  Logger.log(`${logPrefix} PLAYLIST_CACHE_DIR_PATH: ${ConfigHelper.getPlaylistCacheDirPath()}`);
  Logger.log(`${logPrefix} IS_DEFAULT_PAGE_THEME_MODE_DARK: ${process.env.IS_DEFAULT_PAGE_THEME_MODE_DARK}`);
  Logger.log(`${logPrefix} ULTRASTAR_COMPANION_URL: ${ConfigHelper.getUltraStarCompanionUrl()}`);

  if (songsDirPaths.length === 0) {
    Logger.error(`${logPrefix} ULTRA_START_SONGS_DIR_PATH* is not set`);
    process.exitCode = 1;
    return;
  }

  const downloadSongsDir = ConfigHelper.getDownloadSongsDir();
  if (!downloadSongsDir) {
    Logger.error(`${logPrefix} DOWNLOAD_SONGS_DIR is not set`);
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(downloadSongsDir)) {
    fs.mkdirSync(downloadSongsDir, { recursive: true });
    Logger.log(`${logPrefix} Download songs directory created: ${downloadSongsDir}`);
  }

  Logger.log(
    `${logPrefix} REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD: ${ConfigHelper.getRequiredWaitTimeForSongDownload()}`,
  );
  Logger.log(
    `${logPrefix} DOWNLOAD_PREFERRED_VIDEO_HEIGHT: ${ConfigHelper.getDownloadPreferredVideoHeight()}`,
  );
  Logger.log(
    `${logPrefix} DOWNLOAD_PREFERRED_VIDEO_FORMAT: ${ConfigHelper.getDownloadPreferredVideoFormat()}`,
  );
  Logger.log(
    `${logPrefix} DOWNLOAD_CONVERT_AUDIO_FORMAT: ${ConfigHelper.getDownloadConvertAudioFormat()}`,
  );
  Logger.log(`${logPrefix} DOWNLOAD_SONGS_DIR: ${downloadSongsDir}`);

  try {
    Logger.log(`${logPrefix} Now indexing songs in ${songsDirPaths.length} dirs`);
    for (const dirPath of songsDirPaths) {
      Logger.log(`${logPrefix} Now indexing songs in ${dirPath}`);
      await SongsIndexer.indexFilesInDirectory(dirPath);
      Logger.log(`${logPrefix} Songs indexed successfully for ${dirPath}`);
    }
    Logger.log(`${logPrefix} All Songs indexed successfully for ${songsDirPaths.length} dirs`);
    Logger.log(`${logPrefix} Total songs indexed: ${SongsIndexer.getSongsMap().size}`);
    await runAllAnalyzeHelpers();
    Logger.log(`${logPrefix} All analyze helpers finished successfully`);
  } catch (error) {
    Logger.error(
      `${logPrefix} Error indexing songs: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`${logPrefix} --- Indexing completed ---`);
}

await main();
