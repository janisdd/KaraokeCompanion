import { config as loadEnv } from 'dotenv'
import { Logger, LogLevels, parseLogLevel } from '~/helpers/logger'
import { runLocalSongsIndexing } from '~/helpers/runLocalSongsIndexing'
import fs from "fs";
import { ConfigHelper } from '~/helpers/configHelper';
import { AllOnlineSongsIndexer } from '~/helpers/allOnlineSongsIndexer';
import { UsersIndexer } from "~/helpers/usersIndexer"
import { SongRedownloadHelper } from '~/helpers/songRedownloadHelper';
import {localStorage} from '../../helpers/localstorage' // needed to shim localstorage

// prevent tree shaking or no side effect import
localStorage.init()

export default defineNitroPlugin(async () => {
  loadEnv()

  // check if the secrets file exists
  if (!fs.existsSync("./secrets/.env")) {
    Logger.warn("Secrets file not found");
  }
  
  const songsDirPaths = ConfigHelper.getUltraStarSongsDirPaths()

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
  Logger.log(`[nuxt start] ULTRASTAR_COMPANION_URL: ${ConfigHelper.getUltraStarCompanionUrl()}`);
  
  const parsedLogLevel = parseLogLevel(process.env.LOG_LEVEL)
  const logLevel = parsedLogLevel ?? LogLevels.DEBUG
  Logger.setLogLevel(logLevel)

  if (!parsedLogLevel) {
    console.warn(`[nuxt start] LOG_LEVEL is not set, using DEBUG as default`)
  }

  Logger.log(`[nuxt start] LOG_LEVEL set to ${logLevel}`);

  if (songsDirPaths.length === 0) {
    Logger.error('[nuxt start] ULTRA_START_SONGS_DIR_PATH* is not set');
    return;
  }

  if (!fs.existsSync(ConfigHelper.getDownloadSongsDir())) {
    fs.mkdirSync(ConfigHelper.getDownloadSongsDir(), { recursive: true });
    Logger.log(`[nuxt start] Download songs directory created: ${ConfigHelper.getDownloadSongsDir()}`);
  }

  // log REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD
  Logger.log(`[nuxt start] REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD: ${ConfigHelper.getRequiredWaitTimeForSongDownload()}`);
  Logger.log(`[nuxt start] DOWNLOAD_PREFERRED_VIDEO_HEIGHT: ${ConfigHelper.getDownloadPreferredVideoHeight()}`);
  Logger.log(`[nuxt start] DOWNLOAD_PREFERRED_VIDEO_FORMAT: ${ConfigHelper.getDownloadPreferredVideoFormat()}`);
  Logger.log(`[nuxt start] DOWNLOAD_CONVERT_AUDIO_FORMAT: ${ConfigHelper.getDownloadConvertAudioFormat()}`);

  // log DOWNLOAD_SONGS_DIR
  Logger.log(`[nuxt start] DOWNLOAD_SONGS_DIR: ${ConfigHelper.getDownloadSongsDir()}`);


  await AllOnlineSongsIndexer.indexAllOnlineSongs();

  try {
    await runLocalSongsIndexing({ logPrefix: "[nuxt start]" });
  } catch (error) {
    Logger.error(`[nuxt start] Error indexing songs: ${error instanceof Error ? error.message : String(error)}`);
  }

  // after we have info about existing and downloaded songs
  AllOnlineSongsIndexer.connectSongInfosWithExistingAndDownloadedSongs();

  // ensure the redownload songs trash dir exists
  SongRedownloadHelper.ensureRedownloadSongsTrashDirExists();

  // load users after all other startup tasks
  try {
    UsersIndexer.loadAllUsers()
  } catch (error) {
    Logger.error(`[nuxt start] Error loading users: ${error instanceof Error ? error.message : String(error)}`)
  }

  // do not use logger here, we always want to show this message (regardless of log level)
  console.log(`[nuxt start] --- Startup completed --- `);
})
