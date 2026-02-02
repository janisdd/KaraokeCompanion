import { config as loadEnv } from 'dotenv'
import { Logger, LogLevelEnum } from '~/helpers/logger'
import { Indexer } from '~/helpers/songsIndexer'
import fs from "fs";


export default defineNitroPlugin(async () => {
  loadEnv()

  // check if the secrets file exists
  if (!fs.existsSync("./secrets/.env")) {
    Logger.warn("Secrets file not found");
  }
  
  const songsDirKeys = Object.keys(process.env)
    .filter((key) => /^ULTRA_START_SONGS_DIR_PATH\d+$/.test(key))
    .sort((a, b) => {
      const aNum = Number(a.replace('ULTRA_START_SONGS_DIR_PATH', ''))
      const bNum = Number(b.replace('ULTRA_START_SONGS_DIR_PATH', ''))
      return aNum - bNum
    })
  const songsDirPaths = songsDirKeys
    .map((key) => process.env[key])
    .filter((value): value is string => Boolean(value))

  if (songsDirPaths.length > 0) {
    Logger.log(`[nuxt start] found the following song dirs for ULTRA_START_SONGS_DIR_PATH*:`);
    for (const dirPath of songsDirPaths) {
      Logger.log(`[nuxt start] - ${dirPath}`);
    }
  } else {
    Logger.log(`[nuxt start] no song dirs found for ULTRA_START_SONGS_DIR_PATH*`);
  }
  Logger.log(`[nuxt start] PLAYLIST_CACHE_DIR_PATH: ${process.env.PLAYLIST_CACHE_DIR_PATH}`);
  Logger.log(`[nuxt start] IS_DEFAULT_PAGE_THEME_MODE_DARK: ${process.env.IS_DEFAULT_PAGE_THEME_MODE_DARK}`);

  switch (process.env.LOG_LEVEL) {
    case 'DEBUG':
      Logger.setLogLevel(LogLevelEnum.DEBUG);
      break;
    case 'INFO':
      Logger.setLogLevel(LogLevelEnum.INFO);
      break;
    case 'WARN':
      Logger.setLogLevel(LogLevelEnum.WARN);
      break;
    case 'ERROR':
      Logger.setLogLevel(LogLevelEnum.ERROR);
      break;
    default:
      Logger.setLogLevel(LogLevelEnum.DEBUG);
      console.warn(`[nuxt start] LOG_LEVEL is not set, using DEBUG as default`);
      break;
  }

  Logger.log(`[nuxt start] LOG_LEVEL set to ${process.env.LOG_LEVEL}`);

  if (songsDirPaths.length === 0) {
    Logger.error('[nuxt start] ULTRA_START_SONGS_DIR_PATH* is not set');
    return;
  }

  try {
    for (const dirPath of songsDirPaths) {
      Logger.log(`[nuxt start] Now indexing songs in ${dirPath}`);
      await Indexer.indexFilesInDirectory(dirPath);
      Logger.log(`[nuxt start] Songs indexed successfully for ${dirPath}`);
    }
    Logger.log(`[nuxt start] All Songs indexed successfully for ${songsDirPaths.length} dirs`);
    Logger.log(`[nuxt start] Total songs indexed: ${Indexer.getSongsMap().size}`);
  } catch (error) {
    Logger.error(`[nuxt start] Error indexing songs: ${error instanceof Error ? error.message : String(error)}`);
  }

  // do not use logger here, we always want to show this message (regardless of log level)
  console.log(`[nuxt start] --- Startup completed --- `);
})
