import dotenv, {config as loadEnv} from 'dotenv'
import fs from "fs";
import path from "path"
import { Logger } from './logger';

//NOTE: startup-env must be run before this, else the process.env variables are not set

loadEnv();
dotenv.config({ path: "./secrets/.env" });

const defaultRequiredWaitTimeForSongDownload = 30;
const defaultDownloadPreferredVideoHeight = 720;
const defaultNumAnalyzeWorkers = 2;
const defaultNormalLoudness = -16;
const defaultWaitToReplaceFileForExecuteHelpersInMs = 500;
const defaultReplaceFileForExecuteHelpersAttempts = 5;
const USDB_ANIMUX_URL = "https://usdb.animux.de";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const TIDAL_CLIENT_ID = process.env.TIDAL_CLIENT_ID || "";
const TIDAL_CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET || "";
const defaultUltraStarCompanionUrl = "http://localhost:3001"

function parseUltraStarCompanionBaseUrl(raw: string | undefined): string {
  const candidate = raw?.trim()
  const value =
    candidate && candidate.length > 0 ? candidate : defaultUltraStarCompanionUrl
  let u: URL
  try {
    u = new URL(value)
  } catch {
    throw new Error(
      `ULTRASTAR_COMPANION_URL must be a valid absolute URL (got "${raw}")`,
    )
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(
      `ULTRASTAR_COMPANION_URL must use http or https (got "${value}")`,
    )
  }
  // Strip one trailing slash so `${base}/path` joins cleanly; keeps userinfo, port, path prefix
  return value.replace(/\/$/, "")
}

const ULTRASTAR_COMPANION_BASE_URL = parseUltraStarCompanionBaseUrl(
  process.env.ULTRASTAR_COMPANION_URL,
)
const STORAGE_ROOT = (process.env.ALL_FILES_PREFIX_DIR || "storage_dir").trim()

function isResolvedPathInsideDir(dirAbs: string, candidateAbs: string): boolean {
  const rel = path.relative(dirAbs, candidateAbs)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

/** Relative segment only; joined under ALL_FILES_PREFIX_DIR (no absolute paths, no .. escape). */
function resolveUnderStorage(
  envValue: string | undefined,
  defaultRelative: string,
  envKeyForErrors: string,
): string {
  const segment = envValue?.trim() || defaultRelative
  if (!segment) {
    throw new Error(`${envKeyForErrors} cannot be empty`)
  }
  if (path.isAbsolute(segment)) {
    throw new Error(
      `${envKeyForErrors} must be a relative path under ALL_FILES_PREFIX_DIR, not an absolute path`,
    )
  }
  const storageAbs = path.resolve(STORAGE_ROOT)
  const joined = path.normalize(path.join(STORAGE_ROOT, segment))
  const joinedAbs = path.resolve(joined)
  if (!isResolvedPathInsideDir(storageAbs, joinedAbs)) {
    throw new Error(
      `${envKeyForErrors} must resolve inside ALL_FILES_PREFIX_DIR (got "${segment}")`,
    )
  }
  return joined
}

const PlaylistCacheDirPath = resolveUnderStorage(
  process.env.PLAYLIST_CACHE_DIR_PATH,
  "playlistCaches",
  "PLAYLIST_CACHE_DIR_PATH",
)
const USDB_ANIMUX_ID = process.env.USDB_ANIMUX_ID || "";
const USDB_ANIMUX_PW = process.env.USDB_ANIMUX_PW || "";
const USERS_DIR = resolveUnderStorage(process.env.USERS_DIR, "users", "USERS_DIR")
const REDOWNLOAD_SONGS_TRASH_DIR = resolveUnderStorage(
  process.env.REDOWNLOAD_SONGS_TRASH_DIR,
  "trash",
  "REDOWNLOAD_SONGS_TRASH_DIR",
)
const DOWNLOAD_SONGS_DIR = resolveUnderStorage(
  process.env.DOWNLOAD_SONGS_DIR,
  "download_work",
  "DOWNLOAD_SONGS_DIR",
)
const OnlineSongsIndexFilePath = resolveUnderStorage(
  process.env.ONLINE_SONGS_INDEX_NAME,
  "online_songs_index.json",
  "ONLINE_SONGS_INDEX_NAME",
)
let REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD = process.env.REQUIRED_WAIT_TIME_FOR_SONG_DOWNLOAD || defaultRequiredWaitTimeForSongDownload;
let DOWNLOAD_PREFERRED_VIDEO_HEIGHT = process.env.DOWNLOAD_PREFERRED_VIDEO_HEIGHT || defaultDownloadPreferredVideoHeight;
let DOWNLOAD_PREFERRED_VIDEO_FORMAT = process.env.DOWNLOAD_PREFERRED_VIDEO_FORMAT || "mp4";
let DOWNLOAD_CONVERT_AUDIO_FORMAT = process.env.DOWNLOAD_CONVERT_AUDIO_FORMAT || "mp3";
let ALL_SONGS_BY_ARTIST_PAGE = process.env.ALL_SONGS_BY_ARTIST_PAGE || `${USDB_ANIMUX_URL}/index.php?link=byartist`;
let DOWNLOAD_USE_HEADLESS_MODE = process.env.DOWNLOAD_USE_HEADLESS_MODE || false;
let NUM_ANALYZE_WORKERS = process.env.NUM_ANALYZE_WORKERS || defaultNumAnalyzeWorkers; // 2 for in case of low cpu power
let ADMIN_PAGE_PW = process.env.ADMIN_PAGE_PW || "12345";
let NORMAL_LOUDNESS = process.env.NORMAL_LOUDNESS || defaultNormalLoudness; // normal loudness target in LUFS (Loudness Units Full Scale), e.g. -16
let WAIT_TO_REPLACE_FILE_FOR_EXECUTE_HELPERS_IN_MS =
  process.env.WAIT_TO_REPLACE_FILE_FOR_EXECUTE_HELPERS_IN_MS ?? defaultWaitToReplaceFileForExecuteHelpersInMs;
let REPLACE_FILE_FOR_EXECUTE_HELPERS_ATTEMPTS =
  process.env.REPLACE_FILE_FOR_EXECUTE_HELPERS_ATTEMPTS ?? defaultReplaceFileForExecuteHelpersAttempts;

if (!USERS_DIR) {
  throw new Error("Users directory not set")
}

if (!PlaylistCacheDirPath) {
  throw new Error("Playlist cache directory not set")
}

if (!REDOWNLOAD_SONGS_TRASH_DIR) {
  throw new Error("Trash directory not set")
}

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  Logger.warn("Spotify Client ID or Client Secret not set -> spotify api will not work");
}

export class ConfigHelper {
  static getUsdbAnimuxUrl() {
    return USDB_ANIMUX_URL;
  }

  static getAllFilesPrefixDir() {
    return STORAGE_ROOT
  }

  static getOnlineSongsIndexPath() {
    return OnlineSongsIndexFilePath
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

  static getSpotifyClientId() {
    return SPOTIFY_CLIENT_ID;
  }

  static getSpotifyClientSecret() {
    return SPOTIFY_CLIENT_SECRET;
  }

  static getTidalClientId() {
    return TIDAL_CLIENT_ID;
  }

  static getTidalClientSecret() {
    return TIDAL_CLIENT_SECRET;
  }

  static getDownloadPreferredVideoFormat() {
    return DOWNLOAD_PREFERRED_VIDEO_FORMAT;
  }

  /** Normalized base (no trailing slash), e.g. http://localhost:3001 or http://host/prefix */
  static getUltraStarCompanionUrl() {
    return ULTRASTAR_COMPANION_BASE_URL
  }

  /** Absolute URL for a companion HTTP path, e.g. "/selectSong" -> base + "/selectSong" */
  static getUltraStarCompanionRequestUrl(endpointPath: string) {
    const p = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`
    return `${ULTRASTAR_COMPANION_BASE_URL}${p}`
  }

  static getUsersDir() {
    return USERS_DIR;
  }

  static getRedownloadSongsTrashDir() {
    return REDOWNLOAD_SONGS_TRASH_DIR;
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
    return getEnvVarAsNumber(NORMAL_LOUDNESS, defaultNormalLoudness, { allowNegative: true });
  }

  /** Delay before swapping execute-helper temp output onto the live file (e.g. after stop preview). */
  static getWaitToReplaceFileForExecuteHelpersInMs() {
    return getEnvVarAsNumber(
      WAIT_TO_REPLACE_FILE_FOR_EXECUTE_HELPERS_IN_MS,
      defaultWaitToReplaceFileForExecuteHelpersInMs,
    );
  }

  /** How many times to try opening the target file for write before replace (Windows file-handle release). */
  static getReplaceFileForExecuteHelpersAttempts() {
    return Math.max(
      1,
      getEnvVarAsNumber(
        REPLACE_FILE_FOR_EXECUTE_HELPERS_ATTEMPTS,
        defaultReplaceFileForExecuteHelpersAttempts,
      ),
    );
  }
}


function getEnvVarAsNumber(
  value: string | number,
  defaultValue: number,
  options: { allowNegative?: boolean } = {},
) {
  const allowNegative = options.allowNegative ?? false
  if (typeof value === 'string') {
    const regex = allowNegative ? /^-?\d+$/ : /^\d+$/;
    if (!regex.test(value)) {
      return defaultValue;
    }
    return parseInt(value);
  }
  if (typeof value === 'number') {
    if (isNaN(value)) {
      return defaultValue;
    }
    if (!allowNegative && value < 0) {
      return defaultValue;
    }
    return value;
  }
  return defaultValue;
}
