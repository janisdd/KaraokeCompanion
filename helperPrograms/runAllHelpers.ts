import dotenv, { config as loadEnv } from "dotenv";
import fs from "fs";
import path from "path";

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

import { Logger, LogLevelEnum } from "../helpers/logger";
import { SongsIndexer } from "../helpers/songsIndexer";
import { ConfigHelper } from "../helpers/configHelper";
import { knownAnalyzeHelpers } from "./knownHelpers";

const logPrefix = "[RunAllHelpers]";

function setLoggerLevel(): void {
  switch (process.env.LOG_LEVEL) {
    case "DEBUG":
      Logger.setLogLevel(LogLevelEnum.DEBUG);
      break;
    case "INFO":
      Logger.setLogLevel(LogLevelEnum.INFO);
      break;
    case "WARN":
      Logger.setLogLevel(LogLevelEnum.WARN);
      break;
    case "ERROR":
      Logger.setLogLevel(LogLevelEnum.ERROR);
      break;
    default:
      Logger.setLogLevel(LogLevelEnum.DEBUG);
      console.warn(`${logPrefix} LOG_LEVEL is not set, using DEBUG as default`);
      break;
  }
}

async function runAnalyzeHelpers(): Promise<void> {
  if (knownAnalyzeHelpers.length === 0) {
    Logger.log(`${logPrefix} No analyze helpers registered`);
    return;
  }

  const songs = Array.from(SongsIndexer.getSongsMap().values());
  const songRootMap = SongsIndexer.getSongRootMap();

  Logger.log(
    `${logPrefix} Running ${knownAnalyzeHelpers.length} analyze helper(s) for ${songs.length} indexed song(s)`,
  );

  for (const song of songs) {
    if (!song.audioFile) {
      Logger.debug(`${logPrefix} Skipping ${song.key} because it has no audio file`);
      continue;
    }

    const songRootDir = songRootMap.get(song.key);
    if (!songRootDir) {
      Logger.warn(`${logPrefix} Missing song root dir for ${song.key}, skipping analyze helpers`);
      continue;
    }

    const inputFile = path.join(songRootDir, song.audioFile);

    for (const helper of knownAnalyzeHelpers) {
      Logger.debug(`${logPrefix} ${helper.logPrefix} analyzing ${inputFile}`);
      await helper.analyze(inputFile);
    }
  }
}

async function main(): Promise<void> {
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

  Logger.log(`${logPrefix} LOG_LEVEL set to ${process.env.LOG_LEVEL}`);
  Logger.log(`${logPrefix} PLAYLIST_CACHE_DIR_PATH: ${ConfigHelper.getPlaylistCacheDirPath()}`);
  Logger.log(`${logPrefix} IS_DEFAULT_PAGE_THEME_MODE_DARK: ${process.env.IS_DEFAULT_PAGE_THEME_MODE_DARK}`);
  Logger.log(`${logPrefix} ULTRA_STAR_COMPANION_PORT: ${ConfigHelper.getUltraStarCompanionPort()}`);

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
    await runAnalyzeHelpers();
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
