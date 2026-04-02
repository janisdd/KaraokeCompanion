import dotenv, {config as loadEnv} from 'dotenv'
import fs from "fs";
import { Logger } from './logger';

//NOTE: startup-env must be run before this, else the process.env variables are not set

loadEnv();
dotenv.config({ path: "./secrets/.env" });

const defaultRequiredWaitTimeForSongDownload = 30;
const defaultDownloadPreferredVideoHeight = 720;
const defaultNumAnalyzeWorkers = 2;
const defaultNormalLoudness = 16;
const USDB_ANIMUX_URL = "https://usdb.animux.de";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const ULTRA_STAR_COMPANION_PORT = process.env.ULTRA_STAR_COMPANION_PORT || "";
const PlaylistCacheDirPath = process.env.PLAYLIST_CACHE_DIR_PATH || "";
const USDB_ANIMUX_ID = process.env.USDB_ANIMUX_ID || "";
const USDB_ANIMUX_PW = process.env.USDB_ANIMUX_PW || "";
const DOWNLOAD_SONGS_DIR = process.env.DOWNLOAD_SONGS_DIR || "";
let REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD = process.env.REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD || defaultRequiredWaitTimeForSongDownload;
let DOWNLOAD_PREFERRED_VIDEO_HEIGHT = process.env.DOWNLOAD_PREFERRED_VIDEO_HEIGHT || defaultDownloadPreferredVideoHeight;
let DOWNLOAD_PREFERRED_VIDEO_FORMAT = process.env.DOWNLOAD_PREFERRED_VIDEO_FORMAT || "mp4";
let DOWNLOAD_CONVERT_AUDIO_FORMAT = process.env.DOWNLOAD_CONVERT_AUDIO_FORMAT || "mp3";
let ALL_SONGS_BY_ARTIST_PAGE = process.env.ALL_SONGS_BY_ARTIST_PAGE || `${USDB_ANIMUX_URL}/index.php?link=byartist`;
let DOWNLOAD_USE_HEADLESS_MODE = process.env.DOWNLOAD_USE_HEADLESS_MODE || false;
let NUM_ANALYZE_WORKERS = process.env.NUM_ANALYZE_WORKERS || defaultNumAnalyzeWorkers; // 2 for in case of low cpu power
let ADMIN_PAGE_PW = process.env.ADMIN_PAGE_PW || "12345";
let NORMAL_LOUDNESS = process.env.NORMAL_LOUDNESS || defaultNormalLoudness; // apparently the normal loudness is 16 LUFS (Loudness Units Full Scale)

if (!PlaylistCacheDirPath) {
  throw new Error("Playlist cache directory not set")
}

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  Logger.warn("Spotify Client ID or Client Secret not set -> spotify api will not work");
}

export class ConfigHelper {
  static getUsdbAnimuxUrl() {
    return USDB_ANIMUX_URL;
  }

  static getUltraStarSongsDirPaths() {
    const songsDirKeys = Object.keys(process.env)
      .filter((key) => /^ULTRA_START_SONGS_DIR_PATH\d+$/.test(key))
      .sort((a, b) => {
        const aNum = Number(a.replace('ULTRA_START_SONGS_DIR_PATH', ''));
        const bNum = Number(b.replace('ULTRA_START_SONGS_DIR_PATH', ''));
        return aNum - bNum;
      });

    return songsDirKeys
      .map((key) => process.env[key])
      .filter((value): value is string => Boolean(value));
  }

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

  static getDownloadPreferredVideoFormat() {
    return DOWNLOAD_PREFERRED_VIDEO_FORMAT;
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

  static getDownloadPreferredVideoHeight() {
    return getEnvVarAsNumber(DOWNLOAD_PREFERRED_VIDEO_HEIGHT, defaultDownloadPreferredVideoHeight);
  }

  static getRequiredWaitTimeForSongDownload() {
    
    return getEnvVarAsNumber(REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD, defaultRequiredWaitTimeForSongDownload);
  }

  static getDownloadConvertAudioFormat() {
    return DOWNLOAD_CONVERT_AUDIO_FORMAT;
  }

  static getAllSongsByArtistPage() {
    return ALL_SONGS_BY_ARTIST_PAGE;
  }

  static getDownloadUseHeadlessMode() {
    if (typeof DOWNLOAD_USE_HEADLESS_MODE === 'string') {
      if (DOWNLOAD_USE_HEADLESS_MODE === 'true') {
        DOWNLOAD_USE_HEADLESS_MODE = true;
      } else {
        DOWNLOAD_USE_HEADLESS_MODE = false;
      }
    }
    return DOWNLOAD_USE_HEADLESS_MODE;
  }

  static getNumAnalyzeWorkers() {
    return getEnvVarAsNumber(NUM_ANALYZE_WORKERS, defaultNumAnalyzeWorkers);
  }

  static getAdminPagePw() {
    return ADMIN_PAGE_PW;
  }

  static getNormalLoudness() {
    return getEnvVarAsNumber(NORMAL_LOUDNESS, defaultNormalLoudness);
  }
}


function getEnvVarAsNumber(value: string | number, defaultValue: number) {
  if (typeof value === 'string') {
    const regex = /^\d+$/;
    if (!regex.test(value)) {
      return defaultValue;
    }
    return parseInt(value);
  }
  if (typeof value === 'number') {
    if (isNaN(value)) {
      return defaultValue;
    }
    if (value < 0) {
      return defaultValue;
    }
    return value;
  }
  return defaultValue;
}
