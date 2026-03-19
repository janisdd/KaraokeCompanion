import dotenv from 'dotenv'
import fs from "fs";
import { Logger, LogLevelEnum } from './logger';

//NOTE: startup-env must be run before this, else the process.env variables are not set

dotenv.config({ path: "./secrets/.env" });

const defaultRequiredWaitTimeForSongDownload = 30;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const ULTRA_STAR_COMPANION_PORT = process.env.ULTRA_STAR_COMPANION_PORT || "";
const PlaylistCacheDirPath = process.env.PLAYLIST_CACHE_DIR_PATH || "";
const USDB_ANIMUX_ID = process.env.USDB_ANIMUX_ID || "";
const USDB_ANIMUX_PW = process.env.USDB_ANIMUX_PW || "";
const DOWNLOAD_SONGS_DIR = process.env.DOWNLOAD_SONGS_DIR || "";
let REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD = process.env.REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD || defaultRequiredWaitTimeForSongDownload;

if (!PlaylistCacheDirPath) {
  throw createError({ statusCode: 500, message: "Playlist cache directory not set" });
}

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  Logger.warn("Spotify Client ID or Client Secret not set -> spotify api will not work");
}

export class ConfigHelper {
  static getPlaylistCacheDirPath() {

    // check if the path exists
    if (!fs.existsSync(PlaylistCacheDirPath)) {
      fs.mkdirSync(PlaylistCacheDirPath, { recursive: true });
      Logger.log(`Playlist cache directory created: ${PlaylistCacheDirPath}`);
    }

    return PlaylistCacheDirPath;
  }

  static getClientId() {
    return SPOTIFY_CLIENT_ID;
  }

  static getClientSecret() {
    return SPOTIFY_CLIENT_SECRET;
  }

  static getUltraStarCompanionPort() {
    return ULTRA_STAR_COMPANION_PORT;
  }

  static getUsdbAnimuxId() {
    return USDB_ANIMUX_ID;
  }

  static getUsdbAnimuxPw() {
    return USDB_ANIMUX_PW;
  }

  static getDownloadSongsDir() {
    return DOWNLOAD_SONGS_DIR;
  }

  static getRequiredWaitTimeForSongDownload() {
    if (typeof REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD !== 'number') {
      REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD = defaultRequiredWaitTimeForSongDownload;
      Logger.warn(`REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD is not a number, using ${defaultRequiredWaitTimeForSongDownload} as default`);
    }
    if (REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD < 0) {
      REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD = defaultRequiredWaitTimeForSongDownload;
    }
    if (isNaN(REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD)) {
      REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD = defaultRequiredWaitTimeForSongDownload;
    }
    
    return REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD;
  }
}